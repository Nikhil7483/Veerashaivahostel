import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import {
  Bed,
  Sparkles,
  Edit3,
  UserPlus,
  CheckCircle2
} from 'lucide-react';

const RoomsPage = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  // Configure room capacity modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [totalBeds, setTotalBeds] = useState(6);
  const [cleaningStatus, setCleaningStatus] = useState('COMPLETED');
  const [nextCleaning, setNextCleaning] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add student to room modal
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [addFormError, setAddFormError] = useState('');
  const [addFormSubmitting, setAddFormSubmitting] = useState(false);
  const [studentForm, setStudentForm] = useState({
    student_id: '',
    name: '',
    usn: '',
    phone: '',
    email: '',
    department: 'BCA',
    semester: 1,
    room_number: 'Room 01',
    bed_number: 'B1',
    parent_name: '',
    parent_contact: '',
    address: 'Bengaluru, Karnataka',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
  });

  const defaultDepartments = [
    'BE', 'BCA', 'B.Com', 'M.Com', 'Diploma', 'Pharmacy', 'B.Pharm',
    'B.Sc Nursing', 'BA Defence', 'MCA', 'ISG', 'Civil', 'R&AI', 'GTC',
    'CCE', 'B.Sc.', 'MBA', 'BBA', 'LLB', 'BA', 'General', 'MSc', 'BSE',
    'CSE', 'AIML', 'ISE', 'ECE', 'MECH'
  ];

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms');
      setRooms(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const openEditModal = (room) => {
    setSelectedRoom(room);
    setTotalBeds(room.total_beds);
    setCleaningStatus(room.cleaning_status);
    setNextCleaning(room.next_cleaning || '');
    setModalError('');
    setEditModalOpen(true);
  };

  const handleUpdateRoom = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');

    try {
      await api.put(`/rooms/${selectedRoom.room_number}`, {
        total_beds: parseInt(totalBeds),
        cleaning_status: cleaningStatus,
        next_cleaning: nextCleaning,
      });
      setEditModalOpen(false);
      setNotice(`✅ Configuration for ${selectedRoom.room_number} updated.`);
      fetchRooms();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to update room configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open add student modal for a specific room
  const openAddStudentModal = (room) => {
    const roomNo = room ? room.room_number : 'Room 01';
    setAddFormError('');

    // Find available bed in target room
    const targetRoomObj = rooms.find((r) => r.room_number === roomNo) || room;
    const occupiedBeds = targetRoomObj?.students?.map((s) => s.bed_number) || [];
    const capacity = targetRoomObj?.total_beds || 6;
    let nextFreeBed = 'B1';
    for (let i = 1; i <= capacity; i++) {
      const b = `B${i}`;
      if (!occupiedBeds.includes(b)) {
        nextFreeBed = b;
        break;
      }
    }

    // Estimate next student ID
    const allStudentsCount = rooms.reduce((acc, r) => acc + (r.students?.length || 0), 0);
    const nextIdNum = (allStudentsCount + 1).toString().padStart(3, '0');

    setStudentForm({
      student_id: nextIdNum,
      name: '',
      usn: nextIdNum,
      phone: '',
      email: '',
      department: 'BCA',
      semester: 1,
      room_number: roomNo,
      bed_number: nextFreeBed,
      parent_name: '',
      parent_contact: '',
      address: 'Bengaluru, Karnataka',
      joining_date: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
    });

    setAddStudentModalOpen(true);
  };

  // When room changes in modal, recalculate free beds
  const handleRoomChangeInModal = (newRoomNo) => {
    setTargetRoomNumber(newRoomNo);
    const targetRoomObj = rooms.find((r) => r.room_number === newRoomNo);
    const occupiedBeds = targetRoomObj?.students?.map((s) => s.bed_number) || [];
    const capacity = targetRoomObj?.total_beds || 6;
    let nextFreeBed = 'B1';
    for (let i = 1; i <= capacity; i++) {
      const b = `B${i}`;
      if (!occupiedBeds.includes(b)) {
        nextFreeBed = b;
        break;
      }
    }

    setStudentForm((prev) => ({
      ...prev,
      room_number: newRoomNo,
      bed_number: nextFreeBed,
    }));
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    setAddFormError('');
    setAddFormSubmitting(true);

    try {
      // Auto-generate email if empty
      const payload = { ...studentForm };
      if (!payload.email) {
        const cleanName = payload.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        payload.email = `${cleanName || 'student'}${payload.student_id}@hostel.edu`;
      }

      await api.post('/students', payload);
      setAddStudentModalOpen(false);
      setNotice(`✅ Student ${studentForm.name} assigned to ${studentForm.room_number} (${studentForm.bed_number}) successfully!`);
      fetchRooms();
    } catch (err) {
      setAddFormError(err.response?.data?.detail || 'Failed to add student to room. Check capacity and bed availability.');
    } finally {
      setAddFormSubmitting(false);
    }
  };

  const roomsList = Array.from({ length: 13 }, (_, i) => `Room ${(i + 1).toString().padStart(2, '0')}`);
  const currentTargetRoomObj = rooms.find((r) => r.room_number === studentForm.room_number);
  const occupiedBedsInTarget = currentTargetRoomObj?.students?.map((s) => s.bed_number) || [];
  const targetTotalBeds = currentTargetRoomObj?.total_beds || 6;
  const availableBedsList = Array.from({ length: targetTotalBeds }, (_, i) => `B${i + 1}`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hostel 13 Rooms Management</h1>
          <p className="text-xs text-slate-500 font-medium">
            Dedicated 13-room configuration &bull; Allocate students &bull; Live bed occupancy &bull; Sanitation control.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => openAddStudentModal(rooms[0])}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Student to Room</span>
          </button>

          <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold bg-white p-2 rounded-xl border border-slate-200">
            <span className="flex items-center space-x-1 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Available Beds</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center space-x-1 text-blue-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              <span>Occupied Beds</span>
            </span>
          </div>
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

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          Loading hostel rooms...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {rooms.map((room) => {
            const isFull = room.available_beds === 0;
            const occupancyPct = Math.round((room.occupied_beds / room.total_beds) * 100);
            const isRoom03 = room.room_number === 'Room 03';

            return (
              <div
                key={room.id || room.room_number}
                className={`rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between ${
                  isRoom03
                    ? 'bg-slate-50/80 border-dashed border-slate-300'
                    : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-md'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`p-2 rounded-xl ${isRoom03 ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                        <Bed className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">{room.room_number}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isRoom03
                            ? 'bg-slate-200 text-slate-700'
                            : isFull
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isRoom03
                            ? 'Vacant (0 Residents)'
                            : isFull
                            ? 'Full Capacity (6/6)'
                            : `${room.available_beds} Beds Free`}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(room)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Configure Beds & Capacity"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Bed Stats Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Occupancy ({occupancyPct}%)</span>
                      <span>{room.occupied_beds} / {room.total_beds} Beds</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.min(100, occupancyPct)}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          isRoom03 ? 'bg-slate-300' : isFull ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                      ></div>
                    </div>
                  </div>

                  {/* Assigned Students List */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Assigned Students ({room.students?.length || 0})
                      </p>
                    </div>

                    {room.students?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        {isRoom03 ? 'Vacant room — no students currently assigned.' : 'No students currently allocated.'}
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {room.students.map((s) => (
                          <div
                            key={s.id || s.student_id}
                            className="p-1.5 bg-slate-50 rounded-lg flex items-center justify-between text-xs hover:bg-slate-100/70 transition"
                          >
                            <div className="truncate mr-2">
                              <span className="font-semibold text-slate-800 block truncate">{s.name}</span>
                              <span className="text-[10px] text-slate-400">{s.department || 'Student'}</span>
                            </div>
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-mono font-bold text-[10px] rounded shrink-0">
                              {s.bed_number}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Student Button on Room Card */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <button
                    onClick={() => openAddStudentModal(room)}
                    disabled={isFull}
                    className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      isFull
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isFull ? 'Room Full' : '+ Add Student to This Room'}</span>
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span className="font-semibold capitalize text-slate-700">{room.cleaning_status}</span>
                    </div>
                    {room.last_cleaned && (
                      <span className="text-[10px] text-slate-400">Cleaned: {room.last_cleaned}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Student to Room Modal */}
      <Modal
        isOpen={addStudentModalOpen}
        onClose={() => setAddStudentModalOpen(false)}
        title={`Add & Allocate Student to ${studentForm.room_number}`}
        maxWidth="max-w-xl"
      >
        {addFormError && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200">
            {addFormError}
          </div>
        )}

        <form onSubmit={handleAddStudentSubmit} className="space-y-4 text-xs">
          {/* Room & Bed Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Room</label>
              <select
                value={studentForm.room_number}
                onChange={(e) => handleRoomChangeInModal(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
              >
                {roomsList.map((r) => {
                  const rObj = rooms.find((rm) => rm.room_number === r);
                  const free = rObj ? rObj.available_beds : 0;
                  return (
                    <option key={r} value={r}>
                      {r} ({free} Beds Free)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bed Number</label>
              <select
                value={studentForm.bed_number}
                onChange={(e) => setStudentForm({ ...studentForm, bed_number: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
              >
                {availableBedsList.map((b) => {
                  const isOcc = occupiedBedsInTarget.includes(b);
                  return (
                    <option key={b} value={b} disabled={isOcc}>
                      {b} {isOcc ? '(Occupied)' : '(Available)'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Student Name & ID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block font-bold text-slate-700 mb-1">Student ID / USN</label>
              <input
                type="text"
                required
                value={studentForm.student_id}
                onChange={(e) => {
                  const val = e.target.value;
                  setStudentForm({ ...studentForm, student_id: val, usn: val });
                }}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                placeholder="e.g. 065"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Student Full Name</label>
              <input
                type="text"
                required
                value={studentForm.name}
                onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
                placeholder="e.g. Prathap K."
              />
            </div>
          </div>

          {/* Course & Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Course / Department</label>
              <select
                value={studentForm.department}
                onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              >
                {defaultDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Semester / Year</label>
              <select
                value={studentForm.semester}
                onChange={(e) => setStudentForm({ ...studentForm, semester: parseInt(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Student Phone</label>
              <input
                type="text"
                required
                value={studentForm.phone}
                onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
                placeholder="+91 98801 23456"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Student Email (Optional)</label>
              <input
                type="email"
                value={studentForm.email}
                onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
                placeholder="Auto-generated if empty"
              />
            </div>
          </div>

          {/* Parent Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent / Guardian Name</label>
              <input
                type="text"
                required
                value={studentForm.parent_name}
                onChange={(e) => setStudentForm({ ...studentForm, parent_name: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
                placeholder="Parent's Name"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Parent Contact Number</label>
              <input
                type="text"
                required
                value={studentForm.parent_contact}
                onChange={(e) => setStudentForm({ ...studentForm, parent_contact: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setAddStudentModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addFormSubmitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50"
            >
              {addFormSubmitting ? 'Registering...' : 'Add Student to Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Room Capacity Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Configure ${selectedRoom?.room_number}`}
        maxWidth="max-w-md"
      >
        {modalError && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200">
            {modalError}
          </div>
        )}

        <form onSubmit={handleUpdateRoom} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Total Bed Capacity</label>
            <input
              type="number"
              min={selectedRoom?.occupied_beds || 1}
              max={12}
              value={totalBeds}
              onChange={(e) => setTotalBeds(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Currently occupied: {selectedRoom?.occupied_beds} beds. Capacity cannot be set below occupied count.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Cleaning Status</label>
            <select
              value={cleaningStatus}
              onChange={(e) => setCleaningStatus(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
            >
              <option value="COMPLETED">COMPLETED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="PENDING">PENDING</option>
              <option value="REQUESTED">REQUESTED</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Next Scheduled Cleaning Date</label>
            <input
              type="date"
              value={nextCleaning}
              onChange={(e) => setNextCleaning(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RoomsPage;
