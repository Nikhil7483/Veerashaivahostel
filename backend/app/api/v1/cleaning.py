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

router = APIRouter(prefix="/cleaning", tags=["Room Cleaning"])

async def get_all_hostel_rooms(db) -> List[str]:
    """
    Returns sorted list of all 13 hostel rooms from the database.
    """
    rooms_cursor = db.rooms.find({}).sort("room_number", 1)
    rooms = []
    async for r in rooms_cursor:
        rooms.append(r["room_number"])
    if not rooms:
        rooms = [f"Room {i:02d}" for i in [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]]
    return rooms

async def get_today_assigned_rooms(db):
    """
    Returns (day_name, all_rooms_list). Daily housekeeping and sanitation covers all physical hostel rooms.
    """
    day_name = datetime.now().strftime("%A")
    all_rooms = await get_all_hostel_rooms(db)
    return day_name, all_rooms

async def get_today_duty_rooms(db, day_name: str = None) -> List[str]:
    """
    Returns today's designated cleaning duty room from db.cleaning_schedule (e.g. ['Room 01'] on Monday).
    Hostel rule: strictly ONE cleaning room is assigned per day.
    """
    if not day_name:
        day_name = datetime.now().strftime("%A")
    schedule_doc = await db.cleaning_schedule.find_one({"day": day_name})
    if schedule_doc and schedule_doc.get("room_numbers"):
        rooms = schedule_doc["room_numbers"]
        if isinstance(rooms, list) and len(rooms) > 0:
            return [rooms[0]]
    return []

async def get_room_day_schedule_map(db):
    """
    Maps each room to its primary scheduled inspection day.
    """
    schedules = await db.cleaning_schedule.find({}).to_list(None)
    room_map = {}
    for s in schedules:
        d = s.get("day")
        for r_no in s.get("room_numbers", []):
            if r_no not in room_map:
                room_map[r_no] = d
    return room_map

@router.get("/daily-board")
async def get_daily_cleaning_board(current_user: dict = Depends(require_admin)):
    """
    Returns the live daily cleaning status for all 13 rooms in the hostel.
    Includes resident attendance, bed capacity, task details, and floor information.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    today_duty_rooms = await get_today_duty_rooms(db, day_name)
    room_day_map = await get_room_day_schedule_map(db)
    
    rooms_cursor = db.rooms.find({}).sort("room_number", 1)
    board = []
    
    async for r in rooms_cursor:
        room_no = r["room_number"]
        # Extract room integer for floor computation: 01-02 -> Floor 1, 04-07 -> Floor 2, 08-11 -> Floor 3, 12-13 -> Floor 4
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
        is_today_duty = (room_no in today_duty_rooms)
            
        board.append({
            "room_number": room_no,
            "floor": floor_num,
            "is_excluded": False, # All hostel rooms included in daily sanitation!
            "is_vacant": is_vacant,
            "exclusion_reason": "Vacant Room (No residents)" if is_vacant else None,
            "is_scheduled_today": is_today_duty,
            "is_today_duty_room": is_today_duty,
            "assigned_day": assigned_day,
            "today_day_name": day_name,
            "today_duty_rooms": today_duty_rooms,
            "today_scheduled_rooms": today_duty_rooms, # Consistent with food_allocations, leaves, and rooms API!
            "all_hostel_rooms": scheduled_rooms,
            "total_beds": r.get("total_beds", 6),
            "occupied_beds": len(students),
            "cleaning_status": cleaning_status,
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
    Returns real-time operational status of hostel housekeeping across all rooms.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    today_duty_rooms = await get_today_duty_rooms(db, day_name)
    
    completed_count = 0
    active_room = None
    first_pending = None
    room_summaries = []
    
    for r_no in scheduled_rooms:
        r = await db.rooms.find_one({"room_number": r_no})
        task = await db.cleaning_requests.find_one({"room_number": r_no, "date": today_str})
        status = task.get("status") if task else (r.get("cleaning_status", "PENDING") if r else "PENDING")
        
        if status == "COMPLETED":
            completed_count += 1
        elif status == "IN_PROGRESS" and not active_room:
            active_room = r_no
        elif status == "PENDING" and not first_pending:
            first_pending = r_no
            
        room_summaries.append({
            "room_number": r_no,
            "status": status,
            "is_excluded": False,
            "is_today_duty": (r_no in today_duty_rooms),
            "last_cleaned": r.get("last_cleaned") if r else None
        })
        
    total_rooms = len(scheduled_rooms)
    is_floor_finished = (completed_count >= total_rooms and total_rooms > 0)
    current_active = active_room or first_pending or ("Finished" if is_floor_finished else (today_duty_rooms[0] if today_duty_rooms else (scheduled_rooms[0] if scheduled_rooms else "None")))
    progress_percent = int((completed_count / total_rooms) * 100) if total_rooms > 0 else 100
    
    return {
        "day_name": day_name,
        "today_duty_rooms": today_duty_rooms,
        "today_scheduled_rooms": today_duty_rooms,
        "all_rooms": scheduled_rooms,
        "active_room": current_active,
        "completed_count": completed_count,
        "total_rooms": total_rooms,
        "progress_percent": progress_percent,
        "is_floor_finished": is_floor_finished,
        "rooms": room_summaries
    }

@router.post("/complete-and-advance/{room_number}")
async def complete_and_advance(room_number: str, current_user: dict = Depends(require_admin)):
    """
    Marks current room as COMPLETED (permanently locking it for the day),
    and automatically advances the live cleaning pointer to the next assigned room in the 13-room roster.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%I:%M %p")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    
    # 1. Mark current room as COMPLETED
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
            "notes": f"Cleaned & sanitized via housekeeping flow at {now_str}.",
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
                f"Room {room_number} daily sanitisation is COMPLETED at {now_str}. Leave applications unlocked."
            )
            
    # 2. Advance sequentially across all 13 rooms to next non-completed room
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
        "CLEANING_COMPLETED_AND_ADVANCED",
        "CLEANING",
        room_number,
        f"{room_number} marked COMPLETED; advanced housekeeping to {next_room or 'All 13 Rooms Finished'}"
    )
    
    return {
        "message": f"✅ {room_number} Cleaned & Locked!" + (f" Advanced to {next_room}." if next_room else f" All {len(scheduled_rooms)} hostel rooms have been sanitized!"),
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

@router.post("/reset-shift")
async def reset_cleaning_shift(current_user: dict = Depends(require_admin)):
    """
    Resets the cleaning shift for all hostel rooms starting from the 1st room (Room 01 to IN_PROGRESS, others to PENDING).
    Only one room is on cleaning duty per day and authorized for meal count.
    """
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    day_name, scheduled_rooms = await get_today_assigned_rooms(db)
    today_duty_rooms = await get_today_duty_rooms(db, day_name)
    
    first_room = "Room 01" # Strictly reset shift starting from the 1st room
    
    # Synchronize today's cleaning_schedule so today's scheduled cleaning room is exactly the 1st room (Room 01)
    await db.cleaning_schedule.update_one(
        {"day": day_name},
        {"$set": {"room_numbers": [first_room], "updated_at": datetime.utcnow()}},
        upsert=True
    )
    today_duty_rooms = [first_room]
    
    for r_no in scheduled_rooms:
        st = "IN_PROGRESS" if r_no == first_room else "PENDING"
        await db.rooms.update_one({"room_number": r_no}, {"$set": {"cleaning_status": st}})
        await db.cleaning_requests.update_many(
            {"room_number": r_no, "date": today_str},
            {"$set": {
                "status": st,
                "notes": f"Daily shift reset from 1st room ({first_room}) for {day_name} ({r_no}).",
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
        
    await log_audit(current_user["email"], "CLEANING_SHIFT_RESET", "CLEANING", f"All {len(scheduled_rooms)} rooms reset starting from 1st room ({first_room})")
    return {
        "message": f"Housekeeping shift reset from 1st room ({first_room}): {first_room} is now IN_PROGRESS, ready for cleaning.",
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

