import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import jsQR from 'jsqr';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';
import { safeFetchJson, authFetch } from '../lib/db';
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
import { CustomSelect } from './CustomSelect';

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

  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Synchronous set of member keys per activity ID to guarantee instant duplicate detection even between rapid continuous scans
  const scannedKeysByActivityRef = useRef<Map<string, Set<string>>>(new Map());

  // Helper to extract all identifiable keys for a member
  const getMemberKeys = (data: Attendance, matchedUser?: any): Set<string> => {
    const keys = new Set<string>();
    if (data.memberId) {
      const k = String(data.memberId).trim().toLowerCase();
      keys.add(k);
      const digits = k.replace(/[^a-z0-9]/g, '');
      if (digits) keys.add(digits);
    }
    if (data.name && data.name.trim().toLowerCase() !== 'unregistered member') {
      const k = String(data.name).trim().toLowerCase();
      keys.add(k);
      const clean = k.replace(/[^a-z0-9]/g, '');
      if (clean) keys.add(clean);
    }
    if (matchedUser) {
      if (matchedUser.id) {
        const k = String(matchedUser.id).trim().toLowerCase();
        keys.add(k);
        const digits = k.replace(/[^a-z0-9]/g, '');
        if (digits) keys.add(digits);
      }
      if (matchedUser.memberNumber) {
        const k = String(matchedUser.memberNumber).trim().toLowerCase();
        keys.add(k);
        const digits = k.replace(/[^a-z0-9]/g, '');
        if (digits) keys.add(digits);
      }
      if (matchedUser.username) {
        keys.add(String(matchedUser.username).trim().toLowerCase());
      }
      if (matchedUser.name) {
        const k = String(matchedUser.name).trim().toLowerCase();
        keys.add(k);
        const clean = k.replace(/[^a-z0-9]/g, '');
        if (clean) keys.add(clean);
      }
      if (matchedUser.email) {
        keys.add(String(matchedUser.email).trim().toLowerCase());
      }
    }
    return keys;
  };

  // Synchronous references to prevent race conditions during rapid continuous frame scanning
  const activitiesRef = useRef<Activity[]>(activities);
  activitiesRef.current = activities;

  // Sync scanned keys from loaded activities
  const syncScannedKeys = (acts: Activity[]) => {
    const users = store.getUsers();
    acts.forEach((act) => {
      let actKeys = scannedKeysByActivityRef.current.get(act.id);
      if (!actKeys) {
        actKeys = new Set<string>();
        scannedKeysByActivityRef.current.set(act.id, actKeys);
      }
      if (Array.isArray(act.attendance)) {
        act.attendance.forEach((att) => {
          const matchedUser = users.find(
            (u) =>
              (u.memberNumber && u.memberNumber.toLowerCase() === (att.memberId || '').toLowerCase()) ||
              (u.id && u.id.toLowerCase() === (att.memberId || '').toLowerCase()) ||
              (u.name && u.name.toLowerCase() === (att.name || '').toLowerCase())
          );
          const keys = getMemberKeys(att, matchedUser);
          keys.forEach((k) => actKeys?.add(k));
        });
      }
    });
  };

  const selectedActivityIdRef = useRef<string>(selectedActivityId);
  selectedActivityIdRef.current = selectedActivityId;

  const isModalOpenRef = useRef<boolean>(false);
  isModalOpenRef.current = Boolean(scannedMemberModal || alreadyScannedMemberModal || showEventModal);

  const dismissScannedModal = useCallback(() => {
    setScannedMemberModal(null);
    lastScannedTextRef.current = '';
    lastScannedTimeRef.current = 0;
  }, []);

  const dismissDuplicateModal = useCallback(() => {
    setAlreadyScannedMemberModal(null);
    lastScannedTextRef.current = '';
    lastScannedTimeRef.current = 0;
  }, []);

  const handleCloseScan = useCallback(() => {
    if (!setActiveTab) return;
    const isAdmin = currentUser?.role === 'admin';
    if (isAdmin) {
      setActiveTab('dashboard');
    } else {
      setActiveTab('profile');
    }
  }, [currentUser, setActiveTab]);

  useModalDismiss(true, handleCloseScan);
  useModalDismiss(Boolean(scannedMemberModal), dismissScannedModal);
  useModalDismiss(Boolean(alreadyScannedMemberModal), dismissDuplicateModal);
  useModalDismiss(showEventModal, () => setShowEventModal(false));

  // Dynamically resolve member avatar and motorcycle details from members collection at display time
  const resolvedScannedMember = useMemo(() => {
    if (!scannedMemberModal) return null;
    const users = store.getUsers();
    const qId = (scannedMemberModal.memberId || '').toLowerCase().trim();
    const qName = (scannedMemberModal.name || '').toLowerCase().trim();
    return users.find(u => {
      const memNo = (u.memberNumber || '').toLowerCase().trim();
      const uId = (u.id || '').toLowerCase().trim();
      const uName = (u.name || '').toLowerCase().trim();
      const uUser = (u.username || '').toLowerCase().trim();
      return (
        (qId && (memNo === qId || uId === qId || uUser === qId)) ||
        (qName && uName === qName)
      );
    }) || null;
  }, [scannedMemberModal]);

  const resolvedDuplicateMember = useMemo(() => {
    if (!alreadyScannedMemberModal) return null;
    const users = store.getUsers();
    const qId = (alreadyScannedMemberModal.memberId || '').toLowerCase().trim();
    const qName = (alreadyScannedMemberModal.name || '').toLowerCase().trim();
    return users.find(u => {
      const memNo = (u.memberNumber || '').toLowerCase().trim();
      const uId = (u.id || '').toLowerCase().trim();
      const uName = (u.name || '').toLowerCase().trim();
      const uUser = (u.username || '').toLowerCase().trim();
      return (
        (qId && (memNo === qId || uId === qId || uUser === qId)) ||
        (qName && uName === qName)
      );
    }) || null;
  }, [alreadyScannedMemberModal]);

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

  // Helper to determine if an event is completed/finished based on date or status
  const isEventDone = (activity?: Activity): boolean => {
    if (!activity) return false;
    if (activity.status === 'Closed') return true;
    if (activity.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(activity.date);
      if (!isNaN(eventDate.getTime())) {
        eventDate.setHours(23, 59, 59, 999);
        if (eventDate < today) {
          return true;
        }
      }
    }
    return false;
  };

  // Load activities from database
  const loadActivities = () => {
    if (!currentUser) return;
    safeFetchJson('/api/mongodb/activities')
      .then(data => {
        const loaded: Activity[] = data.data || [];
        activitiesRef.current = loaded;
        syncScannedKeys(loaded);
        setActivities(loaded);
        if (loaded.length > 0 && !selectedActivityIdRef.current) {
          const openOne = loaded.find(a => a.status === 'Open' && !isEventDone(a)) || loaded[0];
          setSelectedActivityId(openOne.id);
          selectedActivityIdRef.current = openOne.id;
        }
      })
      .catch(err => console.error('Error fetching activities:', err));
  };

  useEffect(() => {
    if (!currentUser) return;
    loadActivities();

    const handleActivitiesUpdate = (e: CustomEvent) => {
      if (e.detail?.activity) {
        const act = e.detail.activity;
        setActivities(prev => {
          const exists = prev.some(a => a.id === act.id);
          const updated = exists ? prev.map(a => a.id === act.id ? act : a) : [act, ...prev];
          activitiesRef.current = updated;
          syncScannedKeys(updated);
          return updated;
        });
      } else {
        loadActivities();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bcc_activity_sync_time') {
        loadActivities();
      }
    };

    window.addEventListener('bcc_activities_updated', handleActivitiesUpdate as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('bcc_activities_updated', handleActivitiesUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const selectedActivity = activities.find(a => a.id === selectedActivityId);
  const isSelectedEventDone = isEventDone(selectedActivity);

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
    // If a modal is open, prevent camera frame ingestion
    if (isModalOpenRef.current) return;

    const currentActId = selectedActivityIdRef.current;
    if (!currentActId) return;

    const currentActivities = activitiesRef.current;
    const activeAct = currentActivities.find(a => a.id === currentActId);
    if (isEventDone(activeAct)) {
      setScanSuccessMessage(`⚠️ Scanning is disabled for "${activeAct?.name || 'this event'}". The event is completed or date has passed.`);
      setTimeout(() => setScanSuccessMessage(null), 5000);
      return;
    }

    // Debounce rapid continuous frame detections of exact same text within 1200ms
    const now = Date.now();
    if (decodedText === lastScannedTextRef.current && now - lastScannedTimeRef.current < 1200) {
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

    // Find matched registered user
    const matchedUser = store.getUsers().find(u =>
      (u.memberNumber && u.memberNumber.toLowerCase() === parsedData.memberId.toLowerCase()) ||
      (u.id && u.id.toLowerCase() === parsedData.memberId.toLowerCase()) ||
      (u.name && u.name.toLowerCase() === parsedData.name.toLowerCase()) ||
      (u.username && u.username.toLowerCase() === parsedData.memberId.toLowerCase())
    );

    // Compute all identifier keys for this member
    const currentMemberKeys = getMemberKeys(parsedData, matchedUser);
    const rawDecodedClean = decodedText.trim().toLowerCase();
    currentMemberKeys.add(rawDecodedClean);
    const rawDigits = rawDecodedClean.replace(/[^a-z0-9]/g, '');
    if (rawDigits) currentMemberKeys.add(rawDigits);

    // Check duplicate SYNCHRONOUSLY using Set tracking + activity attendance array
    let actKeys = scannedKeysByActivityRef.current.get(currentActId);
    if (!actKeys) {
      actKeys = new Set<string>();
      scannedKeysByActivityRef.current.set(currentActId, actKeys);
    }

    let isAlreadyScanned = false;
    for (const key of currentMemberKeys) {
      if (actKeys.has(key)) {
        isAlreadyScanned = true;
        break;
      }
    }

    const existingAttendance = activeAct?.attendance || [];
    if (!isAlreadyScanned && existingAttendance.length > 0) {
      const memIdClean = (parsedData.memberId || '').toLowerCase().trim();
      const memIdDigits = memIdClean.replace(/[^a-z0-9]/g, '');
      const memNameClean = (parsedData.name || '').toLowerCase().trim();

      isAlreadyScanned = existingAttendance.some(att => {
        const attIdClean = (att.memberId || '').toLowerCase().trim();
        const attIdDigits = attIdClean.replace(/[^a-z0-9]/g, '');
        const attNameClean = (att.name || '').toLowerCase().trim();

        if (memIdClean && attIdClean && memIdClean === attIdClean) return true;
        if (memIdDigits && attIdDigits && memIdDigits === attIdDigits) return true;
        if (memNameClean && attNameClean && attNameClean !== 'member' && attNameClean !== 'unregistered member' && memNameClean === attNameClean) return true;

        const attMatchedUser = store.getUsers().find(u =>
          (u.memberNumber && u.memberNumber.toLowerCase() === attIdClean) ||
          (u.id && u.id.toLowerCase() === attIdClean) ||
          (u.name && u.name.toLowerCase() === attNameClean)
        );
        const attKeys = getMemberKeys(att, attMatchedUser);
        for (const k of currentMemberKeys) {
          if (attKeys.has(k)) return true;
        }
        return false;
      });
    }

    if (isAlreadyScanned) {
      // Ensure all keys are populated in the Set for fast subsequent checks
      currentMemberKeys.forEach(k => actKeys?.add(k));
      setScannedMemberModal(null);
      setAlreadyScannedMemberModal(parsedData);
      setScanSuccessMessage(`⚠️ Member is already scanned (${parsedData.name}).`);
      setTimeout(() => setScanSuccessMessage(null), 4000);
      return;
    }

    // Register all keys in the synchronous Set immediately BEFORE any async operations
    currentMemberKeys.forEach(k => actKeys?.add(k));

    // Build lightweight attendance record (strip avatar and bikeInfo base64 images to prevent document bloat)
    const lightweightAttendanceRecord: Attendance = {
      name: parsedData.name,
      memberId: parsedData.memberId,
      network: parsedData.network,
      date: parsedData.date,
      time: parsedData.time,
      isRegistered: parsedData.isRegistered,
    };

    // Build updated activity with newly logged attendance
    const updatedAttendance = [lightweightAttendanceRecord, ...existingAttendance];
    const updatedActivity: Activity = {
      ...(activeAct || {
        id: currentActId,
        name: 'Event',
        date: new Date().toISOString().split('T')[0],
        status: 'Open' as const,
        attendance: []
      }),
      attendance: updatedAttendance
    };

    const newActivities = currentActivities.map(a => a.id === currentActId ? updatedActivity : a);
    if (!currentActivities.some(a => a.id === currentActId)) {
      newActivities.push(updatedActivity);
    }

    // Immediately update ref so synchronous duplicate checks in consecutive scans see the member instantly
    activitiesRef.current = newActivities;
    setActivities(newActivities);

    // Save updated activity to database
    authFetch('/api/mongodb/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedActivity)
    }).catch(err => console.error('Error saving activity:', err));

    // Save entry to MongoDB "attendanceLogs" collection table
    const eventName = activeAct?.name || 'No event created';
    const eventDate = activeAct?.date || new Date().toISOString().split('T')[0];

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
      activityId: currentActId,
      "Activity ID": currentActId,
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

    authFetch('/api/mongodb/attendanceLogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceLogEntry)
    }).catch(err => console.error('Error saving to mongodb attendanceLogs:', err));

    // Dispatch global events for instant real-time sync across Admin Activity Management & Attendance Tracker
    try {
      window.dispatchEvent(new CustomEvent('bcc_activities_updated', {
        detail: { activity: updatedActivity, attendanceLog: attendanceLogEntry }
      }));
      window.dispatchEvent(new CustomEvent('bcc_attendance_updated', {
        detail: { activity: updatedActivity, attendanceLog: attendanceLogEntry }
      }));
      localStorage.setItem('bcc_activity_sync_time', Date.now().toString());
    } catch (e) {
      console.error('Error dispatching activity update event:', e);
    }

    setAlreadyScannedMemberModal(null);
    setScannedMemberModal(parsedData);
    setScanSuccessMessage(`✅ Successfully recorded attendance for ${parsedData.name} (${parsedData.memberId})!`);
    setTimeout(() => setScanSuccessMessage(null), 5000);
  };

  const handleScannedDataRef = useRef<(code: string) => Promise<void>>(handleScannedData);
  handleScannedDataRef.current = handleScannedData;

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

          if (code && code.data && !isModalOpenRef.current) {
            handleScannedDataRef.current(code.data);
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

  // Auto-start camera automatically whenever component is rendered or active activity changes on mobile
  useEffect(() => {
    if (!isDesktop) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [selectedActivityId, isDesktop]);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    startCamera(newId);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isSelectedEventDone) {
      setScanSuccessMessage(`⚠️ Scanning is disabled for "${selectedActivity?.name || 'this event'}". The event is completed or date has passed.`);
      setTimeout(() => setScanSuccessMessage(null), 5000);
      return;
    }

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
    if (isSelectedEventDone) {
      setScanSuccessMessage(`⚠️ Scanning is disabled for "${selectedActivity?.name || 'this event'}". The event is completed or date has passed.`);
      setTimeout(() => setScanSuccessMessage(null), 5000);
      return;
    }
    handleScannedData(manualInputId.trim());
    setManualInputId('');
  };

  if (isDesktop) {
    return (
      <div className="w-full min-h-[75vh] flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-[#e2ece2] shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-[#f7f9f7] text-[#2d6a4f] border border-[#e2ece2] flex items-center justify-center mb-4 shadow-2xs">
          <Smartphone className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-[#1b4332] mb-1">
          Please use mobile phone to scan
        </h3>
        <p className="text-xs text-[#52605d] max-w-sm leading-relaxed">
          QR attendance scanning requires a camera and is optimized for mobile devices. Please open and access this system on your smartphone to scan QR codes.
        </p>
      </div>
    );
  }

  if (isMember) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden w-full h-[100dvh]">
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

      {/* TOP BAR / HEADER (Matches Screenshot: Centered "Scan QR" and Top-Right "✕") */}
      <div className="relative z-40 w-full pt-10 sm:pt-6 pb-4 px-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Left: Torch / Flash toggle */}
        <div className="w-10 flex items-center">
          <button
            type="button"
            onClick={toggleTorch}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              torchOn ? 'bg-white text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title={torchOn ? "Turn Flash Off" : "Turn Flash On"}
          >
            <Zap className={`w-4 h-4 ${torchOn ? 'fill-black' : ''}`} />
          </button>
        </div>

        {/* Centered Title */}
        <h1 className="text-white text-base sm:text-lg font-semibold tracking-wide text-center">
          Scan QR
        </h1>

        {/* Right: Close Button */}
        <div className="w-10 flex items-center justify-end">
          {setActiveTab && (
            <button
              type="button"
              onClick={handleCloseScan}
              title="Close QR Scanner"
              className="p-2 text-white hover:opacity-80 transition-opacity cursor-pointer active:scale-95"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Event Context Pill (Subtle & Non-intrusive) */}
      {selectedActivity && (
        <div className="relative z-30 flex items-center justify-center px-4 -mt-2">
          <button
            type="button"
            onClick={() => setShowEventModal(true)}
            className="py-1 px-3.5 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/90 text-[11px] font-medium rounded-full border border-white/15 truncate transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md"
          >
            <Calendar className="w-3 h-3 text-[#74c69d]" />
            <span className="truncate max-w-[220px]">Event: {selectedActivity.name}</span>
          </button>
        </div>
      )}

      {/* FULL SCREEN CAMERA VIEWPORT */}
      <div className="relative w-full flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${!scanning ? 'hidden' : 'block'}`}
        />

        {/* CENTER TARGET SCANNER FRAME (Matches screenshot white rounded corner brackets) */}
        <div className="relative z-20 flex items-center justify-center pointer-events-none">
          <div className="relative w-[270px] h-[270px] sm:w-[310px] sm:h-[310px] max-w-[76vw] max-h-[76vw]">
            {/* Top-Left Corner Bracket */}
            <div className="absolute top-0 left-0 w-14 h-14 border-t-[4px] border-l-[4px] border-white rounded-tl-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
            {/* Top-Right Corner Bracket */}
            <div className="absolute top-0 right-0 w-14 h-14 border-t-[4px] border-r-[4px] border-white rounded-tr-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
            {/* Bottom-Left Corner Bracket */}
            <div className="absolute bottom-0 left-0 w-14 h-14 border-b-[4px] border-l-[4px] border-white rounded-bl-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
            {/* Bottom-Right Corner Bracket */}
            <div className="absolute bottom-0 right-0 w-14 h-14 border-b-[4px] border-r-[4px] border-white rounded-br-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />

            {/* Subtle Animated Laser Scan Line */}
            {scanning && (
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-white/80 to-transparent rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-laser-scan z-20" />
            )}
          </div>
        </div>

        {/* Camera Error / Permission Blocked */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white space-y-3 bg-black/90 backdrop-blur-md z-25">
            <AlertCircle className="w-12 h-12 text-amber-400" />
            <p className="text-xs text-stone-300 max-w-xs">{cameraError}</p>
            <button
              type="button"
              onClick={() => startCamera()}
              className="px-5 py-2 bg-white text-black hover:bg-stone-200 rounded-full text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
            >
              Retry Camera
            </button>
          </div>
        )}

        {/* Paused state overlay */}
        {!scanning && !isSelectedEventDone && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 bg-black/90 backdrop-blur-md z-20">
            <Camera className="w-14 h-14 text-white/70" />
            <p className="text-sm font-bold text-gray-200">Camera Scanner Paused</p>
            <button
              type="button"
              onClick={() => startCamera()}
              className="px-6 py-2.5 bg-white text-black hover:bg-stone-200 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xl active:scale-95"
            >
              Enable Camera
            </button>
          </div>
        )}

        {/* Event Finished / Date Passed Overlay */}
        {isSelectedEventDone && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white space-y-3 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shadow-lg">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                Scanning Disabled
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                Event Date Has Passed
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                "<span className="font-bold text-white">{selectedActivity?.name}</span>" ({selectedActivity?.date ? new Date(selectedActivity.date).toLocaleDateString() : ''}) is completed.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowEventModal(true)}
              className="px-5 py-2.5 bg-white text-black hover:bg-stone-200 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xl active:scale-95 flex items-center gap-1.5 mt-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Select Active Event</span>
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS (Matches Screenshot: Circular Upload Button + "Upload QR" Label + Home Indicator) */}
      <div className="relative z-40 w-full pb-6 pt-3 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-2 group cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 rounded-full border border-white/40 bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-lg transition-all">
            <ImageIcon className="w-6 h-6 text-white stroke-[1.8]" />
          </div>
          <span className="text-white text-xs sm:text-sm font-medium tracking-wide">
            Upload QR
          </span>
        </button>

        {/* iOS-style Home Indicator Bar */}
        <div className="w-36 h-1 bg-white/60 rounded-full mx-auto mt-5" />
      </div>

      {/* Change Event Context Modal */}
      {showEventModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-fadeIn">
            <div className="bg-white w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl relative space-y-3.5 border border-[#e2ece2] my-auto flex flex-col max-h-[82dvh]">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#e2ece2] shrink-0">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#2d6a4f]" />
                  <h3 className="font-extrabold text-[#1b4332] text-xs sm:text-sm">Select Active Event Context</h3>
                </div>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="text-stone-400 hover:text-stone-700 font-bold p-1 rounded-full hover:bg-stone-100 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {activities.length === 0 ? (
                  <p className="text-xs text-stone-500 text-center py-4">No events found.</p>
                ) : (
                  activities.map(act => {
                    const actDone = isEventDone(act);
                    return (
                      <button
                        key={act.id}
                        onClick={() => {
                          setSelectedActivityId(act.id);
                          setShowEventModal(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl sm:rounded-2xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                          act.id === selectedActivityId
                            ? 'border-[#2d6a4f] bg-[#f7f9f7] font-extrabold text-[#1b4332]'
                            : 'border-[#e2ece2] hover:bg-stone-50 text-[#52605d]'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-[#1b4332] text-xs truncate">{act.name}</p>
                            {actDone ? (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                Closed
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-[#52605d]">
                            Date: {new Date(act.date).toLocaleDateString()} | Records: {act.attendance.length}
                          </p>
                        </div>
                        {act.id === selectedActivityId && (
                          <CheckCircle className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <button
                onClick={() => setShowEventModal(false)}
                className="w-full py-2.5 sm:py-3 bg-[#2d6a4f] hover:bg-[#1b4332] active:scale-95 text-white font-extrabold text-xs rounded-xl sm:rounded-2xl transition-colors cursor-pointer shrink-0"
              >
                Done / Save Choice
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Scanned Verification Modal Dialog (Small & Scrollable) */}
      {scannedMemberModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-fadeIn">
            <div className="bg-white w-full max-w-[340px] sm:max-w-sm rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-2xl relative flex flex-col max-h-[78dvh] sm:max-h-[82dvh] border border-[#e2ece2] my-auto overflow-hidden text-[#2d3a3a]">
              {/* Close Button */}
              <button
                onClick={dismissScannedModal}
                className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors z-20 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Compact Header */}
              <div className="flex flex-col items-center text-center space-y-1.5 pt-0.5 shrink-0">
                {/* Member Avatar */}
                <div className="relative">
                  {(resolvedScannedMember?.avatar || scannedMemberModal.avatar) ? (
                    <img
                      src={resolvedScannedMember?.avatar || scannedMemberModal.avatar}
                      alt={scannedMemberModal.name}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 sm:border-[3px] border-[#74c69d] shadow-xs"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
                      <UserIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                  )}
                </div>

                <div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider inline-block">
                    Verification Success
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#1b4332] mt-0.5 leading-tight truncate max-w-[260px]">
                    {scannedMemberModal.name}
                  </h3>
                  <p className="text-[10.5px] sm:text-xs font-mono font-bold text-[#2d6a4f]">
                    Member ID: #{scannedMemberModal.memberId}
                  </p>
                  <p className="text-[9.5px] sm:text-[10.5px] text-[#52605d] truncate max-w-[260px]">
                    Network / Chapter: {scannedMemberModal.network || 'Main Chapter'}
                  </p>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-2 my-2 scroll-smooth">
                {/* Registered Motorcycle Details */}
                <div className="p-2 sm:p-2.5 bg-[#f7f9f7] rounded-xl sm:rounded-2xl border border-[#e2ece2] space-y-1.5">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-[#e2ece2]">
                    <Bike className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span className="text-[10.5px] sm:text-[11px] font-extrabold text-[#1b4332]">Registered Motorcycle</span>
                  </div>
                  {(() => {
                    const currentBike = resolvedScannedMember?.bikeInfo || scannedMemberModal.bikeInfo;
                    if (currentBike && (currentBike.make || currentBike.model)) {
                      return (
                        <div className="space-y-1.5">
                          {currentBike.photoUrl && (
                            <div className="rounded-lg overflow-hidden border border-[#e2ece2] max-h-24 sm:max-h-28 bg-stone-900">
                              <img
                                src={currentBike.photoUrl}
                                alt="Motorcycle"
                                className="w-full h-20 sm:h-24 object-cover"
                              />
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] sm:text-[11px]">
                            <div className="p-1.5 rounded-lg bg-white border border-[#e2ece2]">
                              <span className="block text-[8px] sm:text-[9px] font-bold text-[#52605d] uppercase tracking-wider">Make & Model</span>
                              <strong className="text-[#1b4332] font-bold text-[10.5px] sm:text-xs truncate block">{currentBike.make || ''} {currentBike.model || 'N/A'}</strong>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white border border-[#e2ece2]">
                              <span className="block text-[8px] sm:text-[9px] font-bold text-[#52605d] uppercase tracking-wider">Model Year</span>
                              <strong className="text-[#1b4332] font-bold text-[10.5px] sm:text-xs truncate block">{currentBike.year || 'N/A'}</strong>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white border border-[#e2ece2]">
                              <span className="block text-[8px] sm:text-[9px] font-bold text-[#52605d] uppercase tracking-wider">Displacement</span>
                              <strong className="text-[#2d6a4f] font-bold text-[10.5px] sm:text-xs truncate block">{currentBike.engineCc ? (currentBike.engineCc.toString().toLowerCase().endsWith('cc') ? currentBike.engineCc : `${currentBike.engineCc} cc`) : 'N/A'}</strong>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white border border-[#e2ece2]">
                              <span className="block text-[8px] sm:text-[9px] font-bold text-[#52605d] uppercase tracking-wider">Plate Number</span>
                              <strong className="text-[#1b4332] font-mono font-bold text-[10.5px] sm:text-xs truncate block">{currentBike.licensePlate || currentBike.plateNo || 'N/A'}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return <p className="text-[#52605d] text-center text-[10px] py-1 italic">No motorcycle details recorded</p>;
                  })()}
                </div>

                {/* Event Attendance Context */}
                <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center space-y-0.5">
                  <p className="text-[8.5px] sm:text-[9.5px] font-bold text-emerald-800 uppercase tracking-wider">Recorded for Event:</p>
                  <p className="text-[11px] sm:text-xs font-bold text-[#1b4332] truncate">{selectedActivity?.name || 'No event created'}</p>
                  <p className="text-[9px] sm:text-[10px] text-[#52605d] font-mono">{scannedMemberModal.date} {scannedMemberModal.time}</p>
                </div>
              </div>

              {/* Static Bottom Button */}
              <button
                onClick={dismissScannedModal}
                className="w-full py-2.5 sm:py-3 bg-[#2d6a4f] hover:bg-[#1b4332] active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-xs cursor-pointer transition-all shrink-0"
              >
                Done / Continue Scanning
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Alert: Member is already scanned */}
      {alreadyScannedMemberModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-fadeIn">
            <div className="bg-white w-full max-w-[340px] sm:max-w-sm rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-2xl relative space-y-3 border border-amber-200 text-center animate-scaleUp my-auto flex flex-col max-h-[78dvh] sm:max-h-[82dvh] overflow-hidden text-[#2d3a3a]">
              {/* Close Button */}
              <button
                onClick={dismissDuplicateModal}
                className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors z-20 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Warning Icon Badge */}
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 border-2 border-amber-300 flex items-center justify-center mx-auto shadow-xs shrink-0 mt-0.5">
                <AlertCircle className="w-6 h-6" />
              </div>

              {/* Title */}
              <div className="shrink-0">
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider inline-block">
                  Duplicate Scan
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[#1b4332] mt-1 leading-tight">
                  Member is already scanned
                </h3>
                <p className="text-[10px] sm:text-[11px] text-[#52605d] mt-0.5">
                  This member's attendance has already been recorded for this event.
                </p>
              </div>

              {/* Scrollable middle body */}
              <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-2 scroll-smooth">
                {/* Scanned Member Details Card */}
                <div className="p-2.5 sm:p-3 bg-[#f7f9f7] rounded-xl sm:rounded-2xl border border-[#e2ece2] text-xs text-left flex items-center gap-2.5">
                  {(resolvedDuplicateMember?.avatar || alreadyScannedMemberModal.avatar) ? (
                    <img
                      src={resolvedDuplicateMember?.avatar || alreadyScannedMemberModal.avatar}
                      alt={alreadyScannedMemberModal.name}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-amber-300 shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <h4 className="font-extrabold text-xs sm:text-sm text-[#1b4332] truncate">
                      {alreadyScannedMemberModal.name}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] font-mono font-bold text-[#2d6a4f]">
                      Member ID: #{alreadyScannedMemberModal.memberId}
                    </p>
                    <p className="text-[9.5px] sm:text-[10px] text-[#52605d] truncate">
                      Chapter: {alreadyScannedMemberModal.network || 'Main Chapter'}
                    </p>
                  </div>
                </div>

                {/* Event Name Context */}
                <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-center">
                  <p className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider">Event Context</p>
                  <p className="font-bold text-[#1b4332] text-xs mt-0.5 truncate">{selectedActivity?.name || 'No event created'}</p>
                </div>
              </div>

              <button
                onClick={dismissDuplicateModal}
                className="w-full py-2.5 sm:py-3 bg-[#1b4332] hover:bg-[#2d6a4f] active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-xs cursor-pointer transition-all shrink-0"
              >
                OK / Continue Scanning
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
