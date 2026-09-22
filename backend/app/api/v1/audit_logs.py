from fastapi import APIRouter, Depends
from app.database.connection import get_database
from app.core.dependencies import require_admin
from typing import Optional

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("")
async def list_audit_logs(
    module: Optional[str] = None,
    action: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if module:
        query["module"] = module
    if action:
        query["action"] = action
        
    cursor = db.audit_logs.find(query).sort("timestamp", -1).limit(100)
    logs = []
    async for l in cursor:
        l["id"] = str(l["_id"])
        del l["_id"]
        logs.append(l)
    return logs
