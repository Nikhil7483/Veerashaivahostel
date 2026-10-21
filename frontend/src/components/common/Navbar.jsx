import React, { useState, useEffect } from 'react';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/dateUtils';
import {
  getExistingPushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestPushAlert
} from '../../utils/pushNotifications';

const Navbar = ({ onMobileToggle }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  // Push Notifications on Phone State
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState('');

  const fetchNotifications = async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count')
      ]);
      setNotifications(notifsRes.data);
      setUnreadCount(countRes.data.unread_count);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 15000);

    // Check device push notification status
    getExistingPushSubscription().then((sub) => {
      setIsPushSubscribed(!!sub);
    });

    return () => clearInterval(interval);
  }, []);

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushStatusMessage('');
    try {
      if (isPushSubscribed) {
        await unsubscribeFromPushNotifications();
        setIsPushSubscribed(false);
        setPushStatusMessage('Phone push notifications disabled.');
      } else {
        await subscribeToPushNotifications();
        setIsPushSubscribed(true);
        setPushStatusMessage('🎉 Phone alerts active! Tap Test Alert below to verify.');
      }
    } catch (err) {
      setPushStatusMessage(err.message || 'Failed to update push status.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setPushLoading(true);
    try {
      const res = await sendTestPushAlert();
      setPushStatusMessage(res.message);
    } catch (err) {
      setPushStatusMessage('Failed to trigger test push alert.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      try {
        await api.put(`/notifications/${n.id}/read`);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }
    setShowNotifs(false);
    if (n.link) {
      navigate(n.link);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Mobile menu button & brand */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1 mr-2">
          <button
            onClick={onMobileToggle}
            className="md:hidden p-1.5 sm:p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-hidden shrink-0"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <Link
            to={user ? (isAdmin ? '/admin/dashboard' : '/student/dashboard') : '/login'}
            className="flex items-center space-x-2 hover:opacity-90 transition group cursor-pointer min-w-0"
            title="Go to Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-sm group-hover:scale-105 transition shrink-0">
              H
            </div>
            <div className="min-w-0 flex-1">
              {/* Full title for desktop / tablet */}
              <span className="hidden sm:block font-extrabold text-slate-900 tracking-tight text-sm sm:text-base leading-tight truncate">
                Veerashaiva Lingayath Boys Hostel <span className="text-rose-500 text-xs">❤️</span>
              </span>
              {/* Compact single-line title for phone screens */}
              <span className="sm:hidden font-extrabold text-slate-900 tracking-tight text-xs xs:text-sm leading-tight truncate block">
                Veerashaiva Hostel <span className="text-rose-500 text-[10px]">❤️</span>
              </span>
              <span className="hidden sm:block text-[10px] text-slate-500 font-medium tracking-wide truncate">
                12 Rooms • Krushi Nagar, Shivamogga
              </span>
              <span className="sm:hidden text-[9px] text-slate-500 font-medium tracking-wide truncate block">
                12 Rooms • Krushi Nagar
              </span>
            </div>
          </Link>
        </div>

        {/* Right side icons & user */}
        <div className="flex items-center space-x-1.5 sm:space-x-4 shrink-0">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-slate-800">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Phone Push Notifications Quick Card */}
                <div className="mx-3 my-2 p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      📱 Phone Alerts (PWA)
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isPushSubscribed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {isPushSubscribed ? 'Active' : 'Off'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-snug">
                    {isPushSubscribed
                      ? 'Duty & Leave alerts will buzz directly on your phone lock screen!'
                      : 'Get lock screen alerts when cleaning duty is assigned or leave is reviewed.'}
                  </p>

                  {pushStatusMessage && (
                    <div className="text-[10px] font-semibold text-blue-700 bg-white/90 p-1.5 rounded-lg border border-blue-100">
                      {pushStatusMessage}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={handleTogglePush}
                      disabled={pushLoading}
                      className={`py-1.5 px-3 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                        isPushSubscribed
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                    >
                      {pushLoading ? 'Updating...' : isPushSubscribed ? 'Turn Off' : 'Enable on Phone 🔔'}
                    </button>

                    {isPushSubscribed && (
                      <button
                        onClick={handleSendTestPush}
                        disabled={pushLoading}
                        className="py-1.5 px-3 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] transition cursor-pointer shadow-2xs"
                      >
                        Test Alert ⚡
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 text-xs hover:bg-slate-50 transition cursor-pointer ${
                          !n.is_read ? 'bg-blue-50/50 font-medium' : 'text-slate-600'
                        }`}
                        title={n.link ? `Go to ${n.link}` : 'Mark as read'}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            {n.title}
                          </span>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" title="Unread"></span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1 line-clamp-3 leading-relaxed">{n.message}</p>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                          <span>{formatDateTime(n.created_at)}</span>
                          {!n.is_read && (
                            <span className="text-blue-600 font-semibold text-[10px]">Tap to read</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Badge */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
            <Link
              to={isAdmin ? '/admin/profile' : '/student/profile'}
              className="hidden sm:flex items-center space-x-2 py-1 px-2 rounded-xl hover:bg-slate-100 transition group text-right"
              title="View & Edit Profile"
            >
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition leading-tight">
                  {user?.name || user?.email}
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {user?.role} &bull; Edit Profile
                </span>
              </div>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
