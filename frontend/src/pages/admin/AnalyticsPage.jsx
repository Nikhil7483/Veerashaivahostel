import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { AlertTriangle, Bed, Clock, ShieldCheck } from 'lucide-react';

const AnalyticsPage = () => {
  const [overview, setOverview] = useState(null);
  const [problems, setProblems] = useState(null);
  const [messAnalytics, setMessAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const [overRes, probRes, messRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/problems'),
        api.get('/mess/analytics')
      ]);
      setOverview(overRes.data);
      setProblems(probRes.data);
      setMessAnalytics(messRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

  // Bed Occupancy Pie Data
  const occupancyPieData = [
    { name: 'Occupied Beds', value: overview?.occupied_beds || 0, color: '#3B82F6' },
    { name: 'Available Beds', value: overview?.available_beds || 0, color: '#10B981' },
  ];

  // Attendance Status Donut Data
  const attendancePieData = [
    { name: 'Present', value: overview?.attendance?.present || 0, color: '#10B981' },
    { name: 'Absent', value: overview?.attendance?.absent || 0, color: '#EF4444' },
    { name: 'Sanctioned Leave', value: overview?.attendance?.on_leave || 0, color: '#3B82F6' },
  ];



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hostel Problem Intelligence & Analytics</h1>
        <p className="text-xs text-slate-500 font-medium">
          Comprehensive telemetry on infrastructure failures, resolution SLA benchmarks, and hostel occupancy.
        </p>
      </div>

      {/* Problem Intelligence Highlight KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Most Frequent Problem</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{problems?.most_common_problem || 'None'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Identified via ticket trends</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Most Problematic Room</span>
            <Bed className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{problems?.most_problematic_room || 'None'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Highest maintenance frequency</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Avg Resolution Time</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{problems?.average_resolution_time_hours || 0} Hours</p>
          <p className="text-[11px] text-slate-400 mt-0.5">From creation to sign-off</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Dining Reviews</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{messAnalytics?.total_feedback || 0} Reviews</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{messAnalytics?.recent_count || 0} in past 7 days</p>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Complaints Categories Bar Chart */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Complaint Categories Breakdown</h3>
              <p className="text-xs text-slate-500">Distribution of reported issues across domains</p>
            </div>
          </div>

          <div className="h-72 w-full">
            {problems?.complaint_categories?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={problems.complaint_categories} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 6, 6, 0]}>
                    {problems.complaint_categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">No complaint data.</div>
            )}
          </div>
        </div>

        {/* 13 Rooms Bed Occupancy Ratio */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">13 Rooms Bed Allocation</h3>
              <p className="text-xs text-slate-500">Total capacity: {overview?.total_beds} beds</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
              {overview?.occupancy_percentage}% Occupied
            </span>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {occupancyPieData.map((entry, index) => (
                    <Cell key={`pie-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Problematic Rooms */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Highest Maintenance Incident Rooms</h3>
            <p className="text-xs text-slate-500">Rooms with recurring electrical, plumbing, or facility repairs</p>
          </div>

          <div className="h-64 w-full">
            {problems?.problematic_rooms?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={problems.problematic_rooms}>
                  <XAxis dataKey="room_number" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="count" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">No recurring issues.</div>
            )}
          </div>
        </div>

        {/* Attendance Breakdown Today */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Today's Resident Attendance Mix</h3>
            <p className="text-xs text-slate-500">Roll call representation across all 13 rooms</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendancePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {attendancePieData.map((entry, index) => (
                    <Cell key={`att-pie-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
