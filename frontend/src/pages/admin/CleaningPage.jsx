import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import ResidentMealRoster from '../../components/cleaning/ResidentMealRoster';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RotateCcw,
  UserX,
  Lock,
  Unlock,
  Check,
  X,
  Clock,
  UtensilsCrossed,
  ShieldCheck,
  AlertTriangle,
  History,
  Building2,
  ThumbsUp,
  ThumbsDown,
  FileEdit,
  ChevronDown,
  ChevronUp,
  Users,
  Coffee,
  Package,
  Bell
} from 'lucide-react';

const VALID_ROOMS = [
  'Room 01', 'Room 02', 'Room 04', 'Room 05', 'Room 06', 'Room 07',
  'Room 08', 'Room 09', 'Room 10', 'Room 11', 'Room 12', 'Room 13'
];

const CleaningPage = () => {
  const [duty, setDuty] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ type: '', text: '' });

  // Form State for Today's Duty (Warden view/adjust)
  const [cleaningCompleted, setCleaningCompleted] = useState(false);
  const [tiffinCount, setTiffinCount] = useState(0);
  const [tiffinBoxCount, setTiffinBoxCount] = useState(0);
  const [nightDinnerCount, setNightDinnerCount] = useState(0);
  const [savingDuty, setSavingDuty] = useState(false);

  // Student Breakdown Roster State
  const [showStudentBreakdown, setShowStudentBreakdown] = useState(false);
  const [rosterStudents, setRosterStudents] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Approval / Rejection State
  const [approveLoading, setApproveLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Directly Assign Modal State
  const [showDirectAssignModal, setShowDirectAssignModal] = useState(false);
  const [selectedAssignRoom, setSelectedAssignRoom] = useState('Room 01');
  const [assignReason, setAssignReason] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Mark Absent Modal State
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const [absentLoading, setAbsentLoading] = useState(false);

  // Previous Room Confirmation Modal State
  const [showPreviousModal, setShowPreviousModal] = useState(false);
  const [previousLoading, setPreviousLoading] = useState(false);
  const [reversalRequired, setReversalRequired] = useState(false);

  const showBanner = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => {
      setNotice({ type: '', text: '' });
    }, 6000);
  };

  const loadWardenRoster = async () => {
    try {
      setLoadingRoster(true);
      const res = await api.get('/cleaning/duty/roster');
      if (res?.data?.students) {
        setRosterStudents(res.data.students);
        setTiffinCount((prev) => (prev > 0 ? prev : (res.data.tiffin_count || res.data.present_count || 0)));
        setTiffinBoxCount((prev) => (prev > 0 ? prev : (res.data.tiffin_box_count || 0)));
        setNightDinnerCount((prev) => (prev > 0 ? prev : (res.data.night_dinner_count || res.data.present_count || 0)));
      }
    } catch (err) {
      console.error('Failed to load roster:', err);
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
    if (rosterStudents && rosterStudents.length > 0) {
      return rosterStudents.filter((s) => s.is_present || s.attendance_status === 'PRESENT').length;
    }
    return duty?.present_residents_count || 52;
  }, [rosterStudents, duty]);

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

  const loadDutyData = async () => {
    try {
      const [dutyRes, histRes] = await Promise.all([
        api.get('/cleaning/duty/today'),
        api.get('/cleaning/duty/history')
      ]);

      const data = dutyRes.data;
      setDuty(data);
      setCleaningCompleted(Boolean(data.cleaning_completed));
      setTiffinCount(Number(data.tiffin_count) || 0);
      setTiffinBoxCount(Number(data.tiffin_box_count) || 0);
      setNightDinnerCount(Number(data.night_dinner_count) || 0);
      setSelectedAssignRoom(data.duty_room || 'Room 01');

      if (data.student_records && data.student_records.length > 0) {
        setRosterStudents(data.student_records);
      } else {
        loadWardenRoster();
      }

      setHistoryList(histRes.data || []);
    } catch (err) {
      console.error('Error fetching duty data:', err);
      showBanner('error', err.response?.data?.detail || 'Failed to load duty data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDutyData();
  }, []);

  // Approve Duty Action (Warden Approval Workflow - verifies and locks student submission)
  const handleApproveDuty = async () => {
    setApproveLoading(true);
    try {
      const res = await api.post('/cleaning/duty/approve', {
        notes: ''
      });
      showBanner('success', res.data.message || 'Duty approved! Student-submitted counts verified and leave facility unlocked.');
      await loadDutyData();
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to approve duty.');
    } finally {
      setApproveLoading(false);
    }
  };

  // Reject / Return for Correction Action
  const handleRejectDuty = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      showBanner('error', 'Please enter a valid rejection reason (minimum 3 characters).');
      return;
    }
    setRejectLoading(true);
    try {
      const res = await api.post('/cleaning/duty/reject', {
        reason: rejectReason.trim()
      });
      showBanner('success', res.data.message || 'Duty returned for correction.');
      setShowRejectModal(false);
      setRejectReason('');
      await loadDutyData();
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to return duty for correction.');
    } finally {
      setRejectLoading(false);
    }
  };

// Warden duty submission removed in accordance with daily duty rules

  // Directly Assign Room Action
  const handleDirectAssign = async () => {
    if (!selectedAssignRoom || selectedAssignRoom === 'Room 03') {
      showBanner('error', 'Please choose a valid room (Room 03 strictly does not exist).');
      return;
    }
    setAssignLoading(true);
    try {
      const res = await api.post('/cleaning/duty/directly-assign', {
        room_number: selectedAssignRoom,
        reason: assignReason.trim()
      });
      showBanner('success', res.data.message || `Assigned to ${selectedAssignRoom}.`);
      setShowDirectAssignModal(false);
      setAssignReason('');
      await loadDutyData();
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to directly assign room.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Mark Absent Action
  const handleMarkAbsent = async () => {
    if (!absentReason.trim() || absentReason.trim().length < 3) {
      showBanner('error', 'Please enter a valid reason for absence (at least 3 characters).');
      return;
    }
    setAbsentLoading(true);
    try {
      const res = await api.post('/cleaning/duty/mark-absent', {
        reason: absentReason.trim()
      });
      showBanner('success', res.data.message || 'Room marked absent. Advanced to next eligible room.');
      setShowAbsentModal(false);
      setAbsentReason('');
      await loadDutyData();
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to mark room absent.');
    } finally {
      setAbsentLoading(false);
    }
  };

  // Previous Room Action
  const handlePreviousRoom = async (confirmReversal = false) => {
    setPreviousLoading(true);
    try {
      const res = await api.post('/cleaning/duty/previous-room', {
        confirm_reversal: confirmReversal
      });

      if (res.data.requires_confirmation) {
        setReversalRequired(true);
        return;
      }

      showBanner('success', res.data.message || 'Previous room restored.');
      setShowPreviousModal(false);
      setReversalRequired(false);
      await loadDutyData();
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to restore previous room.');
      setShowPreviousModal(false);
    } finally {
      setPreviousLoading(false);
    }
  };

  // Reminder Actions (Funny Notifications)
  const [reminding, setReminding] = useState(false);
  const [mealReminding, setMealReminding] = useState(false);

  const handleSendReminder = async () => {
    setReminding(true);
    try {
      const res = await api.post('/cleaning/duty/send-reminder');
      showBanner('success', res.data.message || 'Duty reminder sent!');
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to send duty reminder.');
    } finally {
      setReminding(false);
    }
  };

  const handleSendMealReminder = async () => {
    setMealReminding(true);
    try {
      const res = await api.post('/cleaning/duty/send-meal-reminder');
      showBanner('success', res.data.message || 'Meal count reminder sent!');
    } catch (err) {
      showBanner('error', err.response?.data?.detail || 'Failed to send meal reminder.');
    } finally {
      setMealReminding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
        <p className="text-sm font-semibold text-slate-500">Loading daily duty system...</p>
      </div>
    );
  }

  const dutyRoom = duty?.duty_room || 'Room 01';
  const dutyStatus = duty?.status || 'PENDING';
  const isLeaveUnlocked = duty?.leave_unlocked || dutyStatus === 'COMPLETED';
  const isPendingApproval = dutyStatus === 'PENDING_APPROVAL';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Warden Administration &bull; Simple Daily Duty System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Hostel Daily Duty & Sanitation Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            <strong>Rule:</strong> One Day = One Duty Room = One Complete Cleaning Job + Tiffin + Tiffin Box + Night Dinner.
          </p>
        </div>
      </div>

      {/* Notice Banner */}
      {notice.text && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-xs transition ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice({ type: '', text: '' })}
            className="p-1 hover:bg-black/5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TODAY'S DUTY ROOM HERO CARD */}
      <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="flex items-center space-x-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                <span>
                  {duty?.day || 'Today'}, {duty?.date || new Date().toISOString().split('T')[0]}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
                Today's Duty Room — {dutyRoom}
              </h2>
              <p className="text-xs text-indigo-200/80 mt-1">
                Authoritative duty allocation shared by Housekeeping and Mess Kitchen.
              </p>
            </div>

            {/* Overall Status Badge */}
            <div className="flex items-center gap-3">
              <span
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider border shadow-xs flex items-center space-x-1.5 ${
                  dutyStatus === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                    : dutyStatus === 'PENDING_APPROVAL'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
                    : dutyStatus === 'IN_PROGRESS'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400'
                    : dutyStatus === 'RETURNED_FOR_CORRECTION'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-400'
                    : dutyStatus === 'ABSENT'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-400'
                    : 'bg-slate-500/20 text-slate-300 border-slate-400'
                }`}
              >
                {dutyStatus === 'COMPLETED' && <CheckCircle2 className="w-4 h-4" />}
                {dutyStatus === 'PENDING_APPROVAL' && <Clock className="w-4 h-4" />}
                {dutyStatus === 'ABSENT' && <UserX className="w-4 h-4" />}
                {dutyStatus === 'IN_PROGRESS' && <Clock className="w-4 h-4" />}
                {dutyStatus === 'RETURNED_FOR_CORRECTION' && <AlertTriangle className="w-4 h-4" />}
                {dutyStatus === 'PENDING' && <AlertCircle className="w-4 h-4" />}
                <span>Status: {dutyStatus.replace(/_/g, ' ')}</span>
              </span>
            </div>
          </div>

          {/* Leave Unlock Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
              isLeaveUnlocked
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`p-2.5 rounded-xl ${
                  isLeaveUnlocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {isLeaveUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-sm font-extrabold block text-white">
                  {isLeaveUnlocked
                    ? `Leave Facility Unlocked for ${dutyRoom} Residents`
                    : `Leave Applications Locked for ${dutyRoom} Residents`}
                </span>
                <span className="text-xs opacity-90">
                  {isLeaveUnlocked
                    ? `Duty verified and approved by Warden for ${duty?.date}. Leave requests can now be submitted.`
                    : `Under hostel rules, leave unlocks automatically only after cleaning completion, all 3 counts, and Warden approval.`}
                </span>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-xl text-xs font-black uppercase shrink-0 ${
                isLeaveUnlocked ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'
              }`}
            >
              {isLeaveUnlocked ? 'Unlocked' : 'Locked'}
            </span>
          </div>

          {/* WARDEN CONTROL BUTTONS */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* 1. Directly Assign Room */}
            <button
              onClick={() => {
                setSelectedAssignRoom(dutyRoom);
                setShowDirectAssignModal(true);
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Directly Assign Room</span>
            </button>

            {/* 2. Previous Room */}
            <button
              onClick={() => {
                setReversalRequired(false);
                setShowPreviousModal(true);
              }}
              disabled={!duty?.has_previous}
              className={`px-4 py-2.5 rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-2 ${
                duty?.has_previous
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                Previous Room {duty?.previous_room ? `(${duty.previous_room})` : ''}
              </span>
            </button>

            {/* 3. Send Duty Reminder (Bro, the dust is winning! 🦸) */}
            <button
              onClick={handleSendReminder}
              disabled={reminding}
              className="px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title="Bro, the dust is winning! 🦸"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span>{reminding ? 'Sending...' : 'Remind Duty 🦸'}</span>
            </button>

            {/* 4. Send Meal Count Reminder (Count the plates! 🍛) */}
            <button
              onClick={handleSendMealReminder}
              disabled={mealReminding}
              className="px-3.5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title="Count the plates before they disappear mysteriously! 👀"
            >
              <UtensilsCrossed className="w-4 h-4 text-cyan-400" />
              <span>{mealReminding ? 'Sending...' : 'Remind Meals 🍛'}</span>
            </button>

            {/* 5. Mark Absent */}
            <button
              onClick={() => setShowAbsentModal(true)}
              className="px-4 py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-2 cursor-pointer ml-auto"
            >
              <UserX className="w-4 h-4" />
              <span>Mark Absent</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 STATUS & MEAL COUNTS METRIC BADGES (WARDEN OFFICIAL VIEW) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Overall Status */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Overall Duty Status
          </span>
          <span
            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
              dutyStatus === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-800'
                : dutyStatus === 'PENDING_APPROVAL'
                ? 'bg-amber-100 text-amber-800'
                : dutyStatus === 'IN_PROGRESS'
                ? 'bg-blue-100 text-blue-800'
                : dutyStatus === 'RETURNED_FOR_CORRECTION'
                ? 'bg-orange-100 text-orange-800'
                : dutyStatus === 'ABSENT'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-100 text-slate-700'
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
              duty?.cleaning_completed
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {duty?.cleaning_completed && <Check className="w-3.5 h-3.5" />}
            {duty?.cleaning_completed ? 'Completed' : 'Pending'}
          </span>
        </div>

        {/* 3. Official Meal Counts (Warden Page Only) */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Official Meal Counts
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700">
              Warden Only
            </span>
          </div>
          <div className="text-xs font-black text-slate-800 pt-0.5">
            <span>Tiffin: {duty?.tiffin_count ?? 0}</span>
            <span className="text-slate-300 mx-1">&bull;</span>
            <span>Box: {duty?.tiffin_box_count ?? 0}</span>
            <span className="text-slate-300 mx-1">&bull;</span>
            <span>Night: {duty?.night_dinner_count ?? 0}</span>
          </div>
        </div>

        {/* 4. Leave Availability */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Leave Availability
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
              isLeaveUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isLeaveUnlocked ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlocked ({dutyRoom})</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Locked ({dutyRoom})</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* PENDING APPROVAL ALERT FOR WARDEN */}
      {isPendingApproval && (
        <div className="p-5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-3xl border-2 border-amber-400 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shrink-0">
              <Clock className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <span className="text-sm font-black text-amber-950 block">
                📋 Action Required: {dutyRoom} Submitted Daily Duty for Approval
              </span>
              <span className="text-xs text-amber-900 leading-relaxed block mt-0.5">
                Submitted by <strong>{duty?.submitted_by || 'Duty Students'}</strong> at{' '}
                {duty?.submitted_at ? new Date(duty.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}.
                Review the submitted cleaning status and counts below, then approve or return for correction.
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              type="button"
              onClick={handleApproveDuty}
              disabled={approveLoading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              {approveLoading ? 'Approving...' : (
                <>
                  <ThumbsUp className="w-4 h-4" />
                  <span>Approve Duty</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <ThumbsDown className="w-4 h-4" />
              <span>Return for Correction</span>
            </button>
          </div>
        </div>
      )}

      {/* RETURNED FOR CORRECTION BANNER */}
      {dutyStatus === 'RETURNED_FOR_CORRECTION' && (
        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-300 text-orange-950 text-xs font-bold flex items-center space-x-2.5">
          <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
          <span>
            Duty returned to {dutyRoom} for correction. Reason: <strong>{duty?.rejection_reason || 'Correction requested'}</strong>.
            Awaiting student re-submission.
          </span>
        </div>
      )}

      {/* WARDEN VIEW COUNTS & DUTY DETAILS CARD */}
      <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold mb-1">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Submitted Duty Verification & Approval</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Review Counts & Sanitation for {dutyRoom}
            </h2>
            <p className="text-xs text-slate-500">
              {duty?.submitted_at ? (
                <>
                  Submitted by <strong>{duty?.submitted_by || 'Duty Students'}</strong> at{' '}
                  {new Date(duty.submitted_at).toLocaleString()}
                </>
              ) : (
                'Students have not submitted counts yet. You can also directly input counts and mark completed.'
              )}
            </p>
          </div>

          {/* Quick Approve/Reject Bar when in reviewing or in-progress states */}
          <div className="flex items-center space-x-2">
            {dutyStatus !== 'COMPLETED' ? (
              <>
                <button
                  type="button"
                  onClick={handleApproveDuty}
                  disabled={approveLoading || dutyStatus !== 'PENDING_APPROVAL'}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-1.5 ${
                    dutyStatus === 'PENDING_APPROVAL'
                      ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                  title={
                    dutyStatus === 'PENDING_APPROVAL'
                      ? 'Verify and approve student submitted duty'
                      : 'Requires student submission in PENDING_APPROVAL status'
                  }
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{approveLoading ? 'Approving...' : 'Approve Duty'}</span>
                </button>
                {dutyStatus === 'PENDING_APPROVAL' && (
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Return</span>
                  </button>
                )}
              </>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Duty Approved by {duty?.approved_by || 'Warden'}</span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Requirement 1: Complete Hostel Cleaning Job */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div
                className={`p-2.5 rounded-xl mt-0.5 ${
                  duty?.cleaning_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 block">
                  1. Hostel Sanitation & Cleaning Verification
                </span>
                <span className="text-xs text-slate-500">
                  Full hostel sanitation job (floors, common areas, sanitization, dustbins, washrooms) performed by {dutyRoom}.
                </span>
              </div>
            </div>

            <div className="shrink-0">
              {duty?.cleaning_completed ? (
                <span className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center space-x-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Student Reported: Completed</span>
                </span>
              ) : (
                <span className="px-4 py-2 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-bold flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Not Completed Yet</span>
                </span>
              )}
            </div>
          </div>

          {/* Requirements 2, 3, 4: Counts (Displayed read-only with student submitted values) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Tiffin Count */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label className="text-xs font-black text-slate-800 block">
                  2. Tiffin Count
                </label>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  Student Submission
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Total resident plates served for morning breakfast.</p>
              
              <div className="pt-2">
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Submitted Count:</span>
                  <span className="text-xl font-black text-slate-900">
                    {duty?.tiffin_count !== undefined && duty?.tiffin_count !== null ? duty.tiffin_count : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tiffin Box Count */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label className="text-xs font-black text-slate-800 block">
                  3. Tiffin Box Count
                </label>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  Student Submission
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Total packed lunch boxes for students attending classes.</p>

              <div className="pt-2">
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Submitted Count:</span>
                  <span className="text-xl font-black text-slate-900">
                    {duty?.tiffin_box_count !== undefined && duty?.tiffin_box_count !== null ? duty.tiffin_box_count : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Night Dinner Count */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label className="text-xs font-black text-slate-800 block">
                  4. Night Dinner Count
                </label>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  Student Submission
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Total dinner count submitted to mess kitchen for evening.</p>

              <div className="pt-2">
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Submitted Count:</span>
                  <span className="text-xl font-black text-slate-900">
                    {duty?.night_dinner_count !== undefined && duty?.night_dinner_count !== null ? duty.night_dinner_count : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Expandable Student-by-Student Headcount Breakdown */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <button
              type="button"
              onClick={() => {
                if (!showStudentBreakdown && rosterStudents.length === 0) {
                  loadWardenRoster();
                }
                setShowStudentBreakdown(!showStudentBreakdown);
              }}
              className="w-full p-4 rounded-2xl bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-200 text-indigo-950 font-black text-xs sm:text-sm flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <Users className="w-5 h-5 text-indigo-700" />
                <span>📋 View Student Headcount Breakdown (Tiffin & Box Selections)</span>
                <span className="text-[11px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                  {rosterStudents.length} Students
                </span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-indigo-700 font-bold">
                <span>{showStudentBreakdown ? 'Hide Breakdown' : 'Expand Details'}</span>
                {showStudentBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showStudentBreakdown && (
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-semibold px-1">
                  <span>
                    Individual meal selections recorded by <strong>{dutyRoom}</strong> cleaning team (Read-Only Review).
                  </span>
                  <button
                    type="button"
                    onClick={loadWardenRoster}
                    disabled={loadingRoster}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer self-start sm:self-auto"
                  >
                    {loadingRoster ? 'Reloading...' : '🔄 Refresh Roster'}
                  </button>
                </div>

                <ResidentMealRoster
                  students={rosterStudents}
                  onToggleStudent={handleToggleStudent}
                  onBatchUpdate={handleBatchUpdateRoster}
                  readOnly={true}
                  isWarden={true}
                />
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {isPendingApproval
                ? 'Review the student-submitted counts above. Approve to verify counts and unlock room leave, or Return for correction.'
                : dutyStatus === 'COMPLETED'
                ? `Duty verified and locked by ${duty?.approved_by || 'Warden'}. Counts are finalized.`
                : `Awaiting student submission from ${dutyRoom}. Approval is enabled once duty is submitted.`}
            </span>

            <div className="flex items-center space-x-2">
              {isPendingApproval ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span>Return for Correction</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveDuty}
                    disabled={approveLoading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    {approveLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <ThumbsUp className="w-4 h-4" />
                        <span>Approve & Lock Counts</span>
                      </>
                    )}
                  </button>
                </>
              ) : dutyStatus === 'COMPLETED' ? (
                <span className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Approved & Locked</span>
                </span>
              ) : (
                <span className="px-4 py-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Awaiting Submission</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECENT DUTY HISTORY TABLE */}
      <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Recent Duty Records & Audit History
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Duty Room</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Cleaning</th>
                <th className="py-3 px-3">Counts (T / Box / Dinner)</th>
                <th className="py-3 px-3">Leave Facility</th>
                <th className="py-3 px-3">Submitted By / Action Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {historyList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-slate-400">
                    No duty records found yet.
                  </td>
                </tr>
              ) : (
                historyList.map((item) => (
                  <tr key={item.id || item.date} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {item.date} ({item.day || 'Day'})
                    </td>
                    <td className="py-3 px-3 font-extrabold text-indigo-700 whitespace-nowrap">
                      {item.room_number}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'RETURNED_FOR_CORRECTION'
                            ? 'bg-orange-100 text-orange-800'
                            : item.status === 'ABSENT'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {item.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.cleaning_completed ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Done
                        </span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-800">
                      {item.tiffin_count || 0} / {item.tiffin_box_count || 0} / {item.night_dinner_count || 0}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.leave_unlocked || item.status === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                          Unlocked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[10px]">
                          Locked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                      {item.rejection_reason ? `Returned: ${item.rejection_reason}` : item.absence_reason ? `Absent: ${item.absence_reason}` : item.submitted_by ? `Submitted by ${item.submitted_by}` : (item.history?.[item.history?.length - 1]?.details || '—')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RETURN FOR CORRECTION */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <ThumbsDown className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">Return Duty for Correction</h3>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                This will unlock the submission form for residents of <strong>{dutyRoom}</strong> so they can correct their meal counts or cleaning status and re-submit.
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reason for Correction <span className="text-rose-600 font-bold">*</span> (Mandatory)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Night dinner headcount discrepancy, please verify with mess kitchen"
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectDuty}
                disabled={rejectLoading || rejectReason.trim().length < 3}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {rejectLoading ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DIRECTLY ASSIGN ROOM */}
      {showDirectAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">Directly Assign Duty Room</h3>
              </div>
              <button
                onClick={() => setShowDirectAssignModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Room (12 Valid Rooms Only)
                </label>
                <select
                  value={selectedAssignRoom}
                  onChange={(e) => setSelectedAssignRoom(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {VALID_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Room 03 strictly does not exist.</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reason for Direct Assignment (Optional)
                </label>
                <textarea
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="e.g. Special hostel inspection or rotation override"
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-0.5">
                <span className="font-bold block">Automatic Rotation Continues:</span>
                <span>
                  After today's duty, tomorrow's rotation will naturally resume from the next room following{' '}
                  <strong>{selectedAssignRoom}</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDirectAssignModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDirectAssign}
                disabled={assignLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MARK ABSENT */}
      {showAbsentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <UserX className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">Mark Duty Room Absent</h3>
              </div>
              <button
                onClick={() => setShowAbsentModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-1">
                <div className="font-black text-sm">Declare {dutyRoom} Absent?</div>
                <p className="text-[11px] leading-relaxed">
                  Only the warden can declare an absence. The rotation will immediately advance to the next eligible room.
                  Leave applications will <strong>remain locked</strong> for {dutyRoom}.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Absence Reason <span className="text-rose-600 font-bold">*</span> (Mandatory)
                </label>
                <textarea
                  value={absentReason}
                  onChange={(e) => setAbsentReason(e.target.value)}
                  placeholder="Enter explicit reason (e.g., all residents attending sports meet / ill)"
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAbsentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkAbsent}
                disabled={absentLoading || absentReason.trim().length < 3}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {absentLoading ? 'Marking Absent...' : 'Confirm Absence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PREVIOUS ROOM RESTORATION */}
      {showPreviousModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-indigo-600">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">
                  {reversalRequired ? 'Confirm Absence Reversal' : 'Restore Previous Duty Room'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowPreviousModal(false);
                  setReversalRequired(false);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Current Assignment:</span>
                  <span className="font-extrabold text-slate-900">{dutyRoom}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Previous Assignment:</span>
                  <span className="font-black text-indigo-700">{duty?.previous_room}</span>
                </div>
              </div>

              {reversalRequired || duty?.was_previous_absent ? (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 space-y-1">
                  <span className="font-black block flex items-center gap-1.5 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Notice: Absence Declaration Reversal
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Restoring <strong>{duty?.previous_room}</strong> will reverse its previous absence declaration.
                    Please confirm that you intend to cancel this absence.
                  </p>
                </div>
              ) : (
                <p className="text-slate-600 leading-relaxed text-xs">
                  This will restore <strong>{duty?.previous_room}</strong> as today's duty room. Existing history and
                  records will be preserved.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPreviousModal(false);
                  setReversalRequired(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePreviousRoom(reversalRequired || duty?.was_previous_absent)}
                disabled={previousLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {previousLoading ? 'Restoring...' : reversalRequired ? 'Confirm Reversal' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningPage;
