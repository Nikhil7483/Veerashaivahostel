from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, log_audit, create_notification
from app.schemas.all_schemas import AnnouncementCreate
from bson import ObjectId
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/announcements", tags=["Announcements"])

@router.get("")
async def list_announcements(
    priority: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {}
    if priority:
        query["priority"] = priority
        
    cursor = db.announcements.find(query).sort("created_at", -1)
    announcements = []
    async for a in cursor:
        a["id"] = str(a["_id"])
        del a["_id"]
        announcements.append(a)
    return announcements

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_announcement(data: AnnouncementCreate, current_user: dict = Depends(require_admin)):
    db = get_database()
    doc = data.model_dump()
    doc["author"] = current_user["email"]
    doc["created_at"] = datetime.utcnow()
    
    res = await db.announcements.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    
    # Broadcast notification to all active students
    students = db.students.find({"status": "ACTIVE"})
    async for s in students:
        u = await db.users.find_one({"email": s["email"]})
        if u:
            await create_notification(
                str(u["_id"]),
                f"Announcement: {data.title}",
                f"[{data.priority}] {data.description[:100]}...",
                notification_type="ANNOUNCEMENT"
            )
            
    await log_audit(current_user["email"], "ANNOUNCEMENT_POSTED", "ANNOUNCEMENTS", str(res.inserted_id), data.title)
    return doc

@router.delete("/{id}")
async def delete_announcement(id: str, current_user: dict = Depends(require_admin)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid announcement ID.")
        
    res = await db.announcements.delete_one({"_id": obj_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found.")
        
    await log_audit(current_user["email"], "ANNOUNCEMENT_DELETED", "ANNOUNCEMENTS", id)
    return {"message": "Announcement deleted successfully."}
