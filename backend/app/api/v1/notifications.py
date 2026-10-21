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

from pydantic import BaseModel
from datetime import datetime

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    from app.core.config import settings
    return {"public_key": settings.VAPID_PUBLIC_KEY}

@router.post("/subscribe")
async def subscribe_push_notifications(
    data: PushSubscriptionRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    sub_doc = {
        "user_id": str(current_user["id"]),
        "endpoint": data.endpoint,
        "keys": {
            "p256dh": data.keys.p256dh,
            "auth": data.keys.auth
        },
        "updated_at": now
    }
    
    await db.push_subscriptions.update_one(
        {"endpoint": data.endpoint},
        {"$set": sub_doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    return {"message": "Push notification subscription activated successfully."}

@router.post("/unsubscribe")
async def unsubscribe_push_notifications(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    endpoint = data.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": str(current_user["id"])})
    return {"message": "Push subscription removed."}

@router.post("/test-push")
async def test_push_notification(current_user: dict = Depends(get_current_user)):
    from app.services.push_service import send_web_push_to_user
    sent = await send_web_push_to_user(
        user_id=str(current_user["id"]),
        title="Veerashaiva Hostel ❤️ Test Alert",
        message="🎉 Web push notifications are working on your phone screen! You will receive daily duty, meal count, and leave updates right here.",
        link="/student/dashboard"
    )
    if sent == 0:
        return {
            "status": "warning",
            "message": "No active phone push subscription found for your account. Please enable push notifications on your device first."
        }
    return {
        "status": "success",
        "message": f"Test push alert sent to {sent} active device(s)! Check your phone screen."
    }
