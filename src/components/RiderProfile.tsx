import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store, uploadStorageFile, safeFetchJson } from '../lib/db';
import { User as UserType } from '../types';
import { CustomSelect } from './CustomSelect';
import { QRCodeSVG } from 'qrcode.react';
import { RoleAvatarBadge } from './RoleAvatarBadge';
import {
  ShieldCheck,
  Bike,
  Edit3,
  X,
  Upload,
  Camera,
  Wallet,
  Image as ImageIcon,
  ChevronRight,
  QrCode,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  CheckCircle2,
} from 'lucide-react';
import { isBiometricAvailable, registerBiometricCredential } from '../lib/biometrics';
import { motion, AnimatePresence } from 'motion/react';
import { ImageCropperModal } from './ImageCropperModal';
import { OfficialLoader } from './OfficialLoader';

interface RiderProfileProps {
  onOpenDuesModal?: () => void;
}

export const RiderProfile: React.FC<RiderProfileProps> = () => {
  const { currentUser, updateUser } = useAuth();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useModalDismiss(editModalOpen, () => setEditModalOpen(false));

  // Filter out admin users so admin accounts are never included in rider profiles
  const riderMembers = store.getUsers().filter((u) => u.role !== 'admin');

  // Selected rider ID for admin viewing mode
  const [selectedRiderId, setSelectedRiderId] = useState<string>(
    riderMembers[0]?.id || ''
  );

  const isUserAdmin = currentUser?.role === 'admin';

  // Active rider profile being displayed (never an admin user)
  const activeRider: UserType | null = isUserAdmin
    ? riderMembers.find((r) => r.id === selectedRiderId) || riderMembers[0] || null
    : currentUser;

  // Edit form state
  const quickAvatarInputRef = useRef<HTMLInputElement>(null);
  const quickBikePhotoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(activeRider?.name || '');
  const [bio, setBio] = useState(activeRider?.bio || '');
  const [phone, setPhone] = useState(activeRider?.phone || '');
  const [network, setNetwork] = useState(activeRider?.network || '');
  const [avatar, setAvatar] = useState(activeRider?.avatar || '');
  const [bikePhoto, setBikePhoto] = useState(activeRider?.bikeInfo?.photoUrl || '');
  const [avatarError, setAvatarError] = useState('');
  const [bikeMake, setBikeMake] = useState(activeRider?.bikeInfo?.make || '');
  const [bikeModel, setBikeModel] = useState(activeRider?.bikeInfo?.model || '');
  const [engineCc, setEngineCc] = useState(activeRider?.bikeInfo?.engineCc || '');
  const [plateNumber, setPlateNumber] = useState(
    activeRider?.bikeInfo?.licensePlate || activeRider?.bikeInfo?.plateNo || ''
  );

  // Avatar / Bike Photo Cropper State
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');
  const [cropperTarget, setCropperTarget] = useState<'avatar_direct' | 'avatar_edit' | 'bike_direct' | 'bike_edit'>('avatar_edit');
  const [cropperTitle, setCropperTitle] = useState('Crop Profile Avatar');

  // QR Code visibility state with persistent local storage preference (defaults to hidden)
  const [showQrCode, setShowQrCode] = useState<boolean>(() => {
    const saved = localStorage.getItem('bcc_show_qr_code');
    return saved !== null ? saved === 'true' : false;
  });

  const toggleQrCode = () => {
    setShowQrCode((prev) => {
      const next = !prev;
      localStorage.setItem('bcc_show_qr_code', String(next));
      return next;
    });
  };

  // Biometric / Fingerprint State
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null);

  useEffect(() => {
    isBiometricAvailable().then((avail) => setIsBiometricSupported(avail));
  }, []);

  const handleToggleBiometric = async () => {
    if (!currentUser) return;
    setBiometricLoading(true);
    setBiometricMessage(null);

    if (currentUser.biometricEnabled) {
      const updated = store.updateUserBiometrics(currentUser.id, false);
      if (updated) {
        updateUser(updated);
        setBiometricMessage('Biometric fingerprint sign-in disabled.');
      }
      setBiometricLoading(false);
    } else {
      const result = await registerBiometricCredential({
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name,
      });

      if (result.success && result.credentialId) {
        const updated = store.updateUserBiometrics(currentUser.id, true, result.credentialId);
        if (updated) {
          updateUser(updated);
          setBiometricMessage('Fingerprint enrolled! You can now log in without OTP.');
        }
      } else {
        setBiometricMessage(result.error || 'Failed to register fingerprint credential.');
      }
      setBiometricLoading(false);
    }

    setTimeout(() => setBiometricMessage(null), 4500);
  };

  if (!currentUser) return null;

  if (!activeRider) {
    return (
      <div className="p-8 rounded-3xl bg-white border border-[#e2ece2] text-center space-y-3">
        <p className="text-sm font-bold text-[#1b4332]">No rider profiles available.</p>
        <p className="text-xs text-[#52605d]">Please add rider members to the club database to view rider profiles.</p>
      </div>
    );
  }

  const handleOpenEditModal = () => {
    setName(activeRider.name || '');
    setBio(activeRider.bio || '');
    setPhone(activeRider.phone || '');
    setNetwork(activeRider.network || '');
    setAvatar(activeRider.avatar || '');
    setBikePhoto(activeRider.bikeInfo?.photoUrl || '');
    setAvatarError('');
    setBikeMake(activeRider.bikeInfo?.make || '');
    setBikeModel(activeRider.bikeInfo?.model || '');
    setEngineCc(activeRider.bikeInfo?.engineCc || '');
    setPlateNumber(activeRider.bikeInfo?.licensePlate || activeRider.bikeInfo?.plateNo || '');
    setEditModalOpen(true);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('Image file size exceeds the 10MB limit. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCropperSrc(reader.result as string);
        setCropperTarget('avatar_edit');
        setCropperTitle('Crop Profile Avatar');
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDirectAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRider) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Image file size exceeds the 10MB limit. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCropperSrc(reader.result as string);
        setCropperTarget('avatar_direct');
        setCropperTitle('Crop Profile Avatar');
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDirectBikePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRider) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Image file size exceeds the 10MB limit. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCropperSrc(reader.result as string);
        setCropperTarget('bike_direct');
        setCropperTitle('Crop Motorcycle Photo');
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    const compressed = await uploadStorageFile(croppedDataUrl);
    const finalUrl = compressed || croppedDataUrl;

    if (cropperTarget === 'avatar_direct' && activeRider) {
      const updated: UserType = {
        ...activeRider,
        avatar: finalUrl,
      };
      updateUser(updated);
    } else if (cropperTarget === 'avatar_edit') {
      setAvatar(finalUrl);
    } else if (cropperTarget === 'bike_direct' && activeRider) {
      const updated: UserType = {
        ...activeRider,
        bikeInfo: {
          ...activeRider.bikeInfo,
          photoUrl: finalUrl,
        },
      };
      updateUser(updated);
    } else if (cropperTarget === 'bike_edit') {
      setBikePhoto(finalUrl);
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRider) return;

    setIsSaving(true);
    const updated: UserType = {
      ...activeRider,
      name,
      bio,
      phone,
      network,
      avatar: avatar || activeRider.avatar,
      bikeInfo: {
        ...activeRider.bikeInfo,
        make: bikeMake,
        model: bikeModel,
        engineCc,
        licensePlate: plateNumber,
        plateNo: plateNumber,
        photoUrl: bikePhoto || activeRider.bikeInfo?.photoUrl,
      },
    };

    setTimeout(() => {
      updateUser(updated);
      setIsSaving(false);
      setEditModalOpen(false);
    }, 500);
  };

  // Finance Records State with Real-Time Mongo & Storage Sync
  const [financeRecords, setFinanceRecords] = useState<any[]>(() => store.getFinanceRecords());

  useEffect(() => {
    if (!currentUser) return;

    const refreshRecords = () => {
      const local = store.getFinanceRecords();
      setFinanceRecords(local);
    };

    refreshRecords();

    // Fetch latest finance logs from MongoDB
    safeFetchJson('/api/mongodb/financeLogs')
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          localStorage.setItem('bcc_finance_records_v3', JSON.stringify(data.data));
          setFinanceRecords(data.data);
        }
      })
      .catch((err) => console.warn('MongoDB financeLogs fetch in RiderProfile notice:', err));

    // Ensure approved active rider has membership fee payment recorded if not deleted
    if (
      activeRider &&
      activeRider.approvalStatus === 'Approved' &&
      activeRider.role !== 'admin' &&
      !activeRider.id?.startsWith('reg_')
    ) {
      store.recordMembershipFeePayment(activeRider);
      setFinanceRecords(store.getFinanceRecords());
    }

    const handleStorage = () => refreshRecords();
    const handleFinanceUpdated = () => refreshRecords();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('bcc_finance_updated', handleFinanceUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bcc_finance_updated', handleFinanceUpdated);
    };
  }, [activeRider?.id, activeRider?.name, activeRider?.memberNumber]);

  // Contributions Calculations with multi-key robust rider matching (by ID, username, member number, and name)
  const riderRecords = financeRecords.filter((r) => {
    if (!activeRider) return false;
    // Direct user ID / username match
    if (r.userId && (r.userId === activeRider.id || r.userId === activeRider.username)) return true;
    // Member number match (e.g., BRC-0002)
    if (
      r.userMemberNo &&
      activeRider.memberNumber &&
      r.userMemberNo.trim().toUpperCase() === activeRider.memberNumber.trim().toUpperCase()
    ) {
      return true;
    }
    // Full name match (case-insensitive & trimmed)
    if (r.userName && activeRider.name) {
      const rName = r.userName.trim().toLowerCase();
      const aName = activeRider.name.trim().toLowerCase();
      if (rName === aName) return true;
      if (rName.length > 3 && (rName.includes(aName) || aName.includes(rName))) return true;
    }
    // Record ID containing user ID
    if (r.id && (r.id === `rec_mf_${activeRider.id}` || r.id.includes(activeRider.id))) return true;
    return false;
  });

  const totalPaidFromJoining = riderRecords
    .filter((r) => r.status === 'Paid')
    .reduce((sum, r) => sum + r.amount, 0);
  const mfPaid = riderRecords
    .filter((r) => r.status === 'Paid' && r.itemType === 'Membership Fee')
    .reduce((sum, r) => sum + r.amount, 0);
  const duesPaid = riderRecords
    .filter((r) => r.status === 'Paid' && r.itemType === 'Monthly Due')
    .reduce((sum, r) => sum + r.amount, 0);
  const otherPaid = riderRecords
    .filter((r) => r.status === 'Paid' && r.itemType !== 'Membership Fee' && r.itemType !== 'Monthly Due')
    .reduce((sum, r) => sum + r.amount, 0);
  const pendingDuesAmount = riderRecords
    .filter((r) => r.status === 'Pending' || r.status === 'Overdue')
    .reduce((sum, r) => sum + r.amount, 0);

  // Dynamic Bike Info text formatted exactly as shown in reference image:
  // White pill container with: HONDA - RS125 | 125cc | 123 - ABC
  const rawMake = activeRider.bikeInfo?.make?.trim() || 'HONDA';
  const rawModel = activeRider.bikeInfo?.model?.trim() || 'RS125';
  let rawCc = activeRider.bikeInfo?.engineCc?.toString().trim() || '125';
  rawCc = rawCc.toLowerCase().endsWith('cc') ? rawCc.toLowerCase() : `${rawCc}cc`;
  const rawPlate = (activeRider.bikeInfo?.licensePlate || activeRider.bikeInfo?.plateNo || '123 - ABC').trim();

  const bikeCoverText = `${rawMake.toUpperCase()} - ${rawModel.toUpperCase()} | ${rawCc} | ${rawPlate.toUpperCase()}`;

  // QR Code Payload
  const firstName = activeRider.firstName || activeRider.name.split(' ')[0] || '';
  const lastName = activeRider.lastName || activeRider.name.split(' ').slice(1).join(' ') || activeRider.name;
  const qrValue = `Member ID: ${activeRider.memberNumber || 'N/A'}\nLast Name: ${lastName}\nFirst Name: ${firstName}`;

  // Auto adjust name font size if a member has a large number of characters in their name (e.g., "Nigel Christian G. Combatit")
  const getNameFontSize = (nameStr: string) => {
    const len = nameStr?.length || 0;
    if (len >= 26) return 'text-[11px] sm:text-xs md:text-sm';
    if (len >= 20) return 'text-xs sm:text-sm md:text-base';
    if (len >= 15) return 'text-xs sm:text-base md:text-lg';
    return 'text-sm sm:text-base md:text-lg';
  };

  const nameFontSizeClass = getNameFontSize(activeRider.name);

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden file inputs for direct photo uploads */}
      <input
        type="file"
        ref={quickAvatarInputRef}
        accept="image/*"
        onChange={handleDirectAvatarUpload}
        className="hidden"
      />
      <input
        type="file"
        ref={quickBikePhotoInputRef}
        accept="image/*"
        onChange={handleDirectBikePhotoUpload}
        className="hidden"
      />

      {/* Admin Inspector Notice Header */}
      {isUserAdmin && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#1b4332] border border-[#2d6a4f] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs max-w-sm sm:max-w-md mx-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[#2d6a4f] text-[#74c69d] shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-xs sm:text-sm text-white truncate">Admin Inspector</h3>
              <p className="text-[10.5px] text-[#d8f3dc]/80 truncate">
                Select a rider to inspect their profile card & details.
              </p>
            </div>
          </div>

          {riderMembers.length > 0 && (
            <div className="w-full sm:w-auto min-w-[170px]">
              <CustomSelect
                value={activeRider.id}
                onChange={(riderId) => {
                  setSelectedRiderId(riderId);
                  const selected = riderMembers.find((r) => r.id === riderId);
                  if (selected) {
                    setName(selected.name || '');
                    setBio(selected.bio || '');
                    setPhone(selected.phone || '');
                    setNetwork(selected.network || '');
                    setBikeMake(selected.bikeInfo?.make || '');
                    setBikeModel(selected.bikeInfo?.model || '');
                    setEngineCc(selected.bikeInfo?.engineCc || '');
                    setPlateNumber(selected.bikeInfo?.licensePlate || selected.bikeInfo?.plateNo || '');
                  }
                }}
                options={riderMembers.map((rider) => ({
                  value: rider.id,
                  label: `${rider.name} (${rider.memberNumber || 'Rider'})`,
                }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Profile Card Container Matching Provided Design */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto">
        <div className="relative bg-white rounded-[24px] sm:rounded-[28px] overflow-hidden border border-[#e2ece2] shadow-xl text-[#1b4332] pb-5">
          
          {/* Top Banner: Motorcycle Photo Background */}
          <div className="relative w-full h-44 sm:h-52 bg-[#7d988a] overflow-hidden">
            {activeRider.bikeInfo?.photoUrl ? (
              <img
                src={activeRider.bikeInfo.photoUrl}
                alt="Motorcycle Cover"
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#1b4332] via-[#2d6a4f] to-[#7d988a] flex items-center justify-center relative">
                <Bike className="w-20 h-20 text-white/20 absolute -right-2 -bottom-2 rotate-[-10deg]" />
              </div>
            )}

            {/* Quick Edit Profile & Cover Photo Buttons */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-2">
              <button
                type="button"
                onClick={() => quickBikePhotoInputRef.current?.click()}
                title="Change Motorcycle Cover"
                className="py-0.5 px-2 rounded-full bg-black/45 hover:bg-black/75 text-white text-[9.5px] font-bold backdrop-blur-xs flex items-center gap-1 border border-white/20 transition-all cursor-pointer shadow-xs"
              >
                <ImageIcon className="w-2.5 h-2.5" />
                <span>Cover</span>
              </button>
              <button
                type="button"
                onClick={handleOpenEditModal}
                title="Edit Profile Details"
                className="py-0.5 px-2 rounded-full bg-black/45 hover:bg-black/75 text-white text-[9.5px] font-bold backdrop-blur-xs flex items-center gap-1 border border-white/20 transition-all cursor-pointer shadow-xs"
              >
                <Edit3 className="w-2.5 h-2.5" />
                <span>Edit</span>
              </button>
            </div>

            {/* Bottom-Right Cover Photo Pill: Breadcrumb (HONDA - RS125 > 125cc > 123-ABC) */}
            <div className="absolute bottom-2 right-0 z-1 select-none pointer-events-none max-w-[85%]">
              <div className="bg-white/98 backdrop-blur-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-l-full shadow-sm flex items-center gap-1 sm:gap-1.5 border-l border-y border-stone-200/60">
                <span className="font-heading font-bold text-[9px] sm:text-[10.5px] text-stone-900 tracking-tight whitespace-nowrap">
                  {rawMake.toUpperCase()} - {rawModel.toUpperCase()}
                </span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-stone-400 shrink-0" />
                <span className="font-heading font-medium text-[9px] sm:text-[10.5px] text-stone-700 whitespace-nowrap">
                  {rawCc}
                </span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-stone-400 shrink-0" />
                <span className="font-mono font-bold text-[9px] sm:text-[10.5px] text-stone-900 tracking-wide whitespace-nowrap">
                  {rawPlate.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Avatar & Rider Header Row (Avatar midpoint aligned to cover photo bottom edge) */}
          <div className="relative px-3.5 sm:px-5 -mt-10 sm:-mt-12 flex items-start gap-2.5 sm:gap-3.5 z-2 mb-3 sm:mb-4">
            {/* Circular Avatar */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-stone-100 border-[3px] sm:border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                {activeRider.avatar ? (
                  <img
                    src={activeRider.avatar}
                    alt={activeRider.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    fill="#000000"
                    xmlSpace="preserve"
                    viewBox="0 0 64 64"
                    className="w-14 h-14 sm:w-16 sm:h-16"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g>
                      <path
                        d="M18,12c0-5.522,4.478-10,10-10h8c5.522,0,10,4.478,10,10v7c0-3.313-2.687-6-6-6h-6c-2.209,0-4-1.791-4-4 c0-0.553-0.447-1-1-1s-1,0.447-1,1c0,2.209-1.791,4-4,4c-3.313,0-6,2.687-6,6V12z"
                        fill="#506C7F"
                      />
                      <path
                        d="M62,60c0,1.104-0.896,2-2,2H4c-1.104,0-2-0.896-2-2v-8c0-1.104,0.447-2.104,1.172-2.828l-0.004-0.004 c4.148-3.343,8.896-5.964,14.046-7.714C20.869,45.467,26.117,48,31.973,48c5.862,0,11.115-2.538,14.771-6.56 c5.167,1.75,9.929,4.376,14.089,7.728l-0.004,0.004C61.553,49.896,62,50.896,62,52V60z"
                        fill="#7d988a"
                      />
                      <g>
                        <path
                          d="M32,42c-2.853,0-5.502-0.857-7.715-2.322c-1.675,0.283-3.325,0.638-4.934,1.097 C22.602,43.989,27.041,46,31.973,46c4.938,0,9.383-2.017,12.634-5.238c-1.595-0.454-3.231-0.803-4.892-1.084 C37.502,41.143,34.853,42,32,42z"
                          fill="#F9EBB2"
                        />
                        <path
                          d="M46,22h-1c-0.553,0-1-0.447-1-1v-1v-1c0-2.209-1.791-4-4-4h-6c-2.088,0-3.926-1.068-5-2.687 C27.926,13.932,26.088,15,24,15c-2.209,0-4,1.791-4,4v1v1c0,0.553-0.447,1-1,1h-1c-0.553,0-1,0.447-1,1v2c0,0.553,0.447,1,1,1h1 c0.553,0,1,0.447,1,1v1c0,6.627,5.373,12,12,12s12-5.373,12-12v-1c0-0.553,0.447-1,1-1h1c0.553,0,1-0.447,1-1v-2 C47,22.447,46.553,22,46,22z"
                          fill="#F9EBB2"
                        />
                      </g>
                    </g>
                  </svg>
                )}
              </div>

              {/* Official Role / Officer Avatar Badge */}
              <RoleAvatarBadge
                role={activeRider.role || 'Member'}
                size="md"
                className="bottom-0 right-0 ring-2 ring-white shadow-md z-1"
              />

              {/* Camera Icon Overlay */}
              <button
                type="button"
                onClick={() => quickAvatarInputRef.current?.click()}
                title="Change Avatar Photo"
                className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white cursor-pointer z-2"
              >
                <Camera className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                <span className="text-[7.5px] font-bold mt-0.5">Change</span>
              </button>
            </div>

            {/* Member Name, ID & Network - Adjusted down slightly with avatar in place */}
            <div className="min-w-0 pt-11 sm:pt-13 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                <h2
                  className={`font-heading font-black text-stone-900 tracking-tight leading-tight truncate ${nameFontSizeClass}`}
                  title={activeRider.name}
                >
                  {activeRider.name}
                </h2>
                <span className="text-stone-300 font-light text-[11px] sm:text-xs shrink-0">|</span>
                <span className="font-mono font-bold text-[10px] sm:text-xs text-stone-800 shrink-0 whitespace-nowrap">
                  {activeRider.memberNumber || 'BRC-0002'}
                </span>
              </div>
              <p className="text-[10.5px] sm:text-xs font-semibold text-stone-600 truncate mt-0.5">
                {activeRider.network || 'Speaking Hammers'}
              </p>
            </div>
          </div>

          {/* Member QR Code Section with Hide/Unhide Toggle Button */}
          <div className="px-3.5 sm:px-6 mb-3 sm:mb-4 text-center">
            {/* Toggle Button named "QR Code" */}
            <div className="flex justify-center mb-1.5">
              <button
                type="button"
                id="btn-toggle-qr-code"
                onClick={toggleQrCode}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs border ${
                  showQrCode
                    ? 'bg-[#f0f9f1] hover:bg-[#d8f3dc] text-[#1b4332] border-[#74c69d]/60'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                }`}
                title={showQrCode ? 'Hide QR Code' : 'Show QR Code'}
              >
                <QrCode className="w-3.5 h-3.5 text-[#2d6a4f]" />
                <span>QR Code</span>
                {showQrCode ? (
                  <ChevronUp className="w-3.5 h-3.5 text-stone-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                )}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showQrCode && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* QR Code Container */}
                  <div className="flex justify-center pt-1 pb-1">
                    <div className="bg-white p-3 sm:p-4 rounded-[20px] sm:rounded-[24px] border border-[#e2ece2] shadow-xs inline-block">
                      <div className="relative inline-block">
                        <QRCodeSVG
                          value={qrValue}
                          size={145}
                          level="H"
                          bgColor="#FFFFFF"
                          fgColor="#1b4332"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <img
                            src="/logo.png"
                            alt="BCC"
                            className="w-8 h-8 object-contain bg-white rounded-full p-0.5 shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Contributions Section */}
          <div className="px-3.5 sm:px-6 mb-1 space-y-2">
            {/* Header: Title + Total Paid */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#1b4332] text-[#74c69d] flex items-center justify-center shrink-0 shadow-2xs">
                  <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                <h4 className="font-heading font-bold text-xs sm:text-sm text-stone-900">
                  Contributions
                </h4>
              </div>
              <div className="text-right">
                <span className="text-[8px] sm:text-[9px] font-extrabold uppercase text-stone-400 block tracking-wider">
                  TOTAL PAID
                </span>
                <span className="font-heading text-xs sm:text-sm font-black text-[#1b4332]">
                  ₱{totalPaidFromJoining.toLocaleString()}.00
                </span>
              </div>
            </div>

            {/* 4 Clean Stats Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {/* Membership Fee */}
              <div className="bg-white p-2 rounded-lg sm:rounded-xl border border-[#e2ece2] space-y-0.5 shadow-2xs">
                <span className="text-[8px] sm:text-[9px] font-extrabold text-stone-500 uppercase block tracking-wider truncate">
                  MEMBERSHIP
                </span>
                <p className="text-[11px] sm:text-xs font-black text-stone-900 truncate">
                  ₱{mfPaid.toLocaleString()}
                </p>
                <span className="text-[8px] sm:text-[9px] font-bold text-stone-500 block truncate">
                  {mfPaid > 0 ? '✓ Paid' : 'Pending'}
                </span>
              </div>

              {/* Monthly Dues */}
              <div className="bg-white p-2 rounded-lg sm:rounded-xl border border-[#e2ece2] space-y-0.5 shadow-2xs">
                <span className="text-[8px] sm:text-[9px] font-extrabold text-stone-500 uppercase block tracking-wider truncate">
                  DUES
                </span>
                <p className="text-[11px] sm:text-xs font-black text-stone-900 truncate">
                  ₱{duesPaid.toLocaleString()}
                </p>
                <span className="text-[8px] sm:text-[9px] font-bold text-stone-500 block truncate">
                  {riderRecords.filter((r) => r.itemType === 'Monthly Due' && r.status === 'Paid').length} mo paid
                </span>
              </div>

              {/* Other Collections */}
              <div className="bg-white p-2 rounded-lg sm:rounded-xl border border-[#e2ece2] space-y-0.5 shadow-2xs">
                <span className="text-[8px] sm:text-[9px] font-extrabold text-stone-500 uppercase block tracking-wider truncate">
                  OTHER
                </span>
                <p className="text-[11px] sm:text-xs font-black text-stone-900 truncate">
                  ₱{otherPaid.toLocaleString()}
                </p>
                <span className="text-[8px] sm:text-[9px] font-medium text-stone-500 block truncate">
                  Special fees
                </span>
              </div>

              {/* Balance */}
              <div className="bg-white p-2 rounded-lg sm:rounded-xl border border-[#e2ece2] space-y-0.5 shadow-2xs">
                <span className="text-[8px] sm:text-[9px] font-extrabold text-stone-500 uppercase block tracking-wider truncate">
                  BALANCE
                </span>
                <p className={`text-[11px] sm:text-xs font-black ${pendingDuesAmount > 0 ? 'text-amber-800' : 'text-emerald-700'} truncate`}>
                  ₱{pendingDuesAmount.toLocaleString()}
                </p>
                <span className="text-[8px] sm:text-[9px] font-bold text-stone-600 block truncate">
                  {pendingDuesAmount > 0 ? 'Unsettled' : '✓ Clear'}
                </span>
              </div>
            </div>

            {/* Quick Biometric Access Setting (for logged-in rider viewing own profile) */}
            {!isUserAdmin && (
              <div className="mt-3 p-2.5 sm:p-3 rounded-xl bg-white border border-[#e2ece2] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#1b4332] text-white flex items-center justify-center shrink-0">
                    <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#74c69d]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-[#1b4332]">
                        Fingerprint Login
                      </span>
                      {currentUser?.biometricEnabled ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Active (OTP Bypassed)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-stone-500 truncate">
                      {currentUser?.biometricEnabled
                        ? 'Sign in using your device fingerprint sensor without OTP.'
                        : 'Enroll your fingerprint sensor for instant passwordless sign-in.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0">
                  {biometricMessage && (
                    <span className="text-[10px] font-bold text-[#2d6a4f] truncate">
                      {biometricMessage}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleBiometric}
                    disabled={biometricLoading}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                      currentUser?.biometricEnabled
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-[#1b4332] text-white hover:bg-[#2d6a4f]'
                    }`}
                  >
                    <Fingerprint className="w-3 h-3" />
                    <span>
                      {biometricLoading
                        ? '...'
                        : currentUser?.biometricEnabled
                        ? 'Remove'
                        : 'Enroll'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {editModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] p-4 sm:p-6 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto text-[#2d3a3a]"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#e2ece2]">
                <h3 className="font-heading font-bold text-[#1b4332] text-sm sm:text-base">
                  Edit Rider Profile
                </h3>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1 text-[#52605d] hover:text-[#1b4332] rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-3 text-xs">
                {/* Avatar & Bike Photo Upload Row */}
                <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-[#f7f9f7] rounded-xl border border-[#e2ece2]">
                  {/* Avatar Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-extrabold uppercase text-[#52605d] block">
                      Avatar
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-white border border-[#e2ece2] overflow-hidden shrink-0 flex items-center justify-center">
                        {avatar || activeRider.avatar ? (
                          <img
                            src={avatar || activeRider.avatar}
                            alt="Avatar Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-4 h-4 text-[#52605d]" />
                        )}
                      </div>
                      <label className="py-1 px-2 rounded-lg bg-[#2d6a4f] text-white font-bold text-[10px] hover:bg-[#1b4332] transition-colors cursor-pointer inline-flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Motorcycle Photo Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-extrabold uppercase text-[#52605d] block">
                      Bike Photo
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-white border border-[#e2ece2] overflow-hidden shrink-0 flex items-center justify-center">
                        {bikePhoto || activeRider.bikeInfo?.photoUrl ? (
                          <img
                            src={bikePhoto || activeRider.bikeInfo?.photoUrl}
                            alt="Bike Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Bike className="w-4 h-4 text-[#52605d]" />
                        )}
                      </div>
                      <label className="py-1 px-2 rounded-lg bg-[#2d6a4f] text-white font-bold text-[10px] hover:bg-[#1b4332] transition-colors cursor-pointer inline-flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (reader.result) {
                                setCropperSrc(reader.result as string);
                                setCropperTarget('bike_edit');
                                setCropperTitle('Crop Motorcycle Photo');
                                setCropperOpen(true);
                              }
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {avatarError && (
                  <p className="text-[10.5px] font-bold text-rose-600">{avatarError}</p>
                )}

                <div>
                  <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Network</label>
                    <input
                      type="text"
                      value={network}
                      onChange={(e) => setNetwork(e.target.value)}
                      placeholder="e.g. Central / Life Group"
                      className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <div>
                    <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912..."
                      className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Bike Make</label>
                    <input
                      type="text"
                      value={bikeMake}
                      onChange={(e) => setBikeMake(e.target.value)}
                      placeholder="Yamaha"
                      className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Bike Model</label>
                    <input
                      type="text"
                      value={bikeModel}
                      onChange={(e) => setBikeModel(e.target.value)}
                      placeholder="NMAX 155"
                      className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Displacement</label>
                    <input
                      type="text"
                      value={engineCc}
                      onChange={(e) => setEngineCc(e.target.value)}
                      placeholder="155 cc"
                      className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Plate Number</label>
                    <input
                      type="text"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                      placeholder="ABC 1234"
                      className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#52605d] font-bold text-[11px] mb-1 block">Bio / Rider Quote</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    placeholder="Short bio or motto..."
                    className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="py-2 px-3 rounded-xl border border-[#e2ece2] text-[#52605d] font-bold text-xs hover:bg-[#f7f9f7] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar & Bike Photo Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={cropperSrc}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
        title={cropperTitle}
      />
      <OfficialLoader isLoading={isSaving} message="Updating Profile..." />
    </div>
  );
};
