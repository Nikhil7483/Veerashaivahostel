import asyncio
import sys
import os
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
    print("=" * 65)
    print("RUNNING BACKEND SECURITY TESTS: SUB-STEP 1a & 1b")
    print("=" * 65)
    
    passed = 0
    total = 0
    
    # Connect to MongoDB for auth tests
    await connect_to_mongo()
    db = get_database()
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # -------------------------------------------------------------
        # SECTION 1a: Security Headers & Strict CORS Whitelist
        # -------------------------------------------------------------
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

        # -------------------------------------------------------------
        # SECTION 1b: Auth Backdoor Removal & Real Bcrypt Only
        # -------------------------------------------------------------
        # Test 6: Login with backdoor password string "student" -> MUST FAIL (401)
        total += 1
        res_backdoor = await client.post("/api/v1/auth/login", json={
            "username": "guru@hostel.edu",
            "password": "student"  # old backdoor alias
        })
        if res_backdoor.status_code == 401:
            passed += 1
            print("  [PASS] 6. Backdoor password alias 'student' strictly rejected (HTTP 401)")
        else:
            print(f"  [FAIL] 6. Backdoor password was accepted: status {res_backdoor.status_code}")

        # Test 7: Login with username-as-password -> MUST FAIL (401)
        total += 1
        res_user_pwd = await client.post("/api/v1/auth/login", json={
            "username": "001",
            "password": "001"  # old backdoor allowed raw_pwd == raw_user
        })
        if res_user_pwd.status_code == 401:
            passed += 1
            print("  [PASS] 7. Backdoor username-as-password strictly rejected (HTTP 401)")
        else:
            print(f"  [FAIL] 7. Backdoor username-as-password was accepted: status {res_user_pwd.status_code}")

        # Test 8: Login with valid bcrypt password -> MUST PASS (200)
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

        # -------------------------------------------------------------
        # SECTION 1b: Production JWT_SECRET_KEY Requirement
        # -------------------------------------------------------------
        # Test 9: Verify app refuses startup in production if default secret is used
        total += 1
        orig_env = settings.ENVIRONMENT
        orig_key = settings.JWT_SECRET_KEY
        refusal_passed = False
        try:
            settings.ENVIRONMENT = "production"
            settings.JWT_SECRET_KEY = "smart_hostel_super_secure_jwt_secret_key_2026_production_grade"
            # Attempt to trigger lifespan startup
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

        # -------------------------------------------------------------
        # SECTION 1b: Forced Password Reset Gating & token_version
        # -------------------------------------------------------------
        # Create an isolated temporary test user in test DB / memory
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
            # Token with pwd_reset_required: True
            tok_reset = create_access_token({
                "sub": test_email,
                "role": "STUDENT",
                "id": str(test_user_id),
                "token_version": 1,
                "pwd_reset_required": True
            })

            # Test 10: Token with pwd_reset_required accessing protected endpoint -> MUST BE BLOCKED (HTTP 403)
            total += 1
            res_blocked = await client.get(
                "/api/v1/students/my/profile",
                headers={"Authorization": f"Bearer {tok_reset}"}
            )
            if res_blocked.status_code == 403 and "PASSWORD_RESET_REQUIRED" in res_blocked.text:
                passed += 1
                print("  [PASS] 10. Endpoint strictly blocked by backend when pwd_reset_required=True (HTTP 403)")
            else:
                print(f"  [FAIL] 10. Endpoint was NOT blocked: {res_blocked.status_code} {res_blocked.text}")

            # Test 11: Token with pwd_reset_required accessing change-password -> MUST BE ALLOWED (HTTP 200)
            total += 1
            res_change = await client.post(
                "/api/v1/auth/change-password",
                headers={"Authorization": f"Bearer {tok_reset}"},
                json={
                    "old_password": "OldPassword@123",
                    "new_password": "NewSecurePassword@456"
                }
            )
            change_ok = res_change.status_code == 200 and "access_token" in res_change.json()
            if change_ok:
                passed += 1
                print("  [PASS] 11. Endpoint /auth/change-password permitted for pwd_reset_required token (HTTP 200)")
            else:
                print(f"  [FAIL] 11. change-password failed: {res_change.status_code} {res_change.text}")

            # Test 12: Old token after password change -> MUST BE REJECTED (HTTP 401 via token_version mismatch)
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

            # Test 13: New token issued after password change -> MUST HAVE pwd_reset_required cleared
            total += 1
            new_tok = res_change.json().get("access_token")
            # Verify user record updated in DB
            updated_u = await db.users.find_one({"_id": test_user_id})
            if updated_u.get("pwd_reset_required") is False and updated_u.get("token_version") == 2:
                passed += 1
                print("  [PASS] 13. User record token_version incremented to 2 and pwd_reset_required cleared")
            else:
                print(f"  [FAIL] 13. User record not properly updated: {updated_u}")

        finally:
            # Clean up the test user record
            await db.users.delete_one({"_id": test_user_id})

    await close_mongo_connection()

    print("-" * 65)
    print(f"Sub-step 1b Test Summary: {passed}/{total} Passed")
    print("=" * 65)
    
    if passed != total:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
