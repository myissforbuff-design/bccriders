import React, { useState, useRef, useEffect } from 'react';
import { User, MembershipType, ApprovalStatus } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { uploadStorageFile } from '../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { useFormAutoSave } from '../hooks/useFormAutoSave';
import { LTO_RESTRICTION_CODES_2026, LTO_CONDITIONS_2026 } from './RegistrationPageFlow';
import { BirthdateDropdownPicker } from './BirthdateDropdownPicker';
import { cleanBarangayCityAddress } from './EditMemberModal';
import {
  User as UserIcon,
  Phone,
  Mail,
  Lock,
  Calendar,
  Shield,
  Bike,
  Camera,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileText,
  UserCheck,
  Compass,
  FileSignature,
  Eraser,
  X,
  ChevronDown,
  Check,
  RotateCcw,
  Award,
  Crop,
} from 'lucide-react';
import { ImageCropperModal } from './ImageCropperModal';

interface MemberRegistrationFormProps {
  onSuccess?: (newUser: User) => void;
  onCancel?: () => void;
  isAdminCreation?: boolean;
  initialData?: User;
  isReadOnly?: boolean;
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
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] font-semibold text-xs focus:outline-none focus:border-[#2d6a4f] focus:ring-2 focus:ring-[#2d6a4f]/20 transition-all cursor-pointer shadow-2xs hover:border-[#2d6a4f]/60 disabled:bg-[#f0f4f1] disabled:text-[#1b4332]/70 disabled:cursor-not-allowed text-left"
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

export const MemberRegistrationForm: React.FC<MemberRegistrationFormProps> = ({
  onSuccess,
  onCancel,
  isAdminCreation = false,
  initialData,
  isReadOnly = false,
}) => {
  // Personal Info
  const [firstName, setFirstName] = useState(
    initialData?.firstName || (initialData?.name ? initialData.name.split(' ')[0] : '')
  );
  const [lastName, setLastName] = useState(
    initialData?.lastName || (initialData?.name ? initialData.name.split(' ').slice(1).join(' ') : '')
  );
  const [birthdate, setBirthdate] = useState(initialData?.birthdate || '');
  const [gender, setGender] = useState(initialData?.gender || 'Male');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [mobileNo, setMobileNo] = useState(initialData?.mobileNo || initialData?.phone || '');
  const initStreet = initialData?.streetAddress || '';
  const [streetAddress, setStreetAddress] = useState(initStreet);
  const [address, setAddress] = useState(cleanBarangayCityAddress(initialData?.address, initStreet));
  const [network, setNetwork] = useState(initialData?.network || '');
  const [chapter, setChapter] = useState(initialData?.chapter || '');
  const [civilStatus, setCivilStatus] = useState(initialData?.civilStatus || 'Single');
  const [leadersName, setLeadersName] = useState(initialData?.leadersName || '');
  const [leadersContactNo, setLeadersContactNo] = useState(initialData?.leadersContactNo || '');
  const [affiliations, setAffiliations] = useState<string[]>(() => {
    if (initialData?.affiliation) {
      return initialData.affiliation.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return ['House Church'];
  });
  const [customAffiliation, setCustomAffiliation] = useState<string>('');

  const affiliation = affiliations.includes('Others') && customAffiliation.trim()
    ? [...affiliations.filter((a) => a !== 'Others'), customAffiliation.trim()].join(', ')
    : affiliations.join(', ');
  const [occupation, setOccupation] = useState(initialData?.occupation || '');
  const [occupationStatus, setOccupationStatus] = useState(initialData?.occupationStatus || 'Active');
  const [lifeInsurance, setLifeInsurance] = useState(initialData?.lifeInsurance || '');

  const [licenseNo, setLicenseNo] = useState(initialData?.licenseNo || '');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState(initialData?.licenseExpiryDate || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState(initialData?.password || '');
  const [membershipType, setMembershipType] = useState<MembershipType>(initialData?.membershipType || 'Standard');

  // Avatar State
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>(initialData?.avatar || '');
  const [avatarFileName, setAvatarFileName] = useState<string>('');
  const [avatarError, setAvatarError] = useState<string>('');
  const [cropperOpen, setCropperOpen] = useState<boolean>(false);
  const [cropperSrc, setCropperSrc] = useState<string>('');

  // Emergency Contact
  const [emergencyFullName, setEmergencyFullName] = useState(initialData?.emergencyContact?.name || '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(initialData?.emergencyContact?.relationship || '');
  const [emergencyPhone, setEmergencyPhone] = useState(initialData?.emergencyContact?.phone || '');

  // Motorcycle Info
  const [bikeMake, setBikeMake] = useState(initialData?.bikeInfo?.make || 'Yamaha');
  const [bikeModel, setBikeModel] = useState(initialData?.bikeInfo?.model || 'MT-09');
  const [engineCc, setEngineCc] = useState(initialData?.bikeInfo?.engineCc || '890cc');
  const [engineNo, setEngineNo] = useState(initialData?.bikeInfo?.engineNo || '');
  const [chassisNo, setChassisNo] = useState(initialData?.bikeInfo?.chassisNo || '');
  const [crNo, setCrNo] = useState(initialData?.bikeInfo?.crNo || '');
  const [orNo, setOrNo] = useState(initialData?.bikeInfo?.orNo || '');
  const [orExpiryDate, setOrExpiryDate] = useState(initialData?.bikeInfo?.orExpiryDate || '');
  const [bikeColor, setBikeColor] = useState(initialData?.bikeInfo?.color || '');
  const [plateNo, setPlateNo] = useState(initialData?.bikeInfo?.plateNo || initialData?.bikeInfo?.licensePlate || '');
  const [bikeCondition, setBikeCondition] = useState(initialData?.bikeInfo?.condition || 'Good');
  const [yearsInService, setYearsInService] = useState(initialData?.bikeInfo?.yearsInService || '');
  const [licenseRestrictionCode, setLicenseRestrictionCode] = useState(initialData?.bikeInfo?.licenseRestrictionCode || 'A');
  const [conditionCode, setConditionCode] = useState(initialData?.bikeInfo?.conditionCode || '');
  const [restrictionCodes, setRestrictionCodes] = useState<string[]>(
    initialData?.bikeInfo?.restrictionCodes ||
      (initialData?.bikeInfo?.licenseRestrictionCode
        ? initialData.bikeInfo.licenseRestrictionCode.split(',').map((s) => s.trim()).filter(Boolean)
        : ['A'])
  );
  const [ltoConditions, setLtoConditions] = useState<string[]>(
    initialData?.bikeInfo?.ltoConditions ||
      (initialData?.bikeInfo?.conditionCode
        ? initialData.bikeInfo.conditionCode.split(',').map((s) => s.trim()).filter(Boolean)
        : ['None'])
  );
  const [bikePhotoUrl, setBikePhotoUrl] = useState<string>(initialData?.bikeInfo?.photoUrl || '');
  const [bikePhotoFileName, setBikePhotoFileName] = useState<string>('');

  const handleBikePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBikePhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedUrl = canvas.toDataURL('image/jpeg', 0.75);
          setBikePhotoUrl(compressedUrl);
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  // Riding Details
  const [ridingExperience, setRidingExperience] = useState(initialData?.ridingExperience || 'Regular');
  const [riderType, setRiderType] = useState(initialData?.riderType || 'Beginner');
  const [reasonForJoining, setReasonForJoining] = useState(initialData?.reasonForJoining || '');
  const [recommendedBy, setRecommendedBy] = useState(initialData?.recommendedBy || '');

  // Declaration & Signature
  const [applicantSignature, setApplicantSignature] = useState(initialData?.applicantSignature || '');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [formError, setFormError] = useState('');

  // --- Auto-Save Draft Integration ---
  const memberFormDataToSave = {
    firstName,
    lastName,
    birthdate,
    gender,
    phone,
    mobileNo,
    address,
    network,
    chapter,
    civilStatus,
    leadersName,
    leadersContactNo,
    affiliation,
    occupation,
    occupationStatus,
    lifeInsurance,
    licenseNo,
    licenseExpiryDate,
    email,
    membershipType,
    emergencyFullName,
    emergencyRelationship,
    emergencyPhone,
    bikeMake,
    bikeModel,
    engineCc,
    engineNo,
    chassisNo,
    crNo,
    orNo,
    orExpiryDate,
    bikeColor,
    plateNo,
    bikeCondition,
    yearsInService,
    licenseRestrictionCode,
    conditionCode,
    ridingExperience,
    riderType,
    reasonForJoining,
    recommendedBy,
  };

  const {
    restoredData,
    hasRestoredDraft,
    lastSavedAt,
    clearDraft,
    dismissDraftNotification,
  } = useFormAutoSave({
    key: 'bcc_member_form_draft',
    formData: memberFormDataToSave,
    excludeKeys: ['password', 'applicantSignature', 'avatarDataUrl'],
  });

  useModalDismiss(hasRestoredDraft && !initialData, dismissDraftNotification);

  // Restore fields when user clicks "Restore Draft"
  const handleRestoreDraft = () => {
    if (restoredData && !initialData) {
      if (restoredData.firstName !== undefined) setFirstName(restoredData.firstName);
      if (restoredData.lastName !== undefined) setLastName(restoredData.lastName);
      if (restoredData.birthdate !== undefined) setBirthdate(restoredData.birthdate);
      if (restoredData.gender !== undefined) setGender(restoredData.gender);
      if (restoredData.phone !== undefined) setPhone(restoredData.phone);
      if (restoredData.mobileNo !== undefined) setMobileNo(restoredData.mobileNo);
      if (restoredData.address !== undefined) setAddress(restoredData.address);
      if (restoredData.network !== undefined) setNetwork(restoredData.network);
      if (restoredData.chapter !== undefined) setChapter(restoredData.chapter);
      if (restoredData.civilStatus !== undefined) setCivilStatus(restoredData.civilStatus);
      if (restoredData.leadersName !== undefined) setLeadersName(restoredData.leadersName);
      if (restoredData.leadersContactNo !== undefined) setLeadersContactNo(restoredData.leadersContactNo);
      if ((restoredData as any).affiliations && Array.isArray((restoredData as any).affiliations)) {
        setAffiliations((restoredData as any).affiliations);
      } else if ((restoredData as any).affiliation) {
        setAffiliations(String((restoredData as any).affiliation).split(',').map((s: string) => s.trim()).filter(Boolean));
      }
      if ((restoredData as any).customAffiliation !== undefined) setCustomAffiliation((restoredData as any).customAffiliation);
      if (restoredData.occupation !== undefined) setOccupation(restoredData.occupation);
      if (restoredData.occupationStatus !== undefined) setOccupationStatus(restoredData.occupationStatus);
      if (restoredData.lifeInsurance !== undefined) setLifeInsurance(restoredData.lifeInsurance);
      if (restoredData.licenseNo !== undefined) setLicenseNo(restoredData.licenseNo);
      if (restoredData.licenseExpiryDate !== undefined) setLicenseExpiryDate(restoredData.licenseExpiryDate);
      if (restoredData.email !== undefined) setEmail(restoredData.email);
      if (restoredData.membershipType !== undefined) setMembershipType(restoredData.membershipType as any);
      if (restoredData.emergencyFullName !== undefined) setEmergencyFullName(restoredData.emergencyFullName);
      if (restoredData.emergencyRelationship !== undefined) setEmergencyRelationship(restoredData.emergencyRelationship);
      if (restoredData.emergencyPhone !== undefined) setEmergencyPhone(restoredData.emergencyPhone);
      if (restoredData.bikeMake !== undefined) setBikeMake(restoredData.bikeMake);
      if (restoredData.bikeModel !== undefined) setBikeModel(restoredData.bikeModel);
      if (restoredData.engineCc !== undefined) setEngineCc(restoredData.engineCc);
      if (restoredData.engineNo !== undefined) setEngineNo(restoredData.engineNo);
      if (restoredData.chassisNo !== undefined) setChassisNo(restoredData.chassisNo);
      if (restoredData.crNo !== undefined) setCrNo(restoredData.crNo);
      if (restoredData.orNo !== undefined) setOrNo(restoredData.orNo);
      if (restoredData.orExpiryDate !== undefined) setOrExpiryDate(restoredData.orExpiryDate);
      if (restoredData.bikeColor !== undefined) setBikeColor(restoredData.bikeColor);
      if (restoredData.plateNo !== undefined) setPlateNo(restoredData.plateNo);
      if (restoredData.bikeCondition !== undefined) setBikeCondition(restoredData.bikeCondition);
      if (restoredData.yearsInService !== undefined) setYearsInService(restoredData.yearsInService);
      if (restoredData.licenseRestrictionCode !== undefined) setLicenseRestrictionCode(restoredData.licenseRestrictionCode);
      if (restoredData.conditionCode !== undefined) setConditionCode(restoredData.conditionCode);
      if (restoredData.ridingExperience !== undefined) setRidingExperience(restoredData.ridingExperience);
      if (restoredData.riderType !== undefined) setRiderType(restoredData.riderType);
      if (restoredData.reasonForJoining !== undefined) setReasonForJoining(restoredData.reasonForJoining);
      if (restoredData.recommendedBy !== undefined) setRecommendedBy(restoredData.recommendedBy);
    }
    dismissDraftNotification();
  };

  // Sync initialData changes into form state (e.g. when opening/reviewing different members)
  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName || (initialData.name ? initialData.name.split(' ')[0] : ''));
      setLastName(initialData.lastName || (initialData.name ? initialData.name.split(' ').slice(1).join(' ') : ''));
      setBirthdate(initialData.birthdate || '');
      setGender(initialData.gender || 'Male');
      setPhone(initialData.phone || '');
      setMobileNo(initialData.mobileNo || initialData.phone || '');
      const currStreet = initialData.streetAddress || '';
      setStreetAddress(currStreet);
      setAddress(cleanBarangayCityAddress(initialData.address, currStreet));
      setNetwork(initialData.network || '');
      setChapter(initialData.chapter || '');
      setCivilStatus(initialData.civilStatus || 'Single');
      setLeadersName(initialData.leadersName || '');
      setLeadersContactNo(initialData.leadersContactNo || '');
      if (initialData.affiliation) {
        setAffiliations(initialData.affiliation.split(',').map((s) => s.trim()).filter(Boolean));
      } else {
        setAffiliations(['House Church']);
      }
      setOccupation(initialData.occupation || '');
      setOccupationStatus(initialData.occupationStatus || 'Active');
      setLifeInsurance(initialData.lifeInsurance || '');
      setLicenseNo(initialData.licenseNo || '');
      setLicenseExpiryDate(initialData.licenseExpiryDate || '');
      setEmail(initialData.email || '');
      setPassword(initialData.password || '');
      setMembershipType(initialData.membershipType || 'Standard');
      setAvatarDataUrl(initialData.avatar || '');
      setEmergencyFullName(initialData.emergencyContact?.name || '');
      setEmergencyRelationship(initialData.emergencyContact?.relationship || '');
      setEmergencyPhone(initialData.emergencyContact?.phone || '');
      setBikeMake(initialData.bikeInfo?.make || 'Yamaha');
      setBikeModel(initialData.bikeInfo?.model || 'MT-09');
      setEngineCc(initialData.bikeInfo?.engineCc || '890cc');
      setEngineNo(initialData.bikeInfo?.engineNo || '');
      setChassisNo(initialData.bikeInfo?.chassisNo || '');
      setCrNo(initialData.bikeInfo?.crNo || '');
      setOrNo(initialData.bikeInfo?.orNo || '');
      setOrExpiryDate(initialData.bikeInfo?.orExpiryDate || '');
      setBikeColor(initialData.bikeInfo?.color || '');
      setPlateNo(initialData.bikeInfo?.plateNo || initialData.bikeInfo?.licensePlate || '');
      setBikeCondition(initialData.bikeInfo?.condition || 'Good');
      setYearsInService(initialData.bikeInfo?.yearsInService || '');
      setLicenseRestrictionCode(initialData.bikeInfo?.licenseRestrictionCode || 'A');
      setConditionCode(initialData.bikeInfo?.conditionCode || '');
      setRestrictionCodes(
        initialData.bikeInfo?.restrictionCodes ||
          (initialData.bikeInfo?.licenseRestrictionCode
            ? initialData.bikeInfo.licenseRestrictionCode.split(',').map((s) => s.trim()).filter(Boolean)
            : ['A'])
      );
      setLtoConditions(
        initialData.bikeInfo?.ltoConditions ||
          (initialData.bikeInfo?.conditionCode
            ? initialData.bikeInfo.conditionCode.split(',').map((s) => s.trim()).filter(Boolean)
            : ['None'])
      );
      setBikePhotoUrl(initialData.bikeInfo?.photoUrl || '');
      setRidingExperience(initialData.ridingExperience || 'Regular');
      setRiderType(initialData.riderType || 'Beginner');
      setReasonForJoining(initialData.reasonForJoining || '');
      setRecommendedBy(initialData.recommendedBy || '');
      setApplicantSignature(initialData.applicantSignature || '');
    }
  }, [initialData]);

  const inputStyle = isReadOnly
    ? 'w-full px-3.5 py-2.5 rounded-xl bg-[#f0f4f1] text-[#1b4332] font-semibold border border-[#d0ded0] cursor-not-allowed select-none opacity-90'
    : 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] focus:outline-none focus:border-[#2d6a4f]';

  const selectStyle = isReadOnly
    ? 'w-full px-3.5 py-2.5 rounded-xl bg-[#f0f4f1] text-[#1b4332] font-semibold border border-[#d0ded0] cursor-not-allowed select-none opacity-90'
    : 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] focus:outline-none focus:border-[#2d6a4f] cursor-pointer';

  // Draw initial signature if present
  useEffect(() => {
    if (applicantSignature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = applicantSignature;
      }
    }
  }, [applicantSignature]);

  // Calculate age automatically from birthdate
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

  // Avatar file upload handler converting to Base64 string for MongoDB (Max 10MB)
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('Image file size exceeds the 10MB limit. Please select a smaller image file.');
      e.target.value = '';
      return;
    }

    setAvatarFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCropperSrc(reader.result as string);
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    const compressed = await uploadStorageFile(croppedDataUrl);
    setAvatarDataUrl(compressed || croppedDataUrl);
  };

  // Canvas Drawing Handlers
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

    let clientX = 0;
    let clientY = 0;

    const nativeEv = e.nativeEvent as any;
    if (nativeEv && nativeEv.touches && nativeEv.touches.length > 0) {
      clientX = nativeEv.touches[0].clientX;
      clientY = nativeEv.touches[0].clientY;
    } else if (nativeEv && nativeEv.changedTouches && nativeEv.changedTouches.length > 0) {
      clientX = nativeEv.changedTouches[0].clientX;
      clientY = nativeEv.changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent<HTMLCanvasElement>).clientX;
      clientY = (e as React.MouseEvent<HTMLCanvasElement>).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (isReadOnly) return;
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const coords = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (isReadOnly) return;
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCoordinates(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#1b4332';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setApplicantSignature(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    setApplicantSignature('');
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Please enter both First Name and Last Name.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setFormError('Please provide a valid Email and Password for Portal Account access.');
      return;
    }

    if (!mobileNo.trim() || mobileNo.trim().length !== 11) {
      setFormError('Mobile No. is required and must be exactly 11 digits (e.g., 09171234567).');
      return;
    }

    if (leadersContactNo.trim() && leadersContactNo.trim().length !== 11) {
      setFormError("Leader's Contact No. must be exactly 11 digits (e.g., 09189876543).");
      return;
    }

    if (!emergencyPhone.trim() || emergencyPhone.trim().length !== 11) {
      setFormError('Contact Phone (Emergency Contact) is required and must be exactly 11 digits (e.g., 09179998888).');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const defaultAvatar = '/avatar.svg';
    const approvalStatus: ApprovalStatus = isAdminCreation ? 'Approved' : 'Pending';
    const submissionDate = new Date().toISOString().split('T')[0];

    const newUserObject: User = {
      id: initialData?.id || '',
      username: email.trim().split('@')[0],
      name: fullName,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthdate,
      age: computedAge,
      gender,
      email: email.trim(),
      password: password.trim(),
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
      licenseNo: licenseNo.trim(),
      licenseExpiryDate,
      ridingExperience,
      riderType,
      reasonForJoining: reasonForJoining.trim(),
      recommendedBy: recommendedBy.trim(),
      applicantSignature: applicantSignature || (canvasRef.current ? canvasRef.current.toDataURL('image/png') : ''),
      declarationDate: initialData?.declarationDate || submissionDate,
      role: initialData?.role || 'Member',
      memberNumber: initialData?.memberNumber || '',
      approvalStatus,
      avatar: avatarDataUrl || defaultAvatar,
      bio: 'BCC Riders Club Member.',
      joinDate: initialData?.joinDate || submissionDate,
      emergencyContact: {
        name: emergencyFullName.trim() || 'Emergency Contact',
        relationship: emergencyRelationship.trim() || 'Family',
        phone: emergencyPhone.trim() || mobileNo.trim() || phone.trim() || '+63 917 000 0000',
      },
      bikeInfo: {
        make: bikeMake.trim() || 'Yamaha',
        model: bikeModel.trim() || 'MT-09',
        year: initialData?.bikeInfo?.year || 2024,
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
        photoUrl: bikePhotoUrl,
        restrictionCodes: restrictionCodes,
        licenseRestrictionCode: restrictionCodes.join(', '),
        ltoConditions: ltoConditions,
        conditionCode: ltoConditions.join(', '),
      },
      totalMiles: initialData?.totalMiles || 0,
      totalRides: initialData?.totalRides || 0,
      streakDays: initialData?.streakDays || 0,
      unlockedBadgeIds: initialData?.unlockedBadgeIds || [],
    };

    // Automatically delete draft from localStorage on successful submission
    clearDraft();

    if (onSuccess) {
      onSuccess(newUserObject);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs text-[#2d3a3a]">
      {/* Restored Draft Modal */}
      <AnimatePresence>
        {hasRestoredDraft && !initialData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-emerald-100 relative overflow-hidden text-left space-y-5"
            >
              {/* Top Decorative Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-500 to-[#1b4332]" />

              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0 text-amber-700 shadow-xs">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-[#1b4332]">
                      Unsaved Draft Found
                    </h3>
                    {lastSavedAt && (
                      <span className="text-[10px] sm:text-xs font-semibold text-amber-800 bg-amber-100/80 border border-amber-200/60 px-2.5 py-0.5 rounded-full">
                        Saved {lastSavedAt}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[#52605d] leading-relaxed">
                    We detected previously entered member registration details saved on this device. Would you like to restore your progress or start fresh?
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={dismissDraftNotification}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#52605d] text-xs font-bold transition-colors cursor-pointer"
                >
                  Start Fresh
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore Draft
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {formError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* SECTION 1: Personal Information */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
        <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
          <UserIcon className="w-4 h-4 text-[#2d6a4f]" />
          <h4 className="font-heading font-extrabold text-sm uppercase tracking-wider">
            1. Personal Information
          </h4>
        </div>

        {/* Avatar Image Upload / Base64 Storage */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#1b4332] block">
            Rider Profile Avatar (Optional - Default avatar will be used if left blank)
          </label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-[#2d6a4f] shrink-0 flex items-center justify-center shadow-xs">
              <img
                src={avatarDataUrl || '/avatar.svg'}
                alt="Avatar preview"
                className="w-full h-full object-cover p-1"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                }}
              />
            </div>

            <div className="space-y-2 flex-1 w-full">
              {!isReadOnly ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="py-2 px-3.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs">
                      <Upload className="w-4 h-4 text-[#74c69d]" />
                      <span>Upload Profile Photo (Max 2MB)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                    </label>

                    {avatarDataUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setCropperSrc(avatarDataUrl);
                            setCropperOpen(true);
                          }}
                          className="py-2 px-3.5 rounded-xl bg-white border border-[#2d6a4f]/30 text-[#2d6a4f] font-bold text-xs hover:bg-[#2d6a4f]/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Crop className="w-3.5 h-3.5 text-[#2d6a4f]" />
                          <span>Crop Photo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAvatarDataUrl('');
                            setAvatarFileName('');
                            setAvatarError('');
                          }}
                          className="py-2 px-3.5 rounded-xl bg-white border border-rose-300 text-rose-700 font-bold text-xs hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          Reset Avatar
                        </button>
                      </>
                    )}
                  </div>

                  {avatarFileName && (
                    <p className="text-[11px] text-[#2d6a4f] font-mono truncate">
                      Selected File: {avatarFileName} (Encoded as Base64)
                    </p>
                  )}

                  <div className="pt-1">
                    <input
                      type="text"
                      value={avatarDataUrl}
                      onChange={(e) => setAvatarDataUrl(e.target.value)}
                      placeholder="Or paste image URL / Base64 string directly..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#2d6a4f]/30 text-[#1b4332] font-mono text-xs focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>

                  <p className="text-[10px] font-medium text-[#52605d]">
                    Member avatar photo.
                  </p>
                </>
              ) : (
                <p className="text-xs text-[#52605d]">
                  Member avatar stored directly in MongoDB collection.
                </p>
              )}
            </div>
          </div>

          {avatarError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
              {avatarError}
            </p>
          )}
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">First Name *</label>
            <input
              type="text"
              required
              disabled={isReadOnly}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. John"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Last Name *</label>
            <input
              type="text"
              required
              disabled={isReadOnly}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Doe"
              className={inputStyle}
            />
          </div>
        </div>

        {/* Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Street Address / House No. / Unit</label>
            <input
              type="text"
              disabled={isReadOnly}
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
              disabled={isReadOnly}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Brgy. Mahayag, Davao City, Davao del Sur"
              className={inputStyle}
            />
          </div>
        </div>

        {/* Network & Chapter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Network</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              placeholder="e.g. Men's Network / Youth Network"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Chapter</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Buhangin Chapter / Main"
              className={inputStyle}
            />
          </div>
        </div>

        {/* Civil Status, Birthdate, Age, Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InteractiveSelect
            label="Civil Status"
            value={civilStatus}
            onChange={setCivilStatus}
            disabled={isReadOnly}
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
            disabled={isReadOnly}
            onChange={(val) => setBirthdate(val)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Calculated Age</label>
            <input
              type="text"
              readOnly
              disabled
              value={computedAge !== undefined ? `${computedAge} yrs old` : 'Auto-calculated'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f4f1] border border-[#d0ded0] text-[#1b4332] font-bold"
            />
          </div>
          <InteractiveSelect
            label="Gender"
            value={gender}
            onChange={setGender}
            disabled={isReadOnly}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
              { value: 'Other', label: 'Other' },
            ]}
          />
        </div>

        {/* Leader's Name & Leader's Contact No */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Leader's Name</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={leadersName}
              onChange={(e) => setLeadersName(e.target.value)}
              placeholder="e.g. Pastor / Leader John Doe"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">
              Leader's Contact No. <span className="text-[#52605d] font-normal text-[10px]">(11 digits required)</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              disabled={isReadOnly}
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
                'Plug-in',
                'Y2DN',
                'Others',
              ].map((option) => {
                const isSelected = affiliations.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={isReadOnly}
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
                  disabled={isReadOnly}
                  value={customAffiliation}
                  onChange={(e) => setCustomAffiliation(e.target.value)}
                  placeholder="e.g. Worship Ministry, Ushering, Youth Fellowship"
                  className={inputStyle}
                />
              </div>
            )}
          </div>
        </div>

        {/* Mobile No & Occupation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">
              Mobile No. <span className="text-rose-500">*</span> <span className="text-[#52605d] font-normal text-[10px]">(11 digits required)</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              disabled={isReadOnly}
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
            <label className="font-bold text-[#1b4332] block mb-1">Occupation / Business</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g. Civil Engineer / Businessman"
              className={inputStyle}
            />
          </div>
          <InteractiveSelect
            label="Occupation Status"
            value={occupationStatus}
            onChange={setOccupationStatus}
            disabled={isReadOnly}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Retired', label: 'Retired' },
            ]}
          />
        </div>

        {/* Life Insurance & Driver's License */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Life Insurance (If any)</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={lifeInsurance}
              onChange={(e) => setLifeInsurance(e.target.value)}
              placeholder="e.g. SunLife / PruLife UK / None"
              className={inputStyle}
            />
          </div>
        </div>

        {/* Account Credentials (Email & Password) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Email Address (Portal Account) *</label>
            <input
              type="email"
              required
              disabled={isReadOnly}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rider@example.com"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Portal Account Password *</label>
            <input
              type={isReadOnly ? 'text' : 'password'}
              required
              disabled={isReadOnly}
              value={isReadOnly ? '••••••••' : password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#e2ece2] focus:outline-none focus:border-[#2d6a4f]"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Emergency Contact */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
        <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
          <Phone className="w-4 h-4 text-[#2d6a4f]" />
          <h4 className="font-heading font-extrabold text-sm uppercase tracking-wider">
            2. Emergency Contact
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Contact Full Name</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={emergencyFullName}
              onChange={(e) => setEmergencyFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className={inputStyle}
            />
          </div>
          <InteractiveSelect
            label="Relationship"
            value={emergencyRelationship}
            onChange={setEmergencyRelationship}
            disabled={isReadOnly}
            options={[
              { value: 'Spouse', label: 'Spouse' },
              { value: 'Mother', label: 'Mother' },
              { value: 'Father', label: 'Father' },
              { value: 'Guardian', label: 'Guardian' },
              { value: 'Others', label: 'Others' },
            ]}
          />
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">
              Contact Phone <span className="text-rose-500">*</span> <span className="text-[#52605d] font-normal text-[10px]">(11 digits required)</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              disabled={isReadOnly}
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

      {/* SECTION 3: Motorcycle Information */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
        <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
          <Bike className="w-4 h-4 text-[#2d6a4f]" />
          <h4 className="font-heading font-extrabold text-sm uppercase tracking-wider">
            3. Motorcycle Information
          </h4>
        </div>

        {/* Driver's License & Multi-Select LTO 2026 Codes */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-[#e2ece2] space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-[#e2ece2]">
            <Award className="w-4 h-4 text-[#2d6a4f]" />
            <span className="text-xs font-extrabold text-[#1b4332] uppercase tracking-wider">
              Driver's License & LTO 2026 Details
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#1b4332] block mb-1">Driver's License No.</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={licenseNo}
                onChange={(e) => setLicenseNo(e.target.value)}
                placeholder="N01-12-345678"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="font-bold text-[#1b4332] block mb-1">License Expiry Date</label>
              <input
                type="date"
                disabled={isReadOnly}
                value={licenseExpiryDate}
                onChange={(e) => setLicenseExpiryDate(e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>

          {/* Multi-Select License Restriction Codes (LTO 2026) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#1b4332] block text-xs">
                License Restriction Code (Philippines LTO 2026)
              </label>
              <span className="text-[10px] text-[#2d6a4f] font-semibold bg-[#e8f5e9] px-2 py-0.5 rounded-full">
                Multiple Selection Allowed
              </span>
            </div>
            <p className="text-[10px] text-[#52605d]">Select all authorized DL codes:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LTO_RESTRICTION_CODES_2026.map((item) => {
                const isSelected = restrictionCodes.includes(item.code);
                return (
                  <button
                    key={item.code}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => {
                      if (isReadOnly) return;
                      if (isSelected) {
                        setRestrictionCodes(restrictionCodes.filter((c) => c !== item.code));
                      } else {
                        setRestrictionCodes([...restrictionCodes, item.code]);
                      }
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all text-xs flex items-start gap-2 ${
                      isReadOnly ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      isSelected
                        ? 'bg-[#1b4332] text-white border-[#1b4332]'
                        : 'bg-white text-[#1b4332] border-[#e2ece2] hover:border-[#2d6a4f]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black ${
                        isSelected ? 'bg-[#74c69d] text-[#1b4332]' : 'bg-[#f7f9f7] border border-[#e2ece2] text-[#52605d]'
                      }`}
                    >
                      {item.code}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[11px] leading-tight">{item.title}</div>
                      <div className={`text-[9px] line-clamp-2 ${isSelected ? 'text-emerald-100' : 'text-[#52605d]'}`}>
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* LTO Conditions */}
          <div className="space-y-1.5 pt-2 border-t border-[#e2ece2]">
            <label className="font-bold text-[#1b4332] block text-xs">
              Conditions (Philippines LTO 2026)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LTO_CONDITIONS_2026.map((cond) => {
                const isSelected = ltoConditions.includes(cond.code);
                return (
                  <button
                    key={cond.code}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => {
                      if (isReadOnly) return;
                      if (cond.code === 'None') {
                        setLtoConditions(['None']);
                      } else {
                        const withoutNone = ltoConditions.filter((c) => c !== 'None');
                        if (isSelected) {
                          const next = withoutNone.filter((c) => c !== cond.code);
                          setLtoConditions(next.length ? next : ['None']);
                        } else {
                          setLtoConditions([...withoutNone, cond.code]);
                        }
                      }
                    }}
                    className={`p-2 rounded-xl text-left text-xs font-semibold border transition-all flex items-center gap-2 ${
                      isReadOnly ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      isSelected
                        ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]'
                        : 'bg-white text-[#1b4332] border-[#e2ece2] hover:border-[#2d6a4f]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#74c69d] border-[#74c69d]' : 'border-[#e2ece2] bg-[#f7f9f7]'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-[#1b4332]" />}
                    </div>
                    <span>{cond.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Bike Make</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={bikeMake}
              onChange={(e) => setBikeMake(e.target.value)}
              placeholder="e.g. Yamaha, Honda, BMW"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Bike Model</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={bikeModel}
              onChange={(e) => setBikeModel(e.target.value)}
              placeholder="e.g. MT-09, Africa Twin"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">
              Engine Displacement (CC) <span className="text-[#52605d] font-normal text-[10px]">(Numbers only)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              disabled={isReadOnly}
              value={engineCc}
              onChange={(e) => setEngineCc(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 890"
              className={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Color</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={bikeColor}
              onChange={(e) => setBikeColor(e.target.value)}
              placeholder="e.g. Matte Black / Red"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Plate No.</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={plateNo}
              onChange={(e) => setPlateNo(e.target.value)}
              placeholder="e.g. 123-ABC"
              className={inputStyle}
            />
          </div>
          <InteractiveSelect
            label="Status / Condition"
            value={bikeCondition}
            onChange={setBikeCondition}
            disabled={isReadOnly}
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
              Vehicle's Years in Service <span className="text-[#52605d] font-normal text-[10px]">(Numbers only)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              disabled={isReadOnly}
              value={yearsInService}
              onChange={(e) => setYearsInService(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="e.g. 2"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Engine Number</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={engineNo}
              onChange={(e) => setEngineNo(e.target.value)}
              placeholder="e.g. ENG-99214A"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Chassis / VIN Number</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={chassisNo}
              onChange={(e) => setChassisNo(e.target.value)}
              placeholder="e.g. CHS-88123B"
              className={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">CR No (Certificate of Reg)</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={crNo}
              onChange={(e) => setCrNo(e.target.value)}
              placeholder="CR-001293"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">OR No (Official Receipt)</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={orNo}
              onChange={(e) => setOrNo(e.target.value)}
              placeholder="OR-991823"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">OR Expiry Date</label>
            <input
              type="date"
              disabled={isReadOnly}
              value={orExpiryDate}
              onChange={(e) => setOrExpiryDate(e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>

        {/* Motorcycle Photo Upload Field */}
        <div className="pt-3 border-t border-[#e2ece2] space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-[#1b4332] flex items-center gap-1.5 text-xs sm:text-sm">
              <span>Motorcycle Photo</span>
              {!isReadOnly && <span className="text-rose-600 font-extrabold">* Required</span>}
            </label>
          </div>

          {bikePhotoUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-[#e2ece2] bg-stone-900 group max-w-sm">
              <img
                src={bikePhotoUrl}
                alt="Motorcycle"
                className="w-full h-44 sm:h-52 object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {!isReadOnly && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="px-3 py-1.5 bg-white text-[#1b4332] text-xs font-bold rounded-xl shadow-md cursor-pointer hover:bg-[#f7f9f7]">
                    Change Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBikePhotoChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setBikePhotoUrl('');
                      setBikePhotoFileName('');
                    }}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-rose-700 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-lg flex items-center justify-between">
                <span className="truncate font-mono">{bikePhotoFileName || 'Motorcycle Photo'}</span>
                <span className="text-emerald-400 font-bold shrink-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Validated
                </span>
              </div>
            </div>
          ) : !isReadOnly ? (
            <label className="border-2 border-dashed border-[#2d6a4f]/40 hover:border-[#2d6a4f] bg-white rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[#d8f3dc]/20 text-center space-y-2 group">
              <div className="w-11 h-11 rounded-2xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-[#1b4332]">
                  Upload Motorcycle Photo <span className="text-rose-600">*</span>
                </p>
                <p className="text-[10px] text-[#52605d] mt-0.5">
                  Click or drag image file (PNG, JPG, WebP). Auto-compressed for database storage.
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleBikePhotoChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="p-3 bg-stone-100 rounded-xl text-center text-xs text-stone-500 italic">
              No motorcycle photo uploaded
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Riding Details */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
        <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
          <Compass className="w-4 h-4 text-[#2d6a4f]" />
          <h4 className="font-heading font-extrabold text-sm uppercase tracking-wider">
            4. Riding Details
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InteractiveSelect
            label="Riding Experience/s"
            value={ridingExperience}
            onChange={setRidingExperience}
            disabled={isReadOnly}
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
            disabled={isReadOnly}
            options={[
              { value: 'Regular', label: 'Regular' },
              { value: 'Motorcross', label: 'Motorcross' },
              { value: 'Enduro', label: 'Enduro' },
              { value: 'Extreme', label: 'Extreme' },
              { value: 'Others', label: 'Others' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Reason for Joining</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={reasonForJoining}
              onChange={(e) => setReasonForJoining(e.target.value)}
              placeholder="e.g. Fellowship, Group rides, Christian brotherhood"
              className={inputStyle}
            />
          </div>
          <div>
            <label className="font-bold text-[#1b4332] block mb-1">Recommended By</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={recommendedBy}
              onChange={(e) => setRecommendedBy(e.target.value)}
              placeholder="e.g. Member name or Pastor recommendation"
              className={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* SECTION 5: Applicant's Declaration */}
      <div className="space-y-4 p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
        <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2] text-[#1b4332]">
          <FileSignature className="w-4 h-4 text-[#2d6a4f]" />
          <h4 className="font-heading font-extrabold text-sm uppercase tracking-wider">
            5. Applicant's Declaration
          </h4>
        </div>

        {/* Declaration Paragraph */}
        <div className="p-4 rounded-xl bg-white border border-[#e2ece2] space-y-3 text-[#2d3a3a] leading-relaxed text-xs">
          <p>
            I hereby agree to abide by the rules, regulations, and code of conduct of the BCC Riders Club. I understand that motorcycle riding involves inherent risks, and I voluntarily assume full responsibility for my actions during all club activities and events.
          </p>
          <p>
            I further release and hold harmless the Buhangin Community Church Congregation, the BCC Riders Club, and its officers from any claims or liabilities arising from accidents, injuries, or incidents related to my participation.
          </p>
          <p>
            However, in the spirit of Christian brotherhood and humanitarian concern, members are encouraged, though not obligated, to extend help and support to one another as led by personal conviction and God's guidance.
          </p>
          <p className="font-bold text-[#1b4332]">
            By signing below, I acknowledge that I have read, understood, and accepted these terms.
          </p>
        </div>

        {/* Interactive Signature Canvas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-[#1b4332] block">
              Applicant's Signature *
            </label>
            {!isReadOnly && (
              <button
                type="button"
                onClick={clearSignature}
                className="py-1 px-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#52605d] font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear Signature</span>
              </button>
            )}
          </div>

          <div className="border-2 border-dashed border-[#2d6a4f] rounded-2xl bg-white overflow-hidden p-2 text-center relative">
            <p className="text-[10px] text-[#52605d] mb-1 select-none">
              {isReadOnly
                ? 'Digital Signature On File'
                : 'Sign using touch screen (mobile) or mouse cursor (desktop) inside the box below:'}
            </p>
            <canvas
              ref={canvasRef}
              width={500}
              height={140}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={`w-full max-w-full h-36 border border-[#e2ece2] rounded-xl bg-gray-50 touch-none ${
                isReadOnly ? 'cursor-not-allowed' : 'cursor-crosshair'
              }`}
            />
            {applicantSignature && isReadOnly && (
              <div className="mt-2 p-2 bg-[#d8f3dc] text-[#1b4332] rounded-lg text-[11px] font-bold">
                ✓ Signature verified and saved on file.
              </div>
            )}
          </div>
        </div>

        {/* Date Block */}
        <div className="pt-3 border-t border-[#e2ece2]">
          <div className="max-w-xs">
            <label className="font-bold text-[#1b4332] block mb-1">Date</label>
            <input
              type="text"
              readOnly
              disabled
              value={initialData?.declarationDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f4f1] border border-[#d0ded0] text-[#1b4332] font-bold"
            />
            <p className="text-[10px] text-[#52605d] mt-1">
              Date is automatically updated upon application submission.
            </p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      {!isReadOnly && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-gray-100 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="py-3 px-6 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-[#74c69d]" />
            <span>{isAdminCreation ? 'Add Member to Database' : 'Submit'}</span>
          </button>
        </div>
      )}
      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={cropperSrc}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
        title="Crop Member Profile Avatar"
      />
    </form>
  );
};
