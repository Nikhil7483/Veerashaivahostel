import os
import uuid
from pathlib import Path
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
        
    # Check if student's room is on Daily Duty today
    room_number = student.get("room_number")
    today_dt = datetime.now()
    today_str = today_dt.strftime("%Y-%m-%d")
    day_name = today_dt.strftime("%A")

    duty_rec = await db.daily_duty_records.find_one({"date": today_str})
    if duty_rec:
        duty_room = duty_rec.get("room_number")
        duty_status = duty_rec.get("status", "PENDING")
        skipped_rooms = duty_rec.get("skipped_rooms", [])
    else:
        m_doc = await db.meal_duty_schedule.find_one({"date": today_str})
        duty_room = m_doc.get("room_number") if m_doc else None
        duty_status = "PENDING"
        skipped_rooms = []

    if room_number in skipped_rooms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"🔒 Leave applications are locked: Your room ({room_number}) was declared ABSENT for hostel duty today. Leave cannot be unlocked for absent or skipped rooms."
        )

    if room_number == duty_room:
        if duty_status != "COMPLETED" or not (duty_rec and duty_rec.get("leave_unlocked", False)):
            if duty_status == "PENDING_APPROVAL":
                lock_detail = f"🔒 Leave applications are locked: Your room ({room_number}) duty has been submitted and is currently PENDING WARDEN APPROVAL. Leave facility unlocks automatically once approved by the warden."
            elif duty_status == "RETURNED_FOR_CORRECTION":
                lock_detail = f"🔒 Leave applications are locked: Your room ({room_number}) duty was returned by the warden for count/cleaning correction. Please update and re-submit to unlock leave."
            else:
                lock_detail = f"🔒 Leave applications are locked: Your room ({room_number}) is on Daily Duty today ({day_name}, {today_str}). Leave applications remain locked until complete hostel cleaning and all three meal counts are submitted and approved by the warden. Current duty status: {duty_status}."
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=lock_detail
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
        upload_dir = Path(settings.UPLOAD_DIRECTORY).resolve()
        filepath = (upload_dir / filename).resolve()
        
        # Enforce path traversal protection
        try:
            filepath.relative_to(upload_dir)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid destination path for file upload.")
            
        contents = await document.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File exceeds maximum size limit of 5MB.")
            
        from app.api.v1.uploads import verify_file_signature
        if not verify_file_signature(contents, ext):
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded file content does not match the valid format signature for '{ext}'. Upload rejected."
            )
            
        with open(filepath, "wb") as f:
            f.write(contents)
            
        document_url = f"/api/v1/uploads/{filename}"
        
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
    
    # 1. Notify Student with funny friendly notification
    await create_notification(
        str(current_user["id"]),
        "Your mind is already at home 😂",
        f"Your mind is already at home. Your leave application is now waiting! 😂 ({leave_type} leave from {from_date} to {to_date}).",
        "INFO",
        "/student/leave"
    )

    # 2. Notify Admin / Warden
    admin = await db.users.find_one({"role": "ADMIN"})
    if admin:
        await create_notification(
            str(admin["_id"]),
            "New Leave Application 🏖️",
            f"{student['name']} ({student.get('room_number')}) submitted a {leave_type} leave request from {from_date} to {to_date}.",
            "INFO",
            "/admin/attendance"
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
        if update_data.status == "APPROVED":
            notif_title = "Freedom loading! 🎉"
            remarks_text = f" Warden note: {update_data.admin_remarks}" if update_data.admin_remarks else ""
            notif_msg = f"Freedom loading! Your leave has officially been approved! 🎉 ({leave['from_date']} to {leave['to_date']}).{remarks_text}"
            notif_type = "SUCCESS"
        else:
            notif_title = "Plot twist! ❌"
            remarks_text = f" Warden reason: {update_data.admin_remarks}" if update_data.admin_remarks else " No specific reason provided."
            notif_msg = f"Plot twist! Your leave was not approved. Check the warden's reason.{remarks_text}"
            notif_type = "WARNING"

        await create_notification(
            str(student_user["_id"]),
            notif_title,
            notif_msg,
            notif_type,
            "/student/leave"
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
