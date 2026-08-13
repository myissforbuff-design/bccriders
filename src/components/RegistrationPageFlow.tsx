import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { uploadStorageFile } from '../lib/db';
import { PhilippineAddressSelector, PhilippineAddressValue } from './PhilippineAddressSelector';
import { OfficialLoader } from './OfficialLoader';
import { CustomSelect } from './CustomSelect';
import { useFormAutoSave } from '../hooks/useFormAutoSave';
import { BirthdateDropdownPicker } from './BirthdateDropdownPicker';
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
  CheckCircle2,
  FileSignature,
  Eraser,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Heart,
  ChevronRight,
  Sparkles,
  Award,
  RotateCcw,
  Save,
  X,
  Check,
  Crop,
} from 'lucide-react';
import { ImageCropperModal } from './ImageCropperModal';

interface RegistrationPageFlowProps {
  onSuccess: (newUser: User) => void;
  onCancel: () => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

const NETWORK_OPTIONS = [
  { value: 'Arios Knights', label: 'Arios Knights', group: "Men's Network" },
  { value: "Blacksmith's Hammers", label: "Blacksmith's Hammers", group: "Men's Network" },
  { value: 'Finishers', label: 'Finishers', group: "Men's Network" },
  { value: 'Footwashers Men', label: 'Footwashers Men', group: "Men's Network" },
  { value: 'Fruitful Aliens', label: 'Fruitful Aliens', group: "Men's Network" },
  { value: 'Fuego de Dios', label: 'Fuego de Dios', group: "Men's Network" },
  { value: 'Kingdom Builders', label: 'Kingdom Builders', group: "Men's Network" },
  { value: 'Navigators', label: 'Navigators', group: "Men's Network" },
  { value: 'Riverheads', label: 'Riverheads', group: "Men's Network" },
  { value: 'Speaking Hammers', label: 'Speaking Hammers', group: "Men's Network" },
  { value: 'Trailblazers', label: 'Trailblazers', group: "Men's Network" },
  { value: 'Water Walkers', label: 'Water Walkers', group: "Men's Network" },
  
  { value: 'Brilliant Stellars', label: 'Brilliant Stellars', group: "Women's Network" },
  { value: 'Changerellas', label: 'Changerellas', group: "Women's Network" },
  { value: 'Conquerors', label: 'Conquerors', group: "Women's Network" },
  { value: 'Crowned Eagurls', label: 'Crowned Eagurls', group: "Women's Network" },
  { value: 'Eagles', label: 'Eagles', group: "Women's Network" },
  { value: 'Footwashers Women', label: 'Footwashers Women', group: "Women's Network" },
  { value: 'Jewels', label: 'Jewels', group: "Women's Network" },
  { value: 'Thriving Bellas', label: 'Thriving Bellas', group: "Women's Network" },
  { value: 'Transformers', label: 'Transformers', group: "Women's Network" },
  { value: 'Unique ka Hijas', label: 'Unique ka Hijas', group: "Women's Network" },
  { value: 'Valiant Stewards', label: 'Valiant Stewards', group: "Women's Network" },
  { value: 'Warriors Princesses', label: 'Warriors Princesses', group: "Women's Network" },

  { value: 'Others', label: 'Others (Not yet part of a network)', group: 'Others' },
];

export const LTO_RESTRICTION_CODES_2026 = [
  { code: 'A', title: 'A', desc: 'Motorcycle (L1, L2, L3 - 2/3 Wheel MC)' },
  { code: 'A1', title: 'A1', desc: 'Tricycle / Light 3-Wheel (L4, L5)' },
  { code: 'B', title: 'B', desc: 'Passenger Car / Light Vehicle ≤ 5,000kg (M1)' },
  { code: 'B1', title: 'B1', desc: 'Passenger Van / Minibus / Jeepney ≤ 5,000kg (M2)' },
  { code: 'B2', title: 'B2', desc: 'Light Commercial Vehicle ≤ 3,500kg (N1)' },
  { code: 'C', title: 'C', desc: 'Heavy Commercial Vehicle > 3,500kg (N2, N3)' },
  { code: 'D', title: 'D', desc: 'Passenger Bus > 5,000kg (M3)' },
  { code: 'BE', title: 'BE', desc: 'Articulated Passenger Vehicle' },
  { code: 'CE', title: 'CE', desc: 'Heavy Articulated Commercial Vehicle' },
];

export const LTO_CONDITIONS_2026 = [
  { code: 'None', label: 'None / Standard (No condition)' },
  { code: '1', label: '1 - Wear corrective lenses / eyeglasses' },
  { code: '2', label: '2 - Drive with special equipment for upper/lower limbs' },
  { code: '3', label: '3 - Drive customized motor vehicle only' },
  { code: '4', label: '4 - Daylight driving only' },
  { code: '5', label: '5 - Accompanied by a person with normal hearing' },
];

export const RegistrationPageFlow: React.FC<RegistrationPageFlowProps> = ({
  onSuccess,
  onCancel,
  currentPage: externalPage,
  onPageChange,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(externalPage || 1);

  useEffect(() => {
    if (externalPage && externalPage !== currentPage) {
      setCurrentPage(externalPage);
    }
  }, [externalPage]);

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  // Loading & Submission state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMsg, setLoadingMsg] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // 1. Personal Information State
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>('');
  const [avatarFileName, setAvatarFileName] = useState<string>('');
  const [avatarMsg, setAvatarMsg] = useState<string>('');
  const [cropperOpen, setCropperOpen] = useState<boolean>(false);
  const [cropperSrc, setCropperSrc] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phAddress, setPhAddress] = useState<PhilippineAddressValue | null>(null);
  const [civilStatus, setCivilStatus] = useState<string>('Single');
  const [birthdate, setBirthdate] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('Male');
  const [mobileNo, setMobileNo] = useState<string>('');
  const [occupation, setOccupation] = useState<string>('');
  const [occupationStatus, setOccupationStatus] = useState<string>('Employed');
  const [lifeInsurance, setLifeInsurance] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // 2. BCC Information State
  const [network, setNetwork] = useState<string>('');
  const [chapter, setChapter] = useState<string>('');
  const [leadersName, setLeadersName] = useState<string>('');
  const [leadersContactNo, setLeadersContactNo] = useState<string>('');
  const [affiliations, setAffiliations] = useState<string[]>([]);
  const [customAffiliation, setCustomAffiliation] = useState<string>('');

  const affiliation = affiliations.includes('Others') && customAffiliation.trim()
    ? [...affiliations.filter((a) => a !== 'Others'), customAffiliation.trim()].join(', ')
    : affiliations.join(', ');

  // 3. Emergency Contact State
  const [emergencyFullName, setEmergencyFullName] = useState<string>('');
  const [emergencyRelationship, setEmergencyRelationship] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');

  // 4. Motorcycle & Driver's License Information State
  const [bikeMake, setBikeMake] = useState<string>('');
  const [bikeModel, setBikeModel] = useState<string>('');
  const [bikeEngineCc, setBikeEngineCc] = useState<string>('');
  const [bikeColor, setBikeColor] = useState<string>('');
  const [bikeEngineNo, setBikeEngineNo] = useState<string>('');
  const [bikeChassisNo, setBikeChassisNo] = useState<string>('');
  const [bikePlateNo, setBikePlateNo] = useState<string>('');
  const [bikeCondition, setBikeCondition] = useState<string>('Good');
  const [bikeYearsInService, setBikeYearsInService] = useState<string>('');
  const [bikeOrNo, setBikeOrNo] = useState<string>('');
  const [bikeOrExpiryDate, setBikeOrExpiryDate] = useState<string>('');
  const [bikeCrNo, setBikeCrNo] = useState<string>('');
  const [bikePhotoUrl, setBikePhotoUrl] = useState<string>('');
  const [bikePhotoFileName, setBikePhotoFileName] = useState<string>('');

  // Motorcycle photo change handler with client compression
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

  // Driver's License Details (moved to Motorcycle Information section)
  const [licenseNo, setLicenseNo] = useState<string>('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<string>('');
  const [restrictionCodes, setRestrictionCodes] = useState<string[]>(['A']);
  const [ltoConditions, setLtoConditions] = useState<string[]>(['None']);

  // Riding Details
  const [ridingExperience, setRidingExperience] = useState<string>('');
  const [riderType, setRiderType] = useState<string>('');
  const [reasonForJoining, setReasonForJoining] = useState<string>('');
  const [recommendedBy, setRecommendedBy] = useState<string>('');

  // 5. Applicant's Declaration State
  const [agreedDeclaration, setAgreedDeclaration] = useState<boolean>(false);
  const [applicantSignature, setApplicantSignature] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // --- Auto-Save Draft Hook Integration ---
  const currentRegistrationFormData = {
    firstName,
    lastName,
    phAddress,
    civilStatus,
    birthdate,
    age,
    gender,
    mobileNo,
    occupation,
    occupationStatus,
    lifeInsurance,
    username,
    email,
    password, // Password will be automatically excluded by hook
    network,
    chapter,
    leadersName,
    leadersContactNo,
    affiliations,
    customAffiliation,
    affiliation,
    emergencyFullName,
    emergencyRelationship,
    emergencyPhone,
    bikeMake,
    bikeModel,
    bikeEngineCc,
    bikeColor,
    bikeEngineNo,
    bikeChassisNo,
    bikePlateNo,
    bikeCondition,
    bikeYearsInService,
    bikeOrNo,
    bikeOrExpiryDate,
    bikeCrNo,
    bikePhotoUrl,
    licenseNo,
    licenseExpiryDate,
    restrictionCodes,
    ltoConditions,
    ridingExperience,
    riderType,
    reasonForJoining,
    recommendedBy,
    agreedDeclaration,
  };

  const {
    restoredData,
    hasRestoredDraft,
    lastSavedAt,
    clearDraft,
    dismissDraftNotification,
  } = useFormAutoSave({
    key: 'bcc_registration_form_draft',
    formData: currentRegistrationFormData,
    excludeKeys: ['password', 'applicantSignature', 'avatarDataUrl', 'bikePhotoUrl'],
  });

  useModalDismiss(showConfirmModal, () => setShowConfirmModal(false));
  useModalDismiss(hasRestoredDraft, dismissDraftNotification);

  // Populate state when draft is restored from localStorage
  const handleRestoreDraft = () => {
    if (restoredData) {
      if (restoredData.firstName !== undefined) setFirstName(restoredData.firstName);
      if (restoredData.lastName !== undefined) setLastName(restoredData.lastName);
      if (restoredData.phAddress !== undefined) setPhAddress(restoredData.phAddress);
      if (restoredData.civilStatus !== undefined) setCivilStatus(restoredData.civilStatus);
      if (restoredData.birthdate !== undefined) setBirthdate(restoredData.birthdate);
      if (restoredData.age !== undefined) setAge(restoredData.age);
      if (restoredData.gender !== undefined) setGender(restoredData.gender);
      if (restoredData.mobileNo !== undefined) setMobileNo(restoredData.mobileNo);
      if (restoredData.occupation !== undefined) setOccupation(restoredData.occupation);
      if (restoredData.occupationStatus !== undefined) setOccupationStatus(restoredData.occupationStatus);
      if (restoredData.lifeInsurance !== undefined) setLifeInsurance(restoredData.lifeInsurance);
      if (restoredData.username !== undefined) setUsername(restoredData.username);
      if (restoredData.email !== undefined) setEmail(restoredData.email);
      if (restoredData.network !== undefined) setNetwork(restoredData.network);
      if (restoredData.chapter !== undefined) setChapter(restoredData.chapter);
      if (restoredData.leadersName !== undefined) setLeadersName(restoredData.leadersName);
      if (restoredData.leadersContactNo !== undefined) setLeadersContactNo(restoredData.leadersContactNo);
      if (restoredData.affiliations && Array.isArray(restoredData.affiliations)) {
        setAffiliations(restoredData.affiliations);
      } else if (restoredData.affiliation) {
        setAffiliations(String(restoredData.affiliation).split(',').map((s: string) => s.trim()).filter(Boolean));
      }
      if (restoredData.customAffiliation !== undefined) setCustomAffiliation(restoredData.customAffiliation);
      if (restoredData.emergencyFullName !== undefined) setEmergencyFullName(restoredData.emergencyFullName);
      if (restoredData.emergencyRelationship !== undefined) setEmergencyRelationship(restoredData.emergencyRelationship);
      if (restoredData.emergencyPhone !== undefined) setEmergencyPhone(restoredData.emergencyPhone);
      if (restoredData.bikeMake !== undefined) setBikeMake(restoredData.bikeMake);
      if (restoredData.bikeModel !== undefined) setBikeModel(restoredData.bikeModel);
      if (restoredData.bikeEngineCc !== undefined) setBikeEngineCc(restoredData.bikeEngineCc);
      else if ((restoredData as Record<string, any>).engineCc !== undefined) setBikeEngineCc((restoredData as Record<string, any>).engineCc);
      if (restoredData.bikeColor !== undefined) setBikeColor(restoredData.bikeColor);
      if (restoredData.bikeEngineNo !== undefined) setBikeEngineNo(restoredData.bikeEngineNo);
      if (restoredData.bikeChassisNo !== undefined) setBikeChassisNo(restoredData.bikeChassisNo);
      if (restoredData.bikePlateNo !== undefined) setBikePlateNo(restoredData.bikePlateNo);
      if (restoredData.bikeCondition !== undefined) setBikeCondition(restoredData.bikeCondition);
      if (restoredData.bikeYearsInService !== undefined) setBikeYearsInService(restoredData.bikeYearsInService);
      if (restoredData.bikeOrNo !== undefined) setBikeOrNo(restoredData.bikeOrNo);
      if (restoredData.bikeOrExpiryDate !== undefined) setBikeOrExpiryDate(restoredData.bikeOrExpiryDate);
      if (restoredData.bikeCrNo !== undefined) setBikeCrNo(restoredData.bikeCrNo);
      if (restoredData.bikePhotoUrl !== undefined) setBikePhotoUrl(restoredData.bikePhotoUrl);
      if (restoredData.licenseNo !== undefined) setLicenseNo(restoredData.licenseNo);
      if (restoredData.licenseExpiryDate !== undefined) setLicenseExpiryDate(restoredData.licenseExpiryDate);
      if (restoredData.restrictionCodes !== undefined) setRestrictionCodes(restoredData.restrictionCodes);
      if (restoredData.ltoConditions !== undefined) setLtoConditions(restoredData.ltoConditions);
      if (restoredData.ridingExperience !== undefined) setRidingExperience(restoredData.ridingExperience);
      if (restoredData.riderType !== undefined) setRiderType(restoredData.riderType);
      if (restoredData.reasonForJoining !== undefined) setReasonForJoining(restoredData.reasonForJoining);
      if (restoredData.recommendedBy !== undefined) setRecommendedBy(restoredData.recommendedBy);
      if (restoredData.agreedDeclaration !== undefined) setAgreedDeclaration(restoredData.agreedDeclaration);
    }
    dismissDraftNotification();
  };

  // Auto-calculate Age when birthdate changes
  useEffect(() => {
    if (birthdate) {
      const birthDate = new Date(birthdate);
      const today = new Date();
      if (!isNaN(birthDate.getTime())) {
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        if (calculatedAge >= 0 && calculatedAge <= 120) {
          setAge(String(calculatedAge));
        }
      }
    }
  }, [birthdate]);

  // Avatar Image Upload with interactive cropping modal
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCropperSrc(event.target.result as string);
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    const compressed = await uploadStorageFile(croppedDataUrl);
    const finalUrl = compressed || croppedDataUrl;
    setAvatarDataUrl(finalUrl);
    const approxKb = Math.round((finalUrl.length * 0.75) / 1024);
    setAvatarMsg(`Avatar cropped and saved successfully (${approxKb} KB).`);
  };

  // Signature Canvas Drawing Handlers
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const coords = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(coords.x, coords.y);
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
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setApplicantSignature('');
  };

  // Validation Checkers per page
  const isPage1Valid = Boolean(
    firstName.trim() &&
    lastName.trim() &&
    username.trim() &&
    email.trim() &&
    password.trim() &&
    phAddress &&
    phAddress.fullAddressString &&
    phAddress.fullAddressString.trim().length > 0 &&
    mobileNo.trim().length === 11
  );

  const isPage2Valid = Boolean(
    network.trim() &&
    chapter.trim() &&
    (affiliations.length > 0 || customAffiliation.trim()) &&
    (!leadersContactNo.trim() || leadersContactNo.trim().length === 11)
  );

  const isPage3Valid = Boolean(
    emergencyFullName.trim() &&
    emergencyRelationship.trim() &&
    emergencyPhone.trim().length === 11
  );

  const isPage4Valid = Boolean(
    bikeMake.trim() &&
    bikeModel.trim() &&
    bikePhotoUrl.trim() &&
    ridingExperience.trim() &&
    riderType.trim() &&
    reasonForJoining.trim() &&
    recommendedBy.trim()
  );

  const isPage5Valid = Boolean(agreedDeclaration && applicantSignature.trim());

  // Final Form Submit Execution with Official Loader
  const handleFinalSubmit = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    setLoadingMsg('Saving member registration details to database...');

    try {
      // Simulate MongoDB network request delay for smooth loader experience
      await new Promise((resolve) => setTimeout(resolve, 1800));

      const memberId = 'usr_' + Date.now();
      const memberNumber = 'BRC-' + Math.floor(1000 + Math.random() * 9000);

      const newUser: User = {
        id: memberId,
        memberNumber,
        username: username.trim() || email.trim().split('@')[0],
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password: password.trim(),
        role: 'Member',
        approvalStatus: 'Pending',
        membershipType: 'Standard',
        avatar: avatarDataUrl || '/avatar.svg',
        bio: 'BCC Riders Club Member',
        phone: mobileNo || emergencyPhone || '',
        mobileNo: mobileNo || '',
        address: phAddress?.fullAddressString || 'Davao City, Philippines',
        streetAddress: phAddress?.streetAddress || '',
        civilStatus,
        birthdate,
        age: age ? parseInt(age, 10) : undefined,
        gender,
        occupation,
        occupationStatus,
        lifeInsurance,
        licenseNo,
        licenseExpiryDate,
        network,
        chapter,
        leadersName,
        leadersContactNo,
        affiliation,
        emergencyContact: {
          name: emergencyFullName.trim(),
          relationship: emergencyRelationship.trim(),
          phone: emergencyPhone.trim(),
        },
        bikeInfo: {
          make: bikeMake.trim() || 'N/A',
          model: bikeModel.trim() || 'N/A',
          engineCc: bikeEngineCc.trim() || '',
          color: bikeColor.trim() || '',
          engineNo: bikeEngineNo.trim() || '',
          chassisNo: bikeChassisNo.trim() || '',
          plateNo: bikePlateNo.trim() || '',
          licensePlate: bikePlateNo.trim() || '',
          condition: bikeCondition || 'Good',
          yearsInService: bikeYearsInService.trim() || '',
          orNo: bikeOrNo.trim() || '',
          orExpiryDate: bikeOrExpiryDate || '',
          crNo: bikeCrNo.trim() || '',
          photoUrl: bikePhotoUrl,
          restrictionCodes: restrictionCodes,
          licenseRestrictionCode: restrictionCodes.join(', '),
          ltoConditions: ltoConditions,
          conditionCode: ltoConditions.join(', '),
          year: new Date().getFullYear(),
        },
        ridingExperience,
        riderType,
        reasonForJoining,
        recommendedBy,
        applicantSignature,
        declarationDate: new Date().toISOString().split('T')[0],
        joinDate: new Date().toISOString().split('T')[0],
        totalMiles: 0,
        totalRides: 0,
        streakDays: 0,
        unlockedBadgeIds: [],
      };

      // Clear draft key from localStorage on successful registration submit
      clearDraft();

      onSuccess(newUser);
      setIsSuccess(true);
    } catch (err) {
      console.error('Registration failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="min-h-screen bg-white text-[#2d3a3a] font-sans p-3 sm:p-6 lg:p-10 flex flex-col justify-between"
    >
      {/* Official Loader for DB request */}
      <OfficialLoader isLoading={isLoading} message={loadingMsg} />

      <div className="max-w-4xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* Registration Top Bar */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#e2ece2] gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] p-1.5 sm:p-2 flex items-center justify-center shadow-xs shrink-0">
              <img src="/logo.png" alt="BCC Riders Club Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-heading font-black text-sm sm:text-2xl text-[#1b4332] tracking-tight">
                BCC RIDERS CLUB
              </h1>
              <p className="text-[9px] sm:text-xs font-bold text-[#2d6a4f] uppercase tracking-wider">
                Application Form
              </p>
            </div>
          </div>

          {!isSuccess && (
            <button
              onClick={onCancel}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white border border-[#e2ece2] hover:bg-gray-100 text-[#52605d] text-[10px] sm:text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Cancel Application
            </button>
          )}
        </div>

        {/* Restored Draft Modal */}
        <AnimatePresence>
          {hasRestoredDraft && (
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
                      We found previously saved registration details on this device. Would you like to restore your form entries or start fresh?
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

        {/* 5-Step Stepper Progress Bar */}
        {!isSuccess && (
          <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-md space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-extrabold text-[#1b4332] uppercase tracking-wider">
                Step {currentPage} of 5: {
                  currentPage === 1 ? 'Personal Information' :
                  currentPage === 2 ? 'BCC Information' :
                  currentPage === 3 ? 'Emergency Contact' :
                  currentPage === 4 ? 'Motorcycle Information' :
                  'Applicant\'s Declaration'
                }
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-[#2d6a4f]">
                {currentPage * 20}% Completed
              </span>
            </div>

            {/* Step Pills Bar */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {[1, 2, 3, 4, 5].map((step) => {
                const isActive = currentPage === step;
                const isPassed = currentPage > step;

                return (
                  <div
                    key={step}
                    className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${
                      isPassed
                        ? 'bg-[#1b4332]'
                        : isActive
                        ? 'bg-[#2d6a4f] ring-2 ring-[#74c69d]/50 animate-pulse'
                        : 'bg-gray-200'
                    }`}
                  />
                );
              })}
            </div>

            {/* Stepper Labels (Desktop) */}
            <div className="hidden sm:grid grid-cols-5 text-[11px] font-bold text-center pt-1 text-[#52605d]">
              <span className={currentPage === 1 ? 'text-[#1b4332] font-black' : ''}>1. Personal</span>
              <span className={currentPage === 2 ? 'text-[#1b4332] font-black' : ''}>2. BCC Info</span>
              <span className={currentPage === 3 ? 'text-[#1b4332] font-black' : ''}>3. Emergency</span>
              <span className={currentPage === 4 ? 'text-[#1b4332] font-black' : ''}>4. Bike Info</span>
              <span className={currentPage === 5 ? 'text-[#1b4332] font-black' : ''}>5. Declaration</span>
            </div>
          </div>
        )}

        {/* Success View */}
        {isSuccess ? (
          <div className="p-6 sm:p-12 rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-xl text-center space-y-4 sm:space-y-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-[#2d6a4f]" />
            </div>
            <h2 className="font-heading font-black text-lg sm:text-2xl text-[#1b4332]">
              Application Submitted Successfully!
            </h2>
            <p className="text-xs sm:text-sm text-[#52605d] leading-relaxed max-w-lg mx-auto">
              Welcome, <strong>{firstName} {lastName}</strong>! Your registration details and avatar have been saved to the database. An administrator will review your application shortly.
            </p>
            <button
              onClick={onCancel}
              className="px-6 py-3 sm:px-8 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-[11px] sm:text-xs shadow-md transition-all cursor-pointer"
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          /* Dynamic Registration Form Pages */
          <div className="p-3.5 sm:p-10 rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-xl space-y-4 sm:space-y-6">
            <AnimatePresence mode="wait">
              {/* PAGE 1: PERSONAL INFORMATION */}
              {currentPage === 1 && (
                <motion.div
                  key="page1"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="border-b border-[#e2ece2] pb-2.5 sm:pb-3">
                    <h2 className="font-heading font-black text-xs sm:text-lg text-[#1b4332] uppercase tracking-wide">
                      Personal Information
                    </h2>
                    <p className="text-[10px] sm:text-xs text-[#52605d]">
                      Please fill out your personal details. Required fields are marked with an asterisk (*).
                    </p>
                  </div>

                  {/* Avatar Upload */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2.5 sm:space-y-3">
                    <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                      Upload Avatar <span className="text-gray-400 font-normal text-[9px] sm:text-xs">(Optional - Default avatar will be used if left blank)</span>
                    </label>

                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                        <img
                          src={avatarDataUrl || '/avatar.svg'}
                          alt="Avatar Preview"
                          className="w-full h-full object-cover p-1"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                          }}
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="block w-full text-[10px] sm:text-xs text-[#52605d] file:mr-2 sm:file:mr-4 file:py-1.5 file:px-3 sm:file:py-2 sm:file:px-4 file:rounded-xl file:border-0 file:text-[10px] sm:file:text-xs file:font-bold file:bg-[#1b4332] file:text-white hover:file:bg-[#2d6a4f] cursor-pointer truncate"
                        />
                        {avatarDataUrl && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCropperSrc(avatarDataUrl);
                                setCropperOpen(true);
                              }}
                              className="py-1 px-2.5 rounded-lg border border-[#2d6a4f]/30 bg-white text-[#2d6a4f] font-bold text-[10px] sm:text-xs hover:bg-[#2d6a4f]/10 transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Crop className="w-3 h-3 text-[#2d6a4f]" />
                              <span>Crop / Adjust Photo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAvatarDataUrl('');
                                setAvatarFileName('');
                                setAvatarMsg('');
                              }}
                              className="py-1 px-2.5 rounded-lg border border-rose-200 text-rose-600 font-bold text-[10px] sm:text-xs hover:bg-rose-50 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        {avatarMsg && (
                          <p className="text-[10px] sm:text-[11px] font-semibold text-[#2d6a4f]">
                            {avatarMsg}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Juan"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Dela Cruz"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                  </div>

                  {/* Philippine Address Cascading Selector */}
                  <PhilippineAddressSelector
                    value={phAddress || undefined}
                    onChange={(val) => setPhAddress(val)}
                  />

                  {/* Personal Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <CustomSelect
                      label="Civil Status"
                      value={civilStatus}
                      onChange={(val) => setCivilStatus(val)}
                      options={['Single', 'Married', 'Widowed', 'Separated']}
                    />

                    <div className="sm:col-span-2">
                      <BirthdateDropdownPicker
                        label="Birthdate"
                        value={birthdate}
                        onChange={(val) => setBirthdate(val)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Age</label>
                        {birthdate && (
                          <span className="text-[9px] font-bold text-[#2d6a4f] bg-[#e8f5e9] px-1.5 py-0.5 rounded-md">
                            Auto-calculated
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Age"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    <CustomSelect
                      label="Gender"
                      value={gender}
                      onChange={(val) => setGender(val)}
                      options={['Male', 'Female']}
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Mobile No. <span className="text-rose-500">*</span> <span className="text-gray-500 font-normal text-[9px]">(11 digits required)</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        value={mobileNo}
                        onChange={(e) => setMobileNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="09171234567"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                      {mobileNo && mobileNo.length !== 11 && (
                        <p className="text-[10px] text-amber-700 font-semibold">
                          Must be exactly 11 digits ({mobileNo.length}/11)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Occupation / Business</label>
                      <input
                        type="text"
                        value={occupation}
                        onChange={(e) => setOccupation(e.target.value)}
                        placeholder="e.g. Software Engineer"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    <CustomSelect
                      label="Occupation Status"
                      value={occupationStatus}
                      onChange={(val) => setOccupationStatus(val)}
                      options={[
                        'Employed',
                        'Self-Employed',
                        'Business Owner',
                        'Unemployed',
                        'Retired',
                        'Student',
                      ]}
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Life Insurance (If any)</label>
                      <input
                        type="text"
                        value={lifeInsurance}
                        onChange={(e) => setLifeInsurance(e.target.value)}
                        placeholder="e.g. Sun Life / Philam Life"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                      Active Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rider@example.com"
                      className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>

                  {/* Portal Account Credentials */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3 sm:space-y-4">
                    <h3 className="text-[10px] sm:text-xs font-extrabold text-[#1b4332] uppercase tracking-wider">
                      Portal Account Login Credentials
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                          Username (Portal Account) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="e.g. rider_username"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                          Portal Account Password <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PAGE 2: BCC INFORMATION */}
              {currentPage === 2 && (
                <motion.div
                  key="page2"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="border-b border-[#e2ece2] pb-2.5 sm:pb-3">
                    <h2 className="font-heading font-black text-xs sm:text-lg text-[#1b4332] uppercase tracking-wide">
                      BCC Information
                    </h2>
                    <p className="text-[10px] sm:text-xs text-[#52605d]">
                      Select your church network, local chapter, and affiliation details. Required fields are marked with (*).
                    </p>
                  </div>

                  {/* Network Dropdown Grouped into Men's and Women's */}
                  <CustomSelect
                    label="Network"
                    required
                    value={network}
                    onChange={(val) => setNetwork(val)}
                    options={NETWORK_OPTIONS}
                    placeholder="Select Network..."
                    searchable
                  />

                  <div className="space-y-1">
                    <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                      Chapter <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={chapter}
                      onChange={(e) => setChapter(e.target.value)}
                      placeholder="e.g. Buhangin Main Chapter"
                      className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Leader's Name</label>
                      <input
                        type="text"
                        value={leadersName}
                        onChange={(e) => setLeadersName(e.target.value)}
                        placeholder="e.g. Pastor / Leader John Doe"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Leader's Contact No. <span className="text-gray-500 font-normal text-[9px]">(11 digits required)</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        value={leadersContactNo}
                        onChange={(e) => setLeadersContactNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="09189876543"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                      {leadersContactNo && leadersContactNo.length !== 11 && (
                        <p className="text-[10px] text-amber-700 font-semibold">
                          Must be exactly 11 digits ({leadersContactNo.length}/11)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Multi-Select Affiliation */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Affiliation <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[9px] sm:text-[10px] text-[#2d6a4f] font-semibold bg-[#e8f5e9] px-2 py-0.5 rounded-full">
                        Allow Multiple Selection
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-[#52605d]">
                      Select one or more church affiliations or ministries you belong to:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
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
                            onClick={() => {
                              if (isSelected) {
                                setAffiliations(affiliations.filter((a) => a !== option));
                              } else {
                                setAffiliations([...affiliations, option]);
                              }
                            }}
                            className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                                : 'bg-white text-[#1b4332] border-[#e2ece2] hover:border-[#2d6a4f]'
                            }`}
                          >
                            <span className="text-[11px] sm:text-xs font-bold">{option}</span>
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
                      <div className="pt-2 space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                          Please specify other affiliation:
                        </label>
                        <input
                          type="text"
                          value={customAffiliation}
                          onChange={(e) => setCustomAffiliation(e.target.value)}
                          placeholder="e.g. Worship Ministry, Ushering, Youth Fellowship"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* PAGE 3: EMERGENCY CONTACT */}
              {currentPage === 3 && (
                <motion.div
                  key="page3"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="border-b border-[#e2ece2] pb-2.5 sm:pb-3">
                    <h2 className="font-heading font-black text-xs sm:text-lg text-[#1b4332] uppercase tracking-wide">
                      Emergency Contact
                    </h2>
                    <p className="text-[10px] sm:text-xs text-[#52605d]">
                      Provide a primary emergency contact person for ride safety and dispatch. All fields marked with (*) are required.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                      Contact Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={emergencyFullName}
                      onChange={(e) => setEmergencyFullName(e.target.value)}
                      placeholder="e.g. Maria Dela Cruz"
                      className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <CustomSelect
                      label="Relationship"
                      required
                      value={emergencyRelationship}
                      onChange={(val) => setEmergencyRelationship(val)}
                      options={[
                        'Spouse',
                        'Mother',
                        'Father',
                        'Guardian',
                        'Others',
                      ]}
                      placeholder="Select Relationship..."
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Contact Phone <span className="text-rose-500">*</span> <span className="text-gray-500 font-normal text-[9px]">(11 digits required)</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="09179998888"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                      {emergencyPhone && emergencyPhone.length !== 11 && (
                        <p className="text-[10px] text-amber-700 font-semibold">
                          Must be exactly 11 digits ({emergencyPhone.length}/11)
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PAGE 4: MOTORCYCLE INFORMATION */}
              {currentPage === 4 && (
                <motion.div
                  key="page4"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="border-b border-[#e2ece2] pb-2.5 sm:pb-3">
                    <h2 className="font-heading font-black text-xs sm:text-lg text-[#1b4332] uppercase tracking-wide">
                      Motorcycle & Driver's License Information
                    </h2>
                    <p className="text-[10px] sm:text-xs text-[#52605d]">
                      Provide your motorcycle details, registration info, Driver's License details, and LTO 2026 Restriction Codes.
                    </p>
                  </div>

                  {/* Section 1: Motorcycle Specifications */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2]">
                      <Bike className="w-4 h-4 text-[#2d6a4f]" />
                      <span className="text-[10px] sm:text-xs font-extrabold text-[#1b4332] uppercase tracking-wider">
                        1. Motorcycle Specifications
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Make</label>
                        <input
                          type="text"
                          value={bikeMake}
                          onChange={(e) => setBikeMake(e.target.value)}
                          placeholder="e.g. Yamaha, Honda, BMW"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Model</label>
                        <input
                          type="text"
                          value={bikeModel}
                          onChange={(e) => setBikeModel(e.target.value)}
                          placeholder="e.g. NMAX 155, MT-09"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                          Engine Displacement (CC) <span className="text-gray-500 font-normal text-[9px]">(Numbers only)</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={bikeEngineCc}
                          onChange={(e) => setBikeEngineCc(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 155, 300, 890"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Color</label>
                        <input
                          type="text"
                          value={bikeColor}
                          onChange={(e) => setBikeColor(e.target.value)}
                          placeholder="e.g. Matte Black / Red"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Engine No.</label>
                        <input
                          type="text"
                          value={bikeEngineNo}
                          onChange={(e) => setBikeEngineNo(e.target.value)}
                          placeholder="e.g. ENG-99214A"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Chassis No.</label>
                        <input
                          type="text"
                          value={bikeChassisNo}
                          onChange={(e) => setBikeChassisNo(e.target.value)}
                          placeholder="e.g. CHS-88123B"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Plate No.</label>
                        <input
                          type="text"
                          value={bikePlateNo}
                          onChange={(e) => setBikePlateNo(e.target.value)}
                          placeholder="e.g. 123-ABC"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <CustomSelect
                        label="Status / Condition"
                        value={bikeCondition}
                        onChange={(val) => setBikeCondition(val)}
                        options={['Excellent', 'Good', 'Fair', 'Custom / Modified', 'Under Maintenance']}
                      />

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                          Vehicle's Years of Service <span className="text-gray-500 font-normal text-[9px]">(Numbers only)</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={3}
                          value={bikeYearsInService}
                          onChange={(e) => setBikeYearsInService(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="e.g. 2"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>
                    </div>

                    {/* Motorcycle Photo Upload Field (Required) */}
                    <div className="pt-3 border-t border-[#e2ece2] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] flex items-center gap-1.5">
                          <span>Motorcycle Photo</span>
                          <span className="text-rose-600 font-extrabold">* Required</span>
                        </label>
                      </div>

                      {bikePhotoUrl ? (
                        <div className="relative rounded-2xl overflow-hidden border border-[#e2ece2] bg-stone-900 group max-w-sm">
                          <img
                            src={bikePhotoUrl}
                            alt="Motorcycle"
                            className="w-full h-44 sm:h-52 object-cover transition-transform duration-300 group-hover:scale-105"
                          />
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
                          <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-lg flex items-center justify-between">
                            <span className="truncate font-mono">{bikePhotoFileName || 'Motorcycle Image'}</span>
                            <span className="text-emerald-400 font-bold shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Uploaded
                            </span>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[#2d6a4f]/40 hover:border-[#2d6a4f] bg-white rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[#d8f3dc]/20 text-center space-y-2 group">
                          <div className="w-11 h-11 rounded-2xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#1b4332]">
                              Upload Motorcycle Photo <span className="text-rose-600">*</span>
                            </p>
                            <p className="text-[10px] text-[#52605d] mt-0.5">
                              Click or drag image file (PNG, JPG, WebP). Auto-optimized for instant database sync.
                            </p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleBikePhotoChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Section 2: Registration Documents */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2]">
                      <Shield className="w-4 h-4 text-[#2d6a4f]" />
                      <span className="text-[10px] sm:text-xs font-extrabold text-[#1b4332] uppercase tracking-wider">
                        2. Official Registration Documents (OR/CR)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">OR No. (Official Receipt)</label>
                        <input
                          type="text"
                          value={bikeOrNo}
                          onChange={(e) => setBikeOrNo(e.target.value)}
                          placeholder="OR-991823"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">OR Expiration Date</label>
                        <input
                          type="date"
                          value={bikeOrExpiryDate}
                          onChange={(e) => setBikeOrExpiryDate(e.target.value)}
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">CR No. (Certificate of Registration)</label>
                        <input
                          type="text"
                          value={bikeCrNo}
                          onChange={(e) => setBikeCrNo(e.target.value)}
                          placeholder="CR-001293"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Driver's License & LTO 2026 Codes */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2]">
                      <Award className="w-4 h-4 text-[#2d6a4f]" />
                      <span className="text-[10px] sm:text-xs font-extrabold text-[#1b4332] uppercase tracking-wider">
                        3. Driver's License & LTO 2026 Details
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">Driver's License No.</label>
                        <input
                          type="text"
                          value={licenseNo}
                          onChange={(e) => setLicenseNo(e.target.value)}
                          placeholder="N01-12-345678"
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">License Expiration Date</label>
                        <input
                          type="date"
                          value={licenseExpiryDate}
                          onChange={(e) => setLicenseExpiryDate(e.target.value)}
                          className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                        />
                      </div>
                    </div>

                    {/* Multi-Select License Restriction Codes (Philippines LTO 2026) */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                          License Restriction Code (LTO 2026 DL Codes)
                        </label>
                        <span className="text-[9px] sm:text-[10px] text-[#2d6a4f] font-semibold bg-[#e8f5e9] px-2 py-0.5 rounded-full">
                          Allow Multiple Selection
                        </span>
                      </div>
                      <p className="text-[10px] text-[#52605d]">
                        Click to select/unselect your authorized vehicle restriction codes:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {LTO_RESTRICTION_CODES_2026.map((item) => {
                          const isSelected = restrictionCodes.includes(item.code);
                          return (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setRestrictionCodes(restrictionCodes.filter((c) => c !== item.code));
                                } else {
                                  setRestrictionCodes([...restrictionCodes, item.code]);
                                }
                              }}
                              className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-2 ${
                                isSelected
                                  ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                                  : 'bg-white text-[#1b4332] border-[#e2ece2] hover:border-[#2d6a4f]'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black ${
                                  isSelected ? 'bg-[#74c69d] text-[#1b4332]' : 'bg-[#f7f9f7] border border-[#e2ece2] text-[#52605d]'
                                }`}
                              >
                                {item.code}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold leading-tight">{item.title}</div>
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
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                          Conditions (Philippines LTO 2026)
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {LTO_CONDITIONS_2026.map((cond) => {
                          const isSelected = ltoConditions.includes(cond.code);
                          return (
                            <button
                              key={cond.code}
                              type="button"
                              onClick={() => {
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
                              className={`p-2.5 rounded-xl text-left text-[10px] sm:text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
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

                  {/* Section 4: Riding Details */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#e2ece2]">
                      <Bike className="w-4 h-4 text-[#2d6a4f]" />
                      <span className="text-[10px] sm:text-xs font-extrabold text-[#1b4332] uppercase tracking-wider">
                        4. Riding History & Club Recommendation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <CustomSelect
                        label="Riding Experience/s"
                        required
                        value={ridingExperience}
                        onChange={(val) => setRidingExperience(val)}
                        options={[
                          'Less than 1 Year',
                          '1 - 3 Years',
                          '3 - 5 Years',
                          '5+ Years (Experienced)',
                          'Veteran / Long Distance',
                        ]}
                        placeholder="Select Experience..."
                      />

                      <CustomSelect
                        label="Type of Rider"
                        required
                        value={riderType}
                        onChange={(val) => setRiderType(val)}
                        options={[
                          'Regular',
                          'Motorcross',
                          'Enduro',
                          'Extreme',
                          'Others',
                        ]}
                        placeholder="Select Type..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Reason for Joining <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={reasonForJoining}
                        onChange={(e) => setReasonForJoining(e.target.value)}
                        placeholder="Explain your reason for joining BCC Riders Club..."
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Recommended By <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={recommendedBy}
                        onChange={(e) => setRecommendedBy(e.target.value)}
                        placeholder="e.g. Bro. Gaudencio / Pastor John"
                        className="w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] text-[10px] sm:text-xs font-medium focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PAGE 5: APPLICANT'S DECLARATION & SIGNATURE */}
              {currentPage === 5 && (
                <motion.div
                  key="page5"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="border-b border-[#e2ece2] pb-2.5 sm:pb-3">
                    <h2 className="font-heading font-black text-xs sm:text-lg text-[#1b4332] uppercase tracking-wide">
                      Applicant's Declaration
                    </h2>
                    <p className="text-[10px] sm:text-xs text-[#52605d]">
                      Read the membership agreement declaration and sign using your mouse or touchscreen.
                    </p>
                  </div>

                  {/* Agreement Terms Box */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] text-[10px] sm:text-xs text-[#2d3a3a] space-y-2 leading-relaxed">
                    <p>
                      I hereby certify that all information supplied in this application form is true and accurate to the best of my knowledge. I understand that any false statements may lead to disqualification or cancellation of club membership.
                    </p>
                    <p>
                      I agree to comply with all safety regulations, defensive riding rules, and Christian standards set forth by the BCC Riders Club.
                    </p>
                  </div>

                  {/* Required Agreement Checkbox */}
                  <label className="flex items-start gap-2.5 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-[#e2ece2] bg-white hover:border-[#2d6a4f] transition-all cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedDeclaration}
                      onChange={(e) => setAgreedDeclaration(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-[#1b4332] focus:ring-[#2d6a4f] cursor-pointer shrink-0"
                    />
                    <span className="text-[10px] sm:text-xs text-[#1b4332] font-semibold leading-relaxed">
                      I agree and I have read the club's membership agreement. <span className="text-rose-500">*</span>
                    </span>
                  </label>

                  {/* Signature Canvas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
                        Applicant's Signature Pad <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-[10px] sm:text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Eraser className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Clear Signature</span>
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-[#2d6a4f]/30 rounded-2xl p-1 bg-white">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={160}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-32 sm:h-40 bg-white rounded-xl cursor-crosshair touch-none"
                      />
                    </div>
                    {applicantSignature ? (
                      <p className="text-[10px] sm:text-[11px] font-bold text-[#2d6a4f] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Signature captured successfully.
                      </p>
                    ) : (
                      <p className="text-[10px] sm:text-[11px] text-gray-400">
                        Sign inside the boxed canvas above using your finger or pointer.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Page Controls Bar */}
            <div className="flex items-center justify-between pt-4 sm:pt-6 border-t border-[#e2ece2] gap-2">
              {/* Previous Button */}
              {currentPage > 1 ? (
                <button
                  type="button"
                  onClick={() => changePage(currentPage - 1)}
                  className="px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white border border-[#e2ece2] hover:bg-gray-100 text-[#1b4332] text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Previous Page</span>
                </button>
              ) : (
                <div />
              )}

              {/* Next or Submit Button */}
              {currentPage < 5 ? (
                <button
                  type="button"
                  disabled={
                    (currentPage === 1 && !isPage1Valid) ||
                    (currentPage === 2 && !isPage2Valid) ||
                    (currentPage === 3 && !isPage3Valid) ||
                    (currentPage === 4 && !isPage4Valid)
                  }
                  onClick={() => changePage(currentPage + 1)}
                  className={`px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 sm:gap-2 ${
                    (currentPage === 1 && !isPage1Valid) ||
                    (currentPage === 2 && !isPage2Valid) ||
                    (currentPage === 3 && !isPage3Valid) ||
                    (currentPage === 4 && !isPage4Valid)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-[#1b4332] hover:bg-[#2d6a4f] text-white cursor-pointer hover:scale-[1.01]'
                  }`}
                >
                  <span>Next Page</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isPage5Valid}
                  onClick={() => setShowConfirmModal(true)}
                  className={`px-5 py-2 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black shadow-lg transition-all flex items-center gap-1.5 sm:gap-2 ${
                    !isPage5Valid
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-[#1b4332] hover:bg-[#2d6a4f] text-white cursor-pointer hover:scale-[1.02]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#74c69d]" />
                  <span>Submit Application</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl text-[#1b4332]"
            >
              <div className="flex items-center gap-3 border-b border-[#e2ece2] pb-3">
                <div className="p-3 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
                  <HelpCircle className="w-6 h-6 text-[#2d6a4f]" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                    Confirm Registration
                  </h3>
                </div>
              </div>

              <div className="space-y-3 text-xs text-[#2d3a3a]">
                <p>
                  Are you sure you want to submit your application for <strong>{firstName} {lastName}</strong> to the BCC Riders Club registry?
                </p>

                <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1.5 font-sans">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#52605d]">Username:</span>
                    <span className="font-bold text-[#1b4332]">{username}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#52605d]">Active Email:</span>
                    <span className="font-bold text-[#1b4332]">{email}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#52605d]">Network:</span>
                    <span className="font-bold text-[#2d6a4f]">{network}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#52605d]">Address:</span>
                    <span className="font-mono text-[#1b4332] truncate max-w-[200px]">
                      {phAddress?.streetAddress
                        ? `${phAddress.streetAddress}, ${phAddress.fullAddressString}`
                        : (phAddress?.fullAddressString || 'Davao City')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#1b4332] text-xs font-bold border border-[#e2ece2] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                  Submit
                </button>
              </div>
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
    </motion.div>
  );
};
