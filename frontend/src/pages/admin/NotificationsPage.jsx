import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Bell, CheckCheck, ShieldAlert } from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      fetchNotifs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notification Center</h1>
          <p className="text-xs text-slate-500 font-medium">
            System alerts, student leave submissions, ticket escalation events, and emergency notices.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="py-2 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
        >
          <CheckCheck className="w-4 h-4 text-blue-600" />
          <span>Mark All Read</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No notifications in your feed.</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 transition flex items-start space-x-3 text-xs ${
                !n.is_read ? 'bg-blue-50/40' : 'hover:bg-slate-50'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                n.type === 'EMERGENCY'
                  ? 'bg-red-600 text-white animate-pulse'
                  : n.type === 'WARNING'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {n.type === 'EMERGENCY' ? <ShieldAlert className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{n.title}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
