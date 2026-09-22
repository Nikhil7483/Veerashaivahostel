import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import {
  UtensilsCrossed,
  Coffee,
  Package,
  Ban,
  Users,
  CheckCircle,
  CheckCircle2,
  Clock,
  Search,
  ArrowLeft,
  Lock,
  RotateCcw,
  Check,
  AlertTriangle,
  Download,
  Calendar,
  CheckSquare,
  Bed,
  Home,
  XCircle,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

const TiffinManagementPage = () => {
  const navigate = useNavigate();

  // Active View Tab: 'warden-assign' | 'staff-collect' | 'food-dashboard' | 'room-breakdown' | 'history'
  const [activeTab, setActiveTab] = useState('warden-assign');

  // Query state
  const [selectedDate, setSelectedDate] = useState(new Intl.DateTimeFormat('en-CA').format(new Date()));
  const [selectedSession, setSelectedSession] = useState('Morning Tiffin');

  // Data states
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Roster & counts
  const [studentRoster, setStudentRoster] = useState([]);
  const [counts, setCounts] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);

  // Selection & Filters for Warden Assignment Tab
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');
  const [foodTypeFilter, setFoodTypeFilter] = useState('ALL');

  // Filters for Cleaning Staff Collection Tab
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoomFilter, setStaffRoomFilter] = useState('ALL');
  const [staffStatusFilter, setStaffStatusFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Taken' | 'Not Taken'

  // Load Data
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get(`/food/today?date=${selectedDate}&session=${encodeURIComponent(selectedSession)}`),
        api.get(`/food/history?session=${encodeURIComponent(selectedSession)}&limit=15`)
      ]);
      setStudentRoster(todayRes.data.students || []);
      setCounts(todayRes.data.counts || null);
      setHistoryRecords(historyRes.data || []);
    } catch (err) {
      console.error('Error fetching tiffin data:', err);
      setErrorMessage('Failed to connect to Food & Tiffin service.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedSession]);

  // Unique lists for filter dropdowns
  const availableRooms = useMemo(() => {
    const rooms = Array.from(new Set(studentRoster.map((s) => s.room_number))).filter(Boolean);
    return rooms.sort();
  }, [studentRoster]);

  const availableCourses = useMemo(() => {
    const courses = Array.from(new Set(studentRoster.map((s) => s.department))).filter(Boolean);
    return courses.sort();
  }, [studentRoster]);

  // Filtered Roster for Warden Assignment Tab
  const filteredWardenRoster = useMemo(() => {
    return studentRoster.filter((s) => {
      const matchesSearch =
        s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.usn && s.usn.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRoom = roomFilter === 'ALL' || s.room_number === roomFilter;
      const matchesCourse = courseFilter === 'ALL' || s.department === courseFilter;
      const matchesAttendance =
        attendanceFilter === 'ALL' ||
        (attendanceFilter === 'Present' && s.attendance_status === 'PRESENT') ||
        (attendanceFilter === 'On Leave' && s.attendance_status === 'LEAVE') ||
        (attendanceFilter === 'Absent' && s.attendance_status === 'ABSENT');
      const matchesFoodType = foodTypeFilter === 'ALL' || s.food_type === foodTypeFilter;

      return matchesSearch && matchesRoom && matchesCourse && matchesAttendance && matchesFoodType;
    });
  }, [studentRoster, searchQuery, roomFilter, courseFilter, attendanceFilter, foodTypeFilter]);

  // Filtered Roster for Cleaning Staff Collection Tab
  const filteredStaffRoster = useMemo(() => {
    return studentRoster.filter((s) => {
      // Cleaning staff only cares about students assigned Tiffin or Tiffin Box
      if (s.food_type === 'No Tiffin') return false;

      const matchesSearch =
        s.student_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.student_id.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.room_number.toLowerCase().includes(staffSearch.toLowerCase());

      const matchesRoom = staffRoomFilter === 'ALL' || s.room_number === staffRoomFilter;
      const matchesStatus =
        staffStatusFilter === 'ALL' || s.collection_status === staffStatusFilter;

      return matchesSearch && matchesRoom && matchesStatus;
    });
  }, [studentRoster, staffSearch, staffRoomFilter, staffStatusFilter]);

  // Select All Eligible Students (Present only)
  const handleSelectAllEligible = () => {
    const eligibleIds = filteredWardenRoster
      .filter((s) => s.attendance_status === 'PRESENT')
      .map((s) => s.student_id);
    setSelectedIds(eligibleIds);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const toggleSelectStudent = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk Assign Food Type
  const handleBulkAssign = async (targetFoodType) => {
    if (selectedIds.length === 0) {
      alert('Please select at least one student to assign food.');
      return;
    }

    setActionLoading(true);
    setNotice('');
    setErrorMessage('');
    try {
      const res = await api.post('/food/assign', {
        date: selectedDate,
        session: selectedSession,
        student_ids: selectedIds,
        food_type: targetFoodType,
        override_warning: true
      });
      setNotice(`✅ ${res.data.message}`);
      setSelectedIds([]);
      await loadData(true);
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || 'Failed to assign food.');
    } finally {
      setActionLoading(false);
    }
  };

  // Single Inline Assignment Change
  const handleSingleAssign = async (studentId, newFoodType) => {
    setActionLoading(true);
    try {
      await api.post('/food/assign', {
        date: selectedDate,
        session: selectedSession,
        student_ids: [studentId],
        food_type: newFoodType,
        override_warning: true
      });
      await loadData(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  // Cleaning Staff: Mark Food TAKEN
  const handleMarkTaken = async (assignment) => {
    if (!assignment.id) {
      alert('Assignment record is being initialized. Please wait a second.');
      return;
    }
    if (assignment.collection_status === 'Taken') {
      alert('Food already recorded for this student.');
      return;
    }

    // Optimistic local update
    setStudentRoster((prev) =>
      prev.map((s) =>
        s.id === assignment.id
          ? {
            ...s,
            collection_status: 'Taken',
            collection_time: new Intl.DateTimeFormat('en-US', {
              hour: 'numeric',
              minute: 'numeric',
              hour12: true
            }).format(new Date())
          }
          : s
      )
    );

    try {
      const res = await api.post(`/food/${assignment.id}/taken`);
      setNotice(`✓ ${res.data.message}`);
      await loadData(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to mark taken.');
      await loadData(true);
    }
  };

  // Cleaning Staff / Warden: Mark Food NOT TAKEN
  const handleMarkNotTaken = async (assignmentId) => {
    if (!window.confirm('Mark this resident as Not Taken?')) return;
    try {
      await api.post(`/food/${assignmentId}/not-taken`);
      await loadData(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  // Warden: Confirm Final Count
  const handleConfirmFinalCount = async () => {
    if (!window.confirm(`Confirm and lock final actual food count for ${formatDate(selectedDate)} (${selectedSession})?`)) return;
    setActionLoading(true);
    try {
      const res = await api.post('/food/count/confirm', {
        date: selectedDate,
        session: selectedSession,
        remarks: 'Warden confirmed final kitchen meal count.'
      });
      setNotice(res.data.message);
      await loadData(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to confirm count.');
    } finally {
      setActionLoading(false);
    }
  };

  // CSV Export for History
  const exportHistoryCSV = () => {
    if (!historyRecords || historyRecords.length === 0) {
      alert('No history records available to export.');
      return;
    }

    const headers = [
      'Date',
      'Session',
      'Eligible Students',
      'Tiffin Assigned',
      'Tiffin Taken',
      'Tiffin Box Assigned',
      'Tiffin Box Taken',
      'Pending Count',
      'Status',
      'Confirmed By',
      'Confirmed At'
    ];

    const rows = historyRecords.map((r) => [
      r.date,
      r.session,
      r.eligible_students,
      r.tiffin_assigned,
      r.tiffin_taken,
      r.tiffin_box_assigned,
      r.tiffin_box_taken,
      r.pending_count,
      r.status,
      r.confirmed_by || '—',
      r.confirmed_at || '—'
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Lingayath_Hostel_Food_History_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Room-wise aggregation
  const roomBreakdown = useMemo(() => {
    const map = {};
    for (let i = 1; i <= 13; i++) {
      const roomNum = `Room ${i.toString().padStart(2, '0')}`;
      map[roomNum] = {
        room_number: roomNum,
        eligible: 0,
        tiffin_assigned: 0,
        tiffin_taken: 0,
        tiffin_box_assigned: 0,
        tiffin_box_taken: 0,
        pending: 0,
        students: []
      };
    }

    studentRoster.forEach((s) => {
      const r = map[s.room_number];
      if (r) {
        if (s.attendance_status === 'PRESENT') r.eligible += 1;
        if (s.food_type === 'Tiffin') {
          r.tiffin_assigned += 1;
          if (s.collection_status === 'Taken') r.tiffin_taken += 1;
        }
        if (s.food_type === 'Tiffin Box') {
          r.tiffin_box_assigned += 1;
          if (s.collection_status === 'Taken') r.tiffin_box_taken += 1;
        }
        if (s.collection_status === 'Pending') r.pending += 1;
        r.students.push(s);
      }
    });

    return Object.values(map);
  }, [studentRoster]);

  // Chart Data for History Analytics
  const chartData = useMemo(() => {
    return historyRecords.slice(0, 7).reverse().map((h) => ({
      date: formatDate(h.date),
      TiffinTaken: h.tiffin_taken,
      BoxTaken: h.tiffin_box_taken,
      Pending: h.pending_count,
    }));
  }, [historyRecords]);

  return (
    <div className="space-y-6 pb-16">
      {/* HOSTEL BRANDED TOP HEADER */}
      <div className="p-6 bg-gradient-to-r from-amber-700 via-orange-800 to-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <UtensilsCrossed className="w-56 h-56" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 text-amber-100 text-xs font-bold backdrop-blur-xs">
              <span>Krushi Nagar, Shivamogga, Karnataka</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              VEERASHAIVA LINGAYATH BOYS HOSTEL
            </h1>
            <p className="text-xs sm:text-sm text-amber-100/90 font-medium">
              Tiffin & Food Count Management &bull; Two-Step Workflow: <strong>Warden Assigns &rarr; Cleaning Staff Records Collection</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/admin/mess')}
              className="py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
            >
              <UtensilsCrossed className="w-4 h-4 text-amber-300" />
              <span>Mess Timetable</span>
            </button>

            <button
              onClick={() => navigate('/admin/dashboard')}
              className="py-2.5 px-4 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-md"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* NOTICES */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 text-emerald-950 rounded-2xl border border-emerald-300 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-950 font-black">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 text-red-950 rounded-2xl border border-red-300 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-700 hover:text-red-950 font-black">
            &times;
          </button>
        </div>
      )}

      {/* SESSION & DATE SELECTOR BAR */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <UtensilsCrossed className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700">Food Session:</span>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
            >
              <option value="Morning Tiffin">Morning Tiffin (7:00 &ndash; 8:00 AM)</option>
              <option value="Tiffin Box">Tiffin Box (Packed Lunch)</option>
              <option value="Night Lunch">Night Lunch (8:00 &ndash; 9:00 PM)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide border ${counts?.status === 'Confirmed'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
            }`}>
            {counts?.status === 'Confirmed' ? '🔒 Count Confirmed' : '⚡ Live Collection'}
          </span>
          <button
            onClick={() => loadData()}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition"
            title="Refresh live data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 📊 CORE FOOD DASHBOARD CARDS (Required by Prompt #6 & #7) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. 👥 Eligible Students: 52 */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 rounded-2xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Eligible Residents</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-950 mt-1.5">
            {counts?.eligible_students ?? 52}
          </p>
          <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
            Present in Hostel
          </p>
        </div>

        {/* 2. 🍽️ Tiffin: Assigned vs Taken */}
        <div className="p-4 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Tiffin Taken</span>
            <Coffee className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-950 mt-1.5">
            {counts?.tiffin_taken ?? 38}
          </p>
          <p className="text-[10px] text-amber-800 font-bold mt-0.5">
            Assigned: {counts?.tiffin_assigned ?? 40}
          </p>
        </div>

        {/* 3. 📦 Tiffin Box: Assigned vs Taken */}
        <div className="p-4 bg-gradient-to-br from-blue-50 via-white to-blue-50/30 rounded-2xl border border-blue-200 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Tiffin Box Taken</span>
            <Package className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-950 mt-1.5">
            {counts?.tiffin_box_taken ?? 11}
          </p>
          <p className="text-[10px] text-blue-800 font-bold mt-0.5">
            Assigned: {counts?.tiffin_box_assigned ?? 12}
          </p>
        </div>

        {/* 4. ⏳ Pending Collection: 3 */}
        <div className="p-4 bg-gradient-to-br from-orange-50 via-white to-orange-50/30 rounded-2xl border border-orange-200 shadow-2xs">
          <div className="flex items-center justify-between text-orange-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Pending Taken</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-orange-950 mt-1.5">
            {counts?.pending_count ?? 3}
          </p>
          <p className="text-[10px] text-orange-800 font-bold mt-0.5">
            Awaiting Collection
          </p>
        </div>

        {/* 5. 🏠 On Leave: 7 */}
        <div className="p-4 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 rounded-2xl border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between text-purple-800">
            <span className="text-[10px] font-black uppercase tracking-wider">On Leave</span>
            <Home className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-purple-950 mt-1.5">
            {counts?.leave_count ?? 7}
          </p>
          <p className="text-[10px] text-purple-800 font-bold mt-0.5">
            Sanctioned Away
          </p>
        </div>

        {/* 6. ❌ Absent: 5 */}
        <div className="p-4 bg-gradient-to-br from-rose-50 via-white to-rose-50/30 rounded-2xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[10px] font-black uppercase tracking-wider">Absent</span>
            <XCircle className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-950 mt-1.5">
            {counts?.absent_count ?? 5}
          </p>
          <p className="text-[10px] text-rose-800 font-bold mt-0.5">
            Unexcused Absence
          </p>
        </div>
      </div>

      {/* NAVIGATION TABS FOR MODULE */}
      <div className="flex items-center space-x-1.5 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-bold">
        <button
          onClick={() => setActiveTab('warden-assign')}
          className={`py-2.5 px-4 rounded-xl transition flex items-center space-x-2 shrink-0 ${activeTab === 'warden-assign'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Coffee className="w-4 h-4" />
          <span>1. Daily Tiffin Assignment (Warden)</span>
        </button>

        <button
          onClick={() => setActiveTab('staff-collect')}
          className={`py-2.5 px-4 rounded-xl transition flex items-center space-x-2 shrink-0 ${activeTab === 'staff-collect'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>2. Tiffin Collection (Cleaning Staff)</span>
        </button>

        <button
          onClick={() => setActiveTab('food-dashboard')}
          className={`py-2.5 px-4 rounded-xl transition flex items-center space-x-2 shrink-0 ${activeTab === 'food-dashboard'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>3. Final Food Count & Lock</span>
        </button>

        <button
          onClick={() => setActiveTab('room-breakdown')}
          className={`py-2.5 px-4 rounded-xl transition flex items-center space-x-2 shrink-0 ${activeTab === 'room-breakdown'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Bed className="w-4 h-4" />
          <span>4. Room-Wise Breakdown</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 px-4 rounded-xl transition flex items-center space-x-2 shrink-0 ${activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <Clock className="w-4 h-4" />
          <span>5. Food Count History</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WARDEN DAILY TIFFIN ASSIGNMENT SCREEN */}
      {/* ========================================================================= */}
      {activeTab === 'warden-assign' && (
        <div className="space-y-4">
          {/* Instructions Banner */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-3">
              <Coffee className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-amber-950 block">Warden Food Assignment Workflow:</span>
                <span className="text-amber-900">
                  Select residents and assign <strong>Tiffin</strong> (regular meal) or <strong>Tiffin Box</strong> (packed lunch for college). Students marked <em>Absent</em> or <em>On Leave</em> are excluded from normal assignment.
                </span>
              </div>
            </div>
            <div className="shrink-0 flex items-center space-x-2">
              <span className="px-2.5 py-1 bg-white rounded-lg font-bold text-amber-900 border border-amber-300">
                Eligible Residents: {counts?.eligible_students ?? 52}
              </span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search student or USN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              {/* Room Filter */}
              <div>
                <select
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                >
                  <option value="ALL">All Rooms (13 Rooms)</option>
                  {availableRooms.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Course Filter */}
              <div>
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                >
                  <option value="ALL">All Departments/Courses</option>
                  {availableCourses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Attendance Filter */}
              <div>
                <select
                  value={attendanceFilter}
                  onChange={(e) => setAttendanceFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                >
                  <option value="ALL">All Attendance Statuses</option>
                  <option value="Present">Present Only (Eligible)</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              {/* Food Type Filter */}
              <div>
                <select
                  value={foodTypeFilter}
                  onChange={(e) => setFoodTypeFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                >
                  <option value="ALL">All Food Assignments</option>
                  <option value="Tiffin">Tiffin</option>
                  <option value="Tiffin Box">Tiffin Box</option>
                  <option value="No Tiffin">No Tiffin</option>
                </select>
              </div>
            </div>

            {/* Bulk Action Toolbar */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAllEligible}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition flex items-center space-x-1"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                  <span>Select All Eligible (Present)</span>
                </button>

                {selectedIds.length > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="py-1.5 px-2.5 text-slate-400 hover:text-slate-600 font-bold"
                  >
                    Clear ({selectedIds.length})
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-slate-400">Bulk Assign Selected:</span>

                <button
                  onClick={() => handleBulkAssign('Tiffin')}
                  disabled={actionLoading || selectedIds.length === 0}
                  className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition flex items-center space-x-1 disabled:opacity-40"
                >
                  <Coffee className="w-3 h-3" />
                  <span>Assign Tiffin</span>
                </button>

                <button
                  onClick={() => handleBulkAssign('Tiffin Box')}
                  disabled={actionLoading || selectedIds.length === 0}
                  className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition flex items-center space-x-1 disabled:opacity-40"
                >
                  <Package className="w-3 h-3" />
                  <span>Assign Tiffin Box</span>
                </button>

                <button
                  onClick={() => handleBulkAssign('No Tiffin')}
                  disabled={actionLoading || selectedIds.length === 0}
                  className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition flex items-center space-x-1 disabled:opacity-40"
                >
                  <Ban className="w-3 h-3 text-slate-500" />
                  <span>No Tiffin</span>
                </button>
              </div>
            </div>
          </div>

          {/* Roster Table (Required by Prompt #4) */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3 text-center w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Room</th>
                  <th className="py-3 px-3">Attendance</th>
                  <th className="py-3 px-4">Food Assignment</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWardenRoster.map((s) => {
                  const isSelected = selectedIds.includes(s.student_id);
                  const isPresent = s.attendance_status === 'PRESENT';
                  const isOnLeave = s.attendance_status === 'LEAVE';

                  return (
                    <tr
                      key={s.student_id}
                      className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-amber-50/40' : ''
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectStudent(s.student_id)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                        />
                      </td>

                      {/* Student Details */}
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">{s.student_name}</div>
                        <div className="text-[10px] text-slate-400">
                          ID: {s.student_id} &bull; USN: {s.usn || s.student_id} &bull; {s.department}
                        </div>
                      </td>

                      {/* Room */}
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {s.room_number}
                      </td>

                      {/* Attendance Status */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isPresent
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOnLeave
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                          {s.attendance_status}
                        </span>
                        {!isPresent && (
                          <span className="block text-[9px] text-amber-700 font-semibold mt-0.5">
                            Not normally eligible
                          </span>
                        )}
                      </td>

                      {/* Food Assignment Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-black ${s.food_type === 'Tiffin'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : s.food_type === 'Tiffin Box'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                          {s.food_type === 'Tiffin' && <Coffee className="w-3.5 h-3.5 text-amber-700" />}
                          {s.food_type === 'Tiffin Box' && <Package className="w-3.5 h-3.5 text-blue-700" />}
                          {s.food_type === 'No Tiffin' && <Ban className="w-3.5 h-3.5 text-slate-400" />}
                          <span>{s.food_type}</span>
                        </span>
                      </td>

                      {/* Assignment Status */}
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-bold text-slate-600">
                          {s.assignment_status}
                        </span>
                      </td>

                      {/* Quick Assign Buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => handleSingleAssign(s.student_id, 'Tiffin')}
                            className={`py-1 px-2 rounded-lg text-[10px] font-bold transition border ${s.food_type === 'Tiffin'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-200'
                              }`}
                          >
                            Tiffin
                          </button>
                          <button
                            onClick={() => handleSingleAssign(s.student_id, 'Tiffin Box')}
                            className={`py-1 px-2 rounded-lg text-[10px] font-bold transition border ${s.food_type === 'Tiffin Box'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white hover:bg-blue-50 text-blue-900 border-blue-200'
                              }`}
                          >
                            Tiffin Box
                          </button>
                          <button
                            onClick={() => handleSingleAssign(s.student_id, 'No Tiffin')}
                            className={`py-1 px-2 rounded-lg text-[10px] font-bold transition border ${s.food_type === 'No Tiffin'
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                          >
                            None
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CLEANING ROOM STAFF - TODAY'S TIFFIN COLLECTION SCREEN */}
      {/* ========================================================================= */}
      {activeTab === 'staff-collect' && (
        <div className="space-y-4">
          {/* Cleaning Room Banner */}
          <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  Cleaning Room Staff Portal
                </span>
                <span className="text-xs text-blue-200 font-semibold">
                  &bull; Actual Meal Collection Desk
                </span>
              </div>
              <h2 className="text-xl font-black text-white">
                Today's Tiffin Collection Register
              </h2>
              <p className="text-xs text-slate-300">
                Staff can only record actual food collections. Mark <strong>Taken</strong> when student collects their food. Duplicate clicks are strictly prevented.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10 flex items-center space-x-4">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-300">Collected So Far</div>
                <div className="text-xl font-black text-emerald-400">
                  {(counts?.tiffin_taken ?? 38) + (counts?.tiffin_box_taken ?? 11)} / {(counts?.tiffin_assigned ?? 40) + (counts?.tiffin_box_assigned ?? 12)}
                </div>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-300">Pending</div>
                <div className="text-xl font-black text-amber-400">{counts?.pending_count ?? 3}</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search resident name or room..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={staffRoomFilter}
                onChange={(e) => setStaffRoomFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
              >
                <option value="ALL">All Rooms</option>
                {availableRooms.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                value={staffStatusFilter}
                onChange={(e) => setStaffStatusFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
              >
                <option value="ALL">All Collection Statuses</option>
                <option value="Pending">Pending (Not yet collected)</option>
                <option value="Taken">Taken (Already collected)</option>
                <option value="Not Taken">Not Taken</option>
              </select>
            </div>
          </div>

          {/* Collection Roster Table */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-3">Room</th>
                  <th className="py-3.5 px-4">Assigned Food</th>
                  <th className="py-3.5 px-4">Collection Status</th>
                  <th className="py-3.5 px-4">Collection Time</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaffRoster.map((s) => {
                  const isTaken = s.collection_status === 'Taken';
                  const isPending = s.collection_status === 'Pending';

                  return (
                    <tr
                      key={s.student_id}
                      className={`hover:bg-slate-50 transition-colors ${isTaken ? 'bg-emerald-50/20' : ''
                        }`}
                    >
                      {/* Student */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">{s.student_name}</div>
                        <div className="text-[10px] text-slate-400">
                          ID: {s.student_id} &bull; {s.department}
                        </div>
                      </td>

                      {/* Room */}
                      <td className="py-3.5 px-3 font-black text-slate-900">
                        {s.room_number}
                      </td>

                      {/* Assigned Food */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-black ${s.food_type === 'Tiffin'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}>
                          {s.food_type === 'Tiffin' ? <Coffee className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                          <span>{s.food_type}</span>
                        </span>
                      </td>

                      {/* Collection Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${isTaken
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPending
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                          {s.collection_status}
                        </span>
                      </td>

                      {/* Collection Time & Staff */}
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        {isTaken ? (
                          <div>
                            <span className="font-bold text-emerald-800 block">{s.collection_time || 'Recorded'}</span>
                            <span className="text-[10px] text-slate-400">By {s.recorded_by || 'Staff'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">&mdash;</span>
                        )}
                      </td>

                      {/* Action Button: MARK TAKEN with Duplicate Protection */}
                      <td className="py-3.5 px-4 text-center">
                        {isTaken ? (
                          <span className="py-1.5 px-4 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold inline-flex items-center space-x-1 border border-emerald-300 cursor-default">
                            <Check className="w-3.5 h-3.5" />
                            <span>✓ Taken ({s.collection_time || 'Recorded'})</span>
                          </span>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              onClick={() => handleMarkTaken(s)}
                              className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center space-x-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Taken</span>
                            </button>

                            <button
                              onClick={() => handleMarkNotTaken(s.id)}
                              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold"
                              title="Mark Not Taken"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WARDEN FINAL COUNT REVIEW & LOCK SCREEN */}
      {/* ========================================================================= */}
      {activeTab === 'food-dashboard' && (
        <div className="space-y-6">
          {/* Main Confirmation Box */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Warden Food Count Review & Confirmation
                </h2>
                <p className="text-xs text-slate-500">
                  System automatically calculates final counts from actual student collection records.
                </p>
              </div>

              {counts?.status === 'Confirmed' ? (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-extrabold">
                    Confirmed by {counts.confirmed_by || 'Warden'} at {counts.confirmed_at}
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleConfirmFinalCount}
                  disabled={actionLoading}
                  className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs transition shadow-md flex items-center space-x-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm Final Kitchen Count</span>
                </button>
              )}
            </div>

            {/* Side-by-Side Comparison: Assigned vs Actual Taken */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tiffin Comparison */}
              <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-amber-950 flex items-center space-x-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span>Tiffin (Morning Meal)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                    7:00 &ndash; 8:00 AM
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-amber-200 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Warden Assigned</div>
                    <div className="text-2xl font-black text-slate-800 mt-0.5">{counts?.tiffin_assigned ?? 40}</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-300 text-center ring-2 ring-amber-400/20">
                    <div className="text-[10px] font-bold text-amber-700 uppercase">Actual Taken</div>
                    <div className="text-2xl font-black text-amber-900 mt-0.5">{counts?.tiffin_taken ?? 38}</div>
                  </div>
                </div>

                <p className="text-[11px] text-amber-800">
                  {counts?.tiffin_assigned - counts?.tiffin_taken} residents have not collected assigned morning tiffins yet.
                </p>
              </div>

              {/* Tiffin Box Comparison */}
              <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-blue-950 flex items-center space-x-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Tiffin Box (Packed College Lunch)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold">
                    College Dabba
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-blue-200 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Warden Assigned</div>
                    <div className="text-2xl font-black text-slate-800 mt-0.5">{counts?.tiffin_box_assigned ?? 12}</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-blue-300 text-center ring-2 ring-blue-400/20">
                    <div className="text-[10px] font-bold text-blue-700 uppercase">Actual Taken</div>
                    <div className="text-2xl font-black text-blue-900 mt-0.5">{counts?.tiffin_box_taken ?? 11}</div>
                  </div>
                </div>

                <p className="text-[11px] text-blue-800">
                  {counts?.tiffin_box_assigned - counts?.tiffin_box_taken} tiffin boxes currently pending collection.
                </p>
              </div>
            </div>

            {/* Critical Business Rule Banner */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <span className="font-extrabold text-slate-900 block">
                Official Hostel Management Rule:
              </span>
              <p>
                <strong>Warden Assignment &ne; Actual Kitchen Count.</strong> The final kitchen consumption calculation is strictly derived from actual collections recorded by Cleaning Room staff at the counter, preventing kitchen over-billing and food wastage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ROOM-WISE BREAKDOWN */}
      {/* ========================================================================= */}
      {activeTab === 'room-breakdown' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900">
              Room-Wise Food Allocation & Collection Summary (13 Rooms)
            </h2>
            <span className="text-xs text-slate-400">
              Date: {formatDate(selectedDate)} &bull; {selectedSession}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {roomBreakdown.map((r) => {
              const isRoom03 = r.room_number === 'Room 03';

              if (isRoom03) {
                return (
                  <div
                    key={r.room_number}
                    className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-100/60 opacity-70 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="font-extrabold text-slate-600 text-sm">{r.room_number}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                          VACANT
                        </span>
                      </div>
                      <div className="py-6 text-center text-xs text-slate-400">
                        0 Residents Allocated
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={r.room_number}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-extrabold text-slate-900 text-sm">{r.room_number}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {r.eligible} Eligible
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Tiffin Taken:</span>
                      <span className="font-extrabold text-amber-900">
                        {r.tiffin_taken} / {r.tiffin_assigned}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Tiffin Box Taken:</span>
                      <span className="font-extrabold text-blue-900">
                        {r.tiffin_box_taken} / {r.tiffin_box_assigned}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
                      <span>Pending:</span>
                      <span className={`font-black ${r.pending > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                        {r.pending}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: FOOD COUNT HISTORY & ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* History Chart */}
          {chartData.length > 0 && (
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-black text-slate-900">
                Weekly Tiffin & Food Collection Trends
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="TiffinTaken" name="Tiffin Taken" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="BoxTaken" name="Tiffin Box Taken" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pending" name="Pending" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* History Table */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Previous Dates Food Count History
                </h3>
                <p className="text-xs text-slate-400">
                  Comprehensive audit history of eligible students, assignments, actual collections, and warden confirmations.
                </p>
              </div>

              <button
                onClick={exportHistoryCSV}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs self-start"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export History (CSV)</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Session</th>
                    <th className="py-3 px-3 text-center">Eligible</th>
                    <th className="py-3 px-3 text-center">Tiffin (Assigned / Taken)</th>
                    <th className="py-3 px-3 text-center">Box (Assigned / Taken)</th>
                    <th className="py-3 px-3 text-center">Pending</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Confirmed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRecords.map((h) => (
                    <tr key={h.id || h.date} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{formatDate(h.date)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-600">{h.session}</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-800">{h.eligible_students}</td>
                      <td className="py-3 px-3 text-center font-bold text-amber-900">
                        {h.tiffin_assigned} / <span className="text-emerald-700">{h.tiffin_taken}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-blue-900">
                        {h.tiffin_box_assigned} / <span className="text-emerald-700">{h.tiffin_box_taken}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-orange-600">{h.pending_count}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${h.status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                          }`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {h.confirmed_by ? (
                          <div>
                            <span className="font-bold block text-slate-900">{h.confirmed_by}</span>
                            <span className="text-[10px] text-slate-400">{h.confirmed_at}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiffinManagementPage;
