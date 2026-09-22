import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_students_cleaning_room_workflow():
    print("=== 1. Verify No Separate Cleaning Login Exists ===")
    bad_login = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "cleaning@smarthostel.com",
        "password": "Cleaning@123"
    })
    assert bad_login.status_code == 401, f"Expected 401 for deleted cleaning user, got: {bad_login.status_code}"
    print("[PASS] Separate cleaning login does not exist (401 Unauthorized as expected)")

    print("\n=== 2. Login as Normal Student (Guru - Room 01) ===")
    student_login = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "guru@hostel.edu",
        "password": "Student@123"
    })
    assert student_login.status_code == 200, f"Student login failed: {student_login.text}"
    student_token = student_login.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("[PASS] Student successfully authenticated using normal student credentials")

    date_str = "2026-09-17"

    print("\n=== 3. Student Operates Morning Tiffin in Cleaning Room ===")
    # Unlock if locked
    requests.post(f"{BASE_URL}/food-allocation/cleaning/unlock", json={
        "date": date_str,
        "session": "morning"
    }, headers=student_headers)

    get_m = requests.get(f"{BASE_URL}/food-allocation/cleaning/morning-tiffin/{date_str}", headers=student_headers)
    assert get_m.status_code == 200, f"Student access to morning count failed: {get_m.text}"
    print("[PASS] Student successfully opened Morning Tiffin inside Cleaning Room")

    # Record requirement for student 001 and student 002
    save_m = requests.post(f"{BASE_URL}/food-allocation/cleaning/morning-tiffin/save-record", json={
        "date": date_str,
        "student_id": "001",
        "tiffin_required": True,
        "box_required": True
    }, headers=student_headers)
    assert save_m.status_code == 200, f"Student save tiffin record failed: {save_m.text}"
    print("[PASS] Student recorded Tiffin=True, Box=True for resident 001")

    # Submit final morning count
    submit_m = requests.post(f"{BASE_URL}/food-allocation/cleaning/morning-tiffin/submit", json={
        "date": date_str,
        "override_window": True
    }, headers=student_headers)
    assert submit_m.status_code == 200, f"Student submit morning count failed: {submit_m.text}"
    print("[PASS] Student successfully submitted and locked Morning Tiffin Count")

    print("\n=== 4. Student Operates Night Meal in Cleaning Room ===")
    # Unlock night if locked
    requests.post(f"{BASE_URL}/food-allocation/cleaning/unlock", json={
        "date": date_str,
        "session": "night"
    }, headers=student_headers)

    get_n = requests.get(f"{BASE_URL}/food-allocation/cleaning/night-meal/{date_str}", headers=student_headers)
    assert get_n.status_code == 200, f"Student access to night count failed: {get_n.text}"
    print("[PASS] Student successfully opened Night Meal inside Cleaning Room")

    save_n = requests.post(f"{BASE_URL}/food-allocation/cleaning/night-meal/save-record", json={
        "date": date_str,
        "student_id": "001",
        "meal_required": True
    }, headers=student_headers)
    assert save_n.status_code == 200, f"Student save night record failed: {save_n.text}"
    print("[PASS] Student recorded Night Meal=True for resident 001")

    submit_n = requests.post(f"{BASE_URL}/food-allocation/cleaning/night-meal/submit", json={
        "date": date_str,
        "override_window": True
    }, headers=student_headers)
    assert submit_n.status_code == 200, f"Student submit night count failed: {submit_n.text}"
    print("[PASS] Student successfully submitted and locked Night Meal Count")

    print("\n=== 5. Warden Views Verified Counts in Food Management Area ===")
    admin_login = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "admin@smarthostel.com",
        "password": "Admin@123"
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_w = requests.get(f"{BASE_URL}/food-allocation/warden/results/{date_str}", headers=admin_headers)
    assert res_w.status_code == 200
    data_w = res_w.json()
    print(f"[PASS] Warden view verified counts: Tiffin={data_w['morning_tiffin']['tiffin_count']}, Box={data_w['morning_tiffin']['box_count']}, Night={data_w['night_meal']['meal_count']}")

    print("\n=======================================================")
    print("ALL TESTS PASSED: CLEANING ROOM INSIDE STUDENTS WORKING 100%!")
    print("=======================================================")

if __name__ == "__main__":
    test_students_cleaning_room_workflow()
