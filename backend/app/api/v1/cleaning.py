from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, log_audit, create_notification
from app.schemas.all_schemas import (
    CleaningStatusUpdate,
    CleaningScheduleUpdate,
    CleaningTaskCreate,
    CleaningTaskStatusUpdate,
    CleaningRatingSubmit,
    CleaningIssueReport
)
from bson import ObjectId
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/cleaning", tags=["Room Cleaning"])

VALID_HOSTEL_ROOMS = [
    "Room 01", "Room 02", "Room 04", "Room 05", "Room 06", "Room 07",
    "Room 08", "Room 09", "Room 10", "Room 11", "Room 12", "Room 13"
]

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
    Returns today's designated Daily Meal Duty Room.
    Hostel rule: Strictly ONE room is selected as the Daily Meal Duty Room.
    Warden/Admin can allocate or change it independently of cleaning.
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    try:
        day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    except Exception:
        day_name = datetime.now().strftime("%A")

    # 1. Date-specific meal duty
    doc = await db.meal_duty_schedule.find_one({"date": date_str})
    if doc and doc.get("room_number") in VALID_HOSTEL_ROOMS:
        return doc["room_number"]

    # 2. Day-of-week meal duty
    day_doc = await db.meal_duty_schedule.find_one({"day": day_name, "date": {"$exists": False}})
    if day_doc and day_doc.get("room_number") in VALID_HOSTEL_ROOMS:
        return day_doc["room_number"]

    # 3. Fallback to cleaning_schedule
    cs_doc = await db.cleaning_schedule.find_one({"day": day_name})
    if cs_doc and cs_doc.get("room_numbers") and cs_doc["room_numbers"][0] in VALID_HOSTEL_ROOMS:
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

async def get_today_duty_rooms(db, day_name: str = None) -> List[str]:
    """
    Compatibility wrapper returning today's meal duty room as a list.
    """
    today_str = datetime.now().strftime("%Y-%m-%d")
    duty_room = await get_today_meal_duty_room(db, today_str)
    return [duty_room]

async def get_room_day_schedule_map(db):
    """
    Maps each room to its primary scheduled inspection day.
    """
    schedules = await db.cleaning_schedule.find({}).to_list(None)
    room_map = {}
    for s in schedules:
        d = s.get("day")
        for r_no in s.get("room_numbers", []):
            if r_no not in room_map and r_no in VALID_HOSTEL_ROOMS:
                room_map[r_no] = d
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

        if cleaning_status == "COMPLETED":
            display_status = "CLEANED & VERIFIED"
            verification_status = "CLEANED & VERIFIED"
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
            "assigned_staff": task_data.get("assigned_staff", "Housekeeping Staff") if task_data else "Housekeeping Staff",
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
            "assigned_staff": "Housekeeping Staff",
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

@router.post("/assign-duty-room")
@router.post("/assign-meal-duty-room")
async def assign_duty_room(data: AssignDutyRoomRequest, current_user: dict = Depends(require_admin)):
    """
    Admin assigns ANY room as the Daily Meal Duty Room for today (or a specific day).
    Meal Duty Room is completely separate from the sequential cleaning workflow.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    target_day = data.day_name or datetime.now().strftime("%A")
    room_number = data.room_number.strip()
    
    valid_rooms = await get_all_hostel_rooms(db)
    if room_number not in valid_rooms:
        raise HTTPException(status_code=400, detail=f"Invalid room number '{room_number}'. Valid hostel rooms (12 rooms, no Room 03): {valid_rooms}")
        
    # 1. Update meal duty schedule for today's date
    await db.meal_duty_schedule.update_one(
        {"date": today_str},
        {"$set": {
            "room_number": room_number,
            "day": target_day,
            "allocated_by": current_user.get("email"),
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    # 2. Update day-of-week schedule fallback
    await db.meal_duty_schedule.update_one(
        {"day": target_day, "date": {"$exists": False}},
        {"$set": {"room_number": room_number, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    # 3. Synchronize legacy cleaning_schedule table
    await db.cleaning_schedule.update_one(
        {"day": target_day},
        {"$set": {"room_numbers": [room_number], "updated_at": datetime.utcnow()}},
        upsert=True
    )
    
    await log_audit(current_user["email"], "DUTY_ROOM_ASSIGNED", "MEAL_DUTY", f"{room_number} allocated as Daily Meal Duty Room for {today_str} ({target_day})")
    return {
        "message": f"✅ {room_number} successfully allocated as Daily Meal Duty Room.",
        "meal_duty_room": room_number,
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
        rooms_to_set = item.room_numbers[:1] if item.room_numbers else []
        await db.cleaning_schedule.update_one(
            {"day": item.day},
            {"$set": {"room_numbers": rooms_to_set, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    await log_audit(current_user["email"], "CLEANING_SCHEDULE_UPDATED", "CLEANING", "WEEKLY_SCHEDULE")
    return {"message": "Cleaning schedule updated successfully."}


# ==========================================
# ADMIN: TASK CREATION & HISTORY MANAGEMENT
# ==========================================

@router.post("/tasks")
async def create_cleaning_task(data: CleaningTaskCreate, current_user: dict = Depends(require_admin)):
    """
    Admin endpoint to create a new cleaning task:
    - Room selection (excluding Room 03)
    - Staff assignment
    - Cleaning type (Daily Sanitation, Deep Cleaning, Restroom Cleaning, Floor Mopping, Disinfection)
    - Date and Time
    - Status (Pending, In Progress, Completed, Overdue)
    """
    db = get_database()
    room_no = data.room_number.strip()
    if room_no == "Room 03":
        raise HTTPException(status_code=400, detail="Room 03 does not exist in the hostel.")
    
    room_doc = await db.rooms.find_one({"room_number": room_no})
    if not room_doc:
        raise HTTPException(status_code=404, detail=f"{room_no} not found.")
    
    raw_status = data.status.strip().lower()
    if raw_status in ["in progress", "in_progress"]:
        status_label = "In Progress"
        db_status = "IN_PROGRESS"
    elif raw_status == "completed":
        status_label = "Completed"
        db_status = "COMPLETED"
    elif raw_status == "overdue":
        status_label = "Overdue"
        db_status = "OVERDUE"
    else:
        status_label = "Pending"
        db_status = "PENDING"
        
    doc = {
        "room_number": room_no,
        "assigned_staff": data.assigned_staff or "Housekeeping Staff",
        "cleaning_type": data.cleaning_type or "Daily Sanitation",
        "date": data.date,
        "time": data.time or "10:00 AM",
        "status": status_label,
        "notes": data.notes or "",
        "created_by": current_user.get("email"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    res = await db.cleaning_requests.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    
    await db.rooms.update_one({"room_number": room_no}, {"$set": {"cleaning_status": db_status}})
    
    if status_label == "Completed":
        now_str = datetime.now().strftime("%I:%M %p")
        await db.rooms.update_one({"room_number": room_no}, {"$set": {"last_cleaned": f"{data.date} at {data.time or now_str}"}})
        students_cursor = db.students.find({"room_number": room_no, "status": "ACTIVE"})
        async for s in students_cursor:
            u = await db.users.find_one({"email": s["email"]})
            if u:
                await create_notification(
                    str(u["_id"]),
                    "Room Cleaning Completed",
                    f"Room {room_no} {data.cleaning_type} has been marked Completed by {data.assigned_staff}."
                )
                
    await log_audit(current_user["email"], "CLEANING_TASK_CREATED", "CLEANING", room_no, f"Created {data.cleaning_type} for {room_no}")
    return doc


@router.get("/tasks")
@router.get("/history")
async def get_cleaning_tasks(
    status: Optional[str] = None,
    room_number: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Admin endpoint to view cleaning history and active tasks with full status filtering:
    - Pending, In Progress, Completed, Overdue
    """
    db = get_database()
    query = {}
    if room_number and room_number != "ALL":
        query["room_number"] = room_number
    if date:
        query["date"] = date
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    tasks_cursor = db.cleaning_requests.find(query).sort([("date", -1), ("created_at", -1)])
    tasks = []
    
    async for t in tasks_cursor:
        t["id"] = str(t["_id"])
        del t["_id"]
        
        # Determine normalized display status
        st = t.get("status", "Pending")
        t_date = t.get("date", "")
        if st in ["Pending", "In Progress", "PENDING", "IN_PROGRESS"] and t_date < today_str:
            display_status = "Overdue"
        elif st in ["COMPLETED", "Completed"]:
            display_status = "Completed"
        elif st in ["IN_PROGRESS", "In Progress"]:
            display_status = "In Progress"
        elif st in ["OVERDUE", "Overdue"]:
            display_status = "Overdue"
        else:
            display_status = "Pending"
            
        t["status"] = display_status
        
        if status and status != "ALL":
            if display_status.lower() != status.lower():
                continue
                
        tasks.append(t)
        
    return tasks


@router.put("/tasks/{id}/status")
async def update_cleaning_task_status(
    id: str,
    data: CleaningTaskStatusUpdate,
    current_user: dict = Depends(require_admin)
):
    """
    Admin endpoint to update cleaning status:
    - Pending, In Progress, Completed, Overdue
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
    raw_status = data.status.strip().lower()
    if raw_status in ["in progress", "in_progress"]:
        status_label = "In Progress"
        db_status = "IN_PROGRESS"
    elif raw_status == "completed":
        status_label = "Completed"
        db_status = "COMPLETED"
    elif raw_status == "overdue":
        status_label = "Overdue"
        db_status = "OVERDUE"
    else:
        status_label = "Pending"
        db_status = "PENDING"
        
    update_doc = {
        "status": status_label,
        "updated_at": datetime.utcnow()
    }
    if data.assigned_staff:
        update_doc["assigned_staff"] = data.assigned_staff
    if data.notes is not None:
        update_doc["notes"] = data.notes
        
    await db.cleaning_requests.update_one({"_id": obj_id}, {"$set": update_doc})
    await db.rooms.update_one({"room_number": room_no}, {"$set": {"cleaning_status": db_status}})
    
    if status_label == "Completed":
        now_str = datetime.now().strftime("%I:%M %p")
        await db.rooms.update_one({"room_number": room_no}, {"$set": {"last_cleaned": f"Today at {now_str}"}})
        students_cursor = db.students.find({"room_number": room_no, "status": "ACTIVE"})
        async for s in students_cursor:
            u = await db.users.find_one({"email": s["email"]})
            if u:
                await create_notification(
                    str(u["_id"]),
                    "Room Cleaning Completed",
                    f"Room {room_no} cleaning has been completed at {now_str}."
                )
                
    await log_audit(current_user["email"], "CLEANING_TASK_STATUS_UPDATED", "CLEANING", room_no, f"Status updated to {status_label}")
    
    updated = await db.cleaning_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated


# ==========================================
# STUDENT: VIEW SCHEDULE, STATUS, RATE, REPORT
# ==========================================

@router.get("/my-room")
async def get_student_room_cleaning(current_user: dict = Depends(get_current_user)):
    """
    Protected Student endpoint:
    - View only their own room cleaning schedule & status
    - Strict IDOR protection: cannot view another student's room
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
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name = datetime.now().strftime("%A")
    
    room_doc = await db.rooms.find_one({"room_number": room_no})
    
    # Weekly duty day for this room
    schedules = await db.cleaning_schedule.find({}).to_list(None)
    assigned_day = "Daily"
    for s in schedules:
        if room_no in s.get("room_numbers", []):
            assigned_day = s.get("day")
            break
            
    is_today_duty = (assigned_day == day_name)
    
    # Today's task
    today_task = await db.cleaning_requests.find_one({"room_number": room_no, "date": today_str})
    if today_task:
        today_task["id"] = str(today_task["_id"])
        del today_task["_id"]
        
    # Room cleaning history (strictly restricted to this room)
    history_cursor = db.cleaning_requests.find({"room_number": room_no}).sort([("date", -1), ("created_at", -1)]).limit(20)
    history = []
    async for h in history_cursor:
        h["id"] = str(h["_id"])
        del h["_id"]
        st = h.get("status", "Pending")
        if st in ["Pending", "In Progress", "PENDING", "IN_PROGRESS"] and h.get("date", "") < today_str:
            h["status"] = "Overdue"
        elif st in ["COMPLETED", "Completed"]:
            h["status"] = "Completed"
        elif st in ["IN_PROGRESS", "In Progress"]:
            h["status"] = "In Progress"
        history.append(h)
        
    # Current status
    raw_st = (today_task.get("status") if today_task else (room_doc.get("cleaning_status") if room_doc else "Pending")) or "Pending"
    if raw_st in ["COMPLETED", "Completed"]:
        current_status = "Completed"
    elif raw_st in ["IN_PROGRESS", "In Progress"]:
        current_status = "In Progress"
    elif raw_st in ["OVERDUE", "Overdue"]:
        current_status = "Overdue"
    else:
        current_status = "Pending"
        
    return {
        "room_number": room_no,
        "current_status": current_status,
        "is_today_duty": is_today_duty,
        "assigned_day": assigned_day,
        "today_date": today_str,
        "day_name": day_name,
        "last_cleaned": room_doc.get("last_cleaned") if room_doc else None,
        "today_task": today_task,
        "history": history
    }


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


@router.post("/my-room/report-issue")
async def report_cleaning_issue(
    data: CleaningIssueReport,
    current_user: dict = Depends(get_current_user)
):
    """
    Protected Student endpoint:
    - Report cleaning/housekeeping issue for their own room
    - Strict IDOR protection: automatically locked to student's assigned room
    - Generates ticket and notifies Admin/Warden
    """
    db = get_database()
    email = current_user.get("email")
    student = await db.students.find_one({"email": email})
    if not student or not student.get("room_number"):
        raise HTTPException(status_code=403, detail="Student room assignment not found.")
        
    room_no = student["room_number"]
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    counter = await db.counters.find_one_and_update(
        {"_id": "complaint_id"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    ticket_num = counter.get("sequence_value", 1000)
    ticket_id = f"HTL-{ticket_num:04d}"
    
    complaint_doc = {
        "ticket_id": ticket_id,
        "student_id": student.get("student_id"),
        "student_name": student.get("name"),
        "student_email": email,
        "room_number": room_no,
        "category": "CLEANING",
        "title": f"Cleaning Issue in {room_no}",
        "description": data.description,
        "priority": data.priority,
        "status": "PENDING",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.complaints.insert_one(complaint_doc)
    
    await db.cleaning_requests.update_many(
        {"room_number": room_no, "date": today_str},
        {"$set": {"issue_reported": True, "issue_description": data.description}}
    )
    
    admins_cursor = db.users.find({"role": "ADMIN"})
    async for adm in admins_cursor:
        await create_notification(
            str(adm["_id"]),
            f"Cleaning Issue Reported: {room_no}",
            f"Student {student.get('name')} in {room_no} reported: {data.description[:80]}",
            notification_type="WARNING",
            link="/admin/cleaning"
        )
        
    await log_audit(email, "CLEANING_ISSUE_REPORTED", "CLEANING", room_no, f"Ticket {ticket_id}: {data.description[:60]}")
    return {
        "message": f"Cleaning issue reported successfully (Ticket {ticket_id}). The warden has been notified.",
        "ticket_id": ticket_id,
        "room_number": room_no
    }

