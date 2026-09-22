import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Navbar from '../components/common/Navbar';

const DashboardLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <Navbar onMobileToggle={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        <footer className="py-4 px-6 border-t border-slate-200 bg-white/80 text-center text-xs text-slate-500">
          <p className="leading-relaxed">
            © 2026 Veerashaiva Lingayath Boys Hostel, Shivamogga. All rights reserved. • Developed by Nikhilharsha <span className="text-rose-500 inline-block">❤️</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
