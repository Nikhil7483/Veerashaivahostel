from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit, create_notification
from app.schemas.all_schemas import MaintenanceCreate, MaintenanceUpdate
from bson import ObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/maintenance", tags=["Maintenance & Facilities"])

@router.get("")
async def list_maintenance_requests(
    category: Optional[str] = None,
    status: Optional[str] = None,
    room_number: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {}
    
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
        
    cursor = db.maintenance_requests.find(query).sort("created_at", -1)
    results = []
    async for m in cursor:
        m["id"] = str(m["_id"])
        del m["_id"]
        results.append(m)
    return results

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_maintenance(data: MaintenanceCreate, current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    doc = {
        "student_id": student["student_id"],
        "student_name": student["name"],
        "room_number": data.room_number,
        "category": data.category,
        "description": data.description,
        "priority": data.priority,
        "status": "PENDING",
        "assigned_staff": "Unassigned",
        "remarks": "",
        "created_at": datetime.utcnow(),
        "resolved_at": None
    }
    
    res = await db.maintenance_requests.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    
    admin = await db.users.find_one({"role": "ADMIN"})
    if admin:
        await create_notification(
            str(admin["_id"]),
            f"Maintenance Issue Reported ({data.category})",
            f"{student['name']} reported a maintenance problem in Room {data.room_number}: {data.category}"
        )
        
    return doc

@router.put("/{id}")
async def update_maintenance(id: str, data: MaintenanceUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID.")
        
    m = await db.maintenance_requests.find_one({"_id": obj_id})
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance request not found.")
        
    u_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    u_dict["updated_at"] = datetime.utcnow()
    if data.status == "RESOLVED":
        u_dict["resolved_at"] = datetime.utcnow()
        
    await db.maintenance_requests.update_one({"_id": obj_id}, {"$set": u_dict})
    
    # Notify student
    student = await db.students.find_one({"student_id": m["student_id"]})
    if student:
        u = await db.users.find_one({"email": student["email"]})
        if u:
            await create_notification(
                str(u["_id"]),
                "Maintenance Update",
                f"Maintenance for {m['category']} in Room {m['room_number']} is now: {data.status or 'updated'}."
            )
            
    await log_audit(current_user["email"], "MAINTENANCE_UPDATED", "MAINTENANCE", id, f"Status: {data.status}")
    
    updated = await db.maintenance_requests.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated
