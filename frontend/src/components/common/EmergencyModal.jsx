import React, { useState } from 'react';
import { AlertTriangle, Flame, ShieldAlert, HeartPulse, HelpCircle } from 'lucide-react';
import Modal from './Modal';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const EmergencyModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [emergencyType, setEmergencyType] = useState('MEDICAL');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const emergencyTypes = [
    { id: 'MEDICAL', label: 'Medical Emergency', icon: HeartPulse, color: 'border-rose-500 bg-rose-50 text-rose-700' },
    { id: 'FIRE', label: 'Fire Outbreak', icon: Flame, color: 'border-orange-500 bg-orange-50 text-orange-700' },
    { id: 'SECURITY', label: 'Security Threat', icon: ShieldAlert, color: 'border-red-600 bg-red-50 text-red-800' },
    { id: 'OTHER', label: 'Other Emergency', icon: HelpCircle, color: 'border-amber-500 bg-amber-50 text-amber-700' },
  ];

  const handleTrigger = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const roomNumber = user?.student_profile?.room_number || 'Hostel Campus';
      await api.post('/emergency/trigger', {
        room_number: roomNumber,
        emergency_type: emergencyType,
        description: description || `Urgent ${emergencyType} assistance requested by ${user?.name || 'student'}.`,
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to trigger emergency alert. Please contact warden directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🚨 EMERGENCY SOS ALERT" maxWidth="max-w-lg">
      <div className="space-y-5">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800 leading-relaxed">
            <span className="font-bold text-red-900 block text-sm mb-0.5">WARNING: Genuine Emergencies Only</span>
            Triggering this SOS sends an immediate high-priority distress signal to the Hostel Warden, Campus Security, and Medical First Responders with your room location.
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleTrigger} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Emergency Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              {emergencyTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = emergencyType === type.id;
                return (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => setEmergencyType(type.id)}
                    className={`flex items-center space-x-2.5 p-3 rounded-xl border text-left font-semibold text-sm transition-all ${
                      isSelected
                        ? `${type.color} ring-2 ring-red-500/30 border-transparent shadow-xs`
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-xs">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 bg-slate-100 rounded-xl space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-500">Student:</span>
              <span className="font-bold text-slate-800">{user?.name} ({user?.student_profile?.student_id || user?.email})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Room & Bed:</span>
              <span className="font-bold text-slate-800">{user?.student_profile?.room_number || 'Room 05'}, {user?.student_profile?.bed_number || 'B1'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Primary Contact:</span>
              <span className="font-bold text-slate-800">{user?.student_profile?.phone || 'On Record'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Brief Situation Description (Optional)
            </label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Need immediate first aid, dizziness, smoke in corridor..."
              className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-hidden"
            ></textarea>
          </div>

          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-1/2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{submitting ? 'Broadcasting...' : 'CONFIRM & SEND SOS'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default EmergencyModal;
