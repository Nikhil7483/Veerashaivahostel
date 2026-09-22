from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import require_admin, log_audit
from app.schemas.all_schemas import VisitorCreate, VisitorUpdate
from bson import ObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/visitors", tags=["Visitor Management"])

@router.get("")
async def list_visitors(
    student_name: Optional[str] = None,
    room_number: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if student_name:
        query["student_name"] = {"$regex": student_name, "$options": "i"}
    if room_number:
        query["room_number"] = room_number
        
    cursor = db.visitors.find(query).sort("created_at", -1)
    visitors = []
    async for v in cursor:
        v["id"] = str(v["_id"])
        del v["_id"]
        visitors.append(v)
    return visitors

@router.post("", status_code=status.HTTP_201_CREATED)
async def register_visitor(data: VisitorCreate, current_user: dict = Depends(require_admin)):
    db = get_database()
    doc = data.model_dump()
    doc["created_at"] = datetime.utcnow()
    doc["logged_by"] = current_user["email"]
    
    res = await db.visitors.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    
    await log_audit(current_user["email"], "VISITOR_CHECKIN", "VISITORS", str(res.inserted_id), f"{data.visitor_name} visited {data.student_name} ({data.room_number})")
    return doc

@router.put("/{id}/checkout")
async def checkout_visitor(id: str, data: VisitorUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid visitor ID.")
        
    v = await db.visitors.find_one({"_id": obj_id})
    if not v:
        raise HTTPException(status_code=404, detail="Visitor record not found.")
        
    await db.visitors.update_one(
        {"_id": obj_id},
        {"$set": {"exit_time": data.exit_time, "remarks": data.remarks or "", "updated_at": datetime.utcnow()}}
    )
    
    await log_audit(current_user["email"], "VISITOR_CHECKOUT", "VISITORS", id, f"{v.get('visitor_name')} checked out at {data.exit_time}")
    
    updated = await db.visitors.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated
