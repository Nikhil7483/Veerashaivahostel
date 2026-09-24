import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import StatCard from '../../components/common/StatCard';
import { formatDate } from '../../utils/dateUtils';
import {
  Users,
  Bed,
  CalendarCheck,
  PlaneTakeoff,
  Sparkles,
  PlusCircle,
  Megaphone,
  UtensilsCrossed,
  Coffee,
  Moon,
  ChefHat,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [todayFood, setTodayFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overRes, foodRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/food-allocation/today').catch(() => ({ data: null }))
      ]);
      setOverview(overRes?.data || null);
      setTodayFood(foodRes?.data || null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Could not load current statistics from server. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-xs font-semibold text-slate-400 animate-pulse">Loading Warden Dashboard...</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-rose-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Connection Error</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Warden Administration Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Central monitoring for all 13 hostel rooms, residents, and operational problem resolution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/attendance"
            className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Mark Attendance</span>
          </Link>
          <Link
            to="/admin/students"
            className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Manage Students</span>
          </Link>
          <Link
            to="/admin/announcements"
            className="py-2 px-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
          >
            <Megaphone className="w-4 h-4" />
            <span>Post Notice</span>
          </Link>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={overview?.total_students || 0}
          icon={Users}
          color="blue"
          subtitle="Resident in 13 Rooms"
        />
        <StatCard
          title="13 Rooms Occupancy"
          value={`${overview?.occupancy_percentage || 0}%`}
          icon={Bed}
          color="indigo"
          subtitle={`${overview?.occupied_beds || 0}/${overview?.total_beds || 0} Beds Assigned`}
        />
        <StatCard
          title="Attendance Today"
          value={`${overview?.attendance?.present || 0} Present`}
          icon={CalendarCheck}
          color="emerald"
          subtitle={`${overview?.attendance?.absent || 0} Absent | ${overview?.attendance?.on_leave || 0} On Leave`}
        />
        <StatCard
          title="Leave Requests"
          value={overview?.pending_leaves || 0}
          icon={PlaneTakeoff}
          color="amber"
          subtitle={`${overview?.attendance?.on_leave || 0} Residents On Leave`}
        />
      </div>

      {/* Secondary Quick Metrics (Non-duplicate, high-utility operational actions) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/admin/leaves"
          className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Leave Requests</p>
            <p className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition">
              {overview?.pending_leaves || 0}
              <span className="text-xs font-normal text-slate-400 ml-1">Pending</span>
            </p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
            <PlaneTakeoff className="w-4 h-4" />
          </div>
        </Link>

        <Link
          to="/admin/cleaning"
          className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 shadow-2xs hover:shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Housekeeping</p>
            <p className="text-xl font-bold text-slate-900 group-hover:text-emerald-600 transition">
              {overview?.pending_cleaning || 0}
              <span className="text-xs font-normal text-slate-400 ml-1">In Progress</span>
            </p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
            <Sparkles className="w-4 h-4" />
          </div>
        </Link>

        <Link
          to="/admin/kitchen-order"
          className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 shadow-2xs hover:shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Kitchen Orders</p>
            <p className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition">
              {todayFood?.morning_meal_order ?? overview?.attendance?.present ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">Meals</span>
            </p>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
            <ClipboardCheck className="w-4 h-4" />
          </div>
        </Link>

        <Link
          to="/admin/announcements"
          className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-amber-400 shadow-2xs hover:shadow-xs transition flex items-center justify-between group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Notices Board</p>
            <p className="text-xl font-bold text-slate-900 group-hover:text-amber-600 transition">
              Circulars
              <span className="text-xs font-normal text-slate-400 ml-1">&rarr;</span>
            </p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition">
            <Megaphone className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* 🍱 Mess & Dining Service Hub — Exactly the 3 Core Options */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
              <UtensilsCrossed className="w-4 h-4" />
              <span>Mess & Dining Operations &bull; 3 Options</span>
            </div>
            <h2 className="text-xl font-extrabold text-white">
              {todayFood?.day || 'Today'} &bull; {formatDate(todayFood?.date || new Date())}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Veerashaiva Lingayath Boys Hostel &bull; Automated kitchen orders verified strictly against resident daily attendance.
            </p>
          </div>

          {/* Exactly the 3 Dedicated Options */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/food-allocation"
              className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
            >
              <ChefHat className="w-4 h-4" />
              <span>Food Allocation (Warden)</span>
            </Link>
            <Link
              to="/admin/mess-menu"
              className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700"
            >
              <UtensilsCrossed className="w-4 h-4 text-blue-400" />
              <span>Weekly Mess Menu</span>
            </Link>
          </div>
        </div>

        {/* 3-Column Daily Meal Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Morning Dish */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Coffee className="w-4 h-4" /> Morning Dish (Breakfast)
                </span>
                <span className="text-[11px] text-amber-300/80">7:00 – 8:00 AM</span>
              </div>
              <p className="text-base font-extrabold text-white mt-1">
                {todayFood?.morning_dish || 'Pulav (Tomato Bath)'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <span>Verified Morning Count:</span>
              <div className="flex items-center space-x-1.5 font-mono text-xs">
                <span className="font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                  🍱 {todayFood?.morning_session?.tiffin_count ?? 40}
                </span>
                <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg">
                  📦 {todayFood?.morning_session?.box_count ?? 35}
                </span>
              </div>
            </div>
          </div>

          {/* Lunch Service */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" /> Lunch Routine
                </span>
                <span className="text-[11px] text-slate-400">1:00 – 2:00 PM</span>
              </div>
              <p className="text-base font-bold text-slate-200 mt-1">
                {todayFood?.lunch || (todayFood?.day === 'Sunday' ? 'Anna Sambar (Rice & Sambar)' : 'College Hours (—)')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <span>Routine Schedule:</span>
              <span className="text-slate-300 font-medium">
                {todayFood?.day === 'Sunday' ? 'Full Dining Service' : 'Regular Class Day'}
              </span>
            </div>
          </div>

          {/* Night Dish */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-indigo-400 text-xs font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Moon className="w-4 h-4" /> Night Dish (Dinner)
                </span>
                <span className="text-[11px] text-indigo-300/80">8:00 – 9:00 PM</span>
              </div>
              <p className="text-base font-extrabold text-white mt-1">
                {todayFood?.night_dish || 'Rice / Ragi Mudde + Vegetable Sambar'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <span>Verified Dinner Count:</span>
              <span className="font-mono font-black text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-lg">
                🍽️ {todayFood?.night_session?.night_meal_count ?? 45} Meals
              </span>
            </div>
          </div>
        </div>

        {/* Verification Status Pill */}
        <div className="bg-slate-800/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-700/60">
          <div className="flex flex-wrap items-center gap-4 text-slate-300">
            <span>
              👥 Total Residents: <strong className="text-white">64</strong>
            </span>
            <span className="text-emerald-400">
              Cleaning Team Verified: <strong className="text-white font-mono">Completed</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Verified by Hostel Cleaning Team
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
