from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit, create_notification
from app.schemas.all_schemas import ComplaintCreate, ComplaintUpdate, ComplaintEscalate
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter(prefix="/complaints", tags=["Complaints & Tickets"])

from pymongo import ReturnDocument

async def generate_ticket_id() -> str:
    db = get_database()
    counter = await db.counters.find_one({"_id": "complaint_ticket"})
    if not counter:
        latest = await db.complaints.find().sort("created_at", -1).limit(1).to_list(1)
        base = 1000
        if latest and "ticket_id" in latest[0]:
            try:
                base = max(base, int(latest[0]["ticket_id"].replace("HTL-", "")))
            except Exception:
                pass
        await db.counters.update_one(
            {"_id": "complaint_ticket"},
            {"$setOnInsert": {"seq": base}},
            upsert=True
        )

    res = await db.counters.find_one_and_update(
        {"_id": "complaint_ticket"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"HTL-{res['seq']}"

@router.get("")
async def list_complaints(
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    room_number: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {}
    
    # If student, restrict to their own complaints
    if current_user.get("role") == "STUDENT":
        student = await db.students.find_one({"email": current_user["email"]})
        if not student:
            return []
        query["student_id"] = student["student_id"]
    else:
        if category:
            query["category"] = category
        if room_number:
            query["room_number"] = room_number
            
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
        
    cursor = db.complaints.find(query).sort("created_at", -1)
    results = []
    now = datetime.utcnow()
    
    async for c in cursor:
        c["id"] = str(c["_id"])
        del c["_id"]
        # Check overdue status (unresolved for > 48 hours, or urgent > 24 hours)
        created_at = c.get("created_at")
        threshold_hours = 24 if c.get("priority") == "URGENT" else 48
        c["overdue"] = False
        if c.get("status") not in ["RESOLVED", "REJECTED"] and created_at:
            if now - created_at > timedelta(hours=threshold_hours):
                c["overdue"] = True
                
        if is_overdue is not None and c["overdue"] != is_overdue:
            continue
            
        results.append(c)
    return results

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_complaint(data: ComplaintCreate, current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    ticket_id = await generate_ticket_id()
    
    doc = {
        "ticket_id": ticket_id,
        "student_id": student["student_id"],
        "student_name": student["name"],
        "usn": student.get("usn"),
        "phone": student.get("phone"),
        "room_number": data.room_number,
        "category": data.category,
        "description": data.description,
        "priority": data.priority,
        "status": "PENDING",
        "assigned_staff": "Unassigned",
        "admin_remarks": "",
        "escalation_level": "LEVEL_1",  # LEVEL_1 (Staff), LEVEL_2 (Warden), LEVEL_3 (Management)
        "escalation_reason": "",
        "created_at": datetime.utcnow(),
        "resolved_at": None
    }
    
    res = await db.complaints.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    
    # Notify Admin
    admin = await db.users.find_one({"role": "ADMIN"})
    if admin:
        await create_notification(
            str(admin["_id"]),
            f"New Complaint: {ticket_id}",
            f"{student['name']} submitted a {data.category} complaint for {data.room_number} (Priority: {data.priority})."
        )
        
    return doc

@router.put("/{id}")
async def update_complaint(id: str, data: ComplaintUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid complaint ID.")
        
    c = await db.complaints.find_one({"_id": obj_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")
        
    u_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    u_dict["updated_at"] = datetime.utcnow()
    
    if data.status == "RESOLVED":
        u_dict["resolved_at"] = datetime.utcnow()
        
    await db.complaints.update_one({"_id": obj_id}, {"$set": u_dict})
    
    # Notify student
    student = await db.students.find_one({"student_id": c["student_id"]})
    if student:
        user_student = await db.users.find_one({"email": student["email"]})
        if user_student:
            status_text = data.status or "updated"
            await create_notification(
                str(user_student["_id"]),
                f"Complaint Ticket {c['ticket_id']} Updated",
                f"Your complaint ticket {c['ticket_id']} status is now: {status_text}."
            )
            
    await log_audit(current_user["email"], "COMPLAINT_UPDATED", "COMPLAINTS", c["ticket_id"], f"Status: {data.status}, Staff: {data.assigned_staff}")
    
    updated = await db.complaints.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.post("/{id}/escalate")
async def escalate_complaint(id: str, data: ComplaintEscalate, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid complaint ID.")
        
    c = await db.complaints.find_one({"_id": obj_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint ticket not found.")
        
    new_level = "LEVEL_2_WARDEN" if data.escalated_to == "WARDEN" else "LEVEL_3_MANAGEMENT"
    
    await db.complaints.update_one(
        {"_id": obj_id},
        {"$set": {
            "escalation_level": new_level,
            "escalation_reason": data.reason,
            "priority": "URGENT",
            "escalated_at": datetime.utcnow()
        }}
    )
    
    await log_audit(
        current_user["email"],
        "COMPLAINT_ESCALATED",
        "COMPLAINTS",
        c["ticket_id"],
        f"Escalated to {data.escalated_to}: {data.reason}"
    )
    
    # Broadcast alert notification
    admin = await db.users.find_one({"role": "ADMIN"})
    if admin:
        await create_notification(
            str(admin["_id"]),
            f"🚨 Ticket Escalated: {c['ticket_id']}",
            f"Ticket {c['ticket_id']} ({c['category']}) has been escalated to {data.escalated_to}. Reason: {data.reason}",
            notification_type="WARNING"
        )
        
    updated = await db.complaints.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated
