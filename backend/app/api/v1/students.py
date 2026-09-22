from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.database.connection import get_database
from app.core.dependencies import require_admin, require_student, log_audit, create_notification
from app.core.security import hash_password
from app.schemas.all_schemas import StudentCreate, StudentUpdate
from bson import ObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("")
async def list_students(
    search: Optional[str] = Query(None, description="Search by name, USN, student_id, room, department"),
    department: Optional[str] = None,
    semester: Optional[int] = None,
    room_number: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    
    if search:
        s = search.strip()
        query["$or"] = [
            {"name": {"$regex": s, "$options": "i"}},
            {"usn": {"$regex": s, "$options": "i"}},
            {"student_id": {"$regex": s, "$options": "i"}},
            {"room_number": {"$regex": s, "$options": "i"}},
            {"department": {"$regex": s, "$options": "i"}},
        ]
        
    if department:
        query["department"] = department
    if semester:
        query["semester"] = semester
    if room_number:
        query["room_number"] = room_number
    if status:
        query["status"] = status
        
    cursor = db.students.find(query).sort("student_id", 1)
    students = []
    async for s in cursor:
        s["id"] = str(s["_id"])
        del s["_id"]
        students.append(s)
        
    return students

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_student(student_data: StudentCreate, current_user: dict = Depends(require_admin)):
    db = get_database()
    
    # Check if student ID or USN or Email exists
    existing = await db.students.find_one({
        "$or": [
            {"student_id": student_data.student_id},
            {"usn": student_data.usn},
            {"email": student_data.email}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A student with this Student ID, USN, or Email already exists."
        )
        
    # Check room capacity (13 rooms)
    room = await db.rooms.find_one({"room_number": student_data.room_number})
    if not room:
        raise HTTPException(status_code=400, detail=f"Room '{student_data.room_number}' does not exist.")
        
    occupied = await db.students.count_documents({
        "room_number": student_data.room_number,
        "status": "ACTIVE"
    })
    if occupied >= room.get("total_beds", 4):
        raise HTTPException(
            status_code=400,
            detail=f"Room {student_data.room_number} is already at full capacity ({occupied}/{room.get('total_beds', 4)} beds occupied)."
        )
        
    # Check bed number uniqueness in room
    existing_bed = await db.students.find_one({
        "room_number": student_data.room_number,
        "bed_number": student_data.bed_number,
        "status": "ACTIVE"
    })
    if existing_bed:
        raise HTTPException(
            status_code=400,
            detail=f"Bed {student_data.bed_number} in Room {student_data.room_number} is already occupied by {existing_bed.get('name')}."
        )
        
    # Create user login
    user_doc = {
        "email": student_data.email,
        "password_hash": hash_password(student_data.password or "Student@123"),
        "role": "STUDENT",
        "status": student_data.status,
        "created_at": datetime.utcnow()
    }
    user_insert = await db.users.insert_one(user_doc)
    
    # Create student document
    s_dict = student_data.model_dump()
    s_dict.pop("password", None)
    s_dict["user_id"] = str(user_insert.inserted_id)
    s_dict["created_at"] = datetime.utcnow()
    
    s_insert = await db.students.insert_one(s_dict)
    
    # Update room occupancy
    new_occupied = occupied + 1
    await db.rooms.update_one(
        {"room_number": student_data.room_number},
        {"$set": {
            "occupied_beds": new_occupied,
            "available_beds": max(0, room.get("total_beds", 4) - new_occupied)
        }}
    )
    
    await log_audit(current_user["email"], "STUDENT_ADDED", "STUDENTS", str(s_insert.inserted_id), f"Added student {student_data.name} to {student_data.room_number}")
    await create_notification(str(user_insert.inserted_id), "Welcome to Smart Hostel", f"Welcome {student_data.name}! You have been allocated {student_data.room_number}, Bed {student_data.bed_number}.")
    
    s_dict["id"] = str(s_insert.inserted_id)
    if "_id" in s_dict:
        del s_dict["_id"]
    return s_dict

@router.get("/my/profile")
async def get_my_profile(current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    student["id"] = str(student["_id"])
    del student["_id"]
    return student

@router.put("/my/profile")
async def update_my_profile(update_data: dict, current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    allowed_fields = ["phone", "address", "parent_contact", "parent_name"]
    filtered_update = {k: v for k, v in update_data.items() if k in allowed_fields and v is not None}
    
    if filtered_update:
        filtered_update["updated_at"] = datetime.utcnow()
        await db.students.update_one({"_id": student["_id"]}, {"$set": filtered_update})
        
    updated = await db.students.find_one({"_id": student["_id"]})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.get("/{id}")
async def get_student_details(id: str, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid student ID format.")
        
    student = await db.students.find_one({"_id": obj_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    student_id = student.get("student_id")
    student["id"] = str(student["_id"])
    del student["_id"]
    
    # Aggregated history:
    # 1. Attendance history (last 30 records)
    attendance_cursor = db.attendance.find({"student_id": student_id}).sort("date", -1).limit(30)
    attendance_history = []
    async for a in attendance_cursor:
        a["id"] = str(a["_id"])
        del a["_id"]
        attendance_history.append(a)
        
    # Attendance %
    total_att = await db.attendance.count_documents({"student_id": student_id})
    present_att = await db.attendance.count_documents({"student_id": student_id, "status": "PRESENT"})
    att_percent = round((present_att / total_att * 100), 1) if total_att > 0 else 100.0
    
    # 2. Leave history
    leave_cursor = db.leave_applications.find({"student_id": student_id}).sort("created_at", -1)
    leave_history = []
    async for l in leave_cursor:
        l["id"] = str(l["_id"])
        del l["_id"]
        leave_history.append(l)
        
    # 3. Complaint history
    complaint_cursor = db.complaints.find({"student_id": student_id}).sort("created_at", -1)
    complaint_history = []
    async for c in complaint_cursor:
        c["id"] = str(c["_id"])
        del c["_id"]
        complaint_history.append(c)
        
    # 4. Cleaning requests for student's room
    cleaning_cursor = db.cleaning_requests.find({"room_number": student.get("room_number")}).sort("created_at", -1).limit(10)
    cleaning_history = []
    async for cl in cleaning_cursor:
        cl["id"] = str(cl["_id"])
        del cl["_id"]
        cleaning_history.append(cl)
        
    # 5. Maintenance requests for student's room
    maint_cursor = db.maintenance_requests.find({"room_number": student.get("room_number")}).sort("created_at", -1).limit(10)
    maintenance_history = []
    async for m in maint_cursor:
        m["id"] = str(m["_id"])
        del m["_id"]
        maintenance_history.append(m)
        
    # 6. Check today's cleaning duty for this student's room
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    day_name = today_dt.strftime("%A")
    schedule_doc = await db.cleaning_schedule.find_one({"day": day_name})
    raw_rooms = schedule_doc.get("room_numbers", []) if schedule_doc else []
    today_scheduled_rooms = [raw_rooms[0]] if raw_rooms else []
    is_scheduled_today = bool(student.get("room_number") in today_scheduled_rooms)
    today_cleaning = await db.cleaning_requests.find_one({"room_number": student.get("room_number"), "date": today_str})
    has_cleaning = is_scheduled_today or (today_cleaning is not None)

    return {
        "profile": student,
        "attendance_stats": {
            "total_days": total_att,
            "present_days": present_att,
            "percentage": att_percent
        },
        "attendance_history": attendance_history,
        "leave_history": leave_history,
        "complaint_history": complaint_history,
        "cleaning_history": cleaning_history,
        "maintenance_history": maintenance_history,
        "cleaning_duty_today": {
            "has_cleaning": has_cleaning,
            "is_scheduled": is_scheduled_today,
            "day_name": day_name,
            "today_scheduled_rooms": today_scheduled_rooms
        }
    }

@router.put("/{id}")
async def update_student(id: str, update_data: StudentUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid student ID format.")
        
    student = await db.students.find_one({"_id": obj_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    u_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # Handle room/bed change capacity check
    old_room = student.get("room_number")
    new_room = u_dict.get("room_number")
    if new_room and new_room != old_room:
        target_room = await db.rooms.find_one({"room_number": new_room})
        if not target_room:
            raise HTTPException(status_code=400, detail=f"Target room '{new_room}' does not exist.")
        occupied = await db.students.count_documents({"room_number": new_room, "status": "ACTIVE"})
        if occupied >= target_room.get("total_beds", 4):
            raise HTTPException(status_code=400, detail=f"Target room {new_room} is full ({occupied}/{target_room.get('total_beds', 4)}).")
            
    if u_dict:
        # If email changed, check uniqueness and update user account
        if "email" in u_dict and u_dict["email"] != student.get("email"):
            existing_email = await db.users.find_one({"email": u_dict["email"]})
            if existing_email:
                raise HTTPException(status_code=400, detail="This email is already in use by another account.")
            await db.users.update_one({"email": student["email"]}, {"$set": {"email": u_dict["email"]}})

        u_dict["updated_at"] = datetime.utcnow()
        await db.students.update_one({"_id": obj_id}, {"$set": u_dict})
        
        # If status changed, also update User document
        if "status" in u_dict:
            curr_email = u_dict.get("email", student["email"])
            await db.users.update_one({"email": curr_email}, {"$set": {"status": u_dict["status"]}})
            
    # Recalculate room counts
    if new_room and new_room != old_room:
        for r_num in [old_room, new_room]:
            r_doc = await db.rooms.find_one({"room_number": r_num})
            if r_doc:
                occ = await db.students.count_documents({"room_number": r_num, "status": "ACTIVE"})
                await db.rooms.update_one(
                    {"room_number": r_num},
                    {"$set": {"occupied_beds": occ, "available_beds": max(0, r_doc.get("total_beds", 4) - occ)}}
                )
                
    await log_audit(current_user["email"], "STUDENT_UPDATED", "STUDENTS", id, f"Updated student {student.get('name')}")
    
    updated = await db.students.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.delete("/{id}")
async def delete_student(id: str, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid student ID format.")
        
    student = await db.students.find_one({"_id": obj_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    room_num = student.get("room_number")
    
    # Deactivate user login and remove student record
    await db.users.delete_one({"email": student["email"]})
    await db.students.delete_one({"_id": obj_id})
    
    # Recalculate room occupancy
    r_doc = await db.rooms.find_one({"room_number": room_num})
    if r_doc:
        occ = await db.students.count_documents({"room_number": room_num, "status": "ACTIVE"})
        await db.rooms.update_one(
            {"room_number": room_num},
            {"$set": {"occupied_beds": occ, "available_beds": max(0, r_doc.get("total_beds", 4) - occ)}}
        )
        
    await log_audit(current_user["email"], "STUDENT_DELETED", "STUDENTS", id, f"Deleted student {student.get('name')}")
    return {"message": f"Student {student.get('name')} deleted successfully."}
