import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def test_absent_students_exemption():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        print("=== 1. Login as Admin / Cleaning Supervisor ===")
        login_res = await client.post("/auth/login", json={
            "username": "admin@smarthostel.com",
            "password": "Admin@123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] Authenticated successfully.")

        test_date = "2026-09-25"  # A Friday

        # First unlock sessions if previously locked
        await client.post("/food-allocation/cleaning/unlock", json={"date": test_date, "session": "morning"}, headers=headers)
        await client.post("/food-allocation/cleaning/unlock", json={"date": test_date, "session": "night"}, headers=headers)

        print("\n=== 2. Check Morning Tiffin Session for Absent Exemption ===")
        m_res = await client.get(f"/food-allocation/cleaning/morning-tiffin/{test_date}?sim_time=06:00&sim_day=Friday", headers=headers)
        assert m_res.status_code == 200, f"Morning tiffin failed: {m_res.text}"
        m_data = m_res.json()
        students = m_data["students"]
        summary = m_data["summary"]

        present_students = [s for s in students if s["attendance_status"] == "PRESENT"]
        absent_students = [s for s in students if s["attendance_status"] in ["ABSENT", "LEAVE"]]

        print(f"Total students: {summary['total_students']}")
        print(f"Present count: {summary['present_count']}, Absent count: {summary['absent_count']}, Leave count: {summary['leave_count']}")
        assert len(absent_students) > 0, "Expected some absent or leave students"
        print(f"Identified {len(absent_students)} absent/leave students.")

        # Verify all absent students have tiffin_required=False, box_required=False
        for a_st in absent_students:
            assert a_st["tiffin_required"] is False, f"Absent student {a_st['student_id']} counted in tiffin"
            assert a_st["box_required"] is False, f"Absent student {a_st['student_id']} counted in box"
        print("[PASS] All absent/leave students have tiffin_required=False and box_required=False.")

        target_absent = absent_students[0]
        print(f"\n=== 3. Attempt to record Yes/No for Absent Student #{target_absent['student_id']} ({target_absent['name']}) ===")
        save_m_fail = await client.post("/food-allocation/cleaning/morning-tiffin/save-record", json={
            "date": test_date,
            "student_id": target_absent["student_id"],
            "tiffin_required": True,
            "box_required": True
        }, headers=headers)
        assert save_m_fail.status_code == 400, f"Expected 400 Bad Request for absent student, got: {save_m_fail.status_code} ({save_m_fail.text})"
        print(f"[PASS] Server strictly rejected counting absent student as Yes/No: {save_m_fail.json()['detail']}")

        target_present = present_students[0]
        print(f"\n=== 4. Record Yes/No for Present Student #{target_present['student_id']} ({target_present['name']}) ===")
        save_m_ok = await client.post("/food-allocation/cleaning/morning-tiffin/save-record", json={
            "date": test_date,
            "student_id": target_present["student_id"],
            "tiffin_required": True,
            "box_required": False
        }, headers=headers)
        assert save_m_ok.status_code == 200, f"Expected 200 for present student, got: {save_m_ok.text}"
        print(f"[PASS] Present student successfully recorded as Tiffin=True, Box=False.")

        print("\n=== 5. Check Night Meal Session for Absent Exemption ===")
        n_res = await client.get(f"/food-allocation/cleaning/night-meal/{test_date}?sim_time=17:30", headers=headers)
        assert n_res.status_code == 200, f"Night meal failed: {n_res.text}"
        n_data = n_res.json()
        n_students = n_data["students"]
        n_absent = [s for s in n_students if s["attendance_status"] in ["ABSENT", "LEAVE"]]

        for a_st in n_absent:
            assert a_st["meal_required"] is False, f"Absent student {a_st['student_id']} counted in night meal"
        print("[PASS] All absent/leave students have meal_required=False.")

        print(f"\n=== 6. Attempt to record Night Meal for Absent Student #{target_absent['student_id']} ===")
        save_n_fail = await client.post("/food-allocation/cleaning/night-meal/save-record", json={
            "date": test_date,
            "student_id": target_absent["student_id"],
            "meal_required": True
        }, headers=headers)
        assert save_n_fail.status_code == 400, f"Expected 400 Bad Request for absent student night meal, got: {save_n_fail.status_code}"
        print(f"[PASS] Server strictly rejected recording night meal for absent student: {save_n_fail.json()['detail']}")

        print("\n=======================================================")
        print(" ALL ABSENT EXEMPTION & COUNT TESTS PASSED 100%!")
        print("=======================================================")

if __name__ == "__main__":
    asyncio.run(test_absent_students_exemption())
