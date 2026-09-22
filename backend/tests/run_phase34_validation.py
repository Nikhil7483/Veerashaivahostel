import asyncio
import io
import os
import sys
import time
import json
import statistics
import httpx
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = "http://127.0.0.1:8000/api/v1"
HEALTH_URL = "http://127.0.0.1:8000"
ADMIN_CREDS = {"username": "admin@smarthostel.com", "password": "Admin@123"}
STUDENT_USER = "bharath.bm@hostel.edu"  # Student 006, Room 02
STUDENT_CREDS = {"username": STUDENT_USER, "password": "Student@123"}

results = {}

def safe_str(s):
    if not isinstance(s, str):
        s = str(s)
    return s.encode("ascii", "ignore").decode()

def record_test(name, passed, detail=""):
    results[name] = {"passed": passed, "detail": safe_str(detail)}
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}: {safe_str(detail)}")

async def run_validation():
    print("============================================================")
    print("PHASE 34: COMPREHENSIVE END-TO-END VALIDATION SUITE")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("============================================================")

    mc = MongoClient("mongodb://localhost:27017")
    db = mc["smart_hostel"]

    # Pre-test cleanup of any test-generated pending leaves for student 006
    db.leave_applications.delete_many({"student_id": "006"})

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ==========================================================
        # 1. SYSTEM STARTUP & HEALTH CHECKS
        # ==========================================================
        print("\n--- SECTION 1: System Startup & Health Checks ---")
        try:
            r_health = await client.get(f"{HEALTH_URL}/health")
            r_api_health = await client.get(f"{HEALTH_URL}/api/health")
            h_ok = (
                r_health.status_code == 200 and r_health.json().get("database") == "connected" and
                r_api_health.status_code == 200 and r_api_health.json().get("database") == "connected"
            )
            record_test("1.1_health_endpoints", h_ok, f"/health={r_health.status_code}, /api/health={r_api_health.status_code}")
        except Exception as e:
            record_test("1.1_health_endpoints", False, str(e))

        # ==========================================================
        # AUTHENTICATION: OBTAIN ADMIN & STUDENT TOKENS
        # ==========================================================
        res_admin = await client.post(f"{BASE_URL}/auth/login", json=ADMIN_CREDS)
        admin_token = res_admin.json().get("access_token")
        h_admin = {"Authorization": f"Bearer {admin_token}"}
        record_test("2.0_admin_login", res_admin.status_code == 200 and bool(admin_token), f"Token acquired (Role: ADMIN)")

        res_stu = await client.post(f"{BASE_URL}/auth/login", json=STUDENT_CREDS)
        stu_token = res_stu.json().get("access_token")
        h_stu = {"Authorization": f"Bearer {stu_token}"}
        record_test("3.0_student_login", res_stu.status_code == 200 and bool(stu_token), f"Token acquired (Student: {STUDENT_USER})")

        # ==========================================================
        # 2. ADMIN END-TO-END SUITE (ALL 19 MODULES)
        # ==========================================================
        print("\n--- SECTION 2: Admin End-to-End Module Tests ---")
        admin_modules = [
            ("2.1_admin_dashboard", f"{BASE_URL}/analytics/overview"),
            ("2.2_student_management", f"{BASE_URL}/students"),
            ("2.3_room_management", f"{BASE_URL}/rooms"),
            ("2.4_attendance", f"{BASE_URL}/attendance"),
            ("2.5_leave_management", f"{BASE_URL}/leaves"),
            ("2.6_cleaning_daily_board", f"{BASE_URL}/cleaning/daily-board"),
            ("2.7_complaints", f"{BASE_URL}/complaints"),
            ("2.8_maintenance", f"{BASE_URL}/maintenance"),
            ("2.9_mess_menu", f"{BASE_URL}/mess/menu"),
            ("2.10_meal_counts", f"{BASE_URL}/mess/meal-counts"),
            ("2.11_food_allocation", f"{BASE_URL}/food-allocation/today"),
            ("2.12_visitors", f"{BASE_URL}/visitors"),
            ("2.13_lost_found", f"{BASE_URL}/lost-found"),
            ("2.14_emergency_sos", f"{BASE_URL}/emergency"),
            ("2.15_announcements", f"{BASE_URL}/announcements"),
            ("2.16_notifications", f"{BASE_URL}/notifications"),
            ("2.17_analytics_overview", f"{BASE_URL}/analytics/overview"),
            ("2.18_reports_students", f"{BASE_URL}/reports/students"),
            ("2.19_audit_logs", f"{BASE_URL}/audit-logs"),
        ]

        for mod_name, url in admin_modules:
            try:
                r = await client.get(url, headers=h_admin)
                record_test(mod_name, r.status_code == 200, f"Status: {r.status_code}")
            except Exception as e:
                record_test(mod_name, False, str(e))

        # ==========================================================
        # 3. STUDENT END-TO-END SUITE (ALL 12 MODULES)
        # ==========================================================
        print("\n--- SECTION 3: Student End-to-End Module Tests ---")
        student_modules = [
            ("3.1_student_dashboard", f"{BASE_URL}/students/my/profile"),
            ("3.2_student_profile", f"{BASE_URL}/students/my/profile"),
            ("3.3_student_room", f"{BASE_URL}/rooms/my/room"),
            ("3.4_student_attendance", f"{BASE_URL}/attendance/my/records"),
            ("3.5_student_leaves", f"{BASE_URL}/leaves/my/applications"),
            ("3.6_student_complaints", f"{BASE_URL}/complaints"),
            ("3.7_student_weekly_menu", f"{BASE_URL}/food-allocation/weekly-menu"),
            ("3.8_student_food_history", f"{BASE_URL}/food-allocation/student/history"),
            ("3.9_student_announcements", f"{BASE_URL}/announcements"),
            ("3.10_student_notifications", f"{BASE_URL}/notifications"),
            ("3.11_student_lost_found", f"{BASE_URL}/lost-found"),
            ("3.12_student_sos_list", f"{BASE_URL}/emergency"),
        ]

        for mod_name, url in student_modules:
            try:
                r = await client.get(url, headers=h_stu)
                record_test(mod_name, r.status_code == 200, f"Status: {r.status_code}")
            except Exception as e:
                record_test(mod_name, False, str(e))

        # ==========================================================
        # 4. ROOM DATA VALIDATION (12 ROOMS, 64 STUDENTS, NO ROOM 03)
        # ==========================================================
        print("\n--- SECTION 4: Room & Student Data Validation ---")
        rooms_list = list(db.rooms.find())
        valid_room_numbers = {"Room 01", "Room 02", "Room 04", "Room 05", "Room 06", "Room 07", "Room 08", "Room 09", "Room 10", "Room 11", "Room 12", "Room 13"}
        db_room_numbers = {r["room_number"] for r in rooms_list}

        r3_exists = db.rooms.find_one({"room_number": {"$in": ["3", "03", "Room 03", 3]}})
        students_count = db.students.count_documents({"status": "ACTIVE"})

        all_students = list(db.students.find({"status": "ACTIVE"}))
        unassigned_or_invalid = [s for s in all_students if s.get("room_number") not in valid_room_numbers]

        record_test("4.1_total_rooms_count", len(rooms_list) == 12, f"Total rooms: {len(rooms_list)} (Expected 12)")
        record_test("4.2_room_03_non_existence", r3_exists is None, f"Room 03 present: {r3_exists is not None} (Expected False)")
        record_test("4.3_total_students_count", students_count == 64, f"Active students: {students_count} (Expected 64)")
        record_test("4.4_student_room_assignments", len(unassigned_or_invalid) == 0, f"Unassigned/Invalid: {len(unassigned_or_invalid)}")

        # ==========================================================
        # 5. ATTENDANCE TESTS (ADMIN MUTATION, DUPLICATE PREVENTION)
        # ==========================================================
        print("\n--- SECTION 5: Attendance Tests ---")
        test_date = "2026-10-15"
        # Admin marks batch attendance
        att_payload = {
            "date": test_date,
            "records": [
                {"student_id": "006", "status": "PRESENT"},
                {"student_id": "007", "status": "ABSENT"},
                {"student_id": "008", "status": "LEAVE"}
            ]
        }
        res_att_mark = await client.post(f"{BASE_URL}/attendance/batch", headers=h_admin, json=att_payload)
        record_test("5.1_admin_mark_attendance", res_att_mark.status_code == 200, f"Status: {res_att_mark.status_code}")

        # Duplicate compound constraint verification
        # Attempt to mark same student twice on same date updates or preserves uniqueness
        res_att_dup = await client.post(f"{BASE_URL}/attendance/batch", headers=h_admin, json={
            "date": test_date,
            "records": [{"student_id": "006", "status": "PRESENT"}]
        })
        records_count = db.attendance.count_documents({"date": test_date, "student_id": "006"})
        record_test("5.2_attendance_duplicate_prevention", records_count == 1, f"Found {records_count} record (Expected exactly 1)")

        # Student cannot mark attendance (RBAC)
        res_stu_mark = await client.post(f"{BASE_URL}/attendance/batch", headers=h_stu, json=att_payload)
        record_test("5.3_student_cannot_mark_attendance", res_stu_mark.status_code == 403, f"Status: {res_stu_mark.status_code} (Expected 403)")

        # Clean up test attendance
        db.attendance.delete_many({"date": test_date})

        # ==========================================================
        # 6. LEAVE TESTS (SUBMISSION, STATUS, APPROVE/REJECT)
        # ==========================================================
        print("\n--- SECTION 6: Leave Tests ---")
        db.leave_applications.delete_many({"student_id": "006"})
        leave_payload = {
            "from_date": "2026-12-01",
            "to_date": "2026-12-05",
            "leave_type": "HOME",
            "reason": "PHASE34_TEST_LEAVE"
        }
        res_leave_sub = await client.post(f"{BASE_URL}/leaves", headers=h_stu, data=leave_payload)
        leave_created = res_leave_sub.status_code == 201
        leave_id = res_leave_sub.json().get("id") if leave_created else None
        record_test("6.1_student_submit_leave", leave_created and res_leave_sub.json().get("status") == "PENDING", f"Status: {res_leave_sub.status_code}, Leave ID: {leave_id}")

        if leave_id:
            # Admin approves leave
            res_approve = await client.put(f"{BASE_URL}/leaves/{leave_id}/status", headers=h_admin, json={
                "status": "APPROVED",
                "admin_remarks": "Approved by Warden Phase 34"
            })
            record_test("6.2_admin_approve_leave", res_approve.status_code == 200 and res_approve.json().get("status") == "APPROVED", f"Status: {res_approve.status_code}")
            # Clean up
            db.leave_applications.delete_one({"_id": ObjectId(leave_id)})

        # ==========================================================
        # 7. MEAL COUNT TESTS (TIFFIN, BOX, NIGHT DINNER, RBAC)
        # ==========================================================
        print("\n--- SECTION 7: Meal Count Tests ---")
        # Student cannot modify meal counts
        res_stu_meal = await client.post(f"{BASE_URL}/mess/meal-counts", headers=h_stu, json={"date": "2026-09-18", "session": "night"})
        record_test("7.1_student_cannot_confirm_meal_counts", res_stu_meal.status_code == 403, f"Status: {res_stu_meal.status_code} (Expected 403)")

        # Admin can view and confirm meal counts
        res_admin_meal = await client.get(f"{BASE_URL}/mess/meal-counts?date=2026-09-17", headers=h_admin)
        record_test("7.2_admin_get_meal_counts", res_admin_meal.status_code == 200, f"Status: {res_admin_meal.status_code}")

        # Night dinner count window verification (5:00 PM to 6:30 PM)
        w_open = await client.get(f"{BASE_URL}/food-allocation/cleaning/night-meal/2026-09-18?sim_time=17:30", headers=h_stu)
        w_closed = await client.get(f"{BASE_URL}/food-allocation/cleaning/night-meal/2026-09-18?sim_time=19:00", headers=h_stu)
        w_ok = w_open.json().get("window", {}).get("is_open") is True and w_closed.json().get("window", {}).get("is_open") is False
        record_test("7.3_night_dinner_window_enforcement", w_ok, f"17:30={w_open.json().get('window', {}).get('is_open')}, 19:00={w_closed.json().get('window', {}).get('is_open')}")

        # ==========================================================
        # 8. COMPLAINT CONCURRENCY & UNIQUE TICKET IDs
        # ==========================================================
        print("\n--- SECTION 8: Complaint Concurrency & SLA Escalation ---")
        async def submit_test_complaint(idx):
            return await client.post(f"{BASE_URL}/complaints", headers=h_stu, json={
                "category": "ELECTRICAL",
                "room_number": "Room 02",
                "title": f"Phase 34 Test Complaint {idx}",
                "description": f"Testing concurrent complaints ticket ID sequence {idx}",
                "priority": "MEDIUM"
            })

        comp_tasks = [submit_test_complaint(i) for i in range(5)]
        comp_responses = await asyncio.gather(*comp_tasks)
        ticket_ids = [r.json().get("ticket_id") for r in comp_responses if r.status_code == 201]
        all_unique = len(ticket_ids) == len(set(ticket_ids)) and len(ticket_ids) == 5
        record_test("8.1_concurrent_complaint_creation", all_unique, f"Created 5 tickets: {ticket_ids}")

        # Test SLA Escalation on one complaint
        if ticket_ids:
            first_id = comp_responses[0].json().get("id")
            res_esc = await client.post(f"{BASE_URL}/complaints/{first_id}/escalate", headers=h_admin, json={
                "escalated_to": "WARDEN",
                "reason": "Phase 34 automated SLA escalation test"
            })
            esc_ok = res_esc.status_code == 200 and res_esc.json().get("escalation_level") == "LEVEL_2_WARDEN"
            record_test("8.2_complaint_sla_escalation", esc_ok, f"Status: {res_esc.status_code}, Level: {res_esc.json().get('escalation_level')}")

        # Clean up test complaints
        db.complaints.delete_many({"title": {"$regex": "Phase 34 Test Complaint"}})

        # ==========================================================
        # 9. SECURITY TESTS (IDOR, RBAC, TOKEN INTEGRITY)
        # ==========================================================
        print("\n--- SECTION 9: Security Tests ---")
        probes = [
            ("admin_attendance", f"{BASE_URL}/attendance"),
            ("admin_students_list", f"{BASE_URL}/students"),
            ("admin_audit_logs", f"{BASE_URL}/audit-logs"),
            ("admin_visitors", f"{BASE_URL}/visitors"),
        ]
        all_blocked = True
        for name, url in probes:
            r_p = await client.get(url, headers=h_stu)
            if r_p.status_code != 403:
                all_blocked = False
        record_test("9.1_student_admin_endpoint_probes_blocked", all_blocked, "All probed admin endpoints returned 403")

        # Invalid, missing, and malformed tokens (401 or 403 as appropriate)
        r_inv = await client.get(f"{BASE_URL}/students/my/profile", headers={"Authorization": "Bearer bad_token_123"})
        r_mis = await client.get(f"{BASE_URL}/students/my/profile")
        r_mal = await client.get(f"{BASE_URL}/students/my/profile", headers={"Authorization": "MalformedHeader"})
        tok_ok = (r_inv.status_code in [401, 403] and r_mis.status_code in [401, 403] and r_mal.status_code in [401, 403])
        record_test("9.2_token_integrity_rejection", tok_ok, f"Invalid={r_inv.status_code}, Missing={r_mis.status_code}, Malformed={r_mal.status_code}")

        # ==========================================================
        # 10. FILE UPLOAD TESTS (VALID, EXEC, OVERSIZE, TRAVERSAL)
        # ==========================================================
        print("\n--- SECTION 10: File Upload Security Tests ---")
        # Ensure student 006 has no pending leave
        db.leave_applications.delete_many({"student_id": "006"})

        # Valid JPG
        valid_jpg = io.BytesIO(b"valid_jpg_binary_content")
        r_v_jpg = await client.post(f"{BASE_URL}/leaves", headers=h_stu, data=leave_payload, files={"document": ("valid.jpg", valid_jpg, "image/jpeg")})
        record_test("10.1_valid_jpg_upload", r_v_jpg.status_code == 201, f"Status: {r_v_jpg.status_code}")
        if r_v_jpg.status_code == 201:
            db.leave_applications.delete_one({"_id": ObjectId(r_v_jpg.json()["id"])})

        # Valid PDF
        valid_pdf = io.BytesIO(b"%PDF-1.4 valid content")
        r_v_pdf = await client.post(f"{BASE_URL}/leaves", headers=h_stu, data=leave_payload, files={"document": ("cert.pdf", valid_pdf, "application/pdf")})
        record_test("10.2_valid_pdf_upload", r_v_pdf.status_code == 201, f"Status: {r_v_pdf.status_code}")
        if r_v_pdf.status_code == 201:
            db.leave_applications.delete_one({"_id": ObjectId(r_v_pdf.json()["id"])})

        # Executable .exe rejected
        bad_exe = io.BytesIO(b"MZ executable content")
        r_exe = await client.post(f"{BASE_URL}/leaves", headers=h_stu, data=leave_payload, files={"document": ("malware.exe", bad_exe, "application/x-msdownload")})
        record_test("10.3_executable_rejection", r_exe.status_code == 400, f"Status: {r_exe.status_code} (Expected 400)")

        # Oversized file (> 5MB)
        oversized = io.BytesIO(b"0" * (6 * 1024 * 1024))
        r_big = await client.post(f"{BASE_URL}/leaves", headers=h_stu, data=leave_payload, files={"document": ("big.jpg", oversized, "image/jpeg")})
        record_test("10.4_oversized_file_rejection", r_big.status_code == 400, f"Status: {r_big.status_code} (Expected 400)")

        # Path traversal filename
        trav_file = io.BytesIO(b"traversal_content")
        r_trav = await client.post(f"{BASE_URL}/leaves", headers=h_stu, data=leave_payload, files={"document": ("../../../../etc/passwd.jpg", trav_file, "image/jpeg")})
        trav_ok = False
        u = ""
        if r_trav.status_code == 201:
            u = r_trav.json().get("document_url", "")
            trav_ok = (".." not in u and "passwd" not in u and u.startswith("/uploads/leave_"))
            db.leave_applications.delete_one({"_id": ObjectId(r_trav.json()["id"])})
        record_test("10.5_path_traversal_sanitization", trav_ok, f"Stored URL: {u if trav_ok else safe_str(r_trav.text[:100])}")

        # ==========================================================
        # 11. RATE LIMITING TESTS
        # ==========================================================
        print("\n--- SECTION 11: Rate Limiting Tests ---")
        # Test SOS limiter (10/minute)
        sos_429 = False
        for i in range(15):
            r_sos = await client.post(f"{BASE_URL}/emergency/trigger", headers=h_stu, json={
                "room_number": "Room 02",
                "emergency_type": "MEDICAL",
                "description": f"Rate limit test probe {i}"
            })
            if r_sos.status_code == 429:
                sos_429 = True
                break
        record_test("11.1_sos_rate_limit_429", sos_429, "Triggered HTTP 429 after threshold")
        db.emergency_alerts.delete_many({"description": {"$regex": "Rate limit test probe"}})

        # ==========================================================
        # 12. CORS TESTS
        # ==========================================================
        print("\n--- SECTION 12: CORS Tests ---")
        r_cors_ok = await client.get(f"{HEALTH_URL}/api/health", headers={"Origin": "http://localhost:5173"})
        r_cors_bad = await client.get(f"{HEALTH_URL}/api/health", headers={"Origin": "http://untrusted-domain.com"})
        cors_passed = (
            r_cors_ok.headers.get("access-control-allow-origin") == "http://localhost:5173" and
            r_cors_bad.headers.get("access-control-allow-origin") is None
        )
        record_test("12.1_cors_allowed_and_disallowed", cors_passed, f"Allowed Origin: {r_cors_ok.headers.get('access-control-allow-origin')}")

        # ==========================================================
        # 13. SECURITY HEADERS TESTS
        # ==========================================================
        print("\n--- SECTION 13: Security Headers Tests ---")
        hdrs = r_cors_ok.headers
        sec_h = (
            hdrs.get("x-content-type-options") == "nosniff" and
            hdrs.get("x-frame-options") == "DENY" and
            hdrs.get("referrer-policy") == "strict-origin-when-cross-origin"
        )
        record_test("13.1_security_headers", sec_h, f"nosniff, DENY, strict-origin verified")

        # ==========================================================
        # 14. ERROR HANDLING & INFORMATION LEAKAGE
        # ==========================================================
        print("\n--- SECTION 14: Error Handling Tests ---")
        r_err_json = await client.post(f"{BASE_URL}/auth/login", content="not-json", headers={"Content-Type": "application/json"})
        r_err_oid = await client.get(f"{BASE_URL}/complaints/invalid-oid-xyz", headers=h_admin)
        r_err_404 = await client.get(f"{BASE_URL}/non-existent-path-123", headers=h_admin)
        
        err_leak = any("Traceback" in r.text or "pymongo" in r.text for r in [r_err_json, r_err_oid, r_err_404])
        record_test("14.1_error_sanitization", not err_leak and r_err_json.status_code == 422, f"No stack traces, JSON 422/400/404 handled cleanly")

        # ==========================================================
        # 15. DATA INTEGRITY & AUDIT TRAIL
        # ==========================================================
        print("\n--- SECTION 15: Database Integrity Tests ---")
        dup_usn = list(db.students.aggregate([{"$group": {"_id": "$usn", "count": {"$sum": 1}}}, {"$match": {"count": {"$gt": 1}}}]))
        dup_email = list(db.students.aggregate([{"$group": {"_id": "$email", "count": {"$sum": 1}}}, {"$match": {"count": {"$gt": 1}}}]))
        audit_count = db.audit_logs.count_documents({})
        integrity_ok = (len(dup_usn) == 0 and len(dup_email) == 0 and audit_count > 0)
        record_test("15.1_database_integrity", integrity_ok, f"Duplicate USN: {len(dup_usn)}, Duplicate Email: {len(dup_email)}, Audit Logs: {audit_count}")

        mc.close()

    print("\n============================================================")
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v["passed"])
    failed_tests = total_tests - passed_tests
    print(f"VALIDATION SUMMARY: {passed_tests}/{total_tests} PASSED ({failed_tests} FAILED)")
    print("============================================================")
    return results

if __name__ == "__main__":
    asyncio.run(run_validation())
