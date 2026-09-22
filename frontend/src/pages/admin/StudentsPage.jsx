import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import CleaningRoomPage from '../cleaning/CleaningRoomPage';
import { formatDate } from '../../utils/dateUtils';
import { useNotification } from '../../context/NotificationContext';
import {
  Search,
  Plus,
  Eye,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CalendarCheck,
  PlaneTakeoff,
  Ticket,
  Sparkles,
  Users,
  Pencil,
  KeyRound,
  Share2,
  Download,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  FileSpreadsheet
} from 'lucide-react';

const StudentsPage = () => {
  const { toast, confirm } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'cleaning-room' ? 'cleaning-room' : 'students';

  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [dossierModalOpen, setDossierModalOpen] = useState(false);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);

  // Share Logins State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [selectedStudentForShare, setSelectedStudentForShare] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [bulkCopied, setBulkCopied] = useState(false);
  const [copiedPasswordId, setCopiedPasswordId] = useState(null);

  const copyStudentSlip = (student) => {
    const origin = window.location.origin;
    const text = `🏛️ Veerashaiva Lingayath Boys Hostel Portal\n` +
      `Hello ${student.name},\n` +
      `Here are your official resident portal login details:\n\n` +
      `🌐 Portal URL: ${origin}/login\n` +
      `👤 Username / ID: ${student.student_id} (or ${student.email})\n` +
      `🔑 Default Password: Student@123\n` +
      `🛏️ Room / Bed: ${student.room_number}, Bed ${student.bed_number}\n` +
      `📱 Mobile: ${student.phone || 'N/A'}\n\n` +
      `Please log in to manage your attendance, meal preferences, room cleaning, and leave applications.`;

    navigator.clipboard.writeText(text);
    setCopiedId(student.id || student.student_id);
    toast.success(`Copied login slip for ${student.name}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const shareViaWhatsApp = (student) => {
    const origin = window.location.origin;
    const text = `🏛️ *Veerashaiva Lingayath Boys Hostel Portal*\n\n` +
      `Hello *${student.name}*,\n` +
      `Here are your official resident portal login credentials:\n\n` +
      `🌐 *Portal URL:* ${origin}/login\n` +
      `👤 *Username / ID:* ${student.student_id} (or ${student.email})\n` +
      `🔑 *Default Password:* Student@123\n` +
      `🛏️ *Room / Bed:* ${student.room_number}, Bed ${student.bed_number}\n\n` +
      `_Please log in and keep your credentials secure._`;

    let phone = (student.phone || '').replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = `91${phone}`;
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const downloadLoginsCSV = () => {
    const origin = window.location.origin;
    const headers = ['Student ID', 'Name', 'Room', 'Bed', 'USN', 'Login Email', 'Phone', 'Department', 'Default Password', 'Portal URL'];
    const rows = students.map(s => [
      `"${s.student_id || ''}"`,
      `"${s.name || ''}"`,
      `"${s.room_number || ''}"`,
      `"${s.bed_number || ''}"`,
      `"${s.usn || s.student_id || ''}"`,
      `"${s.email || ''}"`,
      `"${s.phone || ''}"`,
      `"${s.department || ''}"`,
      '"Student@123"',
      `"${origin}/login"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `student_login_credentials_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded login credentials for ${students.length} students!`);
  };

  const copyAllLogins = () => {
    const origin = window.location.origin;
    let text = `🏛️ VEERASHAIVA LINGAYATH BOYS HOSTEL - ALL RESIDENT LOGINS\n` +
      `Portal: ${origin}/login\n` +
      `Default Password: Student@123\n` +
      `Total Residents: ${students.length}\n\n` +
      `ID   | Room/Bed    | Resident Name             | Login Username / Email\n` +
      `--------------------------------------------------------------------------------\n`;

    students.forEach(s => {
      const id = (s.student_id || '').padEnd(4);
      const room = `${s.room_number || ''} (${s.bed_number || ''})`.padEnd(12);
      const name = (s.name || '').padEnd(25);
      const email = s.email || '';
      text += `${id} | ${room} | ${name} | ${email}\n`;
    });

    navigator.clipboard.writeText(text);
    setBulkCopied(true);
    toast.success(`Copied all ${students.length} student logins to clipboard!`);
    setTimeout(() => setBulkCopied(false), 2500);
  };

  const copyPassword = (id) => {
    navigator.clipboard.writeText("Student@123");
    setCopiedPasswordId(id);
    toast.success("Copied default password: Student@123");
    setTimeout(() => setCopiedPasswordId(null), 2000);
  };

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    usn: '',
    department: 'CSE',
    semester: 4,
    room_number: 'Room 01',
    bed_number: 'B1',
    parent_name: '',
    parent_contact: '',
    address: '',
    status: 'ACTIVE'
  });
  const [editFormError, setEditFormError] = useState('');
  const [editFormSubmitting, setEditFormSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    usn: '',
    phone: '',
    email: '',
    department: 'CSE',
    semester: 4,
    room_number: 'Room 01',
    bed_number: 'B1',
    parent_name: '',
    parent_contact: '',
    address: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'ACTIVE'
  });
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (deptFilter) params.department = deptFilter;
      if (roomFilter) params.room_number = roomFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/students', { params });
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [deptFilter, roomFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleViewDossier = async (studentId) => {
    setLoadingDossier(true);
    setDossierModalOpen(true);
    try {
      const res = await api.get(`/students/${studentId}`);
      setSelectedStudentHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDossier(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    try {
      await api.post('/students', formData);
      setAddModalOpen(false);
      fetchStudents();
      // Reset form
      setFormData({
        student_id: '',
        name: '',
        usn: '',
        phone: '',
        email: '',
        department: 'CSE',
        semester: 4,
        room_number: 'Room 01',
        bed_number: 'B1',
        parent_name: '',
        parent_contact: '',
        address: '',
        joining_date: new Date().toISOString().split('T')[0],
        status: 'ACTIVE'
      });
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Error registering student.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEdit = (student) => {
    setEditingStudentId(student.id);
    setEditFormData({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      usn: student.usn || '',
      department: student.department || 'CSE',
      semester: student.semester || 1,
      room_number: student.room_number || 'Room 01',
      bed_number: student.bed_number || 'B1',
      parent_name: student.parent_name || '',
      parent_contact: student.parent_contact || '',
      address: student.address || '',
      status: student.status || 'ACTIVE'
    });
    setEditFormError('');
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditFormError('');
    setEditFormSubmitting(true);
    try {
      await api.put(`/students/${editingStudentId}`, editFormData);
      setEditModalOpen(false);
      toast.success(`Student profile for ${editFormData.name} updated successfully.`);
      fetchStudents();
      if (selectedStudentHistory && selectedStudentHistory.profile?.id === editingStudentId) {
        handleViewDossier(editingStudentId);
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Failed to update student details.';
      setEditFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setEditFormSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = await confirm({
      title: 'Remove Resident',
      message: `Are you sure you want to remove ${name} from hostel records? This will vacate their bed and deactivate their account.`,
      confirmText: 'Remove Resident',
      cancelText: 'Cancel',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/students/${id}`);
      toast.success(`${name} was successfully removed from hostel records.`);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error deleting student.');
    }
  };

  // Rooms 01 to 13 list
  const roomsList = Array.from({ length: 13 }, (_, i) => `Room ${(i + 1).toString().padStart(2, '0')}`);

  const defaultDepartments = [
    'BE', 'BCA', 'B.Com', 'M.Com', 'Diploma', 'Pharmacy', 'B.Pharm', 
    'B.Sc Nursing', 'BA Defence', 'MCA', 'ISG', 'Civil', 'R&AI', 'GTC', 
    'CCE', 'B.Sc.', 'MBA', 'BBA', 'LLB', 'BA', 'General', 'MSc', 'BSE',
    'CSE', 'AIML', 'ISE', 'ECE', 'MECH'
  ];

  const allDepartments = Array.from(
    new Set([...defaultDepartments, ...students.map((s) => s.department).filter(Boolean)])
  ).sort();

  if (activeTab === 'cleaning-room') {
    const initialRoom = searchParams.get('room') || 'ALL';
    return <CleaningRoomPage initialRoom={initialRoom} onBack={() => setSearchParams({})} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Directory & Profiles</h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage student registrations, bed allocations across 13 rooms, and resident meal verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedStudentForShare(null);
              setShareSearch('');
              setShareModalOpen(true);
            }}
            className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-2 cursor-pointer"
            title="Share or Export Student Login Credentials"
          >
            <KeyRound className="w-4 h-4 text-emerald-100" />
            <span>Share & Export Logins</span>
          </button>

          <button
            onClick={() => {
              setFormError('');
              setAddModalOpen(true);
            }}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Student</span>
          </button>
        </div>
      </div>

      {/* Students Section Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className="px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer bg-blue-600 text-white shadow-xs"
        >
          <Users className="w-3.5 h-3.5" />
          <span>All Students ({students.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'cleaning-room' })}
          className="px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-1.5 cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
        >
          <span>🧹</span>
          <span>Cleaning Room (Meal Counts)</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, USN, Student ID, Room..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="">All Departments / Courses</option>
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="">All 13 Rooms</option>
              {roomsList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <button
              type="submit"
              className="py-2 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No students match your query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Student Info</th>
                  <th className="px-4 py-3">USN / ID</th>
                  <th className="px-4 py-3">Dept & Sem</th>
                  <th className="px-4 py-3">Room & Bed</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-400">{s.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-700">{s.usn}</span>
                      <div className="text-[10px] text-slate-400 font-mono">{s.student_id}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {s.department} - Sem {s.semester}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                        {s.room_number} ({s.bed_number})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{s.phone}</div>
                      <div className="text-[10px] text-slate-400">P: {s.parent_contact}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => {
                            setSelectedStudentForShare(s);
                            setShareSearch('');
                            setShareModalOpen(true);
                          }}
                          title="Share / View Login Credentials"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Student Details"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewDossier(s.id)}
                          title="View Full Student Dossier"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          title="Delete Student"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Register New Student" maxWidth="max-w-2xl">
        {formError && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200">
            {formError}
          </div>
        )}

        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Rahul Kumar"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Student ID *</label>
              <input
                type="text"
                required
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                placeholder="e.g. 001"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">USN / Roll Number *</label>
              <input
                type="text"
                required
                value={formData.usn}
                onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
                placeholder="e.g. 001"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. student@hostel.edu"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="10-digit mobile"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Department / Course & Semester *</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <select
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Sem {s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Room Allocation (13 Rooms) *</label>
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
              <label className="block font-bold text-slate-700 mb-1">Bed Allocation *</label>
              <select
                value={formData.bed_number}
                onChange={(e) => setFormData({ ...formData, bed_number: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              >
                {['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'].map((b) => (
                  <option key={b} value={b}>Bed {b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent / Guardian Name *</label>
              <input
                type="text"
                required
                value={formData.parent_name}
                onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                placeholder="Parent's Name"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent Contact Number *</label>
              <input
                type="text"
                required
                value={formData.parent_contact}
                onChange={(e) => setFormData({ ...formData, parent_contact: e.target.value })}
                placeholder="Parent's mobile"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Permanent Residential Address *</label>
            <textarea
              rows="2"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Full home address with city and state"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm disabled:opacity-50"
            >
              {formSubmitting ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Student Profile" maxWidth="max-w-2xl">
        {editFormError && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200">
            {editFormError}
          </div>
        )}

        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Full Name"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">USN / Roll Number</label>
              <input
                type="text"
                value={editFormData.usn}
                onChange={(e) => setEditFormData({ ...editFormData, usn: e.target.value })}
                placeholder="USN / Roll Number"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="Email address"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="text"
                required
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                placeholder="Mobile number"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Department / Course & Semester *</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editFormData.department}
                  onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <select
                  value={editFormData.semester}
                  onChange={(e) => setEditFormData({ ...editFormData, semester: parseInt(e.target.value) })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Sem {s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status *</label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="ALUMNI">ALUMNI</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Room Allocation (13 Rooms) *</label>
              <select
                value={editFormData.room_number}
                onChange={(e) => setEditFormData({ ...editFormData, room_number: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              >
                {roomsList.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bed Allocation *</label>
              <select
                value={editFormData.bed_number}
                onChange={(e) => setEditFormData({ ...editFormData, bed_number: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              >
                {['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'].map((b) => (
                  <option key={b} value={b}>Bed {b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent / Guardian Name</label>
              <input
                type="text"
                value={editFormData.parent_name}
                onChange={(e) => setEditFormData({ ...editFormData, parent_name: e.target.value })}
                placeholder="Parent's Name"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent Contact Number</label>
              <input
                type="text"
                value={editFormData.parent_contact}
                onChange={(e) => setEditFormData({ ...editFormData, parent_contact: e.target.value })}
                placeholder="Parent's Mobile"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Permanent Residential Address</label>
            <textarea
              rows="2"
              value={editFormData.address}
              onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              placeholder="Full home address"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editFormSubmitting}
              className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {editFormSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Dossier Modal (Detailed Profile + Complete History) */}
      <Modal
        isOpen={dossierModalOpen}
        onClose={() => setDossierModalOpen(false)}
        title="Student Comprehensive Dossier"
        maxWidth="max-w-4xl"
      >
        {loadingDossier || !selectedStudentHistory ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading student dossier...</div>
        ) : (
          <div className="space-y-6 text-xs">
            {/* Profile Overview Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">{selectedStudentHistory.profile.name}</h3>
                <p className="text-slate-500 font-medium">
                  {selectedStudentHistory.profile.student_id} | USN: {selectedStudentHistory.profile.usn} | {selectedStudentHistory.profile.department} (Sem {selectedStudentHistory.profile.semester})
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-600">
                  <span className="flex items-center space-x-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> <span>{selectedStudentHistory.profile.phone}</span></span>
                  <span className="flex items-center space-x-1"><Mail className="w-3.5 h-3.5 text-slate-400" /> <span>{selectedStudentHistory.profile.email}</span></span>
                  <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> <span>{selectedStudentHistory.profile.address}</span></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEdit(selectedStudentHistory.profile);
                  }}
                  className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                  title="Edit Student Profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>

                {selectedStudentHistory.cleaning_duty_today?.has_cleaning ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDossierModalOpen(false);
                      setSearchParams({ tab: 'cleaning-room', room: selectedStudentHistory.profile.room_number });
                    }}
                    className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                    title={`Open Cleaning Room (${selectedStudentHistory.profile.room_number} is on cleaning duty today)`}
                  >
                    <span>🧹</span>
                    <span>Cleaning Room (Duty Active)</span>
                  </button>
                ) : (
                  <div className="relative group">
                    <button
                      type="button"
                      disabled
                      className="px-3.5 py-2.5 bg-slate-100 border border-slate-300 text-slate-400 rounded-xl font-bold text-xs flex items-center space-x-1.5 cursor-not-allowed shadow-2xs"
                    >
                      <span>🧹</span>
                      <span>Cleaning Room (No Duty Today)</span>
                    </button>
                    <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-30 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl leading-snug">
                      {selectedStudentHistory.profile.room_number} does not have cleaning duty today ({selectedStudentHistory.cleaning_duty_today?.day_name}). Today's cleaning duty is assigned to: {selectedStudentHistory.cleaning_duty_today?.today_scheduled_rooms?.join(', ') || 'None'}.
                    </div>
                  </div>
                )}

                <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shrink-0 min-w-36">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Attendance Rate</p>
                  <p className="text-2xl font-black text-blue-600">
                    {selectedStudentHistory.attendance_stats.percentage}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedStudentHistory.attendance_stats.present_days}/{selectedStudentHistory.attendance_stats.total_days} Days Present
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-Histories Tabs / Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Attendance History */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <CalendarCheck className="w-4 h-4 text-emerald-600" />
                  <span>Recent Attendance (Last 10 Records)</span>
                </h4>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {selectedStudentHistory.attendance_history.slice(0, 10).map((a) => (
                    <div key={a.id} className="py-1.5 flex justify-between items-center text-[11px]">
                      <span className="text-slate-600 font-mono">{formatDate(a.date)}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : a.status === 'LEAVE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave Applications History */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <PlaneTakeoff className="w-4 h-4 text-blue-600" />
                  <span>Leave History</span>
                </h4>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {selectedStudentHistory.leave_history.length === 0 ? (
                    <p className="text-slate-400 py-3 text-center">No leave applications submitted.</p>
                  ) : (
                    selectedStudentHistory.leave_history.map((l) => (
                      <div key={l.id} className="py-2 text-[11px]">
                        <div className="flex justify-between font-semibold">
                          <span>{formatDate(l.from_date)} &rarr; {formatDate(l.to_date)} ({l.leave_type})</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : l.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {l.status}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-0.5">{l.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Complaints History */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Ticket className="w-4 h-4 text-amber-600" />
                  <span>Complaints / Tickets Filed</span>
                </h4>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {selectedStudentHistory.complaint_history.length === 0 ? (
                    <p className="text-slate-400 py-3 text-center">No complaints filed.</p>
                  ) : (
                    selectedStudentHistory.complaint_history.map((c) => (
                      <div key={c.id} className="py-2 text-[11px]">
                        <div className="flex justify-between font-semibold">
                          <span className="font-mono text-blue-600">{c.ticket_id} - {c.category}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{c.status}</span>
                        </div>
                        <p className="text-slate-600 mt-0.5 line-clamp-1">{c.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Room Cleaning & Maintenance History */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Room Cleaning & Facilities Log</span>
                </h4>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {selectedStudentHistory.cleaning_history.map((cl) => (
                    <div key={cl.id} className="py-1.5 flex justify-between text-[11px]">
                      <span className="text-slate-600">Cleaning: {cl.reason}</span>
                      <span className="font-bold text-slate-700">{cl.status}</span>
                    </div>
                  ))}
                  {selectedStudentHistory.maintenance_history.map((m) => (
                    <div key={m.id} className="py-1.5 flex justify-between text-[11px]">
                      <span className="text-slate-600">Maintenance: {m.category}</span>
                      <span className="font-bold text-slate-700">{m.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Share & Export Student Logins Modal */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setSelectedStudentForShare(null);
        }}
        title="Resident Student Logins & Credential Sharing"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-5 text-xs">
          {/* Top Info & Quick Actions Banner */}
          <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <KeyRound className="w-4 h-4" />
                </span>
                <span className="font-bold text-sm text-slate-100">Official Resident Credentials</span>
                <span className="px-2 py-0.5 bg-emerald-400/10 text-emerald-300 rounded-full font-mono text-[10px] font-semibold border border-emerald-400/20">
                  Password: Student@123
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Students log in using either their <span className="text-amber-300 font-semibold">Student ID</span> (e.g. 001) or <span className="text-amber-300 font-semibold">Email</span> with default password <span className="text-emerald-300 font-mono font-semibold">Student@123</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={copyAllLogins}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-200 font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                title="Copy all student logins to clipboard"
              >
                {bulkCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied All!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                    <span>Copy All Logins</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={downloadLoginsCSV}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs shadow-emerald-950/40"
                title="Download CSV spreadsheet of all student logins"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
            </div>
          </div>

          {/* Focused Single Student Card (if clicked from a table row) */}
          {selectedStudentForShare && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                    {selectedStudentForShare.student_id}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{selectedStudentForShare.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      {selectedStudentForShare.room_number} · Bed {selectedStudentForShare.bed_number} · {selectedStudentForShare.department} (Sem {selectedStudentForShare.semester})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentForShare(null)}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  View All Students
                </button>
              </div>

              {/* Ready Slip Preview */}
              <div className="p-3 bg-white rounded-xl border border-blue-100 font-mono text-[11px] text-slate-700 whitespace-pre-line space-y-1">
                <div>🏛️ <strong>Veerashaiva Lingayath Boys Hostel Portal</strong></div>
                <div>👤 <strong>Resident:</strong> {selectedStudentForShare.name}</div>
                <div>🌐 <strong>Portal:</strong> {window.location.origin}/login</div>
                <div>🔑 <strong>Login Username:</strong> <span className="text-blue-700">{selectedStudentForShare.student_id}</span> (or {selectedStudentForShare.email})</div>
                <div>🔒 <strong>Default Password:</strong> <span className="text-emerald-700 font-bold">Student@123</span></div>
                <div>🛏️ <strong>Room / Bed:</strong> {selectedStudentForShare.room_number}, Bed {selectedStudentForShare.bed_number}</div>
                <div>📱 <strong>Mobile:</strong> {selectedStudentForShare.phone || 'N/A'}</div>
              </div>

              {/* Share buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => shareViaWhatsApp(selectedStudentForShare)}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center space-x-2 cursor-pointer transition shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send via WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyStudentSlip(selectedStudentForShare)}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center space-x-2 cursor-pointer transition shadow-xs"
                >
                  {copiedId === (selectedStudentForShare.id || selectedStudentForShare.student_id) ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Formatted Slip</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Search within Share Modal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by student name, room, USN, or mobile..."
                value={shareSearch}
                onChange={(e) => setShareSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="text-slate-500 font-medium text-[11px] shrink-0">
              Showing {students.filter(s => {
                if (!shareSearch.trim()) return true;
                const q = shareSearch.toLowerCase();
                return (
                  (s.name || '').toLowerCase().includes(q) ||
                  (s.student_id || '').toLowerCase().includes(q) ||
                  (s.usn || '').toLowerCase().includes(q) ||
                  (s.room_number || '').toLowerCase().includes(q) ||
                  (s.email || '').toLowerCase().includes(q) ||
                  (s.phone || '').includes(q)
                );
              }).length} of {students.length} students
            </div>
          </div>

          {/* Student Cards List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {students
              .filter(s => {
                if (!shareSearch.trim()) return true;
                const q = shareSearch.toLowerCase();
                return (
                  (s.name || '').toLowerCase().includes(q) ||
                  (s.student_id || '').toLowerCase().includes(q) ||
                  (s.usn || '').toLowerCase().includes(q) ||
                  (s.room_number || '').toLowerCase().includes(q) ||
                  (s.email || '').toLowerCase().includes(q) ||
                  (s.phone || '').includes(q)
                );
              })
              .map(s => {
                const isCopied = copiedId === (s.id || s.student_id);
                const isPwdCopied = copiedPasswordId === (s.id || s.student_id);
                return (
                  <div
                    key={s.id || s.student_id}
                    className="p-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-2xs hover:shadow-xs"
                  >
                    {/* Student Info */}
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center shrink-0 border border-blue-100">
                        {s.student_id}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs">{s.name}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                            {s.room_number} · Bed {s.bed_number}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>📧 <code className="text-slate-700">{s.email}</code></span>
                          {s.phone && <span>📱 {s.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Password & Share Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => copyPassword(s.id || s.student_id)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200 flex items-center space-x-1 cursor-pointer transition"
                        title="Click to copy password"
                      >
                        {isPwdCopied ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                        <span>Student@123</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => shareViaWhatsApp(s)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition"
                        title="Share credentials on WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => copyStudentSlip(s)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition"
                        title="Copy full formatted credentials slip"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-blue-600" />
                            <span>Copy Slip</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px]">
            <span>💡 Students can also change their password anytime in their profile.</span>
            <button
              type="button"
              onClick={() => {
                setShareModalOpen(false);
                setSelectedStudentForShare(null);
              }}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentsPage;
