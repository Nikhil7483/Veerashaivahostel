import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateUtils';
import {
  UtensilsCrossed,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  AlertCircle,
  Search,
  Coffee,
  Moon,
  ShieldCheck,
  Building2,
  Lock,
  Check,
  RotateCcw,
  Download,
  Printer
} from 'lucide-react';

const KitchenMealOrderPage = () => {
  const { user, isAdmin } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Verification form state
  const defaultVerifier = user?.name 
    ? `${user.name} (${isAdmin ? 'Warden' : (user.student_profile?.room_number ? `${user.student_profile.room_number} Cleaning Duty` : 'Cleaning Staff')})`
    : 'Cleaning Room Staff';
  const [verifierName, setVerifierName] = useState(defaultVerifier);
  const [remarks, setRemarks] = useState('');

  // Table filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchKitchenOrder = async (dateStr) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/food-allocation/kitchen-order/${dateStr}`);
      setData(res.data);
      if (res.data?.verified_order) {
        setVerifierName(res.data.verified_order.verified_by || defaultVerifier);
        setRemarks(res.data.verified_order.remarks || '');
      } else {
        setRemarks('');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load kitchen meal order for the selected date.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKitchenOrder(selectedDate);
  }, [selectedDate]);

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
      link.setAttribute('download', `Lingayath_Hostel_Meal_Count_${formattedDate}.pdf`);
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

  // Toggle individual student verification (Rule #9)
  const handleToggleVerification = async (studentId, mealType) => {
    if (data?.is_locked) return;

    const student = data.students.find((s) => s.student_id === studentId);
    if (!student || student.attendance_status !== 'PRESENT') return;

    const newMorning = mealType === 'morning' ? !student.morning_verified : student.morning_verified;
    const newNight = mealType === 'night' ? !student.night_verified : student.night_verified;

    // Optimistic UI update
    setData((prev) => {
      const updatedStudents = prev.students.map((s) => {
        if (s.student_id === studentId) {
          const isVer = newMorning || newNight;
          return {
            ...s,
            morning_verified: newMorning,
            night_verified: newNight,
            verification_status: isVer ? 'Verified' : 'Pending'
          };
        }
        return s;
      });

      const mCount = updatedStudents.filter((s) => s.attendance_status === 'PRESENT' && s.morning_verified).length;
      const nCount = updatedStudents.filter((s) => s.attendance_status === 'PRESENT' && s.night_verified).length;

      return {
        ...prev,
        students: updatedStudents,
        morning_verified_count: mCount,
        night_verified_count: nCount,
        morning_meal_order: mCount,
        night_meal_order: nCount
      };
    });

    try {
      await api.post('/food-allocation/verify-student', {
        date: selectedDate,
        student_id: studentId,
        morning_verified: newMorning,
        night_verified: newNight
      });
    } catch (err) {
      console.error(err);
      // Revert on error
      fetchKitchenOrder(selectedDate);
    }
  };

  // Quick verify all requested
  const handleVerifyAllRequested = async () => {
    if (data?.is_locked) return;
    setBatchVerifying(true);
    try {
      await api.post('/food-allocation/verify-all', { date: selectedDate });
      await fetchKitchenOrder(selectedDate);
      setSuccessMsg('✓ All student meal requests verified successfully by Cleaning Room.');
    } catch (err) {
      setErrorMsg('Failed to batch verify requests.');
    } finally {
      setBatchVerifying(false);
    }
  };

  // Submit Final Kitchen Verification (Rule #12)
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.post('/food-allocation/verify-kitchen-order', {
        date: selectedDate,
        verified_by: verifierName.trim() || 'Cleaning Room Staff',
        remarks: remarks.trim()
      });
      setSuccessMsg(`✓ Kitchen Meal Order Verified & Locked for ${formatDate(selectedDate)}!`);
      fetchKitchenOrder(selectedDate);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to submit kitchen verification.');
    } finally {
      setVerifying(false);
    }
  };

  const filteredStudents = (data?.students || []).filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.room_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PRESENT' && s.attendance_status === 'PRESENT') ||
      (statusFilter === 'ABSENT' && s.attendance_status === 'ABSENT') ||
      (statusFilter === 'LEAVE' && s.attendance_status === 'LEAVE') ||
      (statusFilter === 'VERIFIED' && s.verification_status === 'Verified');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              <span>Veerashaiva Lingayath Boys Hostel &bull; Shivamogga</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Daily Kitchen Meal Order & Attendance Verification
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Cleaning Room takes the final count. Present student &ne; Meal Required.
            </p>
          </div>

          {/* Date Picker & PDF Download Buttons */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <div className="flex items-center space-x-3 bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700">
              <Calendar className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400">Order Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              title="Download official printable PDF meal count roster"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handleViewPrintPdf}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Print / View PDF Report"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 font-black">
            &times;
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-sm font-bold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-700 hover:text-red-900 font-black">
            &times;
          </button>
        </div>
      )}

      {/* Allocated Dishes Banner (Warden Controlled - Read Only) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <UtensilsCrossed className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-black text-slate-900">
              Allocated Menu for {data?.day || 'Today'} ({formatDate(selectedDate)})
            </h2>
          </div>
          <span className="text-[11px] bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold border border-slate-200 self-start sm:self-auto">
            🔒 Warden Allocated &bull; Read Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Allocated Morning Dish */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                <Coffee className="w-4 h-4 text-amber-600" /> Allocated Morning Dish (Breakfast)
              </span>
              <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 7:00 – 8:00 AM
              </span>
            </div>
            <p className="text-base font-extrabold text-slate-900 mt-1">
              {data?.morning_dish || 'Loading...'}
            </p>
          </div>

          {/* Allocated Night Dish */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-indigo-600" /> Allocated Night Dish (Dinner)
              </span>
              <span className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 8:00 – 9:00 PM
              </span>
            </div>
            <p className="text-base font-extrabold text-slate-900 mt-1">
              {data?.night_dish || 'Loading...'}
            </p>
          </div>
        </div>
      </div>

      {/* 8. CLEANING ROOM COUNT SCREEN: Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* TOTAL HOSTEL STUDENTS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>TOTAL HOSTEL STUDENTS</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900">{data?.total_students ?? 64}</span>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">13 Rooms Total</p>
          </div>
        </div>

        {/* PRESENT */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
            <span>PRESENT</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-700">{data?.present_count ?? 21}</span>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Attendance Reference</p>
          </div>
        </div>

        {/* ON LEAVE */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
            <span>ON LEAVE</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-amber-600">{data?.leave_count ?? 2}</span>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Excluded from Meals</p>
          </div>
        </div>

        {/* ABSENT */}
        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-800 text-xs font-bold">
            <span>ABSENT</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-red-600">{data?.absent_count ?? 41}</span>
            <p className="text-[11px] text-red-600 font-medium mt-0.5">Excluded from Meals</p>
          </div>
        </div>
      </div>

      {/* MEAL BREAKDOWN & FINAL KITCHEN ORDER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 🌅 MORNING MEAL */}
        <div className="p-5 rounded-3xl bg-amber-50/60 border border-amber-200 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-amber-950 tracking-wider flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-600" /> 🌅 MORNING MEAL
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-200 text-amber-900">
              Breakfast
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Requested:</span>
              <span className="font-bold text-slate-800">{data?.morning_requested_count ?? 15}</span>
            </div>
            <div className="flex justify-between text-xs text-amber-900">
              <span>Verified by Cleaning Room:</span>
              <span className="font-black text-sm text-amber-800">{data?.morning_verified_count ?? 13}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-amber-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Morning Meal Order:</span>
            <span className="text-2xl font-black text-amber-900 font-mono">
              {data?.morning_meal_order ?? 13}
            </span>
          </div>
        </div>

        {/* 🌙 NIGHT MEAL */}
        <div className="p-5 rounded-3xl bg-indigo-50/60 border border-indigo-200 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-indigo-600" /> 🌙 NIGHT MEAL
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-indigo-200 text-indigo-900">
              Dinner
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Requested:</span>
              <span className="font-bold text-slate-800">{data?.night_requested_count ?? 18}</span>
            </div>
            <div className="flex justify-between text-xs text-indigo-900">
              <span>Verified by Cleaning Room:</span>
              <span className="font-black text-sm text-indigo-800">{data?.night_verified_count ?? 16}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-indigo-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Night Meal Order:</span>
            <span className="text-2xl font-black text-indigo-900 font-mono">
              {data?.night_meal_order ?? 16}
            </span>
          </div>
        </div>

        {/* FINAL KITCHEN ORDER SUMMARY */}
        <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-md border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> FINAL KITCHEN ORDER
            </span>
            {data?.is_locked ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verified & Locked
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Pending Verification
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">Morning Order</span>
              <span className="text-2xl font-black text-white block mt-0.5">
                {data?.morning_meal_order ?? 13}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block">Night Order</span>
              <span className="text-2xl font-black text-white block mt-0.5">
                {data?.night_meal_order ?? 16}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center font-medium">
            Calculated strictly from Cleaning Room verification.
          </p>
        </div>
      </div>

      {/* 6 & 9. STUDENT VERIFICATION TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Student Meal Verification & Headcount ({data?.students?.length || 64} Students)
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cleaning Room verifies whether present students require meals. Absent/Leave students are excluded.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick action to verify all */}
            {!data?.is_locked && (
              <button
                type="button"
                onClick={handleVerifyAllRequested}
                disabled={batchVerifying}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{batchVerifying ? 'Verifying...' : 'Verify All Requested'}</span>
              </button>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student, room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
              />
            </div>

            {/* Filter Tabs */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5 text-xs font-bold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({data?.total_students ?? 64})
              </button>
              <button
                onClick={() => setStatusFilter('PRESENT')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'PRESENT' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                Present ({data?.present_count ?? 21})
              </button>
              <button
                onClick={() => setStatusFilter('VERIFIED')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'VERIFIED' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                Verified
              </button>
              <button
                onClick={() => setStatusFilter('LEAVE')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'LEAVE' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                Leave ({data?.leave_count ?? 2})
              </button>
              <button
                onClick={() => setStatusFilter('ABSENT')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'ABSENT' ? 'bg-red-600 text-white shadow-2xs' : 'text-red-700 hover:text-red-900'
                }`}
              >
                Absent ({data?.absent_count ?? 41})
              </button>
            </div>
          </div>
        </div>

        {/* Table / Cards Container */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold">Loading verification records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4 text-center">Morning Req</th>
                  <th className="py-3 px-4 text-center">Night Req</th>
                  <th className="py-3 px-4 text-center">Morning Verification</th>
                  <th className="py-3 px-4 text-center">Night Verification</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredStudents.map((s, idx) => {
                  const isPresent = s.attendance_status === 'PRESENT';
                  return (
                    <tr
                      key={s.student_id}
                      className={`hover:bg-slate-50/80 transition ${
                        isPresent ? 'bg-white' : 'bg-slate-50/40 opacity-75'
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-slate-900 block">{s.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.student_id}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {s.room_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          s.attendance_status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.attendance_status === 'LEAVE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {s.attendance_status}
                        </span>
                      </td>

                      {/* Morning Requested */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          s.morning_required ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {s.morning_required ? 'YES' : 'NO'}
                        </span>
                      </td>

                      {/* Night Requested */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          s.night_required ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {s.night_required ? 'YES' : 'NO'}
                        </span>
                      </td>

                      {/* Morning Verification Action (Rule #9) */}
                      <td className="py-3 px-4 text-center">
                        {isPresent ? (
                          <button
                            type="button"
                            disabled={data?.is_locked}
                            onClick={() => handleToggleVerification(s.student_id, 'morning')}
                            className={`px-3 py-1 rounded-xl text-[11px] font-bold transition ${
                              s.morning_verified
                                ? 'bg-amber-500 text-white shadow-2xs hover:bg-amber-600'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            } disabled:cursor-not-allowed`}
                          >
                            {s.morning_verified ? 'Required ✓' : 'Not Required'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Night Verification Action (Rule #9) */}
                      <td className="py-3 px-4 text-center">
                        {isPresent ? (
                          <button
                            type="button"
                            disabled={data?.is_locked}
                            onClick={() => handleToggleVerification(s.student_id, 'night')}
                            className={`px-3 py-1 rounded-xl text-[11px] font-bold transition ${
                              s.night_verified
                                ? 'bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            } disabled:cursor-not-allowed`}
                          >
                            {s.night_verified ? 'Required ✓' : 'Not Required'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Verification Status */}
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          s.verification_status === 'Verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.verification_status === 'Pending'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {s.verification_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 12. CLEANING ROOM SUBMISSION (Locks Verification) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Submit Kitchen Verification</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Final submission generates the official Kitchen Meal Order. Locks count against accidental changes.
            </p>
          </div>
          {data?.is_locked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Verified & Locked</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Pending Final Submission</span>
            </span>
          )}
        </div>

        <form onSubmit={handleFinalSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Morning Meal Order Display */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
              <label className="block text-[10px] font-extrabold uppercase text-amber-900 tracking-wide">
                Morning Meal Order
              </label>
              <div className="text-2xl font-black text-amber-950 font-mono mt-0.5">
                {data?.morning_meal_order ?? 13}
              </div>
              <span className="text-[10px] text-amber-700">Verified by Cleaning Room</span>
            </div>

            {/* Night Meal Order Display */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
              <label className="block text-[10px] font-extrabold uppercase text-indigo-900 tracking-wide">
                Night Meal Order
              </label>
              <div className="text-2xl font-black text-indigo-950 font-mono mt-0.5">
                {data?.night_meal_order ?? 16}
              </div>
              <span className="text-[10px] text-indigo-700">Verified by Cleaning Room</span>
            </div>

            {/* Verified By */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Verified By
              </label>
              <input
                type="text"
                required
                disabled={data?.is_locked}
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                placeholder="Cleaning Staff Name"
                className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            {/* Kitchen Remarks */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kitchen Remarks / Notes
              </label>
              <input
                type="text"
                disabled={data?.is_locked}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {data?.is_locked
                ? 'Order is locked. Any corrections will be documented in the system audit log.'
                : 'Confirm that all room requirements have been verified before submitting.'}
            </div>

            {!data?.is_locked && (
              <button
                type="submit"
                disabled={verifying}
                className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Locking Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SUBMIT KITCHEN VERIFICATION</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default KitchenMealOrderPage;
