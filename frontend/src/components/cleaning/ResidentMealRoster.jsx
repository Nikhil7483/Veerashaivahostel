import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Check,
  X,
  Coffee,
  Package,
  Moon,
  Filter,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw
} from 'lucide-react';

// Exactly 12 valid rooms - Room 03 strictly excluded
const VALID_ROOMS = [
  'Room 01',
  'Room 02',
  'Room 04',
  'Room 05',
  'Room 06',
  'Room 07',
  'Room 08',
  'Room 09',
  'Room 10',
  'Room 11',
  'Room 12',
  'Room 13'
];

/**
 * ResidentMealRoster:
 * Beautiful, ultra-intuitive meal headcount taking system for hostel duty rooms and warden.
 * Supports all 3 daily meals per resident:
 * 1. 🍱 Tiffin (Morning Breakfast)
 * 2. 📦 Box (Packed College Lunch Box)
 * 3. 🌙 Night (Evening Mess Dinner)
 *
 * Rules:
 * - If PRESENT: 3 independent toggle choices (Tiffin, Box, Night).
 * - If ABSENT / ON LEAVE: automatically exempt and disabled.
 * - Room-by-room stepping for quick in-person headcount taking.
 */
const ResidentMealRoster = ({
  students = [],
  onToggleStudent,
  onBatchUpdate,
  readOnly = false,
  isWarden = false
}) => {
  const [selectedRoom, setSelectedRoom] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('PRESENT'); // Default to only show present students

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Room 03 strictly excluded
      if (student.room_number === 'Room 03') return false;

      // Room filter
      if (selectedRoom !== 'ALL' && student.room_number !== selectedRoom) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = student.name?.toLowerCase().includes(q);
        const roomMatch = student.room_number?.toLowerCase().includes(q);
        const idMatch = student.student_id?.toLowerCase().includes(q);
        const bedMatch = student.bed_number?.toString().includes(q);
        if (!nameMatch && !roomMatch && !idMatch && !bedMatch) return false;
      }

      // Status filter
      const isPresent = Boolean(student.is_present || student.attendance_status === 'PRESENT');
      if (statusFilter === 'PRESENT' && !isPresent) return false;
      if (statusFilter === 'TIFFIN' && (!isPresent || !student.tiffin_required)) return false;
      if (statusFilter === 'BOX' && (!isPresent || !student.box_required)) return false;
      if (statusFilter === 'NIGHT' && (!isPresent || !student.night_required)) return false;
      if (statusFilter === 'EXEMPT' && isPresent) return false;

      return true;
    });
  }, [students, selectedRoom, searchQuery, statusFilter]);

  // Overall totals across ALL students
  const totalStats = useMemo(() => {
    let total = 0;
    let present = 0;
    let absent = 0;
    let leave = 0;
    let tiffin = 0;
    let box = 0;
    let night = 0;

    students.forEach((s) => {
      if (s.room_number === 'Room 03') return;
      total += 1;
      const isPres = Boolean(s.is_present || s.attendance_status === 'PRESENT');
      if (isPres) {
        present += 1;
        if (s.tiffin_required) tiffin += 1;
        if (s.box_required) box += 1;
        if (s.night_required !== false) night += 1;
      } else if (s.attendance_status === 'LEAVE') {
        leave += 1;
      } else {
        absent += 1;
      }
    });

    return { total, present, absent, leave, tiffin, box, night };
  }, [students]);


  // Step room navigation
  const handleNextRoom = () => {
    if (selectedRoom === 'ALL') {
      setSelectedRoom(VALID_ROOMS[0]);
    } else {
      const idx = VALID_ROOMS.indexOf(selectedRoom);
      const nextIdx = (idx + 1) % VALID_ROOMS.length;
      setSelectedRoom(VALID_ROOMS[nextIdx]);
    }
  };

  const handlePrevRoom = () => {
    if (selectedRoom === 'ALL') {
      setSelectedRoom(VALID_ROOMS[VALID_ROOMS.length - 1]);
    } else {
      const idx = VALID_ROOMS.indexOf(selectedRoom);
      const prevIdx = (idx - 1 + VALID_ROOMS.length) % VALID_ROOMS.length;
      setSelectedRoom(VALID_ROOMS[prevIdx]);
    }
  };

  // Quick batch actions
  const handleBatch = (field, val) => {
    if (readOnly || !onBatchUpdate) return;
    onBatchUpdate(field, val, selectedRoom === 'ALL' ? null : selectedRoom);
  };

  const handleAllThreeOn = () => {
    if (readOnly || !onBatchUpdate) return;
    const targetRoom = selectedRoom === 'ALL' ? null : selectedRoom;
    onBatchUpdate('tiffin_required', true, targetRoom);
    onBatchUpdate('box_required', true, targetRoom);
    onBatchUpdate('night_required', true, targetRoom);
  };

  return (
    <div className="space-y-4">
      {/* 1. VIBRANT HEADCOUNT SUMMARY BAR */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 block">
                {isWarden ? 'Warden Official Headcount Review' : 'Today\'s Meal Count Taking Roster'}
              </span>
              <span className="text-base font-black text-white">
                {totalStats.present} Present / {totalStats.total} Total Residents
              </span>
            </div>
          </div>

          {/* Meal Counters with Distinct Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Tiffin */}
            <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 text-amber-200 text-xs font-black flex items-center space-x-1.5 shadow-2xs">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>🍱 Tiffin: <strong>{totalStats.tiffin}</strong></span>
            </div>

            {/* 2. Box */}
            <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/40 text-blue-200 text-xs font-black flex items-center space-x-1.5 shadow-2xs">
              <Package className="w-4 h-4 text-blue-400" />
              <span>📦 Box: <strong>{totalStats.box}</strong></span>
            </div>

            {/* 3. Night */}
            <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-400/40 text-purple-200 text-xs font-black flex items-center space-x-1.5 shadow-2xs">
              <Moon className="w-4 h-4 text-purple-300" />
              <span>🌙 Night: <strong>{totalStats.night}</strong></span>
            </div>

            {/* Exempt */}
            {(totalStats.absent > 0 || totalStats.leave > 0) && (
              <span className="px-3 py-1.5 rounded-xl bg-white/10 text-slate-300 text-xs font-semibold">
                Exempt: {totalStats.absent + totalStats.leave}
              </span>
            )}
          </div>
        </div>

        {/* Room Navigation Pill Stepper */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrevRoom}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center space-x-1"
              title="Previous Room"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline font-bold">Prev</span>
            </button>
            <span className="font-extrabold text-indigo-200">
              {selectedRoom === 'ALL' ? 'All 12 Rooms Active' : `Active: ${selectedRoom}`}
            </span>
            <button
              type="button"
              onClick={handleNextRoom}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center space-x-1"
              title="Next Room"
            >
              <span className="hidden sm:inline font-bold">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Click 🍱 Tiffin, 📦 Box, or 🌙 Night per student to toggle choices.
          </span>
        </div>
      </div>

      {/* 2. QUICK BATCH ACTIONS & SEARCH TOOLBAR */}
      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, bed, room..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Room Filter Dropdown */}
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            title="Filter by room"
          >
            <option value="ALL">All 12 Rooms</option>
            {VALID_ROOMS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Select Option like Present Students Count */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <Filter className="w-4 h-4 text-indigo-600 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              title="Select option like present students count to filter view"
            >
              <option value="PRESENT">Present Students Only ({totalStats.present}) [Default]</option>
              <option value="ALL">All Residents ({totalStats.total})</option>
              <option value="TIFFIN">🍱 Tiffin Required ({totalStats.tiffin})</option>
              <option value="BOX">📦 Box Required ({totalStats.box})</option>
              <option value="NIGHT">🌙 Night Dinner ({totalStats.night})</option>
              <option value="EXEMPT">⚠️ Absent / On Leave ({totalStats.absent + totalStats.leave})</option>
            </select>
          </div>
        </div>

        {/* Batch Shortcuts */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleAllThreeOn}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center space-x-1"
              title="Turn on Tiffin, Box, and Night for all present students in current view"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>All Present ({totalStats.present}) 3 Meals ON</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'PRESENT' ? 'ALL' : 'PRESENT')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center space-x-1 ${
                statusFilter === 'PRESENT'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                  : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
              title="Filter to present students only"
            >
              <span>{statusFilter === 'PRESENT' ? '✓ Showing Present' : `Show Present (${totalStats.present})`}</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatch('tiffin_required', true)}
              className="px-2 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              🍱 All Tiffin
            </button>

            <button
              type="button"
              onClick={() => handleBatch('box_required', true)}
              className="px-2 py-1.5 bg-white hover:bg-blue-50 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              📦 All Box
            </button>

            <button
              type="button"
              onClick={() => handleBatch('night_required', true)}
              className="px-2 py-1.5 bg-white hover:bg-purple-50 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              🌙 All Night
            </button>

            <button
              type="button"
              onClick={() => handleBatch('box_required', false)}
              className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Clear all box selections"
            >
              Clear Box
            </button>
          </div>
        )}
      </div>

      {/* 4. STUDENT LIST CARDS */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">No students found matching your criteria.</p>
            <p className="text-[11px] text-slate-400">Clear search or switch to "All Rooms".</p>
          </div>
        ) : (
          filteredStudents.map((s) => {
            const isPresent = Boolean(s.is_present || s.attendance_status === 'PRESENT');
            const isLeave = s.attendance_status === 'LEAVE';
            const isTiffinOn = Boolean(s.tiffin_required);
            const isBoxOn = Boolean(s.box_required);
            const isNightOn = s.night_required !== false; // defaults to true if present

            return (
              <div
                key={s.student_id}
                className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  !isPresent
                    ? 'bg-slate-50/70 border-slate-200 opacity-60'
                    : isTiffinOn || isBoxOn || isNightOn
                    ? 'bg-white border-slate-300 shadow-2xs hover:border-indigo-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Student Info */}
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                      !isPresent
                        ? 'bg-slate-200 text-slate-500'
                        : isBoxOn
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {s.room_number ? s.room_number.replace('Room ', 'R') : 'R'}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-black text-slate-900">{s.name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700">
                        Bed {s.bed_number}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-0.5 text-xs text-slate-500">
                      <span className="font-bold text-slate-700">{s.room_number}</span>
                      <span>&bull;</span>
                      <span>{s.department || 'AIML'}</span>
                      {!isPresent && (
                        <>
                          <span>&bull;</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                              isLeave ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isLeave ? '🌴 On Leave' : '🚫 Absent'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* THE 3 DISTINCT OPTIONS: TIFFIN, BOX, NIGHT */}
                {isPresent ? (
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* 1. 🍱 TIFFIN (Breakfast) */}
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onToggleStudent && onToggleStudent(s.student_id, 'tiffin_required')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1.5 transition cursor-pointer border ${
                        isTiffinOn
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                      } ${readOnly ? 'cursor-default opacity-90' : ''}`}
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      <span>Tiffin</span>
                      {isTiffinOn ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <X className="w-3 h-3 text-slate-400" />
                      )}
                    </button>

                    {/* 2. 📦 BOX (College Lunch Box) */}
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onToggleStudent && onToggleStudent(s.student_id, 'box_required')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1.5 transition cursor-pointer border ${
                        isBoxOn
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-700 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                      } ${readOnly ? 'cursor-default opacity-90' : ''}`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Box</span>
                      {isBoxOn ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <X className="w-3 h-3 text-slate-400" />
                      )}
                    </button>

                    {/* 3. 🌙 NIGHT (Dinner) */}
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onToggleStudent && onToggleStudent(s.student_id, 'night_required')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1.5 transition cursor-pointer border ${
                        isNightOn
                          ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white border-purple-700 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                      } ${readOnly ? 'cursor-default opacity-90' : ''}`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Night</span>
                      {isNightOn ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <X className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-bold shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>Exempt from meals ({isLeave ? 'On Leave' : 'Absent'})</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ResidentMealRoster;
