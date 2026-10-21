import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/dateUtils';
import { getAuthenticatedDocUrl } from '../../utils/documentUtils';
import {
  PlaneTakeoff,
  Plus,
  FileText,
  Lock,
  CheckCircle2,
  Camera,
  Upload,
  Trash2,
  X,
  ArrowLeft
} from 'lucide-react';

const StudentLeavePage = () => {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState(null);

  // Apply modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [leaveType, setLeaveType] = useState('PERSONAL');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nativeCameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleTakePhoto = () => {
    // On mobile devices, triggering nativeCameraInput launches phone's native camera app
    // producing 12MP-50MP ultra-sharp photos with autofocus, flash, and macro document clarity!
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);
    if (isMobile && nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    } else {
      startCamera();
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }
      // Request maximum High-Definition / 4K resolution constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('HD Camera access error, falling back:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr) {
        setCameraError('Camera permission denied or camera not available. You can also upload a photo from your gallery.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCameraError('');
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError('Camera stream is still starting. Please wait a moment.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `leave_photo_${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        setFile(capturedFile);
        setFilePreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selected));
      } else {
        setFilePreview(null);
      }
    }
  };

  const clearSelectedFile = () => {
    setFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
  };

  const handleCloseModal = () => {
    stopCamera();
    clearSelectedFile();
    setApplyModalOpen(false);
  };

  const fetchLeavesAndRoom = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [leavesRes, roomRes] = await Promise.all([
        api.get('/leaves/my/applications'),
        api.get('/rooms/my/room')
      ]);
      setLeaves(leavesRes.data);
      setRoomInfo(roomRes.data);
    } catch (err) {
      console.error('Error fetching student leave info:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Initial load + Real-time background sync every 3 seconds for room sanitisation status
  useEffect(() => {
    fetchLeavesAndRoom();
    const pollInterval = setInterval(() => {
      fetchLeavesAndRoom(true);
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      stopCamera();
    };
  }, []);

  const isLeaveLocked = roomInfo?.is_leave_locked === true;
  const hasCleaningDuty = roomInfo?.has_cleaning === true;
  const currentCleaningStatus = roomInfo?.cleaning_status || 'PENDING';
  const isCleaningCompleted = currentCleaningStatus === 'COMPLETED';
  const roomNumber = roomInfo?.room_number || 'Your Room';

  const handleApply = async (e) => {
    e.preventDefault();
    setFormError('');

    if (isLeaveLocked) {
      setFormError(`🔒 Leave applications are locked: Daily sanitisation for your on-duty room (${roomNumber}) is incomplete (${currentCleaningStatus}).`);
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('from_date', fromDate);
      formData.append('to_date', toDate);
      formData.append('leave_type', leaveType);
      formData.append('reason', reason);
      if (file) {
        formData.append('document', file);
      }

      await api.post('/leaves', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      handleCloseModal();
      setFromDate('');
      setToDate('');
      setReason('');
      fetchLeavesAndRoom(true);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to submit leave application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Back Button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => navigate('/student/dashboard')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition shadow-2xs cursor-pointer group"
          title="Return to Student Dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Leave Applications & Approvals</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Apply for sanctioned leaves, attach medical/parental certificates, and track Warden reviews.
          </p>
        </div>

        {/* Lock-protected Action Button (Locked ONLY for on-duty cleaning room) */}
        {!isLeaveLocked ? (
          <button
            onClick={() => {
              setFormError('');
              setApplyModalOpen(true);
            }}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Leave Request</span>
          </button>
        ) : (
          <div className="relative group">
            <button
              disabled
              className="py-2.5 px-4 bg-slate-100 border border-slate-300 text-slate-400 rounded-xl text-xs font-bold flex items-center space-x-2 cursor-not-allowed shadow-2xs"
            >
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Submit Leave Request (Locked)</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-20 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl leading-snug">
              Locked until {roomNumber} daily cleaning is completed by staff. Automatically unlocks in real time.
            </div>
          </div>
        )}
      </div>

      {/* REAL-TIME SANITISATION STATUS BANNER (Only displayed if room is on cleaning duty) */}
      {!loading && (
        <>
          {isLeaveLocked ? (
            <div className="p-4 bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border border-red-200/80 rounded-2xl flex items-start space-x-3.5 shadow-2xs">
              <div className="p-2.5 bg-red-100 rounded-xl text-red-600 mt-0.5 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-red-950 text-xs sm:text-sm">
                    🔒 Leave Applications Temporarily Locked for {roomNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                    Cleaning Duty: {currentCleaningStatus}
                  </span>
                </div>
                <p className="text-xs text-red-900/90 leading-relaxed">
                  Your room ({roomNumber}) has cleaning duty scheduled today ({roomInfo?.day_name}). Under hostel safety regulations, residents of cleaning rooms cannot apply for leave until room sanitisation is completed and verified.
                  <strong className="block mt-1 text-red-950">
                    ⚡ Live Status: This page will automatically unlock in real time without refreshing the moment housekeeping marks {roomNumber} as Cleaned.
                  </strong>
                </p>
              </div>
            </div>
          ) : hasCleaningDuty ? (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950 shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950 block">
                    {roomNumber} Daily Sanitisation Completed &bull; Leave Applications Active
                  </span>
                  <span className="text-[11px] text-emerald-800">
                    Room cleaning has been verified completed. All leave privileges are unlocked.
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-extrabold uppercase">
                Cleaned
              </span>
            </div>
          ) : null}
        </>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading leave requests & room status...</div>
      ) : leaves.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          No leave applications submitted yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaves.map((l) => (
            <div
              key={l.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-extrabold text-blue-600 text-xs tracking-wider uppercase block">
                      {l.leave_type} LEAVE
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {formatDate(l.from_date)} &rarr; {formatDate(l.to_date)}
                    </p>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    l.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : l.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {l.status}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="font-bold text-slate-400 text-[10px] uppercase block mb-0.5">Reason</span>
                  <p className="text-slate-700 font-medium">"{l.reason}"</p>
                </div>

                {l.document_url && (
                  <a
                    href={getAuthenticatedDocUrl(l.document_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs text-blue-600 font-bold hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attached Document</span>
                  </a>
                )}

                {l.admin_remarks && (
                  <div className="p-2.5 bg-slate-100/80 rounded-xl text-[11px] text-slate-700">
                    <span className="font-bold block text-slate-900">Warden Remarks:</span>
                    <p className="mt-0.5">{l.admin_remarks}</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                Submitted: {formatDate(l.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply Leave Modal */}
      <Modal
        isOpen={applyModalOpen}
        onClose={handleCloseModal}
        title={`Submit Leave Application (${roomNumber})`}
        maxWidth="max-w-md"
      >
        {formError && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-200">
            {formError}
          </div>
        )}

        <form onSubmit={handleApply} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Departure (From Date) *</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Return (To Date) *</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Classification *</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold"
            >
              <option value="PERSONAL">PERSONAL LEAVE</option>
              <option value="MEDICAL">MEDICAL LEAVE</option>
              <option value="EMERGENCY">FAMILY EMERGENCY</option>
              <option value="OTHER">OTHER / ACADEMIC</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason for Leave *</label>
            <textarea
              rows="3"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason, destination city, and guardian consent..."
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          {/* Supporting Document / Camera Photo Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block font-bold text-slate-700">
              Supporting Document / Proof Photo (Optional)
            </label>

            {/* Hidden Input for File Selector */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Hidden Input for Native Mobile Camera */}
            <input
              ref={nativeCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Action Buttons to Choose Upload or Camera */}
            {!file && !showCamera && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTakePhoto}
                    className="p-3 border-2 border-dashed border-blue-400 hover:border-blue-600 bg-blue-50/70 hover:bg-blue-50 rounded-xl text-blue-700 font-bold flex flex-col items-center justify-center space-y-1 transition cursor-pointer group shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition">
                      <Camera className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-black">HD Phone Camera 📸</span>
                    <span className="text-[10px] text-blue-500 font-medium">Auto-focus document quality</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 font-bold flex flex-col items-center justify-center space-y-1 transition cursor-pointer group shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-200 group-hover:bg-slate-300 flex items-center justify-center transition">
                      <Upload className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="text-xs font-black">Gallery / File 📁</span>
                    <span className="text-[10px] text-slate-500 font-medium">PDF, JPG, or PNG</span>
                  </button>
                </div>

                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="text-[11px] text-slate-400 hover:text-blue-600 underline font-medium cursor-pointer"
                  >
                    Or open live webcam viewfinder
                  </button>
                </div>
              </div>
            )}

            {/* Live Camera Viewfinder */}
            {showCamera && (
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-white">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-blue-400" />
                    Live Camera Viewfinder
                  </span>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {cameraError ? (
                  <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-xs space-y-2">
                    <p>{cameraError}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => nativeCameraInputRef.current?.click()}
                        className="py-1.5 px-3 bg-blue-600 text-white rounded-lg font-bold text-[11px]"
                      >
                        Open Mobile Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-1.5 px-3 bg-slate-800 text-slate-300 rounded-lg font-bold text-[11px]"
                      >
                        Choose File Instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="py-2 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition hover:scale-105"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Snap Photo 📸</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Attached File Preview Card */}
            {file && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5 min-w-0">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Leave Document Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-emerald-300 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-emerald-700" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate text-xs">{file.name}</p>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      {(file.size / 1024).toFixed(1)} KB &bull; Photo / Document Attached ✅
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition shrink-0"
                  title="Remove attachment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isLeaveLocked}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              {submitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <PlaneTakeoff className="w-4 h-4" />
                  <span>Submit Application</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentLeavePage;
