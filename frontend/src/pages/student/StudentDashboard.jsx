import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import StatCard from '../../components/common/StatCard';
import { formatDate } from '../../utils/dateUtils';
import {
  CalendarCheck,
  PlaneTakeoff,
  Bed,
  Ticket,
  UtensilsCrossed,
  Megaphone,
  Lock,
  CheckCircle2,
  Coffee,
  Moon,
  Clock,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user?.student_profile || null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [cleaningStatus, setCleaningStatus] = useState('COMPLETED');
  const [announcements, setAnnouncements] = useState([]);
  const [foodHistory, setFoodHistory] = useState([]);
  const [studentFood, setStudentFood] = useState(null);
  const [submittingFood, setSubmittingFood] = useState(false);
  const [foodMsg, setFoodMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStudentDashboard = async (isSilent = false) => {
    try {
      const [profRes, attRes, roomRes, leaveRes, compRes, annRes, foodRes, histRes] = await Promise.all([
        api.get('/students/my/profile'),
        api.get('/attendance/my/records'),
        api.get('/rooms/my/room'),
        api.get('/leaves/my/applications'),
        api.get('/complaints'),
        api.get('/announcements'),
        api.get('/food-allocation/student/today').catch(() => ({ data: null })),
        api.get('/food-allocation/student/history').catch(() => ({ data: [] }))
      ]);

      setProfile(profRes.data);
      setAttendanceStats(attRes.data);
      setRoomDetails(roomRes.data);
      setLeaves(leaveRes.data);
      setComplaints(compRes.data);
      setCleaningStatus(roomRes.data.cleaning_status || 'COMPLETED');
      setAnnouncements(annRes.data.slice(0, 3));
      setStudentFood(foodRes?.data || null);
      setFoodHistory(histRes?.data || []);
    } catch (err) {
      console.error('Error loading student dashboard:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Poll room cleaning status in background every 15 seconds for real-time unlock
  const pollRoomStatus = async () => {
    try {
      const roomRes = await api.get('/rooms/my/room');
      setRoomDetails(roomRes.data);
      setCleaningStatus(roomRes.data.cleaning_status || 'COMPLETED');
    } catch (err) {
      // silent background check
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
  const hasCleaningDuty = roomDetails?.is_scheduled_today === true;
  const isCleaningCompleted = cleaningStatus === 'COMPLETED';
  const pendingLeavesCount = leaves.filter((l) => l.status === 'PENDING').length;
  const activeComplaintsCount = complaints.filter((c) => c.status !== 'RESOLVED' && c.status !== 'REJECTED').length;

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

      {/* REAL-TIME HOUSEKEEPING STATUS BANNER (Only for room with cleaning duty) */}
      {isLeaveLocked ? (
        <div className="p-4 bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 rounded-2xl border border-amber-300 text-amber-950 shadow-2xs flex items-start space-x-3.5">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-amber-950">
                ⚠️ Daily Sanitisation In Progress for {profile?.room_number} &bull; Leave Submissions Locked
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-400 animate-pulse">
                Duty: {cleaningStatus}
              </span>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              Your room ({profile?.room_number}) has cleaning duty scheduled today. Under hostel safety regulations, resident leave applications remain locked until room sanitisation is completed and verified.
              <strong className="block mt-0.5 text-amber-950">
                ⚡ Real-Time System: Your leave applications will automatically unlock on your screen as soon as housekeeping marks your room completed.
              </strong>
            </p>
          </div>
        </div>
      ) : hasCleaningDuty && isCleaningCompleted ? (
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-300 text-emerald-950 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-extrabold text-xs text-emerald-950 block">
                {profile?.room_number} Daily Sanitisation Complete &bull; All Privileges Active
              </span>
              <span className="text-[11px] text-emerald-800">
                Room thoroughly cleaned ({roomDetails?.last_cleaned || 'Today'}). Leave applications and room privileges are unlocked.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-extrabold uppercase shrink-0">
            Verified
          </span>
        </div>
      ) : hasCleaningDuty ? (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-300 text-amber-950 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xs sm:text-sm text-amber-950">
                  🧹 {profile?.room_number} Assigned on Cleaning Duty Today ({roomDetails?.day_name || 'Today'})
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-400">
                  Duty Scheduled
                </span>
              </div>
              <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                Authorized on duty to record, verify, and submit hostel meal counts to the mess kitchen.
              </p>
            </div>
          </div>
          <Link
            to="/student/cleaning-room"
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shrink-0 transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <span>🍽️</span>
            <span>Record Meal Counts &rarr;</span>
          </Link>
        </div>
      ) : null}

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
          title="Active Complaints"
          value={activeComplaintsCount}
          icon={Ticket}
          color={activeComplaintsCount > 0 ? 'amber' : 'emerald'}
          subtitle={activeComplaintsCount > 0 ? 'Work order ongoing' : 'All tickets resolved'}
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          to="/student/complaints"
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-amber-500 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-2"
        >
          <Ticket className="w-5 h-5 text-amber-600" />
          <div>
            <span className="text-xs font-bold text-slate-800 block">Complaints</span>
            <span className="text-[10px] text-slate-400">Maintenance Tickets</span>
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

        {/* Cleaning Room (Inside Student Section - Active only if room has cleaning duty) */}
        <Link
          to="/student/cleaning-room"
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
                No Duty
              </span>
            )}
          </div>
          <div>
            <span className="text-xs font-black text-slate-800 block flex items-center space-x-1">
              <span>🧹</span>
              <span>Cleaning Room</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {hasCleaningDuty ? 'Hostel Meal Count Duty Active' : 'Meal count taken only by Cleaning Room'}
            </span>
          </div>
        </Link>
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
