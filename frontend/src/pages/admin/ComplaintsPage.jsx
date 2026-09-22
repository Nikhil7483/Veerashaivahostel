import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import {
  Clock,
  Filter,
  UserCheck,
  ArrowUpRight
} from 'lucide-react';

const ComplaintsPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Update Status / Assign Staff Modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [status, setStatus] = useState('ASSIGNED');
  const [staff, setStaff] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Escalation Modal
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateTo, setEscalateTo] = useState('WARDEN');
  const [escalateReason, setEscalateReason] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (overdueOnly) params.is_overdue = true;

      const res = await api.get('/complaints', { params });
      setComplaints(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [categoryFilter, statusFilter, priorityFilter, overdueOnly]);

  const openUpdateModal = (ticket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status === 'PENDING' ? 'ASSIGNED' : ticket.status);
    setStaff(ticket.assigned_staff !== 'Unassigned' ? ticket.assigned_staff : 'Campus Technical Team');
    setAdminRemarks(ticket.admin_remarks || '');
    setUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/complaints/${selectedTicket.id}`, {
        status,
        assigned_staff: staff,
        admin_remarks: adminRemarks,
      });
      setUpdateModalOpen(false);
      fetchComplaints();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEscalateModal = (ticket) => {
    setSelectedTicket(ticket);
    setEscalateTo('WARDEN');
    setEscalateReason('Resolution pending beyond SLA window. Critical resident impact.');
    setEscalateModalOpen(true);
  };

  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/complaints/${selectedTicket.id}/escalate`, {
        escalated_to: escalateTo,
        reason: escalateReason,
      });
      setEscalateModalOpen(false);
      fetchComplaints();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to escalate complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    'ELECTRICAL', 'PLUMBING', 'WATER', 'FURNITURE', 'INTERNET', 'CLEANING', 'FOOD', 'MAINTENANCE', 'OTHER'
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Complaint & Ticket Management</h1>
          <p className="text-xs text-slate-500 font-medium">
            Multi-tier ticket resolution, staff work orders, and automatic escalation for overdue resident complaints.
          </p>
        </div>

        <button
          onClick={() => setOverdueOnly(!overdueOnly)}
          className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            overdueOnly
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{overdueOnly ? 'Showing Overdue Only' : 'Filter Overdue (>48h)'}</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-1 text-slate-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold text-slate-600">Filters:</span>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:outline-hidden"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:outline-hidden"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="ASSIGNED">ASSIGNED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:outline-hidden"
        >
          <option value="">All Priorities</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>

      {/* Complaints Cards / Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading complaints tickets...</div>
      ) : complaints.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          No complaints found matching this filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {complaints.map((c) => {
            const isResolved = c.status === 'RESOLVED';
            const isOverdue = c.overdue;

            return (
              <div
                key={c.id}
                className={`rounded-2xl border shadow-xs transition p-5 flex flex-col justify-between ${
                  isOverdue
                    ? 'bg-red-50/40 border-red-300 ring-2 ring-red-400/20'
                    : 'bg-white border-slate-200 hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-blue-600 text-sm">{c.ticket_id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.priority === 'URGENT' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {c.priority}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs mt-1">
                        {c.student_name} ({c.room_number})
                      </h4>
                      <p className="text-[10px] text-slate-400">Phone: {c.phone || 'On Record'}</p>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.status}
                      </span>
                      {c.escalation_level && c.escalation_level !== 'LEVEL_1' && (
                        <span className="block text-[9px] font-extrabold text-red-600 mt-1 uppercase">
                          🚨 {c.escalation_level.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {c.category}
                    </span>
                    <p className="text-xs text-slate-700 font-medium">"{c.description}"</p>
                  </div>

                  {isOverdue && (
                    <div className="p-2 bg-red-100/70 border border-red-200 rounded-xl flex items-center space-x-1.5 text-xs text-red-800 font-bold">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>SLA Breach: Overdue for more than 48 Hours!</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                    <div>
                      <span className="font-semibold text-slate-700">Staff Assigned: </span>
                      <span>{c.assigned_staff || 'Unassigned'}</span>
                    </div>
                    {c.admin_remarks && (
                      <div>
                        <span className="font-semibold text-slate-700">Remarks: </span>
                        <span>{c.admin_remarks}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-2">
                  <button
                    onClick={() => openUpdateModal(c)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Manage / Resolve</span>
                  </button>

                  {!isResolved && (
                    <button
                      onClick={() => openEscalateModal(c)}
                      className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                      title="Escalate ticket"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Escalate</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Update / Resolve Modal */}
      <Modal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title={`Action Ticket ${selectedTicket?.ticket_id}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Update Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
            >
              <option value="PENDING">PENDING</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED (Problem Fixed)</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Assign Staff / Technician</label>
            <input
              type="text"
              required
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              placeholder="e.g. Manjunath (Electrician) / Somanna (Plumber)"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Admin / Resolution Remarks</label>
            <textarea
              rows="3"
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              placeholder="Provide repair summary or notes for resident..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setUpdateModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Update Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Escalation Modal */}
      <Modal
        isOpen={escalateModalOpen}
        onClose={() => setEscalateModalOpen(false)}
        title={`Escalate Ticket ${selectedTicket?.ticket_id}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEscalateSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-800">
            <p className="font-bold">Escalation Protocol</p>
            <p className="text-[11px] mt-0.5">
              Escalates ticket to higher administrative authority and marks priority as URGENT.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Escalate To Authority</label>
            <select
              value={escalateTo}
              onChange={(e) => setEscalateTo(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
            >
              <option value="WARDEN">Chief Warden (Level 2)</option>
              <option value="MANAGEMENT">Campus Management (Level 3)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason for Escalation *</label>
            <textarea
              rows="3"
              required
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="e.g. Problem unresolved for 48 hours, safety hazard..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setEscalateModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Escalating...' : 'Confirm Escalation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ComplaintsPage;
