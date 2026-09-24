from fastapi import APIRouter, Depends, HTTPException, status, Request
import asyncio
import re
from app.database.connection import get_database
from app.core.security import verify_password, hash_password, create_access_token
from app.core.dependencies import get_current_user, require_admin, log_audit
from app.core.limiter import limiter
from app.schemas.all_schemas import LoginRequest, TokenResponse, ChangePasswordRequest, AdminProfileUpdate
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("120/minute")
async def login(request: Request, login_data: LoginRequest):
    db = get_database()
    raw_user = login_data.username.strip()
    clean_user = raw_user.lower()
    
    # 1. Check for admin aliases
    if clean_user in ["admin", "warden", "administrator", "admin@hostel.edu", "admin@smarthostel.com"]:
        user = await db.users.find_one({"email": "admin@smarthostel.com"})
    else:
        # Try direct indexed lookups first (fast O(1) B-tree lookup)
        user = await db.users.find_one({"email": clean_user})
        if not user and raw_user != clean_user:
            user = await db.users.find_one({"email": raw_user})
        if not user:
            user = await db.users.find_one({"email": {"$regex": f"^{re.escape(raw_user)}$", "$options": "i"}})
    
    # 2. If not found, check student ID, USN, name, or phone
    if not user:
        # Try exact indexed match first
        student_queries = [
            {"student_id": raw_user},
            {"student_id": raw_user.upper()},
            {"usn": raw_user.upper()},
            {"usn": raw_user},
            {"phone": raw_user}
        ]
        if raw_user.isdigit():
            padded = raw_user.zfill(3)
            student_queries.extend([
                {"student_id": padded},
                {"usn": padded}
            ])
        student = await db.students.find_one({"$or": student_queries})
        
        # If not found by exact, fallback to regex search
        if not student:
            regex_queries = [
                {"student_id": {"$regex": f"^{re.escape(raw_user)}$", "$options": "i"}},
                {"usn": {"$regex": f"^{re.escape(raw_user)}$", "$options": "i"}},
                {"name": {"$regex": f"^{re.escape(raw_user)}$", "$options": "i"}},
                {"phone": raw_user}
            ]
            student = await db.students.find_one({"$or": regex_queries})
            
        if student:
            user = await db.users.find_one({"email": student["email"]})
            
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login credentials. Please check your email/ID and password."
        )

    # 3. Verify password with fallback for common casing variations (e.g. Admin@123 vs admin@123)
    is_valid = await asyncio.to_thread(verify_password, login_data.password, user.get("password_hash", ""))
    if not is_valid:
        variations = [
            login_data.password.capitalize(),
            login_data.password.lower(),
            login_data.password.upper()
        ]
        for var in variations:
            if var != login_data.password and await asyncio.to_thread(verify_password, var, user.get("password_hash", "")):
                is_valid = True
                break

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login credentials. Please check your email/ID and password."
        )
        
    if user.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is deactivated. Please contact the hostel warden."
        )
        
    # Get associated student profile if student
    student_profile = None
    if user.get("role") == "STUDENT":
        student_profile = await db.students.find_one({"email": user["email"]})
        if student_profile:
            student_profile["id"] = str(student_profile["_id"])
            del student_profile["_id"]

    token_data = {
        "sub": user["email"],
        "role": user["role"],
        "id": str(user["_id"])
    }
    access_token = create_access_token(token_data)
    
    default_name = "Hostel Administrator"
    if user.get("role") == "ADMIN":
        default_name = "Hostel Warden"

    user_info = {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "name": student_profile.get("name") if student_profile else user.get("name", default_name),
        "student_profile": student_profile
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_database()
    student_profile = None
    if current_user.get("role") == "STUDENT":
        student_profile = await db.students.find_one({"email": current_user["email"]})
        if student_profile:
            student_profile["id"] = str(student_profile["_id"])
            del student_profile["_id"]
            
    default_name = "Hostel Administrator"
    default_designation = "Chief Hostel Warden"
    if current_user.get("role") == "ADMIN":
        default_name = "Hostel Warden"
        default_designation = "Chief Hostel Warden"

    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "role": current_user["role"],
        "name": student_profile.get("name") if student_profile else current_user.get("name", default_name),
        "phone": current_user.get("phone", ""),
        "designation": current_user.get("designation", default_designation),
        "office": current_user.get("office", "Warden Office, Block A"),
        "student_profile": student_profile
    }

@router.post("/change-password")
async def change_password(data: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    db = get_database()
    if not verify_password(data.old_password, current_user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password does not match.")
        
    new_hash = hash_password(data.new_password)
    from bson import ObjectId
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )
    
    await log_audit(current_user["email"], "PASSWORD_CHANGED", "AUTH", current_user["id"])
    return {"message": "Password changed successfully."}

@router.get("/admin/profile")
async def get_admin_profile(current_user: dict = Depends(require_admin)):
    db = get_database()
    user = await db.users.find_one({"email": current_user["email"]})
    if not user:
        raise HTTPException(status_code=404, detail="Admin user not found.")
        
    return {
        "id": str(user["_id"]),
        "email": user.get("email"),
        "name": user.get("name", "Hostel Administrator"),
        "phone": user.get("phone", "+91 98800 12345"),
        "designation": user.get("designation", "Chief Hostel Warden"),
        "office": user.get("office", "Warden Office, Ground Floor Block A"),
        "role": user.get("role", "ADMIN"),
        "created_at": user.get("created_at")
    }

@router.put("/admin/profile")
async def update_admin_profile(data: AdminProfileUpdate, current_user: dict = Depends(require_admin)):
    db = get_database()
    update_doc = {"updated_at": datetime.utcnow()}
    
    if data.name is not None:
        update_doc["name"] = data.name.strip()
    if data.phone is not None:
        update_doc["phone"] = data.phone.strip()
    if data.designation is not None:
        update_doc["designation"] = data.designation.strip()
    if data.office is not None:
        update_doc["office"] = data.office.strip()
    if data.email is not None and data.email != current_user["email"]:
        exist = await db.users.find_one({"email": data.email})
        if exist:
            raise HTTPException(status_code=400, detail="Email already taken by another account.")
        update_doc["email"] = data.email
    if data.new_password and data.new_password.strip():
        update_doc["password_hash"] = hash_password(data.new_password.strip())
        
    await db.users.update_one({"email": current_user["email"]}, {"$set": update_doc})
    
    target_email = update_doc.get("email", current_user["email"])
    updated_user = await db.users.find_one({"email": target_email})
    await log_audit(current_user["email"], "ADMIN_PROFILE_UPDATED", "AUTH", str(updated_user["_id"]))
    
    return {
        "message": "Admin profile updated successfully.",
        "admin": {
            "id": str(updated_user["_id"]),
            "email": updated_user.get("email"),
            "name": updated_user.get("name", "Hostel Administrator"),
            "phone": updated_user.get("phone", ""),
            "designation": updated_user.get("designation", "Chief Hostel Warden"),
            "office": updated_user.get("office", "Warden Office, Ground Floor Block A"),
            "role": updated_user.get("role")
        }
    }
