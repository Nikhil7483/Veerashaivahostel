from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from app.database.connection import get_database
from app.core.dependencies import require_admin
from app.services.report_service import generate_pdf_table, generate_excel_sheet, generate_csv_data
from app.services.daily_report_generator import generate_daily_warden_report_pdf
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/reports", tags=["Reports & Exports"])

@router.get("/students")
async def export_students_report(
    format: str = Query("pdf", pattern="^(pdf|excel|csv)$"),
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    students = await db.students.find({}).sort("student_id", 1).to_list(500)
    
    headers = ["Student ID", "Name", "USN", "Room", "Bed", "Department", "Semester", "Phone", "Email", "Status"]
    data = []
    for s in students:
        data.append([
            s.get("student_id"),
            s.get("name"),
            s.get("usn"),
            s.get("room_number"),
            s.get("bed_number"),
            s.get("department"),
            s.get("semester"),
            s.get("phone"),
            s.get("email"),
            s.get("status")
        ])
        
    title = "Student Directory"
    filename_base = f"students_report_{datetime.now().strftime('%Y%m%d')}"
    
    if format == "pdf":
        buffer = generate_pdf_table(title, headers, data, landscape_mode=True)
        return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"})
    elif format == "excel":
        buffer = generate_excel_sheet(title, headers, data)
        return Response(content=buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename_base}.xlsx"})
    else:
        csv_str = generate_csv_data(headers, data)
        return Response(content=csv_str, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"})

@router.get("/student-logins")
async def export_student_logins_report(
    format: str = Query("csv", pattern="^(pdf|excel|csv)$"),
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    students = await db.students.find({}).sort("student_id", 1).to_list(1000)
    
    headers = [
        "Student ID", "Name", "Room", "Bed", "USN", "Login Email", "Phone", "Department", "Default Password"
    ]
    data = []
    for s in students:
        data.append([
            s.get("student_id", ""),
            s.get("name", ""),
            s.get("room_number", ""),
            s.get("bed_number", ""),
            s.get("usn", s.get("student_id", "")),
            s.get("email", ""),
            s.get("phone", ""),
            s.get("department", ""),
            "Student@123"
        ])
        
    title = "Student Login Credentials"
    filename_base = f"student_login_credentials_{datetime.now().strftime('%Y%m%d')}"
    
    if format == "pdf":
        buffer = generate_pdf_table(title, headers, data, landscape_mode=True)
        return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"})
    elif format == "excel":
        buffer = generate_excel_sheet(title, headers, data)
        return Response(content=buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename_base}.xlsx"})
    else:
        csv_str = generate_csv_data(headers, data)
        return Response(content=csv_str, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"})

@router.get("/attendance")
async def export_attendance_report(
    format: str = Query("pdf", pattern="^(pdf|excel|csv)$"),
    date: Optional[str] = None,
    month: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if date:
        query["date"] = date
    elif month:
        query["date"] = {"$regex": f"^{month}"}
        
    records = await db.attendance.find(query).sort("date", -1).to_list(1000)
    headers = ["Date", "Student ID", "Student Name", "USN", "Room", "Status", "Remarks"]
    data = []
    for r in records:
        data.append([
            r.get("date"),
            r.get("student_id"),
            r.get("student_name"),
            r.get("usn"),
            r.get("room_number"),
            r.get("status"),
            r.get("remarks")
        ])
        
    title = f"Attendance Report - {date or month or 'All'}"
    filename_base = f"attendance_report_{datetime.now().strftime('%Y%m%d')}"
    
    if format == "pdf":
        buffer = generate_pdf_table(title, headers, data, landscape_mode=True)
        return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"})
    elif format == "excel":
        buffer = generate_excel_sheet(title, headers, data)
        return Response(content=buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename_base}.xlsx"})
    else:
        csv_str = generate_csv_data(headers, data)
        return Response(content=csv_str, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"})

@router.get("/complaints")
async def export_complaints_report(
    format: str = Query("pdf", pattern="^(pdf|excel|csv)$"),
    category: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if category:
        query["category"] = category
    if status:
        query["status"] = status
        
    complaints = await db.complaints.find(query).sort("created_at", -1).to_list(1000)
    headers = ["Ticket ID", "Student", "Room", "Category", "Priority", "Status", "Assigned Staff", "Created Date"]
    data = []
    for c in complaints:
        created_str = c["created_at"].strftime("%Y-%m-%d %H:%M") if c.get("created_at") else "-"
        data.append([
            c.get("ticket_id"),
            c.get("student_name"),
            c.get("room_number"),
            c.get("category"),
            c.get("priority"),
            c.get("status"),
            c.get("assigned_staff"),
            created_str
        ])
        
    title = "Complaints & Resolution Report"
    filename_base = f"complaints_report_{datetime.now().strftime('%Y%m%d')}"
    
    if format == "pdf":
        buffer = generate_pdf_table(title, headers, data, landscape_mode=True)
        return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"})
    elif format == "excel":
        buffer = generate_excel_sheet(title, headers, data)
        return Response(content=buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename_base}.xlsx"})
    else:
        csv_str = generate_csv_data(headers, data)
        return Response(content=csv_str, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"})

@router.get("/rooms")
async def export_rooms_report(
    format: str = Query("pdf", pattern="^(pdf|excel|csv)$"),
    current_user: dict = Depends(require_admin)
):
    db = get_database()
    rooms = await db.rooms.find({}).sort("room_number", 1).to_list(50)
    headers = ["Room Number", "Total Beds", "Occupied", "Available", "Cleaning Status", "Last Cleaned", "Next Cleaning"]
    data = []
    for r in rooms:
        data.append([
            r.get("room_number"),
            r.get("total_beds"),
            r.get("occupied_beds"),
            r.get("available_beds"),
            r.get("cleaning_status"),
            r.get("last_cleaned"),
            r.get("next_cleaning")
        ])
        
    title = "Hostel 13 Rooms Occupancy & Status"
    filename_base = f"rooms_report_{datetime.now().strftime('%Y%m%d')}"
    
    if format == "pdf":
        buffer = generate_pdf_table(title, headers, data)
        return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"})
    elif format == "excel":
        buffer = generate_excel_sheet(title, headers, data)
        return Response(content=buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename_base}.xlsx"})
    else:
        csv_str = generate_csv_data(headers, data)
        return Response(content=csv_str, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"})


# ═══════════════════════════════════════════════════════════════════
# COMPREHENSIVE DAILY WARDEN REPORT — All tasks in a single PDF
# ═══════════════════════════════════════════════════════════════════

@router.get("/daily-warden")
async def export_daily_warden_report(
    date: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """
    Generates a comprehensive Daily Warden Report PDF aggregating
    all hostel activities for the specified date (defaults to today).
    Sections: Attendance, Cleaning, Leaves, Food, Complaints,
    Maintenance, Visitors, Announcements, Audit Trail.
    """
    db = get_database()

    # Default to today
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")

    try:
        report_dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        report_dt = datetime.now()
        date = report_dt.strftime("%Y-%m-%d")

    day_name = report_dt.strftime("%A")

    # ── 1. Attendance ──
    attendance_data = await db.attendance.find({"date": date}).sort("room_number", 1).to_list(500)

    # ── 2. Cleaning: Daily routine across all 13 hostel rooms ──
    cleaning_data = []
    try:
        from app.api.v1.cleaning import get_daily_cleaning_board
        cleaning_board = await get_daily_cleaning_board(current_user=current_user)
        for b in cleaning_board:
            cleaning_data.append({
                "room_number": b.get("room_number"),
                "floor": b.get("floor"),
                "status": b.get("cleaning_status", "PENDING"),
                "assigned_staff": "Housekeeping Staff",
                "schedule": "Daily Routine",
                "notes": f"{b.get('residents_count', 0)} residents" + (" (Members Absent)" if b.get("members_absent") else ""),
                "residents_count": b.get("residents_count", 0),
                "last_cleaned": b.get("last_cleaned") or "—"
            })
    except Exception:
        cleaning_data = await db.cleaning_requests.find({"date": date}).sort("room_number", 1).to_list(50)

    # ── 3. Leave applications (created today OR covering today's date range) ──
    leaves_query = {
        "$or": [
            {"created_at": {"$gte": report_dt.replace(hour=0, minute=0, second=0),
                            "$lt": report_dt.replace(hour=23, minute=59, second=59)}},
            {"from_date": {"$lte": date}, "to_date": {"$gte": date}}
        ]
    }
    leaves_data = await db.leave_applications.find(leaves_query).sort("created_at", -1).to_list(200)

    # ── 4. Verified Kitchen Meal Counts & Food Roster ──
    food_morning_dish = "—"
    food_night_dish = "—"
    food_morning_session = {}
    food_night_session = {}
    food_roster = []
    try:
        from app.api.v1.food_allocations import build_warden_roster_data
        roster_data = await build_warden_roster_data(date)
        food_morning_dish = roster_data.get("morning_dish", "—")
        food_night_dish = roster_data.get("night_dish", "—")
        food_morning_session = roster_data.get("morning_summary", {})
        food_night_session = roster_data.get("night_summary", {})
        food_roster = roster_data.get("roster", [])
    except Exception:
        food_alloc = await db.food_allocations.find_one({"date": date})
        if food_alloc:
            food_morning_dish = food_alloc.get("morning_dish", "—")
            food_night_dish = food_alloc.get("night_dish", "—")
            food_morning_session = food_alloc.get("morning_session", {})
            food_night_session = food_alloc.get("night_session", {})
            food_roster = food_alloc.get("roster", [])

    # ── 5. Complaints (created today) ──
    complaints_query = {
        "created_at": {"$gte": report_dt.replace(hour=0, minute=0, second=0),
                       "$lt": report_dt.replace(hour=23, minute=59, second=59)}
    }
    complaints_data = await db.complaints.find(complaints_query).sort("created_at", -1).to_list(200)
    # If no complaints created today, include all open complaints
    if not complaints_data:
        complaints_data = await db.complaints.find(
            {"status": {"$nin": ["RESOLVED", "CLOSED"]}}
        ).sort("created_at", -1).to_list(50)

    # ── 6. Maintenance requests (created today + open) ──
    maintenance_query = {
        "$or": [
            {"created_at": {"$gte": report_dt.replace(hour=0, minute=0, second=0),
                            "$lt": report_dt.replace(hour=23, minute=59, second=59)}},
            {"status": {"$nin": ["RESOLVED", "CLOSED"]}}
        ]
    }
    maintenance_data = await db.maintenance_requests.find(maintenance_query).sort("created_at", -1).to_list(200)

    # ── 7. Visitors (created today) ──
    visitors_query = {
        "created_at": {"$gte": report_dt.replace(hour=0, minute=0, second=0),
                       "$lt": report_dt.replace(hour=23, minute=59, second=59)}
    }
    visitors_data = await db.visitors.find(visitors_query).sort("created_at", -1).to_list(100)

    # ── 8. Announcements (created today) ──
    announcements_query = {
        "created_at": {"$gte": report_dt.replace(hour=0, minute=0, second=0),
                       "$lt": report_dt.replace(hour=23, minute=59, second=59)}
    }
    announcements_data = await db.announcements.find(announcements_query).sort("created_at", -1).to_list(50)

    # ── 9. Audit logs (today) ──
    audit_query = {
        "timestamp": {"$gte": report_dt.replace(hour=0, minute=0, second=0),
                      "$lt": report_dt.replace(hour=23, minute=59, second=59)}
    }
    audit_logs_data = await db.audit_logs.find(audit_query).sort("timestamp", -1).to_list(100)

    # ── 10. Rooms (current state) ──
    rooms_data = await db.rooms.find({}).sort("room_number", 1).to_list(50)

    # ── Generate PDF ──
    pdf_bytes = generate_daily_warden_report_pdf(
        date_str=date,
        day_name=day_name,
        warden_email=current_user.get("email", "Warden"),
        attendance_data=attendance_data,
        cleaning_data=cleaning_data,
        leaves_data=leaves_data,
        food_morning_session=food_morning_session,
        food_night_session=food_night_session,
        food_roster=food_roster,
        complaints_data=complaints_data,
        maintenance_data=maintenance_data,
        visitors_data=visitors_data,
        announcements_data=announcements_data,
        audit_logs_data=audit_logs_data,
        rooms_data=rooms_data,
        food_morning_dish=food_morning_dish,
        food_night_dish=food_night_dish,
    )

    filename = f"daily_warden_report_{date}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/system-report-pdf")
async def get_system_report_pdf():
    """
    Returns the pre-compiled Comprehensive System Architecture and Audit Report PDF.
    """
    import os
    from fastapi.responses import FileResponse
    pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "docs", "COMPLETE_PROJECT_REPORT.pdf"))
    if not os.path.exists(pdf_path):
        from generate_complete_system_pdf import build_pdf
        build_pdf(pdf_path)
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename="COMPLETE_PROJECT_REPORT.pdf"
    )

