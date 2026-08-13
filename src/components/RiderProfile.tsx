import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store, uploadStorageFile } from '../lib/db';
import { User as UserType } from '../types';
import { RoleAvatarBadge } from './RoleAvatarBadge';
import { CustomSelect } from './CustomSelect';
import { QRCodeSVG } from 'qrcode.react';
import {
  User,
  Users,
  ShieldCheck,
  Bike,
  CreditCard,
  QrCode,
  Calendar,
  Phone,
  Mail,
  Edit3,
  CheckCircle,
  Check,
  X,
  Upload,
  Zap,
  Camera,
  Crop,
  Wallet,
  Coins,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageCropperModal } from './ImageCropperModal';
import { OfficialLoader } from './OfficialLoader';

interface RiderProfileProps {
  onOpenDuesModal?: () => void;
}

export const RiderProfile: React.FC<RiderProfileProps> = ({ onOpenDuesModal }) => {
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
  const quickFileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(activeRider?.name || '');
  const [bio, setBio] = useState(activeRider?.bio || '');
  const [phone, setPhone] = useState(activeRider?.phone || '');
  const [avatar, setAvatar] = useState(activeRider?.avatar || '');
  const [avatarError, setAvatarError] = useState('');
  const [bikeMake, setBikeMake] = useState(activeRider?.bikeInfo?.make || '');
  const [bikeModel, setBikeModel] = useState(activeRider?.bikeInfo?.model || '');
  const [bikeYear, setBikeYear] = useState(activeRider?.bikeInfo?.year || 2024);
  const [engineCc, setEngineCc] = useState(activeRider?.bikeInfo?.engineCc || '');

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
    setAvatar(activeRider.avatar || '');
    setAvatarError('');
    setBikeMake(activeRider.bikeInfo?.make || '');
    setBikeModel(activeRider.bikeInfo?.model || '');
    setBikeYear(activeRider.bikeInfo?.year || 2024);
    setEngineCc(activeRider.bikeInfo?.engineCc || '');
    setEditModalOpen(true);
  };

  // Avatar Cropper State
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');
  const [cropperTarget, setCropperTarget] = useState<'direct' | 'edit'>('edit');

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
        setCropperTarget('edit');
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
        setCropperTarget('direct');
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    const compressed = await uploadStorageFile(croppedDataUrl);
    const finalUrl = compressed || croppedDataUrl;

    if (cropperTarget === 'direct' && activeRider) {
      const updated: UserType = {
        ...activeRider,
        avatar: finalUrl,
      };
      updateUser(updated);
    } else {
      setAvatar(finalUrl);
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
      avatar: avatar || activeRider.avatar,
      bikeInfo: {
        ...activeRider.bikeInfo,
        make: bikeMake,
        model: bikeModel,
        year: Number(bikeYear),
        engineCc,
      },
    };

    setTimeout(() => {
      updateUser(updated);
      setIsSaving(false);
      setEditModalOpen(false);
    }, 600);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Admin Inspector Notice Header */}
      {isUserAdmin && (
        <div className="p-4 rounded-2xl bg-[#1b4332] border border-[#2d6a4f] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#2d6a4f] text-[#74c69d] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm text-white">Admin Inspection Mode</h3>
              <p className="text-xs text-[#d8f3dc]/80">
                Admin users are excluded from rider profiles. Select a rider below to inspect their membership profile & garage.
              </p>
            </div>
          </div>

          {riderMembers.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
              <span className="text-xs text-[#d8f3dc] font-semibold whitespace-nowrap">Select Rider:</span>
              <div className="flex-1">
                <CustomSelect
                  value={activeRider.id}
                  onChange={(riderId) => {
                    setSelectedRiderId(riderId);
                    const selected = riderMembers.find((r) => r.id === riderId);
                    if (selected) {
                      setName(selected.name || '');
                      setBio(selected.bio || '');
                      setPhone(selected.phone || '');
                      setBikeMake(selected.bikeInfo?.make || '');
                      setBikeModel(selected.bikeInfo?.model || '');
                      setBikeYear(selected.bikeInfo?.year || 2024);
                      setEngineCc(selected.bikeInfo?.engineCc || '');
                    }
                  }}
                  options={riderMembers.map((rider) => ({
                    value: rider.id,
                    label: `${rider.name} (${rider.memberNumber || 'Rider'})`,
                  }))}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pass Card & Bike Garage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        {/* Digital Wallet Membership Pass Card */}
        <div className="relative rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-xs text-[#1b4332] overflow-hidden">
          {/* Avatar & Cardholder Info */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 group">
              <input
                type="file"
                ref={quickFileInputRef}
                accept="image/*"
                onChange={handleDirectAvatarUpload}
                className="hidden"
              />
              <img
                src={activeRider.avatar || '/avatar.svg'}
                alt={activeRider.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-[#e2ece2] shadow-xs"
              />
              <button
                type="button"
                onClick={() => quickFileInputRef.current?.click()}
                title="Upload new avatar photo (deletes and replaces old avatar)"
                className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white cursor-pointer"
              >
                <Camera className="w-5 h-5 text-white drop-shadow-md" />
                <span className="text-[9px] font-bold mt-0.5">Change</span>
              </button>
              <RoleAvatarBadge role={activeRider.role} size="lg" />
            </div>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-[#1b4332] font-extrabold text-base font-sans">{activeRider.name}</p>
              {activeRider.network && (
                <p className="text-[#2d6a4f] font-semibold font-sans text-xs">{activeRider.network}</p>
              )}
              <p className="text-[#2d6a4f] font-bold">{activeRider.memberNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-[#e2ece2]">
            <div>
              <span className="text-[#52605d] text-[10px] block font-bold">Club Role</span>
              <span className="font-extrabold text-[#2d6a4f] uppercase">{activeRider.role || 'Member'}</span>
            </div>
            <div>
              <span className="text-[#52605d] text-[10px] block font-bold">Joined</span>
              <span className="font-mono text-[#1b4332]">{activeRider.joinDate || '2026-01-01'}</span>
            </div>
          </div>

          {/* Member Verification QR Code */}
          {(() => {
            const firstName = activeRider.firstName || activeRider.name.split(' ')[0] || '';
            const lastName = activeRider.lastName || activeRider.name.split(' ').slice(1).join(' ') || activeRider.name;
            const qrValue = `Member ID: ${activeRider.memberNumber || 'N/A'}\nLast Name: ${lastName}\nFirst Name: ${firstName}`;
            return (
              <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-[10px] text-[#52605d] uppercase tracking-wider font-bold">
                  Member Verification QR Code
                </span>
                <div className="relative inline-block bg-white p-3.5 rounded-2xl border border-[#e2ece2] shadow-xs">
                  <QRCodeSVG
                    value={qrValue}
                    size={135}
                    level="H"
                    bgColor="#FFFFFF"
                    fgColor="#1b4332"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                      src="/logo.png"
                      alt="BCC Logo"
                      className="w-8 h-8 object-contain opacity-100 bg-white rounded-full p-0.5 shadow-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Bike Garage Card */}
        <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] space-y-4 shadow-xs self-start">
          <h3 className="font-heading font-bold text-[#1b4332] text-base flex items-center gap-2">
            <Bike className="w-5 h-5 text-[#2d6a4f]" />
            Primary Bike Garage
          </h3>

          <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3 text-xs">
            {activeRider.bikeInfo?.photoUrl && (
              <div className="rounded-xl overflow-hidden border border-[#e2ece2] shadow-xs mb-3 bg-stone-900">
                <img
                  src={activeRider.bikeInfo.photoUrl}
                  alt={`${activeRider.bikeInfo?.make} ${activeRider.bikeInfo?.model}`}
                  className="w-full h-44 object-cover"
                />
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[#52605d]">Vehicle:</span>
              <strong className="text-[#1b4332] font-heading text-sm">
                {activeRider.bikeInfo?.make} {activeRider.bikeInfo?.model}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[#52605d]">
              <span>Engine Displacement:</span>
              <strong className="text-[#2d6a4f]">
                {activeRider.bikeInfo?.engineCc
                  ? activeRider.bikeInfo.engineCc.toString().toLowerCase().endsWith('cc')
                    ? activeRider.bikeInfo.engineCc
                    : `${activeRider.bikeInfo.engineCc} cc`
                  : 'N/A'}
              </strong>
            </div>
            {activeRider.bikeInfo?.licensePlate && (
              <div className="flex justify-between items-center text-[#52605d]">
                <span>Plate No.:</span>
                <strong className="text-[#1b4332] font-mono">{activeRider.bikeInfo.licensePlate}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Club Financial Contribution Summary Card */}
        {(() => {
          const riderRecords = store.getFinanceRecords().filter((r) => r.userId === activeRider.id);
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

          return (
            <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] space-y-4 shadow-xs col-span-1 md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2ece2] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1b4332] text-[#74c69d] flex items-center justify-center shrink-0 shadow-2xs">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-[#1b4332] text-base leading-snug">
                      Contributions
                    </h3>
                    <p className="text-xs text-[#52605d] font-medium">
                      Total payments made to the club from joining date to present
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] text-left sm:text-right shrink-0">
                  <span className="text-[10px] font-extrabold uppercase text-[#52605d] block">
                    Total Paid (Joining - Present)
                  </span>
                  <span className="font-heading text-2xl font-black text-[#1b4332]">
                    ₱{totalPaidFromJoining.toLocaleString()}.00
                  </span>
                </div>
              </div>

              {/* Itemized Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Membership Fee */}
                <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1 hover:border-[#2d6a4f] transition-all">
                  <span className="text-[10px] font-extrabold text-[#52605d] uppercase block">
                    Membership Fee
                  </span>
                  <p className="text-sm font-black text-[#1b4332]">
                    ₱{mfPaid.toLocaleString()}.00
                  </p>
                  <span className="text-[10px] font-bold text-[#2d6a4f] block">
                    {mfPaid > 0 ? '✓ Verified Paid' : 'Pending'}
                  </span>
                </div>

                {/* Monthly Dues */}
                <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1 hover:border-[#2d6a4f] transition-all">
                  <span className="text-[10px] font-extrabold text-[#52605d] uppercase block">
                    Monthly Dues
                  </span>
                  <p className="text-sm font-black text-[#1b4332]">
                    ₱{duesPaid.toLocaleString()}.00
                  </p>
                  <span className="text-[10px] font-bold text-[#2d6a4f] block">
                    {riderRecords.filter((r) => r.itemType === 'Monthly Due' && r.status === 'Paid').length} month(s) paid
                  </span>
                </div>

                {/* Other Collections */}
                <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1 hover:border-[#2d6a4f] transition-all">
                  <span className="text-[10px] font-extrabold text-[#52605d] uppercase block">
                    Other Collections
                  </span>
                  <p className="text-sm font-black text-[#1b4332]">
                    ₱{otherPaid.toLocaleString()}.00
                  </p>
                  <span className="text-[10px] font-medium text-[#52605d] block">
                    Vests, promos & special fees
                  </span>
                </div>

                {/* Outstanding / Pending Dues */}
                <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1 hover:border-[#2d6a4f] transition-all">
                  <span className="text-[10px] font-extrabold text-[#52605d] uppercase block">
                    Pending Balance
                  </span>
                  <p className={`text-sm font-black ${pendingDuesAmount > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                    ₱{pendingDuesAmount.toLocaleString()}.00
                  </p>
                  <span className="text-[10px] font-bold text-[#52605d] block">
                    {pendingDuesAmount > 0 ? 'Unsettled dues' : '✓ All Clear'}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto text-[#2d3a3a]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2]">
                <h3 className="font-heading font-bold text-[#1b4332] text-lg">
                  Edit Rider Details
                </h3>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1.5 text-[#52605d] hover:text-[#1b4332] rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4 text-xs">
                {/* Avatar File Upload / Base64 Storage */}
                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Profile Avatar Image</label>
                  <div className="flex items-center gap-3">
                    <img
                      src={avatar || activeRider.avatar || '/avatar.svg'}
                      alt="Avatar Preview"
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#2d6a4f] shrink-0"
                    />
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <label className="py-1.5 px-3 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs hover:bg-[#1b4332] transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                            className="hidden"
                          />
                        </label>
                        {(avatar || activeRider.avatar) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCropperSrc(avatar || activeRider.avatar);
                              setCropperTarget('edit');
                              setCropperOpen(true);
                            }}
                            className="py-1.5 px-2.5 rounded-xl border border-[#2d6a4f]/30 bg-white text-[#2d6a4f] font-bold text-xs hover:bg-[#2d6a4f]/10 transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Crop className="w-3.5 h-3.5" />
                            <span>Crop</span>
                          </button>
                        )}
                        {avatar && (
                          <button
                            type="button"
                            onClick={() => setAvatar('')}
                            className="py-1.5 px-2.5 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs hover:bg-rose-50 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={avatar}
                        onChange={(e) => setAvatar(e.target.value)}
                        placeholder="Or paste URL / Base64 data..."
                        className="w-full px-3 py-1.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] font-mono text-[11px] focus:outline-none focus:border-[#2d6a4f]"
                      />
                      <p className="text-[10px] text-[#52605d]">Images (up to 10MB) are automatically compressed (~30KB–80KB) and stored directly in your account.</p>
                    </div>
                  </div>
                  {avatarError && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1.5">{avatarError}</p>
                  )}
                </div>

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Bio / Rider Quote</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Bike Make</label>
                    <input
                      type="text"
                      value={bikeMake}
                      onChange={(e) => setBikeMake(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a]"
                    />
                  </div>
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Bike Model</label>
                    <input
                      type="text"
                      value={bikeModel}
                      onChange={(e) => setBikeModel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Avatar Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={cropperSrc}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
        title="Crop Profile Avatar"
      />
      <OfficialLoader isLoading={isSaving} message="Updating Profile..." />
    </div>
  );
};

