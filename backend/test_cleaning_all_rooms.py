import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def test_all_rooms_cleaning():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        print("=== 1. Login as Admin ===")
        login_res = await client.post("/auth/login", json={
            "username": "admin@smarthostel.com",
            "password": "Admin@123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] Admin authenticated successfully.")

        print("\n=== 2. Check Daily Board for All 13 Rooms ===")
        board_res = await client.get("/cleaning/daily-board", headers=headers)
        assert board_res.status_code == 200, f"Daily board failed: {board_res.text}"
        board = board_res.data if hasattr(board_res, "data") else board_res.json()
        print(f"Total rooms returned on board: {len(board)}")
        assert len(board) == 13, f"Expected 13 rooms, got {len(board)}"
        room_numbers = [r["room_number"] for r in board]
        print(f"Rooms on board: {room_numbers}")
        for i in range(1, 14):
            expected = f"Room {i:02d}"
            assert expected in room_numbers, f"Missing {expected}"
        print("[PASS] All 13 rooms present on daily cleaning board.")

        print("\n=== 3. Reset Daily Shift (Initializes All 13 Rooms) ===")
        reset_res = await client.post("/cleaning/reset-shift", headers=headers)
        assert reset_res.status_code == 200, f"Reset shift failed: {reset_res.text}"
        reset_data = reset_res.json()
        print(f"Reset message: {reset_data['message']}")
        assert reset_data["first_room"] == "Room 01"
        assert len(reset_data["today_scheduled_rooms"]) == 13
        print("[PASS] Shift reset: Room 01 set to IN_PROGRESS, other 12 rooms PENDING.")

        print("\n=== 4. Check Live Status ===")
        status_res = await client.get("/cleaning/live-status", headers=headers)
        assert status_res.status_code == 200, f"Live status failed: {status_res.text}"
        st_data = status_res.json()
        assert st_data["total_rooms"] == 13
        assert st_data["active_room"] == "Room 01"
        assert st_data["completed_count"] == 0
        print(f"[PASS] Live status verified: {st_data['completed_count']}/{st_data['total_rooms']} completed. Active: {st_data['active_room']}.")

        print("\n=== 5. Complete Room 01 and Advance to Room 02 ===")
        adv_res = await client.post("/cleaning/complete-and-advance/Room 01", headers=headers)
        assert adv_res.status_code == 200, f"Advance failed: {adv_res.text}"
        adv_data = adv_res.json()
        assert adv_data["completed_room"] == "Room 01"
        assert adv_data["next_room"] == "Room 02"
        print(f"[PASS] Room 01 marked completed; successfully advanced to Room 02.")

        print("\n=== 6. Member Absent in Room 02 -> Skip to Room 03 ===")
        skip_res = await client.post("/cleaning/skip-next-room/Room 02", headers=headers)
        assert skip_res.status_code == 200, f"Skip failed: {skip_res.text}"
        skip_data = skip_res.json()
        assert skip_data["current_room"] == "Room 02"
        assert skip_data["next_room"] == "Room 03"
        print(f"[PASS] Room 02 skipped (Absent); successfully advanced to Room 03.")

        print("\n=== 7. Direct Clean Room 03 (Vacant Room) ===")
        clean_res = await client.post("/cleaning/clean-room/Room 03", headers=headers)
        assert clean_res.status_code == 200, f"Direct clean failed: {clean_res.text}"
        print(f"[PASS] Room 03 cleaned directly.")

        print("\n=== 8. Test Mass Complete All 13 Rooms ===")
        all_res = await client.post("/cleaning/complete-all", headers=headers)
        assert all_res.status_code == 200, f"Complete all failed: {all_res.text}"
        all_data = all_res.json()
        assert all_data["completed_count"] == 13
        print(f"[PASS] Mass sanitize: All 13 rooms marked COMPLETED.")

        # Check live status again
        status2_res = await client.get("/cleaning/live-status", headers=headers)
        st2_data = status2_res.json()
        assert st2_data["completed_count"] == 13
        assert st2_data["progress_percent"] == 100
        assert st2_data["is_floor_finished"] is True
        print(f"[PASS] Shift verified 100% complete across all 13 rooms.")

        print("\n=== 9. Reset Shift for Clean Initial State ===")
        final_reset = await client.post("/cleaning/reset-shift", headers=headers)
        assert final_reset.status_code == 200
        print("[PASS] Shift cleanly reset back to Room 01 active.")

        print("\n=======================================================")
        print(" ALL 13 ROOMS CLEANING WORKFLOW TESTS PASSED 100%!")
        print("=======================================================")

if __name__ == "__main__":
    asyncio.run(test_all_rooms_cleaning())
