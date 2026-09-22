from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_token
from app.database.connection import get_database
from bson import ObjectId
from datetime import datetime

security_scheme = HTTPBearer(auto_error=True)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload.get("sub")
    role = payload.get("role")
    user_id = payload.get("id")
    
    if not email or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    db = get_database()
    user = None
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        pass
        
    if not user:
        user = await db.users.find_one({"email": email})
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact hostel administrator.",
        )
        
    # Serialize _id to str
    user["id"] = str(user["_id"])
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privilege required to perform this action.",
        )
    return current_user

async def require_student(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student privilege required to access this resource.",
        )
    return current_user

async def require_cleaning_team(current_user: dict = Depends(get_current_user)):
    # Cleaning team members are normal students assigned cleaning duties or admin
    return current_user

async def require_cleaning_or_admin(current_user: dict = Depends(get_current_user)):
    return current_user

async def log_audit(admin_email: str, action: str, module: str, record_id: str, details: str = ""):
    try:
        db = get_database()
        await db.audit_logs.insert_one({
            "admin_email": admin_email,
            "action": action,
            "module": module,
            "record_id": str(record_id),
            "details": details,
            "timestamp": datetime.utcnow()
        })
    except Exception as e:
        print(f"Error writing audit log: {e}")

async def create_notification(user_id: str, title: str, message: str, notification_type: str = "INFO", link: str = ""):
    try:
        db = get_database()
        await db.notifications.insert_one({
            "user_id": str(user_id),
            "title": title,
            "message": message,
            "type": notification_type,
            "is_read": False,
            "link": link,
            "created_at": datetime.utcnow()
        })
    except Exception as e:
        print(f"Error creating notification: {e}")
