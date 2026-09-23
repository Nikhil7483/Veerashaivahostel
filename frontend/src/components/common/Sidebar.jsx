import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Bed,
  CalendarCheck,
  PlaneTakeoff,
  Sparkles,
  Ticket,
  UtensilsCrossed,
  Coffee,
  Search,
  Megaphone,
  Bell,
  BarChart3,
  FileSpreadsheet,
  History,
  User,
  LogOut,
  X,
  ChefHat,
  ClipboardCheck,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, isAdmin, logout } = useAuth();

  const adminSections = [
    {
      title: 'Overview',
      links: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/profile', label: 'Admin Profile', icon: User },
      ]
    },
    {
      title: 'Hostel & Residents',
      links: [
        { to: '/admin/students', label: 'Students', icon: Users },
        { to: '/admin/rooms', label: '12 Rooms', icon: Bed },
        { to: '/admin/attendance', label: 'Attendance Register', icon: CalendarCheck },
        { to: '/admin/leaves', label: 'Leave Review', icon: PlaneTakeoff },
        { to: '/admin/cleaning', label: 'Cleaning Tasks', icon: Sparkles },
      ]
    },
    {
      title: 'Food & Mess (Warden)',
      links: [
        { to: '/admin/food-allocation', label: 'Food Allocation', icon: ChefHat },
        { to: '/admin/mess-menu', label: 'Weekly Mess Menu', icon: UtensilsCrossed },
      ]
    },
    {
      title: 'Campus & Support',
      links: [
        { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/admin/lost-found', label: 'Lost & Found', icon: Search },
        { to: '/admin/notifications', label: 'Notifications', icon: Bell },
      ]
    },
    {
      title: 'Analytics & Audit',
      links: [
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/admin/reports', label: 'Reports Export', icon: FileSpreadsheet },
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: History },
      ]
    }
  ];

  const studentSections = [
    {
      title: 'Overview',
      links: [
        { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/student/profile', label: 'My Profile & Security', icon: User },
        { to: '/student/profile', label: 'Change Password', icon: KeyRound },
      ]
    },
    {
      title: 'Hostel Living',
      links: [
        { to: '/student/room', label: 'My Room & Roommates', icon: Bed },
        { to: '/student/cleaning', label: 'Housekeeping & Sanitation', icon: Sparkles },
        { to: '/student/attendance', label: 'My Attendance', icon: CalendarCheck },
        { to: '/student/leave', label: 'Apply Leave', icon: PlaneTakeoff },
        { to: '/student/cleaning-room', label: '🧹 Meal Duty Room', icon: ClipboardCheck },
      ]
    },
    {
      title: 'Campus & Support',
      links: [
        { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/student/notifications', label: 'Notifications', icon: Bell },
        { to: '/student/lost-found', label: 'Lost & Found', icon: Search },
      ]
    }
  ];

  const sections = isAdmin ? adminSections : studentSections;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand & User Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-md">
            SH
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-wide truncate max-w-[150px]">Veerashaiva Hostel ❤️</h2>
            <p className="text-[11px] text-blue-400 font-medium">
              {isAdmin ? 'Warden Admin Portal' : `${user?.student_profile?.room_number || 'Resident'} Student`}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Categorized Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sections.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {sec.title}
            </p>
            {sec.links.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Logout */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
        <p className="mt-2 text-center text-[10px] text-slate-500 font-medium leading-tight">
          Developed by Nikhilharsha <span className="text-rose-500 inline-block">❤️</span>
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
