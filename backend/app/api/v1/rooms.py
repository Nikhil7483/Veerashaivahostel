from fastapi import APIRouter, Depends, HTTPException
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit
from app.schemas.all_schemas import RoomUpdate
from datetime import datetime

router = APIRouter(prefix="/rooms", tags=["Rooms"])

@router.get("")
async def list_rooms(current_user: dict = Depends(get_current_user)):
    db = get_database()
    cursor = db.rooms.find({}).sort("room_number", 1)
    rooms = []
    async for r in cursor:
        r["id"] = str(r["_id"])
        del r["_id"]
        # Populate current active students
        students_cursor = db.students.find({"room_number": r["room_number"], "status": "ACTIVE"})
        student_list = []
        async for s in students_cursor:
            student_list.append({
                "id": str(s["_id"]),
                "name": s["name"],
                "student_id": s["student_id"],
                "usn": s["usn"],
                "bed_number": s["bed_number"],
                "phone": s.get("phone", ""),
                "email": s.get("email", ""),
                "department": s.get("department", "")
            })
        r["students"] = student_list
        r["occupied_beds"] = len(student_list)
        r["available_beds"] = max(0, r.get("total_beds", 4) - len(student_list))
        rooms.append(r)
    return rooms

@router.get("/my/room")
async def get_my_room(current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    room_number = student.get("room_number")
    room = await db.rooms.find_one({"room_number": room_number})
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_number} not found.")
        
    room["id"] = str(room["_id"])
    del room["_id"]
    
    # Check today's real-time cleaning status and weekly schedule
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    day_name = today_dt.strftime("%A")
    
    schedule_doc = await db.cleaning_schedule.find_one({"day": day_name})
    raw_rooms = schedule_doc.get("room_numbers", []) if schedule_doc else []
    today_scheduled_rooms = [raw_rooms[0]] if raw_rooms else []
    is_scheduled_today = (room_number in today_scheduled_rooms)
    
    today_cleaning = await db.cleaning_requests.find_one({"room_number": room_number, "date": today_str})
    has_cleaning = is_scheduled_today or (today_cleaning is not None)
    
    if has_cleaning:
        if today_cleaning:
            room["cleaning_status"] = today_cleaning.get("status", room.get("cleaning_status", "PENDING"))
        else:
            room["cleaning_status"] = room.get("cleaning_status", "PENDING")
        room["is_cleaning_completed"] = (room["cleaning_status"] == "COMPLETED")
        # Only lock leave for the room currently being cleaned (IN_PROGRESS), not all rooms
        room["is_leave_locked"] = (room["cleaning_status"] == "IN_PROGRESS")
    else:
        room["cleaning_status"] = "NOT_SCHEDULED"
        room["is_cleaning_completed"] = True
        room["is_leave_locked"] = False

    room["has_cleaning"] = has_cleaning
    room["is_scheduled_today"] = is_scheduled_today
    room["day_name"] = day_name
    room["today_scheduled_rooms"] = today_scheduled_rooms
    
    # Fetch roommates (excluding or noting current student)
    students_cursor = db.students.find({"room_number": room_number, "status": "ACTIVE"})
    roommates = []
    async for s in students_cursor:
        roommates.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "student_id": s["student_id"],
            "usn": s["usn"],
            "bed_number": s["bed_number"],
            "phone": s.get("phone", ""),
            "email": s.get("email", ""),
            "department": s.get("department", ""),
            "semester": s.get("semester", ""),
            "is_me": (s["email"] == current_user["email"])
        })
    room["students"] = roommates
    room["my_bed"] = student.get("bed_number")
    return room

@router.get("/{room_number}")
async def get_room(room_number: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    room = await db.rooms.find_one({"room_number": room_number})
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_number}' not found.")
        
    room["id"] = str(room["_id"])
    del room["_id"]
    
    students_cursor = db.students.find({"room_number": room_number, "status": "ACTIVE"})
    student_list = []
    async for s in students_cursor:
        student_list.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "student_id": s["student_id"],
            "usn": s["usn"],
            "bed_number": s["bed_number"],
            "phone": s.get("phone", ""),
            "email": s.get("email", ""),
            "department": s.get("department", "")
        })
    room["students"] = student_list
    room["occupied_beds"] = len(student_list)
    room["available_beds"] = max(0, room.get("total_beds", 4) - len(student_list))
    return room

@router.put("/{room_number}")
async def update_room(room_number: str, room_data: RoomUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    room = await db.rooms.find_one({"room_number": room_number})
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_number}' not found.")
        
    occupied = await db.students.count_documents({"room_number": room_number, "status": "ACTIVE"})
    if room_data.total_beds < occupied:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce total beds to {room_data.total_beds} because {occupied} beds are currently occupied."
        )
        
    update_fields = {
        "total_beds": room_data.total_beds,
        "occupied_beds": occupied,
        "available_beds": room_data.total_beds - occupied,
        "updated_at": datetime.utcnow()
    }
    if room_data.cleaning_status:
        update_fields["cleaning_status"] = room_data.cleaning_status
    if room_data.last_cleaned:
        update_fields["last_cleaned"] = room_data.last_cleaned
    if room_data.next_cleaning:
        update_fields["next_cleaning"] = room_data.next_cleaning
        
    await db.rooms.update_one({"room_number": room_number}, {"$set": update_fields})
    await log_audit(current_user["email"], "ROOM_CONFIG_UPDATED", "ROOMS", room_number, f"Updated beds to {room_data.total_beds}")
    
    updated = await db.rooms.find_one({"room_number": room_number})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated
