import asyncio
from app.database.connection import connect_to_mongo, get_database, close_mongo_connection

async def purge_room_03():
    await connect_to_mongo()
    db = get_database()
    
    students_in_r3 = await db.students.count_documents({"room_number": "Room 03"})
    print("Students allocated to Room 03:", students_in_r3)
    assert students_in_r3 == 0, "Cannot delete Room 03 if students are assigned!"
    
    del_res = await db.rooms.delete_one({"room_number": "Room 03"})
    print("Deleted Room 03 from rooms collection:", del_res.deleted_count)
    
    await db.cleaning_schedule.update_many(
        {"room_numbers": "Room 03"},
        {"$pull": {"room_numbers": "Room 03"}}
    )
    del_req = await db.cleaning_requests.delete_many({"room_number": "Room 03"})
    print("Deleted cleaning requests for Room 03:", del_req.deleted_count)
    
    active_rooms = await db.rooms.find({}).sort("room_number", 1).to_list(50)
    print("Total Active Rooms Remaining:", len(active_rooms))
    total_students = 0
    for r in active_rooms:
        stu_cnt = await db.students.count_documents({"room_number": r["room_number"]})
        total_students += stu_cnt
        print(f"  {r['room_number']}: {stu_cnt} students")
    print("Total students verified:", total_students)
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(purge_room_03())
