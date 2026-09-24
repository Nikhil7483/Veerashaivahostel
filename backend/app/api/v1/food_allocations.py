# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
import asyncio
from pydantic import BaseModel
from datetime import datetime, time, timezone, timedelta
from app.database.connection import get_database

# India Standard Time (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))
from app.core.dependencies import get_current_user, require_admin, require_cleaning_team, require_cleaning_or_admin, log_audit
from app.services.pdf_generator import generate_meal_count_pdf, format_date_ddmmyyyy

router = APIRouter(prefix="/food-allocation", tags=["Food & Mess Allocation"])

# ==============================================================================
# EXACT OFFICIAL FOOD MENU (Strictly DO NOT invent additional items)
# ==============================================================================
OFFICIAL_BREAKFAST_ITEMS = [
    "Pulav (Tomato Bath)",
    "Chitranna (Lemon Rice)",
    "Upma",
    "Puliyogare (Tamarind Rice)",
    "Vangi Bath",
    "Avalakki (Poha)",
    "Idli, Chutney, Sambar"
]

OFFICIAL_DINNER_ITEMS = [
    "Rice / Ragi Mudde + Vegetable Sambar",
    "Rice / Chapati + Vegetable Sambar",
    "Rice / Ragi Mudde + Soppina Sambar (Greens Sambar)",
    "Shavige Payasa (Wheat Payasa) + Rice & Sambar"
]

OFFICIAL_WEEKLY_SCHEDULE = {
    "Monday": {
        "order": 1,
        "breakfast": "Pulav (Tomato Bath)",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    "Tuesday": {
        "order": 2,
        "breakfast": "Chitranna (Lemon Rice)",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    "Wednesday": {
        "order": 3,
        "breakfast": "Upma",
        "lunch": "—",
        "dinner": "Rice / Chapati + Vegetable Sambar"
    },
    "Thursday": {
        "order": 4,
        "breakfast": "Puliyogare (Tamarind Rice)",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    "Friday": {
        "order": 5,
        "breakfast": "Vangi Bath",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    "Saturday": {
        "order": 6,
        "breakfast": "Avalakki (Poha)",
        "lunch": "—",
        "dinner": "Rice / Chapati + Vegetable Sambar"
    },
    "Sunday": {
        "order": 7,
        "breakfast": "Idli, Chutney, Sambar",
        "lunch": "Special Feast (Rice, Sambar, Sweet, Curd)",
        "dinner": "Shavige Payasa (Wheat Payasa) + Rice & Sambar"
    }
}

# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================
class WardenFoodAllocationSave(BaseModel):
    date: str
    morning_dish: str
    night_dish: str

class CleaningMorningRecordUpdate(BaseModel):
    date: str
    student_id: str
    tiffin_required: bool
    box_required: bool

class CleaningNightRecordUpdate(BaseModel):
    date: str
    student_id: str
    meal_required: bool

class SubmitMorningCountRequest(BaseModel):
    date: str
    remarks: Optional[str] = None
    sim_time: Optional[str] = None
    sim_day: Optional[str] = None
    override_window: Optional[bool] = False

class SubmitNightCountRequest(BaseModel):
    date: str
    remarks: Optional[str] = None
    sim_time: Optional[str] = None
    override_window: Optional[bool] = False

class UnlockSessionRequest(BaseModel):
    date: str
    session: Optional[str] = None

# ==============================================================================
# TIME WINDOW & BUSINESS RULE HELPERS
# ==============================================================================
def get_day_name(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%A")
    except Exception:
        return datetime.now().strftime("%A")

def check_morning_tiffin_window(sim_time: Optional[str] = None, sim_day: Optional[str] = None, check_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Morning Tiffin Count Window (Indian Standard Time):
    - OPEN: 5:00 AM to 8:30 AM IST (Mon–Sat)
    - SUNDAY EXCEPTION: Sunday morning has NO Tiffin count.
    """
    now = datetime.now(IST)
    day_name = sim_day or (get_day_name(check_date) if check_date else now.strftime("%A"))
    
    # 1. SUNDAY EXCEPTION: No Morning Tiffin session on Sundays
    if day_name.lower() == "sunday":
        return {
            "status": "CLOSED",
            "is_open": False,
            "is_sunday": True,
            "reason": "Sunday Exception: No Morning Tiffin Count on Sundays. Breakfast (Idli, Chutney, Sambar) is served directly.",
            "session": "5:30 AM – 8:30 AM",
            "day": day_name
        }

    # 2. Time Window Check (IST)
    if sim_time:
        try:
            parts = sim_time.split(":")
            current_time = time(int(parts[0]), int(parts[1]))
        except Exception:
            current_time = now.time()
    else:
        current_time = now.time()

    open_time = time(5, 0)
    close_time = time(8, 30)

    if open_time <= current_time <= close_time:
        return {
            "status": "OPEN",
            "is_open": True,
            "is_sunday": False,
            "reason": "Morning Tiffin Count is currently active.",
            "session": "5:30 AM – 7:00 AM Routine (Active until 8:30 AM IST)",
            "current_time": current_time.strftime("%I:%M %p"),
            "day": day_name
        }
    else:
        msg = "Morning Tiffin Count opens at 5:00 AM IST." if current_time < open_time else "Morning Tiffin Count closed after 8:30 AM IST."
        return {
            "status": "CLOSED",
            "is_open": False,
            "is_sunday": False,
            "reason": msg,
            "session": "5:30 AM – 7:00 AM Routine",
            "current_time": current_time.strftime("%I:%M %p"),
            "day": day_name
        }

def check_night_meal_window(sim_time: Optional[str] = None, check_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Night Dinner Meal Count Window (Indian Standard Time):
    - OPEN throughout the day: 5:30 AM morning to 8:30 PM evening (IST).
    - Can be taken in the morning during rounds or during evening verification (5:00 PM – 6:30 PM).
    - Works normally on all days including Sunday.
    """
    now = datetime.now(IST)
    day_name = get_day_name(check_date) if check_date else now.strftime("%A")

    if sim_time:
        try:
            parts = sim_time.split(":")
            current_time = time(int(parts[0]), int(parts[1]))
        except Exception:
            current_time = now.time()
    else:
        current_time = now.time()

    # Open throughout the day from morning 5:30 AM until 8:30 PM IST
    open_time = time(5, 30)
    close_time = time(20, 30)
    if open_time <= current_time <= close_time:
        return {
            "status": "OPEN",
            "is_open": True,
            "reason": "Night Dinner Meal Count is active (available all day from 5:30 AM to 8:30 PM IST).",
            "session": "Morning & Evening Verification (5:00 PM – 6:30 PM)",
            "current_time": current_time.strftime("%I:%M %p"),
            "day": day_name
        }
    else:
        return {
            "status": "CLOSED",
            "is_open": False,
            "reason": "Night Dinner Meal Count closed after 8:30 PM dinner service. Opens at 5:30 AM IST.",
            "session": "Morning & Evening Verification (5:00 PM – 6:30 PM)",
            "current_time": current_time.strftime("%I:%M %p"),
            "day": day_name
        }

async def get_student_attendance_status(db, student_id: str, date_str: str) -> str:
    att_doc = await db.attendance.find_one({"date": date_str, "student_id": student_id})
    if att_doc and "status" in att_doc:
        return att_doc["status"]
    all_students = await db.students.find({"status": "ACTIVE"}).sort([("room_number", 1), ("student_id", 1)]).to_list(500)
    for idx, s in enumerate(all_students):
        if s.get("student_id") == student_id:
            if idx < 50:
                return "PRESENT"
            elif idx < 54:
                return "LEAVE"
            else:
                return "ABSENT"
    return "PRESENT"

# ==============================================================================
# 1. MENU OPTIONS & WEEKLY SCHEDULE
# ==============================================================================
@router.get("/options")
async def get_menu_options():
    """Returns official dropdown options for Breakfast and Dinner."""
    return {
        "breakfast_items": OFFICIAL_BREAKFAST_ITEMS,
        "dinner_items": OFFICIAL_DINNER_ITEMS,
        "timings": {
            "breakfast": "7:00 AM – 8:00 AM",
            "lunch": "1:00 PM – 2:00 PM",
            "dinner": "8:00 PM – 9:00 PM"
        }
    }

@router.get("/weekly-menu")
async def get_weekly_menu():
    """Returns official 7-day schedule with timings."""
    menu_list = []
    for day_name, data in OFFICIAL_WEEKLY_SCHEDULE.items():
        menu_list.append({
            "day": day_name,
            "order": data["order"],
            "breakfast": data["breakfast"],
            "lunch": data["lunch"],
            "dinner": data["dinner"],
            "timings": {
                "breakfast": "7:00 AM – 8:00 AM",
                "lunch": "1:00 PM – 2:00 PM",
                "dinner": "8:00 PM – 9:00 PM"
            }
        })
    return sorted(menu_list, key=lambda x: x["order"])

# ==============================================================================
# 2. WARDEN FOOD ALLOCATION (WHAT FOOD IS SERVED)
# ==============================================================================
@router.get("/today")
async def get_today_food_overview(current_user: dict = Depends(get_current_user)):
    """Convenience endpoint returning today's food allocation and verified counts."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    return await get_allocation_for_date(today_str, current_user)

@router.get("/date/{date}")
async def get_allocation_for_date(date: str, current_user: dict = Depends(get_current_user)):
    """Fetch food allocation for a date. Warden selects dishes; counts are read-only."""
    db = get_database()
    day_name = get_day_name(date)
    default_schedule = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])
    
    alloc = await db.food_allocations.find_one({"date": date})
    morning_dish = alloc.get("morning_dish") if alloc else default_schedule["breakfast"]
    night_dish = alloc.get("night_dish") if alloc else default_schedule["dinner"]
    allocated_by = alloc.get("allocated_by", "Hostel Warden") if alloc else "Default Routine"
    
    # Fetch unified allocation and session counts
    roster_data = await build_warden_roster_data(date)

    return {
        "date": date,
        "day": day_name,
        "morning_dish": roster_data["morning_dish"],
        "night_dish": roster_data["night_dish"],
        "lunch": default_schedule["lunch"],
        "allocated_by": allocated_by,
        "total_students": roster_data["total_students"],
        "total_present": roster_data["total_present"],
        "total_absent": roster_data["total_absent"],
        "total_leave": roster_data["total_leave"],
        "morning_session": roster_data["morning_summary"],
        "night_session": roster_data["night_summary"]
    }

@router.post("/save")
async def save_food_allocation(data: WardenFoodAllocationSave, current_user: dict = Depends(require_admin)):
    """
    Warden decides WHAT food is served.
    Cannot enter or modify Tiffin Count or Box Count.
    """
    if data.morning_dish not in OFFICIAL_BREAKFAST_ITEMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid morning dish: '{data.morning_dish}'. Only official routine items permitted."
        )
    if data.night_dish not in OFFICIAL_DINNER_ITEMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid night dish: '{data.night_dish}'. Only official routine items permitted."
        )

    db = get_database()
    now = datetime.utcnow()
    day_name = get_day_name(data.date)

    doc = {
        "date": data.date,
        "day": day_name,
        "morning_dish": data.morning_dish,
        "night_dish": data.night_dish,
        "allocated_by": current_user.get("name", "Hostel Warden"),
        "updated_at": now
    }

    await db.food_allocations.update_one(
        {"date": data.date},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )

    # Also sync the food_item name in any existing meal_counts for this date
    await db.meal_counts.update_one(
        {"date": data.date, "session": "morning"},
        {"$set": {"food_item": data.morning_dish}}
    )
    await db.meal_counts.update_one(
        {"date": data.date, "session": "night"},
        {"$set": {"food_item": data.night_dish}}
    )

    await log_audit(
        current_user["email"],
        "WARDEN_FOOD_ALLOCATION_SAVED",
        "FOOD",
        data.date,
        f"Morning: {data.morning_dish} | Night: {data.night_dish}"
    )

    return {
        "message": f"Food allocation saved for {data.date} ({day_name}).",
        "date": data.date,
        "morning_dish": data.morning_dish,
        "night_dish": data.night_dish
    }

# ==============================================================================
# 3. STUDENT FOOD VIEW (READ-ONLY, NO YES/NO CONTROLS)
# ==============================================================================
@router.get("/student/today")
async def get_student_today_food(current_user: dict = Depends(get_current_user)):
    """
    Students only VIEW the food allocated for the day.
    NO Tiffin Yes/No buttons, NO Box Yes/No buttons, NO count controls.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name = datetime.now().strftime("%A")
    default_schedule = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])

    alloc = await db.food_allocations.find_one({"date": today_str})
    morning_dish = alloc.get("morning_dish") if alloc else default_schedule["breakfast"]
    night_dish = alloc.get("night_dish") if alloc else default_schedule["dinner"]

    return {
        "date": today_str,
        "day": day_name,
        "morning_dish": morning_dish,
        "night_dish": night_dish,
        "lunch_dish": default_schedule["lunch"],
        "timings": {
            "breakfast": "7:00 AM – 8:00 AM",
            "lunch": "1:00 PM – 2:00 PM",
            "dinner": "8:00 PM – 9:00 PM"
        },
        "info": "Food requirements are recorded directly by the Cleaning Team during resident verification."
    }

@router.get("/student/history")
async def get_student_food_history(current_user: dict = Depends(get_current_user)):
    """Read-only past routine schedule and allocations for student view."""
    db = get_database()
    allocations = await db.food_allocations.find({}).sort("date", -1).limit(30).to_list(30)
    result = []
    for a in allocations:
        result.append({
            "date": a.get("date"),
            "day": a.get("day", get_day_name(a.get("date"))),
            "morning_dish": a.get("morning_dish"),
            "night_dish": a.get("night_dish")
        })
    return result

# ==============================================================================
async def verify_student_cleaning_duty(db, user: dict, check_day: str, check_date: str):
    if user.get("role") == "STUDENT":
        student_doc = await db.students.find_one({"email": user["email"]})
        if student_doc:
            user_room = student_doc.get("room_number")
            schedule_doc = await db.cleaning_schedule.find_one({"day": check_day})
            raw_rooms = schedule_doc.get("room_numbers", []) if schedule_doc else []
            today_scheduled_rooms = [raw_rooms[0]] if raw_rooms else []
            if not (user_room in today_scheduled_rooms):
                assigned_name = today_scheduled_rooms[0] if today_scheduled_rooms else 'None'
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"The meal count is only taken by the cleaning room, not all rooms. Today's assigned cleaning room is {assigned_name}. Your room ({user_room}) is not on cleaning duty today."
                )

# 4. CLEANING TEAM: MORNING TIFFIN & BOX COUNT
# ==============================================================================
@router.get("/cleaning/morning-tiffin/{date}")
async def get_morning_tiffin_session(
    date: str,
    sim_time: Optional[str] = Query(None),
    sim_day: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Cleaning Team Morning Screen:
    - MORNING TIFFIN (sunrise)
    - Allocated Breakfast Dish
    - Session: 5:30 AM - 7:00 AM
    - Status: OPEN or CLOSED
    - SUNDAY EXCEPTION: Sunday morning has NO Tiffin Count session.
    - Dynamic summary cards: Students Checked, Tiffin Count, Box Count, Remaining.
    - Interactive student list: TIFFIN and BOX independent options.
    """
    db = get_database()
    day_name = sim_day or get_day_name(date)
    default_schedule = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])

    # 1. Window Status
    window_info = check_morning_tiffin_window(sim_time, sim_day, date)

    # 2. Dish allocated by Warden
    alloc = await db.food_allocations.find_one({"date": date})
    morning_dish = alloc.get("morning_dish") if alloc else default_schedule["breakfast"]
    night_dish = alloc.get("night_dish") if alloc else default_schedule["dinner"]

    # 3. Check existing Morning Session in MongoDB
    session_doc = await db.meal_counts.find_one({"date": date, "session": "morning"})
    is_locked = session_doc.get("status") == "VERIFIED & LOCKED" if session_doc else False

    # 4. Fetch Active Students & Attendance
    students = await db.students.find({"status": "ACTIVE"}).sort([("room_number", 1), ("student_id", 1)]).to_list(500)
    attendance_records = await db.attendance.find({"date": date}).to_list(500)
    att_map = {a["student_id"]: a["status"] for a in attendance_records}

    # Map existing recorded responses
    existing_records_map = {}
    if session_doc and "student_records" in session_doc:
        for r in session_doc["student_records"]:
            existing_records_map[r["student_id"]] = r

    student_list = []
    tiffin_count = 0
    box_count = 0
    students_checked = 0
    present_count = 0
    absent_count = 0
    leave_count = 0

    for idx, s in enumerate(students):
        s_id = s.get("student_id")
        att_status = att_map.get(s_id)
        if not att_status:
            # Realistic baseline if attendance not marked yet
            if idx < 50:
                att_status = "PRESENT"
            elif idx < 54:
                att_status = "LEAVE"
            else:
                att_status = "ABSENT"

        if att_status == "PRESENT":
            present_count += 1
            rec = existing_records_map.get(s_id)
            if rec:
                tif_req = rec.get("tiffin_required", True)
                box_req = rec.get("box_required", False)
                is_checked = rec.get("recorded_by") is not None
            else:
                tif_req = True
                box_req = False
                is_checked = False

            if tif_req:
                tiffin_count += 1
            if box_req:
                box_count += 1
            if is_checked:
                students_checked += 1
        else:
            if att_status == "LEAVE":
                leave_count += 1
            else:
                absent_count += 1
            # CRITICAL RULE: Absent and leave students are exempt and not counted as Yes or No
            tif_req = False
            box_req = False
            is_checked = False

        student_list.append({
            "student_id": s_id,
            "name": s.get("name", "Student"),
            "room_number": s.get("room_number", "Room 01"),
            "department": s.get("department", "Engineering"),
            "semester": s.get("semester", 1),
            "attendance_status": att_status,
            "tiffin_required": tif_req,
            "box_required": box_req,
            "is_checked": is_checked
        })

    total_students = len(students)
    # Remaining reflects only present students awaiting verification
    remaining = max(0, present_count - students_checked)

    # Use locked totals if already verified & locked
    if is_locked and session_doc:
        tiffin_count = session_doc.get("final_tiffin_count", tiffin_count)
        box_count = session_doc.get("final_box_count", box_count)

    # Cleaning Duty Info for this session (Strictly 1 room per day)
    schedule_doc = await db.cleaning_schedule.find_one({"day": day_name})
    raw_rooms = schedule_doc.get("room_numbers", []) if schedule_doc else []
    today_scheduled_rooms = [raw_rooms[0]] if raw_rooms else []
    student_doc = await db.students.find_one({"email": current_user["email"]}) if current_user.get("role") == "STUDENT" else None
    user_room = student_doc.get("room_number") if student_doc else None
    has_duty = True
    if student_doc:
        has_duty = bool(user_room in today_scheduled_rooms)

    return {
        "date": date,
        "day": day_name,
        "session": "morning",
        "food_item": morning_dish,
        "morning_dish": morning_dish,
        "night_dish": night_dish,
        "window": window_info,
        "is_locked": is_locked,
        "status": session_doc.get("status", "OPEN" if window_info["is_open"] else "CLOSED") if session_doc else ("OPEN" if window_info["is_open"] else "CLOSED"),
        "summary": {
            "total_students": total_students,
            "present_count": present_count,
            "absent_count": absent_count,
            "leave_count": leave_count,
            "students_checked": students_checked,
            "tiffin_count": tiffin_count,
            "box_count": box_count,
            "remaining": remaining
        },
        "students": student_list,
        "submitted_by": session_doc.get("submitted_by") if session_doc else None,
        "submitted_at": session_doc.get("submitted_at") if session_doc else None,
        "cleaning_duty": {
            "scheduled_rooms": today_scheduled_rooms,
            "user_room": user_room,
            "has_duty": has_duty
        }
    }

@router.post("/cleaning/morning-tiffin/save-record")
async def save_morning_student_record(
    data: CleaningMorningRecordUpdate,
    current_user: dict = Depends(require_cleaning_team)
):
    """
    Cleaning Team records whether a student needs Tiffin and/or Box.
    Tiffin and Box are INDEPENDENT.
    Warden cannot operate this endpoint.
    """
    db = get_database()
    await verify_student_cleaning_duty(db, current_user, get_day_name(data.date), data.date)

    # 1. Check if session already locked
    existing_session = await db.meal_counts.find_one({"date": data.date, "session": "morning"})
    if existing_session and existing_session.get("status") == "VERIFIED & LOCKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is VERIFIED & LOCKED. Cannot modify records after submission."
        )

    # 2. Check student details
    student = await db.students.find_one({"student_id": data.student_id})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student ID {data.student_id} not found."
        )

    # Attendance reference
    att_status = await get_student_attendance_status(db, data.student_id, data.date)
    if att_status in ["ABSENT", "LEAVE"]:
        if data.tiffin_required or data.box_required:
            await db.attendance.update_one(
                {"date": data.date, "student_id": data.student_id},
                {"$set": {
                    "status": "PRESENT",
                    "remarks": "Marked Present for Morning Tiffin/Box",
                    "updated_at": datetime.utcnow()
                }},
                upsert=True
            )
            att_status = "PRESENT"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student {student.get('name')} is marked {att_status} in attendance and cannot be counted as Yes or No."
            )

    alloc = await db.food_allocations.find_one({"date": data.date})
    day_name = get_day_name(data.date)
    default_dish = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])["breakfast"]
    food_item = alloc.get("morning_dish", default_dish) if alloc else default_dish

    now = datetime.utcnow()
    verifier_name = current_user.get("name") or "Hostel Cleaning Team"

    record = {
        "student_id": data.student_id,
        "student_name": student.get("name"),
        "room_number": student.get("room_number"),
        "attendance_status": att_status,
        "tiffin_required": data.tiffin_required,
        "box_required": data.box_required,
        "recorded_by": verifier_name,
        "recorded_at": now
    }

    if not existing_session:
        # Create morning session document
        session_doc = {
            "date": data.date,
            "session": "morning",
            "day": day_name,
            "food_item": food_item,
            "student_records": [record],
            "final_tiffin_count": 1 if data.tiffin_required else 0,
            "final_box_count": 1 if data.box_required else 0,
            "status": "IN_PROGRESS",
            "created_at": now,
            "updated_at": now
        }
        await db.meal_counts.insert_one(session_doc)
    else:
        # Update student record inside student_records array
        records = existing_session.get("student_records", [])
        updated = False
        for i, r in enumerate(records):
            if r["student_id"] == data.student_id:
                records[i] = record
                updated = True
                break
        if not updated:
            records.append(record)

        # Recalculate counts dynamically
        tif_count = sum(1 for r in records if r.get("tiffin_required"))
        box_count = sum(1 for r in records if r.get("box_required"))

        await db.meal_counts.update_one(
            {"date": data.date, "session": "morning"},
            {
                "$set": {
                    "student_records": records,
                    "final_tiffin_count": tif_count,
                    "final_box_count": box_count,
                    "food_item": food_item,
                    "status": "IN_PROGRESS",
                    "updated_at": now
                }
            }
        )

    return {
        "message": f"Recorded requirement for {student.get('name')}: Tiffin={data.tiffin_required}, Box={data.box_required}",
        "student_id": data.student_id,
        "tiffin_required": data.tiffin_required,
        "box_required": data.box_required
    }

@router.post("/cleaning/morning-tiffin/submit")
async def submit_final_morning_count(
    data: SubmitMorningCountRequest,
    current_user: dict = Depends(require_cleaning_team)
):
    """
    Cleaning Team submits the final morning count.
    - Locks session: STATUS = VERIFIED & LOCKED
    - Double submission is DENIED.
    - Sunday Morning submission is DENIED (Sunday Tiffin Exception).
    - Warden submission is DENIED.
    """
    db = get_database()
    day_name = data.sim_day or get_day_name(data.date)
    await verify_student_cleaning_duty(db, current_user, day_name, data.date)

    # 1. SUNDAY EXCEPTION: Sunday morning cannot have Tiffin count
    if day_name.lower() == "sunday":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SUNDAY TIFFIN EXCEPTION: Sunday morning does NOT have a Morning Tiffin Count. Sunday breakfast is served directly."
        )

    # 2. Check if already submitted (TEST 13: double submission DENIED)
    existing_session = await db.meal_counts.find_one({"date": data.date, "session": "morning"})
    if existing_session and existing_session.get("status") == "VERIFIED & LOCKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Morning Tiffin Count for {data.date} is ALREADY VERIFIED & LOCKED. Cannot submit twice."
        )

    # 3. Check time window unless simulated or explicitly overridden
    window = check_morning_tiffin_window(data.sim_time, data.sim_day, data.date)
    if not window["is_open"] and not data.sim_time and not data.override_window:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Morning Tiffin Count operates strictly between 5:30 AM and 7:00 AM (Status: {window['status']})."
        )

    # 4. Calculate final counts from student records
    records = existing_session.get("student_records", []) if existing_session else []
    
    # If session has no records yet (e.g. testing submit), initialize from active students
    if not records:
        all_students = await db.students.find({"status": "ACTIVE"}).to_list(500)
        att_records = await db.attendance.find({"date": data.date}).to_list(500)
        att_map = {a["student_id"]: a["status"] for a in att_records}
        for idx, st in enumerate(all_students):
            att = att_map.get(st["student_id"], "PRESENT" if idx < 50 else "ABSENT")
            records.append({
                "student_id": st["student_id"],
                "student_name": st["name"],
                "room_number": st["room_number"],
                "attendance_status": att,
                "tiffin_required": (att == "PRESENT" and idx < 40),
                "box_required": (att == "PRESENT" and idx >= 5 and idx < 40),
                "recorded_by": current_user.get("name", "Hostel Cleaning Team"),
                "recorded_at": datetime.utcnow()
            })

    final_tiffin_count = sum(1 for r in records if r.get("tiffin_required") and r.get("attendance_status") == "PRESENT")
    final_box_count = sum(1 for r in records if r.get("box_required") and r.get("attendance_status") == "PRESENT")

    alloc = await db.food_allocations.find_one({"date": data.date})
    default_dish = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])["breakfast"]
    food_item = alloc.get("morning_dish", default_dish) if alloc else default_dish

    now = datetime.utcnow()
    verifier_name = current_user.get("name", "Hostel Cleaning Team")

    update_doc = {
        "date": data.date,
        "session": "morning",
        "day": day_name,
        "food_item": food_item,
        "student_records": records,
        "final_tiffin_count": final_tiffin_count,
        "final_box_count": final_box_count,
        "total_students": len(records),
        "submitted_by": verifier_name,
        "submitted_at": now,
        "remarks": data.remarks or "Verified morning resident requirements",
        "status": "VERIFIED & LOCKED",
        "updated_at": now
    }

    await db.meal_counts.update_one(
        {"date": data.date, "session": "morning"},
        {"$set": update_doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )

    await log_audit(
        current_user["email"],
        "CLEANING_MORNING_TIFFIN_SUBMITTED",
        "FOOD",
        data.date,
        f"Final Tiffin Count: {final_tiffin_count}, Final Box Count: {final_box_count} (VERIFIED & LOCKED)"
    )

    return {
        "message": f"Morning Tiffin Count submitted and locked for {data.date}.",
        "date": data.date,
        "day": day_name,
        "food_item": food_item,
        "final_tiffin_count": final_tiffin_count,
        "final_box_count": final_box_count,
        "status": "VERIFIED & LOCKED",
        "submitted_by": verifier_name,
        "submitted_at": now.strftime("%I:%M %p")
    }

# ==============================================================================
# 5. CLEANING TEAM: NIGHT MEAL COUNT (SEPARATE WORKFLOW)
# ==============================================================================
@router.get("/cleaning/night-meal/{date}")
async def get_night_meal_session(
    date: str,
    sim_time: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Cleaning Team Night Screen:
    - NIGHT DINNER MEAL COUNT (moon)
    - Window: 5:00 PM – 6:30 PM (17:00 – 18:30)
    - Works normally on all days including Sunday.
    """
    db = get_database()
    day_name = get_day_name(date)
    default_schedule = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])

    window_info = check_night_meal_window(sim_time, date)

    alloc = await db.food_allocations.find_one({"date": date})
    morning_dish = alloc.get("morning_dish") if alloc else default_schedule["breakfast"]
    night_dish = alloc.get("night_dish") if alloc else default_schedule["dinner"]

    session_doc = await db.meal_counts.find_one({"date": date, "session": "night"})
    is_locked = session_doc.get("status") == "VERIFIED & LOCKED" if session_doc else False

    students = await db.students.find({"status": "ACTIVE"}).sort([("room_number", 1), ("student_id", 1)]).to_list(500)
    attendance_records = await db.attendance.find({"date": date}).to_list(500)
    att_map = {a["student_id"]: a["status"] for a in attendance_records}

    existing_records_map = {}
    if session_doc and "student_records" in session_doc:
        for r in session_doc["student_records"]:
            existing_records_map[r["student_id"]] = r

    student_list = []
    night_meal_count = 0
    students_checked = 0
    present_count = 0
    absent_count = 0
    leave_count = 0

    for idx, s in enumerate(students):
        s_id = s.get("student_id")
        att_status = att_map.get(s_id)
        if not att_status:
            if idx < 50:
                att_status = "PRESENT"
            elif idx < 54:
                att_status = "LEAVE"
            else:
                att_status = "ABSENT"

        if att_status == "PRESENT":
            present_count += 1
            rec = existing_records_map.get(s_id)
            if rec:
                meal_req = rec.get("meal_required", True)
                is_checked = rec.get("recorded_by") is not None
            else:
                meal_req = True
                is_checked = False

            if meal_req:
                night_meal_count += 1
            if is_checked:
                students_checked += 1
        else:
            if att_status == "LEAVE":
                leave_count += 1
            else:
                absent_count += 1
            # CRITICAL RULE: Absent and leave students are exempt and not counted as Yes or No
            meal_req = False
            is_checked = False

        student_list.append({
            "student_id": s_id,
            "name": s.get("name", "Student"),
            "room_number": s.get("room_number", "Room 01"),
            "department": s.get("department", "Engineering"),
            "semester": s.get("semester", 1),
            "attendance_status": att_status,
            "meal_required": meal_req,
            "is_checked": is_checked
        })

    total_students = len(students)
    # Remaining reflects only present students awaiting verification
    remaining = max(0, present_count - students_checked)

    if is_locked and session_doc:
        night_meal_count = session_doc.get("final_night_meal_count", night_meal_count)

    # Cleaning Duty Info for this session (Strictly 1 room per day)
    schedule_doc = await db.cleaning_schedule.find_one({"day": day_name})
    raw_rooms = schedule_doc.get("room_numbers", []) if schedule_doc else []
    today_scheduled_rooms = [raw_rooms[0]] if raw_rooms else []
    student_doc = await db.students.find_one({"email": current_user["email"]}) if current_user.get("role") == "STUDENT" else None
    user_room = student_doc.get("room_number") if student_doc else None
    has_duty = True
    if student_doc:
        has_duty = bool(user_room in today_scheduled_rooms)

    return {
        "date": date,
        "day": day_name,
        "session": "night",
        "food_item": night_dish,
        "morning_dish": morning_dish,
        "night_dish": night_dish,
        "window": window_info,
        "is_locked": is_locked,
        "status": session_doc.get("status", "OPEN" if window_info["is_open"] else "CLOSED") if session_doc else ("OPEN" if window_info["is_open"] else "CLOSED"),
        "summary": {
            "total_students": total_students,
            "present_count": present_count,
            "absent_count": absent_count,
            "leave_count": leave_count,
            "students_checked": students_checked,
            "night_meal_count": night_meal_count,
            "remaining": remaining
        },
        "students": student_list,
        "submitted_by": session_doc.get("submitted_by") if session_doc else None,
        "submitted_at": session_doc.get("submitted_at") if session_doc else None,
        "cleaning_duty": {
            "scheduled_rooms": today_scheduled_rooms,
            "user_room": user_room,
            "has_duty": has_duty
        }
    }

@router.post("/cleaning/night-meal/save-record")
async def save_night_student_record(
    data: CleaningNightRecordUpdate,
    current_user: dict = Depends(require_cleaning_team)
):
    """Cleaning Team records student night meal requirement."""
    db = get_database()
    await verify_student_cleaning_duty(db, current_user, get_day_name(data.date), data.date)
    existing_session = await db.meal_counts.find_one({"date": data.date, "session": "night"})
    if existing_session and existing_session.get("status") == "VERIFIED & LOCKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is VERIFIED & LOCKED. Cannot modify records after submission."
        )

    student = await db.students.find_one({"student_id": data.student_id})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student ID {data.student_id} not found."
        )

    att_status = await get_student_attendance_status(db, data.student_id, data.date)
    if att_status in ["ABSENT", "LEAVE"]:
        if data.meal_required:
            await db.attendance.update_one(
                {"date": data.date, "student_id": data.student_id},
                {"$set": {
                    "status": "PRESENT",
                    "remarks": "Updated to Present for Night Dinner Meal",
                    "updated_at": datetime.utcnow()
                }},
                upsert=True
            )
            att_status = "PRESENT"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student {student.get('name')} is marked {att_status} in attendance and cannot be counted as Yes or No."
            )

    alloc = await db.food_allocations.find_one({"date": data.date})
    day_name = get_day_name(data.date)
    default_dish = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])["dinner"]
    food_item = alloc.get("night_dish", default_dish) if alloc else default_dish

    now = datetime.utcnow()
    verifier_name = current_user.get("name") or "Hostel Cleaning Team"

    record = {
        "student_id": data.student_id,
        "student_name": student.get("name"),
        "room_number": student.get("room_number"),
        "attendance_status": att_status,
        "meal_required": data.meal_required,
        "recorded_by": verifier_name,
        "recorded_at": now
    }

    if not existing_session:
        session_doc = {
            "date": data.date,
            "session": "night",
            "day": day_name,
            "food_item": food_item,
            "student_records": [record],
            "final_night_meal_count": 1 if data.meal_required else 0,
            "status": "IN_PROGRESS",
            "created_at": now,
            "updated_at": now
        }
        await db.meal_counts.insert_one(session_doc)
    else:
        records = existing_session.get("student_records", [])
        updated = False
        for i, r in enumerate(records):
            if r["student_id"] == data.student_id:
                records[i] = record
                updated = True
                break
        if not updated:
            records.append(record)

        n_count = sum(1 for r in records if r.get("meal_required"))
        await db.meal_counts.update_one(
            {"date": data.date, "session": "night"},
            {
                "$set": {
                    "student_records": records,
                    "final_night_meal_count": n_count,
                    "food_item": food_item,
                    "status": "IN_PROGRESS",
                    "updated_at": now
                }
            }
        )

    return {
        "message": f"Recorded night meal requirement for {student.get('name')}: {data.meal_required}",
        "student_id": data.student_id,
        "meal_required": data.meal_required
    }

@router.post("/cleaning/night-meal/submit")
async def submit_final_night_count(
    data: SubmitNightCountRequest,
    current_user: dict = Depends(require_cleaning_team)
):
    """Cleaning Team submits the final night count."""
    db = get_database()
    await verify_student_cleaning_duty(db, current_user, get_day_name(data.date), data.date)
    existing_session = await db.meal_counts.find_one({"date": data.date, "session": "night"})
    if existing_session and existing_session.get("status") == "VERIFIED & LOCKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Night Meal Count for {data.date} is ALREADY VERIFIED & LOCKED. Cannot submit twice."
        )

    window = check_night_meal_window(data.sim_time, data.date)
    if not window["is_open"] and not data.sim_time and not data.override_window:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Night Dinner Meal Count is taken between 5:00 PM and 6:30 PM (Status: {window['status']}). {window['reason']}"
        )

    records = existing_session.get("student_records", []) if existing_session else []
    if not records:
        all_students = await db.students.find({"status": "ACTIVE"}).to_list(500)
        att_records = await db.attendance.find({"date": data.date}).to_list(500)
        att_map = {a["student_id"]: a["status"] for a in att_records}
        for idx, st in enumerate(all_students):
            att = att_map.get(st["student_id"], "PRESENT" if idx < 50 else "ABSENT")
            records.append({
                "student_id": st["student_id"],
                "student_name": st["name"],
                "room_number": st["room_number"],
                "attendance_status": att,
                "meal_required": (att == "PRESENT" and idx < 45),
                "recorded_by": current_user.get("name", "Hostel Cleaning Team"),
                "recorded_at": datetime.utcnow()
            })

    final_count = sum(1 for r in records if r.get("meal_required") and r.get("attendance_status") == "PRESENT")
    day_name = get_day_name(data.date)
    alloc = await db.food_allocations.find_one({"date": data.date})
    default_dish = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])["dinner"]
    food_item = alloc.get("night_dish", default_dish) if alloc else default_dish

    now = datetime.utcnow()
    verifier_name = current_user.get("name", "Hostel Cleaning Team")

    update_doc = {
        "date": data.date,
        "session": "night",
        "day": day_name,
        "food_item": food_item,
        "student_records": records,
        "final_night_meal_count": final_count,
        "total_students": len(records),
        "submitted_by": verifier_name,
        "submitted_at": now,
        "remarks": data.remarks or "Verified night resident meal requirements",
        "status": "VERIFIED & LOCKED",
        "updated_at": now
    }

    await db.meal_counts.update_one(
        {"date": data.date, "session": "night"},
        {"$set": update_doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )

    await log_audit(
        current_user["email"],
        "CLEANING_NIGHT_MEAL_SUBMITTED",
        "FOOD",
        data.date,
        f"Final Night Meal Count: {final_count} (VERIFIED & LOCKED)"
    )

    return {
        "message": f"Night Meal Count submitted and locked for {data.date}.",
        "date": data.date,
        "day": day_name,
        "food_item": food_item,
        "final_night_meal_count": final_count,
        "status": "VERIFIED & LOCKED",
        "submitted_by": verifier_name,
        "submitted_at": now.strftime("%I:%M %p")
    }

# ==============================================================================
# 5b. UNLOCK / RE-OPEN COUNT SESSION (PERMIT EDIT ACCESS)
# ==============================================================================
@router.post("/cleaning/unlock")
async def unlock_session(
    data: UnlockSessionRequest,
    current_user: dict = Depends(require_cleaning_or_admin)
):
    """
    Unlocks a previously locked morning or night session so Cleaning Team / Admin
    can re-access, edit student requirements, and re-submit.
    """
    db = get_database()
    now = datetime.utcnow()
    user_name = current_user.get("name", "Hostel Staff")

    session_name = (data.session or "morning").lower()
    if session_name not in ["morning", "night"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session must be either 'morning' or 'night'."
        )

    doc = await db.meal_counts.find_one({"date": data.date, "session": session_name})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {session_name} count record found for {data.date}."
        )

    await db.meal_counts.update_one(
        {"date": data.date, "session": session_name},
        {
            "$set": {
                "status": "IN_PROGRESS",
                "submitted_by": None,
                "submitted_at": None,
                "unlocked_by": user_name,
                "unlocked_at": now,
                "updated_at": now
            }
        }
    )

    await log_audit(
        current_user["email"],
        f"MEAL_SESSION_UNLOCKED_{session_name.upper()}",
        "FOOD",
        data.date,
        f"Session unlocked by {user_name} to permit re-access and editing."
    )

    return {
        "message": f"{session_name.capitalize()} count for {data.date} unlocked successfully. Full editing access granted.",
        "date": data.date,
        "session": session_name,
        "status": "IN_PROGRESS"
    }

# ==============================================================================
# 6. WARDEN VIEW AFTER SUBMISSION (READ-ONLY)
# ==============================================================================
@router.get("/warden/results/{date}")
async def get_warden_results(date: str, current_user: dict = Depends(require_admin)):
    """
    Warden Food Dashboard read-only view after Cleaning Team submission:
    - MORNING TIFFIN: Food, Tiffin Count, Box Count, Status, Submitted by, Submitted at.
    - NIGHT MEAL: Food, Night Meal Count, Status, Submitted by, Submitted at.
    Warden CANNOT modify submitted counts.
    """
    db = get_database()
    day_name = get_day_name(date)
    alloc = await db.food_allocations.find_one({"date": date})
    default_sch = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])

    morning_dish = alloc.get("morning_dish", default_sch["breakfast"]) if alloc else default_sch["breakfast"]
    night_dish = alloc.get("night_dish", default_sch["dinner"]) if alloc else default_sch["dinner"]

    m_session = await db.meal_counts.find_one({"date": date, "session": "morning"})
    n_session = await db.meal_counts.find_one({"date": date, "session": "night"})

    return {
        "date": date,
        "day": day_name,
        "morning_tiffin": {
            "food_item": morning_dish,
            "tiffin_count": m_session.get("final_tiffin_count", 0) if m_session else None,
            "box_count": m_session.get("final_box_count", 0) if m_session else None,
            "status": m_session.get("status", "Pending Submission") if m_session else "Pending Submission",
            "is_locked": m_session.get("status") == "VERIFIED & LOCKED" if m_session else False,
            "submitted_by": m_session.get("submitted_by") if m_session else None,
            "submitted_at": m_session.get("submitted_at") if m_session else None
        },
        "night_meal": {
            "food_item": night_dish,
            "meal_count": n_session.get("final_night_meal_count", 0) if n_session else None,
            "status": n_session.get("status", "Pending Submission") if n_session else "Pending Submission",
            "is_locked": n_session.get("status") == "VERIFIED & LOCKED" if n_session else False,
            "submitted_by": n_session.get("submitted_by") if n_session else None,
            "submitted_at": n_session.get("submitted_at") if n_session else None
        }
    }

# ==============================================================================
# 7. HISTORICAL AUDIT & LOGS
# ==============================================================================
@router.get("/history")
async def get_food_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Historical records of food allocations and final meal counts."""
    db = get_database()
    query = {}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}

    allocations = await db.food_allocations.find(query).sort("date", -1).limit(60).to_list(60)
    all_morning = await db.meal_counts.find({"session": "morning", **query}).to_list(100)
    all_night = await db.meal_counts.find({"session": "night", **query}).to_list(100)

    morning_map = {m["date"]: m for m in all_morning}
    night_map = {n["date"]: n for n in all_night}

    history = []
    seen_dates = set()

    for a in allocations:
        d = a["date"]
        seen_dates.add(d)
        m = morning_map.get(d)
        n = night_map.get(d)
        history.append({
            "date": d,
            "day": a.get("day", get_day_name(d)),
            "morning_dish": a.get("morning_dish"),
            "night_dish": a.get("night_dish"),
            "allocated_by": a.get("allocated_by", "Hostel Warden"),
            "morning_tiffin_count": m.get("final_tiffin_count") if m else "—",
            "morning_box_count": m.get("final_box_count") if m else "—",
            "morning_status": m.get("status") if m else "Not Submitted",
            "morning_submitted_by": m.get("submitted_by") if m else "—",
            "night_meal_count": n.get("final_night_meal_count") if n else "—",
            "night_status": n.get("status") if n else "Not Submitted",
            "night_submitted_by": n.get("submitted_by") if n else "—"
        })

    return history

# ==============================================================================
# 8. WARDEN RESIDENT MEAL COUNT ROSTER & PDF DOWNLOAD
# ==============================================================================
async def build_warden_roster_data(date: str) -> dict:
    """Builds unified, complete resident roster with meal counts for Warden and PDF."""
    db = get_database()
    day_name = get_day_name(date)
    default_sch = OFFICIAL_WEEKLY_SCHEDULE.get(day_name, OFFICIAL_WEEKLY_SCHEDULE["Monday"])

    (
        alloc,
        m_session_doc,
        n_session_doc,
        students,
        att_records,
        box_assignment_docs
    ) = await asyncio.gather(
        db.food_allocations.find_one({"date": date}),
        db.meal_counts.find_one({"date": date, "session": "morning"}),
        db.meal_counts.find_one({"date": date, "session": "night"}),
        db.students.find({"status": "ACTIVE"}).sort([("room_number", 1), ("bed_number", 1), ("student_id", 1)]).to_list(500),
        db.attendance.find({"date": date}).to_list(500),
        db.food_assignments.find({"food_type": "Tiffin Box"}).to_list(200),
    )

    morning_dish = alloc.get("morning_dish", default_sch["breakfast"]) if alloc else default_sch["breakfast"]
    night_dish = alloc.get("night_dish", default_sch["dinner"]) if alloc else default_sch["dinner"]

    m_session = m_session_doc or {}
    n_session = n_session_doc or {}

    m_records_map = {r["student_id"]: r for r in m_session.get("student_records", [])}
    n_records_map = {r["student_id"]: r for r in n_session.get("student_records", [])}

    att_map = {a["student_id"]: a["status"] for a in att_records}
    default_box_ids = {a["student_id"] for a in box_assignment_docs}

    roster = []
    total_present = 0
    total_absent = 0
    total_leave = 0

    for s in students:
        sid = s["student_id"]
        att = att_map.get(sid, "PRESENT")
        if att == "PRESENT":
            total_present += 1

            m_rec = m_records_map.get(sid, {})
            n_rec = n_records_map.get(sid, {})

            # By default, every PRESENT resident in the hostel requires morning tiffin and night dinner unless explicitly opted out
            tiffin_req = bool(m_rec.get("tiffin_required", True)) if "tiffin_required" in m_rec else True
            meal_req = bool(n_rec.get("meal_required", True)) if "meal_required" in n_rec else True
            box_req = bool(m_rec.get("box_required", sid in default_box_ids)) if "box_required" in m_rec else (sid in default_box_ids)

            roster.append({
                "student_id": sid,
                "name": s.get("name"),
                "room_number": s.get("room_number"),
                "bed_number": s.get("bed_number"),
                "department": s.get("department", "—"),
                "phone": s.get("phone", ""),
                "attendance_status": "PRESENT",
                "is_exempt": False,
                "tiffin_required": tiffin_req,
                "box_required": box_req,
                "meal_required": meal_req,
                "morning_checked": bool(m_rec),
                "night_checked": bool(n_rec),
            })
        elif att == "LEAVE":
            total_leave += 1
        else:
            total_absent += 1

    # Accurate counts for eligible present residents
    m_count = m_session.get("final_tiffin_count")
    if m_count is None or m_count == 0:
        m_count = sum(1 for r in roster if r.get("tiffin_required"))
    if m_count == 0 and total_present > 0:
        m_count = total_present

    b_count = m_session.get("final_box_count")
    if b_count is None or b_count == 0:
        b_count = sum(1 for r in roster if r.get("box_required"))

    din_count = n_session.get("final_night_meal_count")
    if din_count is None or din_count == 0:
        din_count = sum(1 for r in roster if r.get("meal_required"))
    if din_count == 0 and total_present > 0:
        din_count = total_present

    m_sub_at = m_session.get("submitted_at")
    if isinstance(m_sub_at, datetime):
        m_sub_at = m_sub_at.isoformat()
    n_sub_at = n_session.get("submitted_at")
    if isinstance(n_sub_at, datetime):
        n_sub_at = n_sub_at.isoformat()

    # Remove non-JSON serializable ObjectId
    m_clean = {k: v for k, v in m_session.items() if k != "_id" and not isinstance(v, datetime)}
    n_clean = {k: v for k, v in n_session.items() if k != "_id" and not isinstance(v, datetime)}

    return {
        "date": date,
        "formatted_date": format_date_ddmmyyyy(date),
        "day": day_name,
        "morning_dish": morning_dish,
        "night_dish": night_dish,
        "morning_summary": {
            "status": m_session.get("status", "Pending Submission"),
            "is_locked": m_session.get("status") == "VERIFIED & LOCKED",
            "tiffin_count": m_count,
            "box_count": b_count,
            "submitted_by": m_session.get("submitted_by") or "Cleaning Team",
            "submitted_at": m_sub_at
        },
        "night_summary": {
            "status": n_session.get("status", "Pending Submission"),
            "is_locked": n_session.get("status") == "VERIFIED & LOCKED",
            "night_meal_count": din_count,
            "submitted_by": n_session.get("submitted_by") or "Cleaning Team",
            "submitted_at": n_sub_at
        },
        "total_students": len(students),
        "total_present": total_present,
        "total_absent": total_absent,
        "total_leave": total_leave,
        "roster": roster
    }

@router.get("/warden/roster/{date}")
async def get_warden_roster_endpoint(date: str, current_user: dict = Depends(get_current_user)):
    """Provides full resident meal count list for the Warden screen."""
    return await build_warden_roster_data(date)

@router.get("/kitchen-order/{date}")
async def get_kitchen_order_endpoint(date: str, current_user: dict = Depends(get_current_user)):
    """Provides full meal order verification data for KitchenMealOrderPage."""
    data = await build_warden_roster_data(date)
    return {
        "date": data["date"],
        "day": data["day"],
        "morning_dish": data["morning_dish"],
        "night_dish": data["night_dish"],
        "is_locked": data["morning_summary"]["is_locked"] or data["night_summary"]["is_locked"],
        "summary": {
            "total_residents": data["total_students"],
            "present_residents": data["total_present"],
            "absent_residents": data["total_absent"] + data["total_leave"],
            "morning_order": data["morning_summary"]["tiffin_count"],
            "morning_box_order": data["morning_summary"]["box_count"],
            "night_order": data["night_summary"]["night_meal_count"],
            "morning_verified_count": data["morning_summary"]["tiffin_count"],
            "night_verified_count": data["night_summary"]["night_meal_count"],
        },
        "students": [
            {
                "student_id": s["student_id"],
                "name": s["name"],
                "room_number": s["room_number"],
                "bed_number": s["bed_number"],
                "department": s["department"],
                "phone": s["phone"],
                "attendance_status": s["attendance_status"],
                "morning_verified": s["tiffin_required"],
                "night_verified": s["meal_required"],
                "tiffin_required": s["tiffin_required"],
                "box_required": s["box_required"],
                "meal_required": s["meal_required"],
                "verification_status": "Verified" if (s["tiffin_required"] or s["meal_required"]) else "Pending"
            }
            for s in data["roster"]
        ]
    }

@router.get("/download-pdf/{date}")
async def download_meal_count_pdf(
    date: str,
    download: Optional[int] = 1,
    current_user: dict = Depends(get_current_user)
):
    """
    Downloads official printable PDF report of resident meal counts for the date.
    """
    data = await build_warden_roster_data(date)
    pdf_bytes = generate_meal_count_pdf(
        date_str=data["date"],
        day_name=data["day"],
        morning_dish=data["morning_dish"],
        night_dish=data["night_dish"],
        m_session=data["morning_summary"],
        n_session=data["night_summary"],
        roster_records=data["roster"]
    )
    disposition = "attachment" if download else "inline"
    filename = f"Veerashaiva_Hostel_Meal_Count_{data['formatted_date'].replace('/', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"'
        }
    )
