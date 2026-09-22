import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { Plus, LogOut, Phone } from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

const VisitorsPage = () => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Register visitor modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    visitor_name: '',
    phone: '',
    student_name: '',
    room_number: 'Room 01',
    purpose: '',
    entry_time: new Date().toISOString().replace('T', ' ').substring(0, 16),
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/visitors');
      setVisitors(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/visitors', formData);
      setAddModalOpen(false);
      fetchVisitors();
      setFormData({
        visitor_name: '',
        phone: '',
        student_name: '',
        room_number: 'Room 01',
        purpose: '',
        entry_time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to register visitor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (visitorId) => {
    const exitTime = new Date().toISOString().replace('T', ' ').substring(0, 16);
    try {
      await api.put(`/visitors/${visitorId}/checkout`, { exit_time: exitTime });
      fetchVisitors();
    } catch (err) {
      alert('Failed to log checkout time.');
    }
  };

  const roomsList = Array.from({ length: 13 }, (_, i) => `Room ${(i + 1).toString().padStart(2, '0')}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hostel Visitor Management</h1>
          <p className="text-xs text-slate-500 font-medium">
            Register visiting parents & guests, track hostel premises check-in/check-out timestamps.
          </p>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Visitor</span>
        </button>
      </div>

      {/* Visitor Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading visitor logs...</div>
        ) : visitors.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No visitors recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Visitor Info</th>
                  <th className="px-4 py-3">Resident Student</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Entry Time</th>
                  <th className="px-4 py-3">Exit Time</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitors.map((v) => {
                  const isCheckedOut = Boolean(v.exit_time);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{v.visitor_name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                          <Phone className="w-3 h-3" />
                          <span>{v.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{v.student_name}</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                          {v.room_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {v.purpose}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {formatDateTime(v.entry_time)}
                      </td>
                      <td className="px-4 py-3">
                        {isCheckedOut ? (
                          <span className="font-mono text-slate-600">{formatDateTime(v.exit_time)}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                            On Premises
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isCheckedOut && (
                          <button
                            onClick={() => handleCheckout(v.id)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 ml-auto"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Check Out</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Visitor Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Register Hostel Guest" maxWidth="max-w-md">
        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Visitor Full Name *</label>
            <input
              type="text"
              required
              value={formData.visitor_name}
              onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
              placeholder="e.g. Suresh Kumar"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Visitor Phone Number *</label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="10-digit mobile"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Student Visiting *</label>
            <input
              type="text"
              required
              value={formData.student_name}
              onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
              placeholder="Resident Student Name"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Room Number *</label>
            <select
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
            >
              {roomsList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Purpose of Visit *</label>
            <input
              type="text"
              required
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="e.g. Handing over supplies, parent meeting..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Log Visitor Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default VisitorsPage;
