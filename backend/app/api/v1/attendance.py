from fastapi import APIRouter, Depends, HTTPException
from app.database.connection import get_database
from app.core.dependencies import require_admin, require_student, log_audit
from app.schemas.all_schemas import AttendanceBatchCreate
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.get("")
async def get_attendance(
    date: Optional[str] = None,
    room_number: Optional[str] = None,
    student_id: Optional[str] = None,
    month: Optional[str] = None,  # YYYY-MM
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if date:
        query["date"] = date
    elif month:
        query["date"] = {"$regex": f"^{month}"}
    if room_number:
        query["room_number"] = room_number
    if student_id:
        query["student_id"] = student_id
        
    cursor = db.attendance.find(query).sort("date", -1)
    results = []
    async for a in cursor:
        a["id"] = str(a["_id"])
        del a["_id"]
        results.append(a)
    return results

@router.post("/batch")
async def batch_mark_attendance(data: AttendanceBatchCreate, current_user: dict = Depends(require_admin)):
    db = get_database()
    date_str = data.date
    inserted_count = 0
    updated_count = 0
    
    for item in data.records:
        student = await db.students.find_one({"student_id": item.student_id})
        if not student:
            continue
            
        doc = {
            "student_id": item.student_id,
            "student_name": student.get("name"),
            "usn": student.get("usn"),
            "room_number": student.get("room_number"),
            "date": date_str,
            "status": item.status,
            "remarks": item.remarks or "",
            "marked_by": current_user["email"],
            "updated_at": datetime.utcnow()
        }
        
        # Upsert by compound key (student_id + date)
        result = await db.attendance.update_one(
            {"student_id": item.student_id, "date": date_str},
            {"$set": doc},
            upsert=True
        )
        if result.upserted_id:
            inserted_count += 1
        else:
            updated_count += 1
            
    # Calculate final submitted counts
    total_active = await db.students.count_documents({"status": "ACTIVE"})
    final_present = await db.attendance.count_documents({"date": date_str, "status": "PRESENT"})
    final_absent = max(0, total_active - final_present)

    await log_audit(
        current_user["email"],
        "ATTENDANCE_MARKED",
        "ATTENDANCE",
        date_str,
        f"Marked final attendance for {len(data.records)} students: Total={total_active}, Present={final_present}, Absent={final_absent}"
    )
    return {
        "message": f"Final attendance for {date_str} submitted successfully.",
        "date": date_str,
        "total": total_active,
        "present": final_present,
        "absent": final_absent,
        "inserted": inserted_count,
        "updated": updated_count
    }

@router.get("/my/records")
async def get_my_attendance(
    month: Optional[str] = None,
    current_user: dict = Depends(require_student)
):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
        
    student_id = student.get("student_id")
    query = {"student_id": student_id}
    if month:
        query["date"] = {"$regex": f"^{month}"}
        
    cursor = db.attendance.find(query).sort("date", -1)
    records = []
    present_days = 0
    absent_days = 0
    leave_days = 0
    
    async for a in cursor:
        a["id"] = str(a["_id"])
        del a["_id"]
        records.append(a)
        if a["status"] == "PRESENT":
            present_days += 1
        elif a["status"] == "ABSENT":
            absent_days += 1
        elif a["status"] == "LEAVE":
            leave_days += 1
            
    total_days = len(records)
    percentage = round((present_days / total_days * 100), 1) if total_days > 0 else 100.0
    
    return {
        "student_id": student_id,
        "total_days": total_days,
        "present_days": present_days,
        "absent_days": absent_days,
        "leave_days": leave_days,
        "percentage": percentage,
        "records": records
    }

@router.get("/summary/today")
async def get_today_attendance_summary(date: Optional[str] = None, current_user: dict = Depends(require_admin)):
    db = get_database()
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    
    total_active_students = await db.students.count_documents({"status": "ACTIVE"})
    present = await db.attendance.count_documents({"date": target_date, "status": "PRESENT"})
    on_leave = await db.attendance.count_documents({"date": target_date, "status": "LEAVE"})
    absent = max(0, total_active_students - present)
    
    return {
        "date": target_date,
        "total_students": total_active_students,
        "present": present,
        "absent": absent,
        "on_leave": on_leave,
        "unmarked": 0
    }

@router.get("/daily-report")
async def get_daily_attendance_report(date: Optional[str] = None, current_user: dict = Depends(require_admin)):
    """
    Comprehensive everyday attendance report broken down room-by-room (Rooms 01 to 13).
    Lists total, present, absent, and leave residents with room summary metrics.
    """
    db = get_database()
    target_date = date or datetime.now().strftime("%Y-%m-%d")
    
    rooms = await db.rooms.find({}).sort("room_number", 1).to_list(None)
    all_students = await db.students.find({"status": "ACTIVE"}).to_list(None)
    attendance_records = await db.attendance.find({"date": target_date}).to_list(None)
    
    att_map = {a["student_id"]: a for a in attendance_records}
    
    report_rooms = []
    total_present = 0
    total_absent = 0
    total_leave = 0
    
    for r in rooms:
        r_no = r["room_number"]
        r_students = [s for s in all_students if s.get("room_number") == r_no]
        
        present_list = []
        absent_list = []
        leave_list = []
        
        for s in r_students:
            sid = s["student_id"]
            rec = att_map.get(sid)
            st = rec.get("status") if rec else "UNMARKED"
            info = {
                "student_id": sid,
                "name": s.get("name"),
                "usn": s.get("usn"),
                "bed_number": s.get("bed_number"),
                "department": s.get("department"),
                "phone": s.get("phone"),
                "status": st,
                "remarks": rec.get("remarks") if rec else ""
            }
            if st == "PRESENT":
                present_list.append(info)
                total_present += 1
            elif st == "LEAVE":
                leave_list.append(info)
                total_leave += 1
            else:
                absent_list.append(info)
                total_absent += 1
                
        is_vacant = (len(r_students) == 0)
        report_rooms.append({
            "room_number": r_no,
            "total_beds": r.get("total_beds", 6),
            "occupied_beds": len(r_students),
            "is_vacant": is_vacant,
            "present_count": len(present_list),
            "absent_count": len(absent_list),
            "leave_count": len(leave_list),
            "unmarked_count": 0,
            "present_students": present_list,
            "absent_students": absent_list,
            "leave_students": leave_list,
            "unmarked_students": [],
            "all_present": (len(r_students) > 0 and len(present_list) == len(r_students)),
            "has_absent": len(absent_list) > 0
        })
        
    total_active = len(all_students)
    rate = round((total_present / total_active * 100), 1) if total_active > 0 else 0.0
    
    return {
        "date": target_date,
        "total_students": total_active,
        "total_present": total_present,
        "total_absent": total_absent,
        "total_leave": total_leave,
        "total_unmarked": 0,
        "attendance_rate": rate,
        "rooms": report_rooms
    }
