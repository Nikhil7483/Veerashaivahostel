import React, { useState } from 'react';
import api from '../../services/api';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Users,
  CalendarCheck,
  Ticket,
  Bed,
  ClipboardList,
  Calendar,
  Sparkles
} from 'lucide-react';

const ReportsPage = () => {
  const [downloading, setDownloading] = useState({});
  const [wardenDate, setWardenDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const downloadReport = async (module, format, params = '') => {
    const key = `${module}-${format}`;
    setDownloading((prev) => ({ ...prev, [key]: true }));

    try {
      const response = await api.get(`/reports/${module}?format=${format}${params}`, {
        responseType: 'blob',
      });

      const mimeType =
        format === 'pdf'
          ? 'application/pdf'
          : format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv';

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smart_hostel_${module}_report.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate report. Please try again.');
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const downloadDailyWardenReport = async () => {
    const key = 'daily-warden-pdf';
    setDownloading((prev) => ({ ...prev, [key]: true }));

    try {
      const response = await api.get(`/reports/daily-warden?date=${wardenDate}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `daily_warden_report_${wardenDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate Daily Warden Report. Please try again.');
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const reportModules = [
    {
      id: 'students',
      title: 'Students Master Directory',
      description: 'Complete student roll, USN, contact numbers, department, assigned room & bed.',
      icon: Users,
      color: 'blue',
    },
    {
      id: 'attendance',
      title: 'Hostel Attendance Register',
      description: 'Historical attendance logs, student attendance records, daily roll call breakdown.',
      icon: CalendarCheck,
      color: 'emerald',
    },
    {
      id: 'complaints',
      title: 'Complaints & Resolution Audit',
      description: 'All tickets (HTL-XXXX), category breakdown, SLA overdue logs, and technician assignments.',
      icon: Ticket,
      color: 'amber',
    },
    {
      id: 'rooms',
      title: '13 Rooms Occupancy Status',
      description: 'Room 01 to Room 13 capacity, occupied/free beds, and sanitation schedule audit.',
      icon: Bed,
      color: 'indigo',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reports & Data Export Center</h1>
        <p className="text-xs text-slate-500 font-medium">
          Generate formal PDF documents (ReportLab) and Excel spreadsheets (openpyxl) for college administration.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════
          DAILY WARDEN REPORT — HERO CARD
          ═══════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-3xl border border-blue-800/40 shadow-xl p-6 sm:p-8">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl -ml-10 -mb-10" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-black text-white tracking-tight">Daily Warden Report</h2>
                  <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-[10px] font-extrabold text-blue-300 uppercase tracking-wider flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Comprehensive</span>
                  </span>
                </div>
                <p className="text-blue-300/80 text-xs font-medium mt-0.5">All-in-one daily activity summary</p>
              </div>
            </div>

            <p className="text-blue-200/70 text-xs leading-relaxed max-w-xl">
              Generate a single professional PDF covering <strong className="text-white">all daily warden tasks</strong> — Attendance Roll Call, Room Cleaning & Sanitation, Leave Applications, Food & Meal Allocation, Complaints, Maintenance, Visitor Log, Announcements, and Audit Trail — organized by section with color-coded statuses, KPI summaries, and an official sign-off block.
            </p>

            {/* Task sections preview */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'Attendance', 'Cleaning', 'Leaves', 'Food & Meals',
                'Complaints', 'Maintenance', 'Visitors', 'Announcements', 'Audit Trail'
              ].map((section) => (
                <span
                  key={section}
                  className="px-2 py-0.5 bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-blue-200/80"
                >
                  {section}
                </span>
              ))}
            </div>
          </div>

          {/* Date picker + Download */}
          <div className="flex flex-col items-start lg:items-end space-y-3 shrink-0">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-blue-300/80 uppercase tracking-wider block">
                Select Report Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <input
                  type="date"
                  value={wardenDate}
                  onChange={(e) => setWardenDate(e.target.value)}
                  className="pl-9 pr-4 py-2.5 bg-white/10 border border-blue-500/30 rounded-xl text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 backdrop-blur-sm w-52"
                />
              </div>
            </div>

            <button
              onClick={downloadDailyWardenReport}
              disabled={downloading['daily-warden-pdf']}
              className="w-52 py-3 px-5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white rounded-xl text-sm font-extrabold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/30 hover:shadow-blue-400/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
            >
              {downloading['daily-warden-pdf'] ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Download Report PDF</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-blue-400/60 font-medium text-right">
              A4 Landscape • Multi-page • Printable
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          INDIVIDUAL MODULE REPORTS
          ═══════════════════════════════════════════════════════ */}
      <div className="pt-2">
        <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <span className="w-8 h-[2px] bg-slate-300 rounded-full" />
          <span>Individual Module Exports</span>
          <span className="w-8 h-[2px] bg-slate-300 rounded-full" />
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reportModules.map((m) => {
          const Icon = m.icon;

          return (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{m.title}</h3>
                    <p className="text-[11px] text-slate-400">Institutional Record Export</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-normal pt-1">
                  {m.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => downloadReport(m.id, 'pdf')}
                  disabled={downloading[`${m.id}-pdf`]}
                  className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{downloading[`${m.id}-pdf`] ? 'Building...' : 'Export PDF'}</span>
                </button>

                <button
                  onClick={() => downloadReport(m.id, 'excel')}
                  disabled={downloading[`${m.id}-excel`]}
                  className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{downloading[`${m.id}-excel`] ? 'Building...' : 'Export Excel'}</span>
                </button>

                <button
                  onClick={() => downloadReport(m.id, 'csv')}
                  disabled={downloading[`${m.id}-csv`]}
                  className="py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReportsPage;
