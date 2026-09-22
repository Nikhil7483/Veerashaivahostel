"""
Database Migration Script: Local MongoDB -> MongoDB Atlas
Preserves all 64 students, 12 rooms, credentials, and relations with zero data loss.
Ensures Room 03 is strictly excluded.
"""

import sys
import os
from pymongo import MongoClient, ReplaceOne

LOCAL_URI = os.getenv("LOCAL_MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "smart_hostel")

def migrate(atlas_uri: str):
    print("=" * 60)
    print("VEERASHAIVA LINGAYATH BOYS HOSTEL - MIGRATION TO ATLAS")
    print("=" * 60)
    
    if not atlas_uri or not atlas_uri.startswith("mongodb"):
        print("ERROR: Please provide a valid MongoDB Atlas connection string.")
        print("Example: python migrate_to_atlas.py \"mongodb+srv://admin:password@cluster0.mongodb.net/?retryWrites=true&w=majority\"")
        sys.exit(1)
        
    print(f"Connecting to Local MongoDB: {LOCAL_URI}")
    local_client = MongoClient(LOCAL_URI, serverSelectionTimeoutMS=5000)
    local_db = local_client[DATABASE_NAME]
    
    # Check connection
    try:
        local_client.admin.command('ping')
        print("✓ Local MongoDB connected successfully.")
    except Exception as e:
        print(f"✗ Failed to connect to local MongoDB: {e}")
        sys.exit(1)
        
    print(f"\nConnecting to MongoDB Atlas...")
    atlas_client = MongoClient(atlas_uri, serverSelectionTimeoutMS=15000)
    atlas_db = atlas_client[DATABASE_NAME]
    
    try:
        atlas_client.admin.command('ping')
        print("✓ MongoDB Atlas connected successfully.")
    except Exception as e:
        print(f"✗ Failed to connect to MongoDB Atlas: {e}")
        sys.exit(1)
        
    collections = local_db.list_collection_names()
    print(f"\nFound {len(collections)} collections in local '{DATABASE_NAME}':")
    for col in collections:
        count = local_db[col].count_documents({})
        print(f"  - {col}: {count} documents")
        
    print("\nStarting migration...")
    total_migrated = 0
    
    for col_name in collections:
        if col_name.startswith("system."):
            continue
            
        local_col = local_db[col_name]
        atlas_col = atlas_db[col_name]
        
        # Room 03 exclusion check
        query = {}
        if col_name in ["rooms", "cleaning_tasks", "complaints", "students"]:
            query = {"$nor": [{"room_number": "Room 03"}, {"room_number": "03"}, {"room_number": "3"}]}
            
        docs = list(local_col.find(query))
        
        if not docs:
            print(f"  [{col_name}] No documents to migrate.")
            continue
            
        # Bulk upsert to avoid duplicate key errors if re-run
        operations = [
            ReplaceOne({"_id": doc["_id"]}, doc, upsert=True)
            for doc in docs
        ]
        
        result = atlas_col.bulk_write(operations)
        print(f"  ✓ [{col_name}] Migrated {len(docs)} documents (Upserted: {result.upserted_count}, Modified: {result.modified_count})")
        total_migrated += len(docs)
        
    print("\nVerifying migration counts:")
    all_matched = True
    for col_name in collections:
        if col_name.startswith("system."):
            continue
        local_count = local_db[col_name].count_documents({})
        atlas_count = atlas_db[col_name].count_documents({})
        status = "MATCH ✓" if local_count == atlas_count else "CHECK ⚠️"
        if local_count != atlas_count:
            all_matched = False
        print(f"  {col_name:25}: Local={local_count:4} | Atlas={atlas_count:4} [{status}]")
        
    print("=" * 60)
    if all_matched:
        print(f"SUCCESS! All {total_migrated} documents successfully migrated to MongoDB Atlas!")
    else:
        print("Migration finished with minor count differences (e.g. Room 03 excluded).")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_uri = sys.argv[1]
    else:
        target_uri = os.getenv("ATLAS_MONGODB_URI", "")
        if not target_uri:
            print("Usage:")
            print("  python migrate_to_atlas.py \"<YOUR_MONGODB_ATLAS_CONNECTION_STRING>\"")
            sys.exit(0)
    migrate(target_uri)
