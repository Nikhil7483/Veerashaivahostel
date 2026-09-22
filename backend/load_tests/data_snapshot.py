import asyncio
from pymongo import MongoClient
import json

def get_db_snapshot():
    client = MongoClient("mongodb://localhost:27017")
    db = client["smart_hostel"]
    
    collections = [
        "users", "students", "rooms", "attendance", "leave_applications",
        "cleaning_requests", "complaints", "maintenance_requests",
        "mess_menu", "mess_feedback", "announcements", "notifications",
        "visitors", "lost_found", "emergency_alerts", "audit_logs",
        "meal_counts", "food_allocations", "food_assignments"
    ]
    
    snapshot = {}
    for col in collections:
        count = db[col].count_documents({})
        snapshot[col] = count
        
    # Check student integrity
    active_students = db.students.count_documents({"status": "ACTIVE"})
    duplicate_emails = list(db.users.aggregate([
        {"$group": {"_id": "$email", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]))
    duplicate_student_ids = list(db.students.aggregate([
        {"$group": {"_id": "$student_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]))
    duplicate_attendance = list(db.attendance.aggregate([
        {"$group": {"_id": {"student_id": "$student_id", "date": "$date"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]))
    
    snapshot["integrity"] = {
        "active_students": active_students,
        "duplicate_emails": len(duplicate_emails),
        "duplicate_student_ids": len(duplicate_student_ids),
        "duplicate_attendance_keys": len(duplicate_attendance),
    }
    
    client.close()
    return snapshot

if __name__ == "__main__":
    snap = get_db_snapshot()
    print(json.dumps(snap, indent=2))
