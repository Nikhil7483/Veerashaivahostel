import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDateTime } from '../../utils/dateUtils';
import { ShieldAlert, CheckCircle } from 'lucide-react';

const EmergencyAlertsPage = () => {
  const [alerts, setAlerts] = useState([]);

  // Resolve modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/emergency');
      setAlerts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const openResolveModal = (alert) => {
    setSelectedAlert(alert);
    setNotes('Hostel warden and first responder unit arrived on scene. Situation stabilized.');
    setResolveModalOpen(true);
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/emergency/${selectedAlert.id}/resolve`, {
        resolution_notes: notes,
      });
      setResolveModalOpen(false);
      fetchAlerts();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to resolve alert.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');
  const resolvedAlerts = alerts.filter((a) => a.status === 'RESOLVED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Emergency SOS Command Center</h1>
          <p className="text-xs text-slate-500 font-medium">
            Direct priority dispatch link for resident medical, fire, security, and urgent distress calls.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-xs font-bold text-slate-700">Live 24x7 Monitoring</span>
        </div>
      </div>

      {/* Active Distress Calls */}
      <div className="space-y-4">
        <h3 className="text-sm font-extrabold text-red-700 uppercase tracking-wider flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <span>Active Resident Distress Signals ({activeAlerts.length})</span>
        </h3>

        {activeAlerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
            ✅ No active emergency distress signals at this time. All 13 rooms are safe.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-5 bg-red-50 rounded-2xl border-2 border-red-500 shadow-xl space-y-4 animate-in fade-in"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-xl bg-red-600 text-white shadow-md">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-md bg-red-200 text-red-900 font-black text-xs uppercase tracking-wider">
                        {alert.emergency_type} EMERGENCY
                      </span>
                      <h4 className="text-lg font-black text-slate-900 mt-1">
                        {alert.room_number} &bull; {alert.student_name}
                      </h4>
                      <p className="text-xs text-slate-600 font-medium">
                        Student ID: {alert.student_id} | USN: {alert.usn || '-'}
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 bg-red-600 text-white font-black text-xs rounded-full animate-pulse">
                    ACTIVE
                  </span>
                </div>

                <div className="p-3 bg-white/90 rounded-xl space-y-1 text-xs text-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student Contact:</span>
                    <a href={`tel:${alert.phone}`} className="font-bold text-blue-600 hover:underline">
                      {alert.phone || 'N/A'}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parent / Guardian Contact:</span>
                    <a href={`tel:${alert.parent_contact}`} className="font-bold text-red-600 hover:underline">
                      {alert.parent_contact || 'N/A'}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dispatched At:</span>
                    <span className="font-mono text-slate-700">
                      {formatDateTime(alert.created_at)}
                    </span>
                  </div>
                </div>

                <p className="text-xs font-semibold text-red-950 bg-red-100/60 p-2.5 rounded-xl">
                  "{alert.description}"
                </p>

                <button
                  onClick={() => openResolveModal(alert)}
                  className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>DISPATCH HELP & MARK RESOLVED</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Resolved Emergencies */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">Resolved Incident History</h3>

        {resolvedAlerts.length === 0 ? (
          <p className="text-xs text-slate-400">No previous incident logs.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedAlerts.map((a) => (
              <div key={a.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">{a.student_name} ({a.room_number})</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">
                    RESOLVED
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] font-medium">{a.emergency_type} Incident</p>
                {a.resolution_notes && (
                  <p className="text-slate-700 bg-slate-50 p-2 rounded-lg text-[11px]">
                    <span className="font-bold text-slate-800">Resolution: </span>
                    {a.resolution_notes}
                  </p>
                )}
                <span className="text-[10px] text-slate-400 block pt-1">
                  Resolved by {a.resolved_by || 'Warden'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve Incident Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title={`Resolve SOS for ${selectedAlert?.student_name} (${selectedAlert?.room_number})`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleResolve} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Incident Resolution Log *</label>
            <textarea
              rows="4"
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail medical attention given, first aid provided, or issue stabilized..."
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setResolveModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Confirming...' : 'Mark Incident Resolved'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmergencyAlertsPage;
