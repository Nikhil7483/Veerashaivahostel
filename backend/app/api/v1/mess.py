from fastapi import APIRouter, Depends, HTTPException, status
from app.database.connection import get_database
from app.core.dependencies import get_current_user, require_admin, require_student, log_audit
from app.schemas.all_schemas import MessMenuUpdate, MessFeedbackCreate, MealCountUpdate
from datetime import datetime, timedelta
from typing import Optional, List

router = APIRouter(prefix="/mess", tags=["Mess & Dining"])

OFFICIAL_WEEKLY_MENU = [
    {
        "day": "Monday",
        "order": 1,
        "breakfast": "Pulav (Tomato Bath)",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    {
        "day": "Tuesday",
        "order": 2,
        "breakfast": "Chitranna (Lemon Rice)",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    {
        "day": "Wednesday",
        "order": 3,
        "breakfast": "Upma",
        "lunch": "—",
        "dinner": "Rice / Chapati + Vegetable Sambar*"
    },
    {
        "day": "Thursday",
        "order": 4,
        "breakfast": "Puliyogare (Tamarind Rice)",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    {
        "day": "Friday",
        "order": 5,
        "breakfast": "Vangi Bath",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Vegetable Sambar"
    },
    {
        "day": "Saturday",
        "order": 6,
        "breakfast": "Avalakki (Poha)",
        "lunch": "—",
        "dinner": "Rice / Ragi Mudde + Soppina Sambar (Greens Sambar)"
    },
    {
        "day": "Sunday",
        "order": 7,
        "breakfast": "Idli, Chutney, Sambar",
        "lunch": "Anna Sambar (Rice & Sambar)",
        "dinner": "Shavige Payasa (Wheat Payasa) + Rice & Sambar"
    }
]

DAY_ORDER_MAP = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 7
}

@router.get("/menu")
async def get_mess_menu(current_user: dict = Depends(get_current_user)):
    db = get_database()
    menu_list = await db.mess_menu.find({}).to_list(10)
    
    # If empty or not yet seeded with official menu, seed it automatically!
    if not menu_list:
        for item in OFFICIAL_WEEKLY_MENU:
            doc = {
                "day": item["day"],
                "order": item["order"],
                "breakfast": item["breakfast"],
                "lunch": item["lunch"],
                "dinner": item["dinner"],
                "updated_at": datetime.utcnow()
            }
            await db.mess_menu.insert_one(doc)
        menu_list = await db.mess_menu.find({}).to_list(10)
        
    for m in menu_list:
        m["id"] = str(m["_id"])
        del m["_id"]
        
    # Sort strictly Monday to Sunday
    menu_list.sort(key=lambda x: DAY_ORDER_MAP.get(x.get("day", ""), 99))
    return menu_list

@router.post("/reset-official-menu")
async def reset_official_menu(current_user: dict = Depends(require_admin)):
    """
    Resets the mess schedule to the official hostel 7-day routine menu:
    Breakfast (7:00 to 8:00 AM) and Dinner (8:00 to 9:00 PM), with Sunday Special Lunch (1:00 to 2:00 PM).
    """
    db = get_database()
    for item in OFFICIAL_WEEKLY_MENU:
        await db.mess_menu.update_one(
            {"day": item["day"]},
            {"$set": {
                "order": item["order"],
                "breakfast": item["breakfast"],
                "lunch": item["lunch"],
                "dinner": item["dinner"],
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
    await log_audit(current_user["email"], "MESS_MENU_RESET_OFFICIAL", "MESS", "WEEKLY_MENU")
    return {"message": "Official 7-day mess menu timetable restored successfully."}

@router.put("/menu")
async def update_mess_menu(menu_data: List[MessMenuUpdate], current_user: dict = Depends(require_admin)):
    db = get_database()
    for item in menu_data:
        await db.mess_menu.update_one(
            {"day": item.day},
            {"$set": {
                "breakfast": item.breakfast,
                "lunch": item.lunch or "—",
                "dinner": item.dinner,
                "order": DAY_ORDER_MAP.get(item.day, 99),
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
    await log_audit(current_user["email"], "MESS_MENU_UPDATED", "MESS", "WEEKLY_MENU")
    return {"message": "Mess menu updated successfully."}

@router.post("/feedback", status_code=status.HTTP_201_CREATED)
async def submit_mess_feedback(feedback_data: MessFeedbackCreate, current_user: dict = Depends(require_student)):
    db = get_database()
    student = await db.students.find_one({"email": current_user["email"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")
        
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Check if student already gave feedback for this meal today
    existing = await db.mess_feedback.find_one({
        "student_id": student["student_id"],
        "date": today_str,
        "meal_type": feedback_data.meal_type
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You have already submitted feedback for {feedback_data.meal_type} today."
        )
        
    doc = {
        "student_id": student["student_id"],
        "student_name": student["name"],
        "room_number": student.get("room_number"),
        "date": today_str,
        "meal_type": feedback_data.meal_type,
        "comment": feedback_data.comment.strip(),
        "created_at": datetime.utcnow()
    }
    
    res = await db.mess_feedback.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    del doc["_id"]
    return doc

@router.get("/feedback")
async def get_mess_feedback(
    date: Optional[str] = None,
    meal_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {}
    if date:
        query["date"] = date
    if meal_type:
        query["meal_type"] = meal_type
        
    cursor = db.mess_feedback.find(query).sort("created_at", -1).limit(50)
    feedbacks = []
    async for f in cursor:
        f["id"] = str(f["_id"])
        del f["_id"]
        feedbacks.append(f)
    return feedbacks

@router.get("/analytics")
async def get_mess_analytics(current_user: dict = Depends(require_admin)):
    db = get_database()
    all_feedbacks = await db.mess_feedback.find({}).to_list(500)
    
    if not all_feedbacks:
        return {
            "total_feedback": 0,
            "breakfast_count": 0,
            "lunch_count": 0,
            "dinner_count": 0,
            "recent_count": 0
        }
        
    total = len(all_feedbacks)
    breakfast_count = sum(1 for f in all_feedbacks if f.get("meal_type") == "BREAKFAST")
    lunch_count = sum(1 for f in all_feedbacks if f.get("meal_type") == "LUNCH")
    dinner_count = sum(1 for f in all_feedbacks if f.get("meal_type") == "DINNER")
    
    # Weekly feedback aggregation
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    recent = [f for f in all_feedbacks if f.get("date", "") >= seven_days_ago]
    
    return {
        "total_feedback": total,
        "breakfast_count": breakfast_count,
        "lunch_count": lunch_count,
        "dinner_count": dinner_count,
        "recent_count": len(recent)
    }

@router.get("/meal-counts")
async def get_meal_counts(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the daily meal count analytics, compared directly against daily student attendance.
    Eligible Meal Count = Count of students marked PRESENT in hostel attendance.
    Also returns cleaning status and today's selected food items.
    """
    db = get_database()
    today_str = date or datetime.now().strftime("%Y-%m-%d")
    today_day = datetime.strptime(today_str, "%Y-%m-%d").strftime("%A")
    
    # 1. Total Active Students
    total_students = await db.students.count_documents({"status": "ACTIVE"})
    
    # 2. Check today's real attendance from register
    att_records = await db.attendance.find({"date": today_str}).to_list(None)
    if att_records and len(att_records) > 0:
        present = sum(1 for a in att_records if a.get("status") == "PRESENT")
        on_leave = sum(1 for a in att_records if a.get("status") == "LEAVE")
        absent = sum(1 for a in att_records if a.get("status") == "ABSENT")
    else:
        # Realistic hostel baseline as specified by user: 52 Present, 7 On Leave, 5 Absent (= 64 total)
        present = 52
        on_leave = 7
        absent = 5
        
    eligible_meal_count = present
    
    # 3. Fetch Saved Meal Count or provide attendance-aligned defaults
    saved = await db.meal_counts.find_one({"date": today_str})
    
    # 4. Get today's scheduled menu items
    menu_doc = await db.mess_menu.find_one({"day": today_day})
    today_breakfast = menu_doc.get("breakfast", "Pulav (Tomato Bath)") if menu_doc else "Pulav (Tomato Bath)"
    today_lunch = menu_doc.get("lunch", "—") if menu_doc else "—"
    today_dinner = menu_doc.get("dinner", "Rice / Ragi Mudde + Vegetable Sambar") if menu_doc else "Rice / Ragi Mudde + Vegetable Sambar"
    
    # 5. Get Cleaning Summary
    cleaned_rooms = await db.rooms.count_documents({"cleaning_status": "COMPLETED"})
    
    if saved:
        return {
            "date": today_str,
            "day": today_day,
            "total_students": total_students,
            "present_students": present,
            "on_leave": on_leave,
            "absent": absent,
            "eligible_meal_count": eligible_meal_count,
            "tiffin_count": saved.get("tiffin_count") or saved.get("final_tiffin_count") or present,
            "tiffin_box_count": saved.get("tiffin_box_count") or saved.get("final_box_count") or 12,
            "night_lunch_count": saved.get("night_lunch_count") or saved.get("final_night_meal_count") or present,
            "selected_breakfast_item": saved.get("selected_breakfast_item", today_breakfast),
            "selected_dinner_item": saved.get("selected_dinner_item", today_dinner),
            "is_confirmed": saved.get("is_confirmed", True),
            "confirmed_by": saved.get("confirmed_by", "Hostel Warden"),
            "confirmed_at": saved.get("confirmed_at"),
            "remarks": saved.get("remarks", "Attendance verified by Warden."),
            "cleaned_rooms_count": cleaned_rooms,
            "total_rooms_count": 12,
            "today_menu": {
                "day": today_day,
                "breakfast": today_breakfast,
                "lunch": today_lunch,
                "dinner": today_dinner
            }
        }
    else:
        return {
            "date": today_str,
            "day": today_day,
            "total_students": total_students,
            "present_students": present,
            "on_leave": on_leave,
            "absent": absent,
            "eligible_meal_count": eligible_meal_count,
            "tiffin_count": present,
            "tiffin_box_count": 10,
            "night_lunch_count": present,
            "selected_breakfast_item": today_breakfast,
            "selected_dinner_item": today_dinner,
            "is_confirmed": False,
            "confirmed_by": None,
            "confirmed_at": None,
            "remarks": "Attendance-based allocation: Only students marked Present are included in mess preparation.",
            "cleaned_rooms_count": cleaned_rooms,
            "total_rooms_count": 12,
            "today_menu": {
                "day": today_day,
                "breakfast": today_breakfast,
                "lunch": today_lunch,
                "dinner": today_dinner
            }
        }

@router.post("/meal-counts")
async def save_meal_counts(data: MealCountUpdate, current_user: dict = Depends(require_admin)):
    """
    Warden / Admin confirms and enters today's Tiffin Count, Tiffin Box Count, and Night Lunch Count.
    """
    db = get_database()
    target_date = data.date or datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%Y-%m-%d %I:%M %p")
    
    doc = {
        "date": target_date,
        "tiffin_count": data.tiffin_count,
        "tiffin_box_count": data.tiffin_box_count,
        "night_lunch_count": data.night_lunch_count,
        "selected_breakfast_item": data.selected_breakfast_item,
        "selected_dinner_item": data.selected_dinner_item,
        "is_confirmed": True,
        "confirmed_by": current_user["email"],
        "confirmed_at": now_str,
        "remarks": data.remarks or "Verified by Hostel Warden against resident attendance roll call.",
        "updated_at": datetime.utcnow()
    }
    
    await db.meal_counts.update_one(
        {"date": target_date},
        {"$set": doc},
        upsert=True
    )
    
    await log_audit(
        current_user["email"],
        "WARDEN_MEAL_COUNT_CONFIRMED",
        "MESS",
        target_date,
        f"Confirmed meal count for {target_date}: Tiffin={data.tiffin_count}, Tiffin Box={data.tiffin_box_count}, Night Lunch={data.night_lunch_count}"
    )
    
    return {
        "message": f"✅ Daily Meal Count confirmed for {target_date} (Tiffin: {data.tiffin_count}, Tiffin Box: {data.tiffin_box_count}, Night Lunch: {data.night_lunch_count}).",
        "data": doc
    }
