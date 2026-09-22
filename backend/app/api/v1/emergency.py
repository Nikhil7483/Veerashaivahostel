from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit, create_notification
from app.core.limiter import limiter
from app.schemas.all_schemas import EmergencyAlertCreate, EmergencyAlertResolve
from bson import ObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/emergency", tags=["Emergency SOS"])

@router.get("")
async def list_emergency_alerts(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
        
    cursor = db.emergency_alerts.find(query).sort("created_at", -1)
    alerts = []
    async for a in cursor:
        a["id"] = str(a["_id"])
        del a["_id"]
        alerts.append(a)
    return alerts

@router.post("/trigger", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def trigger_emergency_sos(request: Request, data: EmergencyAlertCreate, current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    alert_doc = {
        "student_id": student["student_id"],
        "student_name": student["name"],
        "usn": student.get("usn"),
        "phone": student.get("phone"),
        "parent_contact": student.get("parent_contact"),
        "room_number": data.room_number or student.get("room_number"),
        "emergency_type": data.emergency_type,
        "description": data.description or "Emergency SOS Triggered from Student App",
        "status": "ACTIVE",  # ACTIVE, RESOLVED
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
            f"URGENT: {student['name']} triggered an emergency SOS from Room {alert_doc['room_number']}. Student Phone: {student.get('phone')}, Parent: {student.get('parent_contact')}.",
            notification_type="EMERGENCY"
        )
        
    return alert_doc

@router.put("/{id}/resolve")
async def resolve_emergency_alert(id: str, data: EmergencyAlertResolve, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert ID.")
        
    alert = await db.emergency_alerts.find_one({"_id": obj_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Emergency alert not found.")
        
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
    
    # Notify the student that help arrived / resolved
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
