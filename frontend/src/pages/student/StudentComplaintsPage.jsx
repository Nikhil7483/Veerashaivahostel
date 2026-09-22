import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { Plus, Clock } from 'lucide-react';

const StudentComplaintsPage = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('ELECTRICAL');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);

  const roomNumber = user?.student_profile?.room_number || 'Room 05';

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.get('/complaints');
      setComplaints(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/complaints', {
        room_number: roomNumber,
        category,
        description,
        priority,
      });
      setModalOpen(false);
      setDescription('');
      setPriority('MEDIUM');
      fetchComplaints();
    } catch (err) {
      alert('Failed to submit complaint.');
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Complaints & Ticket Resolution</h1>
          <p className="text-xs text-slate-500 font-medium">
            Report infrastructure breakdowns, obtain unique tracking tickets (HTL-XXXX), and monitor technician repairs.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>File Complaint Ticket</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading your complaint tickets...</div>
      ) : complaints.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          No complaints filed. Everything in {roomNumber} is working smoothly!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {complaints.map((c) => {
            const isResolved = c.status === 'RESOLVED';
            const isOverdue = c.overdue;

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3 text-xs">
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
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                        {c.category}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl font-medium">
                    "{c.description}"
                  </p>

                  {isOverdue && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] font-bold flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Ticket Overdue &gt; 48h (Auto Escalated to Warden)</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>
                      <span className="font-semibold text-slate-700">Assigned Technician: </span>
                      <span>{c.assigned_staff || 'Awaiting assignment'}</span>
                    </div>
                    {c.admin_remarks && (
                      <div>
                        <span className="font-semibold text-slate-700">Warden Remarks: </span>
                        <span>{c.admin_remarks}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Logged: {formatDate(c.created_at)}</span>
                  {c.escalation_level && c.escalation_level !== 'LEVEL_1' && (
                    <span className="font-extrabold text-red-600">
                      🚨 Escalated: {c.escalation_level.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complaint Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="File Facility Complaint Ticket"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Issue Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Priority Level *</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
            >
              <option value="LOW">LOW PRIORITY</option>
              <option value="MEDIUM">MEDIUM PRIORITY</option>
              <option value="HIGH">HIGH PRIORITY</option>
              <option value="URGENT">URGENT (Power/Water Outage)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Description of Problem *</label>
            <textarea
              rows="3"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the failure, e.g. Switchboard sparking, tap loose..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Generate Ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentComplaintsPage;
