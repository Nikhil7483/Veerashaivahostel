from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, log_audit
from app.schemas.all_schemas import LostFoundCreate, LostFoundUpdate, LostFoundEdit
from bson import ObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/lost-found", tags=["Lost & Found"])

@router.get("")
async def list_lost_found(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
        
    cursor = db.lost_found.find(query).sort("created_at", -1)
    items = []
    async for item in cursor:
        item["id"] = str(item["_id"])
        del item["_id"]
        items.append(item)
    return items

@router.post("", status_code=status.HTTP_201_CREATED)
async def report_lost_found(data: LostFoundCreate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    doc = data.model_dump()
    doc["reported_by"] = current_user["email"]
    doc["created_at"] = datetime.utcnow()
    doc["return_notes"] = ""
    
    res = await db.lost_found.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc

@router.put("/{id}/status")
async def update_lost_found_status(id: str, data: LostFoundUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item ID.")
        
    item = await db.lost_found.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
        
    await db.lost_found.update_one(
        {"_id": obj_id},
        {"$set": {"status": data.status, "return_notes": data.return_notes or "", "updated_at": datetime.utcnow()}}
    )
    
    await log_audit(current_user["email"], "LOST_FOUND_STATUS", "LOST_FOUND", id, f"Item {item.get('item_name')} marked {data.status}")
    
    updated = await db.lost_found.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.put("/{id}")
async def edit_lost_found(id: str, data: LostFoundEdit, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item ID.")
        
    item = await db.lost_found.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
        
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.lost_found.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    await log_audit(current_user["email"], "LOST_FOUND_EDIT", "LOST_FOUND", id, f"Edited item {item.get('item_name')}")
    
    updated = await db.lost_found.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@router.delete("/{id}")
async def delete_lost_found(id: str, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item ID.")
        
    item = await db.lost_found.find_one({"_id": obj_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
        
    await db.lost_found.delete_one({"_id": obj_id})
    await log_audit(current_user["email"], "LOST_FOUND_DELETE", "LOST_FOUND", id, f"Deleted item {item.get('item_name')}")
    return {"message": "Item deleted successfully.", "id": id}
