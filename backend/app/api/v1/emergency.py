from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit, create_notification
from app.core.limiter import limiter
from app.schemas.all_schemas import EmergencyAlertCreate, EmergencyAlertResolve
from bson import ObjectId
from datetime import datetime
from typing import Optional

from app.api.v1.rooms import is_room_03, normalize_room_number

router = APIRouter(prefix="/emergency", tags=["Emergency SOS"])

@router.get("")
async def list_emergency_alerts(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Lists emergency alerts.
    - Admins see all emergency alerts across the hostel.
    - Students only see their own emergency SOS submissions (object-level scoped).
    """
    db = get_database()
    query = {}
    if status:
        query["status"] = status
        
    is_admin = (current_user.get("role") == "ADMIN")
    if not is_admin:
        student = await db.students.find_one({"email": current_user.get("email")})
        if not student:
            return []
        query["student_id"] = student.get("student_id")
        
    cursor = db.emergency_alerts.find(query).sort("created_at", -1)
    alerts = []
    async for a in cursor:
        a["id"] = str(a["_id"])
        del a["_id"]
        alerts.append(a)
    return alerts

@router.get("/{id}")
async def get_emergency_alert(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves a single emergency alert by ID with object-level authorization.
    - Admins can view any alert.
    - Students can only view their own alerts.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid emergency alert ID.")
        
    alert = await db.emergency_alerts.find_one({"_id": obj_id})
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency alert not found.")
        
    is_admin = (current_user.get("role") == "ADMIN")
    if not is_admin:
        student = await db.students.find_one({"email": current_user.get("email")})
        if not student or alert.get("student_id") != student.get("student_id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view this emergency alert."
            )
            
    alert["id"] = str(alert["_id"])
    del alert["_id"]
    return alert

@router.post("/trigger", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def trigger_emergency_sos(request: Request, data: EmergencyAlertCreate, current_user: dict = Depends(require_student)):
    """
    Allows authenticated students to submit legitimate emergency SOS alerts.
    Rejects invalid room numbers such as Room 03.
    """
    if is_room_03(data.room_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room 03 does not exist in this hostel."
        )
        
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    norm_room = normalize_room_number(data.room_number) or data.room_number or student.get("room_number")
    
    alert_doc = {
        "student_id": student["student_id"],
        "student_name": student["name"],
        "usn": student.get("usn"),
        "phone": student.get("phone"),
        "parent_contact": student.get("parent_contact"),
        "room_number": norm_room,
        "emergency_type": data.emergency_type,
        "description": data.description or "Emergency SOS Triggered from Student App",
        "status": "ACTIVE",  # ACTIVE, ACKNOWLEDGED, RESOLVED
        "resolution_notes": "",
        "created_at": datetime.utcnow(),
        "resolved_at": None
    }
    
    res = await db.emergency_alerts.insert_one(alert_doc)
    alert_doc["id"] = str(res.inserted_id)
    del alert_doc["_id"]
    
    # Broadcast high-priority notification to all admin users
    admins = db.users.find({"role": "ADMIN"})
    async for admin in admins:
        await create_notification(
            str(admin["_id"]),
            f"🚨 EMERGENCY ALERT: {data.emergency_type} in {alert_doc['room_number']}",
            f"URGENT: {student['name']} triggered an emergency SOS from {alert_doc['room_number']}. Student Phone: {student.get('phone')}, Parent: {student.get('parent_contact')}.",
            notification_type="EMERGENCY"
        )
        
    return alert_doc

@router.put("/{id}/acknowledge")
async def acknowledge_emergency_alert(id: str, current_user: dict = Depends(require_admin)):
    """
    Administrative acknowledgement of an active emergency alert.
    Students strictly rejected with HTTP 403.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid alert ID.")
        
    alert = await db.emergency_alerts.find_one({"_id": obj_id})
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency alert not found.")
        
    await db.emergency_alerts.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "ACKNOWLEDGED",
            "acknowledged_by": current_user["email"],
            "acknowledged_at": datetime.utcnow()
        }}
    )
    
    await log_audit(
        current_user["email"],
        "EMERGENCY_ACKNOWLEDGED",
        "EMERGENCY",
        id,
        f"Warden acknowledged emergency SOS for {alert.get('student_name')} ({alert.get('room_number')})"
    )
    
    updated = await db.emergency_alerts.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.put("/{id}/resolve")
async def resolve_emergency_alert(id: str, data: EmergencyAlertResolve, current_user: dict = Depends(require_admin)):
    """
    Administrative resolution of an emergency alert.
    Students strictly rejected with HTTP 403.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid alert ID.")
        
    alert = await db.emergency_alerts.find_one({"_id": obj_id})
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency alert not found.")
        
    await db.emergency_alerts.update_one(
        {"_id": obj_id},
        {"$set": {
            "status": "RESOLVED",
            "resolution_notes": data.resolution_notes,
            "resolved_by": current_user["email"],
            "resolved_at": datetime.utcnow()
        }}
    )
    
    await log_audit(
        current_user["email"],
        "EMERGENCY_RESOLVED",
        "EMERGENCY",
        id,
        f"Resolved emergency alert for {alert.get('student_name')} ({alert.get('room_number')}): {data.resolution_notes}"
    )
    
    # Notify student
    student = await db.students.find_one({"student_id": alert["student_id"]})
    if student:
        u = await db.users.find_one({"email": student["email"]})
        if u:
            await create_notification(
                str(u["_id"]),
                "Emergency SOS Marked Resolved",
                f"Your emergency alert has been addressed and marked resolved by warden: {data.resolution_notes}",
                notification_type="INFO"
            )
            
    updated = await db.emergency_alerts.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.delete("/{id}")
async def delete_emergency_alert(id: str, current_user: dict = Depends(require_admin)):
    """
    Administrative deletion of an emergency alert record.
    Students strictly rejected with HTTP 403.
    """
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid alert ID.")
        
    alert = await db.emergency_alerts.find_one({"_id": obj_id})
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency alert not found.")
        
    await db.emergency_alerts.delete_one({"_id": obj_id})
    await log_audit(
        current_user["email"],
        "EMERGENCY_DELETED",
        "EMERGENCY",
        id,
        f"Deleted emergency record for {alert.get('student_name')} ({alert.get('room_number')})"
    )
    return {"detail": "Emergency alert deleted successfully."}

