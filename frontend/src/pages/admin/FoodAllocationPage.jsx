import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import {
  UtensilsCrossed,
  Sun,
  Moon,
  Save,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  History,
  Lock,
  Search,
  Users,
  ShieldCheck,
  Clock,
  Coffee,
  Package,
  ExternalLink,
  Download,
  Printer,
  RotateCcw,
  FileText,
  Check,
  X,
  Filter
} from 'lucide-react';

const OFFICIAL_BREAKFAST_ITEMS = [
  'Pulav (Tomato Bath)',
  'Chitranna (Lemon Rice)',
  'Upma',
  'Puliyogare (Tamarind Rice)',
  'Vangi Bath',
  'Avalakki (Poha)',
  'Idli, Chutney, Sambar'
];

const OFFICIAL_DINNER_ITEMS = [
  'Rice / Ragi Mudde + Vegetable Sambar',
  'Rice / Chapati + Vegetable Sambar',
  'Rice / Ragi Mudde + Soppina Sambar (Greens Sambar)',
  'Shavige Payasa (Wheat Payasa) + Rice & Sambar'
];

const DEFAULT_SCHEDULE = {
  Monday: { breakfast: 'Pulav (Tomato Bath)', lunch: '—', dinner: 'Rice / Ragi Mudde + Vegetable Sambar' },
  Tuesday: { breakfast: 'Chitranna (Lemon Rice)', lunch: '—', dinner: 'Rice / Ragi Mudde + Vegetable Sambar' },
  Wednesday: { breakfast: 'Upma', lunch: '—', dinner: 'Rice / Chapati + Vegetable Sambar' },
  Thursday: { breakfast: 'Puliyogare (Tamarind Rice)', lunch: '—', dinner: 'Rice / Ragi Mudde + Vegetable Sambar' },
  Friday: { breakfast: 'Vangi Bath', lunch: '—', dinner: 'Rice / Ragi Mudde + Vegetable Sambar' },
  Saturday: { breakfast: 'Avalakki (Poha)', lunch: '—', dinner: 'Rice / Ragi Mudde + Soppina Sambar (Greens Sambar)' },
  Sunday: { breakfast: 'Idli, Chutney, Sambar', lunch: 'Anna Sambar (Rice & Sambar)', dinner: 'Shavige Payasa (Wheat Payasa) + Rice & Sambar' }
};

const getDayOfWeek = (dateString) => {
  if (!dateString) return 'Monday';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return 'Monday';
};

const FoodAllocationPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayName, setDayName] = useState(getDayOfWeek(new Date().toISOString().split('T')[0]));
  const [morningDish, setMorningDish] = useState(OFFICIAL_BREAKFAST_ITEMS[0]);
  const [nightDish, setNightDish] = useState(OFFICIAL_DINNER_ITEMS[0]);
  const [allocationData, setAllocationData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  // History state
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historySearch, setHistorySearch] = useState('');

  // Warden Roster & PDF state
  const [rosterData, setRosterData] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatusFilter, setRosterStatusFilter] = useState('ALL');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadDateAllocation = async (dateStr) => {
    setLoading(true);
    setError('');
    setSavedSuccess(false);
    const computedDay = getDayOfWeek(dateStr);
    setDayName(computedDay);

    const defaultForDay = DEFAULT_SCHEDULE[computedDay] || DEFAULT_SCHEDULE.Monday;

    try {
      const res = await api.get(`/food-allocation/date/${dateStr}`);
      setAllocationData(res.data);
      if (res.data) {
        setMorningDish(res.data.morning_dish || defaultForDay.breakfast);
        setNightDish(res.data.night_dish || defaultForDay.dinner);
      }
    } catch (err) {
      console.error(err);
      setMorningDish(defaultForDay.breakfast);
      setNightDish(defaultForDay.dinner);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/food-allocation/history');
      setHistoryRecords(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRoster = async (dateStr) => {
    setLoadingRoster(true);
    try {
      const res = await api.get(`/food-allocation/warden/roster/${dateStr}`);
      setRosterData(res.data);
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await api.get(`/food-allocation/download-pdf/${selectedDate}?download=1`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const formattedDate = formatDate(selectedDate).replace(/\//g, '_');
      link.setAttribute('download', `Veerashaiva_Hostel_Meal_Count_${formattedDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download meal count PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleViewPrintPdf = async () => {
    try {
      const res = await api.get(`/food-allocation/download-pdf/${selectedDate}?download=0`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      alert('Failed to open PDF report.');
    }
  };

  useEffect(() => {
    loadDateAllocation(selectedDate);
    loadRoster(selectedDate);
    fetchHistory();
  }, [selectedDate]);

  const handleSaveAllocation = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedSuccess(false);

    try {
      await api.post('/food-allocation/save', {
        date: selectedDate,
        morning_dish: morningDish,
        night_dish: nightDish
      });
      setSavedSuccess(true);
      loadDateAllocation(selectedDate);
      loadRoster(selectedDate);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to save food allocation.');
    } finally {
      setSaving(false);
    }
  };

  const filteredHistory = historyRecords.filter(item =>
    item.date.includes(historySearch) ||
    formatDate(item.date).includes(historySearch) ||
    item.day.toLowerCase().includes(historySearch.toLowerCase()) ||
    (item.morning_dish && item.morning_dish.toLowerCase().includes(historySearch.toLowerCase())) ||
    (item.night_dish && item.night_dish.toLowerCase().includes(historySearch.toLowerCase()))
  );

  const mSession = allocationData?.morning_session;
  const nSession = allocationData?.night_session;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">
              <UtensilsCrossed className="w-4 h-4" />
              <span>Warden Food Administration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Food Allocation & Verified Counts
            </h1>
            <p className="text-blue-200 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              As Warden, decide <strong>WHAT food is served</strong> from the official 7-day routine menu.
              The Cleaning Team records student requirements and submits the verified counts.
            </p>
          </div>

          {/* Date Selector */}
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 flex items-center space-x-3 self-start md:self-auto">
            <Calendar className="w-5 h-5 text-blue-300 shrink-0" />
            <div>
              <label className="block text-[10px] uppercase font-bold text-blue-200 tracking-wider">
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-bold text-sm focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold flex items-center space-x-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Food allocation for {formatDate(selectedDate)} ({dayName}) saved successfully.</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-sm font-semibold flex items-center space-x-2.5">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Left = Allocation Form, Right = Read-Only Final Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Warden Food Selection Form */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
              Step 1: Warden Decision
            </span>
            <h2 className="text-lg font-black text-slate-900">
              Decide What Food Is Served
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select morning and night dishes for {formatDate(selectedDate)} ({dayName}).
            </p>
          </div>

          <form onSubmit={handleSaveAllocation} className="space-y-5">
            {/* Breakfast Dropdown */}
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                <Sun className="w-4 h-4 text-amber-600" />
                <span>Morning Breakfast Dish</span>
              </div>
              <p className="text-[11px] text-amber-700">
                Default for {dayName}: <strong>{DEFAULT_SCHEDULE[dayName]?.breakfast}</strong>
              </p>
              <select
                value={morningDish}
                onChange={(e) => setMorningDish(e.target.value)}
                className="w-full text-sm font-semibold p-3 rounded-xl border border-amber-300 bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                {OFFICIAL_BREAKFAST_ITEMS.map((dish) => (
                  <option key={dish} value={dish}>{dish}</option>
                ))}
              </select>
            </div>

            {/* Dinner Dropdown */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2">
              <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>Night Dinner Dish</span>
              </div>
              <p className="text-[11px] text-indigo-700">
                Default for {dayName}: <strong>{DEFAULT_SCHEDULE[dayName]?.dinner}</strong>
              </p>
              <select
                value={nightDish}
                onChange={(e) => setNightDish(e.target.value)}
                className="w-full text-sm font-semibold p-3 rounded-xl border border-indigo-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {OFFICIAL_DINNER_ITEMS.map((dish) => (
                  <option key={dish} value={dish}>{dish}</option>
                ))}
              </select>
            </div>

            {/* Sunday Special Notice */}
            {dayName === 'Sunday' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                <strong>Sunday Routine:</strong> Breakfast is served directly (Idli, Chutney, Sambar). Sunday Lunch is <strong>Anna Sambar (Rice & Sambar)</strong>. Morning Tiffin Count is not required.
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Allocation...' : 'Save Food Allocation'}</span>
            </button>
          </form>
        </div>

        {/* Right: Warden View After Submission (Read-Only Verified Counts) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                  Step 2: Cleaning Team Verification
                </span>
                <h2 className="text-lg font-black text-slate-900">
                  Verified Kitchen Meal Counts
                </h2>
              </div>
              <span className="px-3 py-1 bg-slate-100 rounded-full text-[11px] font-bold text-slate-600">
                Read-Only
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified resident meal requirements submitted directly by the Cleaning Team.
            </p>
          </div>

          {/* Cards for Morning and Night Submitted Results */}
          <div className="space-y-4">
            {/* Morning Tiffin Result Card */}
            <div className="p-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🌅</span>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                    MORNING TIFFIN
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    mSession?.is_locked
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {mSession?.is_locked ? '✅ Verified & Locked' : 'Pending Submission'}
                </span>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-medium">Allocated Food:</p>
                <p className="text-sm font-bold text-slate-900">{morningDish}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                <div className="p-3 bg-white rounded-xl border border-amber-200/80">
                  <p className="text-[10px] font-bold text-amber-700 uppercase">🍱 Tiffin Count</p>
                  <p className="text-2xl font-black text-amber-900 mt-0.5">
                    {mSession?.tiffin_count !== undefined ? mSession.tiffin_count : '—'}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-indigo-200/80">
                  <p className="text-[10px] font-bold text-indigo-700 uppercase">📦 Box Count</p>
                  <p className="text-2xl font-black text-indigo-900 mt-0.5">
                    {mSession?.box_count !== undefined ? mSession.box_count : '—'}
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between pt-1 items-center">
                <span>Submitted by: <strong>{mSession?.submitted_by || 'Cleaning Team'}</strong></span>
                <span>
                  {mSession?.submitted_at ? new Date(mSession.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>

              <div className="pt-2 border-t border-amber-200/50 flex justify-end">
                <Link
                  to="/admin/students?tab=cleaning-room"
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition shadow-2xs"
                >
                  <span>Open Cleaning Room</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Night Meal Result Card */}
            <div className="p-5 rounded-2xl border border-purple-200 bg-gradient-to-br from-white to-purple-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🌙</span>
                  <span className="text-xs font-black uppercase tracking-wider text-purple-900">
                    NIGHT MEAL
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    nSession?.is_locked
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {nSession?.is_locked ? '✅ Verified & Locked' : 'Pending Submission'}
                </span>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-medium">Allocated Food:</p>
                <p className="text-sm font-bold text-slate-900">{nightDish}</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-purple-200/80">
                <p className="text-[10px] font-bold text-purple-700 uppercase">🍽️ Dinner Meal Count</p>
                <p className="text-2xl font-black text-purple-900 mt-0.5">
                  {nSession?.night_meal_count !== undefined ? nSession.night_meal_count : '—'}
                </p>
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between pt-1 items-center">
                <span>Submitted by: <strong>{nSession?.submitted_by || 'Cleaning Team'}</strong></span>
                <span>
                  {nSession?.submitted_at ? new Date(nSession.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>

              <div className="pt-2 border-t border-purple-200/50 flex justify-end">
                <Link
                  to="/admin/students?tab=cleaning-room"
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-800 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-xl transition shadow-2xs"
                >
                  <span>Open Cleaning Room</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 text-center">
            🔒 Warden view is read-only. The meal count is taken exclusively by the designated Cleaning Room on duty, not all rooms.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📋 RESIDENT MEAL COUNT ROSTER & PDF DOWNLOAD (WARDEN SIDE) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Users className="w-4 h-4" />
              <span>Resident Meal Count Roster • Warden Live Audit</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <span>Present Residents Food Requirements for {formatDate(selectedDate)} ({dayName})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing only eligible present residents. Absent and Leave residents are excluded from dining counts.
            </p>
          </div>

          {/* Action Buttons: PDF Download & Print */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              title="Download official PDF report for kitchen and records"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download Official PDF'}</span>
            </button>

            <button
              onClick={handleViewPrintPdf}
              className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Open PDF in new tab to view or print"
            >
              <Printer className="w-4 h-4" />
              <span>Print / View PDF</span>
            </button>

            <button
              onClick={() => loadRoster(selectedDate)}
              disabled={loadingRoster}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
              title="Refresh Roster Data"
            >
              <RotateCcw className={`w-4 h-4 ${loadingRoster ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Counters Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Residents</p>
            <p className="text-xl font-black text-slate-800">{rosterData?.total_students || 0}</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
            <p className="text-[10px] uppercase font-bold text-emerald-600">Present in Hostel</p>
            <p className="text-xl font-black text-emerald-800">{rosterData?.total_present || 0}</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
            <p className="text-[10px] uppercase font-bold text-rose-600">Absent (Exempt)</p>
            <p className="text-xl font-black text-rose-800">
              {(rosterData?.total_absent || 0) + (rosterData?.total_leave || 0)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
            <p className="text-[10px] uppercase font-bold text-amber-700">🍱 Tiffin Required</p>
            <p className="text-xl font-black text-amber-900">
              {rosterData?.morning_summary?.tiffin_count ?? rosterData?.total_present ?? '—'}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
            <p className="text-[10px] uppercase font-bold text-indigo-700">📦 Box Required</p>
            <p className="text-xl font-black text-indigo-900">
              {rosterData?.morning_summary?.box_count ?? '—'}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-center">
            <p className="text-[10px] uppercase font-bold text-purple-700">🌙 Dinner Required</p>
            <p className="text-xl font-black text-purple-900">
              {rosterData?.night_summary?.night_meal_count ?? rosterData?.total_present ?? '—'}
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="Search resident, room, or ID..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'ALL', label: `All Present (${rosterData?.total_present || 0})` },
              { id: 'TIFFIN_YES', label: '🍱 Tiffin Yes' },
              { id: 'BOX_YES', label: '📦 Box Yes' },
              { id: 'DINNER_YES', label: '🌙 Dinner Yes' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRosterStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  rosterStatusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loadingRoster ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
            Loading student meal count list...
          </div>
        ) : !rosterData?.roster || rosterData.roster.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
            No student records found for this date.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3.5 py-3">Room</th>
                  <th className="px-2.5 py-3 text-center">Bed</th>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-4 py-3">Resident Name</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3.5 py-3 text-center">Attendance</th>
                  <th className="px-3.5 py-3 text-center bg-amber-950/40">🍱 Morning Tiffin</th>
                  <th className="px-3.5 py-3 text-center bg-indigo-950/40">📦 Morning Box</th>
                  <th className="px-3.5 py-3 text-center bg-purple-950/40">🌙 Night Dinner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(rosterData.roster || [])
                  .filter((s) => {
                    const q = rosterSearch.toLowerCase();
                    const matchesSearch =
                      !q ||
                      s.name?.toLowerCase().includes(q) ||
                      s.student_id?.toLowerCase().includes(q) ||
                      s.room_number?.toLowerCase().includes(q) ||
                      s.bed_number?.toLowerCase().includes(q);

                    if (!matchesSearch) return false;
                    if (rosterStatusFilter === 'PRESENT') return s.attendance_status === 'PRESENT';
                    if (rosterStatusFilter === 'TIFFIN_YES') return s.tiffin_required;
                    if (rosterStatusFilter === 'BOX_YES') return s.box_required;
                    if (rosterStatusFilter === 'DINNER_YES') return s.meal_required;
                    if (rosterStatusFilter === 'EXEMPT') return s.is_exempt;
                    return true;
                  })
                  .map((s) => {
                    const isExempt = s.is_exempt;
                    return (
                      <tr
                        key={s.student_id}
                        className={`hover:bg-slate-50/80 transition ${
                          isExempt ? 'bg-slate-50/50 opacity-75' : ''
                        }`}
                      >
                        {/* Room */}
                        <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                          {s.room_number}
                        </td>
                        {/* Bed */}
                        <td className="px-2.5 py-2.5 text-center font-mono font-bold text-slate-700">
                          {s.bed_number}
                        </td>
                        {/* ID */}
                        <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px]">
                          {s.student_id}
                        </td>
                        {/* Name */}
                        <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                          {s.name}
                        </td>
                        {/* Department */}
                        <td className="px-3 py-2.5 text-slate-600 text-[11px]">
                          {s.department}
                        </td>
                        {/* Attendance Status */}
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              s.attendance_status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.attendance_status === 'LEAVE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {s.attendance_status}
                          </span>
                        </td>

                        {/* Morning Tiffin */}
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap bg-amber-50/30">
                          {isExempt ? (
                            <span className="text-[10px] font-medium text-slate-400 italic">
                              Exempt (Absent)
                            </span>
                          ) : s.tiffin_required ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              <Check className="w-3 h-3 text-amber-700" />
                              <span>YES</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">No</span>
                          )}
                        </td>

                        {/* Morning Box */}
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap bg-indigo-50/30">
                          {isExempt ? (
                            <span className="text-[10px] font-medium text-slate-400 italic">
                              Exempt (Absent)
                            </span>
                          ) : s.box_required ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">
                              <Check className="w-3 h-3 text-indigo-700" />
                              <span>YES</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">No</span>
                          )}
                        </td>

                        {/* Night Dinner */}
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap bg-purple-50/30">
                          {isExempt ? (
                            <span className="text-[10px] font-medium text-slate-400 italic">
                              Exempt (Absent)
                            </span>
                          ) : s.meal_required ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                              <Check className="w-3 h-3 text-purple-700" />
                              <span>YES</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">No</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date-Filterable History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Food Allocation & Order History</h3>
            <p className="text-xs text-slate-500">Audit trail of daily menus and submitted kitchen orders.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search date or food..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Morning Dish</th>
                <th className="px-4 py-3">🍱 Tiffin Count</th>
                <th className="px-4 py-3">📦 Box Count</th>
                <th className="px-4 py-3">Night Dish</th>
                <th className="px-4 py-3">🍽️ Dinner Count</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.day}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{row.morning_dish}</td>
                  <td className="px-4 py-3 font-bold text-amber-700">{row.morning_tiffin_count}</td>
                  <td className="px-4 py-3 font-bold text-indigo-700">{row.morning_box_count}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{row.night_dish}</td>
                  <td className="px-4 py-3 font-bold text-purple-700">{row.night_meal_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.morning_status === 'VERIFIED & LOCKED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.morning_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FoodAllocationPage;
