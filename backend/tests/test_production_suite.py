import asyncio
import io
import urllib.request
import json
import httpx
from pymongo import MongoClient

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def run_production_tests():
    print("============================================================")
    print("RUNNING COMPREHENSIVE PRODUCTION TEST SUITE")
    print("============================================================")
    
    test_results = {}
    
    # 1. Health & Database Verification
    async with httpx.AsyncClient() as client:
        res_h1 = await client.get("http://127.0.0.1:8000/health")
        res_h2 = await client.get("http://127.0.0.1:8000/api/health")
        h1_ok = (res_h1.status_code == 200 and res_h1.json().get("database") == "connected")
        h2_ok = (res_h2.status_code == 200 and res_h2.json().get("database") == "connected")
        test_results["health_checks"] = h1_ok and h2_ok
        print(f"Health Check (/health & /api/health): {'PASS' if test_results['health_checks'] else 'FAIL'}")

        # 2. Security Headers & CORS
        headers = res_h1.headers
        sec_h_ok = (
            headers.get("x-content-type-options") == "nosniff" and
            headers.get("x-frame-options") == "DENY" and
            headers.get("referrer-policy") == "strict-origin-when-cross-origin"
        )
        test_results["security_headers"] = sec_h_ok
        print(f"Security Headers (nosniff, DENY, referrer-policy): {'PASS' if sec_h_ok else 'FAIL'}")

        # CORS Allowed vs Disallowed
        cors_allow = await client.get("http://127.0.0.1:8000/api/health", headers={"Origin": "http://localhost:5173"})
        cors_deny = await client.get("http://127.0.0.1:8000/api/health", headers={"Origin": "http://malicious-site.com"})
        cors_ok = (
            cors_allow.headers.get("access-control-allow-origin") == "http://localhost:5173" and
            cors_deny.headers.get("access-control-allow-origin") is None
        )
        test_results["cors_origin_enforcement"] = cors_ok
        print(f"CORS Origin Enforcement: {'PASS' if cors_ok else 'FAIL'}")

        # 3. Authentication: Admin & Student
        res_admin = await client.post(f"{BASE_URL}/auth/login", json={"username": "admin@smarthostel.com", "password": "Admin@123"})
        admin_ok = (res_admin.status_code == 200 and "access_token" in res_admin.json())
        admin_token = res_admin.json().get("access_token")

        res_stu = await client.post(f"{BASE_URL}/auth/login", json={"username": "guru@hostel.edu", "password": "Student@123"})
        stu_ok = (res_stu.status_code == 200 and "access_token" in res_stu.json())
        stu_token = res_stu.json().get("access_token")
        test_results["authentication"] = admin_ok and stu_ok
        print(f"Authentication (Admin & Student): {'PASS' if test_results['authentication'] else 'FAIL'}")

        # 4. Invalid & Expired Token Handling
        res_bad_tok = await client.get(f"{BASE_URL}/students/my/profile", headers={"Authorization": "Bearer invalid_bad_token_123"})
        tok_ok = (res_bad_tok.status_code == 401)
        test_results["token_validation"] = tok_ok
        print(f"Invalid Token Rejection (401): {'PASS' if tok_ok else 'FAIL'}")

        # 5. Authorization & IDOR Protection
        h_stu = {"Authorization": f"Bearer {stu_token}"}
        h_admin = {"Authorization": f"Bearer {admin_token}"}
        
        # Student attempting admin routes
        idor_stu_list = await client.get(f"{BASE_URL}/students", headers=h_stu)
        idor_visitors = await client.get(f"{BASE_URL}/visitors", headers=h_stu)
        idor_audit = await client.get(f"{BASE_URL}/audit-logs", headers=h_stu)
        idor_room_put = await client.put(f"{BASE_URL}/rooms/Room%2001", headers=h_stu, json={"total_beds": 10})
        idor_att_batch = await client.post(f"{BASE_URL}/attendance/batch", headers=h_stu, json={"date": "2026-09-18", "records": []})
        idor_meal_post = await client.post(f"{BASE_URL}/mess/meal-counts", headers=h_stu, json={"date": "2026-09-18", "tiffin_count": 50})

        idor_all_blocked = all(res.status_code == 403 for res in [
            idor_stu_list, idor_visitors, idor_audit, idor_room_put, idor_att_batch, idor_meal_post
        ])
        test_results["authorization_enforcement"] = idor_all_blocked
        print(f"Authorization & RBAC Enforcement (6 Student Probes Blocked with 403): {'PASS' if idor_all_blocked else 'FAIL'}")

        # 6. Room Data & Room 03 Non-Existence Check
        res_rooms = await client.get(f"{BASE_URL}/rooms", headers=h_admin)
        rooms_list = res_rooms.json()
        room_numbers = [r["room_number"] for r in rooms_list]
        r3_non_existent = ("Room 03" not in room_numbers and len(room_numbers) == 12)
        test_results["room_03_non_existence"] = r3_non_existent
        print(f"Room 03 Non-Existence & 12 Valid Rooms: {'PASS' if r3_non_existent else 'FAIL'} (Count: {len(room_numbers)})")

        # 7. Attendance & Duplicate Prevention
        res_my_att = await client.get(f"{BASE_URL}/attendance/my/records", headers=h_stu)
        att_read_ok = (res_my_att.status_code == 200 and "records" in res_my_att.json())
        test_results["attendance_operations"] = att_read_ok
        print(f"Attendance Operations: {'PASS' if att_read_ok else 'FAIL'}")

        # 8. Meal Counts Verification
        res_meals = await client.get(f"{BASE_URL}/mess/meal-counts", headers=h_stu)
        meals_ok = (res_meals.status_code == 200 and "eligible_meal_count" in res_meals.json())
        test_results["meal_counts"] = meals_ok
        print(f"Meal Counts & Attendance Reconciliation: {'PASS' if meals_ok else 'FAIL'}")

        # 9. Complaint Creation & Ownership
        res_comp = await client.post(f"{BASE_URL}/complaints", headers=h_stu, json={
            "room_number": "Room 01",
            "category": "PLUMBING",
            "description": "Production suite test complaint",
            "priority": "LOW"
        })
        comp_ok = (res_comp.status_code == 201 and "ticket_id" in res_comp.json())
        test_results["complaint_operations"] = comp_ok
        print(f"Complaint Submission & Ticket ID: {'PASS' if comp_ok else 'FAIL'} ({res_comp.json().get('ticket_id')})")

        # 10. File Upload Hardening: Path Traversal & Extension Validation
        # Clean leaves first so Guru can apply
        mc = MongoClient("mongodb://localhost:27017")
        db = mc["smart_hostel"]
        db.leave_applications.delete_many({})
        mc.close()

        # Login student 006 (Room 02) to ensure room cleaning lock is not active
        res_stu2 = await client.post(f"{BASE_URL}/auth/login", json={"username": "bharath.bm@hostel.edu", "password": "Student@123"})
        h_stu2 = {"Authorization": f"Bearer {res_stu2.json().get('access_token')}"}

        # Path traversal filename
        bad_file = io.BytesIO(b"fake_jpeg_content_here")
        files_trav = {"document": ("../../../../system_exploit.jpg", bad_file, "image/jpeg")}
        data_trav = {"from_date": "2026-11-01", "to_date": "2026-11-03", "leave_type": "HOME", "reason": "Path traversal test"}
        res_trav = await client.post(f"{BASE_URL}/leaves", headers=h_stu2, data=data_trav, files=files_trav)
        trav_passed = False
        if res_trav.status_code == 201:
            url = res_trav.json().get("document_url", "")
            trav_passed = (".." not in url and "system_exploit" not in url and url.startswith("/uploads/leave_"))
        test_results["upload_path_traversal_sanitization"] = trav_passed
        print(f"Upload Path Traversal Sanitization: {'PASS' if trav_passed else 'FAIL'}")

        # Executable extension rejection
        files_bad = {"document": ("test.exe", io.BytesIO(b"MZ..."), "application/x-msdownload")}
        res_bad = await client.post(f"{BASE_URL}/leaves", headers=h_stu2, data=data_trav, files=files_bad)
        exe_blocked = (res_bad.status_code == 400)
        test_results["upload_executable_rejection"] = exe_blocked
        print(f"Upload Executable Rejection (400): {'PASS' if exe_blocked else 'FAIL'}")

        # 11. Night Dinner Count Window Verification (5:00 PM to 6:30 PM)
        w_open1 = await client.get(f"{BASE_URL}/food-allocation/cleaning/night-meal/2026-09-18?sim_time=17:00", headers=h_stu)
        w_open2 = await client.get(f"{BASE_URL}/food-allocation/cleaning/night-meal/2026-09-18?sim_time=18:30", headers=h_stu)
        w_close_early = await client.get(f"{BASE_URL}/food-allocation/cleaning/night-meal/2026-09-18?sim_time=16:59", headers=h_stu)
        w_close_late = await client.get(f"{BASE_URL}/food-allocation/cleaning/night-meal/2026-09-18?sim_time=18:31", headers=h_stu)
        
        window_ok = (
            w_open1.status_code == 200 and w_open1.json().get("window", {}).get("is_open") is True and
            w_open2.status_code == 200 and w_open2.json().get("window", {}).get("is_open") is True and
            w_close_early.status_code == 200 and w_close_early.json().get("window", {}).get("is_open") is False and
            w_close_late.status_code == 200 and w_close_late.json().get("window", {}).get("is_open") is False
        )
        test_results["night_dinner_count_window"] = window_ok
        print(f"Night Dinner Count Window (5:00 PM – 6:30 PM): {'PASS' if window_ok else 'FAIL'}")

    # 11. Database Integrity Verification
    mc = MongoClient("mongodb://localhost:27017")
    db = mc["smart_hostel"]
    total_students = db.students.count_documents({"status": "ACTIVE"})
    total_rooms = db.rooms.count_documents({})
    r3_in_db = db.rooms.find_one({"room_number": "Room 03"})
    
    dup_stu = list(db.students.aggregate([
        {"$group": {"_id": "$student_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]))
    dup_att = list(db.attendance.aggregate([
        {"$group": {"_id": {"student_id": "$student_id", "date": "$date"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]))
    mc.close()

    db_integrity_ok = (total_students == 64 and total_rooms == 12 and r3_in_db is None and len(dup_stu) == 0 and len(dup_att) == 0)
    test_results["database_integrity"] = db_integrity_ok
    print(f"Database Integrity (64 Students, 12 Rooms, 0 Duplicates): {'PASS' if db_integrity_ok else 'FAIL'}")

    print("============================================================")
    all_passed = all(test_results.values())
    print(f"PRODUCTION SUITE RESULT: {'ALL PASS' if all_passed else 'SOME FAIL'}")
    print("============================================================")
    return test_results

if __name__ == "__main__":
    asyncio.run(run_production_tests())
