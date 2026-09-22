import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { User, Shield, Save, UtensilsCrossed, KeyRound, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const StudentProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [phone, setPhone] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [address, setAddress] = useState('');
  const [foodHistory, setFoodHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fetchProfile = async () => {
    try {
      const [res, foodRes] = await Promise.all([
        api.get('/students/my/profile'),
        api.get('/food-allocation/student/history').catch(() => ({ data: [] }))
      ]);
      setProfile(res.data);
      setPhone(res.data.phone || '');
      setParentContact(res.data.parent_contact || '');
      setAddress(res.data.address || '');
      setFoodHistory(foodRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await api.put('/students/my/profile', {
        phone,
        parent_contact: parentContact,
        address,
      });
      setProfile(res.data);
      setMessage('✅ Profile contact information updated successfully.');
    } catch (err) {
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please re-enter.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await api.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPasswordMessage(res.data?.message || 'Password changed successfully! Keep it safe.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to change password. Please verify your current password.';
      setPasswordError(detail);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!profile) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading student profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Resident Student Profile</h1>
        <p className="text-xs text-slate-500 font-medium">
          Personal identification, institutional credentials, and assigned hostel accommodation details.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
          {message}
        </div>
      )}

      {/* Header Profile Card */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-md shrink-0">
          {profile.name.split(' ').map((n) => n[0]).join('')}
        </div>

        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900">{profile.name}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {profile.status} RESIDENT
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500">
            {profile.department} Department &bull; {profile.semester}th Semester
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              USN: {profile.usn}
            </span>
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              ID: {profile.student_id}
            </span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {profile.room_number} ({profile.bed_number})
            </span>
          </div>
        </div>
      </div>

      {/* Profile Details & Editable Contact Info */}
      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Institutional Data (Locked for Student) */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Academic & Room Record (Verified)</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-400 block">Assigned Room</span>
                <span className="font-bold text-slate-800 text-sm">{profile.room_number}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block">Allocated Bed</span>
                <span className="font-bold text-slate-800 text-sm">Bed {profile.bed_number}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block">Official College Email</span>
                <span className="font-bold text-slate-800">{profile.email}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block">Joining Date</span>
                <span className="font-bold text-slate-800">{formatDate(profile.joining_date)}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block">Guardian / Parent Name</span>
                <span className="font-bold text-slate-800">{profile.parent_name}</span>
              </div>
            </div>
          </div>

          {/* Permitted Editable Fields */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Contact & Residential Details</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">My Mobile Number</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Emergency Contact</label>
                <input
                  type="text"
                  required
                  value={parentContact}
                  onChange={(e) => setParentContact(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Permanent Home Address</label>
                <textarea
                  rows="3"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Updating...' : 'Save Contact Updates'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* CHANGE PASSWORD CARD */}
      <div id="password" className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Change Account Password</h3>
            <p className="text-xs text-slate-400 font-medium">Update your secret password to protect your resident portal</p>
          </div>
        </div>

        {passwordMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{passwordMessage}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Current Password <span className="text-[10px] text-slate-400 font-normal">(Default: Student@123)</span>
            </label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="Current password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full p-2.5 pl-8 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2.5 pl-8 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 pl-8 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-2 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>{passwordSaving ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 15. STUDENT FOOD ROUTINE HISTORY */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <UtensilsCrossed className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-base font-black text-slate-900">Food Menu History</h3>
            <p className="text-xs text-slate-400 font-medium">Record of daily hostel food allocations</p>
          </div>
        </div>

        {foodHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">No previous food records found.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Day</th>
                  <th className="py-2.5 px-4">Allocated Morning Dish</th>
                  <th className="py-2.5 px-4">Allocated Night Dish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {foodHistory.map((h, i) => (
                  <tr key={h.date || i} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{formatDate(h.date)}</td>
                    <td className="py-2.5 px-4 text-slate-600">{h.day}</td>
                    <td className="py-2.5 px-4 font-bold text-amber-900">{h.morning_dish}</td>
                    <td className="py-2.5 px-4 font-bold text-indigo-900">{h.night_dish}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfilePage;
