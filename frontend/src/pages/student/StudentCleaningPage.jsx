import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Sparkles,
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
  ShieldCheck,
  MessageSquare,
  Bed,
  Calendar,
  UserCheck,
  AlertCircle,
  RotateCcw
} from 'lucide-react';

const StudentCleaningPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Report issue modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueDesc, setIssueDesc] = useState('');
  const [issuePriority, setIssuePriority] = useState('NORMAL');
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [issueNotice, setIssueNotice] = useState('');

  const fetchCleaningInfo = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.get('/cleaning/my-room');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load room cleaning data:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCleaningInfo();
    const interval = setInterval(() => {
      fetchCleaningInfo(true);
    }, 5000); // 5s live polling
    return () => clearInterval(interval);
  }, []);


  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueDesc.trim()) return;
    setSubmittingIssue(true);
    setIssueNotice('');
    try {
      const res = await api.post('/cleaning/my-room/report-issue', {
        description: issueDesc,
        priority: issuePriority,
      });
      setIssueNotice(res.data.message || 'Issue reported successfully.');
      setIssueDesc('');
      setShowIssueModal(false);
      await fetchCleaningInfo(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to report issue.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-3"></div>
        <p className="text-xs font-medium">Loading room cleaning status...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-800">No Room Allocated</p>
        <p className="text-xs text-slate-400 mt-1">
          Cleaning management is available once you are allocated to a hostel room.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'in progress':
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            In Progress
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {data.room_number} Housekeeping & Sanitation
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Live cleaning schedule, real-time sanitation status, hygiene feedback, and maintenance reporting.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowIssueModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Cleaning Issue
          </button>
          <button
            onClick={() => fetchCleaningInfo()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {issueNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {issueNotice}
        </div>
      )}

      {/* Main Status Hero Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-md">
              <Bed className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-900">{data.room_number}</span>
                {getStatusBadge(data.current_status)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Assigned Scheduled Duty Day: <strong className="text-slate-800">{data.assigned_day}</strong>
                {data.is_today_duty && (
                  <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                    Today's Duty
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Assigned Staff</span>
              <span className="font-bold text-slate-800">
                {data.today_task?.assigned_staff || 'Housekeeping Team'}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Cleaning Type</span>
              <span className="font-bold text-slate-800">
                {data.today_task?.cleaning_type || 'Daily Sanitation'}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Last Cleaned</span>
              <span className="font-bold text-slate-800">
                {data.last_cleaned || 'Recently Recorded'}
              </span>
            </div>
          </div>
        </div>

        {/* Task Details & Progress */}
        <div className="pt-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Today's Cleaning Specification
            </h3>
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-bold text-slate-800">{data.today_date} ({data.day_name})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scheduled Time:</span>
                <span className="font-bold text-slate-800">{data.today_task?.time || '10:00 AM - 12:30 PM'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hygiene Scope:</span>
                <span className="font-bold text-slate-800">Floor Disinfection, Dusting & Restroom</span>
              </div>
              {data.today_task?.notes && (
                <div className="pt-2 border-t border-blue-100 text-slate-600">
                  <strong>Notes:</strong> {data.today_task.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cleaning History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>Cleaning History for {data.room_number}</span>
        </h3>

        {(!data.history || data.history.length === 0) ? (
          <p className="text-xs text-slate-400 py-4 text-center">No past cleaning records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Cleaning Type</th>
                  <th className="py-2.5 px-3">Staff</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Student Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {h.date} {h.time && <span className="text-slate-400 text-[10px]">({h.time})</span>}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {h.cleaning_type || 'Daily Sanitation'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {h.assigned_staff || 'Housekeeping'}
                    </td>
                    <td className="py-3 px-3">
                      {getStatusBadge(h.status)}
                    </td>
                    <td className="py-3 px-3">
                      {h.student_rating ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {h.student_rating}/5
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not rated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-extrabold text-slate-900">Report Cleaning Issue</h3>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReportIssue} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Room</label>
                <input
                  type="text"
                  readOnly
                  value={data.room_number}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Priority</label>
                <select
                  value={issuePriority}
                  onChange={(e) => setIssuePriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent (Requires Immediate Attention)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Describe Issue</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Bathroom floor not properly disinfected, dust behind beds..."
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition cursor-pointer"
                >
                  {submittingIssue ? 'Submitting...' : 'Submit Report'}
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
