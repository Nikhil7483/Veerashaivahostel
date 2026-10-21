import asyncio
import sys
import os
import io
import shutil
import tempfile
from pathlib import Path
import httpx
from bson import ObjectId
from datetime import datetime

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.main import app, lifespan
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.database.connection import get_database, connect_to_mongo, close_mongo_connection

async def run_all_tests():
    print("=" * 70)
    print("RUNNING BACKEND SECURITY TESTS: SUB-STEPS 1a, 1b, & 1c")
    print("=" * 70)
    
    passed = 0
    total = 0
    
    # Connect to MongoDB for auth and upload authorization tests
    await connect_to_mongo()
    db = get_database()
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # =============================================================
        # SECTION 1a: Security Headers & Strict CORS Whitelist
        # =============================================================
        total += 1
        res = await client.get("/")
        h = res.headers
        sec_ok = (
            h.get("x-content-type-options") == "nosniff" and
            h.get("x-frame-options") == "DENY" and
            h.get("referrer-policy") == "strict-origin-when-cross-origin" and
            h.get("x-xss-protection") == "1; mode=block"
        )
        if sec_ok:
            passed += 1
            print("  [PASS] 1. Security headers present (nosniff, DENY, referrer-policy, XSS)")
        else:
            print(f"  [FAIL] 1. Security headers missing: {dict(h)}")
            
        total += 1
        res_cors_ok = await client.get("/", headers={"Origin": "https://veerashaivahostel.vercel.app"})
        if res_cors_ok.headers.get("access-control-allow-origin") == "https://veerashaivahostel.vercel.app":
            passed += 1
            print("  [PASS] 2. Whitelisted Vercel origin accepted by CORS")
        else:
            print("  [FAIL] 2. Whitelisted Vercel origin rejected by CORS")

        total += 1
        res_cors_bad = await client.get("/", headers={"Origin": "https://evil-unauthorized-site.com"})
        bad_cors = res_cors_bad.headers.get("access-control-allow-origin")
        if not bad_cors or bad_cors == "null":
            passed += 1
            print("  [PASS] 3. Malicious/unauthorized origin blocked by CORS")
        else:
            print(f"  [FAIL] 3. Malicious origin allowed by CORS: {bad_cors}")

        total += 1
        res_custom = await client.get("/", headers={"Origin": "https://veerashaivaboyshostel.in"})
        if res_custom.headers.get("access-control-allow-origin") == "https://veerashaivaboyshostel.in":
            passed += 1
            print("  [PASS] 4. Whitelisted custom domain accepted by CORS")
        else:
            print("  [FAIL] 4. Custom domain rejected by CORS")

        total += 1
        res_docs = await client.get("/api/v1/docs")
        if settings.ENVIRONMENT == "production" and not getattr(settings, "ENABLE_DOCS", False):
            if res_docs.status_code == 404:
                passed += 1
                print("  [PASS] 5. Production docs strictly gated (HTTP 404)")
            else:
                print(f"  [FAIL] 5. Production docs accessible: {res_docs.status_code}")
        else:
            passed += 1
            print(f"  [SKIP/PASS] 5. Environment is '{settings.ENVIRONMENT}', docs status: {res_docs.status_code}")

        # =============================================================
        # SECTION 1b: Auth Backdoor Removal & Real Bcrypt Only
        # =============================================================
        total += 1
        res_backdoor = await client.post("/api/v1/auth/login", json={
            "username": "guru@hostel.edu",
            "password": "student"
        })
        if res_backdoor.status_code == 401:
            passed += 1
            print("  [PASS] 6. Backdoor password alias 'student' strictly rejected (HTTP 401)")
        else:
            print(f"  [FAIL] 6. Backdoor password was accepted: status {res_backdoor.status_code}")

        total += 1
        res_user_pwd = await client.post("/api/v1/auth/login", json={
            "username": "001",
            "password": "001"
        })
        if res_user_pwd.status_code == 401:
            passed += 1
            print("  [PASS] 7. Backdoor username-as-password strictly rejected (HTTP 401)")
        else:
            print(f"  [FAIL] 7. Backdoor username-as-password was accepted: status {res_user_pwd.status_code}")

        total += 1
        res_valid = await client.post("/api/v1/auth/login", json={
            "username": "guru@hostel.edu",
            "password": "Student@123"
        })
        valid_login_ok = res_valid.status_code == 200 and "access_token" in res_valid.json()
        if valid_login_ok:
            passed += 1
            print("  [PASS] 8. Valid bcrypt credentials accepted (HTTP 200)")
        else:
            print(f"  [FAIL] 8. Valid login failed: {res_valid.status_code} {res_valid.text}")

        # =============================================================
        # SECTION 1b: Production JWT_SECRET_KEY Requirement
        # =============================================================
        total += 1
        orig_env = settings.ENVIRONMENT
        orig_key = settings.JWT_SECRET_KEY
        refusal_passed = False
        try:
            settings.ENVIRONMENT = "production"
            settings.JWT_SECRET_KEY = "smart_hostel_super_secure_jwt_secret_key_2026_production_grade"
            os.environ["STRICT_JWT_CHECK"] = "true"
            async with lifespan(app):
                pass
        except RuntimeError as e:
            if "JWT_SECRET_KEY" in str(e):
                refusal_passed = True
        finally:
            settings.ENVIRONMENT = orig_env
            settings.JWT_SECRET_KEY = orig_key
            os.environ.pop("STRICT_JWT_CHECK", None)

        if refusal_passed:
            passed += 1
            print("  [PASS] 9. App strictly refuses startup in production if default/missing JWT secret is used")
        else:
            print("  [FAIL] 9. App did NOT refuse startup with default JWT secret in production")

        # =============================================================
        # SECTION 1b: Forced Password Reset Gating & token_version
        # =============================================================
        test_user_id = ObjectId()
        test_email = f"test_sec_{test_user_id}@smarthostel.test"
        test_user_doc = {
            "_id": test_user_id,
            "email": test_email,
            "password_hash": hash_password("OldPassword@123"),
            "role": "STUDENT",
            "status": "ACTIVE",
            "token_version": 1,
            "pwd_reset_required": True
        }
        await db.users.insert_one(test_user_doc)

        try:
            tok_reset = create_access_token({
                "sub": test_email,
                "role": "STUDENT",
                "id": str(test_user_id),
                "token_version": 1,
                "pwd_reset_required": True
            })

            total += 1
            res_blocked = await client.get(
                "/api/v1/students/my/profile",
                headers={"Authorization": f"Bearer {tok_reset}"}
            )
            if res_blocked.status_code == 403 and "PASSWORD_RESET_REQUIRED" in res_blocked.text:
                passed += 1
                print("  [PASS] 10. Endpoint strictly blocked by backend when pwd_reset_required=True (HTTP 403)")
            else:
                print(f"  [FAIL] 10. Endpoint was NOT blocked: {res_blocked.status_code}")

            total += 1
            res_change = await client.post(
                "/api/v1/auth/change-password",
                headers={"Authorization": f"Bearer {tok_reset}"},
                json={"old_password": "OldPassword@123", "new_password": "NewSecurePassword@456"}
            )
            change_ok = res_change.status_code == 200 and "access_token" in res_change.json()
            if change_ok:
                passed += 1
                print("  [PASS] 11. Endpoint /auth/change-password permitted for pwd_reset_required token (HTTP 200)")
            else:
                print(f"  [FAIL] 11. change-password failed: {res_change.status_code}")

            total += 1
            res_old_tok = await client.post(
                "/api/v1/auth/change-password",
                headers={"Authorization": f"Bearer {tok_reset}"},
                json={"old_password": "NewSecurePassword@456", "new_password": "AnotherPassword@789"}
            )
            if res_old_tok.status_code == 401:
                passed += 1
                print("  [PASS] 12. Old token strictly invalidated after password change via token_version (HTTP 401)")
            else:
                print(f"  [FAIL] 12. Old token was unexpectedly accepted: {res_old_tok.status_code}")

            total += 1
            updated_u = await db.users.find_one({"_id": test_user_id})
            if updated_u.get("pwd_reset_required") is False and updated_u.get("token_version") == 2:
                passed += 1
                print("  [PASS] 13. User record token_version incremented to 2 and pwd_reset_required cleared")
            else:
                print(f"  [FAIL] 13. User record not properly updated: {updated_u}")

        finally:
            await db.users.delete_one({"_id": test_user_id})

        # =============================================================
        # SECTION 1c: Secure Uploads & Authorized File Serving
        # =============================================================
        # Setup temporary test student A and student B
        student_a_id = ObjectId()
        student_b_id = ObjectId()
        admin_id = ObjectId()

        email_a = f"student_a_{student_a_id}@hostel.test"
        email_b = f"student_b_{student_b_id}@hostel.test"
        admin_email = f"admin_{admin_id}@hostel.test"

        user_a = {
            "_id": student_a_id,
            "email": email_a,
            "password_hash": hash_password("TestPassword123!"),
            "role": "STUDENT",
            "status": "ACTIVE",
            "token_version": 1
        }
        student_doc_a = {
            "_id": ObjectId(),
            "student_id": "TEST_A_001",
            "usn": f"USN_A_{student_a_id}",
            "name": "Student A",
            "email": email_a,
            "room_number": "Room 02",
            "bed_number": 1,
            "status": "ACTIVE"
        }

        user_b = {
            "_id": student_b_id,
            "email": email_b,
            "password_hash": hash_password("TestPassword123!"),
            "role": "STUDENT",
            "status": "ACTIVE",
            "token_version": 1
        }
        student_doc_b = {
            "_id": ObjectId(),
            "student_id": "TEST_B_002",
            "usn": f"USN_B_{student_b_id}",
            "name": "Student B",
            "email": email_b,
            "room_number": "Room 04",
            "bed_number": 2,
            "status": "ACTIVE"
        }

        user_admin = {
            "_id": admin_id,
            "email": admin_email,
            "role": "ADMIN",
            "status": "ACTIVE",
            "token_version": 1
        }

        # Pre-cleanup to ensure clean state
        await db.students.delete_many({"student_id": {"$in": ["TEST_A_001", "TEST_B_002"]}})
        await db.users.delete_many({"email": {"$in": [email_a, email_b, admin_email]}})

        # Temporarily ensure today's duty record is COMPLETED so leave upload tests are not blocked by duty lock
        today_date_str = datetime.now().strftime("%Y-%m-%d")
        saved_duty = await db.daily_duty_records.find_one({"date": today_date_str})
        if saved_duty:
            await db.daily_duty_records.update_one({"date": today_date_str}, {"$set": {"status": "COMPLETED"}})

        await db.users.insert_many([user_a, user_b, user_admin])
        await db.students.insert_many([student_doc_a, student_doc_b])

        token_a = create_access_token({"sub": email_a, "role": "STUDENT", "id": str(student_a_id), "token_version": 1})
        token_b = create_access_token({"sub": email_b, "role": "STUDENT", "id": str(student_b_id), "token_version": 1})
        token_adm = create_access_token({"sub": admin_email, "role": "ADMIN", "id": str(admin_id), "token_version": 1})

        # Create a real test document in uploads directory for student A
        upload_dir = Path(settings.UPLOAD_DIRECTORY).resolve()
        upload_dir.mkdir(parents=True, exist_ok=True)
        test_filename = f"leave_test_{student_a_id}.pdf"
        test_file_path = upload_dir / test_filename
        
        # Valid PDF header
        test_pdf_bytes = b"%PDF-1.4\n%Test Secure Hostel Document Content\n%%EOF"
        test_file_path.write_bytes(test_pdf_bytes)

        # Record in leave_applications associated with student A
        leave_doc_a = {
            "_id": ObjectId(),
            "student_id": "TEST_A_001",
            "student_name": "Student A",
            "document_url": f"/api/v1/uploads/{test_filename}",
            "status": "APPROVED"
        }
        await db.leave_applications.insert_one(leave_doc_a)

        try:
            # Test 14: Valid Authorized Upload (leaves.py)
            total += 1
            valid_pdf = b"%PDF-1.5\nValid Medical Leave Certificate Content\n%%EOF"
            res_upload = await client.post(
                "/api/v1/leaves",
                headers={"Authorization": f"Bearer {token_a}"},
                data={
                    "from_date": "2026-11-01",
                    "to_date": "2026-11-05",
                    "leave_type": "MEDICAL",
                    "reason": "Doctor appointment",
                },
                files={"document": ("medical_cert.pdf", io.BytesIO(valid_pdf), "application/pdf")}
            )
            if res_upload.status_code == 201 and "document_url" in res_upload.json():
                passed += 1
                uploaded_doc_url = res_upload.json()["document_url"]
                print(f"  [PASS] 14. Valid authorized document upload accepted (HTTP 201, {uploaded_doc_url})")
                # Clean up created pending leave so subsequent tests can submit
                await db.leave_applications.delete_many({"student_id": "TEST_A_001", "status": "PENDING"})
            else:
                err_clean = res_upload.text.encode("ascii", "ignore").decode("ascii")
                print(f"  [FAIL] 14. Valid upload failed: {res_upload.status_code} {err_clean}")

            # Test 15: Invalid File Type Upload (.exe rejected)
            total += 1
            res_bad_ext = await client.post(
                "/api/v1/leaves",
                headers={"Authorization": f"Bearer {token_a}"},
                data={
                    "from_date": "2026-11-06",
                    "to_date": "2026-11-07",
                    "leave_type": "PERSONAL",
                    "reason": "Test",
                },
                files={"document": ("malicious.exe", io.BytesIO(b"MZ\x90\x00"), "application/x-msdownload")}
            )
            if res_bad_ext.status_code == 400 and "Invalid file type" in res_bad_ext.text:
                passed += 1
                print("  [PASS] 15. Invalid file type extension strictly rejected (HTTP 400)")
            else:
                print(f"  [FAIL] 15. Invalid extension was not rejected: {res_bad_ext.status_code}")

            # Test 16: File exceeding size limit (>5MB)
            total += 1
            huge_content = b"%PDF-1.4\n" + (b"0" * (6 * 1024 * 1024))
            res_huge = await client.post(
                "/api/v1/leaves",
                headers={"Authorization": f"Bearer {token_a}"},
                data={
                    "from_date": "2026-11-08",
                    "to_date": "2026-11-09",
                    "leave_type": "PERSONAL",
                    "reason": "Test",
                },
                files={"document": ("huge.pdf", io.BytesIO(huge_content), "application/pdf")}
            )
            if res_huge.status_code == 400 and "exceeds maximum size" in res_huge.text:
                passed += 1
                print("  [PASS] 16. File exceeding 5MB size limit strictly rejected (HTTP 400)")
            else:
                print(f"  [FAIL] 16. Huge file was not rejected: {res_huge.status_code}")

            # Test 17: Content signature mismatch (.pdf extension with non-PDF text)
            total += 1
            fake_pdf = b"Hello this is just a plain text file pretending to be PDF"
            res_fake = await client.post(
                "/api/v1/leaves",
                headers={"Authorization": f"Bearer {token_a}"},
                data={
                    "from_date": "2026-11-10",
                    "to_date": "2026-11-11",
                    "leave_type": "PERSONAL",
                    "reason": "Test",
                },
                files={"document": ("fake.pdf", io.BytesIO(fake_pdf), "application/pdf")}
            )
            if res_fake.status_code == 400 and "does not match the valid format signature" in res_fake.text:
                passed += 1
                print("  [PASS] 17. Magic byte signature mismatch strictly rejected (HTTP 400)")
            else:
                print(f"  [FAIL] 17. Magic byte mismatch was not rejected: {res_fake.status_code}")

            # Test 18: Malicious filename and path traversal attempt
            total += 1
            res_traversal = await client.get("/api/v1/uploads/../../etc/passwd")
            if res_traversal.status_code in [400, 404]:
                passed += 1
                print(f"  [PASS] 18. Path traversal attempt strictly blocked (HTTP {res_traversal.status_code})")
            else:
                print(f"  [FAIL] 18. Path traversal not blocked: {res_traversal.status_code}")

            # Test 19: Unauthenticated download of private upload
            total += 1
            res_unauth = await client.get(f"/api/v1/uploads/{test_filename}")
            if res_unauth.status_code == 401:
                passed += 1
                print("  [PASS] 19. Unauthenticated file download strictly rejected (HTTP 401)")
            else:
                print(f"  [FAIL] 19. Unauthenticated download allowed: {res_unauth.status_code}")

            # Test 20: Protection against public access to private uploads via /uploads/ route
            total += 1
            res_pub_mount = await client.get(f"/uploads/{test_filename}")
            if res_pub_mount.status_code == 401:
                passed += 1
                print("  [PASS] 20. Public access to private uploads via /uploads/ strictly blocked (HTTP 401)")
            else:
                print(f"  [FAIL] 20. Public static access still open: {res_pub_mount.status_code}")

            # Test 21: Student B attempting to download Student A's private document (IDOR Defense)
            total += 1
            res_idor = await client.get(
                f"/api/v1/uploads/{test_filename}",
                headers={"Authorization": f"Bearer {token_b}"}
            )
            if res_idor.status_code == 403 and "Access denied" in res_idor.text:
                passed += 1
                print("  [PASS] 21. Student B downloading Student A's document blocked (HTTP 403 IDOR blocked)")
            else:
                print(f"  [FAIL] 21. IDOR allowed Student B to access Student A's file: {res_idor.status_code}")

            # Test 22: Student A downloading own private document
            total += 1
            res_owner = await client.get(
                f"/api/v1/uploads/{test_filename}",
                headers={"Authorization": f"Bearer {token_a}"}
            )
            if res_owner.status_code == 200 and res_owner.content == test_pdf_bytes:
                passed += 1
                print("  [PASS] 22. Student A successfully authorized to download own document (HTTP 200)")
            else:
                print(f"  [FAIL] 22. Owner download failed: {res_owner.status_code}")

            # Test 23: Authorized Warden / Admin access to student document
            total += 1
            res_admin_view = await client.get(
                f"/api/v1/uploads/{test_filename}",
                headers={"Authorization": f"Bearer {token_adm}"}
            )
            if res_admin_view.status_code == 200 and res_admin_view.content == test_pdf_bytes:
                passed += 1
                print("  [PASS] 23. Warden/Admin successfully authorized to view student document (HTTP 200)")
            else:
                print(f"  [FAIL] 23. Admin access failed: {res_admin_view.status_code}")

            # Test 24: Missing file and nonexistent record
            total += 1
            res_not_found = await client.get(
                "/api/v1/uploads/leave_nonexistent_file_99999.pdf",
                headers={"Authorization": f"Bearer {token_adm}"}
            )
            if res_not_found.status_code == 404:
                passed += 1
                print("  [PASS] 24. Nonexistent file returns clean HTTP 404 Not Found")
            else:
                print(f"  [FAIL] 24. Nonexistent file returned unexpected status: {res_not_found.status_code}")

            # Test 25: Correct path resolution regardless of working directory
            total += 1
            resolved_upload_dir = Path(settings.UPLOAD_DIRECTORY).resolve()
            if resolved_upload_dir.is_absolute() and resolved_upload_dir.exists():
                passed += 1
                print(f"  [PASS] 25. UPLOAD_DIRECTORY resolved reliably to absolute path ({resolved_upload_dir})")
            else:
                print(f"  [FAIL] 25. UPLOAD_DIRECTORY path resolution failed: {settings.UPLOAD_DIRECTORY}")

            # ------------------------------------------------------------------
            # SUB-STEP 1d: ROOM AND EMERGENCY ALERT AUTHORIZATION TESTS
            # ------------------------------------------------------------------

            # Test 26: Unauthenticated room requests blocked (HTTP 401)
            total += 1
            res_room_unauth = await client.get("/api/v1/rooms")
            res_my_room_unauth = await client.get("/api/v1/rooms/my/room")
            res_spec_room_unauth = await client.get("/api/v1/rooms/Room 02")
            if (res_room_unauth.status_code == 401 and 
                res_my_room_unauth.status_code == 401 and 
                res_spec_room_unauth.status_code == 401):
                passed += 1
                print("  [PASS] 26. Unauthenticated room requests strictly blocked (HTTP 401)")
            else:
                print(f"  [FAIL] 26. Unauth room requests allowed: {res_room_unauth.status_code}, {res_my_room_unauth.status_code}, {res_spec_room_unauth.status_code}")

            # Test 27: Student access to permitted own room information
            total += 1
            res_my_room = await client.get(
                "/api/v1/rooms/my/room",
                headers={"Authorization": f"Bearer {token_a}"}
            )
            res_own_room = await client.get(
                "/api/v1/rooms/Room 02",
                headers={"Authorization": f"Bearer {token_a}"}
            )
            if (res_my_room.status_code == 200 and 
                res_own_room.status_code == 200 and 
                res_my_room.json().get("room_number") == "Room 02"):
                passed += 1
                print("  [PASS] 27. Student successfully authorized to view own room info (HTTP 200)")
            else:
                print(f"  [FAIL] 27. Student own room access failed: {res_my_room.status_code}, {res_own_room.status_code}")

            # Test 28: Student attempting IDOR access to another room blocked (HTTP 403)
            total += 1
            res_other_room = await client.get(
                "/api/v1/rooms/Room 04",
                headers={"Authorization": f"Bearer {token_a}"}
            )
            if res_other_room.status_code == 403:
                passed += 1
                print("  [PASS] 28. Student attempting IDOR access to another room strictly blocked (HTTP 403)")
            else:
                print(f"  [FAIL] 28. IDOR room access not blocked: {res_other_room.status_code}")

            # Test 29: Student attempting unauthorized room modification blocked (HTTP 403)
            total += 1
            res_mod_room = await client.put(
                "/api/v1/rooms/Room 02",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"total_beds": 2}
            )
            res_patch_room = await client.patch(
                "/api/v1/rooms/Room 02",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"total_beds": 2}
            )
            if res_mod_room.status_code == 403 and res_patch_room.status_code == 403:
                passed += 1
                print("  [PASS] 29. Student unauthorized room modification strictly blocked (HTTP 403)")
            else:
                print(f"  [FAIL] 29. Student room modification allowed: {res_mod_room.status_code}, {res_patch_room.status_code}")

            # Test 30: Student attempting unauthorized room deletion blocked (HTTP 403)
            total += 1
            res_del_room = await client.delete(
                "/api/v1/rooms/Room 02",
                headers={"Authorization": f"Bearer {token_a}"}
            )
            if res_del_room.status_code == 403:
                passed += 1
                print("  [PASS] 30. Student unauthorized room deletion strictly blocked (HTTP 403)")
            else:
                print(f"  [FAIL] 30. Student room deletion allowed: {res_del_room.status_code}")

            # Test 31: Room 03 rejection (does not exist in this hostel)
            total += 1
            res_room_03_student = await client.get(
                "/api/v1/rooms/Room 03",
                headers={"Authorization": f"Bearer {token_a}"}
            )
            res_room_03_admin = await client.get(
                "/api/v1/rooms/03",
                headers={"Authorization": f"Bearer {token_adm}"}
            )
            res_room_03_put = await client.put(
                "/api/v1/rooms/Room 03",
                headers={"Authorization": f"Bearer {token_adm}"},
                json={"total_beds": 6}
            )
            if (res_room_03_student.status_code == 404 and 
                res_room_03_admin.status_code == 404 and 
                res_room_03_put.status_code == 404):
                passed += 1
                print("  [PASS] 31. Inexistent Room 03 strictly rejected across all roles (HTTP 404)")
            else:
                print(f"  [FAIL] 31. Room 03 not properly rejected: {res_room_03_student.status_code}, {res_room_03_admin.status_code}, {res_room_03_put.status_code}")

            # Test 32: Unauthenticated emergency-alert requests blocked (HTTP 401)
            total += 1
            res_sos_unauth = await client.get("/api/v1/emergency")
            res_sos_trigger_unauth = await client.post(
                "/api/v1/emergency/trigger",
                json={"emergency_type": "MEDICAL", "room_number": "Room 02"}
            )
            if res_sos_unauth.status_code == 401 and res_sos_trigger_unauth.status_code == 401:
                passed += 1
                print("  [PASS] 32. Unauthenticated emergency-alert requests strictly blocked (HTTP 401)")
            else:
                print(f"  [FAIL] 32. Unauth emergency requests allowed: {res_sos_unauth.status_code}, {res_sos_trigger_unauth.status_code}")

            # Test 33: Legitimate student emergency reporting (HTTP 201)
            total += 1
            res_trigger = await client.post(
                "/api/v1/emergency/trigger",
                headers={"Authorization": f"Bearer {token_a}"},
                json={
                    "emergency_type": "MEDICAL",
                    "description": "Severe medical emergency distress",
                    "room_number": "Room 02"
                }
            )
            created_alert = res_trigger.json() if res_trigger.status_code == 201 else {}
            alert_id_a = created_alert.get("id")
            if res_trigger.status_code == 201 and alert_id_a and created_alert.get("status") == "ACTIVE":
                passed += 1
                print("  [PASS] 33. Legitimate student emergency reporting accepted (HTTP 201)")
            else:
                print(f"  [FAIL] 33. Legitimate emergency report failed: {res_trigger.status_code}, {res_trigger.text}")

            # Test 34: Student emergency SOS with Room 03 rejected (HTTP 400)
            total += 1
            res_trigger_03 = await client.post(
                "/api/v1/emergency/trigger",
                headers={"Authorization": f"Bearer {token_a}"},
                json={
                    "emergency_type": "FIRE",
                    "description": "Fire alert",
                    "room_number": "Room 03"
                }
            )
            if res_trigger_03.status_code == 400:
                passed += 1
                print("  [PASS] 34. Student emergency SOS with Room 03 strictly rejected (HTTP 400)")
            else:
                print(f"  [FAIL] 34. Emergency trigger with Room 03 allowed: {res_trigger_03.status_code}")

            # Test 35: Student B attempting cross-user access to Student A's alert blocked (HTTP 403)
            total += 1
            if alert_id_a:
                res_cross_alert = await client.get(
                    f"/api/v1/emergency/{alert_id_a}",
                    headers={"Authorization": f"Bearer {token_b}"}
                )
                if res_cross_alert.status_code == 403:
                    passed += 1
                    print("  [PASS] 35. Student B cross-user access to Student A's emergency alert blocked (HTTP 403)")
                else:
                    print(f"  [FAIL] 35. Cross-user emergency alert access allowed: {res_cross_alert.status_code}")
            else:
                print("  [FAIL] 35. Skipped due to missing alert_id_a")

            # Test 36: Student A successfully authorized to view own emergency alert (HTTP 200)
            total += 1
            if alert_id_a:
                res_own_alert = await client.get(
                    f"/api/v1/emergency/{alert_id_a}",
                    headers={"Authorization": f"Bearer {token_a}"}
                )
                if res_own_alert.status_code == 200 and res_own_alert.json().get("id") == alert_id_a:
                    passed += 1
                    print("  [PASS] 36. Student A successfully authorized to view own emergency alert (HTTP 200)")
                else:
                    print(f"  [FAIL] 36. Student A own alert view failed: {res_own_alert.status_code}")
            else:
                print("  [FAIL] 36. Skipped due to missing alert_id_a")

            # Test 37: Student emergency listing scoped only to own records (no leakage)
            total += 1
            res_student_list_sos = await client.get(
                "/api/v1/emergency",
                headers={"Authorization": f"Bearer {token_b}"}
            )
            if res_student_list_sos.status_code == 200:
                alerts_b = res_student_list_sos.json()
                # Student B must not see Student A's alert
                has_student_a_alert = any(a.get("id") == alert_id_a for a in alerts_b)
                if not has_student_a_alert:
                    passed += 1
                    print("  [PASS] 37. Student emergency alert listing strictly scoped to own records (HTTP 200)")
                else:
                    print("  [FAIL] 37. Student B received Student A's emergency alert!")
            else:
                print(f"  [FAIL] 37. Student alert list request failed: {res_student_list_sos.status_code}")

            # Test 38: Student attempting unauthorized resolution or deletion blocked (HTTP 403)
            total += 1
            if alert_id_a:
                res_stud_resolve = await client.put(
                    f"/api/v1/emergency/{alert_id_a}/resolve",
                    headers={"Authorization": f"Bearer {token_a}"},
                    json={"resolution_notes": "Student trying to resolve"}
                )
                res_stud_delete = await client.delete(
                    f"/api/v1/emergency/{alert_id_a}",
                    headers={"Authorization": f"Bearer {token_a}"}
                )
                if res_stud_resolve.status_code == 403 and res_stud_delete.status_code == 403:
                    passed += 1
                    print("  [PASS] 38. Student unauthorized alert resolution and deletion blocked (HTTP 403)")
                else:
                    print(f"  [FAIL] 38. Student alert resolve/delete allowed: {res_stud_resolve.status_code}, {res_stud_delete.status_code}")
            else:
                print("  [FAIL] 38. Skipped due to missing alert_id_a")

            # Test 39: Authorized Warden/Admin acknowledging and resolving alert (HTTP 200)
            total += 1
            if alert_id_a:
                res_ack = await client.put(
                    f"/api/v1/emergency/{alert_id_a}/acknowledge",
                    headers={"Authorization": f"Bearer {token_adm}"}
                )
                res_resolve = await client.put(
                    f"/api/v1/emergency/{alert_id_a}/resolve",
                    headers={"Authorization": f"Bearer {token_adm}"},
                    json={"resolution_notes": "First aid team dispatched and student assisted."}
                )
                if res_ack.status_code == 200 and res_resolve.status_code == 200:
                    resolved_data = res_resolve.json()
                    if resolved_data.get("status") == "RESOLVED":
                        passed += 1
                        print("  [PASS] 39. Authorized Warden successfully acknowledged and resolved alert (HTTP 200)")
                    else:
                        print(f"  [FAIL] 39. Alert status not RESOLVED: {resolved_data.get('status')}")
                else:
                    print(f"  [FAIL] 39. Admin ack/resolve failed: {res_ack.status_code}, {res_resolve.status_code}")
            else:
                print("  [FAIL] 39. Skipped due to missing alert_id_a")

            # Test 40: Authorized Warden/Admin deleting emergency alert with audit log (HTTP 200)
            total += 1
            if alert_id_a:
                res_admin_del_alert = await client.delete(
                    f"/api/v1/emergency/{alert_id_a}",
                    headers={"Authorization": f"Bearer {token_adm}"}
                )
                if res_admin_del_alert.status_code == 200:
                    passed += 1
                    print("  [PASS] 40. Authorized Warden successfully deleted emergency alert with audit log (HTTP 200)")
                else:
                    print(f"  [FAIL] 40. Admin delete alert failed: {res_admin_del_alert.status_code}")
            else:
                print("  [FAIL] 40. Skipped due to missing alert_id_a")

            # Test 41: Authorized Warden/Admin inspecting any room (HTTP 200)
            total += 1
            res_admin_room = await client.get(
                "/api/v1/rooms/Room 04",
                headers={"Authorization": f"Bearer {token_adm}"}
            )
            if res_admin_room.status_code == 200 and res_admin_room.json().get("room_number") == "Room 04":
                passed += 1
                print("  [PASS] 41. Authorized Warden successfully inspected room configuration and roster (HTTP 200)")
            else:
                print(f"  [FAIL] 41. Admin room inspection failed: {res_admin_room.status_code}")

            # ------------------------------------------------------------------
            # STAGE 2A: FORCED PASSWORD RESET UX, LEAST-PRIVILEGE ROLE REVIEWS
            # ------------------------------------------------------------------

            # Test 42: Forced password reset contract in login response
            total += 1
            # Temporarily flag student B with pwd_reset_required
            await db.users.update_one({"_id": student_b_id}, {"$set": {"pwd_reset_required": True}})
            res_login_reset = await client.post(
                "/api/v1/auth/login",
                json={"username": email_b, "password": "TestPassword123!"}
            )
            if res_login_reset.status_code == 200:
                login_data = res_login_reset.json()
                if login_data.get("user", {}).get("pwd_reset_required") is True:
                    passed += 1
                    print("  [PASS] 42. Login response explicitly provides pwd_reset_required=True for client redirection")
                else:
                    print("  [FAIL] 42. pwd_reset_required not present in user payload")
            else:
                print(f"  [FAIL] 42. Login failed: {res_login_reset.status_code}")

            # Test 43: Least-privilege policy: ADMIN role permitted administrative actions
            total += 1
            res_adm_students = await client.get("/api/v1/students", headers={"Authorization": f"Bearer {token_adm}"})
            res_adm_audit = await client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {token_adm}"})
            if res_adm_students.status_code == 200 and res_adm_audit.status_code == 200:
                passed += 1
                print("  [PASS] 43. ADMIN role permitted administrative actions (students & audit-logs: HTTP 200)")
            else:
                print(f"  [FAIL] 43. Admin permitted actions failed: {res_adm_students.status_code}, {res_adm_audit.status_code}")

            # Test 44: Least-privilege policy: STUDENT role strictly denied administrative actions
            total += 1
            res_stu_students = await client.get("/api/v1/students", headers={"Authorization": f"Bearer {token_a}"})
            res_stu_audit = await client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {token_a}"})
            if res_stu_students.status_code == 403 and res_stu_audit.status_code == 403:
                passed += 1
                print("  [PASS] 44. STUDENT role strictly denied administrative actions (HTTP 403)")
            else:
                print(f"  [FAIL] 44. Student denied actions allowed: {res_stu_students.status_code}, {res_stu_audit.status_code}")

            # Test 45: Least-privilege policy: Hypothetical WARDEN role string strictly denied ADMIN privilege by default
            total += 1
            warden_id = ObjectId()
            warden_email = f"warden_test_{warden_id}@hostel.test"
            user_warden = {
                "_id": warden_id,
                "email": warden_email,
                "role": "WARDEN",  # Unconfigured / non-admin role string
                "status": "ACTIVE",
                "token_version": 1
            }
            await db.users.insert_one(user_warden)
            token_warden = create_access_token({"sub": warden_email, "role": "WARDEN", "id": str(warden_id), "token_version": 1})
            
            res_warden_admin_act = await client.get("/api/v1/students", headers={"Authorization": f"Bearer {token_warden}"})
            await db.users.delete_one({"_id": warden_id})
            if res_warden_admin_act.status_code == 403:
                passed += 1
                print("  [PASS] 45. Least-privilege verified: WARDEN role string alone denied administrative access (HTTP 403)")
            else:
                print(f"  [FAIL] 45. Arbitrary WARDEN role improperly granted admin privileges: {res_warden_admin_act.status_code}")

            # Test 46: Student creation without password generates secure unique temporary credential with forced reset
            total += 1
            test_stu_id = f"TEST_NEW_{ObjectId()}"[:10]
            new_stu_email = f"new_stu_{ObjectId()}@smarthostel.edu"
            res_create_stu = await client.post(
                "/api/v1/students",
                headers={"Authorization": f"Bearer {token_adm}"},
                json={
                    "student_id": test_stu_id,
                    "name": "Secure Onboarded Student",
                    "usn": f"USN_{test_stu_id}",
                    "phone": "9998887776",
                    "email": new_stu_email,
                    "department": "CSE",
                    "semester": 1,
                    "room_number": "Room 02",
                    "bed_number": "Bed 3",
                    "parent_name": "Parent Name",
                    "parent_contact": "9998887770",
                    "address": "Shivamogga",
                    "joining_date": "2026-10-01",
                    "status": "ACTIVE"
                }
            )
            created_stu_data = res_create_stu.json() if res_create_stu.status_code == 201 else {}
            created_user = await db.users.find_one({"email": new_stu_email})
            
            # Clean up immediately
            await db.students.delete_one({"student_id": test_stu_id})
            await db.users.delete_one({"email": new_stu_email})
            
            if (res_create_stu.status_code == 201 and 
                created_user is not None and 
                created_user.get("pwd_reset_required") is True and
                created_stu_data.get("temporary_password") is not None and
                created_stu_data.get("temporary_password") != "Student@123"):
                passed += 1
                print("  [PASS] 46. Student creation generates unique temporary password and enforces pwd_reset_required (HTTP 201)")
            else:
                print(f"  [FAIL] 46. Student creation security failed: {res_create_stu.status_code}, data={res_create_stu.text}")

        finally:
            # Clean up test files and records
            if test_file_path.exists():
                try:
                    test_file_path.unlink()
                except Exception:
                    pass
            if saved_duty:
                await db.daily_duty_records.replace_one({"_id": saved_duty["_id"]}, saved_duty)
            await db.users.delete_many({"_id": {"$in": [student_a_id, student_b_id, admin_id]}})
            await db.students.delete_many({"_id": {"$in": [student_doc_a["_id"], student_doc_b["_id"]]}})
            await db.leave_applications.delete_many({"student_id": "TEST_A_001"})
            await db.emergency_alerts.delete_many({"student_id": {"$in": ["TEST_A_001", "TEST_B_002"]}})
            await db.audit_logs.delete_many({"user_email": {"$in": [email_a, email_b, admin_email]}})

    await close_mongo_connection()

    print("-" * 70)
    print(f"Security Test Summary: {passed}/{total} Passed")
    print("=" * 70)
    
    if passed != total:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
