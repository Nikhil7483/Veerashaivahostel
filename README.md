# Smart Hostel Management & Problem Resolution System

**Hostel**: Veerashaiva Lingayath Boys Hostel  
**Location**: Krushi Nagar, Shivamogga, Karnataka  
**Architecture**: FastAPI (Async Python) + Motor (MongoDB) + React 19 (Vite + Tailwind CSS)  

---

## 1. System Architecture & Highlights

- **Frontend**: React.js 19 + Vite + Tailwind CSS + Lucide React + Recharts + React Router v7 + Axios
- **Backend**: Python 3.11+ + FastAPI + Motor (Async MongoDB) + Pydantic v2 + Slowapi (Rate Limiter) + ReportLab + openpyxl
- **Database**: MongoDB (`smart_hostel`, indexed with unique compound constraints)
- **12 Dedicated Hostel Rooms**: Initialized with `Room 01`, `Room 02`, `Room 04` through `Room 13` (6-bed capacity each).
  > ⚠️ **Important Hostel Data Rule**: **`Room 03` DOES NOT EXIST**. The hostel physically operates with exactly 12 rooms.
- **64 Resident Students Allocated**: Enrolled with real names, departmental courses, academic years, bed allocations, and parent contacts.
- **Role-Based Workflows**:
  - **Admin / Warden**: Complete control over residents, room bed allocations, attendance marking, leave sanctions, complaint escalation, cleaning schedules, facilities maintenance, visitors, announcements, analytics, PDF/Excel exports, and audit logs.
  - **Student**: Isolated view of personal room & roommates, attendance records, leave submission with secure document upload, complaint ticketing (`HTL-XXXX`), housekeeping requests, mess ratings, and 🚨 **Emergency SOS**.
- **Automated Complaint Escalation**: Overdue tickets (> 48h or urgent > 24h) trigger automated SLA alerts with escalation levels to Warden and Campus Management.
- **Attendance Duplicate Prevention**: Unique compound index on `(student_id, date)`.
- **Institutional Reporting**: Native PDF (ReportLab) and Excel (.xlsx, openpyxl) generation.
- **Official Identity**: Features the portrait of Gubbi Totadappa (`hero.png`) and institutional branding.

---

## 2. Security & Production Hardening Features (Phase 33)

1. **CORS Whitelist**: Secure origin validation via `CORS_ORIGINS` environment variable (no wildcards with credentials).
2. **Security Headers**: Middleware sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
3. **Rate Limiting**: Integrated `slowapi` protects `POST /login` (120/min per IP to support shared campus NAT), `POST /sos/create` (10/min), and `POST /leaves/apply` (30/min). Returns HTTP 429 on abuse.
4. **File Upload Security**: Uploaded files receive cryptographically random UUID filenames (`leave_<uuid>.<ext>`), strict extension whitelist (`.pdf`, `.jpg`, `.jpeg`, `.png`), 5MB size limit, and path traversal defense.
5. **Production Error Sanitization**: Global exception handler prevents exposure of Python tracebacks, MongoDB credentials, or file paths, returning standard generic JSON.
6. **Active MongoDB Health Check**: `/api/health` performs an active MongoDB ping returning HTTP 200 (connected) or HTTP 503 (disconnected).
7. **Frontend Bundle Splitting**: Lazy-loaded admin routes (`React.lazy`) reduced vendor chunk size by 20% (1,025 kB -> 819 kB).
8. **Optimized Polling**: Student dashboard room polling reduced from 3s to 15s with unmount cleanup, reducing background HTTP traffic by 75%.

---

## 3. Quick Run Commands

Open **two separate terminals** from the root `HOSTEL` folder:

### Terminal 1: Run Backend Server (FastAPI)
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Backend API**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/api/v1/docs`
- **Health Check**: `http://127.0.0.1:8000/api/health`

### Terminal 2: Run Frontend Server (React + Vite)
```powershell
cd frontend
npm run dev
```
- **Web Application URL**: Open **`http://localhost:5173`** in your browser.

---

## 4. First-Time Setup & Database Seeding (If Needed)

Ensure local MongoDB is running on port `27017` (`mongodb://localhost:27017`):

```powershell
# 1. Install Backend Dependencies & Seed Database
cd backend
python -m pip install -r requirements.txt
python seed.py

# 2. Install Frontend Dependencies & Build
cd ../frontend
npm install
npm run build
```

> **Note**: `python seed.py` initializes the 12 active rooms with 6 beds each, populates all 64 students, seeds historical attendance, cleaning matrices, sample complaints, mess menus, and credentials. `Room 03` is strictly excluded.

---

## 5. Login Credentials

### 5.1 Administrator / Warden Account
| Role | Email / Username | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **Admin / Warden** | `admin@smarthostel.com` | `Admin@123` | Full administrative control across all 12 rooms and modules |

*(Click the **"Admin Warden"** button on the login screen for 1-click fill)*

---

### 5.2 Student Accounts
All 64 resident students share the default password: **`Student@123`**

You can log in as any student using their **USN / ID (e.g. `001`)** or their institutional email:

| Student Name | Room & Bed | USN / ID | Email Login | Password | Course / Year |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Guru** *(Quick Demo)* | Room 01 (Bed B1) | `001` | `guru@hostel.edu` | `Student@123` | Pharmacy &bull; 1st Year |
| **Bharath B M** | Room 02 (Bed B1) | `006` | `bharath.bm@hostel.edu` | `Student@123` | M.Com &bull; 2nd Year |
| **Mallikarjuna S.R** | Room 04 (Bed B1) | `009` | `mallikarjuna.sr@hostel.edu` | `Student@123` | BA Defence &bull; 1st Year |
| **Vinay G. P** | Room 05 (Bed B1) | `014` | `vinay.gp@hostel.edu` | `Student@123` | ISG &bull; 4th Year |
| **Manju M.N.** | Room 06 (Bed B1) | `020` | `manju.mn@hostel.edu` | `Student@123` | BE &bull; 3rd Year |
| **Suraj** | Room 07 (Bed B1) | `025` | `suraj@hostel.edu` | `Student@123` | BE &bull; 3rd Year |
| **Akash Biradar** | Room 08 (Bed B1) | `029` | `akash.biradar@hostel.edu` | `Student@123` | BE &bull; 3rd Year |
| **Shivashakthi N S** | Room 09 (Bed B1) | `035` | `shivashakthi.ns@hostel.edu` | `Student@123` | BE &bull; 4th Year |
| **Shreyas T S** | Room 10 (Bed B1) | `041` | `shreyas.ts@hostel.edu` | `Student@123` | BE &bull; 2nd Year |
| **Veeresh Hiremath** | Room 11 (Bed B1) | `047` | `veeresh.hiremath@hostel.edu` | `Student@123` | BE &bull; 4th Year |
| **Nikhil N R** | Room 12 (Bed B1) | `052` | `nikhil.nr@hostel.edu` | `Student@123` | BE &bull; 4th Year |
| **Yashwanth P M** | Room 13 (Bed B1) | `058` | `yashwanth.pm@hostel.edu` | `Student@123` | BE &bull; 2nd Year |

*(Click the **"Student Demo"** button on the login screen for 1-click fill with Guru)*

---

## 6. Project Documentation Directory

- [PROJECT_AUDIT.md](PROJECT_AUDIT.md): Comprehensive Phase 32 system audit across 16 dimensions
- [PHASE_33_FIX_REPORT.md](PHASE_33_FIX_REPORT.md): Remediation report for all 10 priority issues
- [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md): In-depth security assessment and vulnerability testing results
- [PERFORMANCE_COMPARISON.md](PERFORMANCE_COMPARISON.md): Concurrency benchmark comparison (Phase 31 vs Phase 33)
- [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md): MongoDB and file upload backup and disaster recovery procedures
- [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md): Final production sign-off matrix
