import json
import logging
from pywebpush import webpush, WebPushException
from app.core.config import settings
from app.database.connection import get_database

logger = logging.getLogger(__name__)

async def send_web_push_to_user(user_id: str, title: str, message: str, link: str = "/"):
    """
    Sends a Web Push notification to all active devices/browsers subscribed for user_id.
    Deletes stale/expired endpoints automatically (HTTP 404/410).
    """
    try:
        db = get_database()
        subscriptions = await db.push_subscriptions.find({"user_id": str(user_id)}).to_list(100)
        if not subscriptions:
            return 0
        
        payload = json.dumps({
            "title": title,
            "message": message,
            "body": message,
            "link": link or "/",
            "timestamp": int(__import__('time').time() * 1000)
        })
        
        sent_count = 0
        stale_endpoints = []
        
        for sub in subscriptions:
            endpoint = sub.get("endpoint")
            keys = sub.get("keys", {})
            if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
                continue
                
            subscription_info = {
                "endpoint": endpoint,
                "keys": {
                    "p256dh": keys.get("p256dh"),
                    "auth": keys.get("auth")
                }
            }
            
            try:
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL}
                )
                sent_count += 1
            except WebPushException as ex:
                logger.warning(f"WebPush error for endpoint {endpoint[:40]}...: {ex}")
                if ex.response is not None and ex.response.status_code in [404, 410]:
                    stale_endpoints.append(endpoint)
            except Exception as e:
                logger.warning(f"Unexpected push delivery error: {e}")
                
        if stale_endpoints:
            await db.push_subscriptions.delete_many({"endpoint": {"$in": stale_endpoints}})
            
        return sent_count
    except Exception as e:
        logger.error(f"Error in send_web_push_to_user: {e}")
        return 0
