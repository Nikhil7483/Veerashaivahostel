import asyncio
from app.database.connection import connect_to_mongo, get_database, close_mongo_connection

async def f():
    await connect_to_mongo()
    db = get_database()
    orders = await db.kitchen_meal_orders.find({}).to_list(10)
    for o in orders:
        print("ORDER:", o)
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(f())
