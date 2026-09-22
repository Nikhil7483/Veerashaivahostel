import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';

const AnnouncementsPage = () => {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/announcements', {
        title,
        description,
        priority,
      });
      setAddModalOpen(false);
      setTitle('');
      setDescription('');
      setPriority('NORMAL');
      fetchAnnouncements();
    } catch (err) {
      alert('Failed to post announcement. Admin privileges required.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this broadcast announcement?')) {
      try {
        await api.delete(`/announcements/${id}`);
        fetchAnnouncements();
      } catch (err) {
        alert('Failed to delete.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isAdmin ? 'Broadcast Announcements' : 'Hostel Circulars & Notices'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {isAdmin
              ? 'Publish circulars, official circulars, and hostel regulations to all resident dashboards.'
              : 'Official circulars, regulations, and notifications published by the Warden Office.'}
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setAddModalOpen(true)}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Publish Notice</span>
          </button>
        ) : (
          <span className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-xl text-xs font-bold border border-blue-200 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Warden Notice Board (Official)</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          No announcements published yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                    a.priority === 'URGENT'
                      ? 'bg-red-100 text-red-800'
                      : a.priority === 'IMPORTANT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {a.priority} NOTICE
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                      title="Delete Notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <h3 className="font-extrabold text-slate-900 text-base">{a.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{a.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>By: {a.author || 'Hostel Warden'}</span>
                <span>{formatDate(a.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish Notice Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Broadcast Hostel Announcement"
        maxWidth="max-w-md"
      >
        <form onSubmit={handlePost} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Notice Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wi-Fi Maintenance Window / Curfew Timings"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Priority Level *</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold"
            >
              <option value="NORMAL">NORMAL</option>
              <option value="IMPORTANT">IMPORTANT</option>
              <option value="URGENT">URGENT (Action Required)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notice Content *</label>
            <textarea
              rows="4"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full announcement instructions and details..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
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
              {submitting ? 'Broadcasting...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
