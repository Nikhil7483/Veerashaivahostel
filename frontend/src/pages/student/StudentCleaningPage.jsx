import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ResidentMealRoster from '../../components/cleaning/ResidentMealRoster';
import {
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  Check,
  X,
  Clock,
  UtensilsCrossed,
  AlertTriangle,
  RotateCcw,
  Calendar,
  AlertCircle,
  Building2,
  ShieldCheck,
  Coffee,
  Package,
  Moon,
  MessageSquare,
  Send
} from 'lucide-react';

const StudentCleaningPage = () => {
  const { user } = useAuth();
  const [dutyData, setDutyData] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingDuty, setSubmittingDuty] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  // Duty Form Inputs
  const [cleaningCompleted, setCleaningCompleted] = useState(false);
  const [tiffinCount, setTiffinCount] = useState(0);
  const [tiffinBoxCount, setTiffinBoxCount] = useState(0);
  const [nightDinnerCount, setNightDinnerCount] = useState(0);
  const [rosterStudents, setRosterStudents] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Quick Issue Report to Warden
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('DIRTY_FLOOR');
  const [issueDesc, setIssueDesc] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const showBanner = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => {
      setNotice({ type: '', text: '' });
    }, 6000);
  };

  const loadDutyRoster = async () => {
    try {
      setLoadingRoster(true);
      const res = await api.get('/cleaning/duty/roster');
      if (res?.data?.students) {
        setRosterStudents(res.data.students);
        setNightDinnerCount(res.data.night_dinner_count || res.data.present_count || 0);
      }
    } catch (err) {
      console.error('Failed to load duty roster:', err);
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
      setTiffinCount(tif);
      setTiffinBoxCount(box);
      setNightDinnerCount(din);
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
      setTiffinCount(tif);
      setTiffinBoxCount(box);
      setNightDinnerCount(din);
      return next;
    });
  };

  const presentStudentsCount = useMemo(() => {
    return rosterStudents.filter((s) => s.is_present || s.attendance_status === 'PRESENT').length;
  }, [rosterStudents]);

  const handleSetTiffinCount = (count) => {
    const num = Math.max(0, parseInt(count, 10) || 0);
    setTiffinCount(num);
    if (num >= presentStudentsCount && presentStudentsCount > 0) {
      handleBatchUpdateRoster('tiffin_required', true);
    } else if (num === 0) {
      handleBatchUpdateRoster('tiffin_required', false);
    }
  };

  const handleSetTiffinBoxCount = (count) => {
    const num = Math.max(0, parseInt(count, 10) || 0);
    setTiffinBoxCount(num);
    if (num >= presentStudentsCount && presentStudentsCount > 0) {
      handleBatchUpdateRoster('box_required', true);
    } else if (num === 0) {
      handleBatchUpdateRoster('box_required', false);
    }
  };

  const handleSetNightDinnerCount = (count) => {
    const num = Math.max(0, parseInt(count, 10) || 0);
    setNightDinnerCount(num);
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

  const loadDutyAndRoom = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [dutyRes, roomRes] = await Promise.all([
        api.get('/cleaning/duty/today').catch(() => ({ data: null })),
        api.get('/rooms/my/room').catch(() => ({ data: null }))
      ]);

      if (roomRes?.data) {
        setRoomDetails(roomRes.data);
      }

      if (dutyRes?.data) {
        const d = dutyRes.data;
        setDutyData(d);
        if (!isSilent) {
          setCleaningCompleted(Boolean(d.cleaning_completed));
          setTiffinCount(Number(d.tiffin_count) || 0);
          setTiffinBoxCount(Number(d.tiffin_box_count) || 0);
          setNightDinnerCount(Number(d.night_dinner_count) || 0);

          if (d.is_my_room_duty) {
            if (d.student_records && d.student_records.length > 0) {
              setRosterStudents(d.student_records);
            } else {
              loadDutyRoster();
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load student duty data:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDutyAndRoom();
    const interval = setInterval(() => {
      loadDutyAndRoom(true);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!cleaningCompleted) {
      showBanner('error', 'Cleaning job must be marked completed before submitting daily duty.');
      return;
    }
    const tiffin = parseInt(tiffinCount, 10);
    const box = parseInt(tiffinBoxCount, 10);
    const dinner = parseInt(nightDinnerCount, 10);

    if (isNaN(tiffin) || tiffin < 0 || isNaN(box) || box < 0 || isNaN(dinner) || dinner < 0) {
      showBanner('error', 'All three meal counts (Tiffin, Tiffin Box, Night Dinner) must be valid non-negative numbers.');
      return;
    }

    setSubmittingDuty(true);
    try {
      const res = await api.post('/cleaning/duty/submit', {
        cleaning_completed: true,
        tiffin_count: tiffin,
        tiffin_box_count: box,
        night_dinner_count: dinner,
        student_records: rosterStudents
      });
      showBanner('success', res.data.message || '🎉 Daily duty submitted for warden approval!');
      await loadDutyAndRoom(true);
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to submit daily duty.');
    } finally {
      setSubmittingDuty(false);
    }
  };

  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueDesc.trim()) return;
    setSubmittingIssue(true);
    try {
      const res = await api.post('/cleaning/my-room/report-issue', {
        issue_type: issueType,
        description: issueDesc.trim(),
        priority: 'NORMAL'
      });
      showBanner('success', `✅ ${res.data.message || 'Issue reported to warden.'}`);
      setIssueDesc('');
      setShowIssueModal(false);
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to report issue.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
        <p className="text-xs font-bold text-slate-500">Loading today's hostel duty...</p>
      </div>
    );
  }

  const dutyRoom = dutyData?.duty_room || 'Room 01';
  const dutyStatus = dutyData?.status || 'PENDING';
  const isMyRoomDuty = dutyData?.is_my_room_duty === true;
  const studentRoom = roomDetails?.room_number || user?.student_profile?.room_number || 'Room';
  const isLeaveUnlocked = isMyRoomDuty ? dutyStatus === 'COMPLETED' : true;
  const isPendingApproval = dutyStatus === 'PENDING_APPROVAL';
  const isReturned = dutyStatus === 'RETURNED_FOR_CORRECTION';
  const isAbsent = dutyStatus === 'ABSENT';
  const isCompleted = dutyStatus === 'COMPLETED';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Hostel Daily Duty &bull; Student Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Today's Hostel Duty & Sanitation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            <strong>Rule:</strong> One Day = One Duty Room = One Complete Cleaning Job + Tiffin + Tiffin Box + Night Dinner.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIssueModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-300 transition cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-rose-600" />
            <span>Report Maintenance Issue</span>
          </button>
          <button
            onClick={() => loadDutyAndRoom(false)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice.text && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xs transition ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice({ type: '', text: '' })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HERO BANNER: TODAY'S DUTY ROOM */}
      <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                <span>
                  {dutyData?.day || 'Today'}, {dutyData?.date || ''}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
                Today's Duty Room — {dutyRoom}
              </h2>
              <p className="text-xs text-indigo-200/80 mt-1">
                Unified daily duty allocation shared by Housekeeping and Meal Duty.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider border shadow-xs flex items-center space-x-1.5 ${
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                    : isPendingApproval
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
                    : isReturned
                    ? 'bg-orange-500/20 text-orange-300 border-orange-400'
                    : isAbsent
                    ? 'bg-rose-500/20 text-rose-300 border-rose-400'
                    : 'bg-blue-500/20 text-blue-300 border-blue-400'
                }`}
              >
                {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                {isPendingApproval && <Clock className="w-4 h-4" />}
                {isReturned && <AlertTriangle className="w-4 h-4" />}
                {isAbsent && <X className="w-4 h-4" />}
                {!isCompleted && !isPendingApproval && !isReturned && !isAbsent && <Clock className="w-4 h-4" />}
                <span>Status: {dutyStatus.replace(/_/g, ' ')}</span>
              </span>
            </div>
          </div>

          {/* RESPONSIBILITY BANNER */}
          {isMyRoomDuty ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-400 text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <span className="font-extrabold text-sm text-white block">
                    Your Room ({studentRoom}) is the Assigned Duty Room Today!
                  </span>
                  <span className="text-xs text-amber-200/90 leading-relaxed">
                    Residents of your room are responsible for completing the complete hostel cleaning job and recording all 3 meal counts.
                  </span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-amber-400 text-slate-950 shrink-0">
                Responsible Room
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <span className="text-xl">ℹ️</span>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-white block">
                    {dutyRoom} is responsible for today's hostel duty
                  </span>
                  <span className="text-xs text-slate-400">
                    Your room ({studentRoom}) has standard resident privileges. Today's cleaning and meal counts are handled by {dutyRoom}.
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-white/10 text-slate-300 shrink-0">
                Not Your Duty
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4 STATUS METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Overall Status */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Overall Duty Status
          </span>
          <span
            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-800'
                : isPendingApproval
                ? 'bg-amber-100 text-amber-800'
                : isReturned
                ? 'bg-orange-100 text-orange-800'
                : isAbsent
                ? 'bg-rose-100 text-rose-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {dutyStatus.replace(/_/g, ' ')}
          </span>
        </div>

        {/* 2. Cleaning Status */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Hostel Cleaning Job
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
              dutyData?.cleaning_completed
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {dutyData?.cleaning_completed && <Check className="w-3.5 h-3.5" />}
            {dutyData?.cleaning_completed ? 'Completed' : 'Pending'}
          </span>
        </div>

        {/* 3. Daily Meal Duty */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Daily Meal Duty
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-800'
                : isPendingApproval
                ? 'bg-amber-100 text-amber-800'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>{isCompleted ? 'Verified' : `Duty: ${dutyRoom}`}</span>
          </span>
        </div>

        {/* 4. Leave Availability */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Leave Availability
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
              isMyRoomDuty
                ? isCompleted
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {isMyRoomDuty ? (
              isCompleted ? (
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

      {/* RESPONSIBLE ROOM ACTION CARD */}
      {isMyRoomDuty && (
        <div className="p-6 sm:p-7 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-5">
          {/* STATE 1: PENDING_APPROVAL */}
          {isPendingApproval && (
            <div className="p-5 bg-amber-50 rounded-2xl border-2 border-amber-300 text-amber-950 space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shrink-0 mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-sm block">
                    ⏳ Duty Headcount & Cleaning Submitted — Awaiting Warden Approval
                  </span>
                  <span className="text-xs text-amber-900 leading-relaxed block mt-0.5">
                    Submitted by <strong>{dutyData.submitted_by || 'Duty Students'}</strong> at{' '}
                    {dutyData.submitted_at ? new Date(dutyData.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}.
                    Under Warden review. You can review and update counts below anytime if headcount changes.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                <div className="p-3 bg-white rounded-xl border border-amber-200">
                  <span className="text-[10px] text-slate-400 block font-bold">1. Cleaning Job</span>
                  <span className="font-black text-emerald-700 flex items-center gap-1 mt-0.5">
                    <Check className="w-3.5 h-3.5" /> Completed
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200">
                  <span className="text-[10px] text-slate-400 block font-bold">2. Resident Meal Roster</span>
                  <span className="font-black text-indigo-700 flex items-center gap-1 mt-0.5">
                    <Check className="w-3.5 h-3.5" /> Recorded & Submitted
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200">
                  <span className="text-[10px] text-slate-400 block font-bold">3. Warden Verification</span>
                  <span className="font-black text-amber-700 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> In Review
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200">
                  <span className="text-[10px] text-slate-400 block font-bold">4. Room Leave Status</span>
                  <span className="font-black text-amber-700 flex items-center gap-1 mt-0.5">
                    <Lock className="w-3.5 h-3.5" /> Pending Approval
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: ABSENT */}
          {isAbsent && (
            <div className="p-5 bg-rose-50 rounded-2xl border-2 border-rose-300 text-rose-950 space-y-1">
              <div className="flex items-center space-x-2">
                <X className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-black text-sm">
                  ⚠️ Room Declared Absent for Daily Duty
                </span>
              </div>
              <p className="text-xs text-rose-900 leading-relaxed">
                Warden marked your room absent for today's duty. Reason: <strong>{dutyData.absence_reason || 'Absent'}</strong>.
                Duty has advanced to the next eligible room. Leave facility remains locked for today.
              </p>
            </div>
          )}

          {/* STATE 3: COMPLETED */}
          {isCompleted && (
            <div className="p-5 bg-emerald-50 rounded-2xl border-2 border-emerald-300 text-emerald-950 space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-black text-sm">
                  🎉 Daily Duty Approved & Completed!
                </span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Complete hostel cleaning job and all 3 meal counts have been verified and approved by Warden ({dutyData?.approved_by || 'Warden'}).
                Leave applications are now unlocked for all residents of {studentRoom}!
              </p>
              <div className="pt-2">
                <Link
                  to="/student/leave"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Go to Leave Applications &rarr;</span>
                </Link>
              </div>
            </div>
          )}

          {/* STATE 4: EDITABLE FORM (PENDING, IN_PROGRESS, RETURNED_FOR_CORRECTION, PENDING_APPROVAL, COMPLETED) */}
          {['PENDING', 'IN_PROGRESS', 'RETURNED_FOR_CORRECTION', 'PENDING_APPROVAL'].includes(dutyStatus) && (
            <form onSubmit={handleStudentSubmit} className="space-y-5">
              {/* Correction Alert Banner */}
              {isReturned && (
                <div className="p-4 bg-orange-50 rounded-2xl border-2 border-orange-300 text-orange-950 space-y-1">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
                    <span className="font-black text-sm">
                      ⚠️ Warden Returned Duty for Correction
                    </span>
                  </div>
                  <p className="text-xs text-orange-900 leading-relaxed">
                    Reason: <strong>{dutyData.rejection_reason || 'Please verify and correct your counts'}</strong>.
                    Please update the counts or cleaning status below and re-submit for approval.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    ✍️ {isReturned
                      ? 'Correct & Re-Submit Daily Duty'
                      : isCompleted
                      ? "Today's Verified Daily Duty & Meal Counts"
                      : dutyStatus === 'PENDING_APPROVAL'
                      ? "Review & Update Today's Daily Duty"
                      : "Record Today's Cleaning & Meal Counts"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select Tiffin & Box for each present student across all 12 hostel rooms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadDutyRoster}
                  disabled={loadingRoster}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-600 cursor-pointer"
                >
                  {loadingRoster ? 'Refreshing Roster...' : '🔄 Reload Roster'}
                </button>
              </div>

              {/* Requirement 1: Cleaning Job */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-xl ${cleaningCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      1. Complete Hostel Cleaning Job
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Entire hostel sanitation job completed by {studentRoom} residents
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCleaningCompleted(!cleaningCompleted)}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-1.5 transition cursor-pointer shrink-0 ${
                    cleaningCompleted
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {cleaningCompleted ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Completed</span>
                    </>
                  ) : (
                    <span>Mark Done</span>
                  )}
                </button>
              </div>

              {/* Requirement 2: Resident Meal Roster (Tiffin & Box per present student) */}
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
                      Selected: {tiffinCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Morning breakfast plates served.</p>

                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'present') handleSetTiffinCount(presentStudentsCount);
                      else if (val === 'total') handleSetTiffinCount(64);
                      else if (val === 'zero') handleSetTiffinCount(0);
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
                      value={tiffinCount}
                      onChange={(e) => handleSetTiffinCount(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleSetTiffinCount(presentStudentsCount)}
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
                      Selected: {tiffinBoxCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Packed lunch boxes for classes.</p>

                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'present') handleSetTiffinBoxCount(presentStudentsCount);
                      else if (val === 'total') handleSetTiffinBoxCount(64);
                      else if (val === 'zero') handleSetTiffinBoxCount(0);
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
                      value={tiffinBoxCount}
                      onChange={(e) => handleSetTiffinBoxCount(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleSetTiffinBoxCount(presentStudentsCount)}
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
                      Selected: {nightDinnerCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Evening mess kitchen dinner plates.</p>

                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'present') handleSetNightDinnerCount(presentStudentsCount);
                      else if (val === 'total') handleSetNightDinnerCount(64);
                      else if (val === 'zero') handleSetNightDinnerCount(0);
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
                      value={nightDinnerCount}
                      onChange={(e) => handleSetNightDinnerCount(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleSetNightDinnerCount(presentStudentsCount)}
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
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-2 cursor-pointer"
                >
                  {submittingDuty ? (
                    'Submitting...'
                  ) : (
                    <>
                      <span>
                        {isReturned
                          ? 'Re-Submit Daily Duty for Approval'
                          : isCompleted
                          ? 'Update & Re-Submit Daily Duty for Approval'
                          : dutyStatus === 'PENDING_APPROVAL'
                          ? 'Update & Re-Submit Daily Duty for Approval'
                          : 'Submit Daily Duty for Warden Approval'}
                      </span>
                      <span className="text-indigo-200">&rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* NON-DUTY ROOM INFORMATION */}
      {!isMyRoomDuty && (
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">
              Daily Duty Assignment Policy
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Only residents of <strong>{dutyRoom}</strong> are authorized on duty to record mess meal counts and complete the hostel cleaning job today.
            Your room ({studentRoom}) has standard resident privileges. You can apply for leaves normally once hostel rules are satisfied.
          </p>
          <div className="pt-1">
            <Link
              to="/student/leave"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </Link>
          </div>
        </div>
      )}

      {/* MODAL: REPORT MAINTENANCE ISSUE */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <MessageSquare className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">Report Cleanliness / Maintenance</h3>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportIssue} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Issue Category</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-xs"
                >
                  <option value="DIRTY_FLOOR">Floor / Dusting Cleanliness</option>
                  <option value="WASHROOM_ISSUE">Washroom & Plumbing Hygiene</option>
                  <option value="WASTE_DISPOSAL">Trash & Dustbin Overflow</option>
                  <option value="OTHER">Other Cleanliness Problem</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  placeholder="Describe the problem for the hostel warden..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue || !issueDesc.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingIssue ? 'Sending...' : 'Submit to Warden'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentCleaningPage;
