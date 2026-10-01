
import asyncio
import csv
import os
from app.database.connection import connect_to_mongo, close_mongo_connection, get_database

async def export_student_logins():
    await connect_to_mongo()
    db = get_database()
    
    cursor = db.students.find({}).sort("student_id", 1)
    students = []
    async for s in cursor:
        students.append(s)
        
    await close_mongo_connection()
    print(f"Loaded {len(students)} students from database.")
    
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(workspace_dir, "STUDENT_LOGINS.csv")
    md_path = os.path.join(workspace_dir, "STUDENT_LOGINS.md")
    
    # 1. Generate CSV
    headers = [
        "Student ID",
        "Name",
        "Room",
        "Bed",
        "USN / Login ID",
        "Login Email",
        "Phone / WhatsApp",
        "Department",
        "Semester",
        "Default Password",
        "Login Portal URL"
    ]
    
    rows = []
    for s in students:
        rows.append([
            s.get("student_id", ""),
            s.get("name", ""),
            s.get("room_number", ""),
            s.get("bed_number", ""),
            s.get("usn", s.get("student_id", "")),
            s.get("email", ""),
            s.get("phone", ""),
            s.get("department", ""),
            s.get("semester", ""),
            "Student@123",
            "http://localhost:5173/login"
        ])
        
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"Generated CSV at {csv_path}")
    
    # 2. Generate Markdown Document
    md_lines = [
        "# Veerashaiva Lingayath Boys Hostel - Resident Student Logins",
        "",
        "> **Portal Login URL**: `http://localhost:5173/login`  ",
        "> **Default Password for All Students**: `Student@123`  ",
        "> **Login Methods**: Students can log in using their **Student ID** (e.g. `001`), **Login Email** (e.g. `guru@hostel.edu`), **USN**, or **Phone Number**.",
        "",
        f"**Total Registered Residents**: {len(students)} students across 13 rooms",
        "",
        "---",
        "",
        "## Quick Student Credentials Table",
        "",
        "| ID | Name | Room | Bed | Login Email | USN / Login ID | Mobile Phone | Password |",
        "|:---|:---|:---|:---|:---|:---|:---|:---|"
    ]
    
    for s in students:
        sid = s.get("student_id", "")
        name = s.get("name", "")
        room = s.get("room_number", "")
        bed = s.get("bed_number", "")
        email = s.get("email", "")
        usn = s.get("usn", sid)
        phone = s.get("phone", "")
        pwd = "`Student@123`"
        md_lines.append(f"| **{sid}** | {name} | {room} | {bed} | `{email}` | `{usn}` | {phone} | {pwd} |")
        
    md_lines.extend([
        "",
        "---",
        "",
        "## WhatsApp / SMS Ready Share Slips",
        "",
        "You can copy any of the message blocks below and send directly to the student or parents:",
        ""
    ])
    
    for s in students:
        sid = s.get("student_id", "")
        name = s.get("name", "")
        room = s.get("room_number", "")
        bed = s.get("bed_number", "")
        email = s.get("email", "")
        phone = s.get("phone", "")
        
        slip = f"""### {sid}. {name} ({room} - {bed})
```text
🏛️ Veerashaiva Lingayath Boys Hostel Portal
Hello {name},
Here are your official resident portal login credentials:

🌐 Portal URL: http://localhost:5173/login
👤 Username / ID: {sid} (or {email})
🔑 Default Password: Student@123
🛏️ Allocation: {room}, Bed {bed}
📱 Registered Mobile: {phone}

Please log in to manage meal preferences, gate passes, room cleaning, and notices.
```
"""
        md_lines.append(slip)
        
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    print(f"Generated Markdown at {md_path}")

if __name__ == "__main__":
    asyncio.run(export_student_logins())
