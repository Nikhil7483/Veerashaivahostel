from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import pymongo
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = Database()

async def connect_to_mongo():
    import re
    masked = re.sub(r":([^:@]+)@", r":****@", settings.MONGODB_URI)
    print(f"Connecting to MongoDB at: {masked}")
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    await init_db_indexes()
    print(f"Connected to MongoDB database: {settings.DATABASE_NAME}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")

def get_database() -> AsyncIOMotorDatabase:
    return db_instance.db

async def init_db_indexes():
    db = db_instance.db
    if db is None:
        return
    
    try:
        # Users
        await db.users.create_index("email", unique=True)
        
        # Students
        await db.students.create_index("student_id", unique=True)
        await db.students.create_index("usn", unique=True)
        await db.students.create_index("email")
        await db.students.create_index("room_number")
        
        # Rooms
        await db.rooms.create_index("room_number", unique=True)
        
        # Attendance: Unique compound index on student_id + date to prevent duplicates
        await db.attendance.create_index(
            [("student_id", pymongo.ASCENDING), ("date", pymongo.ASCENDING)],
            unique=True
        )
        await db.attendance.create_index("date")
        await db.attendance.create_index("room_number")
        
        # Leave applications
        await db.leave_applications.create_index("student_id")
        await db.leave_applications.create_index("status")
        
        # Complaints
        await db.complaints.create_index("ticket_id", unique=True)
        await db.complaints.create_index("student_id")
        await db.complaints.create_index("status")
        await db.complaints.create_index("category")
        
        # Cleaning requests
        await db.cleaning_requests.create_index("room_number")
        await db.cleaning_requests.create_index("status")
        
        # Maintenance requests
        await db.maintenance_requests.create_index("room_number")
        await db.maintenance_requests.create_index("status")
        
        # Notifications
        await db.notifications.create_index("user_id")
        await db.notifications.create_index("is_read")
        
        # Emergency alerts
        await db.emergency_alerts.create_index("status")
        
        # Audit logs
        await db.audit_logs.create_index([("timestamp", pymongo.DESCENDING)])
        
        # Food & Mess Management Indexes
        await db.food_allocations.create_index("date", unique=True)
        await db.meal_counts.create_index(
            [("date", pymongo.ASCENDING), ("session", pymongo.ASCENDING)],
            unique=True
        )
        await db.meal_counts.create_index("date")
        
        print("MongoDB indexes initialized successfully.")
    except Exception as e:
        print(f"Warning initializing indexes: {e}")

