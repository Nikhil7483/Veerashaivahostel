import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Check, X, Plane } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const StudentAttendancePage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await api.get('/attendance/my/records');
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading attendance history...</div>;
  }

  const percentage = data?.percentage || 0;
  const isSatisfactory = percentage >= 75;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Attendance Records</h1>
        <p className="text-xs text-slate-500 font-medium">
          Personal check-in audit, overall compliance rate, and institutional 75% attendance benchmark.
        </p>
      </div>

      {/* Progress & Stats Card */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">Current Semester Attendance</p>
            <div className="flex items-baseline space-x-3 mt-1">
              <span className={`text-4xl font-black ${isSatisfactory ? 'text-emerald-600' : 'text-red-600'}`}>
                {percentage}%
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                isSatisfactory ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {isSatisfactory ? 'Eligible (>75%)' : 'Attendance Shortage (<75%)'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="text-center">
              <span className="text-slate-400 block text-[10px] uppercase">Total Marked</span>
              <span className="text-lg font-bold text-slate-800">{data?.total_days || 0}</span>
            </div>
            <div className="text-center">
              <span className="text-emerald-600 block text-[10px] uppercase">Present</span>
              <span className="text-lg font-bold text-emerald-800">{data?.present_days || 0}</span>
            </div>
            <div className="text-center">
              <span className="text-red-600 block text-[10px] uppercase">Absent</span>
              <span className="text-lg font-bold text-red-800">{data?.absent_days || 0}</span>
            </div>
            <div className="text-center">
              <span className="text-blue-600 block text-[10px] uppercase">Leave</span>
              <span className="text-lg font-bold text-blue-800">{data?.leave_days || 0}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            style={{ width: `${percentage}%` }}
            className={`h-full rounded-full transition-all duration-500 ${
              isSatisfactory ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          ></div>
        </div>
      </div>

      {/* Attendance List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Attendance Log Calendar</h3>
        </div>

        {data?.records?.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No attendance entries recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {data.records.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    r.status === 'PRESENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : r.status === 'LEAVE'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {r.status === 'PRESENT' ? (
                      <Check className="w-4 h-4" />
                    ) : r.status === 'LEAVE' ? (
                      <Plane className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{formatDate(r.date)}</span>
                    <span className="text-slate-400 block text-[11px] font-mono">
                      Logged by Warden: {r.marked_by}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs uppercase ${
                    r.status === 'PRESENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : r.status === 'LEAVE'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {r.status}
                  </span>
                  {r.remarks && <p className="text-[10px] text-slate-500 mt-0.5">{r.remarks}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAttendancePage;
