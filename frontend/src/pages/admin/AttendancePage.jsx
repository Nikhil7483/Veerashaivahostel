import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { useNotification } from '../../context/NotificationContext';
import {
  CalendarCheck,
  Check,
  X,
  Plane,
  Save,
  Calendar,
  Filter,
  FileSpreadsheet,
  Printer,
  FileText,
  CheckCircle2,
  UserX,
  Building,
  RefreshCw,
  Edit2
} from 'lucide-react';

const AttendancePage = () => {
  const { toast } = useNotification();
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'report'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [submittedStats, setSubmittedStats] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Daily Report State
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const roomsList = Array.from({ length: 13 }, (_, i) => `Room ${(i + 1).toString().padStart(2, '0')}`);

  const loadRegisterData = async () => {
    setLoading(true);
    setSaveMessage('');
    try {
      // 1. Fetch active students
      const studRes = await api.get('/students?status=ACTIVE');
      const allStudents = studRes.data;
      setStudents(allStudents);

      // 2. Fetch existing attendance for selectedDate
      const attRes = await api.get(`/attendance?date=${selectedDate}`);
      const map = {};
      attRes.data.forEach((rec) => {
        map[rec.student_id] = rec.status;
      });

      // Default unmarked to PRESENT
      allStudents.forEach((s) => {
        if (!map[s.student_id]) {
          map[s.student_id] = 'PRESENT';
        }
      });
      setAttendanceMap(map);

      // 3. Fetch summary
      const sumRes = await api.get(`/attendance/summary/today?date=${selectedDate}`);
      setSummary(sumRes.data);

      const alreadyRecorded = attRes.data.length > 0;
      setIsSubmitted(alreadyRecorded);
      setIsEditing(!alreadyRecorded);

      if (alreadyRecorded && sumRes.data) {
        setSubmittedStats({
          date: selectedDate,
          total: sumRes.data.total_students,
          present: sumRes.data.present,
          absent: sumRes.data.absent,
        });
      } else {
        setSubmittedStats(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async () => {
    setLoadingReport(true);
    try {
      const res = await api.get(`/attendance/daily-report?date=${reportDate}`);
      setReportData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'register') {
      loadRegisterData();
    } else {
      loadReportData();
    }
  }, [selectedDate, reportDate, activeTab]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleMarkAll = (status) => {
    const updated = {};
    students.forEach((s) => {
      updated[s.student_id] = status;
    });
    setAttendanceMap(updated);
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const records = Object.keys(attendanceMap).map((sid) => ({
        student_id: sid,
        status: attendanceMap[sid],
        remarks: '',
      }));

      const res = await api.post('/attendance/batch', {
        date: selectedDate,
        records,
      });

      const total = res.data?.total ?? students.length;
      const present = res.data?.present ?? Object.values(attendanceMap).filter((v) => v === 'PRESENT').length;
      const absent = res.data?.absent ?? Math.max(0, total - present);

      setSubmittedStats({
        date: selectedDate,
        total,
        present,
        absent,
      });
      setIsSubmitted(true);
      setIsEditing(false);

      setSaveMessage(`✅ Final Attendance for ${formatDate(selectedDate)} submitted successfully!`);
      toast.success(`Final Attendance for ${formatDate(selectedDate)} submitted successfully!`);
      const sumRes = await api.get(`/attendance/summary/today?date=${selectedDate}`);
      setSummary(sumRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit final attendance.');
    } finally {
      setSaving(false);
    }
  };

  // Export Daily Report to CSV
  const handleExportCSV = () => {
    if (!reportData || !reportData.rooms) return;

    const rows = [
      ['Date', 'Room Number', 'Student ID', 'Student Name', 'USN', 'Bed Number', 'Department', 'Phone', 'Attendance Status']
    ];

    reportData.rooms.forEach((r) => {
      const allInRoom = [
        ...r.present_students,
        ...r.absent_students,
        ...r.leave_students,
        ...r.unmarked_students
      ];

      if (allInRoom.length === 0) {
        rows.push([reportData.date, r.room_number, 'N/A', 'Vacant Room', 'N/A', 'N/A', 'N/A', 'N/A', 'VACANT']);
      } else {
        allInRoom.forEach((s) => {
          rows.push([
            reportData.date,
            r.room_number,
            s.student_id,
            s.name,
            s.usn,
            s.bed_number,
            s.department || '',
            s.phone || '',
            s.status
          ]);
        });
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Hostel_Daily_Attendance_Report_${reportData.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = selectedRoom
    ? students.filter((s) => s.room_number === selectedRoom)
    : students;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hostel Attendance Register</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Daily resident check-in roll call &bull; Every day attendance report &bull; Room-by-room absence tracking.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-200/80 rounded-2xl">
          <button
            onClick={() => setActiveTab('register')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            <span>Roll Call Register</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'report'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-600" />
            <span>Every Day Attendance Report</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY ROLL CALL REGISTER                                          */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-6">
          {saveMessage && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveMessage}</span>
              </div>
              <button onClick={() => setSaveMessage('')} className="text-emerald-700 font-black">
                &times;
              </button>
            </div>
          )}

          {/* Date & Filter Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <label className="text-xs font-bold text-slate-700">Roll Call Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-slate-50"
                />
              </div>

              {(!isSubmitted || isEditing) && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    className="text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">All 13 Rooms ({students.length} Students)</option>
                    {roomsList.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Batch Actions & Save or Edit */}
            <div className="flex items-center space-x-2">
              {isSubmitted && !isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                  <span>Edit / Re-mark Roll Call</span>
                </button>
              ) : (
                <>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Set All:</span>
                  <button
                    onClick={() => handleMarkAll('PRESENT')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                  >
                    All Present
                  </button>
                  <button
                    onClick={() => handleMarkAll('ABSENT')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition"
                  >
                    All Absent
                  </button>

                  {isSubmitted && (
                    <button
                      onClick={() => setIsEditing(false)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      Cancel
                    </button>
                  )}

                  <button
                    onClick={handleSaveAttendance}
                    disabled={saving}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Submitting...' : 'Submit Final Attendance'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* AFTER FINAL ATTENDANCE COMPLETION: ONLY SHOW TOTAL, PRESENT, AND ABSENT (NO TABLE) */}
          {isSubmitted && !isEditing ? (
            <div className="space-y-6">
              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Attendance Completed
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {formatDate(selectedDate)}
                        </span>
                      </div>
                      <h2 className="text-lg font-black text-slate-900 mt-1">
                        Daily Roll Call Finalized
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center space-x-2 border border-slate-200"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Modify Attendance</span>
                  </button>
                </div>

                {/* ONLY SHOW TOTAL, PRESENT, AND ABSENT */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                    <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Total Residents</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">
                      {summary?.total_students || submittedStats?.total || students.length}
                    </p>
                  </div>
                  <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                    <p className="text-xs uppercase font-bold text-emerald-600 tracking-wider">Present</p>
                    <p className="text-3xl font-black text-emerald-800 mt-1">
                      {summary?.present ?? submittedStats?.present ?? 0}
                    </p>
                  </div>
                  <div className="p-5 bg-red-50 rounded-2xl border border-red-200 text-center">
                    <p className="text-xs uppercase font-bold text-red-600 tracking-wider">Absent</p>
                    <p className="text-3xl font-black text-red-800 mt-1">
                      {summary?.absent ?? submittedStats?.absent ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* EDITING / MARKING MODE: SHOWS REGISTER TABLE WITH PRESENT, ABSENT, AND LEAVE */
            <div className="space-y-6">
              {/* Summary KPI Counters */}
              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200 text-center shadow-2xs">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Total Residents</p>
                    <p className="text-2xl font-black text-slate-800">{summary.total_students}</p>
                  </div>
                  <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center shadow-2xs">
                    <p className="text-[10px] uppercase font-bold text-emerald-600">Present</p>
                    <p className="text-2xl font-black text-emerald-800">{summary.present}</p>
                  </div>
                  <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 text-center shadow-2xs">
                    <p className="text-[10px] uppercase font-bold text-red-600">Absent</p>
                    <p className="text-2xl font-black text-red-800">{summary.absent}</p>
                  </div>
                </div>
              )}

              {/* Attendance Register Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center text-xs text-slate-400">Loading register...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">No students found for selected filter.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">USN / ID</th>
                          <th className="px-4 py-3">Room & Bed</th>
                          <th className="px-4 py-3 text-center">Status Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((s) => {
                          const currentStatus = attendanceMap[s.student_id] || 'PRESENT';

                          return (
                            <tr key={s.id} className="hover:bg-slate-50/60 transition">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">{s.name}</div>
                                <div className="text-[10px] text-slate-400">{s.department} Sem {s.semester}</div>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-700">
                                {s.usn}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {s.room_number} - {s.bed_number}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(s.student_id, 'PRESENT')}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1 transition ${
                                      currentStatus === 'PRESENT'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Present</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(s.student_id, 'ABSENT')}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1 transition ${
                                      currentStatus === 'ABSENT'
                                        ? 'bg-red-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'
                                    }`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Absent</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(s.student_id, 'LEAVE')}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1 transition ${
                                      currentStatus === 'LEAVE'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                                    }`}
                                  >
                                    <Plane className="w-3.5 h-3.5" />
                                    <span>Leave</span>
                                  </button>
                                </div>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EVERY DAY ATTENDANCE REPORT                                        */}
      {/* ========================================================================= */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <label className="text-xs font-bold text-slate-700">Report Date:</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="text-xs font-bold px-3 py-2 border border-slate-300 rounded-xl bg-purple-50/50 text-slate-800"
                />
              </div>

              <button
                onClick={() => setReportDate(new Date().toISOString().split('T')[0])}
                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Today
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadReportData}
                disabled={loadingReport}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                title="Refresh Report"
              >
                <RefreshCw className={`w-4 h-4 ${loadingReport ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => window.print()}
                className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          {/* Report Content */}
          {loadingReport ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
              Generating everyday attendance report for {formatDate(reportDate)}...
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {/* Report Summary Header Card */}
              <div className="p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/10">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-300 block">
                      Daily Roll Call Audit & Attendance Report
                    </span>
                    <h2 className="text-xl font-black text-white">
                      Hostel Daily Attendance Summary &bull; {formatDate(reportData.date)}
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-purple-200 block">Overall Attendance Rate</span>
                    <span className="text-2xl font-black text-emerald-400">
                      {reportData.attendance_rate}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-white/10 rounded-2xl text-center border border-white/10">
                    <p className="text-[10px] uppercase font-bold text-slate-300">Total Residents</p>
                    <p className="text-2xl font-black text-white">{reportData.total_students}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/20 rounded-2xl text-center border border-emerald-400/30">
                    <p className="text-[10px] uppercase font-bold text-emerald-300">Present in Hostel</p>
                    <p className="text-2xl font-black text-emerald-300">{reportData.total_present}</p>
                  </div>
                  <div className="p-3 bg-rose-500/20 rounded-2xl text-center border border-rose-400/30">
                    <p className="text-[10px] uppercase font-bold text-rose-300">Absent</p>
                    <p className="text-2xl font-black text-rose-300">{reportData.total_absent}</p>
                  </div>
                </div>
              </div>

              {/* Room-by-Room Breakdown Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                    <Building className="w-4 h-4 text-purple-600" />
                    <span>Room-by-Room Daily Attendance Roster (13 Rooms)</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    {reportData.rooms?.filter((r) => r.has_absent).length || 0} Rooms with Absences
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportData.rooms?.map((room) => {
                    const isVacant = room.is_vacant;
                    const hasAbsent = room.has_absent;

                    return (
                      <div
                        key={room.room_number}
                        className={`p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between space-y-3 ${
                          isVacant
                            ? 'bg-slate-50/70 border-dashed border-slate-300 opacity-75'
                            : hasAbsent
                            ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-400/20 shadow-xs'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-2.5">
                          {/* Room Card Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div>
                              <span className="font-black text-slate-900 text-sm block">
                                {room.room_number}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {isVacant ? 'Vacant Room' : `${room.occupied_beds} Residents Assigned`}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                isVacant
                                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                                  : hasAbsent
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {isVacant
                                ? 'VACANT'
                                : hasAbsent
                                ? `${room.absent_count} ABSENT`
                                : 'ALL PRESENT'}
                            </span>
                          </div>

                          {/* Quick Counters: Present & Absent only */}
                          {!isVacant && (
                            <div className="grid grid-cols-2 gap-1.5 text-center text-[10px]">
                              <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-800 font-bold border border-emerald-100">
                                <span>{room.present_count} Present</span>
                              </div>
                              <div className={`p-1.5 rounded-lg font-bold border ${
                                room.absent_count > 0
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-100'
                              }`}>
                                <span>{room.absent_count} Absent</span>
                              </div>
                            </div>
                          )}

                          {/* Absent Resident Alerts */}
                          {hasAbsent && (
                            <div className="p-2.5 bg-red-50/90 rounded-xl border border-red-200 space-y-1">
                              <div className="flex items-center space-x-1 text-[11px] font-bold text-red-800">
                                <UserX className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span>Absent Residents:</span>
                              </div>
                              <div className="space-y-0.5">
                                {room.absent_students.map((s) => (
                                  <div key={s.student_id} className="text-[10px] text-red-900 flex justify-between">
                                    <span className="font-semibold">{s.name} ({s.bed_number})</span>
                                    <span className="font-mono text-[9px] text-red-700">{s.phone}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Present Resident Pill List */}
                          {!isVacant && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Present Residents:
                              </span>
                              {room.present_students.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">None present</p>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {room.present_students.map((s) => (
                                    <span
                                      key={s.student_id}
                                      className="px-2 py-0.5 bg-slate-50 text-slate-700 font-medium text-[10px] rounded-md border border-slate-200 truncate max-w-[150px]"
                                      title={`${s.name} (${s.bed_number})`}
                                    >
                                      {s.name} ({s.bed_number})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {isVacant && (
                            <p className="text-xs text-slate-400 italic py-2 text-center">
                              Room 03 is vacant. 0 residents allocated.
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                          <span>Capacity: {room.total_beds} Beds</span>
                          <span>{isVacant ? '0% Occupancy' : `${Math.round((room.occupied_beds / room.total_beds) * 100)}% Occupancy`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
