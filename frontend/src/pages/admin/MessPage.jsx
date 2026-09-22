import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/dateUtils';
import {
  UtensilsCrossed,
  Edit,
  MessageSquare,
  Coffee,
  Sun,
  Moon,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  Users,
  Package,
  Home,
  XCircle,
  AlertTriangle,
  Save
} from 'lucide-react';

const MessPage = () => {
  const navigate = useNavigate();
  const [menuList, setMenuList] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [selectedMealFilter, setSelectedMealFilter] = useState('ALL');

  // Meal Counts Data from Backend
  const [mealData, setMealData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Intl.DateTimeFormat('en-CA').format(new Date()));
  const [tiffinCount, setTiffinCount] = useState(52);
  const [tiffinBoxCount, setTiffinBoxCount] = useState(10);
  const [nightLunchCount, setNightLunchCount] = useState(52);
  const [selectedBreakfastItem, setSelectedBreakfastItem] = useState('');
  const [selectedDinnerItem, setSelectedDinnerItem] = useState('');
  const [remarks, setRemarks] = useState('');
  const [savingCounts, setSavingCounts] = useState(false);

  // Edit menu modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDayMenu, setSelectedDayMenu] = useState(null);
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('—');
  const [dinner, setDinner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadMessData = async () => {
    setLoading(true);
    try {
      const [menuRes, fbRes, countRes] = await Promise.all([
        api.get('/mess/menu'),
        api.get('/mess/feedback'),
        api.get(`/mess/meal-counts?date=${selectedDate}`)
      ]);
      setMenuList(menuRes.data);
      setFeedbackList(fbRes.data);
      setMealData(countRes.data);

      // Populate interactive inputs
      setTiffinCount(countRes.data.tiffin_count);
      setTiffinBoxCount(countRes.data.tiffin_box_count);
      setNightLunchCount(countRes.data.night_lunch_count);
      setSelectedBreakfastItem(countRes.data.selected_breakfast_item || '');
      setSelectedDinnerItem(countRes.data.selected_dinner_item || '');
      setRemarks(countRes.data.remarks || '');
    } catch (err) {
      console.error('Error fetching mess data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessData();
  }, [selectedDate]);

  // Submit Warden's Daily Meal Confirmation
  const handleConfirmMealCounts = async (e) => {
    e.preventDefault();
    setSavingCounts(true);
    try {
      const res = await api.post('/mess/meal-counts', {
        date: selectedDate,
        tiffin_count: Number(tiffinCount),
        tiffin_box_count: Number(tiffinBoxCount),
        night_lunch_count: Number(nightLunchCount),
        selected_breakfast_item: selectedBreakfastItem,
        selected_dinner_item: selectedDinnerItem,
        remarks: remarks || 'Confirmed by Warden against daily roll call.'
      });
      setNotice(res.data.message);
      loadMessData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save meal count.');
    } finally {
      setSavingCounts(false);
    }
  };

  const openEditMenu = (dayMenu) => {
    setSelectedDayMenu(dayMenu);
    setBreakfast(dayMenu.breakfast || '');
    setLunch(dayMenu.lunch || '—');
    setDinner(dayMenu.dinner || '');
    setEditModalOpen(true);
  };

  const handleUpdateMenu = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put('/mess/menu', [
        {
          day: selectedDayMenu.day,
          breakfast,
          lunch: lunch || '—',
          dinner,
        }
      ]);
      setNotice(`✅ ${selectedDayMenu.day} dining menu updated successfully.`);
      setEditModalOpen(false);
      loadMessData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update mess menu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetOfficial = async () => {
    if (!window.confirm("Restore official 7-day routine menu (Breakfast 7-8 AM, Dinner 8-9 PM, Sunday Lunch)?")) return;
    setLoading(true);
    try {
      const res = await api.post('/mess/reset-official-menu');
      setNotice(`🔄 ${res.data.message}`);
      await loadMessData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reset official menu.');
    } finally {
      setLoading(false);
    }
  };

  const currentDayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  const todayMenu = menuList.find((m) => m.day.toLowerCase() === currentDayName.toLowerCase()) || menuList[0];

  const filteredFeedbacks = selectedMealFilter === 'ALL'
    ? feedbackList
    : feedbackList.filter((f) => f.meal_type?.toUpperCase() === selectedMealFilter);

  // Present count comparison
  const presentCount = mealData?.present_students ?? 52;
  const tiffinAligned = Number(tiffinCount) === presentCount;
  const nightLunchAligned = Number(nightLunchCount) === presentCount;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-900 border border-amber-200">
              <UtensilsCrossed className="w-3 h-3 text-amber-600" />
              <span>Mess & Dining Management</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">&bull; Today: {currentDayName}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Hostel Mess & Meal Count System
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Daily meal allocation & attendance comparison &bull; Warden kitchen confirmation &bull; 7-day routine schedule timetable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="py-2.5 px-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Dashboard</span>
          </button>

          <button
            onClick={handleResetOfficial}
            className="py-2.5 px-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
            title="Restore official routine timetable"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
            <span>Restore Official Timetable</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-300 text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-950 font-black text-sm">
            &times;
          </button>
        </div>
      )}

      {/* 📊 FOOD DASHBOARD CARDS (Required by User Prompt) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center space-x-1.5">
              <span>📊 Food Dashboard & Attendance Allocation</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-semibold">
              (Total Students: {mealData?.total_students || 64})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-semibold">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="py-1 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs"
            />
          </div>
        </div>

        {/* 6 Key KPI Cards specified in user request + Cleaning status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. 👥 Present Students: 52 */}
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                Present Students
              </span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-950 mt-1.5">
              {mealData?.present_students ?? 52}
            </p>
            <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
              Eligible Meal Count
            </p>
          </div>

          {/* 2. 🍽️ Tiffin: 52 */}
          <div className="p-4 bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                Tiffin (Morning)
              </span>
              <Coffee className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-950 mt-1.5">
              {mealData?.tiffin_count ?? 52}
            </p>
            <p className="text-[10px] text-amber-700 font-bold mt-0.5">
              Breakfast &bull; 7-8 AM
            </p>
          </div>

          {/* 3. 📦 Tiffin Box: 10 */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                Tiffin Box
              </span>
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-blue-950 mt-1.5">
              {mealData?.tiffin_box_count ?? 10}
            </p>
            <p className="text-[10px] text-blue-700 font-bold mt-0.5">
              College Dabba Box
            </p>
          </div>

          {/* 4. 🌙 Night Lunch: 52 */}
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">
                Night Lunch
              </span>
              <Moon className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-indigo-950 mt-1.5">
              {mealData?.night_lunch_count ?? 52}
            </p>
            <p className="text-[10px] text-indigo-700 font-bold mt-0.5">
              Dinner &bull; 8-9 PM
            </p>
          </div>

          {/* 5. 🏠 On Leave: 7 */}
          <div className="p-4 bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                On Leave
              </span>
              <Home className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-purple-950 mt-1.5">
              {mealData?.on_leave ?? 7}
            </p>
            <p className="text-[10px] text-purple-700 font-bold mt-0.5">
              Sanctioned Away
            </p>
          </div>

          {/* 6. ❌ Absent: 5 */}
          <div className="p-4 bg-gradient-to-br from-rose-50 to-white rounded-2xl border border-rose-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                Absent
              </span>
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-950 mt-1.5">
              {mealData?.absent ?? 5}
            </p>
            <p className="text-[10px] text-rose-700 font-bold mt-0.5">
              Excluded from Kitchen
            </p>
          </div>
        </div>
      </div>

      {/* 🍛 WARDEN DAILY MEAL COUNT ALLOCATION & CONFIRMATION PANEL */}
      <div className="p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white shadow-xl border border-indigo-500/20 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                Warden Meal Allocation
              </span>
              {mealData?.is_confirmed ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Confirmed & Issued to Kitchen</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Pending Warden Confirmation</span>
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-white mt-1">
              Daily Kitchen Meal Order & Attendance Verification
            </h2>
            <p className="text-xs text-slate-300">
              Only students marked <strong>Present in Hostel</strong> are included in kitchen preparation.
            </p>
          </div>

          {/* Quick Summary Badges: Attendance & Cleaning count */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-center min-w-[100px]">
              <div className="text-[9px] uppercase font-bold text-slate-400">Hostel Residents</div>
              <div className="text-sm font-black text-white">{mealData?.total_students || 64} Students</div>
            </div>
            <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-center min-w-[100px]">
              <div className="text-[9px] uppercase font-bold text-emerald-400">Eligible Meal</div>
              <div className="text-sm font-black text-emerald-300">{presentCount} Present</div>
            </div>
            <div className="p-2.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/10 text-center min-w-[100px]">
              <div className="text-[9px] uppercase font-bold text-purple-400">Sanitation Count</div>
              <div className="text-sm font-black text-purple-300">
                {mealData?.cleaned_rooms_count ?? 0} / 12 Rooms
              </div>
            </div>
          </div>
        </div>

        {/* Form: Enter and confirm counts */}
        <form onSubmit={handleConfirmMealCounts} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Tiffin Count */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-amber-300 uppercase flex items-center space-x-1.5">
                  <Coffee className="w-4 h-4" />
                  <span>Tiffin Count (Morning)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setTiffinCount(presentCount)}
                  className="text-[10px] text-amber-300 hover:text-amber-200 underline font-bold"
                >
                  Set to Present ({presentCount})
                </button>
              </div>
              <input
                type="number"
                min="0"
                max="200"
                required
                value={tiffinCount}
                onChange={(e) => setTiffinCount(e.target.value)}
                className="w-full p-2.5 bg-slate-900/80 border border-amber-400/40 rounded-xl text-lg font-black text-white focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[11px] text-slate-300">
                Timing: <strong>7:00 to 8:00 AM</strong> &bull; Dish: {todayMenu?.breakfast}
              </p>
            </div>

            {/* 2. Tiffin Box Count */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-blue-300 uppercase flex items-center space-x-1.5">
                  <Package className="w-4 h-4" />
                  <span>Tiffin Box Count</span>
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">Packed Dabba</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={tiffinBoxCount}
                onChange={(e) => setTiffinBoxCount(e.target.value)}
                className="w-full p-2.5 bg-slate-900/80 border border-blue-400/40 rounded-xl text-lg font-black text-white focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-[11px] text-slate-300">
                Packed lunch for residents carrying food to college/work.
              </p>
            </div>

            {/* 3. Night Lunch Count */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-indigo-300 uppercase flex items-center space-x-1.5">
                  <Moon className="w-4 h-4" />
                  <span>Night Lunch Count</span>
                </label>
                <button
                  type="button"
                  onClick={() => setNightLunchCount(presentCount)}
                  className="text-[10px] text-indigo-300 hover:text-indigo-200 underline font-bold"
                >
                  Set to Present ({presentCount})
                </button>
              </div>
              <input
                type="number"
                min="0"
                max="200"
                required
                value={nightLunchCount}
                onChange={(e) => setNightLunchCount(e.target.value)}
                className="w-full p-2.5 bg-slate-900/80 border border-indigo-400/40 rounded-xl text-lg font-black text-white focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-[11px] text-slate-300">
                Timing: <strong>8:00 to 9:00 PM</strong> &bull; Dish: {todayMenu?.dinner}
              </p>
            </div>
          </div>

          {/* Today's Food Items Selection by Warden */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Allocated Morning Dish (Breakfast)
              </label>
              <input
                type="text"
                value={selectedBreakfastItem || todayMenu?.breakfast || ''}
                onChange={(e) => setSelectedBreakfastItem(e.target.value)}
                placeholder="e.g. Pulav (Tomato Bath)"
                className="w-full p-2.5 bg-slate-900/80 border border-white/20 rounded-xl text-xs text-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Allocated Night Dish (Dinner)
              </label>
              <input
                type="text"
                value={selectedDinnerItem || todayMenu?.dinner || ''}
                onChange={(e) => setSelectedDinnerItem(e.target.value)}
                placeholder="e.g. Rice / Ragi Mudde + Vegetable Sambar"
                className="w-full p-2.5 bg-slate-900/80 border border-white/20 rounded-xl text-xs text-white font-semibold"
              />
            </div>
          </div>

          {/* Remarks & Comparison Indicator */}
          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              {tiffinAligned && nightLunchAligned ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <span className="font-extrabold text-white block">
                  {tiffinAligned && nightLunchAligned
                    ? '✅ Attendance Comparison Aligned: Zero Discrepancy'
                    : '⚠️ Attendance Comparison Note: Variance Detected'}
                </span>
                <span className="text-[11px] text-slate-300">
                  Present Count: <strong>{presentCount}</strong> &bull; Tiffin: <strong>{tiffinCount}</strong> &bull; Night Lunch: <strong>{nightLunchCount}</strong> &bull; Tiffin Box: <strong>{tiffinBoxCount}</strong>
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingCounts}
              className="py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>{savingCounts ? 'Confirming...' : 'Confirm & Lock Meal Count'}</span>
            </button>
          </div>

          {mealData?.is_confirmed && (
            <div className="text-right text-[11px] text-emerald-300 font-medium">
              Confirmed by <strong>{mealData.confirmed_by || 'Warden'}</strong> at {mealData.confirmed_at}
            </div>
          )}
        </form>
      </div>

      {/* Routine Meal Timing Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Breakfast Timing */}
        <div className="p-4 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 rounded-2xl border border-amber-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
              Morning Routine Meal
            </span>
            <h3 className="text-sm font-black text-slate-900">Breakfast</h3>
            <p className="text-xs font-bold text-amber-700 flex items-center space-x-1 mt-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span>7:00 AM &ndash; 8:00 AM (Daily)</span>
            </p>
          </div>
        </div>

        {/* Lunch Timing */}
        <div className="p-4 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 rounded-2xl border border-blue-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 block">
              Sunday Feast Only
            </span>
            <h3 className="text-sm font-black text-slate-900">Lunch (Sunday)</h3>
            <p className="text-xs font-bold text-blue-700 flex items-center space-x-1 mt-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span>1:00 PM &ndash; 2:00 PM (Mon-Sat: &mdash;)</span>
            </p>
          </div>
        </div>

        {/* Dinner Timing */}
        <div className="p-4 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 rounded-2xl border border-indigo-200 shadow-2xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 block">
              Night Routine Meal
            </span>
            <h3 className="text-sm font-black text-slate-900">Dinner</h3>
            <p className="text-xs font-bold text-indigo-700 flex items-center space-x-1 mt-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span>8:00 PM &ndash; 9:00 PM (Daily)</span>
            </p>
          </div>
        </div>
      </div>

      {/* 7-Day Weekly Menu Schedule */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Official 7-Day Routine Dining Matrix
              </h3>
              <p className="text-[11px] text-slate-400">
                Weekly schedule with standardized breakfast & dinner sessions
              </p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`py-1 px-3 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Timetable View</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`py-1 px-3 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Day Cards</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading dining timetable...</div>
        ) : viewMode === 'table' ? (
          /* EXACT TABLE FORMAT REQUIRED BY USER */
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-4 rounded-tl-2xl">Day</th>
                  <th className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5 text-amber-300">
                      <Coffee className="w-3.5 h-3.5" />
                      <span>Breakfast &ndash; 7:00 to 8:00 AM</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5 text-blue-300">
                      <Sun className="w-3.5 h-3.5" />
                      <span>Lunch &ndash; 1:00 to 2:00 PM</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5 text-indigo-300">
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dinner &ndash; 8:00 to 9:00 PM</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center rounded-tr-2xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 bg-white">
                {menuList.map((m) => {
                  const isToday = m.day.toLowerCase() === currentDayName.toLowerCase();
                  const isSunday = m.day.toLowerCase() === 'sunday';

                  return (
                    <tr
                      key={m.day}
                      className={`transition-colors hover:bg-slate-50/80 ${isToday ? 'bg-amber-50/40 font-semibold' : ''
                        }`}
                    >
                      {/* Day Column */}
                      <td className="py-3.5 px-4 font-black text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span>{m.day}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wide">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Breakfast Column */}
                      <td className="py-3.5 px-4 text-slate-800">
                        <div className="font-bold text-amber-950">{m.breakfast}</div>
                        <div className="text-[10px] text-amber-700/80 font-medium">Morning Session</div>
                      </td>

                      {/* Lunch Column */}
                      <td className="py-3.5 px-4 text-slate-700">
                        {isSunday ? (
                          <div className="inline-flex flex-col">
                            <span className="font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              {m.lunch}
                            </span>
                            <span className="text-[9px] text-blue-600 font-bold mt-0.5">
                              ⭐ Sunday Special
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold text-sm tracking-wider">
                            {m.lunch || '—'}
                          </span>
                        )}
                      </td>

                      {/* Dinner Column */}
                      <td className="py-3.5 px-4 text-slate-800">
                        <div className="font-bold text-indigo-950">{m.dinner}</div>
                        <div className="text-[10px] text-indigo-700/80 font-medium">Night Session</div>
                      </td>

                      {/* Action Column */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => openEditMenu(m)}
                          className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 shadow-2xs hover:border-slate-400"
                        >
                          <Edit className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {menuList.map((m) => {
              const isToday = m.day.toLowerCase() === currentDayName.toLowerCase();
              const isSunday = m.day.toLowerCase() === 'sunday';

              return (
                <div
                  key={m.day}
                  className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition shadow-2xs ${isToday
                      ? 'bg-gradient-to-b from-amber-50/50 to-white border-amber-300 ring-2 ring-amber-400/20'
                      : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-black text-slate-900 text-sm">{m.day}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px] uppercase">
                            Today
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => openEditMenu(m)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition"
                        title="Edit Day Menu"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Breakfast */}
                      <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-100">
                        <span className="font-extrabold text-amber-900 text-[10px] uppercase flex items-center space-x-1">
                          <Coffee className="w-3 h-3 text-amber-600" />
                          <span>Breakfast (7:00 &ndash; 8:00 AM)</span>
                        </span>
                        <p className="text-slate-800 font-bold text-[11px] mt-0.5">{m.breakfast}</p>
                      </div>

                      {/* Lunch */}
                      <div className={`p-2 rounded-xl border ${isSunday ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                        <span className="font-extrabold text-blue-900 text-[10px] uppercase flex items-center space-x-1">
                          <Sun className="w-3 h-3 text-blue-600" />
                          <span>Lunch (1:00 &ndash; 2:00 PM)</span>
                        </span>
                        <p className={`font-bold text-[11px] mt-0.5 ${isSunday ? 'text-blue-950 font-extrabold' : 'text-slate-400'}`}>
                          {m.lunch || '—'}
                        </p>
                      </div>

                      {/* Dinner */}
                      <div className="p-2 bg-indigo-50/60 rounded-xl border border-indigo-100">
                        <span className="font-extrabold text-indigo-900 text-[10px] uppercase flex items-center space-x-1">
                          <Moon className="w-3 h-3 text-indigo-600" />
                          <span>Dinner (8:00 &ndash; 9:00 PM)</span>
                        </span>
                        <p className="text-slate-800 font-bold text-[11px] mt-0.5">{m.dinner}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resident Feedback & Dining Reviews */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Resident Dining Feedback & Reviews</h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedMealFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition ${selectedMealFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
            >
              All Meals
            </button>
            <button
              onClick={() => setSelectedMealFilter('BREAKFAST')}
              className={`px-2.5 py-1 rounded-lg transition ${selectedMealFilter === 'BREAKFAST' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-500'
                }`}
            >
              Breakfast
            </button>
            <button
              onClick={() => setSelectedMealFilter('DINNER')}
              className={`px-2.5 py-1 rounded-lg transition ${selectedMealFilter === 'DINNER' ? 'bg-white text-indigo-800 shadow-2xs' : 'text-slate-500'
                }`}
            >
              Dinner
            </button>
          </div>
        </div>

        {filteredFeedbacks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            No dining reviews submitted yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFeedbacks.map((f) => (
              <div
                key={f.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition space-y-3 text-xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{f.student_name}</h4>
                      <p className="text-[11px] text-slate-400">{f.room_number} &bull; {formatDate(f.date)}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${f.meal_type === 'BREAKFAST'
                        ? 'bg-amber-100 text-amber-800'
                        : f.meal_type === 'DINNER'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                      {f.meal_type}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-slate-700 leading-relaxed font-medium">
                      "{f.comment}"
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Resident Review</span>
                  <span>{f.meal_type} Session</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Menu Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Update ${selectedDayMenu?.day} Menu`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleUpdateMenu} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Breakfast Menu (7:00 &ndash; 8:00 AM) *
            </label>
            <input
              type="text"
              required
              value={breakfast}
              onChange={(e) => setBreakfast(e.target.value)}
              placeholder="e.g. Pulav (Tomato Bath)"
              className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Lunch Menu (1:00 &ndash; 2:00 PM) &bull; Set "—" for routine days
            </label>
            <input
              type="text"
              value={lunch}
              onChange={(e) => setLunch(e.target.value)}
              placeholder="— (or Anna Sambar for Sunday)"
              className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Hostel routine provides Breakfast & Dinner. Lunch is served on Sunday only.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Dinner Menu (8:00 &ndash; 9:00 PM) *
            </label>
            <input
              type="text"
              required
              value={dinner}
              onChange={(e) => setDinner(e.target.value)}
              placeholder="e.g. Rice / Ragi Mudde + Vegetable Sambar"
              className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Day Menu'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MessPage;
