import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from app.database.connection import get_database
from app.core.dependencies import require_admin, require_student, log_audit, create_notification
from app.core.config import settings
from app.core.limiter import limiter
from app.schemas.all_schemas import LeaveStatusUpdate
from bson import ObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/leaves", tags=["Leave Applications"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@router.get("")
async def list_leaves(
    status: Optional[str] = None,
    student_id: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if student_id:
        query["student_id"] = student_id
        
    cursor = db.leave_applications.find(query).sort("created_at", -1)
    leaves = []
    async for l in cursor:
        l["id"] = str(l["_id"])
        del l["_id"]
        leaves.append(l)
    return leaves

@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def submit_leave(
    request: Request,
    from_date: str = Form(...),
    to_date: str = Form(...),
    leave_type: str = Form(...),
    reason: str = Form(...),
    document: Optional[UploadFile] = File(None),
    current_user: dict = Depends(require_student)
):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")
        
    # Check if student's room has cleaning duty today and if it is incomplete
    room_number = student.get("room_number")
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
        room_doc = await db.rooms.find_one({"room_number": room_number})
        current_cleaning_status = (today_cleaning.get("status") if today_cleaning else None) or (room_doc.get("cleaning_status") if room_doc else "PENDING")
        # Only lock leave for rooms currently being cleaned (IN_PROGRESS), not all rooms
        if current_cleaning_status == "IN_PROGRESS":
            raise HTTPException(
                status_code=400,
                detail=f"🔒 Leave applications are locked: Your room ({room_number}) is currently being cleaned today ({day_name}). Leave applications are locked for the room actively being cleaned until sanitisation is verified COMPLETED. Status: {current_cleaning_status}"
            )

    # Check if student already has a pending leave application
    pending = await db.leave_applications.find_one({
        "student_id": student["student_id"],
        "status": "PENDING"
    })
    if pending:
        raise HTTPException(
            status_code=400,
            detail="⚠️ You already have a pending leave application. Please wait for the warden to review it."
        )
        
    document_url = None
    if document and document.filename:
        # Strip directory paths and extract extension
        safe_raw_name = os.path.basename(document.filename)
        ext = os.path.splitext(safe_raw_name)[1].lower()
        
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type '{ext}'. Only PDF, JPG, JPEG, and PNG files are permitted."
            )
            
        # Strictly randomized storage filename without raw client filename
        filename = f"leave_{uuid.uuid4().hex}{ext}"
        upload_dir = os.path.abspath(settings.UPLOAD_DIRECTORY)
        filepath = os.path.abspath(os.path.join(upload_dir, filename))
        
        # Enforce path traversal protection
        if not filepath.startswith(upload_dir):
            raise HTTPException(status_code=400, detail="Invalid destination path for file upload.")
            
        contents = await document.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File exceeds maximum size limit of 5MB.")
            
        with open(filepath, "wb") as f:
            f.write(contents)
            
        document_url = f"/uploads/{filename}"
        
    leave_doc = {
        "student_id": student["student_id"],
        "student_name": student["name"],
        "usn": student.get("usn"),
        "room_number": student.get("room_number"),
        "phone": student.get("phone"),
        "from_date": from_date,
        "to_date": to_date,
        "leave_type": leave_type,
        "reason": reason,
        "document_url": document_url,
        "status": "PENDING",
        "admin_remarks": "",
        "created_at": datetime.utcnow()
    }
    
    result = await db.leave_applications.insert_one(leave_doc)
    leave_doc["id"] = str(result.inserted_id)
    del leave_doc["_id"]
    
    # Notify Admin / Warden
    admin = await db.users.find_one({"role": "ADMIN"})
    if admin:
        await create_notification(
            str(admin["_id"]),
            "New Leave Application",
            f"{student['name']} ({student.get('room_number')}) submitted a {leave_type} leave request from {from_date} to {to_date}."
        )
        
    return leave_doc

@router.get("/my/applications")
async def get_my_leaves(current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")
        
    cursor = db.leave_applications.find({"student_id": student["student_id"]}).sort("created_at", -1)
    leaves = []
    async for l in cursor:
        l["id"] = str(l["_id"])
        del l["_id"]
        leaves.append(l)
    return leaves

@router.put("/{id}/status")
async def update_leave_status(
    id: str,
    update_data: LeaveStatusUpdate,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid application ID.")
        
    leave = await db.leave_applications.find_one({"_id": obj_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found.")
        
    await db.leave_applications.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": update_data.status,
            "admin_remarks": update_data.admin_remarks or "",
            "reviewed_by": current_user["email"],
            "reviewed_at": datetime.utcnow()
        }}
    )
    
    # Notify student
    student_user = await db.users.find_one({"email": leave.get("student_id")})
    if not student_user:
        student = await db.students.find_one({"student_id": leave.get("student_id")})
        if student:
            student_user = await db.users.find_one({"email": student["email"]})
            
    if student_user:
        status_msg = "approved ✅" if update_data.status == "APPROVED" else "rejected ❌"
        remarks_msg = f" Remarks: {update_data.admin_remarks}" if update_data.admin_remarks else ""
        await create_notification(
            str(student_user["_id"]),
            f"Leave Application {update_data.status}",
            f"Your leave request for {leave['from_date']} to {leave['to_date']} has been {status_msg}.{remarks_msg}"
        )
        
    await log_audit(
        current_user["email"],
        f"LEAVE_{update_data.status}",
        "LEAVES",
        id,
        f"Leave for {leave.get('student_name')} marked {update_data.status}"
    )
    
    updated = await db.leave_applications.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated
