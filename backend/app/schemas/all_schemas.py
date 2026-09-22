from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- AUTH SCHEMAS ---
class LoginRequest(BaseModel):
    username: str  # email or student_id
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class AdminProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    office: Optional[str] = None
    email: Optional[EmailStr] = None
    new_password: Optional[str] = None

# --- STUDENT SCHEMAS ---
class StudentCreate(BaseModel):
    student_id: str
    name: str
    usn: str
    phone: str
    email: EmailStr
    department: str
    semester: int
    room_number: str
    bed_number: str
    parent_name: str
    parent_contact: str
    address: str
    joining_date: str
    status: str = "ACTIVE"
    password: Optional[str] = "Student@123"

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    usn: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None
    room_number: Optional[str] = None
    bed_number: Optional[str] = None
    parent_name: Optional[str] = None
    parent_contact: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None

class StudentResponse(BaseModel):
    id: str
    student_id: str
    name: str
    usn: str
    phone: str
    email: str
    department: str
    semester: int
    room_number: str
    bed_number: str
    parent_name: str
    parent_contact: str
    address: str
    joining_date: str
    status: str
    created_at: Optional[datetime] = None

# --- ROOM SCHEMAS ---
class RoomUpdate(BaseModel):
    total_beds: int
    cleaning_status: Optional[str] = None
    last_cleaned: Optional[str] = None
    next_cleaning: Optional[str] = None

class RoomResponse(BaseModel):
    id: str
    room_number: str
    total_beds: int
    occupied_beds: int
    available_beds: int
    students: List[Dict[str, Any]] = []
    cleaning_status: str = "COMPLETED"
    last_cleaned: Optional[str] = None
    next_cleaning: Optional[str] = None

# --- ATTENDANCE SCHEMAS ---
class AttendanceItem(BaseModel):
    student_id: str
    status: str  # PRESENT, ABSENT, LEAVE
    remarks: Optional[str] = ""

class AttendanceBatchCreate(BaseModel):
    date: str  # YYYY-MM-DD
    records: List[AttendanceItem]

class AttendanceUpdate(BaseModel):
    status: str
    remarks: Optional[str] = ""

# --- LEAVE SCHEMAS ---
class LeaveCreate(BaseModel):
    from_date: str
    to_date: str
    leave_type: str  # PERSONAL, MEDICAL, EMERGENCY, OTHER
    reason: str
    document_url: Optional[str] = None

class LeaveStatusUpdate(BaseModel):
    status: str  # APPROVED, REJECTED
    admin_remarks: Optional[str] = ""

# --- CLEANING SCHEMAS ---
class CleaningRequestCreate(BaseModel):
    room_number: str
    reason: str
    priority: str = "NORMAL"  # NORMAL, URGENT

class CleaningStatusUpdate(BaseModel):
    status: str  # REQUESTED, PENDING, IN_PROGRESS, COMPLETED, Pending, In Progress, Completed, Overdue
    assigned_staff: Optional[str] = None
    notes: Optional[str] = ""

class CleaningScheduleUpdate(BaseModel):
    day: str
    room_numbers: List[str]

class CleaningTaskCreate(BaseModel):
    room_number: str
    assigned_staff: str = "Housekeeping Staff"
    cleaning_type: str = "Daily Sanitation"  # Daily Sanitation, Deep Cleaning, Restroom Cleaning, Floor Mopping, Disinfection
    date: str  # YYYY-MM-DD
    time: str = "10:00 AM"
    status: str = "Pending"  # Pending, In Progress, Completed, Overdue
    notes: Optional[str] = ""

class CleaningTaskStatusUpdate(BaseModel):
    status: str  # Pending, In Progress, Completed, Overdue
    assigned_staff: Optional[str] = None
    notes: Optional[str] = None

class CleaningRatingSubmit(BaseModel):
    task_id: Optional[str] = None
    rating: int  # 1 to 5
    feedback: Optional[str] = ""

class CleaningIssueReport(BaseModel):
    description: str
    priority: str = "NORMAL"  # NORMAL, URGENT


# --- COMPLAINT SCHEMAS ---
class ComplaintCreate(BaseModel):
    room_number: str
    category: str  # ELECTRICAL, PLUMBING, WATER, FURNITURE, INTERNET, CLEANING, FOOD, MAINTENANCE, OTHER
    description: str
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT

class ComplaintUpdate(BaseModel):
    status: Optional[str] = None  # PENDING, ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED
    priority: Optional[str] = None
    assigned_staff: Optional[str] = None
    admin_remarks: Optional[str] = None

class ComplaintEscalate(BaseModel):
    escalated_to: str  # WARDEN, MANAGEMENT
    reason: str

# --- MAINTENANCE SCHEMAS ---
class MaintenanceCreate(BaseModel):
    room_number: str
    category: str  # Fan not working, Light not working, Water leakage, No water, Power outage, Bathroom problem, Furniture damage, Internet problem, Other
    description: str
    priority: str = "MEDIUM"

class MaintenanceUpdate(BaseModel):
    status: Optional[str] = None
    assigned_staff: Optional[str] = None
    remarks: Optional[str] = None

# --- MESS SCHEMAS ---
class MessMenuUpdate(BaseModel):
    day: str
    breakfast: str
    lunch: Optional[str] = "—"
    snacks: Optional[str] = "—"
    dinner: str

class MessFeedbackCreate(BaseModel):
    meal_type: str = "LUNCH"
    comment: str
    food_quality: Optional[int] = None
    taste: Optional[int] = None
    cleanliness: Optional[int] = None
    overall_rating: Optional[int] = None

class MealCountUpdate(BaseModel):
    date: Optional[str] = None
    tiffin_count: int
    tiffin_box_count: int = 0
    night_lunch_count: int
    selected_breakfast_item: Optional[str] = None
    selected_dinner_item: Optional[str] = None
    remarks: Optional[str] = ""

# --- VISITOR SCHEMAS ---
class VisitorCreate(BaseModel):
    visitor_name: str
    phone: str
    student_name: str
    room_number: str
    purpose: str
    entry_time: str
    exit_time: Optional[str] = None

class VisitorUpdate(BaseModel):
    exit_time: str
    remarks: Optional[str] = ""

# --- LOST & FOUND SCHEMAS ---
class LostFoundCreate(BaseModel):
    item_name: str
    description: str
    location: str
    date: str
    status: str = "LOST"  # LOST, FOUND, RETURNED

class LostFoundUpdate(BaseModel):
    status: str
    return_notes: Optional[str] = ""

class LostFoundEdit(BaseModel):
    item_name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    return_notes: Optional[str] = None

# --- EMERGENCY SCHEMAS ---
class EmergencyAlertCreate(BaseModel):
    room_number: str
    emergency_type: str  # MEDICAL, FIRE, SECURITY, OTHER
    description: Optional[str] = ""

class EmergencyAlertResolve(BaseModel):
    resolution_notes: str

# --- ANNOUNCEMENT SCHEMAS ---
class AnnouncementCreate(BaseModel):
    title: str
    description: str
    priority: str = "NORMAL"  # NORMAL, IMPORTANT, URGENT
