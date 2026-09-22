from fastapi import APIRouter, Depends, HTTPException
from app.database.connection import get_database
from app.core.dependencies import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("")
async def get_my_notifications(current_user: dict = Depends(get_current_user)):
    db = get_database()
    cursor = db.notifications.find({"user_id": current_user["id"]}).sort("created_at", -1).limit(40)
    notifications = []
    async for n in cursor:
        n["id"] = str(n["_id"])
        del n["_id"]
        notifications.append(n)
    return notifications

@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    db = get_database()
    count = await db.notifications.count_documents({"user_id": current_user["id"], "is_read": False})
    return {"unread_count": count}

@router.put("/{id}/read")
async def mark_as_read(id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID.")
        
    await db.notifications.update_one(
        {"_id": obj_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read."}

@router.put("/mark-all-read")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    db = get_database()
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read."}
