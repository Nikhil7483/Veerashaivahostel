import os
import re
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from bson import ObjectId

from app.core.config import settings
from app.core.security import decode_token
from app.database.connection import get_database

router = APIRouter(tags=["File Storage & Uploads"])

# Allowed extensions and their expected magic bytes signatures
ALLOWED_FILE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
FILE_SIGNATURES = {
    ".pdf": [b"%PDF-"],
    ".jpg": [b"\xFF\xD8\xFF"],
    ".jpeg": [b"\xFF\xD8\xFF"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
}

def verify_file_signature(content: bytes, ext: str) -> bool:
    """
    Validates file content magic bytes against permitted document formats.
    NOTE: Real-time antivirus/malware scanning (e.g. ClamAV) is not active in this environment;
    strict content-signature, size limits, extension whitelisting, and isolated storage are enforced.
    """
    ext_lower = ext.lower()
    if ext_lower not in FILE_SIGNATURES:
        return False
    signatures = FILE_SIGNATURES[ext_lower]
    return any(content.startswith(sig) for sig in signatures)

async def authenticate_download_request(request: Request, token_query: Optional[str] = None) -> dict:
    """
    Extracts and validates JWT credentials from Authorization header or ?token= query parameter
    to support both direct programmatic API downloads and browser open links.
    """
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
    elif token_query:
        token = token_query.strip()
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access documents.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired document access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    db = get_database()
    user_id = payload.get("id")
    email = payload.get("sub")
    
    user = None
    if user_id:
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    if not user and email:
        user = await db.users.find_one({"email": email})
        
    if not user or user.get("status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authorized or account is inactive.",
        )
        
    # Check token version
    if payload.get("token_version", 1) != user.get("token_version", 1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
        )
        
    user["id"] = str(user["_id"])
    return user

async def authorize_document_access(user: dict, filename: str) -> bool:
    """
    Object-level authorization:
    - Admins/Wardens can access all hostel documents.
    - Students can only access documents belonging to their own records.
    """
    if user.get("role") == "ADMIN":
        return True
        
    db = get_database()
    student = await db.students.find_one({"email": user.get("email")})
    if not student:
        return False
        
    student_id = student.get("student_id")
    
    # 1. Check leave applications
    leave = await db.leave_applications.find_one({
        "student_id": student_id,
        "document_url": {"$regex": f"{re.escape(filename)}$"}
    })
    if leave:
        return True
        
    # 2. Check complaints
    complaint = await db.complaints.find_one({
        "student_id": student_id,
        "attachment_url": {"$regex": f"{re.escape(filename)}$"}
    })
    if complaint:
        return True

    return False

@router.get("/uploads/{filename}")
@router.get("/api/v1/uploads/{filename}")
async def get_uploaded_file(
    filename: str,
    request: Request,
    token: Optional[str] = Query(None, description="Optional access token for browser viewing")
):
    """
    Secure file serving endpoint with authentication and object-level permission enforcement.
    Replaces vulnerable public static file access.
    """
    # 1. Sanitize filename & defend against path traversal
    safe_filename = os.path.basename(filename)
    if safe_filename != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename format.")
        
    upload_dir = Path(settings.UPLOAD_DIRECTORY).resolve()
    target_path = (upload_dir / safe_filename).resolve()
    
    # Ensure resolved path is strictly inside upload_dir
    try:
        target_path.relative_to(upload_dir)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path traversal attempt blocked.")
        
    # 2. Authenticate the caller
    user = await authenticate_download_request(request, token_query=token)
    
    # 3. Check if file exists on disk
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requested file was not found.")
        
    # 4. Authorize object-level permission
    has_permission = await authorize_document_access(user, safe_filename)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this document."
        )
        
    # 5. Determine media type and serve
    ext = target_path.suffix.lower()
    media_types = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }
    content_type = media_types.get(ext, "application/octet-stream")
    
    return FileResponse(
        path=str(target_path),
        media_type=content_type,
        filename=safe_filename,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'inline; filename="{safe_filename}"'
        }
    )
