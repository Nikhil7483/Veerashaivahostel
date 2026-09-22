import React, { useState, useEffect } from 'react';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/dateUtils';

const Navbar = ({ onMobileToggle }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

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
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Mobile menu button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMobileToggle}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              H
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base block leading-none">
                Veerashaiva Lingayath Boys Hostel <span className="text-rose-500 text-xs">❤️</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                12 Rooms • Krushi Nagar, Shivamogga
              </span>
            </div>
          </div>
        </div>

        {/* Right side icons & user */}
        <div className="flex items-center space-x-3 sm:space-x-4">
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
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
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

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs hover:bg-slate-50 transition ${
                          !n.is_read ? 'bg-blue-50/40 font-medium' : 'text-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-bold text-slate-800">{n.title}</span>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {formatDateTime(n.created_at)}
                        </span>
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
