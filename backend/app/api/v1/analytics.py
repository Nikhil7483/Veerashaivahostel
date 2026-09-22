from fastapi import APIRouter, Depends
from app.database.connection import get_database
from app.core.dependencies import require_admin
from datetime import datetime, timedelta

router = APIRouter(prefix="/analytics", tags=["Analytics & Problem Intelligence"])

@router.get("/overview")
async def get_overview_analytics(current_user: dict = Depends(require_admin)):
    db = get_database()
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    total_students = await db.students.count_documents({"status": "ACTIVE"})
    
    # 12 active rooms (Room 03 does not exist)
    rooms = await db.rooms.find({}).to_list(20)
    total_rooms = len(rooms)
    total_beds = sum(r.get("total_beds", 4) for r in rooms)
    occupied_beds = sum(r.get("occupied_beds", 0) for r in rooms)
    available_beds = max(0, total_beds - occupied_beds)
    occupancy_pct = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0
    occupied_rooms_count = sum(1 for r in rooms if r.get("occupied_beds", 0) > 0)
    
    # Attendance today
    present_today = await db.attendance.count_documents({"date": today_str, "status": "PRESENT"})
    absent_today = await db.attendance.count_documents({"date": today_str, "status": "ABSENT"})
    leave_today = await db.attendance.count_documents({"date": today_str, "status": "LEAVE"})
    
    # Complaints
    pending_complaints = await db.complaints.count_documents({"status": {"$in": ["PENDING", "ASSIGNED", "IN_PROGRESS"]}})
    
    # Check overdue complaints (created > 48h ago and not resolved)
    cutoff = datetime.utcnow() - timedelta(hours=48)
    overdue_complaints = await db.complaints.count_documents({
        "status": {"$in": ["PENDING", "ASSIGNED", "IN_PROGRESS"]},
        "created_at": {"$lt": cutoff}
    })
    
    # Pending items
    pending_leaves = await db.leave_applications.count_documents({"status": "PENDING"})
    pending_cleaning = await db.cleaning_requests.count_documents({"status": {"$in": ["REQUESTED", "PENDING", "IN_PROGRESS"]}})
    pending_maintenance = await db.maintenance_requests.count_documents({"status": {"$in": ["PENDING", "IN_PROGRESS"]}})
    active_emergencies = await db.emergency_alerts.count_documents({"status": "ACTIVE"})
    
    return {
        "total_students": total_students,
        "total_rooms": total_rooms,
        "occupied_rooms": occupied_rooms_count,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": available_beds,
        "occupancy_percentage": occupancy_pct,
        "attendance": {
            "present": present_today,
            "absent": absent_today,
            "on_leave": leave_today,
            "total_marked": present_today + absent_today + leave_today
        },
        "complaints": {
            "pending": pending_complaints,
            "overdue": overdue_complaints
        },
        "pending_leaves": pending_leaves,
        "pending_cleaning": pending_cleaning,
        "pending_maintenance": pending_maintenance,
        "active_emergencies": active_emergencies
    }

@router.get("/problems")
async def get_problem_analytics(current_user: dict = Depends(require_admin)):
    db = get_database()
    
    # Complaint categories aggregation
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cat_cursor = db.complaints.aggregate(pipeline)
    category_counts = []
    async for c in cat_cursor:
        category_counts.append({"category": c["_id"], "count": c["count"]})
        
    # Most problematic room aggregation
    room_pipeline = [
        {"$group": {"_id": "$room_number", "complaint_count": {"$sum": 1}}},
        {"$sort": {"complaint_count": -1}},
        {"$limit": 5}
    ]
    room_cursor = db.complaints.aggregate(room_pipeline)
    problematic_rooms = []
    async for r in room_cursor:
        problematic_rooms.append({"room_number": r["_id"], "count": r["complaint_count"]})
        
    # Average resolution time in hours
    resolved = await db.complaints.find({
        "status": "RESOLVED",
        "resolved_at": {"$ne": None},
        "created_at": {"$ne": None}
    }).to_list(100)
    
    avg_hours = 0
    if resolved:
        total_seconds = sum((r["resolved_at"] - r["created_at"]).total_seconds() for r in resolved if r.get("resolved_at") and r.get("created_at"))
        avg_hours = round(total_seconds / len(resolved) / 3600, 1)
        
    # Cleaning status breakdown
    cleaning_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    cleaning_cursor = db.cleaning_requests.aggregate(cleaning_pipeline)
    cleaning_stats = {}
    async for cl in cleaning_cursor:
        cleaning_stats[cl["_id"]] = cl["count"]
        
    # Facilities / Maintenance category breakdown
    maint_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    maint_cursor = db.maintenance_requests.aggregate(maint_pipeline)
    maint_counts = []
    async for m in maint_cursor:
        maint_counts.append({"category": m["_id"], "count": m["count"]})
        
    return {
        "complaint_categories": category_counts,
        "problematic_rooms": problematic_rooms,
        "most_common_problem": category_counts[0]["category"] if category_counts else "None",
        "most_problematic_room": problematic_rooms[0]["room_number"] if problematic_rooms else "None",
        "average_resolution_time_hours": avg_hours,
        "cleaning_status_breakdown": cleaning_stats,
        "maintenance_breakdown": maint_counts
    }
