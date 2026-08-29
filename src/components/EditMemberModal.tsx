import React, { useState, useRef, useEffect } from 'react';
import { User, CLUB_ROLES, MembershipType, ClubRoleDefinition } from '../types';
import { store, uploadStorageFile } from '../lib/db';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { OfficialLoader } from './OfficialLoader';
import { ImageCropperModal } from './ImageCropperModal';
import { RoleAvatarBadge } from './RoleAvatarBadge';
import {
  X,
  User as UserIcon,
  ShieldCheck,
  Mail,
  Phone,
  Bike,
  Save,
  AlertCircle,
  FileText,
  Compass,
  ChevronDown,
  Check,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
  Crop,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BirthdateDropdownPicker } from './BirthdateDropdownPicker';
import { InteractiveDatePicker } from './InteractiveDatePicker';

export function cleanBarangayCityAddress(address?: string, streetAddress?: string): string {
  if (!address) return '';
  if (!streetAddress || !streetAddress.trim()) return address.trim();

  const trimmedStreet = streetAddress.trim();
  const trimmedAddr = address.trim();

  if (trimmedAddr.toLowerCase().startsWith(trimmedStreet.toLowerCase())) {
    let clean = trimmedAddr.slice(trimmedStreet.length).trim();
    if (clean.startsWith(',')) {
      clean = clean.slice(1).trim();
    }
    return clean;
  }
  return trimmedAddr;
}

interface EditMemberModalProps {
  member: User;
  onSave: (updatedUser: User) => void;
  onClose: () => void;
}

const InteractiveSelect: React.FC<{
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}> = ({ label, value, onChange, options, disabled, required, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="font-bold text-[#1b4332] block mb-1">
          {label} {required && '*'}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a] font-semibold text-xs focus:outline-none focus:border-[#2d6a4f] focus:ring-2 focus:ring-[#2d6a4f]/20 transition-all cursor-pointer shadow-2xs hover:border-[#2d6a4f]/60 disabled:bg-[#f0f4f1] disabled:text-[#1b4332]/70 disabled:cursor-not-allowed text-left"
      >
        <span className="truncate">{selectedOpt?.label || value || 'Select option...'}</span>
        <ChevronDown
          className={`w-4 h-4 stroke-[2.5] text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full left-0 bg-white border border-[#2d6a4f]/30 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 text-xs"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#d8f3dc] text-[#1b4332] font-bold'
                      : 'text-[#2d3a3a] hover:bg-[#f0f4f1] hover:text-[#1b4332]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0 ml-2 stroke-[2.5]" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  member,
  onSave,
  onClose,
}) => {
  useModalDismiss(true, onClose);

  // Photos & Avatars
  const [avatar, setAvatar] = useState(member.avatar || '');
  const [avatarError, setAvatarError] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [bikePhotoUrl, setBikePhotoUrl] = useState(member.bikeInfo?.photoUrl || '');
  const [bikePhotoError, setBikePhotoError] = useState('');
  const [isUploadingBikePhoto, setIsUploadingBikePhoto] = useState(false);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');
  const [cropperTarget, setCropperTarget] = useState<'avatar' | 'bike'>('avatar');
  const [cropperTitle, setCropperTitle] = useState('Crop Member Avatar');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bikePhotoInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('Avatar image file size exceeds 10MB limit. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCropperSrc(reader.result as string);
        setCropperTarget('avatar');
        setCropperTitle('Crop Member Avatar');
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBikePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBikePhotoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setBikePhotoError('Motorcycle photo file size exceeds 10MB limit. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCropperSrc(reader.result as string);
        setCropperTarget('bike');
        setCropperTitle('Crop Motorcycle Photo');
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    setCropperOpen(false);
    const lastNameVal = lastName.trim() || firstName.trim() || member.name || 'member';

    if (cropperTarget === 'avatar') {
      setIsUploadingAvatar(true);
      try {
        const compressed = await uploadStorageFile(croppedDataUrl, 'avatars', 800, 0.82, lastNameVal);
        setAvatar(compressed || croppedDataUrl);
      } catch (err) {
        console.warn('Avatar upload notice:', err);
        setAvatar(croppedDataUrl);
      } finally {
        setIsUploadingAvatar(false);
      }
    } else {
      setIsUploadingBikePhoto(true);
      try {
        const compressed = await uploadStorageFile(croppedDataUrl, 'bike', 1200, 0.85, lastNameVal);
        setBikePhotoUrl(compressed || croppedDataUrl);
      } catch (err) {
        console.warn('Bike photo upload notice:', err);
        setBikePhotoUrl(croppedDataUrl);
      } finally {
        setIsUploadingBikePhoto(false);
      }
    }
  };

  // Personal Info
  const [firstName, setFirstName] = useState(
    member.firstName || (member.name ? member.name.split(' ')[0] : '')
  );
  const [lastName, setLastName] = useState(
    member.lastName || (member.name ? member.name.split(' ').slice(1).join(' ') : '')
  );
  const [role, setRole] = useState<string>(member.role || 'Member');
  const [username, setUsername] = useState(
    member.username || (member.email ? member.email.split('@')[0] : '')
  );
  const [email, setEmail] = useState(member.email || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [mobileNo, setMobileNo] = useState(member.mobileNo || member.phone || '');
  const initialStreet = member.streetAddress || '';
  const initialAddress = cleanBarangayCityAddress(member.address, initialStreet);
  const [address, setAddress] = useState(initialAddress);
  const [streetAddress, setStreetAddress] = useState(initialStreet);
  const [network, setNetwork] = useState(member.network || '');
  const [chapter, setChapter] = useState(member.chapter || '');
  const [civilStatus, setCivilStatus] = useState(member.civilStatus || 'Single');
  const [leadersName, setLeadersName] = useState(member.leadersName || '');
  const [leadersContactNo, setLeadersContactNo] = useState(member.leadersContactNo || '');
  const [affiliations, setAffiliations] = useState<string[]>(() => {
    if (member.affiliation) {
      return member.affiliation.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return ['House Church'];
  });
  const [customAffiliation, setCustomAffiliation] = useState<string>('');

  const affiliation = affiliations.includes('Others') && customAffiliation.trim()
    ? [...affiliations.filter((a) => a !== 'Others'), customAffiliation.trim()].join(', ')
    : affiliations.join(', ');
  const [occupation, setOccupation] = useState(member.occupation || '');
  const [occupationStatus, setOccupationStatus] = useState(member.occupationStatus || 'Active');
  const [lifeInsurance, setLifeInsurance] = useState(member.lifeInsurance || '');

  const [birthdate, setBirthdate] = useState(member.birthdate || '');
  const [gender, setGender] = useState(member.gender || 'Male');
  const [licenseNo, setLicenseNo] = useState(member.licenseNo || '');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState(
    member.licenseExpiryDate || ''
  );

  // Membership
  const [memberNumber, setMemberNumber] = useState(member.memberNumber || '');
  const [membershipType, setMembershipType] = useState<MembershipType>(
    member.membershipType || 'Standard'
  );

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState(
    member.emergencyContact?.name || ''
  );
  const [emergencyRelationship, setEmergencyRelationship] = useState(
    member.emergencyContact?.relationship || ''
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    member.emergencyContact?.phone || ''
  );

  // Bike Info
  const [bikeMake, setBikeMake] = useState(member.bikeInfo?.make || '');
  const [bikeModel, setBikeModel] = useState(member.bikeInfo?.model || '');
  const [engineCc, setEngineCc] = useState(member.bikeInfo?.engineCc || '');
  const [engineNo, setEngineNo] = useState(member.bikeInfo?.engineNo || '');
  const [chassisNo, setChassisNo] = useState(member.bikeInfo?.chassisNo || '');
  const [crNo, setCrNo] = useState(member.bikeInfo?.crNo || '');
  const [orNo, setOrNo] = useState(member.bikeInfo?.orNo || '');
  const [orExpiryDate, setOrExpiryDate] = useState(
    member.bikeInfo?.orExpiryDate || ''
  );
  const [bikeColor, setBikeColor] = useState(member.bikeInfo?.color || '');
  const [plateNo, setPlateNo] = useState(member.bikeInfo?.plateNo || member.bikeInfo?.licensePlate || '');
  const [bikeCondition, setBikeCondition] = useState(member.bikeInfo?.condition || 'Good');
  const [yearsInService, setYearsInService] = useState(member.bikeInfo?.yearsInService || '');
  const [licenseRestrictionCode, setLicenseRestrictionCode] = useState(member.bikeInfo?.licenseRestrictionCode || 'A');
  const [conditionCode, setConditionCode] = useState(member.bikeInfo?.conditionCode || '');

  // Riding Details
  const [ridingExperience, setRidingExperience] = useState(member.ridingExperience || 'Regular');
  const [riderType, setRiderType] = useState(member.riderType || 'Beginner');
  const [reasonForJoining, setReasonForJoining] = useState(member.reasonForJoining || '');
  const [recommendedBy, setRecommendedBy] = useState(member.recommendedBy || '');

  const [clubRolesList, setClubRolesList] = useState<ClubRoleDefinition[]>(() => store.getClubRoles());

  useEffect(() => {
    const handleRolesUpdated = (e: Event) => {
      const updated = (e as CustomEvent).detail || store.getClubRoles();
      if (Array.isArray(updated)) {
        setClubRolesList(updated);
      }
    };
    window.addEventListener('bcc_roles_updated', handleRolesUpdated);
    return () => {
      window.removeEventListener('bcc_roles_updated', handleRolesUpdated);
    };
  }, []);

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Age calculation
  const calculateAge = (dob: string): number | undefined => {
    if (!dob) return undefined;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return undefined;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : undefined;
  };

  const computedAge = calculateAge(birthdate);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError('');

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First Name and Last Name are required.');
      return;
    }

    if (!email.trim()) {
      setFormError('Email address is required.');
      return;
    }

    if (mobileNo.trim() && mobileNo.trim().length !== 11) {
      setFormError('Mobile No. must be exactly 11 digits (e.g., 09171234567).');
      return;
    }

    if (leadersContactNo.trim() && leadersContactNo.trim().length !== 11) {
      setFormError("Leader's Contact No. must be exactly 11 digits (e.g., 09189876543).");
      return;
    }

    if (emergencyPhone.trim() && emergencyPhone.trim().length !== 11) {
      setFormError('Emergency Contact Phone must be exactly 11 digits (e.g., 09179998888).');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const cleanEmail = email.trim();
    const fallbackUsername = cleanEmail ? cleanEmail.split('@')[0] : `rider_${String(member.id || Date.now()).slice(-4)}`;
    const cleanUsername = username.trim() || member.username || fallbackUsername;

    const updatedUser: User = {
      ...member,
      avatar: avatar.trim(),
      name: fullName,
      username: cleanUsername,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: role,
      email: cleanEmail,
      phone: (mobileNo.trim() || phone.trim()),
      address: cleanBarangayCityAddress(address.trim(), streetAddress.trim()),
      streetAddress: streetAddress.trim(),
      network: network.trim(),
      chapter: chapter.trim(),
      civilStatus,
      leadersName: leadersName.trim(),
      leadersContactNo: leadersContactNo.trim(),
      affiliation,
      mobileNo: (mobileNo.trim() || phone.trim()),
      occupation: occupation.trim(),
      occupationStatus,
      lifeInsurance: lifeInsurance.trim(),
      birthdate,
      age: computedAge,
      gender,
      licenseNo: licenseNo.trim(),
      licenseExpiryDate,
      ridingExperience,
      riderType,
      reasonForJoining: reasonForJoining.trim(),
      recommendedBy: recommendedBy.trim(),
      memberNumber: memberNumber.trim(),
      membershipType,
      emergencyContact: {
        name: emergencyName.trim() || 'Emergency Contact',
        relationship: emergencyRelationship.trim() || 'Family',
        phone: emergencyPhone.trim() || mobileNo.trim() || phone.trim() || '+63 917 000 0000',
      },
      bikeInfo: {
        ...member.bikeInfo,
        make: bikeMake.trim() || 'Yamaha',
        model: bikeModel.trim() || 'MT-09',
        engineCc: engineCc.trim() || '890cc',
        engineNo: engineNo.trim(),
        chassisNo: chassisNo.trim(),
        crNo: crNo.trim(),
        orNo: orNo.trim(),
        orExpiryDate,
        color: bikeColor.trim(),
        plateNo: plateNo.trim(),
        licensePlate: plateNo.trim(),
        condition: bikeCondition,
        yearsInService: yearsInService.trim(),
        licenseRestrictionCode: licenseRestrictionCode.trim(),
        conditionCode: conditionCode.trim(),
        photoUrl: bikePhotoUrl.trim(),
      },
    };

    setIsSaving(true);
    setTimeout(() => {
      onSave(updatedUser);
      setIsSaving(false);
    }, 500);
  };

  // Keyboard shortcut: Pressing Enter saves changes once info/role is done
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        if (target) {
          // If explicitly focused on the Cancel button, let cancel handle it
          if (target.tagName?.toLowerCase() === 'button' && target.textContent?.toLowerCase().includes('cancel')) {
            return;
          }

          // If focused on an open dropdown search input
          if (target.getAttribute('placeholder')?.toLowerCase().includes('search')) {
            return;
          }
        }

        e.preventDefault();
        handleSubmitRef.current();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const inputStyle =
    'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]';
  const selectStyle =
    'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f] cursor-pointer';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg sm:max-w-2xl max-h-[60dvh] sm:max-h-[72dvh] flex flex-col rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-2xl text-[#2d3a3a] overflow-hidden my-auto"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#e2ece2] bg-[#f7f9f7] shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-lg truncate">
              Edit Member Profile: {member.name}
            </h3>
            <p className="text-[10.5px] sm:text-xs text-[#52605d] mt-0.5 truncate">
              Update official role, personal info, motorcycle garage, and club records.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-stone-200 cursor-pointer shrink-0 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 sm:space-y-4 overscroll-contain pr-2 scroll-smooth">
          {formError && (
            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form id="edit-member-form" onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 text-xs text-[#2d3a3a]">
          {/* Section 1: Club Role & Membership Details */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
              <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider">
                1. Club Role, Avatar & Membership Status
              </h4>
            </div>

            {/* Member Profile Avatar Card */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#e2ece2] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-[#1b4332] flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  Member Profile Avatar & Photo
                </span>
                {isUploadingAvatar && (
                  <span className="text-[10px] font-bold text-[#2d6a4f] flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Uploading to Google Drive...
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                <div className="relative shrink-0 inline-block">
                  <img
                    src={avatar || '/avatar.svg'}
                    alt="Member Avatar Preview"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                    }}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#2d6a4f] shadow-md bg-stone-100"
                  />
                  <RoleAvatarBadge role={role} size="md" />
                </div>

                <div className="flex-1 space-y-1.5 text-center sm:text-left min-w-0 w-full">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="px-3 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#74c69d]" />
                      <span>{avatar ? 'Change Avatar' : 'Upload Avatar'}</span>
                    </button>

                    {avatar && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setCropperSrc(avatar);
                            setCropperTarget('avatar');
                            setCropperTitle('Crop Member Avatar');
                            setCropperOpen(true);
                          }}
                          disabled={isUploadingAvatar}
                          className="px-2.5 py-1.5 rounded-xl bg-[#f7f9f7] hover:bg-[#e2ece2] border border-[#e2ece2] text-[#1b4332] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Crop className="w-3.5 h-3.5 text-[#2d6a4f]" />
                          <span>Crop</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAvatar('');
                            setAvatarError('');
                          }}
                          disabled={isUploadingAvatar}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Reset</span>
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-[#52605d]">
                    Accepted: JPG, PNG, WEBP (Max 10MB). Image is automatically compressed and saved to your club Google Shared Drive.
                  </p>
                  {avatarError && (
                    <p className="text-[10.5px] font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{avatarError}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Official Club Role Selector */}
              <div>
                <InteractiveSelect
                  label="Official Club Role"
                  required
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'admin', label: 'System Administrator (Admin)' },
                    ...clubRolesList.map((r) => ({
                      value: r.name,
                      label: `${r.name} (${r.category})`,
                    })),
                    // If current role is custom/legacy and not found in definitions
                    ...(role && role !== 'admin' && !clubRolesList.some((r) => r.name.toLowerCase() === role.toLowerCase())
                      ? [{ value: role, label: `${role} (Current)` }]
                      : []),
                  ]}
                />
                <p className="text-[10px] text-[#52605d] mt-1">
                  Only administrators can modify active member roles.
                </p>
              </div>

              <div>
                <label className="font-bold text-[#1b4332] block mb-1.5">
                  Member Number ID
                </label>
                <input
                  type="text"
                  value={memberNumber}
                  onChange={(e) => setMemberNumber(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. BRC-0000"
                />
              </div>

              <div>
                <label className="font-bold text-[#1b4332] block mb-1.5">
                  Portal Sign-in Username *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputStyle}
                  placeholder="e.g. rider_john"
                />
                <p className="text-[10px] text-[#52605d] mt-1">
                  Unique username used by the member to sign in to the portal.
                </p>
              </div>
            </div>


          </div>

          {/* Section 2: Personal & Contact Information */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
              <UserIcon className="w-4 h-4 text-[#2d6a4f]" />
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider">
                2. Personal & Contact Information
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Street Address / House No. / Unit</label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. Door 3, Km 5 Palm Drive"
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Barangay, City, Province, Region</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Brgy. Mahayag, Davao City, Davao del Sur"
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Network</label>
                <input
                  type="text"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  placeholder="e.g. Men's Network"
                  className={inputStyle}
                />
              </div>
              <InteractiveSelect
                label="Chapter"
                value={chapter || 'Buhangin (Main)'}
                onChange={setChapter}
                options={[
                  { value: 'Buhangin (Main)', label: 'Buhangin (Main)' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InteractiveSelect
                label="Civil Status"
                value={civilStatus}
                onChange={setCivilStatus}
                options={[
                  { value: 'Single', label: 'Single' },
                  { value: 'Married', label: 'Married' },
                  { value: 'Widowed', label: 'Widowed' },
                  { value: 'Separated', label: 'Separated' },
                ]}
              />

              <BirthdateDropdownPicker
                label="Birthdate"
                value={birthdate}
                onChange={(val) => setBirthdate(val)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InteractiveSelect
                label="Gender"
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Age ({computedAge !== undefined ? `${computedAge} yrs` : 'N/A'})
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={computedAge !== undefined ? `${computedAge} years old` : ''}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-100 border border-[#e2ece2] text-[#52605d]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Leader's Name</label>
                <input
                  type="text"
                  value={leadersName}
                  onChange={(e) => setLeadersName(e.target.value)}
                  placeholder="e.g. Pastor / Leader John Doe"
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Leader's Contact No. <span className="text-[#52605d] font-normal text-[10px]">(11 digits)</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={leadersContactNo}
                  onChange={(e) => setLeadersContactNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09189876543"
                  className={inputStyle}
                />
                {leadersContactNo && leadersContactNo.length !== 11 && (
                  <p className="text-[10px] text-amber-700 font-semibold mt-1">
                    Must be exactly 11 digits ({leadersContactNo.length}/11)
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1b4332] block">
                    Affiliation <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-[#2d6a4f] font-semibold bg-[#e8f5e9] px-2 py-0.5 rounded-full">
                    Allow Multiple Selection
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'House Church',
                    'Life Group',
                    'Plug-In',
                    'Y2DN',
                    'Others',
                  ].map((option) => {
                    const isSelected = affiliations.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setAffiliations(affiliations.filter((a) => a !== option));
                          } else {
                            setAffiliations([...affiliations, option]);
                          }
                        }}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                            : 'bg-white text-[#1b4332] border-[#e2ece2] hover:border-[#2d6a4f]'
                        }`}
                      >
                        <span className="text-xs font-bold">{option}</span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#74c69d] text-[#1b4332]' : 'bg-[#f7f9f7] border border-[#e2ece2]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {affiliations.includes('Others') && (
                  <div className="pt-1.5 space-y-1">
                    <label className="text-xs font-bold text-[#1b4332] block">
                      Please specify other affiliation:
                    </label>
                    <input
                      type="text"
                      value={customAffiliation}
                      onChange={(e) => setCustomAffiliation(e.target.value)}
                      placeholder="e.g. Worship Ministry, Ushering, Youth Fellowship"
                      className={inputStyle}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Mobile No. <span className="text-[#52605d] font-normal text-[10px]">(11 digits)</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={mobileNo}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setMobileNo(val);
                    setPhone(val);
                  }}
                  placeholder="09171234567"
                  className={inputStyle}
                />
                {mobileNo && mobileNo.length !== 11 && (
                  <p className="text-[10px] text-amber-700 font-semibold mt-1">
                    Must be exactly 11 digits ({mobileNo.length}/11)
                  </p>
                )}
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">License Number</label>
                <input
                  type="text"
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Occupation / Business</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <InteractiveSelect
                label="Occupation Status"
                value={occupationStatus}
                onChange={setOccupationStatus}
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Retired', label: 'Retired' },
                ]}
              />
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Life Insurance (If any)</label>
                <input
                  type="text"
                  value={lifeInsurance}
                  onChange={(e) => setLifeInsurance(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Emergency Contact */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
              <Phone className="w-4 h-4 text-[#2d6a4f]" />
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider">
                3. Emergency Contact Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Contact Name</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Relationship</label>
                <input
                  type="text"
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Contact Phone <span className="text-[#52605d] font-normal text-[10px]">(11 digits)</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09179998888"
                  className={inputStyle}
                />
                {emergencyPhone && emergencyPhone.length !== 11 && (
                  <p className="text-[10px] text-amber-700 font-semibold mt-1">
                    Must be exactly 11 digits ({emergencyPhone.length}/11)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Motorcycle Specifications */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
              <Bike className="w-4 h-4 text-[#2d6a4f]" />
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider">
                4. Motorcycle Specifications
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Make <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={bikeMake}
                  onChange={(e) => setBikeMake(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Model <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={bikeModel}
                  onChange={(e) => setBikeModel(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Engine Displacement (CC) <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={engineCc}
                  onChange={(e) => setEngineCc(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 890"
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Color <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={bikeColor}
                  onChange={(e) => setBikeColor(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Plate No. <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={plateNo}
                  onChange={(e) => setPlateNo(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <InteractiveSelect
                label="Status / Condition"
                required
                value={bikeCondition}
                onChange={setBikeCondition}
                options={[
                  { value: 'Excellent', label: 'Excellent' },
                  { value: 'Good', label: 'Good' },
                  { value: 'Fair', label: 'Fair' },
                  { value: 'Custom', label: 'Custom' },
                  { value: 'Under Maintenance', label: 'Under Maintenance' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Vehicle's Years of Service <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={yearsInService}
                  onChange={(e) => setYearsInService(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="e.g. 2"
                  className={inputStyle}
                />
              </div>
              <InteractiveSelect
                label="License Restriction Code"
                value={licenseRestrictionCode}
                onChange={setLicenseRestrictionCode}
                options={[
                  { value: 'A', label: 'A - Motorcycle' },
                  { value: 'A1', label: 'A1 - Tricycle' },
                  { value: 'B', label: 'B - Passenger Car' },
                  { value: 'B1', label: 'B1 - Light Commercial Vehicle' },
                  { value: 'B2', label: 'B2 - Medium Commercial Vehicle' },
                  { value: 'C', label: 'C - Heavy Commercial Vehicle' },
                  { value: 'D', label: 'D - Bus' },
                  { value: 'BE', label: 'BE - Articulated Passenger Car' },
                  { value: 'CE', label: 'CE - Heavy Articulated Vehicle' },
                ]}
              />
              <InteractiveSelect
                label="Condition Codes"
                value={conditionCode}
                onChange={setConditionCode}
                options={[
                  { value: '', label: 'None / No Condition Code' },
                  { value: '1', label: '1 - Wear corrective lenses' },
                  { value: '2', label: '2 - Drive with hearing aid' },
                  { value: '3', label: '3 - Drive customized vehicle' },
                  { value: '4', label: '4 - Daylight driving only' },
                  { value: '5', label: '5 - Accompanied by licensed driver' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Engine Number <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={engineNo}
                  onChange={(e) => setEngineNo(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  Chassis / VIN Number <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={chassisNo}
                  onChange={(e) => setChassisNo(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  CR No. <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={crNo}
                  onChange={(e) => setCrNo(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">
                  OR No. <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="text"
                  value={orNo}
                  onChange={(e) => setOrNo(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <InteractiveDatePicker
                  label="OR Expiry Date"
                  value={orExpiryDate}
                  onChange={(val) => setOrExpiryDate(val)}
                  required
                />
              </div>
            </div>

            {/* Motorcycle Garage Photo Card */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#e2ece2] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-bold text-[#1b4332] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  Motorcycle Garage Photo
                </span>
                {isUploadingBikePhoto && (
                  <span className="text-[10px] font-bold text-[#2d6a4f] flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Uploading to Google Drive...
                  </span>
                )}
              </div>

              {/* Photo Preview */}
              <div className="relative rounded-xl overflow-hidden border border-[#e2ece2] bg-stone-900 h-36 sm:h-48 group shadow-xs">
                <img
                  src={
                    bikePhotoUrl ||
                    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=800'
                  }
                  alt={`${bikeMake || 'Motorcycle'} ${bikeModel || ''}`}
                  className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-102"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=800';
                  }}
                />
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#1b4332]/90 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-extrabold tracking-wide flex items-center gap-1.5 shadow-md border border-white/20">
                  <Bike className="w-3.5 h-3.5 text-[#74c69d]" />
                  <span>{bikeMake || 'Motorcycle'} {bikeModel || ''}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={bikePhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBikePhotoFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => bikePhotoInputRef.current?.click()}
                    disabled={isUploadingBikePhoto}
                    className="px-3 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#74c69d]" />
                    <span>{bikePhotoUrl ? 'Change Bike Photo' : 'Upload Bike Photo'}</span>
                  </button>

                  {bikePhotoUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setCropperSrc(bikePhotoUrl);
                          setCropperTarget('bike');
                          setCropperTitle('Crop Motorcycle Photo');
                          setCropperOpen(true);
                        }}
                        disabled={isUploadingBikePhoto}
                        className="px-2.5 py-1.5 rounded-xl bg-[#f7f9f7] hover:bg-[#e2ece2] border border-[#e2ece2] text-[#1b4332] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Crop className="w-3.5 h-3.5 text-[#2d6a4f]" />
                        <span>Crop</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBikePhotoUrl('');
                          setBikePhotoError('');
                        }}
                        disabled={isUploadingBikePhoto}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Remove</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="text-[10px] text-[#52605d]">
                  Linked to member QR profile & garage
                </div>
              </div>

              {bikePhotoError && (
                <p className="text-[10.5px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{bikePhotoError}</span>
                </p>
              )}
            </div>
          </div>

          {/* Section 5: Riding Details */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
              <Compass className="w-4 h-4 text-[#2d6a4f]" />
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider">
                5. Riding Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InteractiveSelect
                label="Riding Experience/s"
                value={ridingExperience}
                onChange={setRidingExperience}
                options={[
                  { value: 'Regular', label: 'Regular' },
                  { value: 'Motorcross', label: 'Motorcross' },
                  { value: 'Enduro', label: 'Enduro' },
                  { value: 'Extreme', label: 'Extreme' },
                ]}
              />
              <InteractiveSelect
                label="Type of Rider"
                value={riderType}
                onChange={setRiderType}
                options={[
                  { value: 'Beginner', label: 'Beginner' },
                  { value: 'Intermediate', label: 'Intermediate' },
                  { value: 'Advanced', label: 'Advanced' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Reason for Joining</label>
                <input
                  type="text"
                  value={reasonForJoining}
                  onChange={(e) => setReasonForJoining(e.target.value)}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="font-bold text-[#1b4332] block mb-1">Recommended By</label>
                <input
                  type="text"
                  value={recommendedBy}
                  onChange={(e) => setRecommendedBy(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Sticky Action Footer */}
        <div className="flex items-center justify-end gap-2.5 p-3 sm:p-4 border-t border-[#e2ece2] bg-[#f7f9f7] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 sm:py-2.5 px-3.5 sm:px-5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-member-form"
            className="py-2 sm:py-2.5 px-4 sm:px-6 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4 text-[#74c69d]" />
            <span>Save Changes</span>
          </button>
        </div>
      </motion.div>

      {/* Avatar & Bike Photo Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={cropperSrc}
        title={cropperTitle}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />

      <OfficialLoader isLoading={isSaving} message="Updating Member Profile..." />
    </div>
  );
};
