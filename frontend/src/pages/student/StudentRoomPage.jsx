import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Bed, Users, Phone, Mail, GraduationCap } from 'lucide-react';

const StudentRoomPage = () => {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await api.get('/rooms/my/room');
        setRoom(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading room information...</div>;
  }

  if (!room) {
    return <div className="p-12 text-center text-xs text-slate-400">No room allocated to your profile yet.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Room & Roommates</h1>
        <p className="text-xs text-slate-500 font-medium">
          Accommodation specs, roommate roster, sanitation audit, and personal bed assignment.
        </p>
      </div>

      {/* Room Highlight Card */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Bed className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-black text-slate-900">{room.room_number}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                Your Bed: {room.my_bed}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Hostel Residential Complex &bull; Total Capacity: {room.total_beds} Beds
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-xs text-slate-600 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Housekeeping</span>
            <span className="font-black text-slate-800 text-sm capitalize">{room.cleaning_status}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Cleaned</span>
            <span className="font-bold text-slate-800">{room.last_cleaned || 'Recently'}</span>
          </div>
        </div>
      </div>

      {/* Roommates Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Room Residents ({room.students?.length} Allocated)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {room.students?.map((s) => (
            <div
              key={s.id}
              className={`p-5 rounded-3xl border transition flex flex-col justify-between ${
                s.is_me
                  ? 'bg-blue-50/60 border-blue-300 shadow-xs'
                  : 'bg-white border-slate-200 shadow-xs hover:shadow-md'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {s.name} {s.is_me && <span className="text-blue-600 text-xs">(You)</span>}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">{s.usn}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-mono font-bold text-xs shadow-xs">
                    {s.bed_number}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/90 rounded-xl space-y-1 text-xs text-slate-600">
                  <div className="flex items-center space-x-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold">{s.department} {s.semester ? `&bull; Sem ${s.semester}` : ''}</span>
                  </div>
                  {s.phone && (
                    <div className="flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center space-x-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentRoomPage;
