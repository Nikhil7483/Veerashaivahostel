import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ErrorBoundary from './components/common/ErrorBoundary';

// Core Layout & Authentication (eager for instant initial paint)
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/auth/Login';
import LandingPage from './pages/public/LandingPage';

// Core Dashboards (eager for instant login transitions)
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentDashboard from './pages/student/StudentDashboard';

// Frequent Core Pages
import AdminProfilePage from './pages/admin/AdminProfilePage';
import StudentsPage from './pages/admin/StudentsPage';
import RoomsPage from './pages/admin/RoomsPage';
import AttendancePage from './pages/admin/AttendancePage';
import LeavePage from './pages/admin/LeavePage';
import StudentProfilePage from './pages/student/StudentProfilePage';
import StudentRoomPage from './pages/student/StudentRoomPage';
import StudentAttendancePage from './pages/student/StudentAttendancePage';
import StudentLeavePage from './pages/student/StudentLeavePage';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';
import NotificationsPage from './pages/admin/NotificationsPage';

// Heavy secondary & auxiliary modules (lazy-loaded to optimize bundle size)
const CleaningPage = lazy(() => import('./pages/admin/CleaningPage'));
const FoodAllocationPage = lazy(() => import('./pages/admin/FoodAllocationPage'));
const WeeklyMessMenuPage = lazy(() => import('./pages/common/WeeklyMessMenuPage'));
const LostFoundPage = lazy(() => import('./pages/admin/LostFoundPage'));
const StudentLostFoundPage = lazy(() => import('./pages/student/StudentLostFoundPage'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));
const CleaningRoomPage = lazy(() => import('./pages/cleaning/CleaningRoomPage'));
const StudentCleaningPage = lazy(() => import('./pages/student/StudentCleaningPage'));

// Lightweight suspense loader
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
  </div>
);

// Role Guard Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin has super-user access
  if (user.role === 'ADMIN') {
    return children;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/student/dashboard" replace />;
  }

  return children;
};

// Root redirector
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />

                {/* Admin Protected Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requiredRole="ADMIN">
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="profile" element={<AdminProfilePage />} />
                  <Route path="students" element={<StudentsPage />} />
                  <Route path="students/cleaning-room" element={<CleaningRoomPage />} />
                  <Route path="rooms" element={<RoomsPage />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="leaves" element={<LeavePage />} />
                  <Route path="cleaning" element={<CleaningPage />} />
                  <Route path="complaints" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="maintenance" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="food-allocation" element={<FoodAllocationPage />} />
                  <Route path="mess-menu" element={<WeeklyMessMenuPage />} />
                  <Route path="kitchen-order" element={<Navigate to="/admin/food-allocation" replace />} />
                  <Route path="mess" element={<Navigate to="/admin/mess-menu" replace />} />
                  <Route path="tiffin" element={<Navigate to="/admin/food-allocation" replace />} />
                  <Route path="food" element={<Navigate to="/admin/food-allocation" replace />} />
                  <Route path="visitors" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="lost-found" element={<LostFoundPage />} />
                  <Route path="emergency" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="audit-logs" element={<AuditLogsPage />} />
                </Route>

                {/* Legacy Cleaning Redirects -> Redirect to Students Cleaning Room */}
                <Route path="/cleaning/*" element={<Navigate to="/admin/students?tab=cleaning-room" replace />} />

                {/* Student Protected Routes */}
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute requiredRole="STUDENT">
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/student/dashboard" replace />} />
                  <Route path="dashboard" element={<StudentDashboard />} />
                  <Route path="profile" element={<StudentProfilePage />} />
                  <Route path="room" element={<StudentRoomPage />} />
                  <Route path="attendance" element={<StudentAttendancePage />} />
                  <Route path="leave" element={<StudentLeavePage />} />
                  <Route path="cleaning" element={<StudentCleaningPage />} />
                  <Route path="cleaning-room" element={<CleaningRoomPage />} />
                  <Route path="complaints" element={<Navigate to="/student/dashboard" replace />} />
                  <Route path="mess-menu" element={<Navigate to="/student/dashboard" replace />} />
                  <Route path="kitchen-order" element={<Navigate to="/student/dashboard" replace />} />
                  <Route path="lost-found" element={<StudentLostFoundPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
