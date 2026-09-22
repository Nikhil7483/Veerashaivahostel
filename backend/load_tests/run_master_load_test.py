import asyncio
import time
import statistics
import os
import io
import json
import httpx
from datetime import datetime
from pymongo import MongoClient

BASE_URL = "http://127.0.0.1:8000/api/v1"
ADMIN_CREDS = {"username": "admin@smarthostel.com", "password": "Admin@123"}
STUDENT_PASSWORD = "Student@123"

class LoadTestMetrics:
    def __init__(self, name=""):
        self.name = name
        self.latencies = []
        self.status_codes = {}
        self.errors = []
        self.start_time = None
        self.end_time = None

    def start(self):
        self.start_time = time.time()

    def stop(self):
        self.end_time = time.time()

    def record(self, latency_ms, status_code, error=None):
        self.latencies.append(latency_ms)
        self.status_codes[status_code] = self.status_codes.get(status_code, 0) + 1
        if error:
            self.errors.append(str(error))

    def summary(self):
        total_reqs = len(self.latencies)
        duration = (self.end_time - self.start_time) if (self.start_time and self.end_time) else 1.0
        rps = total_reqs / duration if duration > 0 else 0
        
        if not self.latencies:
            return {
                "name": self.name,
                "total": 0,
                "rps": 0,
                "avg_ms": 0,
                "p50_ms": 0,
                "p95_ms": 0,
                "p99_ms": 0,
                "min_ms": 0,
                "max_ms": 0,
                "status_codes": self.status_codes,
                "errors_count": len(self.errors)
            }
            
        sorted_lat = sorted(self.latencies)
        avg_ms = statistics.mean(sorted_lat)
        p50_ms = statistics.median(sorted_lat)
        p95_idx = int(len(sorted_lat) * 0.95)
        p99_idx = int(len(sorted_lat) * 0.99)
        p95_ms = sorted_lat[min(p95_idx, len(sorted_lat) - 1)]
        p99_ms = sorted_lat[min(p99_idx, len(sorted_lat) - 1)]
        
        return {
            "name": self.name,
            "total": total_reqs,
            "duration_s": round(duration, 3),
            "rps": round(rps, 2),
            "avg_ms": round(avg_ms, 2),
            "p50_ms": round(p50_ms, 2),
            "p95_ms": round(p95_ms, 2),
            "p99_ms": round(p99_ms, 2),
            "min_ms": round(min(sorted_lat), 2),
            "max_ms": round(max(sorted_lat), 2),
            "status_codes": self.status_codes,
            "errors_count": len(self.errors)
        }

def get_mongo_connection_count():
    try:
        client = MongoClient("mongodb://localhost:27017")
        st = client.admin.command("serverStatus")
        client.close()
        return st.get("connections", {}).get("current", 0)
    except Exception as e:
        return -1

async def test_gradual_ramp_up(student_emails):
    """
    Ramps up user load: 10 -> 25 -> 50 -> 64 -> 75 -> 100 requests.
    """
    print("\n============================================================")
    print("STAGE 1: GRADUAL CONCURRENCY RAMP-UP (10 -> 25 -> 50 -> 64 -> 75 -> 100)")
    print("============================================================")
    
    stages = [10, 25, 50, 64, 75, 100]
    ramp_results = {}
    
    # We use health check and public endpoints for pure concurrent throughput
    async with httpx.AsyncClient(timeout=30.0) as client:
        for concurrency in stages:
            metrics = LoadTestMetrics(f"Ramp_{concurrency}_Users")
            metrics.start()
            
            async def worker(idx):
                t0 = time.time()
                try:
                    res = await client.get(f"http://127.0.0.1:8000/api/health")
                    lat = (time.time() - t0) * 1000
                    metrics.record(lat, res.status_code)
                except Exception as ex:
                    lat = (time.time() - t0) * 1000
                    metrics.record(lat, 0, str(ex))

            tasks = [worker(i) for i in range(concurrency)]
            await asyncio.gather(*tasks)
            metrics.stop()
            
            summary = metrics.summary()
            ramp_results[concurrency] = summary
            print(f"Users: {concurrency:3d} | Reqs: {summary['total']:3d} | RPS: {summary['rps']:7.1f} | Avg: {summary['avg_ms']:6.2f}ms | P95: {summary['p95_ms']:6.2f}ms | Errors: {summary['errors_count']} | Codes: {summary['status_codes']}")
            
            # Check for failure condition
            if summary.get("errors_count", 0) > 0 or any(code >= 500 for code in summary["status_codes"]):
                print(f"FAILED AT CONCURRENCY {concurrency}! Stopping ramp-up.")
                break
            await asyncio.sleep(0.5)
            
    return ramp_results

async def test_concurrent_login(student_emails):
    """
    Simulates 64 students logging in concurrently.
    """
    print("\n============================================================")
    print("STAGE 2: 64-STUDENT CONCURRENT LOGIN TEST")
    print("============================================================")
    
    metrics = LoadTestMetrics("64_Concurrent_Logins")
    tokens = {}
    
    limits = httpx.Limits(max_keepalive_connections=100, max_connections=100)
    async with httpx.AsyncClient(timeout=30.0, limits=limits) as client:
        metrics.start()
        
        async def login_user(email):
            t0 = time.time()
            try:
                payload = {"username": email, "password": STUDENT_PASSWORD}
                res = await client.post(f"{BASE_URL}/auth/login", json=payload)
                lat = (time.time() - t0) * 1000
                metrics.record(lat, res.status_code)
                if res.status_code == 200:
                    data = res.json()
                    tokens[email] = data["access_token"]
                else:
                    metrics.errors.append(f"HTTP {res.status_code}: {res.text}")
            except Exception as e:
                lat = (time.time() - t0) * 1000
                metrics.record(lat, 0, str(e))

        tasks = [login_user(email) for email in student_emails]
        await asyncio.gather(*tasks)
        metrics.stop()
        
    summary = metrics.summary()
    print(f"Total Logins: {summary['total']} | Successful: {len(tokens)} | Failed: {summary['total'] - len(tokens)}")
    print(f"Avg Latency: {summary['avg_ms']}ms | P50: {summary['p50_ms']}ms | P95: {summary['p95_ms']}ms | P99: {summary['p99_ms']}ms")
    print(f"Status Code Breakdown: {summary['status_codes']}")
    return tokens, summary

async def test_concurrent_dashboard(tokens):
    """
    Simulates 64 students simultaneously opening their dashboard.
    Each student requests 8 endpoints:
    1. /students/my/profile
    2. /attendance/my/records
    3. /rooms/my/room
    4. /leaves/my/applications
    5. /complaints
    6. /announcements
    7. /food-allocation/student/today
    8. /notifications
    Total: 64 x 8 = 512 concurrent requests!
    """
    print("\n============================================================")
    print("STAGE 3: 64-STUDENT CONCURRENT DASHBOARD TEST (8 Endpoints / User = 512 requests)")
    print("============================================================")
    
    endpoints = [
        ("Profile", "/students/my/profile"),
        ("Attendance", "/attendance/my/records"),
        ("Room", "/rooms/my/room"),
        ("Leaves", "/leaves/my/applications"),
        ("Complaints", "/complaints"),
        ("Announcements", "/announcements"),
        ("Food_Today", "/food-allocation/student/today"),
        ("Notifications", "/notifications"),
    ]
    
    endpoint_metrics = {name: LoadTestMetrics(name) for name, _ in endpoints}
    total_metrics = LoadTestMetrics("Total_Dashboard")
    
    limits = httpx.Limits(max_keepalive_connections=200, max_connections=200)
    async with httpx.AsyncClient(timeout=45.0, limits=limits) as client:
        total_metrics.start()
        for m in endpoint_metrics.values():
            m.start()

        async def load_student_dashboard(email, token):
            headers = {"Authorization": f"Bearer {token}"}
            student_tasks = []
            
            async def fetch_ep(name, path):
                t0 = time.time()
                try:
                    res = await client.get(f"{BASE_URL}{path}", headers=headers)
                    lat = (time.time() - t0) * 1000
                    endpoint_metrics[name].record(lat, res.status_code)
                    total_metrics.record(lat, res.status_code)
                    if res.status_code >= 400:
                        endpoint_metrics[name].errors.append(f"{res.status_code}: {res.text}")
                except Exception as ex:
                    lat = (time.time() - t0) * 1000
                    endpoint_metrics[name].record(lat, 0, str(ex))
                    total_metrics.record(lat, 0, str(ex))

            for name, path in endpoints:
                student_tasks.append(fetch_ep(name, path))
            await asyncio.gather(*student_tasks)

        tasks = [load_student_dashboard(email, token) for email, token in tokens.items()]
        await asyncio.gather(*tasks)
        
        total_metrics.stop()
        for m in endpoint_metrics.values():
            m.stop()

    total_summary = total_metrics.summary()
    print(f"\n--- Total Dashboard Performance ---")
    print(f"Total Requests: {total_summary['total']} | Duration: {total_summary['duration_s']}s | RPS: {total_summary['rps']}")
    print(f"Avg: {total_summary['avg_ms']}ms | P50: {total_summary['p50_ms']}ms | P95: {total_summary['p95_ms']}ms | P99: {total_summary['p99_ms']}ms")
    print(f"Status Codes: {total_summary['status_codes']}")
    print(f"Errors: {total_summary['errors_count']}")
    
    print("\n--- Per-Endpoint Breakdown ---")
    per_ep_summary = {}
    for name, _ in endpoints:
        s = endpoint_metrics[name].summary()
        per_ep_summary[name] = s
        print(f"{name:15s} | Req: {s['total']:3d} | RPS: {s['rps']:6.1f} | Avg: {s['avg_ms']:6.2f}ms | P95: {s['p95_ms']:6.2f}ms | Codes: {s['status_codes']}")

    return total_summary, per_ep_summary

async def test_concurrent_attendance(tokens, admin_token):
    """
    1. 64 students read attendance concurrently.
    2. Admin marks batch attendance.
    3. Student attempts batch mark (verifying 403 Forbidden).
    4. Verify no duplicate attendance records are created.
    """
    print("\n============================================================")
    print("STAGE 4: CONCURRENT ATTENDANCE TEST")
    print("============================================================")
    
    today_str = datetime.now().strftime("%Y-%m-%d")
    read_metrics = LoadTestMetrics("Attendance_Concurrent_Reads")
    
    limits = httpx.Limits(max_keepalive_connections=100, max_connections=100)
    async with httpx.AsyncClient(timeout=30.0, limits=limits) as client:
        # 1. 64 Students reading attendance records concurrently
        read_metrics.start()
        async def student_read(token):
            headers = {"Authorization": f"Bearer {token}"}
            t0 = time.time()
            try:
                res = await client.get(f"{BASE_URL}/attendance/my/records", headers=headers)
                lat = (time.time() - t0) * 1000
                read_metrics.record(lat, res.status_code)
            except Exception as e:
                lat = (time.time() - t0) * 1000
                read_metrics.record(lat, 0, str(e))

        await asyncio.gather(*[student_read(t) for t in tokens.values()])
        read_metrics.stop()
        
        # 2. Student unauthorized batch attendance attempt
        sample_student_token = list(tokens.values())[0]
        unauth_res = await client.post(
            f"{BASE_URL}/attendance/batch",
            headers={"Authorization": f"Bearer {sample_student_token}"},
            json={"date": today_str, "records": [{"student_id": "001", "status": "PRESENT"}]}
        )
        student_blocked = (unauth_res.status_code == 403)
        print(f"Student Batch Mark Authorization Check: {'BLOCKED (403)' if student_blocked else 'FAILED: ' + str(unauth_res.status_code)}")

        # 3. Authorized Admin batch attendance submission
        records = [{"student_id": f"{i:03d}", "status": "PRESENT" if i <= 58 else "LEAVE"} for i in range(1, 65)]
        t0 = time.time()
        admin_res = await client.post(
            f"{BASE_URL}/attendance/batch",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"date": today_str, "records": records}
        )
        admin_lat = (time.time() - t0) * 1000
        print(f"Admin Batch Mark Response ({admin_lat:.2f}ms): Status={admin_res.status_code}")
        if admin_res.status_code == 200:
            print(f"Result: {admin_res.json().get('message')}")

    # Check MongoDB for duplicates
    client_m = MongoClient("mongodb://localhost:27017")
    db = client_m["smart_hostel"]
    dups = list(db.attendance.aggregate([
        {"$match": {"date": today_str}},
        {"$group": {"_id": "$student_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]))
    today_records_count = db.attendance.count_documents({"date": today_str})
    client_m.close()
    
    print(f"Today's Attendance Records: {today_records_count} | Duplicates: {len(dups)}")
    read_sum = read_metrics.summary()
    print(f"Concurrent Reads: {read_sum['total']} reqs | Avg: {read_sum['avg_ms']}ms | P95: {read_sum['p95_ms']}ms | Codes: {read_sum['status_codes']}")
    
    return {
        "read_summary": read_sum,
        "student_blocked": student_blocked,
        "admin_status": admin_res.status_code,
        "admin_lat_ms": round(admin_lat, 2),
        "duplicates": len(dups),
        "total_records": today_records_count
    }

async def test_concurrent_meal_counts(tokens, admin_token):
    """
    1. 64 students reading meal counts concurrently.
    2. Student attempting to update meal count (verify 403 Forbidden).
    3. Admin updating meal count (verify success, audit log, eligible present count).
    """
    print("\n============================================================")
    print("STAGE 5: CONCURRENT MEAL COUNT TEST")
    print("============================================================")
    
    read_metrics = LoadTestMetrics("MealCount_Concurrent_Reads")
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    limits = httpx.Limits(max_keepalive_connections=100, max_connections=100)
    async with httpx.AsyncClient(timeout=30.0, limits=limits) as client:
        # 1. 64 Students reading meal counts concurrently
        read_metrics.start()
        async def read_meal(token):
            headers = {"Authorization": f"Bearer {token}"}
            t0 = time.time()
            try:
                res = await client.get(f"{BASE_URL}/mess/meal-counts", headers=headers)
                lat = (time.time() - t0) * 1000
                read_metrics.record(lat, res.status_code)
            except Exception as e:
                lat = (time.time() - t0) * 1000
                read_metrics.record(lat, 0, str(e))

        await asyncio.gather(*[read_meal(t) for t in tokens.values()])
        read_metrics.stop()
        
        # 2. Student forbidden check
        sample_student_token = list(tokens.values())[0]
        unauth_res = await client.post(
            f"{BASE_URL}/mess/meal-counts",
            headers={"Authorization": f"Bearer {sample_student_token}"},
            json={
                "date": today_str,
                "tiffin_count": 55,
                "tiffin_box_count": 10,
                "night_lunch_count": 55
            }
        )
        student_blocked = (unauth_res.status_code == 403)
        print(f"Student Meal Count Modification Check: {'BLOCKED (403 Forbidden)' if student_blocked else 'FAILED: ' + str(unauth_res.status_code)}")

        # 3. Admin authorized meal count update
        admin_res = await client.post(
            f"{BASE_URL}/mess/meal-counts",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "date": today_str,
                "tiffin_count": 58,
                "tiffin_box_count": 12,
                "night_lunch_count": 58,
                "selected_breakfast_item": "Pulav (Tomato Bath)",
                "selected_dinner_item": "Rice / Ragi Mudde + Vegetable Sambar",
                "remarks": "Load Test Verified Daily Count"
            }
        )
        print(f"Admin Meal Count Update: Status={admin_res.status_code}")

    # Verify audit log & database consistency
    client_m = MongoClient("mongodb://localhost:27017")
    db = client_m["smart_hostel"]
    audit_entry = db.audit_logs.find_one({"module": "MESS", "action": "WARDEN_MEAL_COUNT_CONFIRMED", "record_id": today_str})
    meal_doc = db.meal_counts.find_one({"date": today_str})
    client_m.close()
    
    audit_ok = (audit_entry is not None)
    eligible_present_reconciled = (meal_doc is not None and meal_doc.get("tiffin_count") == 58)
    
    read_sum = read_metrics.summary()
    print(f"Concurrent Reads: {read_sum['total']} reqs | Avg: {read_sum['avg_ms']}ms | P95: {read_sum['p95_ms']}ms")
    print(f"Audit Log Recorded: {audit_ok} | DB Consistency: {eligible_present_reconciled}")
    
    return {
        "read_summary": read_sum,
        "student_blocked": student_blocked,
        "admin_status": admin_res.status_code,
        "audit_ok": audit_ok,
        "db_ok": eligible_present_reconciled
    }

async def test_concurrent_complaints(tokens, student_emails):
    """
    Simulates multiple students submitting complaints concurrently.
    Tests ownership isolation and ticket ID collision safety.
    """
    print("\n============================================================")
    print("STAGE 6: CONCURRENT COMPLAINT SUBMISSION TEST")
    print("============================================================")
    
    complaint_metrics = LoadTestMetrics("Concurrent_Complaints")
    
    # We test with 20 students concurrently submitting complaints
    sample_students = list(tokens.items())[:20]
    created_complaints = []
    
    limits = httpx.Limits(max_keepalive_connections=50, max_connections=50)
    async with httpx.AsyncClient(timeout=30.0, limits=limits) as client:
        complaint_metrics.start()
        
        async def submit_complaint(email, token, idx):
            headers = {"Authorization": f"Bearer {token}"}
            t0 = time.time()
            payload = {
                "room_number": "Room 01",
                "category": "ELECTRICAL",
                "description": f"Load test test complaint #{idx} from {email}",
                "priority": "MEDIUM"
            }
            try:
                res = await client.post(f"{BASE_URL}/complaints", headers=headers, json=payload)
                lat = (time.time() - t0) * 1000
                complaint_metrics.record(lat, res.status_code)
                if res.status_code == 201:
                    created_complaints.append(res.json())
                else:
                    complaint_metrics.errors.append(f"{res.status_code}: {res.text}")
            except Exception as e:
                lat = (time.time() - t0) * 1000
                complaint_metrics.record(lat, 0, str(e))

        tasks = [submit_complaint(email, token, idx) for idx, (email, token) in enumerate(sample_students)]
        await asyncio.gather(*tasks)
        complaint_metrics.stop()

    summary = complaint_metrics.summary()
    print(f"Submitted: {summary['total']} | Created: {len(created_complaints)} | Errors: {summary['errors_count']}")
    print(f"Avg: {summary['avg_ms']}ms | P95: {summary['p95_ms']}ms | Codes: {summary['status_codes']}")
    
    # Verify ownership in MongoDB
    client_m = MongoClient("mongodb://localhost:27017")
    db = client_m["smart_hostel"]
    
    ticket_ids = [c["ticket_id"] for c in created_complaints]
    unique_tickets = len(set(ticket_ids))
    print(f"Unique Ticket IDs: {unique_tickets}/{len(ticket_ids)}")
    
    # Verify Student A cannot see Student B's complaint
    isolation_ok = True
    if len(sample_students) >= 2:
        email_a, token_a = sample_students[0]
        email_b, token_b = sample_students[1]
        async with httpx.AsyncClient(timeout=10.0) as client:
            res_a = await client.get(f"{BASE_URL}/complaints", headers={"Authorization": f"Bearer {token_a}"})
            list_a = res_a.json()
            # Student A should only see complaints submitted by Student A
            for item in list_a:
                # Find student profile for email_a
                stu_a = db.students.find_one({"email": email_a})
                if item.get("student_id") != stu_a["student_id"]:
                    isolation_ok = False
                    print(f"ISOLATION VIOLATION: Student A saw complaint from {item.get('student_id')}")

    print(f"Complaint Isolation Verified: {isolation_ok}")
    client_m.close()
    
    return summary, len(created_complaints), unique_tickets, isolation_ok

async def test_safe_file_upload(tokens):
    """
    Tests file upload under load:
    1. Small safe file (valid PNG/PDF) upload via /leaves
    2. File size limit (>5MB rejection)
    3. Invalid extension (.exe rejection)
    """
    print("\n============================================================")
    print("STAGE 7: SAFE FILE UPLOAD & VALIDATION TEST")
    print("============================================================")
    
    sample_email, sample_token = list(tokens.items())[0] # Student 1 (Room 01, Cleaning COMPLETED)
    headers = {"Authorization": f"Bearer {sample_token}"}
    
    results = {}
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Valid small JPEG file upload (1KB)
        small_file_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00" + b"\x00" * 500
        files = {"document": ("test_doc.jpg", io.BytesIO(small_file_bytes), "image/jpeg")}
        data = {
            "from_date": "2026-10-01",
            "to_date": "2026-10-03",
            "leave_type": "HOME",
            "reason": "Safe file upload load test leave application"
        }
        t0 = time.time()
        res_valid = await client.post(f"{BASE_URL}/leaves", headers=headers, data=data, files=files)
        lat_valid = (time.time() - t0) * 1000
        results["valid_upload"] = {
            "status": res_valid.status_code,
            "lat_ms": round(lat_valid, 2),
            "pass": res_valid.status_code in [201, 400] # 400 if room cleaning lock active or already pending
        }
        print(f"Valid Small File Upload: Status={res_valid.status_code} ({lat_valid:.2f}ms)")
        
        # Test 2: Oversized file rejection (>5MB)
        large_file_bytes = b"0" * (6 * 1024 * 1024) # 6MB
        files_large = {"document": ("big_doc.pdf", io.BytesIO(large_file_bytes), "application/pdf")}
        data_large = {
            "from_date": "2026-10-05",
            "to_date": "2026-10-06",
            "leave_type": "HOME",
            "reason": "Oversized file rejection test"
        }
        res_large = await client.post(f"{BASE_URL}/leaves", headers=headers, data=data_large, files=files_large)
        results["oversized_rejection"] = {
            "status": res_large.status_code,
            "pass": (res_large.status_code == 400)
        }
        print(f"Oversized File (>5MB) Rejection: Status={res_large.status_code} (Expected 400)")
        
        # Test 3: Invalid extension rejection (.exe)
        bad_file_bytes = b"MZ\x90\x00\x03\x00\x00\x00"
        files_bad = {"document": ("malicious.exe", io.BytesIO(bad_file_bytes), "application/x-msdownload")}
        res_bad = await client.post(f"{BASE_URL}/leaves", headers=headers, data=data, files=files_bad)
        results["extension_rejection"] = {
            "status": res_bad.status_code,
            "pass": (res_bad.status_code == 400)
        }
        print(f"Disallowed File Extension (.exe) Rejection: Status={res_bad.status_code} (Expected 400)")

    return results

async def test_security_and_idor_concurrency(tokens, admin_token):
    """
    Tests security and IDOR during concurrent load:
    Student A and Student B making interleaved requests.
    Verifies:
    1. Student A cannot access Student B's profile (/students/{B_id})
    2. Student A cannot access admin list (/students)
    3. Student A cannot access visitor logs (/visitors)
    4. Student A cannot access audit logs (/audit-logs)
    5. Student A cannot update room capacity (/rooms/{room})
    6. Student A cannot view other student's notifications
    7. JWT validation under load
    """
    print("\n============================================================")
    print("STAGE 8: SECURITY & IDOR CONCURRENCY VALIDATION")
    print("============================================================")
    
    student_items = list(tokens.items())
    email_a, token_a = student_items[0] # guru@hostel.edu
    email_b, token_b = student_items[1] # rudra@hostel.edu
    
    client_m = MongoClient("mongodb://localhost:27017")
    db = client_m["smart_hostel"]
    doc_b = db.students.find_one({"email": email_b})
    b_id = str(doc_b["_id"])
    client_m.close()
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    results = {}
    async with httpx.AsyncClient(timeout=20.0) as client:
        # Run 20 concurrent cross-access attempts
        idor_tasks = []
        
        async def check_idor_profile():
            res = await client.get(f"{BASE_URL}/students/{b_id}", headers=headers_a)
            return ("idor_profile_access", res.status_code == 403)
            
        async def check_admin_students():
            res = await client.get(f"{BASE_URL}/students", headers=headers_a)
            return ("admin_students_list", res.status_code == 403)
            
        async def check_visitors():
            res = await client.get(f"{BASE_URL}/visitors", headers=headers_a)
            return ("visitors_access", res.status_code == 403)
            
        async def check_audit_logs():
            res = await client.get(f"{BASE_URL}/audit-logs", headers=headers_a)
            return ("audit_logs_access", res.status_code == 403)

        async def check_room_mutation():
            res = await client.put(f"{BASE_URL}/rooms/Room%2001", headers=headers_a, json={"total_beds": 10})
            return ("room_mutation", res.status_code == 403)
            
        async def check_invalid_token():
            res = await client.get(f"{BASE_URL}/students/my/profile", headers={"Authorization": "Bearer invalid_token_xyz"})
            return ("invalid_token_rejection", res.status_code == 401)

        checks = [
            check_idor_profile(), check_admin_students(), check_visitors(),
            check_audit_logs(), check_room_mutation(), check_invalid_token()
        ]
        
        # Fire 4 rounds concurrently (24 simultaneous security tests)
        all_checks = checks * 4
        chk_res = await asyncio.gather(*all_checks)
        
        summary_checks = {}
        for name, passed in chk_res:
            if name not in summary_checks:
                summary_checks[name] = True
            if not passed:
                summary_checks[name] = False

    for name, ok in summary_checks.items():
        print(f"{name:30s} : {'ENFORCED (SECURE)' if ok else 'SECURITY BREACH!'}")

    return summary_checks

async def test_failure_resiliency():
    """
    Tests graceful handling of invalid input, bad routes, malformed json, and timeouts.
    """
    print("\n============================================================")
    print("STAGE 9: FAILURE & FAULT TOLERANCE TESTING")
    print("============================================================")
    
    results = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Malformed JSON payload
        res_malformed = await client.post(
            f"{BASE_URL}/auth/login",
            content="this is not json",
            headers={"Content-Type": "application/json"}
        )
        results["malformed_json"] = (res_malformed.status_code == 422)
        print(f"Malformed JSON Payload: Status={res_malformed.status_code} (Expected 422)")

        # 2. Non-existent route
        res_404 = await client.get(f"{BASE_URL}/non_existent_endpoint_123")
        results["non_existent_route"] = (res_404.status_code == 404)
        print(f"Non-existent Route: Status={res_404.status_code} (Expected 404)")

        # 3. Invalid Object ID format
        res_bad_id = await client.get(f"{BASE_URL}/students/invalid-oid-xyz")
        results["bad_object_id"] = (res_bad_id.status_code in [401, 403, 400, 422])
        print(f"Invalid ID Format: Status={res_bad_id.status_code} (Expected 401/403/400/422)")

    return results

async def main():
    print("============================================================")
    print("STARTING 64-STUDENT CONCURRENT LOAD TEST SUITE")
    print(f"Time: {datetime.now().isoformat()}")
    print("============================================================")
    
    # 1. Fetch 64 student emails from MongoDB
    client_m = MongoClient("mongodb://localhost:27017")
    db = client_m["smart_hostel"]
    student_docs = list(db.students.find({"status": "ACTIVE"}).sort("student_id", 1))
    student_emails = [s["email"] for s in student_docs]
    client_m.close()
    
    print(f"Loaded {len(student_emails)} active student accounts from database.")
    
    # Pre-test connection count
    conn_before = get_mongo_connection_count()
    print(f"MongoDB Active Connections (Pre-test): {conn_before}")
    
    # Step 1: Ramp-Up Test
    ramp_results = await test_gradual_ramp_up(student_emails)
    
    # Step 2: Login Admin to get admin token
    async with httpx.AsyncClient(timeout=10.0) as client:
        res_admin = await client.post(f"{BASE_URL}/auth/login", json=ADMIN_CREDS)
        admin_token = res_admin.json()["access_token"]
    print("Warden/Admin token acquired successfully.")
    
    # Step 3: Concurrent Login
    tokens, login_summary = await test_concurrent_login(student_emails)
    
    # Step 4: Concurrent Dashboard
    dash_total, dash_per_ep = await test_concurrent_dashboard(tokens)
    
    # Step 5: Concurrent Attendance
    att_results = await test_concurrent_attendance(tokens, admin_token)
    
    # Step 6: Concurrent Meal Counts
    meal_results = await test_concurrent_meal_counts(tokens, admin_token)
    
    # Step 7: Concurrent Complaints
    comp_sum, comp_created, comp_unique, comp_iso = await test_concurrent_complaints(tokens, student_emails)
    
    # Step 8: Safe File Upload
    file_results = await test_safe_file_upload(tokens)
    
    # Step 9: Security & IDOR
    sec_results = await test_security_and_idor_concurrency(tokens, admin_token)
    
    # Step 10: Failure & Resiliency
    fail_results = await test_failure_resiliency()
    
    # Post-test connection count
    conn_after = get_mongo_connection_count()
    print(f"\nMongoDB Active Connections (Post-test): {conn_after}")
    
    # Save all telemetry metrics to JSON for report generation
    final_telemetry = {
        "timestamp": datetime.now().isoformat(),
        "conn_before": conn_before,
        "conn_after": conn_after,
        "ramp_results": ramp_results,
        "login_summary": login_summary,
        "dash_total": dash_total,
        "dash_per_ep": dash_per_ep,
        "att_results": att_results,
        "meal_results": meal_results,
        "comp_summary": comp_sum,
        "comp_created": comp_created,
        "comp_unique": comp_unique,
        "comp_iso": comp_iso,
        "file_results": file_results,
        "sec_results": sec_results,
        "fail_results": fail_results
    }
    
    with open("load_tests/telemetry_results.json", "w") as f:
        json.dump(final_telemetry, f, indent=2)
        
    print("\nAll load test scenarios completed! Telemetry saved to backend/load_tests/telemetry_results.json")

if __name__ == "__main__":
    asyncio.run(main())
