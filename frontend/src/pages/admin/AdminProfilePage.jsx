import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  KeyRound,
  CheckCircle2,
  Save,
  Sparkles,
  Bed,
  Users
} from 'lucide-react';

const AdminProfilePage = () => {
  const { user, reloadProfile } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    office: '',
    role: 'ADMIN',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const fetchAdminProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/admin/profile');
      setProfile(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load admin profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice('');
    setError('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: profile.name,
        phone: profile.phone,
        designation: profile.designation,
        office: profile.office,
      };

      if (profile.email && profile.email !== user?.email) {
        payload.email = profile.email;
      }

      if (newPassword) {
        payload.new_password = newPassword;
      }

      await api.put('/auth/admin/profile', payload);
      setNotice('✅ Admin profile details updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      if (reloadProfile) {
        await reloadProfile();
      }
      fetchAdminProfile();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update admin profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Administrator Profile & Access Settings
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your warden credentials, emergency contact details, office hours, and portal security.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-bold text-xs flex items-center space-x-1">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span>Master Warden Authority</span>
          </span>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-900 font-black">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-xs font-bold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900 font-black">
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          Loading administrator profile...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Profile Card Overview */}
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-md">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : 'W'}
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">{profile.name || 'Hostel Administrator'}</h2>
                  <p className="text-xs text-purple-600 font-bold mt-0.5">
                    {profile.designation || 'Chief Hostel Warden'}
                  </p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 bg-slate-100 text-slate-600 font-mono text-[10px] font-bold rounded-md">
                    ROLE: {profile.role}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center space-x-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{profile.phone || '+91 98800 12345'}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600">
                  <Building className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{profile.office || 'Warden Cabin, Block A'}</span>
                </div>
              </div>
            </div>

            {/* Quick Scope Card */}
            <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Hostel Scope</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 text-center">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Bed className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-white">13</p>
                  <p className="text-[10px] text-slate-300 font-medium">Hostel Rooms</p>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Users className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-white">64</p>
                  <p className="text-[10px] text-slate-300 font-medium">Residents</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Edit Profile Form */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center space-x-2">
              <User className="w-4 h-4 text-blue-600" />
              <span>Edit Personal & Contact Information</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. Dr. K. N. Gowda / Chief Warden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Official Designation / Title</label>
                  <input
                    type="text"
                    required
                    value={profile.designation}
                    onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="e.g. Chief Hostel Warden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone Number</label>
                  <input
                    type="text"
                    required
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    placeholder="+91 98800 12345"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Official Email Address</label>
                  <input
                    type="email"
                    required
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Office / Cabin Location</label>
                <input
                  type="text"
                  required
                  value={profile.office}
                  onChange={(e) => setProfile({ ...profile, office: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  placeholder="Warden Office, Ground Floor Block A"
                />
              </div>

              {/* Password Section */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-4 h-4 text-purple-600" />
                  <span className="font-extrabold text-slate-900 text-xs">
                    Change Password (Optional)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Leave empty if you do not wish to change your current login password.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold transition flex items-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving Changes...' : 'Save Admin Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfilePage;
