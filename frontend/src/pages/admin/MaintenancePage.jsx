import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { Filter, UserCheck } from 'lucide-react';

const MaintenancePage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Update modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [status, setStatus] = useState('IN_PROGRESS');
  const [staff, setStaff] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMaintenance = async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/maintenance', { params });
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenance();
  }, [categoryFilter, statusFilter]);

  const openUpdateModal = (req) => {
    setSelectedReq(req);
    setStatus(req.status === 'PENDING' ? 'IN_PROGRESS' : req.status);
    setStaff(req.assigned_staff !== 'Unassigned' ? req.assigned_staff : 'Facility Engineer');
    setRemarks(req.remarks || '');
    setUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/maintenance/${selectedReq.id}`, {
        status,
        assigned_staff: staff,
        remarks,
      });
      setUpdateModalOpen(false);
      fetchMaintenance();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update maintenance task.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    'Fan not working', 'Light not working', 'Water leakage', 'No water',
    'Power outage', 'Bathroom problem', 'Furniture damage', 'Internet problem', 'Other'
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Facilities & Maintenance</h1>
          <p className="text-xs text-slate-500 font-medium">
            Physical infrastructure work orders covering water, electrical grid, fixtures, and Wi-Fi hardware.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading maintenance requests...</div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          No maintenance requests found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((m) => {
            const isResolved = m.status === 'RESOLVED';

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-extrabold text-blue-600 text-xs tracking-wider uppercase block">
                        {m.category}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                        {m.room_number} ({m.student_name})
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl">
                    "{m.description}"
                  </p>

                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>
                      <span className="font-semibold text-slate-700">Staff Assigned: </span>
                      <span>{m.assigned_staff || 'Unassigned'}</span>
                    </div>
                    {m.remarks && (
                      <div>
                        <span className="font-semibold text-slate-700">Remarks: </span>
                        <span>{m.remarks}</span>
                      </div>
                    )}
                  </div>
                </div>

                {!isResolved && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => openUpdateModal(m)}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Update Staff & Resolve</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Update Modal */}
      <Modal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title={`Maintenance Work Order: ${selectedReq?.room_number}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
            >
              <option value="PENDING">PENDING</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Assign Technician / Contractor</label>
            <input
              type="text"
              required
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              placeholder="e.g. Electrician Somanna / Plumber Rajesh"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Remarks</label>
            <textarea
              rows="3"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Provide repair summary..."
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
              {submitting ? 'Saving...' : 'Save Maintenance Status'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MaintenancePage;
