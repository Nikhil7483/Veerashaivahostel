import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import StatCard from '../../components/common/StatCard';
import { formatDate } from '../../utils/dateUtils';
import ResidentMealRoster from '../../components/cleaning/ResidentMealRoster';
import {
  CalendarCheck,
  PlaneTakeoff,
  Bed,
  UtensilsCrossed,
  Megaphone,
  Lock,
  Unlock,
  CheckCircle2,
  Coffee,
  Package,
  Moon,
  Clock,
  ClipboardCheck,
  Sparkles,
  Check,
  X,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user?.student_profile || null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [cleaningStatus, setCleaningStatus] = useState('COMPLETED');
  const [announcements, setAnnouncements] = useState([]);
  const [foodHistory, setFoodHistory] = useState([]);
  const [studentFood, setStudentFood] = useState(null);
  const [submittingFood, setSubmittingFood] = useState(false);
  const [foodMsg, setFoodMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Today's Hostel Duty state
  const [dutyData, setDutyData] = useState(null);
  const [dutyCleaningCompleted, setDutyCleaningCompleted] = useState(false);
  const [dutyTiffinCount, setDutyTiffinCount] = useState(0);
  const [dutyBoxCount, setDutyBoxCount] = useState(0);
  const [dutyDinnerCount, setDutyDinnerCount] = useState(0);
  const [submittingDuty, setSubmittingDuty] = useState(false);
  const [dutyMessage, setDutyMessage] = useState({ type: '', text: '' });
  const [rosterStudents, setRosterStudents] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const loadDutyRoster = async () => {
    try {
      setLoadingRoster(true);
      const res = await api.get('/cleaning/duty/roster');
      if (res?.data?.students) {
        setRosterStudents(res.data.students);
        setDutyDinnerCount(res.data.night_dinner_count || res.data.present_count || 0);
      }
    } catch (err) {
      console.error('Error loading duty roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleToggleStudent = (studentId, field) => {
    setRosterStudents((prev) => {
      const next = prev.map((s) => {
        if (s.student_id === studentId) {
          const isPres = Boolean(s.is_present || s.attendance_status === 'PRESENT');
          if (!isPres) return s;
          return { ...s, [field]: !s[field] };
        }
        return s;
      });
      const tif = next.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.tiffin_required).length;
      const box = next.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.box_required).length;
      const din = next.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.night_required !== false).length;
      setDutyTiffinCount(tif);
      setDutyBoxCount(box);
      setDutyDinnerCount(din);
      return next;
    });
  };

  const handleBatchUpdateRoster = (field, value, targetRoom = null) => {
    setRosterStudents((prev) => {
      const next = prev.map((s) => {
        const isPres = Boolean(s.is_present || s.attendance_status === 'PRESENT');
        if (!isPres) return s;
        if (targetRoom && s.room_number !== targetRoom) return s;
        return { ...s, [field]: value };
      });
      const tif = next.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.tiffin_required).length;
      const box = next.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.box_required).length;
      const din = next.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.night_required !== false).length;
      setDutyTiffinCount(tif);
      setDutyBoxCount(box);
      setDutyDinnerCount(din);
      return next;
    });
  };

  const presentStudentsCount = useMemo(() => {
    return rosterStudents.filter((s) => s.is_present || s.attendance_status === 'PRESENT').length;
  }, [rosterStudents]);

  const handleSetDutyTiffinCount = (count) => {
    const num = Math.max(0, parseInt(count, 10) || 0);
    setDutyTiffinCount(num);
    if (num >= presentStudentsCount && presentStudentsCount > 0) {
      handleBatchUpdateRoster('tiffin_required', true);
    } else if (num === 0) {
      handleBatchUpdateRoster('tiffin_required', false);
    }
  };

  const handleSetDutyBoxCount = (count) => {
    const num = Math.max(0, parseInt(count, 10) || 0);
    setDutyBoxCount(num);
    if (num >= presentStudentsCount && presentStudentsCount > 0) {
      handleBatchUpdateRoster('box_required', true);
    } else if (num === 0) {
      handleBatchUpdateRoster('box_required', false);
    }
  };

  const handleSetDutyDinnerCount = (count) => {
    const num = Math.max(0, parseInt(count, 10) || 0);
    setDutyDinnerCount(num);
    if (num >= presentStudentsCount && presentStudentsCount > 0) {
      handleBatchUpdateRoster('night_required', true);
    } else if (num === 0) {
      handleBatchUpdateRoster('night_required', false);
    }
  };

  const computedTiffinCount = useMemo(() => {
    return rosterStudents.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.tiffin_required).length;
  }, [rosterStudents]);

  const computedBoxCount = useMemo(() => {
    return rosterStudents.filter((s) => (s.is_present || s.attendance_status === 'PRESENT') && s.box_required).length;
  }, [rosterStudents]);

  const loadStudentDashboard = async (isSilent = false) => {
    try {
      const [profRes, attRes, roomRes, leaveRes, annRes, foodRes, histRes, dutyRes] = await Promise.all([
        api.get('/students/my/profile'),
        api.get('/attendance/my/records'),
        api.get('/rooms/my/room'),
        api.get('/leaves/my/applications'),
        api.get('/announcements'),
        api.get('/food-allocation/student/today').catch(() => ({ data: null })),
        api.get('/food-allocation/student/history').catch(() => ({ data: [] })),
        api.get('/cleaning/duty/today').catch(() => ({ data: null }))
      ]);

      setProfile(profRes.data);
      setAttendanceStats(attRes.data);
      setRoomDetails(roomRes.data);
      setLeaves(leaveRes.data);
      setCleaningStatus(roomRes.data.cleaning_status || 'COMPLETED');
      setAnnouncements(annRes.data.slice(0, 3));
      setStudentFood(foodRes?.data || null);
      setFoodHistory(histRes?.data || []);

      if (dutyRes?.data) {
        setDutyData(dutyRes.data);
        setDutyCleaningCompleted(Boolean(dutyRes.data.cleaning_completed));
        setDutyTiffinCount(Number(dutyRes.data.tiffin_count) || 0);
        setDutyBoxCount(Number(dutyRes.data.tiffin_box_count) || 0);
        setDutyDinnerCount(Number(dutyRes.data.night_dinner_count) || 0);

        if (dutyRes.data.is_my_room_duty) {
          if (dutyRes.data.student_records && dutyRes.data.student_records.length > 0) {
            setRosterStudents(dutyRes.data.student_records);
          } else {
            loadDutyRoster();
          }
        }
      }
    } catch (err) {
      console.error('Error loading student dashboard:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Poll room cleaning and duty status in background every 15 seconds for real-time unlock
  const pollRoomStatus = async () => {
    try {
      const [roomRes, dutyRes] = await Promise.all([
        api.get('/rooms/my/room'),
        api.get('/cleaning/duty/today').catch(() => ({ data: null }))
      ]);
      setRoomDetails(roomRes.data);
      setCleaningStatus(roomRes.data.cleaning_status || 'COMPLETED');
      if (dutyRes?.data) {
        setDutyData(dutyRes.data);
      }
    } catch (err) {
      // silent background check
    }
  };

  // Submit daily duty by student of duty room
  const handleStudentDutySubmit = async (e) => {
    e.preventDefault();
    if (!dutyCleaningCompleted) {
      setDutyMessage({
        type: 'error',
        text: 'Hostel cleaning completion must be confirmed before submitting daily duty.'
      });
      return;
    }

    const tiffin = parseInt(dutyTiffinCount, 10);
    const box = parseInt(dutyBoxCount, 10);
    const dinner = parseInt(dutyDinnerCount, 10);

    if (isNaN(tiffin) || tiffin < 0 || isNaN(box) || box < 0 || isNaN(dinner) || dinner < 0) {
      setDutyMessage({
        type: 'error',
        text: 'All three meal counts (Tiffin, Tiffin Box, Night Dinner) must be valid non-negative numbers.'
      });
      return;
    }

    setSubmittingDuty(true);
    setDutyMessage({ type: '', text: '' });
    try {
      const res = await api.post('/cleaning/duty/submit', {
        cleaning_completed: true,
        tiffin_count: tiffin,
        tiffin_box_count: box,
        night_dinner_count: dinner,
        student_records: rosterStudents
      });
      setDutyMessage({
        type: 'success',
        text: res.data.message || '🎉 Daily duty submitted for approval! Form is awaiting warden review.'
      });
      const [roomRes, dutyRes] = await Promise.all([
        api.get('/rooms/my/room'),
        api.get('/cleaning/duty/today')
      ]);
      setRoomDetails(roomRes.data);
      setCleaningStatus(roomRes.data.cleaning_status || 'COMPLETED');
      setDutyData(dutyRes.data);
    } catch (err) {
      setDutyMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to submit duty information.'
      });
    } finally {
      setSubmittingDuty(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadStudentDashboard();

    const pollInterval = setInterval(() => {
      if (isMounted) {
        pollRoomStatus();
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isLeaveLocked = roomDetails?.is_leave_locked === true;
  const hasCleaningDuty = dutyData?.is_my_room_duty === true;
  const isCleaningCompleted = (dutyData?.status === 'COMPLETED') || (cleaningStatus === 'COMPLETED');
  const pendingLeavesCount = leaves.filter((l) => l.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Bed className="w-48 h-48" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 text-blue-100 text-xs font-semibold backdrop-blur-xs">
            <span>Resident Dashboard</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome Back, {profile?.name || 'Student'}!
          </h1>

          <p className="text-sm text-blue-100 font-semibold tracking-wide">
            {profile?.room_number || 'Room 05'} | Bed {profile?.bed_number || 'B1'} | {profile?.department || 'AIML'} | {profile?.semester || 6}th Semester
          </p>
        </div>
      </div>

      {/* TODAY'S HOSTEL DUTY SECTION */}
      <div id="today-hostel-duty" className="p-6 sm:p-7 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Today's Hostel Duty &bull; {dutyData?.day || 'Today'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                  {dutyData?.date || ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hostel rotation: 1 Day = 1 Duty Room = 1 Cleaning Job + 3 Meal Counts
              </p>
            </div>
          </div>

          {/* Responsible Room Pill */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-bold">Duty Room:</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-xs sm:text-sm shadow-xs">
              {dutyData?.duty_room || 'Room 01'}
            </span>
          </div>
        </div>

        {/* Responsible Room Relationship Banner */}
        {dutyData?.is_my_room_duty ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🎯</span>
              <div>
                <span className="font-extrabold text-sm text-amber-950 block">
                  Your Room ({profile?.room_number}) is on Daily Duty Today!
                </span>
                <span className="text-xs text-amber-900/90">
                  Residents of your room are responsible for completing the cleaning job and recording the 3 mess meal counts.
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-amber-500 text-slate-950 shrink-0">
              Responsible Room
            </span>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <span className="font-bold text-xs sm:text-sm text-slate-800 block">
                  {dutyData?.duty_room || 'Room 01'} is on duty today
                </span>
                <span className="text-xs text-slate-500">
                  Your room ({profile?.room_number}) has standard resident privileges. Duty tasks are handled by the responsible room.
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-200 text-slate-700 shrink-0">
              Not Your Duty
            </span>
          </div>
        )}

        {/* 4 Status Badges Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Overall Status */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Duty Status</span>
            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
              dutyData?.status === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-800'
                : dutyData?.status === 'IN_PROGRESS'
                ? 'bg-blue-100 text-blue-800'
                : dutyData?.status === 'ABSENT'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-amber-100 text-amber-800 animate-pulse'
            }`}>
              {dutyData?.status || 'PENDING'}
            </span>
          </div>

          {/* 2. Cleaning Status */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hostel Cleaning Job</span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
              dutyData?.cleaning_completed
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-700'
            }`}>
              {dutyData?.cleaning_completed ? <Check className="w-3.5 h-3.5" /> : null}
              {dutyData?.cleaning_completed ? 'Completed' : 'Pending'}
            </span>
          </div>

          {/* 3. Daily Meal Duty (Counts only show on Warden page) */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Daily Meal Duty</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
              dutyData?.status === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-800'
                : dutyData?.status === 'PENDING_APPROVAL'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-indigo-100 text-indigo-800'
            }`}>
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>{dutyData?.status === 'COMPLETED' ? 'Verified' : `Duty: ${dutyData?.duty_room || 'Room 01'}`}</span>
            </span>
          </div>

          {/* 4. Leave Availability */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Leave Availability</span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
              dutyData?.is_my_room_duty
                ? (dutyData?.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {dutyData?.is_my_room_duty ? (
                dutyData?.status === 'COMPLETED' ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlocked</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Locked (Duty Pending)</span>
                  </>
                )
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Available</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Message Banner for Submissions */}
        {dutyMessage.text && (
          <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
            dutyMessage.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            <span>{dutyMessage.text}</span>
            <button onClick={() => setDutyMessage({ type: '', text: '' })}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* LOCKED STATE: Duty Submitted & Waiting for Warden Approval */}
        {dutyData?.is_my_room_duty && dutyData?.status === 'PENDING_APPROVAL' && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-amber-950 space-y-3">
            <div className="flex items-start space-x-2.5">
              <div className="p-2 bg-amber-500/20 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <Lock className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <span className="font-black text-sm block">
                  🔒 Duty Headcount & Cleaning Submitted — Locked Awaiting Warden Approval
                </span>
                <span className="text-xs text-amber-900/90 leading-relaxed block mt-0.5">
                  Submitted by <strong>{dutyData.submitted_by || 'Duty Students'}</strong> at{' '}
                  {dutyData.submitted_at ? new Date(dutyData.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}.
                  Duty entries are safely locked while under Warden review. The leave facility unlocks automatically once approved.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <span className="text-[10px] text-slate-400 block font-bold">1. Cleaning Job</span>
                <span className="font-black text-emerald-700 flex items-center gap-1 mt-0.5">
                  <Check className="w-3.5 h-3.5" /> Completed
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <span className="text-[10px] text-slate-400 block font-bold">2. Resident Meal Roster</span>
                <span className="font-black text-indigo-700 flex items-center gap-1 mt-0.5">
                  <Check className="w-3.5 h-3.5" /> Recorded & Submitted
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <span className="text-[10px] text-slate-400 block font-bold">3. Warden Verification</span>
                <span className="font-black text-amber-700 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" /> Pending Review
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <span className="text-[10px] text-slate-400 block font-bold">4. Room Leave Status</span>
                <span className="font-black text-amber-700 flex items-center gap-1 mt-0.5">
                  <Lock className="w-3.5 h-3.5" /> Unlocks on Approval
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ABSENT STATE */}
        {dutyData?.is_my_room_duty && dutyData?.status === 'ABSENT' && (
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-300 text-rose-950 space-y-1">
            <div className="flex items-center space-x-2">
              <X className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-black text-sm">
                ⚠️ Room Declared Absent for Daily Duty
              </span>
            </div>
            <p className="text-xs text-rose-900 leading-relaxed">
              Warden marked this room absent for today's duty. Reason: <strong>{dutyData.absence_reason || 'Absent'}</strong>.
              Duty has advanced to the next eligible room. Leave facility remains locked for today.
            </p>
          </div>
        )}

        {/* EDITABLE FORM: Open for PENDING, IN_PROGRESS, RETURNED_FOR_CORRECTION, PENDING_APPROVAL */}
        {dutyData?.is_my_room_duty && ['PENDING', 'IN_PROGRESS', 'RETURNED_FOR_CORRECTION', 'PENDING_APPROVAL'].includes(dutyData?.status) && (
          <form onSubmit={handleStudentDutySubmit} className="pt-2 border-t border-slate-100 space-y-5">
            {/* If returned for correction by warden */}
            {dutyData?.status === 'RETURNED_FOR_CORRECTION' && (
              <div className="p-3.5 bg-orange-50 rounded-2xl border-2 border-orange-300 text-orange-950 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-base">⚠️</span>
                  <span className="font-black text-xs sm:text-sm">
                    Warden Requested Corrections
                  </span>
                </div>
                <p className="text-xs text-orange-900 leading-relaxed">
                  Reason: <strong>{dutyData.rejection_reason || 'Please verify and correct your meal counts or cleaning status'}</strong>.
                  Please update the details below and re-submit for approval.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  ✍️ {dutyData?.status === 'RETURNED_FOR_CORRECTION'
                    ? 'Correct & Re-Submit Duty'
                    : dutyData?.status === 'PENDING_APPROVAL'
                    ? "Review & Update Today's Daily Duty"
                    : "Record Today's Cleaning & Meal Counts"}
                </span>
                <span className="text-[11px] text-slate-500">
                  Select Tiffin & Box for each present student across all 12 hostel rooms.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadDutyRoster}
                  disabled={loadingRoster}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-600 cursor-pointer"
                >
                  {loadingRoster ? 'Refreshing Roster...' : '🔄 Reload Roster'}
                </button>
              </div>
            </div>

            {/* Requirement 1: Complete Hostel Cleaning Job */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-xl mt-0.5 ${dutyCleaningCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">
                    1. Complete Hostel Cleaning Job
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Hostel-wide sanitation rotation (floors, dustbins, common areas, and washrooms).
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDutyCleaningCompleted(!dutyCleaningCompleted)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition cursor-pointer shrink-0 ${
                  dutyCleaningCompleted ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {dutyCleaningCompleted ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Cleaning Completed</span>
                  </>
                ) : (
                  <span>Mark Cleaning Done</span>
                )}
              </button>
            </div>

            {/* Requirement 2: Interactive Resident Meal Roster (Tiffin and Box selection for each present student) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UtensilsCrossed className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    2. Resident Meal Headcount & Box Taking
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  {computedTiffinCount} Tiffin &bull; {computedBoxCount} Box Selected
                </span>
              </div>

              {loadingRoster && rosterStudents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Loading resident roster for all 12 rooms...</p>
                </div>
              ) : (
                <ResidentMealRoster
                  students={rosterStudents}
                  onToggleStudent={handleToggleStudent}
                  onBatchUpdate={handleBatchUpdateRoster}
                  readOnly={false}
                  isWarden={false}
                />
              )}
            </div>

            {/* Requirement 3: 3 Meal Count Cards (With Select Preset Option like Present Students Count) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tiffin Count */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 block">
                    🍱 Tiffin Count
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Selected: {dutyTiffinCount}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Morning breakfast plates served.</p>

                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'present') handleSetDutyTiffinCount(presentStudentsCount);
                    else if (val === 'total') handleSetDutyTiffinCount(64);
                    else if (val === 'zero') handleSetDutyTiffinCount(0);
                  }}
                  defaultValue=""
                  className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  title="Select option like present students count"
                >
                  <option value="" disabled>Select Preset Count...</option>
                  <option value="present">Present Students Count ({presentStudentsCount})</option>
                  <option value="total">Total Students (64)</option>
                  <option value="zero">Zero (0)</option>
                </select>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    value={dutyTiffinCount}
                    onChange={(e) => handleSetDutyTiffinCount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleSetDutyTiffinCount(presentStudentsCount)}
                    className="shrink-0 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-extrabold transition cursor-pointer"
                    title="Fill with present students count"
                  >
                    ⚡ {presentStudentsCount}
                  </button>
                </div>
              </div>

              {/* Tiffin Box Count */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 block">
                    📦 Tiffin Box Count
                  </label>
                  <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                    Selected: {dutyBoxCount}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Packed lunch boxes for classes.</p>

                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'present') handleSetDutyBoxCount(presentStudentsCount);
                    else if (val === 'total') handleSetDutyBoxCount(64);
                    else if (val === 'zero') handleSetDutyBoxCount(0);
                  }}
                  defaultValue=""
                  className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  title="Select option like present students count"
                >
                  <option value="" disabled>Select Preset Count...</option>
                  <option value="present">Present Students Count ({presentStudentsCount})</option>
                  <option value="total">Total Students (64)</option>
                  <option value="zero">Zero (0)</option>
                </select>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    value={dutyBoxCount}
                    onChange={(e) => handleSetDutyBoxCount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleSetDutyBoxCount(presentStudentsCount)}
                    className="shrink-0 px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-xl text-xs font-extrabold transition cursor-pointer"
                    title="Fill with present students count"
                  >
                    ⚡ {presentStudentsCount}
                  </button>
                </div>
              </div>

              {/* Night Dinner Count */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 block">
                    🌙 Night Dinner Count
                  </label>
                  <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                    Selected: {dutyDinnerCount}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Evening mess kitchen dinner plates.</p>

                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'present') handleSetDutyDinnerCount(presentStudentsCount);
                    else if (val === 'total') handleSetDutyDinnerCount(64);
                    else if (val === 'zero') handleSetDutyDinnerCount(0);
                  }}
                  defaultValue=""
                  className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  title="Select option like present students count"
                >
                  <option value="" disabled>Select Preset Count...</option>
                  <option value="present">Present Students Count ({presentStudentsCount})</option>
                  <option value="total">Total Students (64)</option>
                  <option value="zero">Zero (0)</option>
                </select>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    value={dutyDinnerCount}
                    onChange={(e) => handleSetDutyDinnerCount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleSetDutyDinnerCount(presentStudentsCount)}
                    className="shrink-0 px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-xs font-extrabold transition cursor-pointer"
                    title="Fill with present students count"
                  >
                    ⚡ {presentStudentsCount}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submittingDuty}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center space-x-2"
              >
                {submittingDuty ? (
                  <span>Submitting Daily Duty...</span>
                ) : dutyData?.status === 'RETURNED_FOR_CORRECTION' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Re-Submit Daily Duty for Approval</span>
                  </>
                ) : dutyData?.status === 'PENDING_APPROVAL' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Update & Re-Submit Daily Duty for Approval</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Submit Daily Duty for Warden Approval</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* COMPLETED STATE */}
        {dutyData?.is_my_room_duty && dutyData?.status === 'COMPLETED' && (
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              🎉 Complete hostel cleaning job and all meal counts have been verified and approved by Warden. Duty completed for today! Leave applications are unlocked.
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Attendance"
          value={`${attendanceStats?.percentage || 0}%`}
          icon={CalendarCheck}
          color={attendanceStats?.percentage >= 75 ? 'emerald' : 'rose'}
          subtitle={`${attendanceStats?.present_days || 0} / ${attendanceStats?.total_days || 0} Days`}
        />

        <StatCard
          title="Pending Leave"
          value={pendingLeavesCount}
          icon={PlaneTakeoff}
          color="blue"
          subtitle={pendingLeavesCount > 0 ? 'Under Warden Review' : 'No Active Leaves'}
        />

        <StatCard
          title="Room & Bed"
          value={`${profile?.room_number || 'Room 05'}`}
          icon={Bed}
          color="indigo"
          subtitle={`Bed ${profile?.bed_number || 'B1'} Assigned`}
        />

        <StatCard
          title="Room Sanitation"
          value={cleaningStatus}
          icon={Sparkles}
          color={isCleaningCompleted ? 'emerald' : 'amber'}
          subtitle={hasCleaningDuty ? 'Cleaning Duty Today' : `Next: ${roomDetails?.next_cleaning || 'Scheduled'}`}
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          to="/student/room"
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-purple-500 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-2"
        >
          <Bed className="w-5 h-5 text-purple-600" />
          <div>
            <span className="text-xs font-bold text-slate-800 block">My Room</span>
            <span className="text-[10px] text-slate-400">{profile?.room_number || 'Room'} &bull; Bed {profile?.bed_number || 'B1'}</span>
          </div>
        </Link>

        {/* Leave quick link with live lock state (Locked ONLY for on-duty cleaning room) */}
        <Link
          to="/student/leave"
          className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-2 shadow-2xs hover:shadow-xs ${
            isLeaveLocked
              ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400'
              : 'bg-white border-slate-200 hover:border-blue-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <PlaneTakeoff className={`w-5 h-5 ${isLeaveLocked ? 'text-amber-600' : 'text-blue-600'}`} />
            {isLeaveLocked ? (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold text-[9px] flex items-center space-x-0.5">
                <Lock className="w-2.5 h-2.5" />
                <span>Locked</span>
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                Active
              </span>
            )}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Apply Leave</span>
            <span className="text-[10px] text-slate-400">
              {isLeaveLocked ? 'Locked (Cleaning Pending)' : 'Outstation / Medical'}
            </span>
          </div>
        </Link>

        <Link
          to="/student/attendance"
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-2"
        >
          <CalendarCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <span className="text-xs font-bold text-slate-800 block">My Attendance</span>
            <span className="text-[10px] text-slate-400">{attendanceStats?.percentage || 100}% Present Rate</span>
          </div>
        </Link>

        {/* Hostel Daily Duty Quick Link */}
        <a
          href="#today-hostel-duty"
          className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-2 shadow-2xs hover:shadow-xs ${
            hasCleaningDuty
              ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 hover:border-amber-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Sparkles className={`w-5 h-5 ${hasCleaningDuty ? 'text-amber-600' : 'text-slate-400'}`} />
            {hasCleaningDuty ? (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold text-[9px]">
                Duty Active
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium text-[9px]">
                {dutyData?.duty_room || 'Active'}
              </span>
            )}
          </div>
          <div>
            <span className="text-xs font-black text-slate-800 block flex items-center space-x-1">
              <span>🧹</span>
              <span>Hostel Daily Duty</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {hasCleaningDuty ? 'Your Room on Duty Today' : `Duty Room: ${dutyData?.duty_room || 'Active'}`}
            </span>
          </div>
        </a>
      </div>

      {/* 5. TODAY'S FOOD (Student Read-Only Menu View) */}
      {studentFood && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-md border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Today's Food &bull; {studentFood.day} ({formatDate(studentFood.date)})
                </h3>
                <p className="text-xs text-slate-400">
                  Hostel food routine. The meal count is only taken by the Cleaning Room, not all rooms.
                </p>
              </div>
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* 🌅 Morning Breakfast */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between text-amber-300 text-[11px] font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-amber-400" /> 🌅 Morning Breakfast
                  </span>
                  <span className="text-[10px] text-amber-300/80">7:00 – 8:00 AM</span>
                </div>
                <span className="text-base font-black text-white mt-1 block">
                  {studentFood.morning_dish}
                </span>
                <span className="text-[10px] text-slate-400">Allocated by Warden</span>
              </div>
            </div>

            {/* 🌙 Night Dinner */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Moon className="w-4 h-4 text-indigo-400" /> 🌙 Night Dinner
                  </span>
                  <span className="text-[10px] text-indigo-300/80">8:00 – 9:00 PM</span>
                </div>
                <span className="text-base font-black text-white mt-1 block">
                  {studentFood.night_dish}
                </span>
                <span className="text-[10px] text-slate-400">Allocated by Warden</span>
              </div>
            </div>
          </div>

          {/* Sunday Lunch if Sunday */}
          {studentFood.day === 'Sunday' && studentFood.lunch_dish && (
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-200 flex items-center justify-between">
              <span>🍲 Sunday Special Lunch: <strong>{studentFood.lunch_dish}</strong></span>
              <span className="text-[10px] text-amber-300/80">1:00 – 2:00 PM</span>
            </div>
          )}

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px] text-slate-300 flex items-center space-x-2">
            <span className="text-amber-400">ℹ️</span>
            <span>
              The meal count is taken directly by today's on-duty Cleaning Room team during morning (5:30–7:00 AM) and night dinner (5:00–6:30 PM) rounds.
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: My Roommates & Active Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Room & Roommates Card */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bed className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                My Room: {profile?.room_number}
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              Bed {profile?.bed_number}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs text-slate-600">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Sanitation Status:</span>
              <span className={`font-black px-2 py-0.5 rounded text-[10px] ${
                isCleaningCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {cleaningStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Room Capacity:</span>
              <span className="font-bold text-slate-800">{roomDetails?.total_beds || 6} Beds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Sanitised:</span>
              <span className="font-bold text-slate-800">{roomDetails?.last_cleaned || 'Recently'}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Roommates ({roomDetails?.students?.length || 0})
            </p>
            <div className="space-y-1.5">
              {roomDetails?.students?.map((s) => (
                <div
                  key={s.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    s.is_me ? 'bg-blue-50/70 border-blue-200 font-bold' : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <span className="text-slate-900">{s.name} {s.is_me && '(You)'}</span>
                    <span className="block text-[10px] text-slate-400 font-normal">{s.department}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 font-bold">
                    {s.bed_number}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Announcements & Notices */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Megaphone className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-extrabold text-slate-900">Hostel Announcements & Circulars</h3>
            </div>
            <Link to="/student/announcements" className="text-xs font-bold text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    a.priority === 'URGENT'
                      ? 'bg-red-100 text-red-800'
                      : a.priority === 'IMPORTANT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {a.priority}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatDate(a.created_at)}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">{a.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 15. Student Food History (Date, Morning/Night Dish, Required, Verified) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">
                My Food History & Verification Record
              </h3>
              <p className="text-xs text-slate-400">
                Log of your meal requirements and Cleaning Room verification
              </p>
            </div>
          </div>
        </div>

        {foodHistory.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 font-medium">
            No previous food allocations recorded.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Day</th>
                  <th className="py-2.5 px-4">Morning Dish</th>
                  <th className="py-2.5 px-4">Night Dish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {foodHistory.slice(0, 7).map((h, i) => (
                  <tr key={h.date || i} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{formatDate(h.date)}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium">{h.day}</td>
                    <td className="py-2.5 px-4 font-bold text-amber-900">{h.morning_dish}</td>
                    <td className="py-2.5 px-4 font-bold text-indigo-900">{h.night_dish}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
