import asyncio
import sys
from pathlib import Path
import httpx

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.main import app
from app.core.config import settings

async def test_substep_1a():
    print("=" * 60)
    print("RUNNING BACKEND SECURITY TESTS: SUB-STEP 1a")
    print("=" * 60)
    
    passed = 0
    total = 0
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Test 1: Security Headers
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
            print("  [PASS] Security headers present (nosniff, DENY, referrer-policy, XSS)")
        else:
            print(f"  [FAIL] Security headers missing or incomplete: {dict(h)}")
            
        # Test 2: Whitelisted CORS domain receives Access-Control-Allow-Origin
        total += 1
        res_cors_ok = await client.get(
            "/",
            headers={"Origin": "https://veerashaivahostel.vercel.app"}
        )
        cors_header = res_cors_ok.headers.get("access-control-allow-origin")
        if cors_header == "https://veerashaivahostel.vercel.app":
            passed += 1
            print("  [PASS] Whitelisted Vercel origin accepted by CORS")
        else:
            print(f"  [FAIL] Whitelisted Vercel origin rejected by CORS: {cors_header}")

        # Test 3: Unauthorized origin does NOT receive Access-Control-Allow-Origin
        total += 1
        res_cors_bad = await client.get(
            "/",
            headers={"Origin": "https://evil-unauthorized-site.com"}
        )
        bad_cors = res_cors_bad.headers.get("access-control-allow-origin")
        if not bad_cors or bad_cors == "null":
            passed += 1
            print("  [PASS] Malicious/unauthorized origin blocked by CORS")
        else:
            print(f"  [FAIL] Malicious origin erroneously allowed by CORS: {bad_cors}")

        # Test 4: Custom domain whitelisted
        total += 1
        res_custom = await client.get(
            "/",
            headers={"Origin": "https://veerashaivaboyshostel.in"}
        )
        custom_header = res_custom.headers.get("access-control-allow-origin")
        if custom_header == "https://veerashaivaboyshostel.in":
            passed += 1
            print("  [PASS] Whitelisted custom domain accepted by CORS")
        else:
            print(f"  [FAIL] Custom domain rejected by CORS: {custom_header}")

        # Test 5: Production Docs Gating
        total += 1
        res_docs = await client.get("/api/v1/docs")
        if settings.ENVIRONMENT == "production" and not getattr(settings, "ENABLE_DOCS", False):
            if res_docs.status_code == 404:
                passed += 1
                print("  [PASS] Production docs strictly gated (HTTP 404)")
            else:
                print(f"  [FAIL] Production docs unexpectedly accessible: status {res_docs.status_code}")
        else:
            passed += 1
            print(f"  [SKIP/PASS] Environment is '{settings.ENVIRONMENT}', docs status: {res_docs.status_code}")

        # Test 6: Root endpoint responsiveness
        total += 1
        res_root = await client.get("/")
        if res_root.status_code == 200 and res_root.json().get("status") == "online":
            passed += 1
            print("  [PASS] Root endpoint healthy (HTTP 200)")
        else:
            print(f"  [FAIL] Root endpoint failed: {res_root.status_code}")

    print("-" * 60)
    print(f"Sub-step 1a Test Summary: {passed}/{total} Passed")
    print("=" * 60)
    
    if passed != total:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_substep_1a())
