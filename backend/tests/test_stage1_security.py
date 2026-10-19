import asyncio
import sys
import os
import io
import shutil
import tempfile
from pathlib import Path
import httpx
from bson import ObjectId

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
            async with lifespan(app):
                pass
        except RuntimeError as e:
            if "JWT_SECRET_KEY" in str(e):
                refusal_passed = True
        finally:
            settings.ENVIRONMENT = orig_env
            settings.JWT_SECRET_KEY = orig_key

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
            "status": "ACTIVE"
        }

        user_b = {
            "_id": student_b_id,
            "email": email_b,
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

        finally:
            # Clean up test files and records
            if test_file_path.exists():
                try:
                    test_file_path.unlink()
                except Exception:
                    pass
            await db.users.delete_many({"_id": {"$in": [student_a_id, student_b_id, admin_id]}})
            await db.students.delete_many({"_id": {"$in": [student_doc_a["_id"], student_doc_b["_id"]]}})
            await db.leave_applications.delete_many({"student_id": "TEST_A_001"})

    await close_mongo_connection()

    print("-" * 70)
    print(f"Security Test Summary: {passed}/{total} Passed")
    print("=" * 70)
    
    if passed != total:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
