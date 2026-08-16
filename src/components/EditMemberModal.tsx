import React, { useState, useRef, useEffect } from 'react';
import { User, CLUB_ROLES, MembershipType } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { OfficialLoader } from './OfficialLoader';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BirthdateDropdownPicker } from './BirthdateDropdownPicker';

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
  const [bikePhotoUrl, setBikePhotoUrl] = useState(member.bikeInfo?.photoUrl || '');

  // Riding Details
  const [ridingExperience, setRidingExperience] = useState(member.ridingExperience || 'Regular');
  const [riderType, setRiderType] = useState(member.riderType || 'Beginner');
  const [reasonForJoining, setReasonForJoining] = useState(member.reasonForJoining || '');
  const [recommendedBy, setRecommendedBy] = useState(member.recommendedBy || '');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const inputStyle =
    'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]';
  const selectStyle =
    'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f] cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-6 shadow-2xl text-[#2d3a3a] mt-4 mb-8 max-h-[90vh] overflow-y-auto"
      >

        {formError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-xs text-[#2d3a3a]">
          {/* Section 1: Club Role & Membership Details */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
              <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider">
                1. Club Role & Membership Status
              </h4>
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
                    ...CLUB_ROLES.map((r) => ({ value: r, label: r })),
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
                <label className="font-bold text-[#1b4332] block mb-1">
                  OR Expiry Date <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="date"
                  value={orExpiryDate}
                  onChange={(e) => setOrExpiryDate(e.target.value)}
                  className={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-[#1b4332] block mb-1">Motorcycle Photo Image URL</label>
              <input
                type="text"
                value={bikePhotoUrl}
                onChange={(e) => setBikePhotoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className={inputStyle}
              />
              {bikePhotoUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-[#e2ece2] h-32 bg-stone-900">
                  <img src={bikePhotoUrl} alt="Motorcycle Preview" className="w-full h-full object-cover" />
                </div>
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

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-gray-100 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-3 px-6 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4 text-[#74c69d]" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </motion.div>
      <OfficialLoader isLoading={isSaving} message="Updating Member Profile..." />
    </div>
  );
};
