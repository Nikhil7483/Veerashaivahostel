from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit
from app.schemas.all_schemas import RoomUpdate
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/rooms", tags=["Rooms"])

# Canonical mapping for the 12 legitimate physical rooms in Veerashiva Lingayath Boys Hostel.
# Floors: 1={01,02}, 2={04,05,06,07}, 3={08,09,10,11}, 4={12,13}.
# Note: ROOM 03 DOES NOT EXIST.
VALID_ROOM_MAP = {
    "01": "Room 01", "1": "Room 01", "room 01": "Room 01", "room 1": "Room 01",
    "02": "Room 02", "2": "Room 02", "room 02": "Room 02", "room 2": "Room 02",
    "04": "Room 04", "4": "Room 04", "room 04": "Room 04", "room 4": "Room 04",
    "05": "Room 05", "5": "Room 05", "room 05": "Room 05", "room 5": "Room 05",
    "06": "Room 06", "6": "Room 06", "room 06": "Room 06", "room 6": "Room 06",
    "07": "Room 07", "7": "Room 07", "room 07": "Room 07", "room 7": "Room 07",
    "08": "Room 08", "8": "Room 08", "room 08": "Room 08", "room 8": "Room 08",
    "09": "Room 09", "9": "Room 09", "room 09": "Room 09", "room 9": "Room 09",
    "10": "Room 10", "room 10": "Room 10",
    "11": "Room 11", "room 11": "Room 11",
    "12": "Room 12", "room 12": "Room 12",
    "13": "Room 13", "room 13": "Room 13",
}

def is_room_03(room_input: str) -> bool:
    if not room_input:
        return False
    cleaned = room_input.strip().lower().replace(" ", "")
    return cleaned in {"03", "3", "room03", "room3"}

def normalize_room_number(room_input: str) -> Optional[str]:
    if not room_input:
        return None
    cleaned = room_input.strip().lower()
    return VALID_ROOM_MAP.get(cleaned)

class RoomPatch(BaseModel):
    total_beds: Optional[int] = None
    cleaning_status: Optional[str] = None
    last_cleaned: Optional[str] = None
    next_cleaning: Optional[str] = None

@router.get("")
async def list_rooms(current_user: dict = Depends(get_current_user)):
    """
    Lists rooms.
    - Admins see full hostel room data including active student rosters.
    - Students see room availability metadata, but personal student records
      in other rooms are scrubbed to prevent PII harvesting / IDOR.
    """
    db = get_database()
    cursor = db.rooms.find({}).sort("room_number", 1)
    rooms = []
    
    is_admin = (current_user.get("role") == "ADMIN")
    student_assigned_room = None
    if not is_admin:
        student = await db.students.find_one({"email": current_user.get("email")})
        if student:
            student_assigned_room = normalize_room_number(student.get("room_number"))
            
    async for r in cursor:
        r["id"] = str(r["_id"])
        del r["_id"]
        
        # Populate active students
        norm_r = normalize_room_number(r["room_number"])
        students_cursor = db.students.find({"room_number": r["room_number"], "status": "ACTIVE"})
        student_list = []
        async for s in students_cursor:
            # Only include student details if caller is Admin or assigned to this room
            if is_admin or (norm_r and norm_r == student_assigned_room):
                student_list.append({
                    "id": str(s["_id"]),
                    "name": s["name"],
                    "student_id": s["student_id"],
                    "usn": s["usn"],
                    "bed_number": s.get("bed_number", 1),
                    "phone": s.get("phone", "") if is_admin else "",
                    "email": s.get("email", ""),
                    "department": s.get("department", "")
                })
                
        r["students"] = student_list
        # Keep accurate bed count for availability displays
        occupied_count = await db.students.count_documents({"room_number": r["room_number"], "status": "ACTIVE"})
        r["occupied_beds"] = occupied_count
        r["available_beds"] = max(0, r.get("total_beds", 6) - occupied_count)
        rooms.append(r)
        
    return rooms

@router.get("/my/room")
async def get_my_room(current_user: dict = Depends(require_student)):
    """
    Retrieves the authenticated student's assigned room, roommates, and schedule.
    """
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    raw_room_number = student.get("room_number")
    norm_room = normalize_room_number(raw_room_number)
    if not norm_room:
        raise HTTPException(status_code=404, detail=f"Assigned room '{raw_room_number}' not found.")
        
    room = await db.rooms.find_one({"room_number": norm_room})
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {norm_room} not found.")
        
    room["id"] = str(room["_id"])
    del room["_id"]
    
    # Check today's real-time cleaning status and weekly schedule
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    day_name = today_dt.strftime("%A")
    
    valid_rooms = [
        "Room 01", "Room 02", "Room 04", "Room 05", "Room 06", "Room 07",
        "Room 08", "Room 09", "Room 10", "Room 11", "Room 12", "Room 13"
    ]
    duty_rec = await db.daily_duty_records.find_one({"date": today_str})
    if duty_rec:
        duty_room = duty_rec.get("room_number")
        duty_status = duty_rec.get("status", "PENDING")
        skipped_rooms = duty_rec.get("skipped_rooms", [])
    else:
        doc = await db.meal_duty_schedule.find_one({"date": today_str})
        duty_room = doc.get("room_number") if (doc and doc.get("room_number") in valid_rooms) else "Room 01"
        duty_status = "PENDING"
        skipped_rooms = []

    is_scheduled_today = (norm_room == duty_room)
    is_absent_today = (norm_room in skipped_rooms)

    room["duty_room"] = duty_room
    room["duty_status"] = "ABSENT" if is_absent_today else (duty_status if is_scheduled_today else "NOT_SCHEDULED")
    room["is_scheduled_today"] = is_scheduled_today
    room["is_absent_today"] = is_absent_today
    room["day_name"] = day_name
    room["today_scheduled_rooms"] = [duty_room]

    if is_scheduled_today:
        room["cleaning_status"] = duty_status
        room["is_cleaning_completed"] = (duty_status == "COMPLETED")
        room["is_leave_locked"] = (duty_status != "COMPLETED")
    elif is_absent_today:
        room["cleaning_status"] = "ABSENT"
        room["is_cleaning_completed"] = False
        room["is_leave_locked"] = True
    else:
        room["cleaning_status"] = "NOT_SCHEDULED"
        room["is_cleaning_completed"] = True
        room["is_leave_locked"] = False

    room["has_cleaning"] = is_scheduled_today
    
    # Fetch roommates
    students_cursor = db.students.find({"room_number": norm_room, "status": "ACTIVE"})
    roommates = []
    async for s in students_cursor:
        roommates.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "student_id": s["student_id"],
            "usn": s["usn"],
            "bed_number": s.get("bed_number", 1),
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
    """
    Object-level authorized room inspection.
    - Rejects invalid room numbers, explicitly rejecting Room 03 (does not exist).
    - Admins may inspect any valid room.
    - Students may only view details of their own assigned room.
    """
    if is_room_03(room_number):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room 03 does not exist in this hostel."
        )
        
    norm_room = normalize_room_number(room_number)
    if not norm_room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room '{room_number}' not found."
        )
        
    db = get_database()
    is_admin = (current_user.get("role") == "ADMIN")
    
    # Object-level check: students can only access their own room
    if not is_admin:
        student = await db.students.find_one({"email": current_user.get("email")})
        if not student:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile not found.")
        student_room = normalize_room_number(student.get("room_number"))
        if norm_room != student_room:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to view details of other rooms."
            )
            
    room = await db.rooms.find_one({"room_number": norm_room})
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Room '{room_number}' not found.")
        
    room["id"] = str(room["_id"])
    del room["_id"]
    
    students_cursor = db.students.find({"room_number": norm_room, "status": "ACTIVE"})
    student_list = []
    async for s in students_cursor:
        student_list.append({
            "id": str(s["_id"]),
            "name": s["name"],
            "student_id": s["student_id"],
            "usn": s["usn"],
            "bed_number": s.get("bed_number", 1),
            "phone": s.get("phone", "") if is_admin else "",
            "email": s.get("email", ""),
            "department": s.get("department", "")
        })
    room["students"] = student_list
    room["occupied_beds"] = len(student_list)
    room["available_beds"] = max(0, room.get("total_beds", 6) - len(student_list))
    return room

@router.put("/{room_number}")
async def update_room(room_number: str, room_data: RoomUpdate, current_user: dict = Depends(require_admin)):
    """
    Administrative room configuration update.
    Students strictly rejected with HTTP 403.
    """
    if is_room_03(room_number):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room 03 does not exist in this hostel."
        )
        
    norm_room = normalize_room_number(room_number)
    if not norm_room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Room '{room_number}' not found.")
        
    db = get_database()
    room = await db.rooms.find_one({"room_number": norm_room})
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Room '{room_number}' not found.")
        
    occupied = await db.students.count_documents({"room_number": norm_room, "status": "ACTIVE"})
    if room_data.total_beds < occupied:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reduce total beds to {room_data.total_beds} because {occupied} beds are currently occupied."
        )
        
    update_fields = {
        "total_beds": room_data.total_beds,
        "occupied_beds": occupied,
        "available_beds": max(0, room_data.total_beds - occupied),
        "updated_at": datetime.utcnow()
    }
    if room_data.cleaning_status:
        update_fields["cleaning_status"] = room_data.cleaning_status
    if room_data.last_cleaned:
        update_fields["last_cleaned"] = room_data.last_cleaned
    if room_data.next_cleaning:
        update_fields["next_cleaning"] = room_data.next_cleaning
        
    await db.rooms.update_one({"room_number": norm_room}, {"$set": update_fields})
    await log_audit(
        current_user["email"],
        "ROOM_CONFIG_UPDATED",
        "ROOMS",
        norm_room,
        f"Updated total beds to {room_data.total_beds}"
    )
    
    updated = await db.rooms.find_one({"room_number": norm_room})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.patch("/{room_number}")
async def patch_room(room_number: str, patch_data: RoomPatch, current_user: dict = Depends(require_admin)):
    """
    Administrative partial update of room settings.
    Students strictly rejected with HTTP 403.
    """
    if is_room_03(room_number):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room 03 does not exist in this hostel."
        )
        
    norm_room = normalize_room_number(room_number)
    if not norm_room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Room '{room_number}' not found.")
        
    db = get_database()
    room = await db.rooms.find_one({"room_number": norm_room})
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Room '{room_number}' not found.")
        
    update_fields = {"updated_at": datetime.utcnow()}
    if patch_data.total_beds is not None:
        occupied = await db.students.count_documents({"room_number": norm_room, "status": "ACTIVE"})
        if patch_data.total_beds < occupied:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reduce total beds to {patch_data.total_beds} because {occupied} beds are occupied."
            )
        update_fields["total_beds"] = patch_data.total_beds
        update_fields["occupied_beds"] = occupied
        update_fields["available_beds"] = max(0, patch_data.total_beds - occupied)
        
    if patch_data.cleaning_status is not None:
        update_fields["cleaning_status"] = patch_data.cleaning_status
    if patch_data.last_cleaned is not None:
        update_fields["last_cleaned"] = patch_data.last_cleaned
    if patch_data.next_cleaning is not None:
        update_fields["next_cleaning"] = patch_data.next_cleaning
        
    await db.rooms.update_one({"room_number": norm_room}, {"$set": update_fields})
    await log_audit(
        current_user["email"],
        "ROOM_CONFIG_PATCHED",
        "ROOMS",
        norm_room,
        f"Patched fields: {list(update_fields.keys())}"
    )
    
    updated = await db.rooms.find_one({"room_number": norm_room})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.delete("/{room_number}")
async def delete_room(room_number: str, current_user: dict = Depends(require_admin)):
    """
    Administrative room deletion protection.
    Fixed baseline hostel rooms cannot be removed.
    """
    if is_room_03(room_number):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room 03 does not exist in this hostel."
        )
        
    norm_room = normalize_room_number(room_number)
    if not norm_room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Room '{room_number}' not found.")
        
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Fixed physical hostel room '{norm_room}' cannot be deleted."
    )

