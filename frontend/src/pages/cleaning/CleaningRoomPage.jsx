import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Moon,
  Users,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  Search,
  AlertTriangle,
  RefreshCw,
  Send,
  Building,
  Check,
  Filter,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  UserX
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';

const CleaningRoomPage = ({ onBack, initialRoom = 'ALL' }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Active Session Tab: 'morning' | 'night'
  const [activeSession, setActiveSession] = useState('morning');

  // Morning State
  const [morningData, setMorningData] = useState(null);
  const [loadingMorning, setLoadingMorning] = useState(true);

  // Night State
  const [nightData, setNightData] = useState(null);
  const [loadingNight, setLoadingNight] = useState(true);

  // Common UI State
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState(initialRoom || 'ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT'
  const [submitting, setSubmitting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Date selection (default today)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Evaluation Simulation controls
  const [simTime, setSimTime] = useState('');
  const [simDay, setSimDay] = useState('');

  // 1. Fetch Morning Session
  const fetchMorning = async () => {
    try {
      setLoadingMorning(true);
      setError('');
      let url = `/food-allocation/cleaning/morning-tiffin/${selectedDate}`;
      const params = [];
      if (simTime) params.push(`sim_time=${encodeURIComponent(simTime)}`);
      if (simDay) params.push(`sim_day=${encodeURIComponent(simDay)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await api.get(url);
      setMorningData(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load morning tiffin count.');
    } finally {
      setLoadingMorning(false);
    }
  };

  // 2. Fetch Night Session
  const fetchNight = async () => {
    try {
      setLoadingNight(true);
      setError('');
      let url = `/food-allocation/cleaning/night-meal/${selectedDate}`;
      if (simTime) url += `?sim_time=${encodeURIComponent(simTime)}`;

      const res = await api.get(url);
      setNightData(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load night meal count.');
    } finally {
      setLoadingNight(false);
    }
  };

  useEffect(() => {
    if (activeSession === 'morning') {
      fetchMorning();
    } else {
      fetchNight();
    }
  }, [activeSession, selectedDate, simTime, simDay]);

  const refreshActive = () => {
    if (activeSession === 'morning') fetchMorning();
    else fetchNight();
  };

  // 3. Toggle Morning Tiffin / Box
  const handleToggleMorning = async (studentId, field, currentVal) => {
    if (!morningData || morningData.is_locked || (!isAdmin && morningData?.cleaning_duty && !morningData?.cleaning_duty?.has_duty)) return;

    const student = morningData.students.find(s => s.student_id === studentId);
    if (!student) return;

    // Rule: Absent and leave students cannot be counted as Yes or No!
    if (student.attendance_status !== 'PRESENT') {
      setMessage(`Student ${student.name} is marked ${student.attendance_status} in attendance and cannot be counted as Yes or No.`);
      return;
    }

    const newTiffin = field === 'tiffin' ? !currentVal : student.tiffin_required;
    const newBox = field === 'box' ? !currentVal : student.box_required;

    // Optimistic UI update
    setMorningData(prev => {
      const updated = prev.students.map(s => {
        if (s.student_id === studentId) {
          return {
            ...s,
            tiffin_required: newTiffin,
            box_required: newBox,
            is_checked: true
          };
        }
        return s;
      });

      const tCount = updated.filter(s => s.tiffin_required && s.attendance_status === 'PRESENT').length;
      const bCount = updated.filter(s => s.box_required && s.attendance_status === 'PRESENT').length;
      const chkCount = updated.filter(s => s.is_checked && s.attendance_status === 'PRESENT').length;
      const presentCount = updated.filter(s => s.attendance_status === 'PRESENT').length;

      return {
        ...prev,
        summary: {
          ...prev.summary,
          tiffin_count: tCount,
          box_count: bCount,
          students_checked: chkCount,
          remaining: Math.max(0, presentCount - chkCount)
        },
        students: updated
      };
    });

    try {
      await api.post('/food-allocation/cleaning/morning-tiffin/save-record', {
        date: selectedDate,
        student_id: studentId,
        tiffin_required: newTiffin,
        box_required: newBox
      });
    } catch (err) {
      console.error(err);
      fetchMorning();
    }
  };

  // 4. Toggle Night Meal
  // 4. Toggle Night Meal
  const handleToggleNight = async (studentId, currentVal) => {
    if (!nightData || nightData.is_locked || (!isAdmin && nightData?.cleaning_duty && !nightData?.cleaning_duty?.has_duty)) return;

    const student = nightData.students.find(s => s.student_id === studentId);
    if (!student) return;

    const newRequired = !currentVal;

    // Optimistic UI update
    setNightData(prev => {
      const updated = prev.students.map(s => {
        if (s.student_id === studentId) {
          return {
            ...s,
            attendance_status: newRequired ? 'PRESENT' : s.attendance_status,
            meal_required: newRequired,
            is_checked: true
          };
        }
        return s;
      });

      const mCount = updated.filter(s => s.meal_required && s.attendance_status === 'PRESENT').length;
      const chkCount = updated.filter(s => s.is_checked && s.attendance_status === 'PRESENT').length;
      const presentCount = updated.filter(s => s.attendance_status === 'PRESENT').length;

      return {
        ...prev,
        summary: {
          ...prev.summary,
          night_meal_count: mCount,
          students_checked: chkCount,
          remaining: Math.max(0, presentCount - chkCount)
        },
        students: updated
      };
    });

    try {
      await api.post('/food-allocation/cleaning/night-meal/save-record', {
        date: selectedDate,
        student_id: studentId,
        meal_required: newRequired
      });
      if (student.attendance_status !== 'PRESENT' && newRequired) {
        setMessage(`Student ${student.name} marked Present & counted for Night Dinner!`);
      }
    } catch (err) {
      console.error(err);
      fetchNight();
    }
  };

  // 5. Unlock / Re-open Session
  const handleUnlock = async () => {
    try {
      setUnlocking(true);
      setError('');
      setMessage('');
      const res = await api.post('/food-allocation/cleaning/unlock', {
        date: selectedDate,
        session: activeSession
      });
      setMessage(res.data.message || 'Session unlocked for editing.');
      refreshActive();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to unlock session.');
    } finally {
      setUnlocking(false);
    }
  };

  // 6. Submit Final Count
  const handleSubmitFinal = async () => {
    if (!isAdmin && currentData?.cleaning_duty && !currentData?.cleaning_duty?.has_duty) {
      setError("Your room does not have cleaning duty today. Only on-duty rooms can submit counts.");
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      setMessage('');

      if (activeSession === 'morning') {
        const payload = {
          date: selectedDate,
          sim_time: simTime || undefined,
          sim_day: simDay || undefined,
          override_window: true
        };
        const res = await api.post('/food-allocation/cleaning/morning-tiffin/submit', payload);
        setMessage(res.data.message || 'Morning Tiffin Count submitted & locked successfully!');
      } else {
        const payload = {
          date: selectedDate,
          sim_time: simTime || undefined,
          override_window: true
        };
        const res = await api.post('/food-allocation/cleaning/night-meal/submit', payload);
        setMessage(res.data.message || 'Night Meal Count submitted & locked successfully!');
      }

      setShowConfirmModal(false);
      refreshActive();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to submit meal count.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentData = activeSession === 'morning' ? morningData : nightData;
  const loading = activeSession === 'morning' ? loadingMorning : loadingNight;
  const isDutyInactive = !isAdmin && currentData?.cleaning_duty && !currentData?.cleaning_duty?.has_duty;

  // Filtered students by search, room, and attendance status
  const filteredStudents = currentData?.students?.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase()) ||
      s.room_number.toLowerCase().includes(search.toLowerCase());
    const matchesRoom = roomFilter === 'ALL' || s.room_number === roomFilter;
    const matchesAttendance =
      attendanceFilter === 'ALL' ||
      (attendanceFilter === 'PRESENT' && s.attendance_status === 'PRESENT') ||
      (attendanceFilter === 'ABSENT' && s.attendance_status !== 'PRESENT');
    return matchesSearch && matchesRoom && matchesAttendance;
  }) || [];

  const uniqueRooms = ['ALL', ...Array.from(new Set(currentData?.students?.map(s => s.room_number) || []))];
  const userRoom = currentData?.cleaning_duty?.user_room;
  const myRoomStudents = userRoom
    ? currentData?.students?.filter(s => s.room_number === userRoom) || []
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb / Return to Students List */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (onBack) onBack();
              else if (isAdmin) navigate('/admin/students');
              else navigate('/student/dashboard');
            }}
            className="p-2 hover:bg-slate-200/80 rounded-xl transition text-slate-600 flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Students</span>
          </button>
          <span className="text-slate-300">•</span>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Students Section &rarr; 🧹 Cleaning Room</span>
          </span>
        </div>

        {/* Date Selector */}
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* 1. RESTRICTED VIEW: When current student's room does NOT have cleaning duty today */}
      {isDutyInactive ? (
        <div className="space-y-6">
          {/* Main Hero Restriction Banner */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 rounded-3xl shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
                  🧹
                </div>
                <div>
                  <span className="px-3 py-1 bg-amber-200 text-amber-900 rounded-full text-[11px] font-black uppercase tracking-wider">
                    Institutional Meal Count Rule
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    The Meal Count Is Only Taken by the Cleaning Room, Not All Rooms
                  </h2>
                </div>
              </div>

              <div className="px-3.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-900 shadow-2xs">
                <span>Date: {formatDate(selectedDate)} ({currentData?.day})</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              In <strong>Veerashaiva Lingayath Boys Hostel</strong>, daily headcounts for <strong>Morning Breakfast / Tiffin</strong>, <strong>Lunch Box</strong>, and <strong>Night Dinner</strong> are recorded and submitted exclusively by the residents of the room assigned housekeeping duty for today ({currentData?.day}). 
              Residents of other rooms do not take or submit meal counts.
            </p>

            {/* Authority Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs space-y-1.5">
                <div className="flex items-center space-x-2 text-amber-800 text-xs font-bold uppercase">
                  <span>📅</span>
                  <span>Today's Assigned Cleaning Room</span>
                </div>
                <p className="text-xl font-black text-amber-950">
                  {currentData?.cleaning_duty?.scheduled_rooms?.[0] || 'None'}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Authorized on duty to record, verify, and submit hostel meal counts to the mess kitchen (1 room per day).
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center space-x-2 text-slate-600 text-xs font-bold uppercase">
                  <span>🏠</span>
                  <span>Your Room</span>
                </div>
                <p className="text-xl font-black text-slate-900">
                  {currentData?.cleaning_duty?.user_room || 'Your Room'}
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1">
                  <span>✅</span>
                  <span>No cleaning duty today. Meal counts are taken for you by the Cleaning Room.</span>
                </p>
              </div>
            </div>

            {/* Today's Official Food Routine */}
            <div className="p-4 bg-white/80 rounded-2xl border border-amber-200/80 space-y-2">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Today's Scheduled Mess Routine Menu
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700 block mb-0.5">🌅 Morning Breakfast</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {currentData?.morning_dish || currentData?.food_item || 'Morning Breakfast'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Window: 5:00 AM – 8:30 AM IST</span>
                </div>
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                  <span className="text-[10px] font-bold text-purple-700 block mb-0.5">🌙 Night Dinner</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {currentData?.night_dish || 'Rice / Ragi Mudde + Sambar'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Active All Day (Morning to 8:30 PM) • Final Count: 5:00–6:30 PM</span>
                </div>
              </div>
            </div>
          </div>

          {/* My Room Residents' Recorded Requirements (Read-Only) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <span>👥</span>
                  <span>My Room ({currentData?.cleaning_duty?.user_room || 'Your Room'}) &bull; Recorded Meal Status</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Read-only status recorded by today's Cleaning Room team during rounds.
                </p>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                Read-Only (Cleaning Team Record)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRoomStudents.map((st) => (
                <div key={st.student_id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{st.name}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">#{st.student_id}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                      {st.bed_number || 'Bed'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs pt-1 border-t border-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Daily Attendance:</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        st.attendance_status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {st.attendance_status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">🍱 Morning Tiffin:</span>
                      <span className="font-bold text-slate-800">
                        {st.attendance_status !== 'PRESENT' ? 'Exempt (Absent)' : st.tiffin_required ? '✓ Needed' : 'Not Needed'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">📦 Lunch Box:</span>
                      <span className="font-bold text-slate-800">
                        {st.attendance_status !== 'PRESENT' ? 'Exempt (Absent)' : st.box_required ? '✓ Needed' : 'Not Needed'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">🍽️ Night Dinner:</span>
                      <span className="font-bold text-slate-800">
                        {st.attendance_status !== 'PRESENT' ? 'Exempt (Absent)' : st.meal_required ? '✓ Required' : 'Not Required'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {myRoomStudents.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                No resident records found for {currentData?.cleaning_duty?.user_room || 'your room'}.
              </p>
            )}

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center space-x-2 font-medium">
              <span className="text-base">ℹ️</span>
              <span>
                Requirements are recorded directly during morning (5:30–7:00 AM) and night (5:00–6:30 PM) rounds by today's Cleaning Room team ({currentData?.cleaning_duty?.scheduled_rooms?.join(', ') || 'Cleaning Team'}).
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* 2. ACTIVE COUNTING SUITE: Only for Admin or On-Duty Cleaning Room */
        <div className="space-y-6">
          {/* Main Header Banner */}
          <div className={`rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden transition-all duration-300 ${
        activeSession === 'morning'
          ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700'
          : 'bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900'
      }`}>
        <div className="absolute right-0 top-0 opacity-10 translate-x-8 -translate-y-8 pointer-events-none">
          {activeSession === 'morning' ? (
            <Coffee className="w-80 h-80" />
          ) : (
            <Moon className="w-80 h-80" />
          )}
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wider uppercase flex items-center space-x-1.5">
                <span>🧹</span>
                <span>CLEANING ROOM</span>
              </span>
              {isAdmin ? (
                <span className="px-3 py-1 bg-blue-500/30 backdrop-blur-md rounded-full text-xs font-semibold border border-white/20">
                  Warden Oversight: All 12 Rooms
                </span>
              ) : (
                <span className="px-3 py-1 bg-emerald-500/30 backdrop-blur-md rounded-full text-xs font-semibold border border-white/20 flex items-center space-x-1">
                  <span>✨</span>
                  <span>Duty Active: {currentData?.cleaning_duty?.user_room}</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {currentData?.food_item || (activeSession === 'morning' ? 'Morning Breakfast' : 'Night Dinner')}
            </h1>

            <p className="text-white/80 text-sm mt-1 flex items-center space-x-2 font-medium">
              <Clock className="w-4 h-4 text-white/90" />
              <span>
                {activeSession === 'morning'
                  ? 'Count Window: 5:00 AM – 8:30 AM IST (Mon–Sat)'
                  : 'Count Window: Open All Day (5:30 AM – 8:30 PM IST) • Evening Final: 5:00 PM – 6:30 PM'}
              </span>
              <span>•</span>
              <span>Date: {formatDate(selectedDate)} ({currentData?.day})</span>
            </p>

            {!isAdmin && (
              <p className="mt-2 text-xs text-amber-100 font-medium bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 inline-flex items-center space-x-1.5">
                <span>🛡️</span>
                <span>
                  <strong>Cleaning Duty Active:</strong> Residents of <strong>{currentData?.cleaning_duty?.user_room}</strong> are taking hostel meal counts today.
                </span>
              </p>
            )}
          </div>

          {/* Session Switcher Tabs (Inside Cleaning Room) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="p-1.5 bg-black/30 backdrop-blur-md rounded-2xl flex items-center space-x-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveSession('morning')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer ${
                  activeSession === 'morning'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>🌅</span>
                <span>Morning Tiffin & Box</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSession('night')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer ${
                  activeSession === 'night'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>🌙</span>
                <span>Night Meal</span>
              </button>
            </div>

            {/* Housekeeping Tasks Switcher (Admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin/cleaning')}
                className="py-2 px-3.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                title="View Hostel Housekeeping & Daily Sanitation Board"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span className="hidden sm:inline">Housekeeping Board</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={refreshActive}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-xl transition text-white"
              title="Refresh counts"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Indicator & Locked Banner */}
        <div className="mt-4 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {currentData?.is_locked ? (
              <div className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-md">
                <Lock className="w-3.5 h-3.5" />
                <span>VERIFIED & LOCKED</span>
              </div>
            ) : currentData?.window?.is_sunday && activeSession === 'morning' ? (
              <div className="px-3.5 py-1.5 bg-red-500 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-md">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>SUNDAY EXCEPTION (NO TIFFIN COUNT)</span>
              </div>
            ) : currentData?.status === 'IN_PROGRESS' || currentData?.window?.is_open ? (
              <div className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-md animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                <span>COUNTING ACTIVE</span>
              </div>
            ) : (
              <div className="px-3.5 py-1.5 bg-slate-900/80 text-amber-200 rounded-xl font-bold text-xs flex items-center space-x-1.5 border border-amber-500/30">
                <Lock className="w-3.5 h-3.5" />
                <span>COUNT WINDOW CLOSED</span>
              </div>
            )}

            {currentData?.is_locked && (
              <span className="text-xs text-emerald-200">
                Submitted by <strong>{currentData.submitted_by || 'Cleaning Team'}</strong> at {currentData.submitted_at ? new Date(currentData.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified'}.
              </span>
            )}
          </div>

          {currentData?.is_locked && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono px-2.5 py-1 bg-black/20 rounded-lg text-emerald-200">
                Read-Only Snapshot
              </span>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={unlocking}
                className="px-3.5 py-1.5 bg-white text-slate-900 hover:bg-amber-100 rounded-xl font-bold text-xs shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-600" />
                <span>{unlocking ? 'Unlocking...' : 'Unlock / Edit Session'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Sunday Exception Alert */}
        {activeSession === 'morning' && currentData?.window?.is_sunday && (
          <div className="mt-4 p-3.5 bg-red-950/70 border border-red-400/40 rounded-2xl text-xs sm:text-sm text-red-100 flex items-start space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">SUNDAY TIFFIN EXCEPTION</p>
              <p className="text-red-200 text-xs mt-0.5">
                Every Sunday: Morning Tiffin Count is not opened, and Tiffin / Box requirements are not asked.
                Sunday breakfast (Idli, Chutney, Sambar) and dining continue directly in the mess.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-sm font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Students Checked */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Students Checked
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">
              {currentData?.summary?.students_checked || 0}{' '}
              <span className="text-base font-medium text-slate-400">
                / {currentData?.summary?.present_count ?? currentData?.summary?.total_students ?? 0}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Checked present residents ({(currentData?.summary?.absent_count || 0) + (currentData?.summary?.leave_count || 0)} absent exempt)
            </p>
          </div>
        </div>

        {/* Morning Mode: Tiffin and Box Cards */}
        {activeSession === 'morning' ? (
          <>
            {/* Card 2: 🍱 Tiffin Count */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs bg-gradient-to-br from-white to-amber-50/40 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center space-x-1">
                  <span>🍱</span>
                  <span>Tiffin Count</span>
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  🍱
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-amber-900">
                  {currentData?.summary?.tiffin_count || 0}
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  Breakfast tiffin needed (Present only)
                </p>
              </div>
            </div>

            {/* Card 3: 📦 Box Count */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs bg-gradient-to-br from-white to-indigo-50/40 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center space-x-1">
                  <span>📦</span>
                  <span>Box Count</span>
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  📦
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-indigo-900">
                  {currentData?.summary?.box_count || 0}
                </div>
                <p className="text-xs text-indigo-700 mt-1">
                  Lunch boxes requested (Present only)
                </p>
              </div>
            </div>
          </>
        ) : (
          /* Night Mode: 🍽️ Night Meal Count Card */
          <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-xs bg-gradient-to-br from-white to-purple-50/40 flex flex-col justify-between col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center space-x-1">
                <span>🍽️</span>
                <span>Night Meal Count</span>
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                🍽️
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-purple-900">
                {currentData?.summary?.night_meal_count || 0}
              </div>
              <p className="text-xs text-purple-700 mt-1">
                Verified dinner requirements for tonight (Present only)
              </p>
            </div>
          </div>
        )}

        {/* Card 4: ⏳ Remaining */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Remaining
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-700">
              {currentData?.summary?.remaining || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Present residents awaiting check
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Simulation Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or room..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-slate-50/50"
          />
        </div>

        {/* Room Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-500 uppercase shrink-0">Room:</span>
          {uniqueRooms.slice(0, 8).map(room => (
            <button
              key={room}
              onClick={() => setRoomFilter(room)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                roomFilter === room
                  ? activeSession === 'morning' ? 'bg-amber-600 text-white' : 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {room}
            </button>
          ))}
          {uniqueRooms.length > 8 && (
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="text-xs font-bold px-2 py-1.5 rounded-xl bg-slate-100 border-none text-slate-600"
            >
              {uniqueRooms.slice(8).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>

        {/* Attendance Filter Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase shrink-0">Show:</span>
          {[
            { label: 'All Residents', value: 'ALL' },
            { label: 'Present (Counted)', value: 'PRESENT' },
            { label: 'Absent / Leave (Exempt)', value: 'ABSENT' }
          ].map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setAttendanceFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                attendanceFilter === f.value
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Simulation Controls for evaluation */}
        <div className="flex items-center space-x-2 text-xs text-slate-500 shrink-0">
          <span className="font-semibold text-slate-400">Simulate:</span>
          <select
            value={simTime}
            onChange={(e) => setSimTime(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
          >
            <option value="">Actual Clock</option>
            <option value="05:29">5:29 AM (Morning Closed)</option>
            <option value="06:00">6:00 AM (Morning Open)</option>
            <option value="07:00">7:00 AM (Morning Closed)</option>
            <option value="17:30">5:30 PM (Night Open)</option>
          </select>
          {activeSession === 'morning' && (
            <select
              value={simDay}
              onChange={(e) => setSimDay(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="">Actual Day</option>
              <option value="Monday">Monday</option>
              <option value="Sunday">Sunday (Exception)</option>
            </select>
          )}
        </div>
      </div>

      {/* Attendance Policy Banner */}
      <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-blue-900">
        <div className="flex items-center space-x-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Attendance Exemption Policy:</strong> Absent and on-leave students are automatically exempted and <strong>NOT counted as Yes or No</strong> in meal totals.
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-md bg-blue-200/80 text-blue-900 font-bold text-[10px] shrink-0">
          {(currentData?.summary?.absent_count || 0) + (currentData?.summary?.leave_count || 0)} Absent Excluded
        </span>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredStudents.map(student => {
          const isPresent = student.attendance_status === 'PRESENT';
          const isLeave = student.attendance_status === 'LEAVE';

          return (
            <div
              key={student.student_id}
              className={`p-5 rounded-2xl border transition shadow-xs flex flex-col justify-between space-y-4 ${
                currentData?.is_locked
                  ? 'bg-slate-50/70 border-slate-200 opacity-90'
                  : student.is_checked
                  ? activeSession === 'morning' ? 'bg-white border-amber-200 ring-1 ring-amber-100' : 'bg-white border-purple-200 ring-1 ring-purple-100'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Student Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-base leading-tight">
                      {student.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      #{student.student_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {student.department} • Year {student.semester ? Math.ceil(student.semester / 2) : 1}
                  </p>
                </div>

                <div className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>{student.room_number}</span>
                </div>
              </div>

              {/* Attendance Reference */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-medium">Daily Attendance:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                    isPresent
                      ? 'bg-emerald-100 text-emerald-800'
                      : isLeave
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {student.attendance_status}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100">
                {!isPresent ? (
                  /* EXEMPT / NOT COUNTED: Student is ABSENT or on LEAVE */
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <UserX className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-xs font-black text-slate-700 block">
                          {isLeave ? 'Student on Approved Leave' : 'Student Marked Absent'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Exempt &bull; Not counted as Yes or No
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wide">
                      Not Counted
                    </span>
                  </div>
                ) : activeSession === 'morning' ? (
                  /* Morning: Tiffin and Box (2 Independent Options) */
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 🍱 TIFFIN */}
                    <button
                      type="button"
                      disabled={currentData?.is_locked || (activeSession === 'morning' && currentData?.window?.is_sunday) || isDutyInactive}
                      onClick={() => handleToggleMorning(student.student_id, 'tiffin', student.tiffin_required)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer disabled:cursor-not-allowed ${
                        student.tiffin_required
                          ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-black uppercase tracking-wider flex items-center space-x-1">
                          <span>🍱</span>
                          <span>TIFFIN</span>
                        </span>
                        {student.tiffin_required ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-slate-300"></span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold ${student.tiffin_required ? 'text-amber-100' : 'text-slate-500'}`}>
                        {student.tiffin_required ? '✓ Needed' : 'Not Needed'}
                      </span>
                    </button>

                    {/* 📦 BOX */}
                    <button
                      type="button"
                      disabled={currentData?.is_locked || (activeSession === 'morning' && currentData?.window?.is_sunday) || isDutyInactive}
                      onClick={() => handleToggleMorning(student.student_id, 'box', student.box_required)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer disabled:cursor-not-allowed ${
                        student.box_required
                          ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-black uppercase tracking-wider flex items-center space-x-1">
                          <span>📦</span>
                          <span>BOX</span>
                        </span>
                        {student.box_required ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-slate-300"></span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold ${student.box_required ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {student.box_required ? '✓ Needed' : 'Not Needed'}
                      </span>
                    </button>
                  </div>
                ) : (
                  /* Night: Dinner Meal Toggle */
                  <button
                    type="button"
                    disabled={currentData?.is_locked || isDutyInactive}
                    onClick={() => handleToggleNight(student.student_id, student.meal_required)}
                    className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer disabled:cursor-not-allowed ${
                      student.meal_required
                        ? 'bg-purple-600 border-purple-700 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🍽️</span>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">
                          DINNER MEAL
                        </p>
                        <p className={`text-[11px] font-bold ${student.meal_required ? 'text-purple-200' : 'text-slate-500'}`}>
                          {student.meal_required ? '✓ Meal Required' : 'Not Required'}
                        </p>
                      </div>
                    </div>
                    {student.meal_required ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300"></span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500 text-sm font-medium">
            No students found matching your search or room filter.
          </p>
        </div>
      )}
        </div>
      )}

      {/* Sticky Bottom Submission Bar */}
      {!isDutyInactive && !currentData?.is_locked && !(activeSession === 'morning' && currentData?.window?.is_sunday) && (
        <div className="sticky bottom-4 z-20 bg-slate-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {activeSession === 'morning' ? 'Morning Tiffin Summary' : 'Night Meal Summary'}
            </p>
            <div className="flex items-center space-x-4 mt-0.5">
              {activeSession === 'morning' ? (
                <>
                  <span className="text-sm font-bold text-amber-400">
                    🍱 Tiffin: <strong>{currentData?.summary?.tiffin_count || 0}</strong>
                  </span>
                  <span className="text-sm font-bold text-indigo-400">
                    📦 Box: <strong>{currentData?.summary?.box_count || 0}</strong>
                  </span>
                </>
              ) : (
                <span className="text-sm font-bold text-purple-300">
                  🍽️ Dinner Meal: <strong>{currentData?.summary?.night_meal_count || 0}</strong>
                </span>
              )}
              <span className="text-xs text-slate-300">
                Checked: {currentData?.summary?.students_checked || 0} / {currentData?.summary?.total_students || 0}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-sm shadow-lg hover:shadow-xl transition flex items-center justify-center space-x-2 cursor-pointer active:scale-98 text-white ${
              activeSession === 'morning'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              Submit Final {activeSession === 'morning' ? 'Morning' : 'Night'} Count
            </span>
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl ${
                activeSession === 'morning' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {activeSession === 'morning' ? '🍱' : '🌙'}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Confirm {activeSession === 'morning' ? 'Morning Tiffin' : 'Night Meal'} Submission
                </h3>
                <p className="text-xs text-slate-500">
                  {formatDate(selectedDate)} ({currentData?.day}) • {currentData?.food_item}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-sm">
              {activeSession === 'morning' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">🍱 Final Tiffin Count:</span>
                    <span className="font-black text-amber-800 text-base">
                      {currentData?.summary?.tiffin_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">📦 Final Box Count:</span>
                    <span className="font-black text-indigo-800 text-base">
                      {currentData?.summary?.box_count || 0}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">🍽️ Final Night Meal Count:</span>
                  <span className="font-black text-purple-800 text-base">
                    {currentData?.summary?.night_meal_count || 0}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 text-xs text-slate-500">
                <span>Verified Students:</span>
                <span>{currentData?.summary?.students_checked || 0} / {currentData?.summary?.total_students || 0}</span>
              </div>
            </div>

            <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 leading-relaxed font-medium">
              🔒 <strong>Locking Rule:</strong> Once submitted, this count will be marked <strong>VERIFIED & LOCKED</strong>. The Warden will view this snapshot in the Food Management area.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitFinal}
                className={`flex-1 py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer ${
                  activeSession === 'morning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {submitting ? 'Locking...' : 'Confirm & Lock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningRoomPage;
