import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { useAuth } from '../context/AuthContext';
import {
  QrCode,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Camera,
  Upload,
  UserCheck,
  RefreshCw,
  Search,
  Sparkles,
  Check,
  Calendar,
  Smartphone,
  Info,
  XCircle,
  User as UserIcon,
  Plus,
  Radio,
  Sliders,
  X,
  ChevronDown,
  Bike,
  Image as ImageIcon,
  Zap,
} from 'lucide-react';
import { store } from '../lib/db';
import { BikeInfo } from '../types';

import { TabType } from './Navigation';

interface Attendance {
  name: string;
  memberId: string;
  network: string;
  date: string;
  time: string;
  avatar?: string;
  bikeInfo?: BikeInfo;
  isRegistered?: boolean;
}

interface Activity {
  id: string;
  name: string;
  date: string;
  status: 'Open' | 'Closed';
  attendance: Attendance[];
}

interface QRScanProps {
  setActiveTab?: (tab: TabType) => void;
}

export const QRScan: React.FC<QRScanProps> = ({ setActiveTab }) => {
  const { currentUser } = useAuth();
  const isMember = currentUser?.role === 'Member' || currentUser?.role?.toLowerCase() === 'member';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(true);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [scannedMemberModal, setScannedMemberModal] = useState<Attendance | null>(null);
  const [alreadyScannedMemberModal, setAlreadyScannedMemberModal] = useState<Attendance | null>(null);
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [manualInputId, setManualInputId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedTextRef = useRef<string>('');

  // Audio BEEP feedback on scan
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.log('Audio play failed', e);
    }
  };

  const doVibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
  };

  // Load activities from database
  const loadActivities = () => {
    fetch('/api/mongodb/activities')
      .then(res => res.json())
      .then(data => {
        const loaded: Activity[] = data.data || [];
        setActivities(loaded);
        if (loaded.length > 0 && !selectedActivityId) {
          const openOne = loaded.find(a => a.status === 'Open') || loaded[0];
          setSelectedActivityId(openOne.id);
        }
      })
      .catch(err => console.error('Error fetching activities:', err));
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const selectedActivity = activities.find(a => a.id === selectedActivityId);

  // Intelligent QR parser
  const parseQRCodeText = (decodedText: string): Attendance => {
    const trimmed = decodedText.trim();
    const users = store.getUsers();

    // Helper to find user from store
    const findUser = (queryIdOrName?: string) => {
      if (!queryIdOrName) return null;
      const q = queryIdOrName.trim().toLowerCase();
      const qClean = q.replace(/[^a-z0-9]/g, '');

      return users.find(u => {
        const memNo = (u.memberNumber || '').toLowerCase();
        const memNoClean = memNo.replace(/[^a-z0-9]/g, '');
        const uid = (u.id || '').toLowerCase();
        const uidClean = uid.replace(/[^a-z0-9]/g, '');
        const uname = (u.name || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();

        return (
          memNo === q ||
          (memNoClean.length > 0 && memNoClean === qClean) ||
          uid === q ||
          (uidClean.length > 0 && uidClean === qClean) ||
          uname === q ||
          username === q ||
          email === q
        );
      }) || null;
    };

    // 1. JSON Format
    try {
      const json = JSON.parse(trimmed);
      if (json.memberId || json.name) {
        const matchedUser = findUser(json.memberId) || findUser(json.name);
        return {
          name: matchedUser ? matchedUser.name : (json.name || 'Unregistered'),
          memberId: matchedUser ? (matchedUser.memberNumber || matchedUser.id) : (json.memberId || trimmed),
          network: matchedUser?.network || matchedUser?.chapter || json.network || json.chapter || 'Main Chapter',
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          avatar: matchedUser?.avatar || json.avatar,
          bikeInfo: matchedUser?.bikeInfo || json.bikeInfo || json.motorcycle,
          isRegistered: Boolean(matchedUser)
        };
      }
    } catch (e) {
      // Not JSON
    }

    // 2. Member ID / Verification pass string format
    if (trimmed.includes('Member ID:')) {
      const idMatch = trimmed.match(/Member ID:\s*([^\n]+)/i);
      const lastMatch = trimmed.match(/Last Name:\s*([^\n]+)/i);
      const firstMatch = trimmed.match(/First Name:\s*([^\n]+)/i);

      const memberId = idMatch ? idMatch[1].trim() : '';
      const lastName = lastMatch ? lastMatch[1].trim() : '';
      const firstName = firstMatch ? firstMatch[1].trim() : '';
      const fullName = `${firstName} ${lastName}`.trim();

      const matchedUser = findUser(memberId) || findUser(fullName);

      return {
        name: matchedUser ? matchedUser.name : (fullName || 'Unregistered'),
        memberId: matchedUser ? (matchedUser.memberNumber || matchedUser.id) : (memberId || trimmed),
        network: matchedUser?.network || matchedUser?.chapter || 'Main Chapter',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        avatar: matchedUser?.avatar,
        bikeInfo: matchedUser?.bikeInfo,
        isRegistered: Boolean(matchedUser)
      };
    }

    // 3. Raw user ID or Member number lookup in store
    const matchedUser = findUser(trimmed);

    if (matchedUser) {
      return {
        name: matchedUser.name,
        memberId: matchedUser.memberNumber || matchedUser.id,
        network: matchedUser.network || matchedUser.chapter || 'Main Chapter',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        avatar: matchedUser.avatar,
        bikeInfo: matchedUser.bikeInfo,
        isRegistered: true
      };
    }

    // 4. Default fallback (Not registered)
    return {
      name: 'Unregistered Member',
      memberId: trimmed,
      network: 'N/A',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      avatar: undefined,
      bikeInfo: undefined,
      isRegistered: false
    };
  };

  const handleScannedData = async (decodedText: string) => {
    if (!selectedActivityId) return;

    // Debounce duplicate scans within 2.5s
    const now = Date.now();
    if (decodedText === lastScannedTextRef.current && now - lastScannedTimeRef.current < 2500) {
      return;
    }
    lastScannedTextRef.current = decodedText;
    lastScannedTimeRef.current = now;

    playBeep();
    doVibrate();

    const parsedData = parseQRCodeText(decodedText);

    // If Member ID / QR code is NOT registered, do NOT record attendance!
    if (!parsedData.isRegistered) {
      setScanSuccessMessage(`❌ Attendance NOT recorded. Member ID "${decodedText}" is not registered in the system.`);
      setTimeout(() => setScanSuccessMessage(null), 6000);
      return;
    }

    let isAlreadyScanned = false;

    setActivities(prev => prev.map(a => {
      if (a.id === selectedActivityId) {
        const memIdClean = (parsedData.memberId || '').toLowerCase().trim();
        const memNameClean = (parsedData.name || '').toLowerCase().trim();

        const alreadyInActivity = a.attendance.some(att => {
          const attIdClean = (att.memberId || '').toLowerCase().trim();
          const attNameClean = (att.name || '').toLowerCase().trim();
          if (memIdClean && attIdClean && memIdClean === attIdClean) return true;
          if (memNameClean && attNameClean && attNameClean !== 'member' && memNameClean === attNameClean) return true;
          return false;
        });

        if (alreadyInActivity) {
          isAlreadyScanned = true;
          return a;
        }

        const updatedActivity = {
          ...a,
          attendance: [parsedData, ...a.attendance]
        };

        // Save updated activity to database
        fetch('/api/mongodb/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedActivity)
        }).catch(err => console.error('Error saving activity:', err));

        return updatedActivity;
      }
      return a;
    }));

    if (isAlreadyScanned) {
      setScannedMemberModal(null);
      setAlreadyScannedMemberModal(parsedData);
      setScanSuccessMessage(`⚠️ Member is already scanned! (${parsedData.name})`);
      setTimeout(() => setScanSuccessMessage(null), 4000);
      return;
    }

    // Save entry to MongoDB "attendanceLogs" collection table
    const activeAct = activities.find(a => a.id === selectedActivityId);
    const eventName = activeAct?.name || 'General Event';
    const eventDate = activeAct?.date || new Date().toISOString().split('T')[0];

    const matchedUser = store.getUsers().find(u =>
      u.memberNumber?.toLowerCase() === parsedData.memberId.toLowerCase() ||
      u.id.toLowerCase() === parsedData.memberId.toLowerCase() ||
      u.name.toLowerCase() === parsedData.name.toLowerCase()
    );

    let firstName = matchedUser?.firstName || '';
    let lastName = matchedUser?.lastName || '';

    if (!firstName || !lastName) {
      const parts = parsedData.name.trim().split(' ');
      if (parts.length > 1) {
        firstName = firstName || parts[0];
        lastName = lastName || parts.slice(1).join(' ');
      } else {
        firstName = firstName || parsedData.name;
        lastName = lastName || '';
      }
    }

    const network = parsedData.network || matchedUser?.network || matchedUser?.chapter || 'Main Chapter';
    const dateStamp = parsedData.date || new Date().toLocaleDateString('en-US');
    const timeStamp = parsedData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const attendanceLogEntry = {
      id: `attlog_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      activityId: selectedActivityId,
      "Activity ID": selectedActivityId,
      "Event Name": eventName,
      "Event Date": eventDate,
      "Member ID": parsedData.memberId,
      "Last Name": lastName,
      "First Name": firstName,
      "Network": network,
      "Date Stamp": dateStamp,
      "Time Stamp": timeStamp,
      eventName,
      eventDate,
      memberId: parsedData.memberId,
      lastName,
      firstName,
      network,
      dateStamp,
      timeStamp,
      createdAt: new Date().toISOString()
    };

    fetch('/api/mongodb/attendanceLogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceLogEntry)
    }).catch(err => console.error('Error saving to mongodb attendanceLogs:', err));

    setScannedMemberModal(parsedData);
    setScanSuccessMessage(`✅ Successfully recorded attendance for ${parsedData.name} (${parsedData.memberId})!`);
    setTimeout(() => setScanSuccessMessage(null), 5000);
  };

  // Toggle flashlight / torch on camera stream if available
  const toggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
          if (capabilities && capabilities.torch) {
            const newTorch = !torchOn;
            await track.applyConstraints({
              advanced: [{ torch: newTorch }]
            } as any);
            setTorchOn(newTorch);
          } else {
            setTorchOn(!torchOn);
          }
        } catch (e) {
          setTorchOn(!torchOn);
        }
      }
    } else {
      setTorchOn(!torchOn);
    }
  };

  // Toggle front/back camera facing or cycle cameras
  const toggleCameraFacing = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCam = cameras[nextIndex];
      setSelectedCameraId(nextCam.id);
      startCamera(nextCam.id);
    } else {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      startCamera(undefined, nextFacing);
    }
  };

  // Stop camera stream & frame loop
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
    setTorchOn(false);
  };

  // Start native camera stream with jsQR frame scanner
  const startCamera = async (camDeviceId?: string, camFacing?: 'environment' | 'user') => {
    setCameraError(null);
    setIsDetecting(true);

    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not supported in this browser.');
      }

      // 1. Fetch available cameras
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices.map((d, i) => ({
          id: d.deviceId,
          label: d.label || `Camera ${i + 1}`
        })));
      } catch (e) {
        console.warn('enumerateDevices error:', e);
      }

      // 2. Request user media video stream
      const activeCamId = camDeviceId !== undefined ? camDeviceId : selectedCameraId;
      const activeFacing = camFacing || facingMode;

      const constraints: MediaStreamConstraints = {
        video: activeCamId
          ? { deviceId: { exact: activeCamId } }
          : { facingMode: { ideal: activeFacing } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Update camera list after permission granted
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices.map((d, i) => ({
          id: d.deviceId,
          label: d.label || `Camera ${i + 1}`
        })));
      } catch (e) {}

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.warn('Video play catch:', e));
      }

      setScanning(true);
      setCameraError(null);

      // 3. Continuous frame scanner loop using jsQR
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const scanFrame = () => {
        const video = videoRef.current;
        if (video && video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            handleScannedData(code.data);
          }
        }
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      };

      animationFrameRef.current = requestAnimationFrame(scanFrame);

    } catch (err: any) {
      console.error('Camera start error:', err);
      setScanning(false);
      const msg = err?.message || String(err);
      if (err.name === 'NotAllowedError' || msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setCameraError('Camera access was blocked by browser permissions. Please check camera permission settings in your browser address bar.');
      } else if (err.name === 'NotFoundError' || msg.includes('NotFoundError') || msg.includes('no camera')) {
        setCameraError('No active camera hardware detected. Use QR Image Upload or Manual ID Entry below.');
      } else {
        setCameraError(`Camera initialisation message: ${msg}`);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // Auto-start camera automatically whenever component is rendered or active activity changes
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [selectedActivityId]);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    startCamera(newId);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleScannedData(code.data);
          } else {
            setScanSuccessMessage("⚠️ No valid QR code detected in the uploaded image.");
            setTimeout(() => setScanSuccessMessage(null), 4000);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Manual ID submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInputId.trim()) return;
    handleScannedData(manualInputId.trim());
    setManualInputId('');
  };

  if (isMember) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-stone-200 text-center relative animate-scaleUp">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h3 className="font-heading text-xl font-extrabold text-[#1b4332] mb-2">
            Access Restricted
          </h3>

          <p className="text-stone-800 font-extrabold text-sm sm:text-base mb-2">
            You are not an officer and not allowed to scan
          </p>

          <p className="text-stone-500 text-xs mb-6 leading-relaxed">
            Only designated club officers are authorized to scan member attendance QR codes for events.
          </p>

          <button
            type="button"
            onClick={() => setActiveTab?.('profile')}
            className="w-full py-3.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer active:scale-95"
          >
            Go Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-black flex flex-col justify-between overflow-hidden w-full h-[100dvh]">
      {/* Toast Notification */}
      {scanSuccessMessage && (
        <div className="absolute top-16 left-4 right-4 z-50 p-4 rounded-2xl border text-xs font-bold shadow-2xl transition-all flex items-center justify-between animate-fadeIn backdrop-blur-md bg-stone-900/90 text-emerald-300 border-emerald-500/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{scanSuccessMessage}</span>
          </div>
          <button onClick={() => setScanSuccessMessage(null)} className="text-gray-400 hover:text-white font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Hidden File Input for QR Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* TOP BAR OVERLAY CONTROLS (Matches screenshot: Gallery | Flash | Camera Switch | Close) */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        {/* Left: Gallery / Upload Icon */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload QR Image from Gallery"
          className="w-11 h-11 rounded-2xl bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/20 text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg"
        >
          <ImageIcon className="w-5 h-5 text-[#74c69d]" />
        </button>

        {/* Center: Flash / Torch Toggle & Camera Selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTorch}
            title={torchOn ? "Turn Flash Off" : "Turn Flash On"}
            className={`w-11 h-11 rounded-2xl backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg ${
              torchOn
                ? 'bg-emerald-500 text-white border-emerald-300 shadow-emerald-500/50'
                : 'bg-black/40 hover:bg-black/60 border-white/20 text-white'
            }`}
          >
            <Zap className={`w-5 h-5 ${torchOn ? 'fill-white text-white' : 'text-[#74c69d]'}`} />
          </button>

          {cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={handleCameraChange}
              className="font-bold bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-2 text-white focus:outline-none cursor-pointer text-xs"
            >
              {cameras.map((c, index) => (
                <option key={c.id} value={c.id} className="bg-stone-900 text-white">
                  {c.label || `Cam ${index + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Camera Flip / Switch & Close Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCameraFacing}
            title="Switch Camera Facing"
            className="w-11 h-11 rounded-2xl bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/20 text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg"
          >
            <RefreshCw className="w-5 h-5 text-[#74c69d]" />
          </button>

          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              title="Close QR Scanner"
              className="w-11 h-11 rounded-2xl bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/20 text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg"
            >
              <X className="w-5 h-5 text-gray-300 hover:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* FULL SCREEN CAMERA VIEWPORT */}
      <div className="relative w-full h-full flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${!scanning ? 'hidden' : 'block'}`}
        />

        {/* CENTER TARGET SCANNER FRAME (Emerald theme) */}
        <div className="absolute inset-0 flex items-center justify-center p-6 z-20 pointer-events-none">
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 max-w-[82vw] max-h-[82vw]">
            {/* 4 Corner L-Brackets */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-[5px] border-l-[5px] border-[#74c69d] rounded-tl-2xl drop-shadow-[0_0_12px_rgba(116,198,157,0.9)]" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-[5px] border-r-[5px] border-[#74c69d] rounded-tr-2xl drop-shadow-[0_0_12px_rgba(116,198,157,0.9)]" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[5px] border-l-[5px] border-[#74c69d] rounded-bl-2xl drop-shadow-[0_0_12px_rgba(116,198,157,0.9)]" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[5px] border-r-[5px] border-[#74c69d] rounded-br-2xl drop-shadow-[0_0_12px_rgba(116,198,157,0.9)]" />

            {/* Animated Laser Scan Line */}
            {scanning && (
              <div className="absolute left-2 right-2 h-1 bg-gradient-to-r from-[#74c69d] via-emerald-300 to-[#74c69d] rounded-full shadow-[0_0_18px_#74c69d] animate-laser-scan z-20" />
            )}

            {/* Translucent Target Overlay */}
            <div className="absolute inset-2 border border-white/10 rounded-2xl bg-emerald-500/5 backdrop-contrast-125" />
          </div>
        </div>

        {/* Paused state overlay */}
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 bg-black/90 backdrop-blur-md z-20">
            <Camera className="w-16 h-16 text-emerald-400 opacity-90" />
            <p className="text-sm font-bold text-gray-200">Camera Scanner Paused</p>
            <button
              type="button"
              onClick={() => startCamera()}
              className="px-6 py-3 bg-[#2d6a4f] hover:bg-[#1b4332] text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-xl active:scale-95"
            >
              Enable Camera
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROL OVERLAY */}
      <div className="absolute bottom-20 sm:bottom-6 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20 text-white/90 text-xs font-semibold">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Point camera at learner's QR code</span>
        </div>

        <div className="flex items-center justify-between w-full max-w-sm gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowEventModal(true)}
            className="flex-1 py-2.5 px-4 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs font-bold rounded-2xl border border-white/20 truncate transition-all cursor-pointer text-center shadow-lg"
          >
            Event: {selectedActivity?.name || 'General Event'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (scanning) stopCamera();
              else startCamera();
            }}
            className="py-2.5 px-4 bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-xs font-extrabold rounded-2xl border border-[#74c69d]/40 transition-all cursor-pointer shrink-0 shadow-lg active:scale-95"
          >
            {scanning ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>

      {/* Change Event Context Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl relative space-y-5 border border-[#e2ece2]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2d6a4f]" />
                <h3 className="font-extrabold text-[#1b4332] text-sm">Select Active Event Context</h3>
              </div>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activities.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No events found.</p>
              ) : (
                activities.map(act => (
                  <button
                    key={act.id}
                    onClick={() => {
                      setSelectedActivityId(act.id);
                      setShowEventModal(false);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                      act.id === selectedActivityId
                        ? 'border-[#2d6a4f] bg-[#f7f9f7] font-extrabold text-[#1b4332]'
                        : 'border-[#e2ece2] hover:bg-stone-50 text-[#52605d]'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-[#1b4332]">{act.name}</p>
                      <p className="text-[11px] text-[#52605d]">
                        Date: {new Date(act.date).toLocaleDateString()} | Records: {act.attendance.length}
                      </p>
                    </div>
                    {act.id === selectedActivityId && (
                      <CheckCircle className="w-4 h-4 text-[#2d6a4f]" />
                    )}
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowEventModal(false)}
              className="w-full py-3 bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-extrabold text-xs rounded-2xl transition-colors cursor-pointer"
            >
              Done / Save Choice
            </button>
          </div>
        </div>
      )}

      {/* Scanned Verification Modal Dialog */}
      {scannedMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative space-y-4 border border-[#e2ece2]">
            <button
              onClick={() => setScannedMemberModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3 pt-2">
              {/* Member Avatar */}
              <div className="relative">
                {scannedMemberModal.avatar ? (
                  <img
                    src={scannedMemberModal.avatar}
                    alt={scannedMemberModal.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-[#74c69d] shadow-md"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
                    <UserIcon className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  Verification Success
                </span>
                <h3 className="text-lg font-extrabold text-[#1b4332] mt-2">
                  {scannedMemberModal.name}
                </h3>
                <p className="text-xs font-mono font-bold text-[#2d6a4f]">
                  Member ID: #{scannedMemberModal.memberId}
                </p>
                <p className="text-xs text-[#52605d]">
                  Network / Chapter: {scannedMemberModal.network}
                </p>
              </div>
            </div>

            {/* Registered Motorcycle Details */}
            <div className="p-3 bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] text-xs space-y-2">
              <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2ece2]">
                <Bike className="w-4 h-4 text-[#2d6a4f]" />
                <span className="font-extrabold text-[#1b4332]">Registered Motorcycle</span>
              </div>
              {scannedMemberModal.bikeInfo && (scannedMemberModal.bikeInfo.make || scannedMemberModal.bikeInfo.model) ? (
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#52605d]">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400">Make & Model</span>
                    <strong className="text-[#1b4332]">{scannedMemberModal.bikeInfo.make || ''} {scannedMemberModal.bikeInfo.model || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400">Model Year</span>
                    <strong className="text-[#1b4332]">{scannedMemberModal.bikeInfo.year || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400">Displacement</span>
                    <strong className="text-[#2d6a4f]">{scannedMemberModal.bikeInfo.engineCc ? (scannedMemberModal.bikeInfo.engineCc.toString().toLowerCase().endsWith('cc') ? scannedMemberModal.bikeInfo.engineCc : `${scannedMemberModal.bikeInfo.engineCc} cc`) : 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400">Plate Number</span>
                    <strong className="text-[#1b4332] font-mono">{scannedMemberModal.bikeInfo.licensePlate || scannedMemberModal.bikeInfo.plateNo || 'N/A'}</strong>
                  </div>
                </div>
              ) : (
                <p className="text-[#52605d] text-center text-[11px] py-1 italic">No motorcycle details recorded</p>
              )}
            </div>

            {/* Event Attendance Context */}
            <div className="p-2.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-xs text-center space-y-0.5">
              <p className="font-bold text-[#1b4332]">Recorded for Event:</p>
              <p className="text-[#2d6a4f] font-bold">{selectedActivity?.name || 'General Event'}</p>
              <p className="text-[11px] text-[#52605d] font-mono">{scannedMemberModal.date} {scannedMemberModal.time}</p>
            </div>

            <button
              onClick={() => setScannedMemberModal(null)}
              className="w-full py-3 bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-extrabold text-xs rounded-2xl shadow-xs cursor-pointer transition-colors"
            >
              Done / Continue Scanning
            </button>
          </div>
        </div>
      )}

      {/* Modal Alert: Member is already scanned */}
      {alreadyScannedMemberModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative space-y-4 border border-amber-200 text-center animate-scaleUp">
            <button
              onClick={() => setAlreadyScannedMemberModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 font-bold cursor-pointer p-1 rounded-full transition-colors"
              title="Close modal"
            >
              <XCircle className="w-6 h-6 text-stone-400 hover:text-stone-700" />
            </button>

            {/* Warning Icon Badge */}
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 border-2 border-amber-300 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="w-8 h-8" />
            </div>

            {/* Title */}
            <div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                Duplicate Scan
              </span>
              <h3 className="text-xl font-extrabold text-[#1b4332] mt-2">
                Member is already scanned
              </h3>
              <p className="text-xs text-[#52605d] mt-1">
                This member's attendance was previously recorded for this event.
              </p>
            </div>

            {/* Scanned Member Details Card */}
            <div className="p-3.5 bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] text-xs text-left flex items-center gap-3">
              {alreadyScannedMemberModal.avatar ? (
                <img
                  src={alreadyScannedMemberModal.avatar}
                  alt={alreadyScannedMemberModal.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-300 shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <UserIcon className="w-6 h-6" />
                </div>
              )}
              <div className="space-y-0.5 min-w-0">
                <h4 className="font-extrabold text-sm text-[#1b4332] truncate">
                  {alreadyScannedMemberModal.name}
                </h4>
                <p className="text-[11px] font-mono font-bold text-[#2d6a4f]">
                  Member ID: #{alreadyScannedMemberModal.memberId}
                </p>
                <p className="text-[10px] text-[#52605d]">
                  Chapter: {alreadyScannedMemberModal.network || 'Main Chapter'}
                </p>
              </div>
            </div>

            {/* Event Name Context */}
            <div className="p-2.5 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs text-center">
              <p className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Event Context</p>
              <p className="font-bold text-[#1b4332] mt-0.5">{selectedActivity?.name || 'General Event'}</p>
            </div>

            <button
              onClick={() => setAlreadyScannedMemberModal(null)}
              className="w-full py-3.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs rounded-2xl shadow-md cursor-pointer transition-all active:scale-98"
            >
              OK / Continue Scanning
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
