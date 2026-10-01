import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Sparkles,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  Ban,
  RotateCcw,
  UserX,
  Play,
  Pause,
  Lock,
  Zap,
  CheckCircle,
  Calendar,
  Layers,
  ShieldCheck,
  AlertCircle,
  Clock,
  Search,
  Check,
  Filter,
  Building2,
  Users,
  Bed,
  CheckCheck,
  Plus,
  Star,
  AlertTriangle,
  X
} from 'lucide-react';

const CleaningPage = () => {
  const navigate = useNavigate();
  const [dailyBoard, setDailyBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [viewTab, setViewTab] = useState('daily'); // 'daily' | 'weekly' | 'tasks'
  
  // Custom Beautiful Modals State
  const [showResetShiftModal, setShowResetShiftModal] = useState(false);
  const [showSanitizeAllModal, setShowSanitizeAllModal] = useState(false);
  const [showAllocateDutyModal, setShowAllocateDutyModal] = useState(false);
  const [selectedDutyRoom, setSelectedDutyRoom] = useState('Room 01');
  const [selectedDutyDay, setSelectedDutyDay] = useState('');
  const [selectedFocusRoom, setSelectedFocusRoom] = useState('Room 01');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState('ALL'); // 'ALL' | 1 | 2 | 3 | 4
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'IN_PROGRESS' | 'PENDING' | 'COMPLETED' | 'SKIPPED_ABSENT'

  // Task Management State
  const VALID_ROOMS = ['Room 01', 'Room 02', 'Room 04', 'Room 05', 'Room 06', 'Room 07', 'Room 08', 'Room 09', 'Room 10', 'Room 11', 'Room 12', 'Room 13'];
  const [tasksList, setTasksList] = useState([]);
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
  const [taskRoomFilter, setTaskRoomFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createForm, setCreateForm] = useState({
    room_number: 'Room 01',
    assigned_staff: 'Housekeeping Staff',
    cleaning_type: 'Daily Sanitation',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    status: 'Pending',
    notes: ''
  });

  // Real-time auto-simulation state
  const [autoSimulating, setAutoSimulating] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const simulationTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const loadCleaningData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [boardRes, tasksRes] = await Promise.all([
        api.get('/cleaning/daily-board'),
        api.get('/cleaning/tasks')
      ]);
      setDailyBoard(boardRes.data);
      setTasksList(tasksRes.data);
    } catch (err) {
      console.error('Error fetching cleaning roster:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreatingTask(true);
    try {
      const res = await api.post('/cleaning/tasks', createForm);
      setNotice(`✅ Cleaning task created for ${res.data.room_number} (${res.data.cleaning_type})`);
      setShowCreateModal(false);
      setCreateForm({
        room_number: 'Room 01',
        assigned_staff: 'Housekeeping Staff',
        cleaning_type: 'Daily Sanitation',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        status: 'Pending',
        notes: ''
      });
      await loadCleaningData(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create cleaning task.');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await api.put(`/cleaning/tasks/${taskId}/status`, { status: newStatus });
      setNotice(`✅ ${res.data.room_number} cleaning status updated to ${newStatus}`);
      await loadCleaningData(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update cleaning status.');
    }
  };

  // Initial load + Real-time background sync every 3 seconds
  useEffect(() => {
    loadCleaningData();
    const pollInterval = setInterval(() => {
      loadCleaningData(true);
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  // Today Day Name & Designated Duty Rooms
  const todayDayName = dailyBoard[0]?.today_day_name || new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  const todayMealDutyRoom = dailyBoard[0]?.meal_duty_room || dailyBoard[0]?.today_duty_rooms?.[0] || 'Room 01';
  const todayDutyRooms = [todayMealDutyRoom];
  const firstDutyRoom = 'Room 01';

  // Metrics across all physical rooms
  const allRooms = dailyBoard;
  const completedRooms = allRooms.filter((r) => (r.task?.status || r.cleaning_status) === 'COMPLETED');
  const inProgressRoom = allRooms.find((r) => (r.task?.status || r.cleaning_status) === 'IN_PROGRESS');
  const firstPendingRoom = allRooms.find((r) => (r.task?.status || r.cleaning_status) === 'PENDING');
  const skippedRooms = allRooms.filter((r) => (r.task?.status || r.cleaning_status) === 'SKIPPED_ABSENT');

  const currentActiveRoom = inProgressRoom || firstPendingRoom || null;
  const totalRoomsCount = Math.max(1, allRooms.length);
  const isFloorFinished = allRooms.length > 0 && completedRooms.length >= allRooms.length;
  const progressPercent = Math.min(100, Math.round((completedRooms.length / totalRoomsCount) * 100));

  // 1. One-click Complete & Auto-Advance to next room in the sequence
  const handleCompleteAndAdvance = async (roomNumber) => {
    setActionLoading(true);
    setNotice('');
    try {
      const res = await api.post(`/cleaning/complete-and-advance/${roomNumber}`);
      setNotice(`✅ ${res.data.message}`);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to complete and advance.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Member Absent -> Skip to next room
  const handleSkipToNextRoom = async (roomNumber) => {
    setActionLoading(true);
    setNotice('');
    try {
      const res = await api.post(`/cleaning/skip-next-room/${roomNumber}`);
      setNotice(`⚠️ ${res.data.message}`);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to advance to next room.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Move back to previous room
  const handleMoveToPreviousRoom = async (roomNumber) => {
    setActionLoading(true);
    setNotice('');
    try {
      const res = await api.post(`/cleaning/move-previous-room/${roomNumber}`);
      setNotice(`⏪ ${res.data.message}`);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to move to previous room.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Direct Clean single room
  const handleDirectClean = async (roomNumber) => {
    setActionLoading(true);
    setNotice('');
    try {
      const res = await api.post(`/cleaning/clean-room/${roomNumber}`);
      setNotice(`✅ ${res.data.message}`);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to clean room.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Auto-clear notice after 6 seconds
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => {
        setNotice('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  // 5. Mass Complete All Rooms
  const handleCompleteAll = () => {
    setShowSanitizeAllModal(true);
  };

  const executeCompleteAll = async () => {
    setActionLoading(true);
    setAutoSimulating(false);
    setShowSanitizeAllModal(false);
    try {
      const res = await api.post('/cleaning/complete-all');
      setNotice(`🎉 ${res.data.message || 'All rooms marked as completed successfully.'}`);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to complete all rooms.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Reset today's shift starting from 1st room (Room 01)
  const handleResetShift = () => {
    setShowResetShiftModal(true);
  };

  const executeResetShift = async () => {
    setActionLoading(true);
    setAutoSimulating(false);
    setShowResetShiftModal(false);
    try {
      const res = await api.post('/cleaning/reset-shift');
      setNotice(`🔄 ${res.data.message || 'Cleaning shift restarted from Room 01 successfully.'}`);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to reset cleaning shift.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Admin assigns ANY room as today's (or specific day's) Cleaning Duty Room
  const handleAssignDutyRoom = async (roomNumber, dayName = selectedDutyDay || todayDayName) => {
    setActionLoading(true);
    try {
      const res = await api.post('/cleaning/assign-duty-room', {
        room_number: roomNumber,
        day_name: dayName
      });
      setNotice(`✅ ${res.data.message || `${roomNumber} allocated as duty room for ${dayName}!`}`);
      setShowAllocateDutyModal(false);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to allocate duty room.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Admin chooses ANY room to clean right now (sets it to IN_PROGRESS)
  const handleSetActiveRoom = async (roomNumber) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/cleaning/set-active-room/${roomNumber}`);
      setNotice(`🧹 ${res.data.message || `${roomNumber} is now active for cleaning.`}`);
      await loadCleaningData(true);
    } catch (err) {
      setNotice(`⚠️ ${err.response?.data?.detail || 'Failed to set active room.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Auto-Simulation Engine for all 13 rooms
  useEffect(() => {
    if (!autoSimulating) {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setCountdown(4);
      return;
    }

    if (isFloorFinished) {
      setAutoSimulating(false);
      setNotice(`🎉 Shift Complete! All ${allRooms.length} rooms have been sanitized.`);
      return;
    }

    setCountdown(4);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 4));
    }, 1000);

    simulationTimerRef.current = setInterval(async () => {
      if (currentActiveRoom && (currentActiveRoom.task?.status || currentActiveRoom.cleaning_status) !== 'COMPLETED') {
        try {
          await api.post(`/cleaning/complete-and-advance/${currentActiveRoom.room_number}`);
          await loadCleaningData(true);
        } catch (e) {
          console.error('Simulation step error:', e);
        }
      }
    }, 4000);

    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [autoSimulating, currentActiveRoom, isFloorFinished, allRooms.length]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return allRooms.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoom = r.room_number.toLowerCase().includes(q);
        const matchesResident = r.present_residents?.some((name) => name.toLowerCase().includes(q)) ||
                                r.absent_residents?.some((name) => name.toLowerCase().includes(q));
        if (!matchesRoom && !matchesResident) return false;
      }

      // Floor filter
      if (floorFilter !== 'ALL') {
        if (r.floor !== Number(floorFilter)) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        const curSt = r.task?.status || r.cleaning_status || 'PENDING';
        if (curSt !== statusFilter) return false;
      }

      return true;
    });
  }, [allRooms, searchQuery, floorFilter, statusFilter]);

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-100 text-purple-800 border border-purple-200">
              <Zap className="w-3 h-3 text-purple-600" />
              <span>Real-Time Housekeeping Hub</span>
            </span>
            <span className="text-xs text-slate-500 font-bold">&bull; Today: {todayDayName}</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase">
              All {totalRoomsCount} Rooms Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Hostel Housekeeping & Daily Sanitation Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Complete {totalRoomsCount}-room daily sanitation rotation &bull; Real-time sequential tracking &bull; Student leave lock integration</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Admin Room Cleaner Picker */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-purple-200 shadow-2xs">
            <span className="text-[11px] font-black text-purple-700 px-2 flex items-center gap-1">
              <span>🧹</span>
              <span>Clean Room:</span>
            </span>
            <select
              value={selectedFocusRoom}
              onChange={(e) => setSelectedFocusRoom(e.target.value)}
              className="text-xs font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer"
            >
              {VALID_ROOMS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              onClick={() => handleSetActiveRoom(selectedFocusRoom)}
              disabled={actionLoading}
              className="py-1.5 px-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Set selected room as the active room being cleaned right now"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Clean Now</span>
            </button>
          </div>

          <button
            onClick={() => navigate('/admin/dashboard')}
            className="py-2.5 px-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {
              setSelectedDutyRoom(todayDutyRooms[0] || 'Room 01');
              setSelectedDutyDay(todayDayName);
              setShowAllocateDutyModal(true);
            }}
            className="py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Choose which room is assigned for cleaning & meal counts duty"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Allocate Duty Room</span>
          </button>

          <button
            onClick={() => navigate('/admin/students?tab=cleaning-room')}
            className="py-2.5 px-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Open Cleaning Room for Resident Meal Counts (Tiffin & Box)"
          >
            <span>🍽️</span>
            <span>Cleaning Room (Meal Counts)</span>
          </button>

          <button
            onClick={handleCompleteAll}
            disabled={actionLoading || isFloorFinished}
            className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Sanitize and mark all rooms as completed"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Sanitize All {totalRoomsCount} Rooms</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Create and assign new cleaning task"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>

          <button
            onClick={handleResetShift}
            disabled={actionLoading}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-slate-300 cursor-pointer disabled:opacity-50"
            title={`Restart shift from ${firstDutyRoom}`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Reset Shift ({firstDutyRoom})</span>
          </button>

          <button
            onClick={() => setAutoSimulating(!autoSimulating)}
            className={`py-2.5 px-3.5 rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-sm cursor-pointer ${
              autoSimulating
                ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {autoSimulating ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause Auto-Run ({countdown}s)</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Auto-Run Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Beautiful Notice Banner */}
      {notice && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
          notice.startsWith('⚠️') || notice.startsWith('❌')
            ? 'bg-rose-50/95 text-rose-950 border-rose-300 ring-1 ring-rose-400/20'
            : 'bg-emerald-50/95 text-emerald-950 border-emerald-300 ring-1 ring-emerald-400/20'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl shrink-0 ${
              notice.startsWith('⚠️') || notice.startsWith('❌') ? 'bg-rose-100 text-rose-700 shadow-2xs' : 'bg-emerald-100 text-emerald-700 shadow-2xs'
            }`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-extrabold leading-snug">{notice}</p>
            </div>
          </div>
          <button
            onClick={() => setNotice('')}
            className="p-1.5 rounded-xl hover:bg-black/5 text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================== */}
      {/* SECTION A: 🍽️ MEAL DUTY */}
      {/* ================================================== */}
      <div className="p-6 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 rounded-3xl border-2 border-amber-300 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-400 text-slate-950 shadow-2xs">
                <span>🍽️</span>
                <span>SECTION A &bull; MEAL DUTY</span>
              </span>
              <span className="text-xs text-slate-600 font-bold">&bull; Today: {todayDayName}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase border border-emerald-300">
                Status: AUTHORIZED FOR MEAL COUNTS
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today's Meal Duty:</span>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-950 tracking-tight mt-0.5">
                Today's Meal Duty Room — {todayMealDutyRoom}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-3xl">
              Only <strong>ONE</strong> hostel room is selected as the Daily Meal Duty Room. Authorized on duty to record, verify, and submit hostel meal counts (Tiffin Count, Tiffin Box Count, Night Lunch Count) to the mess kitchen. Completely independent from daily room cleaning.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setSelectedDutyRoom(todayMealDutyRoom);
                setSelectedDutyDay(todayDayName);
                setShowAllocateDutyModal(true);
              }}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-xl text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer"
              title="Allocate or Change Today's Meal Duty Room"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Allocate / Change Duty Room</span>
            </button>

            <button
              onClick={() => navigate('/admin/students?tab=cleaning-room')}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer"
              title="Open Meal Counts for Tiffin, Tiffin Box & Night Lunch"
            >
              <span>🍽️</span>
              <span>Open Meal Counts &rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* SECTION B: 🧹 DAILY SANITATION */}
      {/* ================================================== */}
      <div className="p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white shadow-xl border border-indigo-500/30 relative overflow-hidden space-y-5">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Sparkles className="w-48 h-48 text-white" />
        </div>

        <div className="relative z-10 space-y-5">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-black tracking-wider uppercase text-emerald-400">
                  SECTION B &bull; 🧹 DAILY SANITATION &bull; {todayDayName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 text-[10px] font-black uppercase border border-purple-400/30">
                  12 Valid Rooms Rotation
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                {isFloorFinished ? (
                  <span className="text-emerald-400">🎉 12 / 12 Rooms Cleaned &bull; 100% Sanitized</span>
                ) : (
                  <span>Currently Cleaning: <span className="text-yellow-400 underline decoration-yellow-400/50">{currentActiveRoom ? currentActiveRoom.room_number : 'Room 01'}</span> &bull; Daily Sanitation Progress — {completedRooms.length} / {totalRoomsCount} Rooms</span>
                )}
              </h2>
            </div>

            {/* Metrics Counters */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex items-center space-x-4 shrink-0">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-300">Sanitation Progress</div>
                <div className="text-xl font-black text-white">{completedRooms.length} / {totalRoomsCount} Rooms</div>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-300">Remaining</div>
                <div className="text-xl font-black text-amber-300">{Math.max(0, totalRoomsCount - completedRooms.length)} Rooms</div>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-300">Completion</div>
                <div className="text-xl font-black text-emerald-400">{progressPercent}%</div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-slate-300">
              <span>Daily Sanitation Progress — {completedRooms.length} / {totalRoomsCount} Rooms</span>
              <span>{completedRooms.length} Cleaned &bull; {Math.max(0, totalRoomsCount - completedRooms.length)} Remaining</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* ACTIVE ROOM OPERATIONAL CARD */}
          {currentActiveRoom && !isFloorFinished && (
            <div className="p-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-yellow-400 text-slate-950 text-xs font-black uppercase tracking-wide">
                      {currentActiveRoom.room_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/40 text-purple-200 text-xs font-bold">
                      Floor {currentActiveRoom.floor}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/40 text-blue-200 text-xs font-bold">
                      Status: {currentActiveRoom.display_status || (currentActiveRoom.cleaning_status === 'IN_PROGRESS' ? 'CLEANING NOW' : 'PENDING')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span><strong>{currentActiveRoom.residents_count || currentActiveRoom.allocated_residents || 4} Residents Allocated</strong></span>
                    <span>&bull;</span>
                    <span><strong>{currentActiveRoom.total_beds || currentActiveRoom.bed_capacity || 6} Beds Capacity</strong></span>
                    <span>&bull;</span>
                    <span>
                      Resident Status: <span className="font-bold text-amber-300">{currentActiveRoom.resident_status || (currentActiveRoom.members_absent ? `Member(s) Absent (${currentActiveRoom.absent_count})` : `All Present (${currentActiveRoom.residents_count})`)}</span>
                    </span>
                    <span>&bull;</span>
                    <span>Staff: <strong className="text-white">{currentActiveRoom.assigned_staff || 'Housekeeping Staff'}</strong></span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3">
                    <span>Start Time: {currentActiveRoom.start_time || 'Just started'}</span>
                    <span>Completion Time: {currentActiveRoom.completion_time || 'In Progress'}</span>
                    <span>Verification: <strong className="text-emerald-400">{currentActiveRoom.verification_status || 'PENDING'}</strong></span>
                  </div>
                </div>

                {/* Actions: Mark Cleaned & Advance, Skip - Absent, Previous */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleCompleteAndAdvance(currentActiveRoom.room_number)}
                    disabled={actionLoading}
                    className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black rounded-xl text-xs transition shadow-lg flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                    title="Mark current room as cleaned, verify it, and automatically advance to next room"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Cleaned & Advance &rarr;</span>
                  </button>

                  <button
                    onClick={() => handleSkipToNextRoom(currentActiveRoom.room_number)}
                    disabled={actionLoading}
                    className="py-2.5 px-3 bg-amber-500/30 hover:bg-amber-500/50 active:scale-95 text-amber-200 border border-amber-400/40 font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    title="Skip this room due to resident absence"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Skip — Absent &rarr;</span>
                  </button>

                  {currentActiveRoom.room_number !== 'Room 01' && (
                    <button
                      onClick={() => handleMoveToPreviousRoom(currentActiveRoom.room_number)}
                      disabled={actionLoading}
                      className="py-2.5 px-3 bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 border border-white/20 font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      title="Move back to previous room"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isFloorFinished && (
            <div className="p-5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-extrabold text-emerald-300">
                🎉 12 / 12 Rooms Cleaned &bull; 100% Sanitized
              </h3>
              <p className="text-xs text-slate-300 max-w-xl mx-auto">
                All 12 hostel rooms across the entire hostel have been sanitized, inspected, and verified for {todayDayName}.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleResetShift}
                  className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs inline-flex items-center space-x-2 cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Shift (Room 01)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================== */}
      {/* SECTION C: 🏠 ALL HOSTEL ROOMS */}
      {/* ================================================== */}
      <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                SECTION C &bull; 🏠 ALL HOSTEL ROOMS
              </span>
              <span className="text-xs text-slate-500 font-bold">&bull; 12 Valid Rooms (Room 03 strictly does not exist)</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
              Daily Sequential Sanitation Rotation (All 12 Rooms)
            </h3>
          </div>
          <div className="text-xs font-bold text-slate-600">
            Sequence: Room 01 &rarr; 02 &rarr; 04 &rarr; 05 &rarr; 06 &rarr; 07 &rarr; 08 &rarr; 09 &rarr; 10 &rarr; 11 &rarr; 12 &rarr; 13
          </div>
        </div>

        {/* 12-Room Live Status Display Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
          {VALID_ROOMS.map((roomNo) => {
            const r = allRooms.find((item) => item.room_number === roomNo);
            const rStatus = r ? (r.task?.status || r.cleaning_status || 'PENDING') : 'PENDING';
            const isActive = currentActiveRoom?.room_number === roomNo && !isFloorFinished;
            const isCompleted = rStatus === 'COMPLETED';
            const isSkipped = rStatus === 'SKIPPED_ABSENT';
            const isMealDuty = (roomNo === todayMealDutyRoom);

            let statusIcon = '⏳';
            let statusText = 'PENDING';
            let cardClass = 'bg-slate-50 text-slate-700 border-slate-200';

            if (isCompleted) {
              statusIcon = '✓';
              statusText = 'CLEANED';
              cardClass = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-black';
            } else if (isActive) {
              statusIcon = '🔄';
              statusText = 'CLEANING NOW';
              cardClass = 'bg-yellow-100 text-slate-950 border-yellow-400 font-black shadow-xs ring-2 ring-yellow-400/40 animate-pulse';
            } else if (isSkipped) {
              statusIcon = '⚠️';
              statusText = 'ABSENT / SKIPPED';
              cardClass = 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
            }

            return (
              <div
                key={roomNo}
                onClick={() => {
                  if (!isCompleted) handleSetActiveRoom(roomNo);
                }}
                className={`p-2.5 rounded-2xl border text-xs flex flex-col justify-between transition cursor-pointer hover:shadow-2xs ${cardClass}`}
                title={`${roomNo} (${statusText})${isMealDuty ? ' • Today\'s Meal Duty Room' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm">{roomNo}</span>
                  {isMealDuty && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-black" title="Today's Meal Duty Room">
                      🍽️ Duty
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1.5 mt-1.5">
                  <span className="text-xs">{statusIcon}</span>
                  <span className="text-[11px] font-black uppercase tracking-tight">{statusText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* VIEW SELECTOR TABS & SEARCH / FILTER TOOLBAR */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewTab('daily')}
              className={`py-2 px-4 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer ${
                viewTab === 'daily'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Daily Sanitation Board (All {totalRoomsCount} Rooms)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                {totalRoomsCount}
              </span>
            </button>

            <button
              onClick={() => setViewTab('weekly')}
              className={`py-2 px-4 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer ${
                viewTab === 'weekly'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Weekly Schedule Rotation</span>
            </button>

            <button
              onClick={() => setViewTab('tasks')}
              className={`py-2 px-4 rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer ${
                viewTab === 'tasks'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Task Management & History</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold">
                {tasksList.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-bold">
            Displaying {filteredRooms.length} of {totalRoomsCount} Rooms
          </div>
        </div>

        {/* Search & Floor Filters Toolbar */}
        {viewTab === 'daily' && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Room # (e.g. 05) or resident name..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>

            {/* Floor Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center">
                <Filter className="w-3 h-3 mr-1" /> Floor:
              </span>
              {[
                { label: 'All Floors', value: 'ALL' },
                { label: 'Floor 1 (01-02)', value: '1' },
                { label: 'Floor 2 (04-07)', value: '2' },
                { label: 'Floor 3 (08-11)', value: '3' },
                { label: 'Floor 4 (12-13)', value: '4' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFloorFilter(f.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    floorFilter === f.value
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Status:</span>
              {[
                { label: 'All', value: 'ALL' },
                { label: 'Cleaning', value: 'IN_PROGRESS' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Cleaned', value: 'COMPLETED' },
                { label: 'Absent', value: 'SKIPPED_ABSENT' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    statusFilter === s.value
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: ALL 13 ROOMS DAILY SANITATION BOARD */}
      {viewTab === 'daily' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
              Synchronizing all 13 rooms housekeeping data...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
              No rooms match the selected filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
              {filteredRooms.map((room) => {
                const currentStatus = room.task?.status || room.cleaning_status || 'PENDING';
                const isCompleted = currentStatus === 'COMPLETED';
                const isActive = currentActiveRoom?.room_number === room.room_number && !isFloorFinished;
                const isAbsent = room.members_absent;
                const isVacant = room.is_vacant;

                return (
                  <div
                    key={room.room_number}
                    className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 ${
                      isActive
                        ? 'bg-gradient-to-b from-yellow-50/80 to-white border-yellow-400 ring-2 ring-yellow-400/30 shadow-md'
                        : isCompleted
                        ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                        : currentStatus === 'SKIPPED_ABSENT'
                        ? 'bg-amber-50/30 border-amber-200'
                        : 'bg-white border-slate-200 shadow-xs hover:border-purple-300'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-slate-900 text-base">{room.room_number}</span>
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black uppercase">
                              Floor {room.floor}
                            </span>
                            {todayDutyRooms.includes(room.room_number) && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 text-[10px] font-black uppercase tracking-wider border border-amber-300 flex items-center space-x-1">
                                <span>🧹</span>
                                <span>Duty Room</span>
                              </span>
                            )}
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded bg-yellow-400 text-slate-950 font-black text-[9px] uppercase tracking-wide animate-pulse">
                                Active Now
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-semibold">
                            {isVacant ? (
                              <span className="text-sky-600 font-bold">0 Residents &bull; Vacant Room</span>
                            ) : (
                              <span>{room.residents_count} Residents Allocated &bull; {room.total_beds} Beds Capacity</span>
                            )}
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : isActive
                              ? 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse'
                              : currentStatus === 'SKIPPED_ABSENT'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isCompleted
                            ? 'CLEANED & VERIFIED'
                            : isActive
                            ? 'CLEANING NOW'
                            : currentStatus === 'SKIPPED_ABSENT'
                            ? 'MEMBER ABSENT'
                            : 'PENDING'}
                        </span>
                      </div>

                      {/* Member Presence & Attendance */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold">Resident Status:</span>
                          {isVacant ? (
                            <span className="font-bold text-sky-700 text-xs">
                              Vacant / General Room
                            </span>
                          ) : isAbsent ? (
                            <span className="font-bold text-amber-700 flex items-center space-x-1 text-xs">
                              <UserX className="w-3.5 h-3.5" />
                              <span>Member(s) Absent</span>
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-700 flex items-center space-x-1 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>All Present ({room.present_residents?.length || room.residents_count})</span>
                            </span>
                          )}
                        </div>

                        {isAbsent && !isVacant && (
                          <p className="text-[11px] text-amber-800 font-medium">
                            Absent: {room.absent_residents.join(', ')}
                          </p>
                        )}

                        {todayDutyRooms.includes(room.room_number) && (
                          <div className="p-2.5 bg-amber-100/70 rounded-xl border border-amber-300 text-amber-950 flex items-center justify-between mt-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs">🍽️</span>
                              <span className="text-[11px] font-bold">Authorized for Mess Meal Counts</span>
                            </div>
                            <button
                              onClick={() => navigate('/admin/students?tab=cleaning-room')}
                              className="text-[10px] font-black text-amber-900 underline hover:text-amber-950 cursor-pointer"
                            >
                              Open Counts &rarr;
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200">
                          <span>Staff: {room.task?.assigned_staff || 'Housekeeping Staff'}</span>
                          {room.last_cleaned && (
                            <span className="font-semibold text-emerald-700">{room.last_cleaned}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions / Locked State */}
                    <div className="pt-2 border-t border-slate-100">
                      {isCompleted ? (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <span className="font-black text-xs block text-emerald-950">
                                LOCKED: SANITATION COMPLETED
                              </span>
                              <span className="text-[10px] text-emerald-700 font-medium">
                                Cleaned today &bull; Student leave unlocked
                              </span>
                            </div>
                          </div>
                          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                        </div>
                      ) : isActive ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleCompleteAndAdvance(room.room_number)}
                            disabled={actionLoading}
                            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Mark Cleaned & Advance</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleSkipToNextRoom(room.room_number)}
                              disabled={actionLoading}
                              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              <UserX className="w-3.5 h-3.5 text-amber-600" />
                              <span>Skip (Absent)</span>
                            </button>

                            {room.room_number !== 'Room 01' && (
                              <button
                                onClick={() => handleMoveToPreviousRoom(room.room_number)}
                                disabled={actionLoading}
                                className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                              >
                                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                                <span>Previous</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-xs font-bold text-slate-500">
                            {currentStatus === 'SKIPPED_ABSENT' ? (
                              <span className="text-amber-700 font-bold">Skipped (Absent)</span>
                            ) : (
                              <span>⏳ In Queue</span>
                            )}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSetActiveRoom(room.room_number)}
                              disabled={actionLoading}
                              className="py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                              title="Start cleaning this room now"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-500" />
                              <span>Start Cleaning</span>
                            </button>

                            <button
                              onClick={() => handleDirectClean(room.room_number)}
                              disabled={actionLoading}
                              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-50"
                              title="Mark as cleaned and certified"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Clean Now</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEEKLY SCHEDULE ROTATION */}
      {viewTab === 'weekly' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-base font-black text-slate-900">Institutional Weekly Sanitation & Cleaning Duty Matrix</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Weekly schedule defining primary cleaning inspection and daily mess meal count authority
                </p>
              </div>
            </div>
            <div className="px-3.5 py-1.5 bg-amber-100 border border-amber-300 rounded-xl text-xs font-black text-amber-950 flex items-center space-x-2 shadow-2xs">
              <span>📅</span>
              <span>Today ({todayDayName}): {todayDutyRooms[0] || 'Room 01'} (1 Room Per Day)</span>
            </div>
          </div>

          {/* Institutional Days Grid (One Day, One Room Rule) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {[
              { day: 'Monday', rooms: ['Room 01'], desc: 'Floor 1 Sanitation & Meal Counts' },
              { day: 'Tuesday', rooms: ['Room 02'], desc: 'Floor 1 Sanitation & Meal Counts' },
              { day: 'Wednesday', rooms: ['Room 04'], desc: 'Floor 2 Sanitation & Meal Counts' },
              { day: 'Thursday', rooms: ['Room 05'], desc: 'Floor 2 Sanitation & Meal Counts' },
              { day: 'Friday', rooms: ['Room 06'], desc: 'Floor 2 Sanitation & Meal Counts' },
              { day: 'Saturday', rooms: ['Room 07'], desc: 'Floor 2 Sanitation & Meal Counts' },
              { day: 'Sunday', rooms: ['Room 08'], desc: 'Floor 3 Sanitation & Sunday Feast' },
            ].map((item) => {
              const isToday = item.day.toLowerCase() === todayDayName.toLowerCase();
              return (
                <div
                  key={item.day}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isToday
                      ? 'bg-gradient-to-b from-amber-50 to-white border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-md scale-102'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-900">{item.day}</span>
                    {isToday ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black uppercase tracking-wider animate-pulse">
                        Today
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 font-bold">Duty</span>
                    )}
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-sm font-black text-slate-900">
                      {item.rooms[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-slate-100 text-[9px] font-bold text-slate-500 flex items-center justify-between">
                    <span>1 Room Duty</span>
                    {isToday && <span className="text-amber-800 font-black">Active</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Individual Room Details &bull; All {totalRoomsCount} Physical Hostel Rooms
            </h4>
            <span className="text-xs text-slate-400 font-medium">
              Daily deep sanitation covers all {totalRoomsCount} rooms
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allRooms.map((room) => {
              const currentStatus = room.task?.status || room.cleaning_status || 'PENDING';
              const isCompleted = currentStatus === 'COMPLETED';
              const isTodayDuty = todayDutyRooms.includes(room.room_number);

              return (
                <div
                  key={room.room_number}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                    isTodayDuty
                      ? 'bg-gradient-to-b from-amber-50/70 to-white border-2 border-amber-300 ring-2 ring-amber-300/30 shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-black text-slate-900 text-sm">{room.room_number}</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-black uppercase">
                            Floor {room.floor}
                          </span>
                          {isTodayDuty && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[9px] font-black uppercase tracking-wide">
                              Today's Duty
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {room.is_vacant ? 'Vacant Room' : `${room.residents_count} Residents Allocated`}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : isTodayDuty
                            ? 'bg-amber-100 text-amber-900 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {isCompleted ? 'CLEANED' : isTodayDuty ? 'DUTY TODAY' : 'PENDING'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Assigned Day:</span>
                        <span className="font-bold text-slate-800">{room.assigned_day}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Leave Lock:</span>
                        <span className={`font-bold ${isCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {isCompleted ? 'Unlocked' : 'Pending Cleaning'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/50">
                        <span>Today Status:</span>
                        <span className="font-semibold text-slate-600">{currentStatus}</span>
                      </div>
                      {isTodayDuty && (
                        <div className="pt-1 text-[10px] font-black text-amber-900 border-t border-amber-200/60 flex items-center space-x-1">
                          <span>🍽️</span>
                          <span>Authorized for Meal Headcounts</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-center">
                    {isCompleted ? (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Sanitized & Verified</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setViewTab('daily');
                          handleDirectClean(room.room_number);
                        }}
                        className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                      >
                        Clean Room Now &rarr;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: TASK MANAGEMENT & HISTORY */}
      {viewTab === 'tasks' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {['ALL', 'Pending', 'In Progress', 'Completed', 'Overdue'].map((st) => (
                <button
                  key={st}
                  onClick={() => setTaskStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    taskStatusFilter === st
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={taskRoomFilter}
                onChange={(e) => setTaskRoomFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All 12 Rooms</option>
                {VALID_ROOMS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            {tasksList.filter((t) => {
              const matchStatus = taskStatusFilter === 'ALL' || t.status?.toLowerCase() === taskStatusFilter.toLowerCase();
              const matchRoom = taskRoomFilter === 'ALL' || t.room_number === taskRoomFilter;
              return matchStatus && matchRoom;
            }).length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Sparkles className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No cleaning tasks found for selected filters.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 cursor-pointer"
                >
                  + Create First Task
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="py-3 px-4">Room</th>
                      <th className="py-3 px-4">Cleaning Type</th>
                      <th className="py-3 px-4">Assigned Staff</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Student Rating</th>
                      <th className="py-3 px-4">Notes</th>
                      <th className="py-3 px-4 text-right">Update Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tasksList
                      .filter((t) => {
                        const matchStatus = taskStatusFilter === 'ALL' || t.status?.toLowerCase() === taskStatusFilter.toLowerCase();
                        const matchRoom = taskRoomFilter === 'ALL' || t.room_number === taskRoomFilter;
                        return matchStatus && matchRoom;
                      })
                      .map((task) => {
                        const st = task.status || 'Pending';
                        return (
                          <tr key={task.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-black text-slate-900">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                                {task.room_number}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700">
                              {task.cleaning_type || 'Daily Sanitation'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {task.assigned_staff || 'Housekeeping'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              <div className="font-bold text-slate-800">{task.date}</div>
                              <div className="text-[10px] text-slate-400">{task.time || '10:00 AM'}</div>
                            </td>
                            <td className="py-3 px-4">
                              {st === 'Completed' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle className="w-3 h-3" /> Completed
                                </span>
                              ) : st === 'In Progress' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <Sparkles className="w-3 h-3" /> In Progress
                                </span>
                              ) : st === 'Overdue' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" /> Overdue
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {task.student_rating ? (
                                <div>
                                  <div className="flex items-center gap-1 text-amber-600 font-bold">
                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                    <span>{task.student_rating}/5</span>
                                  </div>
                                  {task.student_feedback && (
                                    <p className="text-[10px] text-slate-500 truncate max-w-xs" title={task.student_feedback}>
                                      "{task.student_feedback}"
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Not rated</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate" title={task.notes}>
                              {task.notes || '-'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <select
                                value={st}
                                onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer hover:border-purple-400 focus:outline-hidden"
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Overdue">Overdue</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-extrabold text-slate-900">Create Cleaning Task</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Room (12 Physical Rooms)</label>
                <select
                  value={createForm.room_number}
                  onChange={(e) => setCreateForm({ ...createForm, room_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                >
                  {VALID_ROOMS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Assign Staff</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar (Lead) or Housekeeping"
                  value={createForm.assigned_staff}
                  onChange={(e) => setCreateForm({ ...createForm, assigned_staff: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Cleaning Type</label>
                <select
                  value={createForm.cleaning_type}
                  onChange={(e) => setCreateForm({ ...createForm, cleaning_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                >
                  <option value="Daily Sanitation">Daily Sanitation</option>
                  <option value="Deep Cleaning">Deep Cleaning</option>
                  <option value="Restroom Cleaning">Restroom Cleaning</option>
                  <option value="Floor Mopping">Floor Mopping</option>
                  <option value="Disinfection">Disinfection & Sanitization</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM"
                    value={createForm.time}
                    onChange={(e) => setCreateForm({ ...createForm, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Initial Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Task Notes (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Special instructions or areas to focus..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingTask ? 'Creating...' : 'Create & Assign'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ BEAUTIFUL RESTART SHIFT MODAL ══ */}
      {showResetShiftModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform animate-in zoom-in-95 duration-200">
            {/* Top decorative gradient bar */}
            <div className="h-2 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600" />
            
            {/* Close Button */}
            <button
              onClick={() => setShowResetShiftModal(false)}
              disabled={actionLoading}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-7 space-y-5">
              {/* Header with Icon */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <RotateCcw className="w-7 h-7" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200 mb-1.5">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Hostel Housekeeping Rotation</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 leading-snug">
                    Restart Today's Cleaning Shift?
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Reset duty progress back to 1st room for all rooms
                  </p>
                </div>
              </div>

              {/* Scope & Details Card */}
              <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/50 rounded-2xl p-4 border border-amber-200/70 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white/90 backdrop-blur-xs rounded-xl p-2.5 border border-amber-100 shadow-2xs">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Scheduled Day</p>
                    <p className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>{todayDayName}</span>
                    </p>
                  </div>
                  <div className="bg-white/90 backdrop-blur-xs rounded-xl p-2.5 border border-amber-100 shadow-2xs">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Starting Point</p>
                    <p className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-orange-600" />
                      <span>Room 01 (1st Room)</span>
                    </p>
                  </div>
                </div>

                <div className="bg-white/95 backdrop-blur-xs rounded-xl p-3 border border-amber-100 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xs">
                      {allRooms.length}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">Total Sequence Scope</p>
                      <p className="text-[11px] font-semibold text-slate-500">All {allRooms.length} physical rooms in rotation</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active Rotation
                  </span>
                </div>

                <div className="p-3 bg-amber-100/60 rounded-xl border border-amber-200/60 text-xs text-amber-950 font-medium leading-relaxed">
                  Restart today's cleaning shift (<strong>{todayDayName}</strong>) from 1st room (<strong>Room 01</strong>) for all <strong>{allRooms.length} rooms</strong>? This will set Room 01 to In-Progress and reset remaining rooms to Pending.
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetShiftModal(false)}
                  disabled={actionLoading}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeResetShift}
                  disabled={actionLoading}
                  className="py-2.5 px-5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 active:scale-95 shadow-md shadow-orange-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>{actionLoading ? 'Restarting Shift...' : 'Yes, Restart Shift'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ BEAUTIFUL SANITIZE ALL MODAL ══ */}
      {showSanitizeAllModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform animate-in zoom-in-95 duration-200">
            {/* Top decorative gradient bar */}
            <div className="h-2 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600" />
            
            {/* Close Button */}
            <button
              onClick={() => setShowSanitizeAllModal(false)}
              disabled={actionLoading}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-7 space-y-5">
              {/* Header with Icon */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                  <CheckCheck className="w-7 h-7" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200 mb-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Hostel Mass Sanitation</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 leading-snug">
                    Sanitize All {allRooms.length} Rooms at Once?
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Mark full hostel rotation as completed
                  </p>
                </div>
              </div>

              {/* Scope & Details Card */}
              <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl p-4 border border-emerald-200/70 space-y-3">
                <div className="bg-white/95 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center font-black text-xs">
                      {allRooms.length}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">All Rooms Completed</p>
                      <p className="text-[11px] font-semibold text-slate-500">Unlocks leave permissions for all hostel residents</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Full Roster
                  </span>
                </div>

                <div className="p-3 bg-emerald-100/60 rounded-xl border border-emerald-200/60 text-xs text-emerald-950 font-medium leading-relaxed">
                  This will mark all <strong>{allRooms.length} rooms</strong> as <strong className="text-emerald-800">COMPLETED</strong> for today ({todayDayName}), fulfilling all daily sanitation duties and enabling residents to apply for leaves without hostel cleaning blocks.
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSanitizeAllModal(false)}
                  disabled={actionLoading}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeCompleteAll}
                  disabled={actionLoading}
                  className="py-2.5 px-5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 shadow-md shadow-emerald-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>{actionLoading ? 'Sanitizing...' : `Sanitize All ${allRooms.length} Rooms`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ BEAUTIFUL ALLOCATE DUTY ROOM MODAL ══ */}
      {showAllocateDutyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform animate-in zoom-in-95 duration-200">
            {/* Top decorative gradient bar */}
            <div className="h-2 w-full bg-gradient-to-r from-purple-500 via-indigo-600 to-amber-500" />
            
            {/* Close Button */}
            <button
              onClick={() => setShowAllocateDutyModal(false)}
              disabled={actionLoading}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-7 space-y-5">
              {/* Header with Icon */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
                  <Sparkles className="w-7 h-7 text-amber-300" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 mb-1.5">
                    <span>🧹</span>
                    <span>Hostel Duty Room Allocation</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 leading-snug">
                    Allocate Cleaning Duty Room
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Choose which room is authorized on duty for cleaning inspection & mess kitchen meal counts (1 room per day)
                  </p>
                </div>
              </div>

              {/* Day Selector Pills */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Select Day of the Week
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const isToday = day === todayDayName;
                    const isSelected = (selectedDutyDay || todayDayName) === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDutyDay(day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{day}</span>
                        {isToday && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase ${
                            isSelected ? 'bg-amber-400 text-slate-950' : 'bg-purple-200 text-purple-900'
                          }`}>
                            Today
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Room Selection Grid (All 12 Valid Rooms) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Select Duty Room (12 Physical Rooms)
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Current Duty Room: <strong className="text-purple-700">{todayDutyRooms[0] || 'None'}</strong>
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1 border border-slate-100 rounded-2xl">
                  {allRooms.map((r) => {
                    const isSelected = selectedDutyRoom === r.room_number;
                    const isCurrentTodayDuty = todayDutyRooms.includes(r.room_number);

                    return (
                      <div
                        key={r.room_number}
                        onClick={() => setSelectedDutyRoom(r.room_number)}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-500/30 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-black text-slate-900">{r.room_number}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-600">
                            F{r.floor}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.residents_count} Residents &bull; {r.total_beds} Beds
                        </div>
                        {isCurrentTodayDuty && (
                          <span className="mt-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 inline-block text-center">
                            ⭐ Today's Duty
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Information Note */}
              <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 text-xs text-purple-950 font-medium leading-relaxed">
                Allocating <strong>{selectedDutyRoom}</strong> for <strong>{selectedDutyDay || todayDayName}</strong> designates its residents as the official duty committee. They will be authorized to verify morning & evening meal counts for the kitchen and oversee housekeeping coordination.
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocateDutyModal(false)}
                  disabled={actionLoading}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAssignDutyRoom(selectedDutyRoom, selectedDutyDay || todayDayName)}
                  disabled={actionLoading}
                  className="py-2.5 px-5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 active:scale-95 shadow-md shadow-purple-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{actionLoading ? 'Allocating...' : `Confirm & Allocate ${selectedDutyRoom}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningPage;
