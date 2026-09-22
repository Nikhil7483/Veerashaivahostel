import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Filter } from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (moduleFilter) params.module = moduleFilter;
      const res = await api.get('/audit-logs', { params });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Security & System Audit Logs</h1>
          <p className="text-xs text-slate-500 font-medium">
            Immutable tracking of warden actions, room re-allocations, leave decisions, and escalations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden"
          >
            <option value="">All Modules</option>
            <option value="STUDENTS">Students</option>
            <option value="ROOMS">Rooms</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="LEAVES">Leaves</option>
            <option value="COMPLAINTS">Complaints</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="VISITORS">Visitors</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No audit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record ID</th>
                  <th className="px-4 py-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition font-medium">
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDateTime(l.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {l.admin_email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {l.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-700 font-mono text-[11px]">
                      {l.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">
                      {l.record_id}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-sm truncate">
                      {l.details || '-'}
                    </td>
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

export default AuditLogsPage;
