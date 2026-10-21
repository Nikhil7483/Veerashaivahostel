from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit, create_notification
from app.schemas.all_schemas import (
    CleaningStatusUpdate,
    CleaningScheduleUpdate,
    CleaningTaskCreate,
    CleaningTaskStatusUpdate,
    ChecklistItemUpdate,
    CleaningChecklistUpdate,
    CleaningVerificationSubmit,
    CleaningStaffAssign,
    CleaningShiftGenerate,
    CleaningRatingSubmit,
    CleaningIssueReport,
    CleaningIssueSubmit,
    CleaningIssueResolve
)
from bson import ObjectId
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

router = APIRouter(prefix="/cleaning", tags=["Room Cleaning"])

VALID_HOSTEL_ROOMS = [
    "Room 01", "Room 02", "Room 04", "Room 05", "Room 06", "Room 07",
    "Room 08", "Room 09", "Room 10", "Room 11", "Room 12", "Room 13"
]

DEFAULT_CHECKLIST = [
    {"key": "sweeping", "label": "Floor Sweeping", "completed": False, "completed_at": None, "notes": ""},
    {"key": "mopping", "label": "Floor Mopping & Disinfection", "completed": False, "completed_at": None, "notes": ""},
    {"key": "dusting", "label": "Dusting Surfaces, Desks & Window Sills", "completed": False, "completed_at": None, "notes": ""},
    {"key": "waste_disposal", "label": "Trash & Waste Bin Disposal", "completed": False, "completed_at": None, "notes": ""},
    {"key": "washroom_cleaning", "label": "Washroom & Toilet Sanitization", "completed": False, "completed_at": None, "notes": ""},
    {"key": "sanitization", "label": "High-Touch Sanitization (Switches, Door Handles)", "completed": False, "completed_at": None, "notes": ""}
]

DEFAULT_STAFF_MEMBERS = []

# ==============================================================================
# SIMPLE DAILY DUTY SYSTEM (ONE DAY = ONE DUTY ROOM = COMPLETE CLEANING + 3 COUNTS)
# ==============================================================================

class DailyDutySubmitRequest(BaseModel):
    cleaning_completed: bool = True
    tiffin_count: int = Field(..., ge=0, description="Morning Tiffin Count (non-negative integer)")
    tiffin_box_count: int = Field(..., ge=0, description="Morning Tiffin Box Count (non-negative integer)")
    night_dinner_count: int = Field(..., ge=0, description="Night Dinner Count (non-negative integer)")
    student_records: Optional[List[dict]] = None

class DailyDutyDirectAssignRequest(BaseModel):
    room_number: str
    reason: Optional[str] = ""

class DailyDutyMarkAbsentRequest(BaseModel):
    reason: str

class DailyDutyPreviousRoomRequest(BaseModel):
    confirm_reversal: Optional[bool] = False

class DailyDutyRejectRequest(BaseModel):
    reason: str

class DailyDutyApproveRequest(BaseModel):
    notes: Optional[str] = ""

async def send_duty_notifications(db, room_number: str, title: str, message: str, notification_type: str = "INFO", notify_wardens: bool = False):
    """
    Sends friendly and funny real-time notifications to duty room students and wardens.
    """
    try:
        students = await db.students.find({"room_number": room_number, "status": "ACTIVE"}).to_list(100)
        for s in students:
            uid = str(s.get("_id"))
            await create_notification(uid, title, message, notification_type, "/student/dashboard")
        
        if notify_wardens:
            admins = await db.users.find({"role": "ADMIN"}).to_list(10)
            for a in admins:
                uid = str(a.get("_id"))
                await create_notification(uid, title, message, notification_type, "/admin/cleaning")
    except Exception as e:
        print(f"Error sending duty notification: {e}")

async def get_or_create_daily_duty(db, date_str: Optional[str] = None) -> dict:
    """
    Authoritative Daily Duty Allocation & Sequential Rotation.
    - 12 valid rooms: Room 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13 (Room 03 excluded).
    - Checks db.daily_duty_records for date_str.
    - If non-existent, determines next eligible room based on the most recent prior duty record.
    - Uses atomic $setOnInsert to prevent duplicate records or race conditions.
    - Keeps db.meal_duty_schedule and db.cleaning_schedule 100% in sync.
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    try:
        day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    except Exception:
        day_name = datetime.now().strftime("%A")

    existing = await db.daily_duty_records.find_one({"date": date_str})
    if existing:
        return existing

    # Find the most recent record before date_str to continue rotation
    last_record = await db.daily_duty_records.find(
        {"date": {"$lt": date_str}}
    ).sort("date", -1).limit(1).to_list(1)

    if last_record and last_record[0].get("room_number") in VALID_HOSTEL_ROOMS:
        last_room = last_record[0]["room_number"]
        idx = VALID_HOSTEL_ROOMS.index(last_room)
        next_room = VALID_HOSTEL_ROOMS[(idx + 1) % len(VALID_HOSTEL_ROOMS)]
    else:
        m_doc = await db.meal_duty_schedule.find_one({"date": date_str})
        if m_doc and m_doc.get("room_number") in VALID_HOSTEL_ROOMS and m_doc.get("room_number") != "Room 03":
            next_room = m_doc["room_number"]
        else:
            default_map = {
                "Monday": "Room 01", "Tuesday": "Room 02", "Wednesday": "Room 04",
                "Thursday": "Room 05", "Friday": "Room 06", "Saturday": "Room 07",
                "Sunday": "Room 08"
            }
            next_room = default_map.get(day_name, "Room 01")

    now = datetime.utcnow()
    new_doc = {
        "date": date_str,
        "day": day_name,
        "room_number": next_room,
        "status": "PENDING",
        "cleaning_completed": False,
        "tiffin_count": 0,
        "tiffin_box_count": 0,
        "night_dinner_count": 0,
        "leave_unlocked": False,
        "completed_at": None,
        "completed_by": None,
        "absence_reason": None,
        "previous_rooms": [],
        "skipped_rooms": [],
        "history": [
            {
                "action": "AUTO_ROTATION",
                "room_number": next_room,
                "previous_room": None,
                "timestamp": now.isoformat(),
                "performed_by": "System",
                "details": f"Daily duty automatically assigned to {next_room} for {date_str}."
            }
        ],
        "created_at": now,
        "updated_at": now
    }

    # Atomic upsert
    res = await db.daily_duty_records.update_one(
        {"date": date_str},
        {"$setOnInsert": new_doc},
        upsert=True
    )

    if res.upserted_id:
        await send_duty_notifications(
            db, next_room,
            "CEO of Cleaning Pvt. Ltd. 😂",
            f"Congratulations! You've been promoted to CEO of Cleaning Pvt. Ltd. 😂 {next_room} is assigned for complete hostel cleaning and all 3 meal counts today.",
            "INFO"
        )

    # Sync meal duty and cleaning schedules
    await db.meal_duty_schedule.update_one(
        {"date": date_str},
        {"$set": {"date": date_str, "day": day_name, "room_number": next_room, "updated_at": now}},
        upsert=True
    )
    await db.cleaning_schedule.update_one(
        {"day": day_name},
        {"$set": {"day": day_name, "room_numbers": [next_room], "updated_at": now}},
        upsert=True
    )

    return await db.daily_duty_records.find_one({"date": date_str})


async def get_all_hostel_rooms(db) -> List[str]:
    """
    Returns sorted list of all 12 valid hostel rooms from the database.
    Room 03 strictly DOES NOT EXIST (never display, create, assign, or count).
    """
    rooms_cursor = db.rooms.find({"room_number": {"$in": VALID_HOSTEL_ROOMS}}).sort("room_number", 1)
    rooms = []
    async for r in rooms_cursor:
        if r["room_number"] != "Room 03" and r["room_number"] in VALID_HOSTEL_ROOMS:
            rooms.append(r["room_number"])
    if not rooms:
        rooms = list(VALID_HOSTEL_ROOMS)
    return sorted(rooms, key=lambda x: VALID_HOSTEL_ROOMS.index(x) if x in VALID_HOSTEL_ROOMS else 999)

async def get_today_assigned_rooms(db):
    """
    Returns (day_name, all_rooms_list). Daily housekeeping and sanitation covers all 12 physical hostel rooms.
    """
    day_name = datetime.now().strftime("%A")
    all_rooms = await get_all_hostel_rooms(db)
    return day_name, all_rooms

async def get_today_meal_duty_room(db, date_str: Optional[str] = None) -> str:
    """
    Returns the single authoritative shared room allocation for the given date.
    Shared by both Hostel Housekeeping and Today's Meal Duty Room.
    Room 03 strictly does not exist and is never returned.
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    try:
        day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    except Exception:
        day_name = datetime.now().strftime("%A")

    # 0. Authoritative daily_duty_records
    duty_rec = await db.daily_duty_records.find_one({"date": date_str})
    if duty_rec and duty_rec.get("room_number") in VALID_HOSTEL_ROOMS and duty_rec.get("room_number") != "Room 03":
        return duty_rec["room_number"]

    # 1. Date-specific meal duty
    doc = await db.meal_duty_schedule.find_one({"date": date_str})
    if doc and doc.get("room_number") in VALID_HOSTEL_ROOMS and doc.get("room_number") != "Room 03":
        return doc["room_number"]

    # 2. Day-of-week meal duty
    day_doc = await db.meal_duty_schedule.find_one({"day": day_name, "date": {"$exists": False}})
    if day_doc and day_doc.get("room_number") in VALID_HOSTEL_ROOMS and day_doc.get("room_number") != "Room 03":
        return day_doc["room_number"]

    # 3. Fallback to cleaning_schedule
    cs_doc = await db.cleaning_schedule.find_one({"day": day_name})
    if cs_doc and cs_doc.get("room_numbers") and cs_doc["room_numbers"][0] in VALID_HOSTEL_ROOMS and cs_doc["room_numbers"][0] != "Room 03":
        return cs_doc["room_numbers"][0]

    default_map = {
        "Monday": "Room 01",
        "Tuesday": "Room 02",
        "Wednesday": "Room 04",
        "Thursday": "Room 05",
        "Friday": "Room 06",
        "Saturday": "Room 07",
        "Sunday": "Room 08",
    }
    return default_map.get(day_name, "Room 01")

# ==============================================================================
# DAILY DUTY REST API ENDPOINTS
# ==============================================================================

@router.get("/duty/today")
async def get_today_daily_duty(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Returns today's active Daily Duty Record.
    If not yet initialized for today, automatically creates it using 12-room sequential rotation.
    Shared by both Housekeeping and Meal Duty.
    """
    db = get_database()
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    doc = await get_or_create_daily_duty(db, target_date)
    
    is_admin = (current_user.get("role") == "ADMIN")
    my_room = None
    if not is_admin:
        student = await db.students.find_one({"email": current_user["email"]})
        my_room = student.get("room_number") if student else None

    duty_room = doc.get("room_number")
    is_my_room_duty = (my_room == duty_room) if my_room else is_admin
    current_status = doc.get("status", "PENDING")

    # Authorization & Lock Flags:
    # 1. Student can edit/submit counts ONLY if their room is the duty room AND status is open for submission
    can_submit_counts = (
        (is_admin or is_my_room_duty) and
        current_status in ["PENDING", "IN_PROGRESS", "RETURNED_FOR_CORRECTION"]
    )
    # 2. Counts are locked after submission while awaiting approval or when completed
    is_counts_locked = (
        not is_admin and
        current_status in ["PENDING_APPROVAL", "COMPLETED"]
    )
    is_pending_approval = (current_status == "PENDING_APPROVAL")
    is_leave_unlocked = (doc.get("leave_unlocked", False) is True) and (current_status == "COMPLETED")

    prev_rooms = doc.get("previous_rooms", [])
    has_previous = len(prev_rooms) > 0
    previous_room = None
    was_previous_absent = False
    if has_previous:
        last_prev = prev_rooms[-1]
        if isinstance(last_prev, dict):
            previous_room = last_prev.get("room_number")
            was_previous_absent = last_prev.get("was_absent", False)
        else:
            previous_room = last_prev
            was_previous_absent = previous_room in doc.get("skipped_rooms", [])

    return {
        "date": doc.get("date"),
        "day": doc.get("day"),
        "room_number": duty_room,
        "duty_room": duty_room,
        "status": current_status,
        "cleaning_completed": doc.get("cleaning_completed", False),
        "tiffin_count": doc.get("tiffin_count", 0),
        "tiffin_box_count": doc.get("tiffin_box_count", 0),
        "night_dinner_count": doc.get("night_dinner_count", 0),
        "submitted_at": doc.get("submitted_at"),
        "submitted_by": doc.get("submitted_by"),
        "approved_at": doc.get("approved_at"),
        "approved_by": doc.get("approved_by"),
        "rejected_at": doc.get("rejected_at"),
        "rejected_by": doc.get("rejected_by"),
        "rejection_reason": doc.get("rejection_reason"),
        "leave_unlocked": is_leave_unlocked,
        "has_previous": has_previous,
        "previous_room": previous_room,
        "was_previous_absent": was_previous_absent,
        "is_my_room_duty": is_my_room_duty,
        "my_room": my_room,
        "can_submit_counts": can_submit_counts,
        "is_counts_locked": is_counts_locked,
        "is_pending_approval": is_pending_approval,
        "valid_rooms": VALID_HOSTEL_ROOMS,
        "student_records": doc.get("student_records", []),
        "history": doc.get("history", [])[-20:]
    }

@router.get("/duty/roster")
async def get_duty_student_roster(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Returns the resident student roster for taking meal counts:
    - Lists active students across all 12 valid rooms (Room 03 excluded).
    - Checks today's attendance: students marked ABSENT or LEAVE are flagged as exempt.
    - If student records were previously saved for today, pre-populates their tiffin and box choices.
    """
    db = get_database()
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    duty_doc = await get_or_create_daily_duty(db, target_date)
    
    # Existing student records from daily duty record
    existing_map = {}
    if duty_doc and "student_records" in duty_doc:
        for r in duty_doc["student_records"]:
            existing_map[r.get("student_id")] = r

    # Fetch active students sorted by room_number and student_id
    students = await db.students.find({"status": "ACTIVE", "room_number": {"$in": VALID_HOSTEL_ROOMS}}).sort([("room_number", 1), ("student_id", 1)]).to_list(500)
    
    # Fetch attendance
    attendance_records = await db.attendance.find({"date": target_date}).to_list(500)
    att_map = {a["student_id"]: a["status"] for a in attendance_records}

    roster = []
    present_count = 0
    absent_count = 0
    leave_count = 0
    tiffin_count = 0
    box_count = 0
    night_dinner_count = 0

    for s in students:
        s_id = s.get("student_id")
        att_status = att_map.get(s_id, "PRESENT")
        is_present = (att_status == "PRESENT")
        
        saved = existing_map.get(s_id)
        if saved:
            tiffin_req = saved.get("tiffin_required", True) if is_present else False
            box_req = saved.get("box_required", False) if is_present else False
            night_req = saved.get("night_required", True) if is_present else False
        else:
            tiffin_req = True if is_present else False
            box_req = False
            night_req = True if is_present else False

        if is_present:
            present_count += 1
            if tiffin_req:
                tiffin_count += 1
            if box_req:
                box_count += 1
            if night_req:
                night_dinner_count += 1
        elif att_status == "LEAVE":
            leave_count += 1
        else:
            absent_count += 1

        roster.append({
            "student_id": s_id,
            "name": s.get("name", "Student"),
            "room_number": s.get("room_number", "Room 01"),
            "bed_number": s.get("bed_number", 1),
            "department": s.get("department", ""),
            "attendance_status": att_status,
            "is_present": is_present,
            "tiffin_required": tiffin_req,
            "box_required": box_req,
            "night_required": night_req
        })

    computed_dinner = sum(1 for s in roster if s.get("night_required") and s.get("is_present"))

    return {
        "date": target_date,
        "duty_room": duty_doc.get("room_number"),
        "status": duty_doc.get("status"),
        "cleaning_completed": duty_doc.get("cleaning_completed", False),
        "present_count": present_count,
        "absent_count": absent_count,
        "leave_count": leave_count,
        "tiffin_count": tiffin_count,
        "tiffin_box_count": box_count,
        "night_dinner_count": computed_dinner,
        "students": roster
    }

@router.post("/duty/directly-assign")
async def directly_assign_duty_room(data: DailyDutyDirectAssignRequest, current_user: dict = Depends(require_admin)):
    """
    Warden directly assigns the Daily Duty Room from the 12 valid rooms.
    Updates shared allocation for both Housekeeping and Meal Duty.
    Pushes current room to history stack so previous room can be restored.
    """
    db = get_database()
    room_no = data.room_number.strip()
    if room_no not in VALID_HOSTEL_ROOMS or room_no == "Room 03":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid room '{room_no}'. Valid rooms: {VALID_HOSTEL_ROOMS}. Room 03 strictly does not exist."
        )

    doc = await get_or_create_daily_duty(db)
    curr_room = doc.get("room_number")
    target_date = doc.get("date")
    day_name = doc.get("day")

    if curr_room == room_no:
        return {
            "message": f"{room_no} is already the active Daily Duty Room.",
            "duty_room": room_no,
            "date": target_date
        }

    now = datetime.utcnow()
    prev_entry = {"room_number": curr_room, "was_absent": False, "reason": "Direct assignment reassignment"}
    hist_entry = {
        "action": "DIRECT_ASSIGN",
        "previous_room": curr_room,
        "room_number": room_no,
        "reason": data.reason or "Directly assigned by Warden",
        "performed_by": current_user.get("name", current_user.get("email")),
        "timestamp": now.isoformat(),
        "details": f"Warden directly assigned duty to {room_no} (Previous: {curr_room}). Reason: {data.reason or 'None'}"
    }

    await db.daily_duty_records.update_one(
        {"date": target_date},
        {
            "$set": {
                "room_number": room_no,
                "status": "PENDING",
                "cleaning_completed": False,
                "tiffin_count": 0,
                "tiffin_box_count": 0,
                "night_dinner_count": 0,
                "leave_unlocked": False,
                "updated_at": now
            },
            "$push": {
                "previous_rooms": prev_entry,
                "history": hist_entry
            }
        }
    )

    # Sync meal duty and cleaning schedules
    await db.meal_duty_schedule.update_one(
        {"date": target_date},
        {"$set": {"date": target_date, "day": day_name, "room_number": room_no, "assigned_by": current_user.get("name", "Hostel Warden"), "updated_at": now}},
        upsert=True
    )
    await db.cleaning_schedule.update_one(
        {"day": day_name},
        {"$set": {"day": day_name, "room_numbers": [room_no], "updated_at": now}},
        upsert=True
    )

    await log_audit(
        current_user["email"],
        "DUTY_DIRECTLY_ASSIGNED",
        "CLEANING",
        room_no,
        f"Duty room set to {room_no} (prev: {curr_room})"
    )

    # Friendly notifications
    await send_duty_notifications(
        db, room_no,
        "CEO of Cleaning Pvt. Ltd. 😂",
        f"Congratulations! You've been promoted to CEO of Cleaning Pvt. Ltd. 😂 Warden directly assigned {room_no} for complete hostel cleaning and all 3 meal counts today.",
        "INFO"
    )
    if curr_room and curr_room != room_no:
        await send_duty_notifications(
            db, curr_room,
            "Duty Reassigned",
            f"🔄 Duty moved from your room to {room_no} by Warden.",
            "INFO"
        )

    return {
        "message": f"✅ Daily Duty Room directly assigned to {room_no}.",
        "duty_room": room_no,
        "previous_room": curr_room,
        "date": target_date
    }

@router.post("/duty/mark-absent")
async def mark_duty_room_absent(data: DailyDutyMarkAbsentRequest, current_user: dict = Depends(require_admin)):
    """
    Warden marks current duty room ABSENT with a required reason.
    Advances rotation to next eligible room, skipping absent/skipped rooms.
    Leaves remain locked for absent room.
    """
    db = get_database()
    reason = (data.reason or "").strip()
    if not reason or len(reason) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A mandatory absence reason is required (minimum 3 characters)."
        )

    doc = await get_or_create_daily_duty(db)
    curr_room = doc.get("room_number")
    target_date = doc.get("date")
    day_name = doc.get("day")

    skipped = list(doc.get("skipped_rooms", []))
    if curr_room not in skipped:
        skipped.append(curr_room)

    curr_idx = VALID_HOSTEL_ROOMS.index(curr_room) if curr_room in VALID_HOSTEL_ROOMS else 0
    next_room = None
    for i in range(1, len(VALID_HOSTEL_ROOMS)):
        cand = VALID_HOSTEL_ROOMS[(curr_idx + i) % len(VALID_HOSTEL_ROOMS)]
        if cand not in skipped:
            next_room = cand
            break
    if not next_room:
        next_room = VALID_HOSTEL_ROOMS[(curr_idx + 1) % len(VALID_HOSTEL_ROOMS)]

    now = datetime.utcnow()
    prev_entry = {"room_number": curr_room, "was_absent": True, "reason": reason}
    hist_entry = {
        "action": "MARK_ABSENT",
        "previous_room": curr_room,
        "room_number": next_room,
        "absence_reason": reason,
        "performed_by": current_user.get("name", current_user.get("email")),
        "timestamp": now.isoformat(),
        "details": f"{curr_room} marked ABSENT by Warden ({reason}). Advanced to next eligible room {next_room}."
    }

    await db.daily_duty_records.update_one(
        {"date": target_date},
        {
            "$set": {
                "room_number": next_room,
                "status": "PENDING",
                "cleaning_completed": False,
                "tiffin_count": 0,
                "tiffin_box_count": 0,
                "night_dinner_count": 0,
                "leave_unlocked": False,
                "absence_reason": reason,
                "last_absent_room": curr_room,
                "updated_at": now
            },
            "$addToSet": {"skipped_rooms": curr_room},
            "$push": {
                "previous_rooms": prev_entry,
                "history": hist_entry
            }
        }
    )

    # Sync schedules
    await db.meal_duty_schedule.update_one(
        {"date": target_date},
        {"$set": {"date": target_date, "day": day_name, "room_number": next_room, "assigned_by": current_user.get("name", "Hostel Warden"), "updated_at": now}},
        upsert=True
    )
    await db.cleaning_schedule.update_one(
        {"day": day_name},
        {"$set": {"day": day_name, "room_numbers": [next_room], "updated_at": now}},
        upsert=True
    )

    await log_audit(
        current_user["email"],
        "DUTY_ROOM_MARKED_ABSENT",
        "CLEANING",
        curr_room,
        f"{curr_room} declared ABSENT: {reason}. Next duty: {next_room}"
    )

    # Friendly notifications
    await send_duty_notifications(
        db, curr_room,
        "Room Marked Absent",
        f"⚠️ Warden marked {curr_room} ABSENT ({reason}). Duty moved to next room. Leave facility remains locked.",
        "WARNING"
    )
    await send_duty_notifications(
        db, next_room,
        "CEO of Cleaning Pvt. Ltd. 😂",
        f"Congratulations! You've been promoted to CEO of Cleaning Pvt. Ltd. 😂 Duty moved to {next_room} for complete hostel cleaning and all 3 meal counts today.",
        "INFO"
    )

    return {
        "message": f"⚠️ {curr_room} marked ABSENT. Next eligible room {next_room} is now assigned on duty.",
        "absent_room": curr_room,
        "duty_room": next_room,
        "reason": reason
    }

@router.post("/duty/previous-room")
async def restore_previous_duty_room(data: DailyDutyPreviousRoomRequest, current_user: dict = Depends(require_admin)):
    """
    Warden restores the room assignment that existed immediately before current assignment.
    Reverses accidental absences or reassignments without deleting history.
    """
    db = get_database()
    doc = await get_or_create_daily_duty(db)
    prev_rooms = doc.get("previous_rooms", [])

    if not prev_rooms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No previous room assignment exists for today's duty."
        )

    last_entry = prev_rooms[-1]
    if isinstance(last_entry, dict):
        restored_room = last_entry["room_number"]
        was_absent = last_entry.get("was_absent", False)
    else:
        restored_room = last_entry
        was_absent = restored_room in doc.get("skipped_rooms", [])

    if was_absent and not data.confirm_reversal:
        return {
            "requires_confirmation": True,
            "message": f"Restoring {restored_room} will reverse its absence declaration. Confirm reversal to proceed?",
            "previous_room": restored_room,
            "current_room": doc.get("room_number"),
            "was_absent": True
        }

    curr_room = doc.get("room_number")
    target_date = doc.get("date")
    day_name = doc.get("day")
    now = datetime.utcnow()

    action_name = "REVERSE_ABSENCE" if was_absent else "RESTORE_PREVIOUS_ROOM"
    hist_entry = {
        "action": action_name,
        "previous_room": curr_room,
        "room_number": restored_room,
        "performed_by": current_user.get("name", current_user.get("email")),
        "timestamp": now.isoformat(),
        "details": f"Warden restored duty room to {restored_room} (Reversed from {curr_room})."
    }

    await db.daily_duty_records.update_one(
        {"date": target_date},
        {
            "$set": {
                "room_number": restored_room,
                "status": "PENDING",
                "cleaning_completed": False,
                "leave_unlocked": False,
                "updated_at": now
            },
            "$pull": {
                "previous_rooms": last_entry,
                "skipped_rooms": restored_room
            },
            "$push": {"history": hist_entry}
        }
    )

    # Sync schedules
    await db.meal_duty_schedule.update_one(
        {"date": target_date},
        {"$set": {"date": target_date, "day": day_name, "room_number": restored_room, "assigned_by": current_user.get("name", "Hostel Warden"), "updated_at": now}},
        upsert=True
    )
    await db.cleaning_schedule.update_one(
        {"day": day_name},
        {"$set": {"day": day_name, "room_numbers": [restored_room], "updated_at": now}},
        upsert=True
    )

    await log_audit(
        current_user["email"],
        action_name,
        "CLEANING",
        restored_room,
        f"Restored to {restored_room} (from {curr_room})"
    )

    # Friendly notification
    await send_duty_notifications(
        db, restored_room,
        "Duty Room Restored",
        f"↩️ Previous room assignment restored to {restored_room}.",
        "INFO"
    )

    return {
        "message": f"↩️ Previous Room {restored_room} successfully restored.",
        "duty_room": restored_room,
        "reverted_from": curr_room
    }

@router.post("/duty/submit")
async def submit_daily_duty(data: DailyDutySubmitRequest, current_user: dict = Depends(require_student)):
    """
    Submits daily duty progress and counts:
    - 1 Complete Hostel Cleaning Job
    - 3 Valid Student Meal Counts: Tiffin, Tiffin Box, Night Dinner
    Strict server-side validation:
    - Only authenticated students whose stored residential room matches the active duty room may submit counts.
    - ADMIN/Warden users are strictly rejected.
    - Required counts must be non-negative integers and genuinely submitted.
    - Transitions status to PENDING_APPROVAL with leave strictly locked.
    """
    db = get_database()
    doc = await get_or_create_daily_duty(db)
    duty_room = doc.get("room_number")
    target_date = doc.get("date")

    # 1. Reject ADMIN/Warden users (Rule 2)
    if current_user.get("role") != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The student submission endpoint is reserved for students. Warden actions must use separate authorized endpoints."
        )

    # 2. Authenticated student stored room validation (Rule 1)
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found."
        )
    student_room = student.get("room_number")
    if not student_room or student_room != duty_room:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Only authenticated students whose stored residential room matches the active duty room ({duty_room}) may submit or update the three meal counts."
        )

    # 3. Status locks
    current_status = doc.get("status", "PENDING")
    if current_status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Today's duty has already been approved and completed by the warden. Further modifications are locked."
        )
    if current_status == "ABSENT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Today's duty for {duty_room} was marked ABSENT by the warden. Duty submission is locked."
        )

    # 4. Cleaning completion & meal counts validation (Rule 3)
    if not data.cleaning_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hostel cleaning completion must be confirmed before submitting duty."
        )

    if (
        data.tiffin_count is None or not isinstance(data.tiffin_count, int) or data.tiffin_count < 0 or
        data.tiffin_box_count is None or not isinstance(data.tiffin_box_count, int) or data.tiffin_box_count < 0 or
        data.night_dinner_count is None or not isinstance(data.night_dinner_count, int) or data.night_dinner_count < 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All three meal counts (Tiffin, Tiffin Box, Night Dinner) must be genuinely submitted non-negative integers (>= 0)."
        )

    submitter_name = student.get("name", current_user["email"])
    is_resubmission = (current_status in ["PENDING_APPROVAL", "RETURNED_FOR_CORRECTION"])
    new_status = "PENDING_APPROVAL"
    leave_unlocked = False
    now = datetime.utcnow()

    hist_action = "DUTY_RESUBMITTED" if is_resubmission else "DUTY_SUBMITTED"
    hist_entry = {
        "action": hist_action,
        "room_number": duty_room,
        "status": new_status,
        "cleaning_completed": True,
        "tiffin_count": data.tiffin_count,
        "tiffin_box_count": data.tiffin_box_count,
        "night_dinner_count": data.night_dinner_count,
        "leave_unlocked": False,
        "performed_by": submitter_name,
        "timestamp": now.isoformat(),
        "details": f"Duty submitted by {submitter_name} ({duty_room}). Status: PENDING_APPROVAL. Cleaning: Completed. Counts: Tiffin={data.tiffin_count}, Box={data.tiffin_box_count}, Dinner={data.night_dinner_count}. Awaiting warden approval."
    }

    await db.daily_duty_records.update_one(
        {"date": target_date},
        {
            "$set": {
                "status": new_status,
                "cleaning_completed": True,
                "tiffin_count": data.tiffin_count,
                "tiffin_box_count": data.tiffin_box_count,
                "night_dinner_count": data.night_dinner_count,
                "student_records": data.student_records or [],
                "leave_unlocked": False,
                "submitted_at": now.isoformat(),
                "submitted_by": submitter_name,
                "rejection_reason": None,
                "updated_at": now
            },
            "$push": {"history": hist_entry}
        }
    )

    # Update room cleaning status in rooms collection
    await db.rooms.update_one(
        {"room_number": duty_room},
        {"$set": {
            "cleaning_status": new_status,
            "last_cleaned": "Pending Verification"
        }}
    )

    # Sync counts with meal_counts collection
    await db.meal_counts.update_one(
        {"date": target_date, "session": "Morning Tiffin"},
        {"$set": {
            "date": target_date,
            "duty_room": duty_room,
            "tiffin_assigned": data.tiffin_count,
            "tiffin_box_assigned": data.tiffin_box_count,
            "night_dinner_count": data.night_dinner_count,
            "status": "Pending Confirmation",
            "submitted_by": submitter_name,
            "submitted_at": now,
            "updated_at": now
        }},
        upsert=True
    )
    await db.meal_counts.update_one(
        {"date": target_date, "session": "morning"},
        {"$set": {
            "date": target_date,
            "duty_room": duty_room,
            "session": "morning",
            "final_tiffin_count": data.tiffin_count,
            "final_box_count": data.tiffin_box_count,
            "status": "SUBMITTED",
            "submitted_by": submitter_name,
            "submitted_at": now,
            "updated_at": now
        }},
        upsert=True
    )
    await db.meal_counts.update_one(
        {"date": target_date, "session": "night"},
        {"$set": {
            "date": target_date,
            "duty_room": duty_room,
            "session": "night",
            "final_night_meal_count": data.night_dinner_count,
            "night_lunch_count": data.night_dinner_count,
            "status": "SUBMITTED",
            "submitted_by": submitter_name,
            "submitted_at": now,
            "updated_at": now
        }},
        upsert=True
    )

    # Notifications:
    await send_duty_notifications(
        db, duty_room,
        "Duty Submitted for Approval",
        f"🎉 Mission accomplished! Your duty cleaning and 3 meal counts (Tiffin: {data.tiffin_count}, Box: {data.tiffin_box_count}, Dinner: {data.night_dinner_count}) have been submitted for warden approval.",
        "SUCCESS",
        notify_wardens=True
    )

    await log_audit(
        current_user["email"],
        "DUTY_RECORD_SUBMITTED",
        "CLEANING",
        duty_room,
        f"Duty submitted by {submitter_name} ({duty_room}): Tiffin={data.tiffin_count}, Box={data.tiffin_box_count}, Dinner={data.night_dinner_count}"
    )

    return {
        "message": "🎉 Daily duty submitted for warden approval! Awaiting warden inspection.",
        "status": new_status,
        "cleaning_completed": True,
        "tiffin_count": data.tiffin_count,
        "tiffin_box_count": data.tiffin_box_count,
        "night_dinner_count": data.night_dinner_count,
        "leave_unlocked": False
    }

@router.post("/duty/approve")
async def approve_daily_duty(data: Optional[DailyDutyApproveRequest] = None, current_user: dict = Depends(require_admin)):
    """
    Warden approves the daily duty submitted by the assigned room.
    Requirements (Rules 4, 5, 6):
    - Rejects approval unless a valid student submission exists for active duty date.
    - Rejects approval unless cleaning is complete.
    - Rejects approval unless all three student-submitted counts are present and valid.
    - Locks the student-submitted counts (never overrides with replacement counts).
    - Only successful approval sets status=COMPLETED and unlocks leave.
    """
    db = get_database()
    doc = await get_or_create_daily_duty(db)
    duty_room = doc.get("room_number")
    target_date = doc.get("date")

    if doc.get("status") == "COMPLETED":
        return {
            "message": f"Daily duty for {duty_room} is already approved and completed.",
            "status": "COMPLETED",
            "leave_unlocked": True,
            "approved_by": doc.get("approved_by"),
            "approved_at": doc.get("approved_at")
        }

    # Rule 4: Reject approval unless a valid student submission exists for the active duty date
    if doc.get("status") != "PENDING_APPROVAL" or not doc.get("submitted_at"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve duty for {duty_room}: No valid student submission is pending approval. The duty room residents must complete cleaning and submit all three meal counts first."
        )

    # Rule 4: Reject approval unless cleaning is complete
    if not doc.get("cleaning_completed", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve duty for {duty_room}: Hostel cleaning completion has not been confirmed."
        )

    # Rule 4: Reject approval unless all three student-submitted counts are present and valid
    sub_tiffin = doc.get("tiffin_count")
    sub_box = doc.get("tiffin_box_count")
    sub_dinner = doc.get("night_dinner_count")
    if (
        sub_tiffin is None or not isinstance(sub_tiffin, int) or sub_tiffin < 0 or
        sub_box is None or not isinstance(sub_box, int) or sub_box < 0 or
        sub_dinner is None or not isinstance(sub_dinner, int) or sub_dinner < 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve duty for {duty_room}: All three student meal counts (Tiffin, Tiffin Box, Night Dinner) must be present and valid non-negative integers."
        )

    # Rule 5: Verify and lock the submitted counts; do not accept replacement counts or overriding records
    warden_name = current_user.get("name", current_user.get("email", "Hostel Warden"))
    approval_notes = (data.notes.strip() if data and data.notes else "")
    now = datetime.utcnow()

    hist_entry = {
        "action": "WARDEN_APPROVED",
        "room_number": duty_room,
        "status": "COMPLETED",
        "tiffin_count": sub_tiffin,
        "tiffin_box_count": sub_box,
        "night_dinner_count": sub_dinner,
        "leave_unlocked": True,
        "performed_by": warden_name,
        "timestamp": now.isoformat(),
        "details": f"Warden {warden_name} verified and approved daily duty for {duty_room}. Student counts locked: Tiffin={sub_tiffin}, Box={sub_box}, Dinner={sub_dinner}. Leave unlocked.{f' Notes: {approval_notes}' if approval_notes else ''}"
    }

    # Rule 6: Only successful warden approval may set status=COMPLETED and unlock leave
    await db.daily_duty_records.update_one(
        {"date": target_date},
        {
            "$set": {
                "status": "COMPLETED",
                "cleaning_completed": True,
                "tiffin_count": sub_tiffin,
                "tiffin_box_count": sub_box,
                "night_dinner_count": sub_dinner,
                "leave_unlocked": True,
                "approved_by": warden_name,
                "approved_at": now.isoformat(),
                "approval_notes": approval_notes,
                "rejection_reason": None,
                "updated_at": now
            },
            "$push": {"history": hist_entry}
        }
    )

    # Update room status
    await db.rooms.update_one(
        {"room_number": duty_room},
        {"$set": {
            "cleaning_status": "COMPLETED",
            "last_cleaned": target_date
        }}
    )

    # Sync verified counts to meal_counts collection
    await db.meal_counts.update_one(
        {"date": target_date, "session": "Morning Tiffin"},
        {"$set": {
            "date": target_date,
            "duty_room": duty_room,
            "tiffin_assigned": sub_tiffin,
            "tiffin_box_assigned": sub_box,
            "night_dinner_count": sub_dinner,
            "status": "Confirmed",
            "confirmed_by": warden_name,
            "confirmed_at": now,
            "updated_at": now
        }},
        upsert=True
    )
    await db.meal_counts.update_one(
        {"date": target_date, "session": "morning"},
        {"$set": {
            "date": target_date,
            "duty_room": duty_room,
            "session": "morning",
            "final_tiffin_count": sub_tiffin,
            "final_box_count": sub_box,
            "status": "VERIFIED & LOCKED",
            "confirmed_by": warden_name,
            "confirmed_at": now,
            "updated_at": now
        }},
        upsert=True
    )
    await db.meal_counts.update_one(
        {"date": target_date, "session": "night"},
        {"$set": {
            "date": target_date,
            "duty_room": duty_room,
            "session": "night",
            "final_night_meal_count": sub_dinner,
            "night_lunch_count": sub_dinner,
            "status": "VERIFIED & LOCKED",
            "confirmed_by": warden_name,
            "confirmed_at": now,
            "updated_at": now
        }},
        upsert=True
    )

    # Send notification to student room
    await send_duty_notifications(
        db, duty_room,
        "Oscar loading! 🏆",
        f"Warden Saab has approved your performance. Oscar loading! 🏆 Room {duty_room} duty completed successfully (Tiffin: {sub_tiffin}, Box: {sub_box}, Dinner: {sub_dinner}). Leave facility is now unlocked!",
        "SUCCESS"
    )

    await log_audit(
        current_user["email"],
        "DUTY_APPROVED",
        "CLEANING",
        duty_room,
        f"Warden approved daily duty for {duty_room}. Locked counts: Tiffin={sub_tiffin}, Box={sub_box}, Dinner={sub_dinner}"
    )

    return {
        "message": f"🎉 Daily duty for {duty_room} approved! Counts verified and locked. Leave facility is now unlocked for residents.",
        "status": "COMPLETED",
        "leave_unlocked": True,
        "tiffin_count": sub_tiffin,
        "tiffin_box_count": sub_box,
        "night_dinner_count": sub_dinner,
        "approved_by": warden_name,
        "approved_at": now.isoformat()
    }

@router.post("/duty/reject")
async def reject_daily_duty(data: DailyDutyRejectRequest, current_user: dict = Depends(require_admin)):
    """
    Warden rejects / returns daily duty submission for count or cleaning correction.
    Requires mandatory rejection reason.
    Returns status to RETURNED_FOR_CORRECTION, unlocking student form for re-submission.
    Leave remains strictly locked.
    """
    db = get_database()
    reason = (data.reason or "").strip()
    if not reason or len(reason) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A mandatory reason is required to return duty for correction (minimum 3 characters)."
        )

    doc = await get_or_create_daily_duty(db)
    duty_room = doc.get("room_number")
    target_date = doc.get("date")

    if doc.get("status") not in ["PENDING_APPROVAL", "COMPLETED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot return duty for correction: {duty_room} has no pending student submission to return."
        )

    now = datetime.utcnow()
    warden_name = current_user.get("name", current_user.get("email", "Hostel Warden"))

    hist_entry = {
        "action": "RETURNED_FOR_CORRECTION",
        "room_number": duty_room,
        "status": "RETURNED_FOR_CORRECTION",
        "rejection_reason": reason,
        "leave_unlocked": False,
        "performed_by": warden_name,
        "timestamp": now.isoformat(),
        "details": f"Warden returned duty for correction: {reason}. Counts unlocked for student re-submission. Leave remains locked."
    }

    await db.daily_duty_records.update_one(
        {"date": target_date},
        {
            "$set": {
                "status": "RETURNED_FOR_CORRECTION",
                "leave_unlocked": False,
                "rejection_reason": reason,
                "rejected_by": warden_name,
                "rejected_at": now.isoformat(),
                "updated_at": now
            },
            "$push": {"history": hist_entry}
        }
    )

    # Send notification to student room
    await send_duty_notifications(
        db, duty_room,
        "Director's Cut Needed! 🎬",
        f"Your duty submission needs a director's cut. Check the warden's feedback! 🎬 Warden's reason: {reason}. Please update your counts and re-submit.",
        "WARNING"
    )

    await log_audit(
        current_user["email"],
        "DUTY_RETURNED_FOR_CORRECTION",
        "CLEANING",
        duty_room,
        f"Warden returned duty for {duty_room}: {reason}"
    )

    return {
        "message": f"⚠️ Duty returned to {duty_room} for correction.",
        "status": "RETURNED_FOR_CORRECTION",
        "leave_unlocked": False,
        "rejection_reason": reason,
        "rejected_by": warden_name,
        "rejected_at": now.isoformat()
    }

@router.post("/duty/send-reminder")
async def send_duty_reminder(current_user: dict = Depends(require_admin)):
    """
    Warden sends a humorous reminder to students in the active duty room.
    """
    db = get_database()
    doc = await get_or_create_daily_duty(db)
    duty_room = doc.get("room_number")
    if not duty_room:
        raise HTTPException(status_code=400, detail="No active duty room found.")

    await send_duty_notifications(
        db, duty_room,
        "Bro, the dust is winning! 🦸",
        f"Bro, the dust is winning. Time to save your room! 🦸 {duty_room}, remember to finish today's cleaning and submit all 3 meal counts.",
        "WARNING"
    )
    return {"message": f"⏰ Duty reminder sent to {duty_room}!"}

@router.post("/duty/send-meal-reminder")
async def send_meal_reminder(current_user: dict = Depends(require_admin)):
    """
    Warden sends a humorous meal count reminder to students in the active duty room.
    """
    db = get_database()
    doc = await get_or_create_daily_duty(db)
    duty_room = doc.get("room_number")
    if not duty_room:
        raise HTTPException(status_code=400, detail="No active duty room found.")

    await send_duty_notifications(
        db, duty_room,
        "Count the plates! 🍛",
        f"Count the plates before they disappear mysteriously! 👀 {duty_room}, remember to record breakfast, lunch box, and night dinner counts accurately.",
        "INFO"
    )
    return {"message": f"🍛 Meal count reminder sent to {duty_room}!"}

@router.get("/duty/history")
async def get_daily_duty_history(current_user: dict = Depends(get_current_user)):
    """
    Returns recent 30 daily duty records for Warden and Student dashboards.
    """
    db = get_database()
    cursor = db.daily_duty_records.find({}).sort("date", -1).limit(30)
    records = []
    async for r in cursor:
        r["id"] = str(r["_id"])
        del r["_id"]
        records.append(r)
    return records

async def get_room_day_schedule_map(db):
    """
    Maps each room to its scheduled day from cleaning_schedule and meal_duty_schedule.
    """
    room_map = {}
    schedules = await db.cleaning_schedule.find({}).to_list(None)
    for s in schedules:
        d = s.get("day")
        for r_no in s.get("room_numbers", []):
            if r_no not in room_map and r_no in VALID_HOSTEL_ROOMS and r_no != "Room 03":
                room_map[r_no] = d

    meal_schedules = await db.meal_duty_schedule.find({"date": {"$exists": False}}).to_list(None)
    for m in meal_schedules:
        d = m.get("day")
        r_no = m.get("room_number")
        if r_no and r_no not in room_map and r_no in VALID_HOSTEL_ROOMS and r_no != "Room 03":
            room_map[r_no] = d

    default_days = {
        "Room 01": "Monday",
        "Room 02": "Tuesday",
        "Room 04": "Wednesday",
        "Room 05": "Thursday",
        "Room 06": "Friday",
        "Room 07": "Saturday",
        "Room 08": "Sunday"
    }
    for r_no, day in default_days.items():
        if r_no not in room_map:
            room_map[r_no] = day

    return room_map

@router.get("/daily-board")
async def get_daily_cleaning_board(current_user: dict = Depends(require_admin)):
    """
    Returns the live daily cleaning status for all 12 valid rooms in the hostel.
    Includes resident attendance, bed capacity, task details, and floor information.
    Meal Duty Room and Cleaning status are completely separate.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    meal_duty_room = await get_today_meal_duty_room(db, today_str)
    room_day_map = await get_room_day_schedule_map(db)
    
    board = []
    
    for room_no in scheduled_rooms:
        r = await db.rooms.find_one({"room_number": room_no})
        if not r:
            r = {"room_number": room_no, "total_beds": 6, "cleaning_status": "PENDING"}
            
        try:
            r_int = int(room_no.split()[-1])
            floor_num = 1 if r_int <= 2 else (2 if r_int <= 7 else (3 if r_int <= 11 else 4))
        except Exception:
            floor_num = 1
            
        assigned_day = room_day_map.get(room_no, "Daily")
        
        # Residents in this room
        students = await db.students.find({"room_number": room_no, "status": "ACTIVE"}).to_list(None)
        is_vacant = (len(students) == 0)
        
        # Today's attendance for residents in this room
        attendance = await db.attendance.find({"room_number": room_no, "date": today_str}).to_list(None)
        att_map = {a["student_id"]: a["status"] for a in attendance}
        
        absent_residents = [s["name"] for s in students if att_map.get(s["student_id"]) in ["ABSENT", "LEAVE"]]
        present_residents = [s["name"] for s in students if att_map.get(s["student_id"]) == "PRESENT"]
        
        # Current daily task for today
        task = await db.cleaning_requests.find_one({"room_number": room_no, "date": today_str})
        if not task:
            task = await db.cleaning_requests.find_one({"room_number": room_no}, sort=[("created_at", -1)])
            
        task_data = None
        if task:
            task["id"] = str(task["_id"])
            del task["_id"]
            task_data = task
            
        cleaning_status = task.get("status") if task else r.get("cleaning_status", "PENDING")
        is_meal_duty = (room_no == meal_duty_room)

        if cleaning_status in ["COMPLETED", "VERIFIED"]:
            display_status = "CLEANED & VERIFIED"
            verification_status = "VERIFIED"
        elif cleaning_status == "CLEANED":
            display_status = "CLEANED (AWAITING VERIFICATION)"
            verification_status = "PENDING INSPECTION"
        elif cleaning_status == "RE_CLEANING":
            display_status = "RE-CLEANING REQUIRED"
            verification_status = "REJECTED / RE-CLEANING"
        elif cleaning_status == "IN_PROGRESS":
            display_status = "CLEANING NOW"
            verification_status = "IN PROGRESS"
        elif cleaning_status == "SKIPPED_ABSENT":
            display_status = "ABSENT / SKIPPED"
            verification_status = "SKIPPED"
        else:
            display_status = "PENDING"
            verification_status = "PENDING"

        if is_vacant:
            resident_status = "Vacant Room (0)"
        elif len(absent_residents) == 0:
            resident_status = f"All Present ({len(present_residents)})"
        else:
            resident_status = f"Present: {len(present_residents)}, Away/Leave: {len(absent_residents)}"

        start_time = task_data.get("time") if task_data and task_data.get("time") else "09:00 AM"
        completion_time = r.get("last_cleaned") if cleaning_status == "COMPLETED" else None
            
        board.append({
            "room_number": room_no,
            "floor": floor_num,
            "is_excluded": False,
            "is_vacant": is_vacant,
            "exclusion_reason": "Vacant Room (No residents)" if is_vacant else None,
            "is_scheduled_today": is_meal_duty,
            "is_today_duty_room": is_meal_duty,
            "is_meal_duty_room": is_meal_duty,
            "meal_duty_room": meal_duty_room,
            "duty_room": meal_duty_room,
            "shared_duty_room": meal_duty_room,
            "assigned_day": assigned_day,
            "today_day_name": day_name,
            "today_duty_rooms": [meal_duty_room],
            "today_scheduled_rooms": [meal_duty_room],
            "all_hostel_rooms": scheduled_rooms,
            "total_beds": r.get("total_beds", 6),
            "occupied_beds": len(students),
            "allocated_residents": len(students),
            "cleaning_status": cleaning_status,
            "display_status": display_status,
            "verification_status": verification_status,
            "resident_status": resident_status,
            "assigned_staff": task_data.get("assigned_staff") if task_data else None,
            "start_time": start_time,
            "completion_time": completion_time,
            "last_cleaned": r.get("last_cleaned"),
            "residents_count": len(students),
            "absent_residents": absent_residents,
            "present_residents": present_residents,
            "members_absent": len(absent_residents) > 0,
            "all_members_absent": (len(students) > 0 and len(absent_residents) == len(students)),
            "task": task_data
        })
        
    return board

@router.post("/daily-assign")
async def assign_daily_cleaning(current_user: dict = Depends(require_admin)):
    """
    Assigns daily sanitation for all hostel rooms. Today's assigned duty room starts IN_PROGRESS, others PENDING.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    today_duty_rooms = await get_today_duty_rooms(db, day_name)
    first_room = "Room 01" # Reset/assign shift starts from 1st room: Room 01
    
    created_tasks = []
    for room_no in scheduled_rooms:
        students = await db.students.find({"room_number": room_no, "status": "ACTIVE"}).to_list(None)
        attendance_records = await db.attendance.find({
            "room_number": room_no,
            "date": today_str
        }).to_list(None)
        
        absent_count = sum(1 for a in attendance_records if a.get("status") in ["ABSENT", "LEAVE"])
        present_count = sum(1 for a in attendance_records if a.get("status") == "PRESENT")
        
        existing = await db.cleaning_requests.find_one({
            "room_number": room_no,
            "date": today_str
        })
        
        initial_status = "IN_PROGRESS" if room_no == first_room else "PENDING"
        doc = {
            "room_number": room_no,
            "date": today_str,
            "assigned_staff": None,
            "status": initial_status,
            "priority": "NORMAL",
            "notes": f"Daily sanitation duty for {day_name} ({room_no}).",
            "residents_count": len(students),
            "absent_count": absent_count,
            "present_count": present_count,
            "members_absent": absent_count > 0,
            "updated_at": datetime.utcnow()
        }
        
        if existing:
            await db.cleaning_requests.update_one({"_id": existing["_id"]}, {"$set": doc})
            doc["id"] = str(existing["_id"])
        else:
            doc["created_at"] = datetime.utcnow()
            res = await db.cleaning_requests.insert_one(doc)
            doc["id"] = str(res.inserted_id)
            
        await db.rooms.update_one({"room_number": room_no}, {"$set": {"cleaning_status": initial_status}})
        created_tasks.append(doc)
        
    await log_audit(current_user["email"], "DAILY_CLEANING_ASSIGNED", "CLEANING", f"All {len(created_tasks)} rooms assigned for daily sanitation ({day_name}), starting at {first_room}")
    return {
        "message": f"Daily cleaning assigned for all {len(created_tasks)} rooms ({day_name}), starting at {first_room}.",
        "date": today_str,
        "day_name": day_name,
        "today_duty_rooms": today_duty_rooms,
        "first_room": first_room,
        "tasks": created_tasks
    }

@router.get("/live-status")
async def get_cleaning_live_status(current_user: dict = Depends(get_current_user)):
    """
    Returns real-time operational status of hostel housekeeping across all 12 rooms.
    Separates Meal Duty Room from Cleaning Room completely.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    today_meal_duty_room = await get_today_meal_duty_room(db, today_str)
    today_duty_rooms = [today_meal_duty_room]
    
    completed_count = 0
    skipped_count = 0
    active_room = None
    first_pending = None
    room_summaries = []
    
    for r_no in scheduled_rooms:
        r = await db.rooms.find_one({"room_number": r_no})
        task = await db.cleaning_requests.find_one({"room_number": r_no, "date": today_str})
        status = task.get("status") if task else (r.get("cleaning_status", "PENDING") if r else "PENDING")
        
        if status == "COMPLETED":
            completed_count += 1
        elif status == "SKIPPED_ABSENT":
            skipped_count += 1
        elif status == "IN_PROGRESS" and not active_room:
            active_room = r_no
        elif status == "PENDING" and not first_pending:
            first_pending = r_no
            
        room_summaries.append({
            "room_number": r_no,
            "status": status,
            "is_excluded": False,
            "is_meal_duty": (r_no == today_meal_duty_room),
            "is_today_duty": (r_no == today_meal_duty_room),
            "last_cleaned": r.get("last_cleaned") if r else None
        })
        
    total_rooms = len(scheduled_rooms) # 12 rooms
    is_floor_finished = (completed_count + skipped_count >= total_rooms and total_rooms > 0)
    current_active = active_room or first_pending or ("Finished" if is_floor_finished else (scheduled_rooms[0] if scheduled_rooms else "Room 01"))
    progress_percent = int((completed_count / total_rooms) * 100) if total_rooms > 0 else 0
    remaining_count = max(0, total_rooms - completed_count - skipped_count)
    
    return {
        "day_name": day_name,
        "date": today_str,
        "meal_duty_room": today_meal_duty_room,
        "today_duty_rooms": today_duty_rooms,
        "today_scheduled_rooms": scheduled_rooms,
        "all_rooms": scheduled_rooms,
        "active_room": current_active,
        "currently_cleaning": current_active,
        "completed_count": completed_count,
        "skipped_count": skipped_count,
        "remaining_count": remaining_count,
        "total_rooms": total_rooms,
        "progress_percent": progress_percent,
        "is_floor_finished": is_floor_finished,
        "rooms": room_summaries
    }

@router.post("/complete-and-advance/{room_number}")
async def complete_and_advance(room_number: str, current_user: dict = Depends(require_admin)):
    """
    Marks current room as CLEANED & VERIFIED,
    and automatically advances the live cleaning pointer to the next valid room in the 12-room sequential rotation.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%I:%M %p")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    
    # 1. Mark current room as COMPLETED & VERIFIED
    await db.rooms.update_one(
        {"room_number": room_number},
        {"$set": {
            "cleaning_status": "COMPLETED",
            "verification_status": "VERIFIED",
            "last_cleaned": f"Today at {now_str}",
            "completed_at": now_str
        }}
    )
    
    await db.cleaning_requests.update_many(
        {"room_number": room_number, "date": today_str},
        {"$set": {
            "status": "COMPLETED",
            "verification_status": "VERIFIED",
            "verified_by": current_user.get("full_name") or current_user.get("email"),
            "completion_time": now_str,
            "notes": f"Cleaned & verified via daily sanitation at {now_str}.",
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    # Notify residents of this room
    students_cursor = db.students.find({"room_number": room_number, "status": "ACTIVE"})
    async for s in students_cursor:
        u = await db.users.find_one({"email": s["email"]})
        if u:
            await create_notification(
                str(u["_id"]),
                "Room Cleaning Completed",
                f"Room {room_number} daily sanitisation is COMPLETED & VERIFIED at {now_str}. Leave applications unlocked."
            )
            
    # 2. Advance sequentially across all 12 rooms to next non-completed room
    next_room = None
    if room_number in scheduled_rooms:
        curr_idx = scheduled_rooms.index(room_number)
        for i in range(curr_idx + 1, len(scheduled_rooms)):
            candidate = scheduled_rooms[i]
            cand_task = await db.cleaning_requests.find_one({"room_number": candidate, "date": today_str})
            if not cand_task or cand_task.get("status") not in ["COMPLETED", "SKIPPED_ABSENT"]:
                next_room = candidate
                break
    
    if next_room:
        await db.rooms.update_one({"room_number": next_room}, {"$set": {"cleaning_status": "IN_PROGRESS", "start_time": now_str}})
        await db.cleaning_requests.update_many(
            {"room_number": next_room, "date": today_str},
            {"$set": {"status": "IN_PROGRESS", "start_time": now_str, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        
    await log_audit(
        current_user["email"],
        "CLEANING_COMPLETED_AND_ADVANCED",
        "CLEANING",
        room_number,
        f"{room_number} marked CLEANED & VERIFIED; advanced housekeeping to {next_room or 'All 12 Rooms Finished'}"
    )
    
    return {
        "message": f"✅ {room_number} Cleaned & Verified!" + (f" Advanced to {next_room}." if next_room else f" All {len(scheduled_rooms)} hostel rooms have been sanitized!"),
        "completed_room": room_number,
        "next_room": next_room,
        "is_floor_finished": next_room is None
    }

@router.post("/skip-next-room/{room_number}")
async def skip_to_next_room(room_number: str, current_user: dict = Depends(require_admin)):
    """
    If room member is absent, mark current room as SKIPPED_ABSENT and proceed cleaning to next assigned room.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    
    await db.cleaning_requests.update_many(
        {"room_number": room_number, "date": today_str},
        {"$set": {
            "status": "SKIPPED_ABSENT",
            "notes": "Room member absent/away; skipped to next room.",
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    await db.rooms.update_one(
        {"room_number": room_number},
        {"$set": {"cleaning_status": "SKIPPED_ABSENT"}}
    )
    
    next_room = None
    if room_number in scheduled_rooms:
        curr_idx = scheduled_rooms.index(room_number)
        for i in range(curr_idx + 1, len(scheduled_rooms)):
            candidate = scheduled_rooms[i]
            cand_task = await db.cleaning_requests.find_one({"room_number": candidate, "date": today_str})
            if not cand_task or cand_task.get("status") not in ["COMPLETED", "SKIPPED_ABSENT"]:
                next_room = candidate
                break
            
    if next_room:
        await db.rooms.update_one({"room_number": next_room}, {"$set": {"cleaning_status": "IN_PROGRESS"}})
        await db.cleaning_requests.update_many(
            {"room_number": next_room, "date": today_str},
            {"$set": {"status": "IN_PROGRESS", "updated_at": datetime.utcnow()}},
            upsert=True
        )
        
    await log_audit(
        current_user["email"],
        "CLEANING_PROCEEDED_NEXT",
        "CLEANING",
        room_number,
        f"Member absent in {room_number}; proceeded to clean {next_room or 'End of Shift'}"
    )
    
    return {
        "message": f"Member absent in {room_number}. Proceeded to clean {next_room or 'End of Shift'}.",
        "current_room": room_number,
        "next_room": next_room
    }

@router.post("/move-previous-room/{room_number}")
async def move_to_previous_room(room_number: str, current_user: dict = Depends(require_admin)):
    """
    Re-opens the previously assigned room in the 13-room sequence.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    
    if room_number not in scheduled_rooms:
        raise HTTPException(status_code=400, detail=f"{room_number} is not in hostel rooms roster.")
        
    curr_idx = scheduled_rooms.index(room_number)
    if curr_idx <= 0:
        raise HTTPException(status_code=400, detail=f"Already at {scheduled_rooms[0]}. No previous room.")
        
    prev_room = scheduled_rooms[curr_idx - 1]
    prev_req = await db.cleaning_requests.find_one({"room_number": prev_room, "date": today_str})
    if prev_req and prev_req.get("status") == "COMPLETED":
        raise HTTPException(status_code=400, detail=f"Cannot move back: {prev_room} is already marked COMPLETED.")
        
    await db.rooms.update_one({"room_number": prev_room}, {"$set": {"cleaning_status": "IN_PROGRESS"}})
    await db.cleaning_requests.update_many(
        {"room_number": prev_room, "date": today_str},
        {"$set": {
            "status": "IN_PROGRESS",
            "notes": f"Re-opened / moved back from {room_number}.",
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    await log_audit(
        current_user["email"],
        "CLEANING_MOVED_PREVIOUS",
        "CLEANING",
        room_number,
        f"Housekeeping moved back from {room_number} to {prev_room}"
    )
    
    return {
        "message": f"Housekeeping moved back from {room_number} to {prev_room}.",
        "current_room": room_number,
        "previous_room": prev_room
    }

@router.post("/clean-room/{room_number}")
async def clean_single_room(room_number: str, current_user: dict = Depends(require_admin)):
    """
    Directly marks an individual room as COMPLETED and unlocks resident leaves.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%I:%M %p")
    
    await db.rooms.update_one(
        {"room_number": room_number},
        {"$set": {
            "cleaning_status": "COMPLETED",
            "last_cleaned": f"Today at {now_str}"
        }}
    )
    await db.cleaning_requests.update_many(
        {"room_number": room_number, "date": today_str},
        {"$set": {
            "status": "COMPLETED",
            "notes": f"Cleaned directly at {now_str}.",
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    students_cursor = db.students.find({"room_number": room_number, "status": "ACTIVE"})
    async for s in students_cursor:
        u = await db.users.find_one({"email": s["email"]})
        if u:
            await create_notification(
                str(u["_id"]),
                "Room Cleaning Completed",
                f"Room {room_number} daily sanitisation is COMPLETED at {now_str}. Leave applications unlocked."
            )
            
    await log_audit(current_user["email"], "CLEANING_ROOM_DIRECT", "CLEANING", room_number, f"{room_number} directly cleaned")
    return {"message": f"✅ {room_number} Cleaned & Locked!", "room_number": room_number}

@router.post("/complete-all")
async def complete_all_rooms(current_user: dict = Depends(require_admin)):
    """
    Mass sanitation: Marks all 13 hostel rooms as COMPLETED and unlocks leave applications for all residents.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%I:%M %p")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    
    for r_no in scheduled_rooms:
        await db.rooms.update_one(
            {"room_number": r_no},
            {"$set": {
                "cleaning_status": "COMPLETED",
                "last_cleaned": f"Today at {now_str}"
            }}
        )
        await db.cleaning_requests.update_many(
            {"room_number": r_no, "date": today_str},
            {"$set": {
                "status": "COMPLETED",
                "notes": f"Hostel-wide daily sanitation completed at {now_str}.",
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
        students_cursor = db.students.find({"room_number": r_no, "status": "ACTIVE"})
        async for s in students_cursor:
            u = await db.users.find_one({"email": s["email"]})
            if u:
                await create_notification(
                    str(u["_id"]),
                    "Room Cleaning Completed",
                    f"Room {r_no} daily sanitisation is COMPLETED at {now_str}. Leave applications unlocked."
                )
                
    await log_audit(current_user["email"], "CLEANING_COMPLETE_ALL", "CLEANING", f"All {len(scheduled_rooms)} rooms sanitized")
    return {
        "message": f"🎉 All {len(scheduled_rooms)} hostel rooms have been sanitized and locked!",
        "completed_count": len(scheduled_rooms)
    }

class AssignDutyRoomRequest(BaseModel):
    room_number: str
    day_name: Optional[str] = None
    date: Optional[str] = None

@router.post("/assign-duty-room")
@router.post("/assign-meal-duty-room")
async def assign_duty_room(data: AssignDutyRoomRequest, current_user: dict = Depends(require_admin)):
    """
    Admin assigns ANY room as the single Shared Duty Room for Housekeeping & Meal Duty.
    Both operations read and reflect the exact same room allocation.
    Room 03 strictly does not exist and must never be allocated.
    """
    db = get_database()
    today_str = data.date or datetime.now().strftime("%Y-%m-%d")
    target_day = data.day_name or datetime.now().strftime("%A")
    room_number = data.room_number.strip()
    
    valid_rooms = await get_all_hostel_rooms(db)
    if room_number not in valid_rooms or room_number == "Room 03":
        raise HTTPException(
            status_code=400,
            detail=f"Invalid room number '{room_number}'. Valid hostel rooms (12 rooms, Room 03 strictly does not exist): {valid_rooms}"
        )
        
    # 1. Update meal duty schedule for target date
    await db.meal_duty_schedule.update_one(
        {"date": today_str},
        {"$set": {
            "room_number": room_number,
            "day": target_day,
            "date": today_str,
            "allocated_by": current_user.get("email"),
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    # 2. Update day-of-week schedule fallback
    await db.meal_duty_schedule.update_one(
        {"day": target_day, "date": {"$exists": False}},
        {"$set": {"room_number": room_number, "day": target_day, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    # 3. Synchronize cleaning_schedule table
    await db.cleaning_schedule.update_one(
        {"day": target_day},
        {"$set": {"day": target_day, "room_numbers": [room_number], "updated_at": datetime.utcnow()}},
        upsert=True
    )
    # 4. Synchronize daily_duty_records
    await db.daily_duty_records.update_one(
        {"date": today_str},
        {"$set": {
            "room_number": room_number,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    await log_audit(
        current_user["email"],
        "SHARED_DUTY_ROOM_ASSIGNED",
        "SHARED_DUTY",
        f"{room_number} allocated as Shared Duty Room (Housekeeping & Meal Duty) for {today_str} ({target_day})"
    )
    return {
        "message": f"✅ {room_number} successfully allocated as Shared Duty Room (Housekeeping & Meal Duty).",
        "duty_room": room_number,
        "meal_duty_room": room_number,
        "shared_duty_room": room_number,
        "date": today_str,
        "day": target_day,
        "room_number": room_number
    }

@router.post("/set-active-room/{room_number}")
async def set_active_cleaning_room(room_number: str, current_user: dict = Depends(require_admin)):
    """
    Allows admin to choose ANY room to start cleaning immediately (sets it to IN_PROGRESS).
    Resets any other active non-completed room to PENDING.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    valid_rooms = await get_all_hostel_rooms(db)
    if room_number not in valid_rooms:
        raise HTTPException(status_code=400, detail=f"Invalid room {room_number}")
        
    # Reset other rooms that were IN_PROGRESS back to PENDING (unless COMPLETED)
    await db.rooms.update_many(
        {"cleaning_status": "IN_PROGRESS", "room_number": {"$ne": room_number}},
        {"$set": {"cleaning_status": "PENDING"}}
    )
    await db.cleaning_requests.update_many(
        {"date": today_str, "status": "IN_PROGRESS", "room_number": {"$ne": room_number}},
        {"$set": {"status": "PENDING", "updated_at": datetime.utcnow()}}
    )
    
    # Set chosen room to IN_PROGRESS
    await db.rooms.update_one(
        {"room_number": room_number},
        {"$set": {"cleaning_status": "IN_PROGRESS"}}
    )
    await db.cleaning_requests.update_many(
        {"date": today_str, "room_number": room_number},
        {"$set": {"status": "IN_PROGRESS", "updated_at": datetime.utcnow()}},
        upsert=True
    )
    
    await log_audit(current_user["email"], "ACTIVE_ROOM_SET", "CLEANING", f"{room_number} set to IN_PROGRESS")
    return {
        "message": f"🧹 {room_number} is now active and in-progress for cleaning.",
        "active_room": room_number
    }

@router.post("/reset-shift")
async def reset_cleaning_shift(start_room: Optional[str] = "Room 01", current_user: dict = Depends(require_admin)):
    """
    Resets the cleaning shift for all hostel rooms starting from the specified room (default Room 01 to IN_PROGRESS, others to PENDING).
    Preserves today's scheduled duty room without overwriting cleaning_schedule.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    today_duty_rooms = await get_today_duty_rooms(db, day_name)
    
    first_room = start_room if start_room in scheduled_rooms else "Room 01"
    
    for r_no in scheduled_rooms:
        st = "IN_PROGRESS" if r_no == first_room else "PENDING"
        await db.rooms.update_one({"room_number": r_no}, {"$set": {"cleaning_status": st}})
        await db.cleaning_requests.update_many(
            {"room_number": r_no, "date": today_str},
            {"$set": {
                "status": st,
                "notes": f"Daily shift reset from {first_room} for {day_name} ({r_no}).",
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
        
    await log_audit(current_user["email"], "CLEANING_SHIFT_RESET", "CLEANING", f"All {len(scheduled_rooms)} rooms reset starting from {first_room}")
    return {
        "message": f"Housekeeping shift reset starting from {first_room}: {first_room} is now IN_PROGRESS, ready for cleaning.",
        "first_room": first_room,
        "today_duty_rooms": today_duty_rooms,
        "today_scheduled_rooms": today_duty_rooms,
        "all_rooms": scheduled_rooms
    }

@router.get("/requests")
async def list_cleaning_requests(
    status: Optional[str] = None,
    room_number: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if room_number:
        query["room_number"] = room_number
        
    cursor = db.cleaning_requests.find(query).sort("created_at", -1)
    requests = []
    async for c in cursor:
        c["id"] = str(c["_id"])
        del c["_id"]
        requests.append(c)
    return requests

@router.put("/requests/{id}/status")
async def update_cleaning_status(id: str, data: CleaningStatusUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID.")
        
    req = await db.cleaning_requests.find_one({"_id": obj_id})
    if not req:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    update_doc = {"status": data.status, "updated_at": datetime.utcnow()}
    if data.assigned_staff:
        update_doc["assigned_staff"] = data.assigned_staff
    if data.notes:
        update_doc["notes"] = data.notes
        
    await db.cleaning_requests.update_one({"_id": obj_id}, {"$set": update_doc})
    
    room_number = req["room_number"]
    room_update = {"cleaning_status": data.status}
    if data.status == "COMPLETED":
        today_str = datetime.now().strftime("%Y-%m-%d")
        room_update["last_cleaned"] = today_str
        
    await db.rooms.update_one({"room_number": room_number}, {"$set": room_update})
    
    if data.status == "COMPLETED":
        students_cursor = db.students.find({"room_number": room_number, "status": "ACTIVE"})
        async for s in students_cursor:
            u = await db.users.find_one({"email": s["email"]})
            if u:
                await create_notification(
                    str(u["_id"]),
                    "Room Cleaning Completed",
                    f"Room {room_number} cleaning has been completed by {data.assigned_staff or 'housekeeping'}."
                )
                
    await log_audit(current_user["email"], "CLEANING_STATUS_UPDATED", "CLEANING", id, f"Room {room_number} status set to {data.status}")
    
    updated = await db.cleaning_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.get("/schedule")
async def get_cleaning_schedule(current_user: dict = Depends(get_current_user)):
    db = get_database()
    schedule = await db.cleaning_schedule.find({}).to_list(10)
    for s in schedule:
        s["id"] = str(s["_id"])
        del s["_id"]
    return schedule

@router.put("/schedule")
async def update_cleaning_schedule(data: List[CleaningScheduleUpdate], current_user: dict = Depends(require_admin)):
    db = get_database()
    for item in data:
        rooms_to_set = [r for r in item.room_numbers if r in VALID_HOSTEL_ROOMS and r != "Room 03"][:1] if item.room_numbers else []
        await db.cleaning_schedule.update_one(
            {"day": item.day},
            {"$set": {"day": item.day, "room_numbers": rooms_to_set, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        if rooms_to_set:
            await db.meal_duty_schedule.update_one(
                {"day": item.day, "date": {"$exists": False}},
                {"$set": {"day": item.day, "room_number": rooms_to_set[0], "updated_at": datetime.utcnow()}},
                upsert=True
            )
    await log_audit(current_user["email"], "CLEANING_SCHEDULE_UPDATED", "CLEANING", "WEEKLY_SCHEDULE")
    return {"message": "Cleaning schedule updated successfully."}


# ==========================================
# WARDEN & STAFF: TASK MANAGEMENT & VERIFICATION
# ==========================================

@router.get("/staff")
async def get_housekeeping_staff(current_user: dict = Depends(require_admin)):
    """
    Returns authorized housekeeping & sanitation staff members.
    """
    return []


@router.post("/tasks/generate-shift")
async def generate_shift_tasks(data: CleaningShiftGenerate, current_user: dict = Depends(require_admin)):
    """
    Generates one cleaning task for every eligible room for the configured date and shift.
    - Exactly 12 valid rooms (Room 01, Room 02, Room 04 through Room 13; Room 03 excluded).
    - Prevents duplicate tasks if a task already exists for a room on the same date and shift.
    - Uses one combined checklist for each room task.
    """
    db = get_database()
    date_str = data.date or datetime.now().strftime("%Y-%m-%d")
    shift = (data.shift or "MORNING").upper()
    assigned_staff = data.assigned_staff or None
    
    valid_rooms = await get_all_hostel_rooms(db)
    generated = []
    skipped = []
    
    for room_no in valid_rooms:
        if room_no == "Room 03":
            continue
            
        # Check duplicate
        existing = await db.cleaning_requests.find_one({
            "room_number": room_no,
            "date": date_str,
            "shift": shift
        })
        
        if existing:
            existing["id"] = str(existing["_id"])
            del existing["_id"]
            skipped.append(existing)
            continue
            
        # Create fresh task with one combined checklist
        checklist = [
            {
                "key": item["key"],
                "label": item["label"],
                "completed": False,
                "completed_at": None,
                "notes": ""
            }
            for item in DEFAULT_CHECKLIST
        ]
        
        doc = {
            "room_number": room_no,
            "date": date_str,
            "shift": shift,
            "cleaning_type": "Daily Sanitation",
            "assigned_staff": assigned_staff,
            "status": "PENDING",
            "checklist": checklist,
            "checklist_progress": 0,
            "staff_notes": "",
            "verification_status": "PENDING",
            "verification": None,
            "rejection_history": [],
            "re_cleaning_count": 0,
            "reported_issues_count": 0,
            "time": "09:00 AM" if shift == "MORNING" else "03:00 PM",
            "notes": f"Daily sanitation shift ({shift})",
            "created_by": current_user.get("email"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        res = await db.cleaning_requests.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        del doc["_id"]
        generated.append(doc)
        
    await log_audit(
        current_user["email"],
        "CLEANING_SHIFT_GENERATED",
        "CLEANING",
        f"Generated {len(generated)} tasks, {len(skipped)} already existed for {date_str} ({shift})"
    )
    
    return {
        "message": f"Generated {len(generated)} room cleaning tasks for {date_str} ({shift}). {len(skipped)} existing tasks preserved.",
        "date": date_str,
        "shift": shift,
        "tasks_created": len(generated),
        "tasks_created_count": len(generated),
        "already_existing": len(skipped),
        "existing_preserved_count": len(skipped),
        "rooms": [t["room_number"] for t in (generated + skipped)],
        "tasks": generated + skipped
    }


@router.post("/tasks")
async def create_cleaning_task(data: CleaningTaskCreate, current_user: dict = Depends(require_admin)):
    """
    Creates a single room-cleaning task with combined checklist.
    Prevents duplicate task for the same room, date, and shift.
    Excludes Room 03.
    """
    db = get_database()
    room_no = data.room_number.strip()
    if room_no == "Room 03":
        raise HTTPException(status_code=400, detail="Room 03 does not exist in the hostel.")
        
    if room_no not in VALID_HOSTEL_ROOMS:
        raise HTTPException(status_code=400, detail=f"Invalid room number '{room_no}'.")
        
    shift = (data.shift or "MORNING").upper()
    
    # Duplicate check
    existing = await db.cleaning_requests.find_one({
        "room_number": room_no,
        "date": data.date,
        "shift": shift
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A cleaning task for {room_no} on {data.date} ({shift}) already exists."
        )
        
    raw_status = data.status.strip().upper()
    if raw_status in ["IN PROGRESS", "IN_PROGRESS"]:
        status_label = "IN_PROGRESS"
    elif raw_status in ["COMPLETED", "VERIFIED"]:
        status_label = "VERIFIED"
    elif raw_status == "CLEANED":
        status_label = "CLEANED"
    elif raw_status in ["RE_CLEANING", "RE-CLEANING"]:
        status_label = "RE_CLEANING"
    elif raw_status == "OVERDUE":
        status_label = "OVERDUE"
    else:
        status_label = "PENDING"
        
    checklist = [
        {
            "key": item["key"],
            "label": item["label"],
            "completed": (status_label in ["CLEANED", "VERIFIED"]),
            "completed_at": datetime.utcnow().isoformat() if status_label in ["CLEANED", "VERIFIED"] else None,
            "notes": ""
        }
        for item in DEFAULT_CHECKLIST
    ]
    
    doc = {
        "room_number": room_no,
        "date": data.date,
        "shift": shift,
        "time": data.time or "10:00 AM",
        "cleaning_type": data.cleaning_type or "Daily Sanitation",
        "assigned_staff": data.assigned_staff or None,
        "status": status_label,
        "checklist": checklist,
        "checklist_progress": 100 if status_label in ["CLEANED", "VERIFIED"] else 0,
        "staff_notes": data.notes or "",
        "verification_status": "VERIFIED" if status_label == "VERIFIED" else ("PENDING_INSPECTION" if status_label == "CLEANED" else "PENDING"),
        "verification": None,
        "rejection_history": [],
        "re_cleaning_count": 0,
        "reported_issues_count": 0,
        "notes": data.notes or "",
        "created_by": current_user.get("email"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    res = await db.cleaning_requests.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    
    await db.rooms.update_one({"room_number": room_no}, {"$set": {"cleaning_status": status_label}})
    await log_audit(current_user["email"], "CLEANING_TASK_CREATED", "CLEANING", room_no, f"Task created for {room_no} on {data.date}")
    return doc


@router.get("/tasks")
@router.get("/history")
async def get_cleaning_tasks(
    status: Optional[str] = None,
    room_number: Optional[str] = None,
    shift: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    assigned_staff: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Warden endpoint to view cleaning tasks and history with comprehensive filters:
    date, shift, room, staff member, and status.
    """
    db = get_database()
    query = {}
    
    if room_number and room_number != "ALL":
        query["room_number"] = room_number
    if shift and shift != "ALL":
        query["shift"] = shift.upper()
    if assigned_staff and assigned_staff != "ALL":
        query["assigned_staff"] = assigned_staff
        
    if date:
        query["date"] = date
    elif start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    tasks_cursor = db.cleaning_requests.find(query).sort([("date", -1), ("created_at", -1)])
    tasks = []
    
    async for t in tasks_cursor:
        t["id"] = str(t["_id"])
        del t["_id"]
        
        # Ensure combined checklist is populated
        if not t.get("checklist") or len(t.get("checklist", [])) == 0:
            is_cleaned = t.get("status") in ["CLEANED", "VERIFIED", "COMPLETED", "Completed"]
            t["checklist"] = [
                {
                    "key": item["key"],
                    "label": item["label"],
                    "completed": is_cleaned,
                    "completed_at": None,
                    "notes": ""
                }
                for item in DEFAULT_CHECKLIST
            ]
            t["checklist_progress"] = 100 if is_cleaned else 0
            
        st = t.get("status", "PENDING")
        norm_st = st.upper() if isinstance(st, str) else "PENDING"
        if norm_st in ["IN PROGRESS", "IN_PROGRESS"]:
            norm_st = "IN_PROGRESS"
        elif norm_st in ["COMPLETED", "VERIFIED"]:
            norm_st = "VERIFIED"
        elif norm_st == "CLEANED":
            norm_st = "CLEANED"
        elif norm_st in ["RE_CLEANING", "RE-CLEANING"]:
            norm_st = "RE_CLEANING"
        elif norm_st in ["PENDING"] and t.get("date", "") < today_str:
            norm_st = "OVERDUE"
            
        t["status"] = norm_st
        
        # Attach open student issues count for this room
        issues_count = await db.cleaning_issues.count_documents({
            "room_number": t.get("room_number"),
            "status": "PENDING"
        })
        t["open_issues_count"] = issues_count
        
        if status and status != "ALL":
            filter_norm = status.upper().replace("-", "_").replace(" ", "_")
            if norm_st != filter_norm:
                continue
                
        tasks.append(t)
        
    return tasks


@router.get("/tasks/{id}")
async def get_cleaning_task_by_id(id: str, current_user: dict = Depends(require_admin)):
    """
    Returns a single cleaning task with full checklist, staff notes, and verification history.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
        
    task = await db.cleaning_requests.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    task["id"] = str(task["_id"])
    del task["_id"]
    
    # Ensure checklist
    if not task.get("checklist") or len(task.get("checklist", [])) == 0:
        is_cleaned = task.get("status") in ["CLEANED", "VERIFIED", "COMPLETED", "Completed"]
        task["checklist"] = [
            {
                "key": item["key"],
                "label": item["label"],
                "completed": is_cleaned,
                "completed_at": None,
                "notes": ""
            }
            for item in DEFAULT_CHECKLIST
        ]
        task["checklist_progress"] = 100 if is_cleaned else 0
        
    # Get any reported student issues for this room
    issues = await db.cleaning_issues.find({"room_number": task["room_number"]}).sort("created_at", -1).limit(10).to_list(None)
    for iss in issues:
        iss["id"] = str(iss["_id"])
        del iss["_id"]
    task["reported_issues"] = issues
    
    return task


@router.post("/tasks/{id}/start")
async def start_cleaning_task(id: str, current_user: dict = Depends(get_current_user)):
    """
    Staff / Warden starts the room cleaning task:
    Transitions status to IN_PROGRESS and records timestamp.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
        
    task = await db.cleaning_requests.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    now_str = datetime.now().strftime("%I:%M %p")
    await db.cleaning_requests.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "IN_PROGRESS",
            "start_time": now_str,
            "updated_at": datetime.utcnow()
        }}
    )
    await db.rooms.update_one(
        {"room_number": task["room_number"]},
        {"$set": {"cleaning_status": "IN_PROGRESS"}}
    )
    
    await log_audit(current_user["email"], "CLEANING_TASK_STARTED", "CLEANING", task["room_number"], f"Started cleaning {task['room_number']}")
    
    updated = await db.cleaning_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated


@router.put("/tasks/{id}/checklist")
async def update_task_checklist(
    id: str,
    data: CleaningChecklistUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Staff updates items in the combined room checklist.
    Can also submit the room as CLEANED when complete.
    """
    # Prevent regular students from updating checklists
    if current_user.get("role") == "STUDENT":
        raise HTTPException(status_code=403, detail="Students are not authorized to complete or modify staff cleaning checklists.")
        
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
        
    task = await db.cleaning_requests.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    current_checklist = task.get("checklist") or [dict(item) for item in DEFAULT_CHECKLIST]
    checklist_map = {item["key"]: item for item in current_checklist}
    
    now_iso = datetime.utcnow().isoformat()
    for update_item in data.items:
        if update_item.key in checklist_map:
            checklist_map[update_item.key]["completed"] = update_item.completed
            checklist_map[update_item.key]["completed_at"] = now_iso if update_item.completed else None
            if update_item.notes is not None:
                checklist_map[update_item.key]["notes"] = update_item.notes
                
    updated_checklist = list(checklist_map.values())
    total_items = len(updated_checklist)
    completed_items = sum(1 for item in updated_checklist if item.get("completed"))
    progress = int((completed_items / total_items) * 100) if total_items > 0 else 0
    
    update_doc = {
        "checklist": updated_checklist,
        "checklist_progress": progress,
        "updated_at": datetime.utcnow()
    }
    if data.staff_notes is not None:
        update_doc["staff_notes"] = data.staff_notes
        
    room_number = task["room_number"]
    
    if data.submit_cleaned:
        now_str = datetime.now().strftime("%I:%M %p")
        update_doc["status"] = "CLEANED"
        update_doc["verification_status"] = "PENDING_INSPECTION"
        update_doc["completion_time"] = now_str
        await db.rooms.update_one({"room_number": room_number}, {"$set": {"cleaning_status": "CLEANED"}})
        
        # Notify wardens
        admins = db.users.find({"role": "ADMIN"})
        async for adm in admins:
            await create_notification(
                str(adm["_id"]),
                f"Room {room_number} Cleaned — Ready for Inspection",
                f"Housekeeping staff submitted {room_number} as CLEANED. Combined checklist is complete ({completed_items}/{total_items}).",
                notification_type="INFO",
                link="/admin/cleaning"
            )
    else:
        # If task was PENDING or RE_CLEANING, mark as IN_PROGRESS
        if task.get("status") in ["PENDING", "RE_CLEANING"]:
            update_doc["status"] = "IN_PROGRESS"
            await db.rooms.update_one({"room_number": room_number}, {"$set": {"cleaning_status": "IN_PROGRESS"}})
            
    await db.cleaning_requests.update_one({"_id": obj_id}, {"$set": update_doc})
    await log_audit(current_user["email"], "CHECKLIST_UPDATED", "CLEANING", room_number, f"Checklist progress: {progress}% (Submit: {data.submit_cleaned})")
    
    updated = await db.cleaning_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated


@router.post("/tasks/{id}/submit-cleaned")
async def submit_task_cleaned(id: str, current_user: dict = Depends(get_current_user)):
    """
    Authorized staff submits the entire room-cleaning job as CLEANED.
    Awaiting final warden inspection and verification.
    """
    if current_user.get("role") == "STUDENT":
        raise HTTPException(status_code=403, detail="Students cannot mark a room as officially cleaned.")
        
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
        
    task = await db.cleaning_requests.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    now_str = datetime.now().strftime("%I:%M %p")
    room_number = task["room_number"]
    
    # Mark all checklist items completed if not already
    checklist = task.get("checklist") or [dict(item) for item in DEFAULT_CHECKLIST]
    for item in checklist:
        item["completed"] = True
        if not item.get("completed_at"):
            item["completed_at"] = datetime.utcnow().isoformat()
            
    await db.cleaning_requests.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "CLEANED",
            "verification_status": "PENDING_INSPECTION",
            "checklist": checklist,
            "checklist_progress": 100,
            "completion_time": now_str,
            "updated_at": datetime.utcnow()
        }}
    )
    await db.rooms.update_one({"room_number": room_number}, {"$set": {"cleaning_status": "CLEANED"}})
    
    await log_audit(current_user["email"], "ROOM_SUBMITTED_CLEANED", "CLEANING", room_number, f"{room_number} submitted as CLEANED for warden inspection")
    
    updated = await db.cleaning_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return {
        "message": f"Room {room_number} successfully submitted as CLEANED. Ready for warden inspection.",
        "task": updated
    }


@router.post("/tasks/{id}/verify")
async def verify_cleaning_task(
    id: str,
    data: CleaningVerificationSubmit,
    current_user: dict = Depends(require_admin)
):
    """
    Authorized Warden / Admin Verification:
    - Approves job as VERIFIED.
    - Or Rejects job with a MANDATORY reason, returning the task for RE-CLEANING.
    - Preserves the same task ID, appends to rejection history, and prevents duplicate tasks.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
        
    task = await db.cleaning_requests.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    room_number = task["room_number"]
    decision = data.decision.strip().upper()
    now_str = datetime.now().strftime("%I:%M %p")
    today_str = datetime.now().strftime("%Y-%m-%d")
    warden_name = current_user.get("full_name") or current_user.get("email")
    
    if decision == "VERIFIED":
        verification_record = {
            "verified_by": warden_name,
            "verified_by_email": current_user.get("email"),
            "verified_at": datetime.utcnow().isoformat(),
            "remarks": data.remarks or "Approved by warden after physical inspection."
        }
        
        await db.cleaning_requests.update_one(
            {"_id": obj_id},
            {"$set": {
                "status": "VERIFIED",
                "verification_status": "VERIFIED",
                "verification": verification_record,
                "verified_by": warden_name,
                "verified_at": datetime.utcnow(),
                "completion_time": task.get("completion_time") or now_str,
                "updated_at": datetime.utcnow()
            }}
        )
        
        await db.rooms.update_one(
            {"room_number": room_number},
            {"$set": {
                "cleaning_status": "VERIFIED",
                "verification_status": "VERIFIED",
                "last_cleaned": f"Today at {now_str}"
            }}
        )
        
        # Notify residents
        students_cursor = db.students.find({"room_number": room_number, "status": "ACTIVE"})
        async for s in students_cursor:
            u = await db.users.find_one({"email": s["email"]})
            if u:
                await create_notification(
                    str(u["_id"]),
                    "Room Cleaning Verified ✅",
                    f"Room {room_number} cleaning has been inspected and VERIFIED by the warden at {now_str}."
                )
                
        await log_audit(current_user["email"], "CLEANING_VERIFIED", "CLEANING", room_number, f"Room {room_number} approved and verified")
        
        updated = await db.cleaning_requests.find_one({"_id": obj_id})
        updated["id"] = str(updated["_id"])
        del updated["_id"]
        return {
            "message": f"Room {room_number} cleaning has been APPROVED and marked VERIFIED.",
            "task": updated
        }
        
    elif decision == "REJECTED":
        # Mandatory rejection reason enforcement
        if not data.rejection_reason or not data.rejection_reason.strip():
            raise HTTPException(
                status_code=400,
                detail="A mandatory rejection reason is required when returning a room for re-cleaning."
            )
            
        reason = data.rejection_reason.strip()
        re_cleaning_count = task.get("re_cleaning_count", 0) + 1
        
        rejection_entry = {
            "rejected_by": warden_name,
            "rejected_by_email": current_user.get("email"),
            "rejected_at": datetime.utcnow().isoformat(),
            "reason": reason,
            "remarks": data.remarks or "",
            "cycle": re_cleaning_count
        }
        
        # Reset checklist items for re-cleaning
        recleaning_checklist = []
        for item in (task.get("checklist") or DEFAULT_CHECKLIST):
            recleaning_checklist.append({
                "key": item["key"],
                "label": item["label"],
                "completed": False,
                "completed_at": None,
                "notes": f"Re-cleaning required: {reason}" if item.get("key") in ["washroom_cleaning", "mopping"] else ""
            })
            
        await db.cleaning_requests.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "status": "RE_CLEANING",
                    "verification_status": "REJECTED",
                    "checklist": recleaning_checklist,
                    "checklist_progress": 0,
                    "re_cleaning_count": re_cleaning_count,
                    "latest_rejection_reason": reason,
                    "updated_at": datetime.utcnow()
                },
                "$push": {"rejection_history": rejection_entry}
            }
        )
        
        await db.rooms.update_one(
            {"room_number": room_number},
            {"$set": {
                "cleaning_status": "RE_CLEANING",
                "verification_status": "REJECTED"
            }}
        )
        
        await log_audit(
            current_user["email"],
            "CLEANING_REJECTED",
            "CLEANING",
            room_number,
            f"Room {room_number} rejected (Cycle {re_cleaning_count}). Reason: {reason}"
        )
        
        updated = await db.cleaning_requests.find_one({"_id": obj_id})
        updated["id"] = str(updated["_id"])
        del updated["_id"]
        return {
            "message": f"Room {room_number} rejected and returned for RE-CLEANING. Reason: {reason}",
            "task": updated
        }
        
    else:
        raise HTTPException(status_code=400, detail="Invalid decision. Must be 'VERIFIED' or 'REJECTED'.")


@router.put("/tasks/{id}/assign")
async def assign_task_staff(
    id: str,
    data: CleaningStaffAssign,
    current_user: dict = Depends(require_admin)
):
    """
    Warden assigns or reassigns authorized cleaning staff to a room task.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
        
    task = await db.cleaning_requests.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    update_doc = {
        "assigned_staff": data.assigned_staff,
        "updated_at": datetime.utcnow()
    }
    if data.notes:
        update_doc["notes"] = data.notes
        
    await db.cleaning_requests.update_one({"_id": obj_id}, {"$set": update_doc})
    await log_audit(current_user["email"], "CLEANING_STAFF_ASSIGNED", "CLEANING", task["room_number"], f"Assigned staff {data.assigned_staff}")
    
    updated = await db.cleaning_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated


@router.put("/tasks/{id}/status")
async def update_cleaning_task_status(
    id: str,
    data: CleaningTaskStatusUpdate,
    current_user: dict = Depends(require_admin)
):
    """
    Compatibility status update endpoint for Warden.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
        
    task = await db.cleaning_requests.find_one({"_id": obj_id})
    if not task:
        raise HTTPException(status_code=404, detail="Cleaning task not found.")
        
    room_no = task["room_number"]
    raw_status = data.status.strip().upper()
    if raw_status in ["IN PROGRESS", "IN_PROGRESS"]:
        status_label = "IN_PROGRESS"
    elif raw_status in ["COMPLETED", "VERIFIED"]:
        status_label = "VERIFIED"
    elif raw_status == "CLEANED":
        status_label = "CLEANED"
    elif raw_status in ["RE_CLEANING", "RE-CLEANING"]:
        status_label = "RE_CLEANING"
    elif raw_status == "OVERDUE":
        status_label = "OVERDUE"
    else:
        status_label = "PENDING"
        
    update_doc = {
        "status": status_label,
        "updated_at": datetime.utcnow()
    }
    if data.assigned_staff:
        update_doc["assigned_staff"] = data.assigned_staff
    if data.notes is not None:
        update_doc["notes"] = data.notes
        
    await db.cleaning_requests.update_one({"_id": obj_id}, {"$set": update_doc})
    await db.rooms.update_one({"room_number": room_no}, {"$set": {"cleaning_status": status_label}})
    
    updated = await db.cleaning_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated


# ==========================================
# WARDEN: REPORTS & STUDENT ISSUE RESOLUTION
# ==========================================

@router.get("/reports")
async def get_cleaning_reports(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    shift: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Generates comprehensive daily or date-range sanitation reports from actual MongoDB records.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    s_date = start_date or today_str
    e_date = end_date or s_date
    
    query = {"date": {"$gte": s_date, "$lte": e_date}}
    if shift and shift != "ALL":
        query["shift"] = shift.upper()
        
    tasks = await db.cleaning_requests.find(query).to_list(None)
    total_tasks = len(tasks)
    
    verified_count = 0
    cleaned_count = 0
    in_progress_count = 0
    re_cleaning_count = 0
    pending_count = 0
    overdue_count = 0
    
    room_summary_map = {r: {"total": 0, "verified": 0, "cleaned": 0, "re_cleaning": 0, "pending": 0} for r in VALID_HOSTEL_ROOMS}
    staff_summary_map = {}
    
    for t in tasks:
        r_no = t.get("room_number")
        st = (t.get("status") or "PENDING").upper()
        staff = t.get("assigned_staff") or "Housekeeping Staff"
        
        if staff not in staff_summary_map:
            staff_summary_map[staff] = {"assigned": 0, "cleaned": 0, "verified": 0, "rejected": 0}
        staff_summary_map[staff]["assigned"] += 1
        
        if st in ["VERIFIED", "COMPLETED"]:
            verified_count += 1
            staff_summary_map[staff]["verified"] += 1
            if r_no in room_summary_map:
                room_summary_map[r_no]["verified"] += 1
        elif st == "CLEANED":
            cleaned_count += 1
            staff_summary_map[staff]["cleaned"] += 1
            if r_no in room_summary_map:
                room_summary_map[r_no]["cleaned"] += 1
        elif st == "RE_CLEANING":
            re_cleaning_count += 1
            staff_summary_map[staff]["rejected"] += 1
            if r_no in room_summary_map:
                room_summary_map[r_no]["re_cleaning"] += 1
        elif st in ["IN_PROGRESS", "IN PROGRESS"]:
            in_progress_count += 1
        elif st == "OVERDUE":
            overdue_count += 1
        else:
            pending_count += 1
            if r_no in room_summary_map:
                room_summary_map[r_no]["pending"] += 1
                
        if r_no in room_summary_map:
            room_summary_map[r_no]["total"] += 1
            
    # Student reported issues in this period
    issues_query = {"created_at": {"$gte": datetime.strptime(s_date, "%Y-%m-%d")}}
    student_issues = await db.cleaning_issues.find({}).to_list(None)
    total_issues = len(student_issues)
    pending_issues = sum(1 for iss in student_issues if iss.get("status") == "PENDING")
    resolved_issues = sum(1 for iss in student_issues if iss.get("status") == "RESOLVED")
    
    verification_rate = round((verified_count / total_tasks * 100), 1) if total_tasks > 0 else 0
    rejection_rate = round((re_cleaning_count / total_tasks * 100), 1) if total_tasks > 0 else 0
    
    return {
        "start_date": s_date,
        "end_date": e_date,
        "shift": shift or "ALL",
        "total_tasks": total_tasks,
        "verified_count": verified_count,
        "cleaned_count": cleaned_count,
        "in_progress_count": in_progress_count,
        "re_cleaning_count": re_cleaning_count,
        "pending_count": pending_count,
        "overdue_count": overdue_count,
        "verification_rate": verification_rate,
        "rejection_rate": rejection_rate,
        "rooms_breakdown": [{"room_number": k, **v} for k, v in room_summary_map.items()],
        "staff_breakdown": [{"staff_name": k, **v} for k, v in staff_summary_map.items()],
        "student_issues_summary": {
            "total": total_issues,
            "pending": pending_issues,
            "resolved": resolved_issues
        }
    }


@router.get("/issues")
async def get_cleaning_issues(
    room_number: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Warden views cleanliness and sanitation issues reported by students.
    """
    db = get_database()
    query = {}
    if room_number and room_number != "ALL":
        query["room_number"] = room_number
    if status and status != "ALL":
        query["status"] = status.upper()
        
    issues_cursor = db.cleaning_issues.find(query).sort("created_at", -1)
    issues = []
    async for iss in issues_cursor:
        iss["id"] = str(iss["_id"])
        del iss["_id"]
        issues.append(iss)
    return issues


@router.put("/issues/{id}/resolve")
@router.post("/issues/{id}/resolve")
async def resolve_cleaning_issue(
    id: str,
    data: CleaningIssueResolve,
    current_user: dict = Depends(require_admin)
):
    """
    Warden resolves or responds to a student cleanliness/maintenance issue.
    Supports lookup by either MongoDB ObjectId or issue_id (e.g., SAN-0001).
    """
    db = get_database()
    match_conds = [{"issue_id": id}]
    try:
        match_conds.append({"_id": ObjectId(id)})
    except Exception:
        pass
        
    issue = await db.cleaning_issues.find_one({"$or": match_conds})
    if not issue:
        raise HTTPException(status_code=404, detail="Cleanliness issue report not found.")
        
    obj_id = issue["_id"]
        
    if not data.warden_response or not data.warden_response.strip():
        raise HTTPException(status_code=400, detail="Warden response is required to resolve an issue.")
        
    warden_name = current_user.get("full_name") or current_user.get("email")
    await db.cleaning_issues.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": data.status.upper(),
            "warden_response": data.warden_response.strip(),
            "resolved_by": warden_name,
            "resolved_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Notify student
    student_user = await db.users.find_one({"email": issue.get("student_email")})
    if student_user:
        await create_notification(
            str(student_user["_id"]),
            "Sanitation Issue Resolved",
            f"Warden responded to your Room {issue['room_number']} report: {data.warden_response[:80]}"
        )
        
    await log_audit(
        current_user["email"],
        "CLEANING_ISSUE_RESOLVED",
        "CLEANING",
        issue["room_number"],
        f"Issue {issue.get('issue_id')} marked {data.status}"
    )
    
    updated = await db.cleaning_issues.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated


# ==========================================
# STUDENT SIDE: VISIBILITY & REPORTING (STRICT RBAC)
# ==========================================

@router.get("/my-room")
async def get_student_room_cleaning(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Protected Student endpoint:
    - View only their own allocated room's overall cleaning status.
    - View date, shift, overall status, and human-friendly update banner.
    - View sanitized checklist progress without exposing private staff info.
    - Strict IDOR protection: cannot view another room.
    """
    db = get_database()
    email = current_user.get("email")
    student = await db.students.find_one({"email": email})
    
    if not student or not student.get("room_number"):
        if current_user.get("role") == "ADMIN":
            room_no = "Room 01"
        else:
            raise HTTPException(status_code=403, detail="Student room assignment not found.")
    else:
        room_no = student["room_number"]
        
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    today_str = target_date
    day_name = datetime.now().strftime("%A")
    
    room_doc = await db.rooms.find_one({"room_number": room_no})
    
    # Fetch target date's task or latest task for this room
    today_task = await db.cleaning_requests.find_one(
        {"room_number": room_no, "date": target_date},
        sort=[("created_at", -1)]
    )
    if not today_task:
        today_task = await db.cleaning_requests.find_one(
            {"room_number": room_no},
            sort=[("date", -1), ("created_at", -1)]
        )
        
    overall_status = "PENDING"
    shift = "MORNING"
    task_date = today_str
    assigned_staff = "Housekeeping Staff"
    progress = 0
    verification_status = "PENDING"
    re_cleaning_count = 0
    rejection_reason = None
    
    checklist_summary = [
        {"key": item["key"], "label": item["label"], "completed": False}
        for item in DEFAULT_CHECKLIST
    ]
    
    if today_task:
        overall_status = today_task.get("status", "PENDING").upper()
        if overall_status in ["COMPLETED", "VERIFIED"]:
            overall_status = "VERIFIED"
        elif overall_status == "CLEANED":
            overall_status = "CLEANED"
        elif overall_status in ["IN PROGRESS", "IN_PROGRESS"]:
            overall_status = "IN_PROGRESS"
        elif overall_status in ["RE_CLEANING", "RE-CLEANING"]:
            overall_status = "RE_CLEANING"
            
        shift = today_task.get("shift", "MORNING")
        task_date = today_task.get("date", today_str)
        assigned_staff = today_task.get("assigned_staff", "Housekeeping Staff")
        progress = today_task.get("checklist_progress", 0)
        verification_status = today_task.get("verification_status", "PENDING")
        re_cleaning_count = today_task.get("re_cleaning_count", 0)
        
        if today_task.get("checklist"):
            checklist_summary = [
                {
                    "key": item["key"],
                    "label": item["label"],
                    "completed": item.get("completed", False)
                }
                for item in today_task["checklist"]
            ]
            
        if today_task.get("rejection_history"):
            rejection_reason = today_task["rejection_history"][-1].get("reason")
    elif room_doc:
        raw_r_st = (room_doc.get("cleaning_status") or "PENDING").upper()
        if raw_r_st in ["COMPLETED", "VERIFIED"]:
            overall_status = "VERIFIED"
        elif raw_r_st == "CLEANED":
            overall_status = "CLEANED"
        elif raw_r_st in ["IN_PROGRESS", "IN PROGRESS"]:
            overall_status = "IN_PROGRESS"
        elif raw_r_st == "RE_CLEANING":
            overall_status = "RE_CLEANING"
            
    # Human-friendly latest update banner
    if overall_status == "VERIFIED":
        latest_update = f"Housekeeping completed and verified by warden for {task_date}."
    elif overall_status == "CLEANED":
        latest_update = f"Room cleaning completed by {assigned_staff}; awaiting warden inspection."
    elif overall_status == "IN_PROGRESS":
        latest_update = f"Housekeeping is currently in progress by {assigned_staff}."
    elif overall_status == "RE_CLEANING":
        reason_text = f" ({rejection_reason})" if rejection_reason else ""
        latest_update = f"Warden requested re-cleaning{reason_text}. Staff will re-clean shortly."
    else:
        latest_update = f"Scheduled for daily sanitation ({shift} shift)."
        
    # Student's submitted reports for this room
    reports_cursor = db.cleaning_issues.find({"room_number": room_no}).sort("created_at", -1).limit(10)
    submitted_reports = []
    async for r in reports_cursor:
        r["id"] = str(r["_id"])
        del r["_id"]
        submitted_reports.append(r)
        
    # Recent room history (strictly this room only)
    history_cursor = db.cleaning_requests.find({"room_number": room_no}).sort([("date", -1), ("created_at", -1)]).limit(7)
    history = []
    async for h in history_cursor:
        st = (h.get("status") or "PENDING").upper()
        if st in ["COMPLETED", "VERIFIED"]:
            st = "VERIFIED"
        history.append({
            "date": h.get("date"),
            "shift": h.get("shift", "MORNING"),
            "status": st,
            "verification_status": h.get("verification_status", "PENDING")
        })
        
    return {
        "room_number": room_no,
        "date": task_date,
        "shift": shift,
        "overall_status": overall_status,
        "verification_status": verification_status,
        "latest_update": latest_update,
        "assigned_staff": assigned_staff,
        "checklist_progress": progress,
        "checklist_summary": checklist_summary,
        "re_cleaning_count": re_cleaning_count,
        "last_cleaned": room_doc.get("last_cleaned") if room_doc else None,
        "submitted_reports": submitted_reports,
        "history": history
    }


@router.post("/my-room/report-issue")
async def report_student_cleaning_issue(
    data: CleaningIssueSubmit,
    current_user: dict = Depends(get_current_user)
):
    """
    Protected Student endpoint:
    - Report cleanliness or maintenance problem for allocated room.
    - Strict IDOR: locked to student's allocated room.
    - Does NOT alter the official task status.
    - Stored in db.cleaning_issues and visible to wardens.
    """
    db = get_database()
    email = current_user.get("email")
    student = await db.students.find_one({"email": email})
    
    if not student or not student.get("room_number"):
        if current_user.get("role") == "ADMIN":
            room_no = "Room 01"
            student_id = "ADM-001"
            student_name = "Administrator"
        else:
            raise HTTPException(status_code=403, detail="Student room assignment not found.")
    else:
        room_no = student["room_number"]
        student_id = student.get("student_id")
        student_name = student.get("name")
        
    if not data.description or not data.description.strip():
        raise HTTPException(status_code=400, detail="Issue description is required.")
        
    counter = await db.counters.find_one_and_update(
        {"_id": "sanitation_issue_id"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    issue_num = counter.get("sequence_value", 100)
    issue_id = f"SAN-{issue_num:04d}"
    
    doc = {
        "issue_id": issue_id,
        "room_number": room_no,
        "student_id": student_id,
        "student_name": student_name,
        "student_email": email,
        "issue_type": data.issue_type,
        "description": data.description.strip(),
        "priority": data.priority,
        "status": "PENDING",
        "warden_response": None,
        "resolved_at": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    res = await db.cleaning_issues.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    
    # Increment reported_issues_count on today's cleaning task WITHOUT changing official task status
    today_str = datetime.now().strftime("%Y-%m-%d")
    await db.cleaning_requests.update_many(
        {"room_number": room_no, "date": today_str},
        {"$inc": {"reported_issues_count": 1}}
    )
    
    # Notify wardens
    admins = db.users.find({"role": "ADMIN"})
    async for adm in admins:
        await create_notification(
            str(adm["_id"]),
            f"Cleanliness Issue: {room_no} ({issue_id})",
            f"Student {student_name} reported {data.issue_type}: {data.description[:80]}",
            notification_type="WARNING",
            link="/admin/cleaning"
        )
        
    await log_audit(
        email,
        "CLEANING_ISSUE_REPORTED",
        "CLEANING",
        room_no,
        f"Issue {issue_id}: {data.issue_type} - {data.description[:60]}"
    )
    
    return {
        "message": f"Cleanliness issue reported successfully ({issue_id}). The warden has been notified.",
        "issue": doc
    }


@router.get("/my-room/reports")
async def get_student_cleaning_reports(current_user: dict = Depends(get_current_user)):
    """
    Returns cleanliness issues submitted for the student's allocated room.
    """
    db = get_database()
    email = current_user.get("email")
    student = await db.students.find_one({"email": email})
    if not student or not student.get("room_number"):
        if current_user.get("role") == "ADMIN":
            room_no = "Room 01"
        else:
            raise HTTPException(status_code=403, detail="Student room assignment not found.")
    else:
        room_no = student["room_number"]
        
    reports_cursor = db.cleaning_issues.find({"room_number": room_no}).sort("created_at", -1)
    reports = []
    async for r in reports_cursor:
        r["id"] = str(r["_id"])
        del r["_id"]
        reports.append(r)
    return reports


@router.post("/my-room/rating")
async def submit_cleaning_rating(
    data: CleaningRatingSubmit,
    current_user: dict = Depends(get_current_user)
):
    """
    Protected Student endpoint:
    - Rate cleaning (1 to 5 stars) with feedback
    - Strict IDOR protection: verified to belong to student's room only
    """
    db = get_database()
    email = current_user.get("email")
    student = await db.students.find_one({"email": email})
    if not student or not student.get("room_number"):
        raise HTTPException(status_code=403, detail="Student room assignment not found.")
        
    room_no = student["room_number"]
    
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5 stars.")
        
    if data.task_id:
        try:
            obj_id = ObjectId(data.task_id)
            task = await db.cleaning_requests.find_one({"_id": obj_id})
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid task ID.")
            
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")
        if task.get("room_number") != room_no:
            raise HTTPException(status_code=403, detail="Access denied: Cannot rate cleaning for another room.")
    else:
        task = await db.cleaning_requests.find_one(
            {"room_number": room_no},
            sort=[("date", -1), ("created_at", -1)]
        )
        if not task:
            raise HTTPException(status_code=404, detail="No cleaning task found to rate.")
        obj_id = task["_id"]
        
    rating_entry = {
        "rating": data.rating,
        "feedback": data.feedback or "",
        "student_name": student.get("name", "Resident"),
        "student_email": email,
        "created_at": datetime.utcnow()
    }
    
    await db.cleaning_requests.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "student_rating": data.rating,
                "student_feedback": data.feedback or "",
                "rated_by": student.get("name"),
                "rated_at": datetime.utcnow()
            },
            "$push": {"ratings": rating_entry}
        }
    )
    
    await log_audit(email, "CLEANING_RATING_SUBMITTED", "CLEANING", room_no, f"Rated {data.rating}/5 stars")
    return {
        "message": "Thank you! Your cleaning rating and feedback have been submitted.",
        "rating": data.rating
    }


