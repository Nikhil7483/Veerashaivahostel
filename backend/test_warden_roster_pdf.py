# -*- coding: utf-8 -*-
"""
End-to-End Test for Warden Meal Count Roster and PDF Download
"""
import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"
TEST_DATE = "2026-09-18"

async def test_warden_roster_and_pdf():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        print("=== 1. Login as Admin / Warden ===")
        login_res = await client.post("/auth/login", json={
            "username": "admin@smarthostel.com",
            "password": "Admin@123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] Warden authenticated.")

        print("\n=== 2. Check Warden Roster JSON Endpoint ===")
        roster_res = await client.get(f"/food-allocation/warden/roster/{TEST_DATE}", headers=headers)
        assert roster_res.status_code == 200, f"Roster endpoint failed: {roster_res.text}"
        data = roster_res.json()

        assert data["date"] == TEST_DATE
        assert data["formatted_date"] == "18/09/2026", f"Expected 18/09/2026, got {data['formatted_date']}"
        assert data["total_present"] == 35, f"Expected 35 present students, got {data['total_present']}"
        assert len(data["roster"]) == data["total_present"], f"Expected {data['total_present']} present students in roster, got {len(data['roster'])}"

        # Verify all roster records are strictly PRESENT students
        for s in data["roster"]:
            assert s["attendance_status"] == "PRESENT", f"Expected only PRESENT students, found {s['attendance_status']} for {s['name']}"
            assert s["is_exempt"] is False

        # Verify counts are strictly counting present students and not zero
        tiffin_cnt = data['morning_summary']['tiffin_count']
        box_cnt = data['morning_summary']['box_count']
        dinner_cnt = data['night_summary']['night_meal_count']
        assert tiffin_cnt > 0, f"Tiffin count must be > 0, got {tiffin_cnt}"
        assert box_cnt > 0, f"Box count must be > 0, got {box_cnt}"
        assert dinner_cnt > 0, f"Dinner count must be > 0, got {dinner_cnt}"

        print(f"[PASS] Present-Only Roster verified: {len(data['roster'])} present residents listed.")
        print(f"       Tiffin count: {tiffin_cnt}, Box count: {box_cnt}, Dinner count: {dinner_cnt}")

        print("\n=== 3. Test Official Meal Count PDF Download Endpoint ===")
        pdf_res = await client.get(f"/food-allocation/download-pdf/{TEST_DATE}?download=1", headers=headers)
        assert pdf_res.status_code == 200, f"PDF generation failed: {pdf_res.text}"
        assert pdf_res.headers.get("content-type") == "application/pdf"
        assert "attachment" in pdf_res.headers.get("content-disposition", "")
        assert "18_09_2026.pdf" in pdf_res.headers.get("content-disposition", "")
        assert len(pdf_res.content) > 5000, f"PDF file size too small ({len(pdf_res.content)} bytes)"
        assert pdf_res.content.startswith(b"%PDF"), "Generated file does not have valid PDF magic bytes"

        print(f"[PASS] PDF Download validated: {len(pdf_res.content)} bytes.")
        print(f"       Filename: {pdf_res.headers.get('content-disposition')}")

        print("\n=== 4. Test Kitchen Meal Order Endpoint (Warden Verification) ===")
        ko_res = await client.get(f"/food-allocation/kitchen-order/{TEST_DATE}", headers=headers)
        assert ko_res.status_code == 200, f"Kitchen order failed: {ko_res.text}"
        ko_data = ko_res.json()
        assert len(ko_data["students"]) == data["total_present"]
        assert ko_data["summary"]["present_residents"] == 35
        assert ko_data["summary"]["morning_order"] > 0
        assert ko_data["summary"]["night_order"] > 0
        print(f"[PASS] Kitchen order verified: {len(ko_data['students'])} present residents loaded.")

        print("\n=======================================================")
        print(" ALL WARDEN ROSTER & PDF DOWNLOAD TESTS PASSED 100%! ")
        print("=======================================================")

if __name__ == "__main__":
    asyncio.run(test_warden_roster_and_pdf())
