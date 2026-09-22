import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/dateUtils';
import { Check, X, FileText, Calendar, Filter } from 'lucide-react';

const LeavePage = () => {
  const [leaves, setLeaves] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionType, setActionType] = useState('APPROVED'); // APPROVED or REJECTED
  const [adminRemarks, setAdminRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/leaves', { params });
      setLeaves(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter]);

  const openReviewModal = (leave, action) => {
    setSelectedLeave(leave);
    setActionType(action);
    setAdminRemarks(action === 'APPROVED' ? 'Approved by Warden.' : 'Rejected due to academic schedule.');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/leaves/${selectedLeave.id}/status`, {
        status: actionType,
        admin_remarks: adminRemarks,
      });
      setReviewModalOpen(false);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update leave status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Leave Applications Management</h1>
          <p className="text-xs text-slate-500 font-medium">
            Review resident outstation & medical leave requests, sanction permissions, and record remarks.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden"
          >
            <option value="">All Applications</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading leave applications...</div>
      ) : leaves.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          No leave applications found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaves.map((leave) => {
            const isPending = leave.status === 'PENDING';
            const isApproved = leave.status === 'APPROVED';

            return (
              <div
                key={leave.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{leave.student_name}</h3>
                      <p className="text-[11px] text-slate-500">
                        {leave.room_number} | {leave.student_id} | USN: {leave.usn || '-'}
                      </p>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                      isPending
                        ? 'bg-amber-100 text-amber-800'
                        : isApproved
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {leave.status}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-xs text-slate-700">
                    <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-[11px]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(leave.from_date)} &rarr; {formatDate(leave.to_date)}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Type: </span>
                      <span className="font-bold text-slate-800">{leave.leave_type}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Reason: </span>
                      <span className="text-slate-700">{leave.reason}</span>
                    </div>
                  </div>

                  {leave.document_url && (
                    <a
                      href={leave.document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 text-xs text-blue-600 font-bold hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Attached Document</span>
                    </a>
                  )}

                  {leave.admin_remarks && (
                    <div className="p-2 bg-slate-100 rounded-lg text-[11px] text-slate-600">
                      <span className="font-bold text-slate-700">Warden Remarks: </span>
                      {leave.admin_remarks}
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openReviewModal(leave, 'APPROVED')}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => openReviewModal(leave, 'REJECTED')}
                      className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`${actionType === 'APPROVED' ? 'Sanction' : 'Reject'} Leave Application`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <p className="font-bold text-slate-900">{selectedLeave?.student_name} ({selectedLeave?.room_number})</p>
            <p className="text-slate-500">Duration: {formatDate(selectedLeave?.from_date)} to {formatDate(selectedLeave?.to_date)}</p>
            <p className="text-slate-600 italic">"{selectedLeave?.reason}"</p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Warden Remarks (Will be notified to student)
            </label>
            <textarea
              rows="3"
              required
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              placeholder="Provide reason or approval notes..."
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="py-2 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`py-2 px-5 rounded-xl text-white font-bold transition ${
                actionType === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting ? 'Updating...' : `Confirm ${actionType}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeavePage;
