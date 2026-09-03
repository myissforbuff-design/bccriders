import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { store, authFetch, safeFetchJson, setCachedData } from '../lib/db';
import { loadFromSession, saveToSession } from '../lib/storageSecurity';
import { CustomSelect } from './CustomSelect';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { OfficialLoader } from './OfficialLoader';
import {
  FinanceSettings,
  MonthlyDue,
  DynamicCollection,
  SecuritySettings,
  User,
  FinanceYearArchive,
  ArchivePackageData,
} from '../types';
import { YearlyArchiveModal } from './YearlyArchiveModal';
import { ArchiveExportModal } from './ArchiveExportModal';
import { ModalPortal } from './ModalPortal';
import { extractZipArchive } from '../lib/yearlyArchiveUtils';
import { InboundEmailViewer } from './InboundEmailViewer';
import { EmailSender } from './EmailSender';
import { PushNotificationSettings } from './PushNotificationSettings';
import { RolesSettings } from './RolesSettings';
import { DriveStorageSettings } from './DriveStorageSettings';
import {
  Coins,
  Wallet,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Users,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Mail,
  Bell,
  HardDrive,
  Settings as SettingsIcon,
  Save,
  X,
  AlertTriangle,
  Receipt,
  PiggyBank,
  TrendingUp,
  Layers,
  HelpCircle,
  FileSpreadsheet,
  LogOut,
  ChevronDown,
  Check,
  Sparkles,
  Download,
  BarChart3,
  Filter,
  RefreshCw,
  FileText,
  Table,
  Eye,
  DollarSign,
  Clock,
  AlertCircle,
  HeartHandshake,
  Archive,
  FolderArchive,
  Upload,
  Fingerprint,
  Smartphone,
  KeyRound,
} from 'lucide-react';
import {
  isBiometricsSupported,
  registerBiometricCredential,
  getBiometricForUser,
  removeBiometricCredential,
  getDeviceDescription,
  BiometricCredentialInfo,
} from '../lib/biometrics';
import {
  getDevicePinForUser,
  removeUserPin,
  DevicePinInfo,
  getPinDeviceName,
} from '../lib/pinAuth';
import { PinSetupModal } from './PinSetupModal';

const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const YEAR_OPTIONS = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

const SUB_TAB_OPTIONS = [
  { id: 'push_notifications', label: 'Push Notifications', icon: Bell, description: 'Web push alerts & customizable triggers' },
  { id: 'storage', label: 'Google Shared Drive & Storage', icon: HardDrive, description: 'Google Drive photo sync & MongoDB zero-base64' },
  { id: 'finance', label: 'Finances & Fees', icon: Wallet, description: 'Fees, monthly dues & drives' },
  { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet, description: 'Export member & financial ledgers' },
  { id: 'security', label: 'System Security & Biometrics', icon: Shield, description: 'Fingerprint, Face ID & Admin 2FA' },
  { id: 'inbound', label: 'Email', icon: Mail, description: 'Email dispatcher, broadcast & contact@bccriders.cc inbox' },
] as const;

export const Settings: React.FC = () => {
  const { currentUser, isAdmin, logout } = useAuth();
  const { runWithLoader, refreshTick } = useLoader();

  // Settings Sub-Navigation Dropdown & Tabs
  const [activeSubTab, setActiveSubTab] = useState<'push_notifications' | 'storage' | 'finance' | 'reports' | 'security' | 'inbound'>(() => {
    const saved = localStorage.getItem('bcc_settings_subtab');
    return (saved === 'push_notifications' || saved === 'storage' || saved === 'finance' || saved === 'reports' || saved === 'security' || saved === 'inbound') ? saved : 'push_notifications';
  });

  useEffect(() => {
    localStorage.setItem('bcc_settings_subtab', activeSubTab);
  }, [activeSubTab]);
  const [isSubTabDropdownOpen, setIsSubTabDropdownOpen] = useState(false);
  const subTabDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subTabDropdownRef.current && !subTabDropdownRef.current.contains(event.target as Node)) {
        setIsSubTabDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const getApprovedNonAdminMembers = useCallback((): User[] => {
    const allUsers = store.getUsers();
    return allUsers.filter((u) => {
      const isUserAdmin =
        u.role === 'admin' ||
        u.role?.toLowerCase() === 'admin' ||
        u.role?.toLowerCase() === 'administrator' ||
        u.id === 'usr_admin' ||
        u.id === 'admin' ||
        u.username?.toLowerCase() === 'admin' ||
        u.email?.toLowerCase().includes('admin@') ||
        u.email?.toLowerCase().startsWith('admin@') ||
        u.email?.toLowerCase() === 'admin@bccriders.org' ||
        u.email?.toLowerCase() === 'admin@bccriders.cc' ||
        u.name?.toLowerCase() === 'admin' ||
        u.name?.toLowerCase().includes('(admin)');
      if (isUserAdmin) return false;
      return u.approvalStatus === 'Approved';
    });
  }, []);

  // Database States
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>(() =>
    store.getFinanceSettings()
  );
  const [monthlyDues, setMonthlyDues] = useState<MonthlyDue[]>(() =>
    store.getMonthlyDues()
  );
  const [dynamicCollections, setDynamicCollections] = useState<DynamicCollection[]>(
    () => store.getDynamicCollections()
  );
  const [approvedMembers, setApprovedMembers] = useState<User[]>(() => getApprovedNonAdminMembers());

  // Fee Form State
  const [membershipFeeInput, setMembershipFeeInput] = useState<number>(
    financeSettings.membershipFee
  );
  const [annualFeeInput, setAnnualFeeInput] = useState<number>(
    financeSettings.annualFee
  );
  const [feeSavedToast, setFeeSavedToast] = useState(false);

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(() =>
    store.getSecuritySettings()
  );
  const [securityToast, setSecurityToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Biometric Authentication State
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const [userBioCredential, setUserBioCredential] = useState<BiometricCredentialInfo | null>(null);
  const [bioSuccess, setBioSuccess] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  // 4-Digit PIN Authentication State
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [userPinCredential, setUserPinCredential] = useState<DevicePinInfo | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isRemovingPin, setIsRemovingPin] = useState(false);

  const [settingsNoticeModal, setSettingsNoticeModal] = useState<{ title: string; message: string; isError?: boolean } | null>(null);

  useEffect(() => {
    isBiometricsSupported()
      .then((supported) => setBiometricsSupported(supported))
      .catch(() => setBiometricsSupported(false));

    if (currentUser?.id) {
      const cred = getBiometricForUser(currentUser.id);
      setUserBioCredential(cred);

      const pinCred = getDevicePinForUser(currentUser.id) || getDevicePinForUser(currentUser.username);
      setUserPinCredential(pinCred);
    }
  }, [currentUser?.id, currentUser?.username]);

  const handleRegisterBiometrics = async () => {
    if (!currentUser) return;
    setBioSuccess(null);
    setBioError(null);
    setIsEnrollingBio(true);

    try {
      const res = await registerBiometricCredential({
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name || currentUser.username,
      });

      if (res.success && res.credential) {
        setUserBioCredential(res.credential);
        setBioSuccess(`Biometrics registered successfully! You can now use your fingerprint or Face ID to sign in on this device.`);
      } else {
        setBioError(res.error || 'Failed to register biometric credentials.');
      }
    } catch (err: any) {
      setBioError(err?.message || 'Failed to register biometric credentials.');
    } finally {
      setIsEnrollingBio(false);
    }
  };

  const handleRemoveBiometrics = () => {
    if (!currentUser) return;
    try {
      removeBiometricCredential(currentUser.id);
      setUserBioCredential(null);
      setBioSuccess('Biometric login removed from this device.');
      setBioError(null);
    } catch (err: any) {
      setBioError('Failed to remove biometric credential.');
    }
  };

  const handleRemovePin = async () => {
    if (!currentUser) return;
    setIsRemovingPin(true);
    setPinSuccess(null);
    setPinError(null);
    try {
      await removeUserPin(currentUser.id, currentUser.username);
      setUserPinCredential(null);
      setPinSuccess('4-Digit PIN login removed successfully.');
    } catch (err: any) {
      setPinError('Failed to remove PIN.');
    } finally {
      setIsRemovingPin(false);
    }
  };

  const handleToggleAdminOtp = () => {
    const updatedValue = !securitySettings.adminOtpEnabled;
    const newSettings = store.updateSecuritySettings({ adminOtpEnabled: updatedValue });
    setSecuritySettings({ ...newSettings });

    setSecurityToast({
      message: updatedValue
        ? 'Admin 2FA OTP Enabled: Signing in as Administrator now requires a 6-digit authorization code.'
        : 'Admin 2FA OTP Disabled: Administrator accounts can now log in directly with password.',
      type: updatedValue ? 'success' : 'info',
    });

    setTimeout(() => {
      setSecurityToast(null);
    }, 4500);
  };

  // Monthly Due Modal State
  const [showMonthlyDueModal, setShowMonthlyDueModal] = useState(false);
  const [editingDue, setEditingDue] = useState<MonthlyDue | null>(null);
  const [dueTitle, setDueTitle] = useState('');
  const [dueAmount, setDueAmount] = useState<number>(150);
  const [dueMonth, setDueMonth] = useState<string>('January');
  const [dueYear, setDueYear] = useState<string>('2026');
  const [dueNotes, setDueNotes] = useState('');

  // Dynamic Collection Modal State
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<DynamicCollection | null>(null);
  const [colType, setColType] = useState<'Standard' | 'Donation'>('Standard');
  const [colName, setColName] = useState('');
  const [colDonorName, setColDonorName] = useState('');
  const [colAmount, setColAmount] = useState<number>(500);
  const [colTargetAmount, setColTargetAmount] = useState<string>('');
  const [colDescription, setColDescription] = useState('');

  // Custom Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'monthly_due' | 'dynamic_collection';
    id: string;
    name: string;
  } | null>(null);

  // Reports & Export Center State
  const REPORT_MONTH_OPTIONS = [
    { value: 'All', label: 'All Months', short: 'All' },
    { value: '01', label: 'January', short: 'Jan' },
    { value: '02', label: 'February', short: 'Feb' },
    { value: '03', label: 'March', short: 'Mar' },
    { value: '04', label: 'April', short: 'Apr' },
    { value: '05', label: 'May', short: 'May' },
    { value: '06', label: 'June', short: 'Jun' },
    { value: '07', label: 'July', short: 'Jul' },
    { value: '08', label: 'August', short: 'Aug' },
    { value: '09', label: 'September', short: 'Sep' },
    { value: '10', label: 'October', short: 'Oct' },
    { value: '11', label: 'November', short: 'Nov' },
    { value: '12', label: 'December', short: 'Dec' },
  ];

  const [reportYearFilter, setReportYearFilter] = useState<string>('All');
  const [reportMonthFilter, setReportMonthFilter] = useState<string>('All');
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(event.target as Node)
      ) {
        setIsYearDropdownOpen(false);
      }
      if (
        monthDropdownRef.current &&
        !monthDropdownRef.current.contains(event.target as Node)
      ) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const [reportPayments, setReportPayments] = useState<any[]>([]);
  const [reportExpenses, setReportExpenses] = useState<any[]>([]);
  const [reportUsers, setReportUsers] = useState<User[]>([]);

  const availableYears = React.useMemo(() => {
    const yearSet = new Set<string>();

    const extractYear = (val?: string) => {
      if (!val) return;
      const match = val.match(/\b(20\d\d)\b/);
      if (match) {
        yearSet.add(match[1]);
      }
    };

    reportPayments.forEach((p) => {
      extractYear(p.paidDate);
      extractYear(p.createdAt);
      extractYear(p.coveredMonth);
      extractYear(p.dueDate);
    });

    reportExpenses.forEach((e) => {
      extractYear(e.date);
      extractYear(e.createdAt);
    });

    if (yearSet.size === 0) {
      yearSet.add(new Date().getFullYear().toString());
    }

    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [reportPayments, reportExpenses]);
  const [previewModal, setPreviewModal] = useState<{
    title: string;
    subtitle: string;
    headers: string[];
    rows: (string | number)[][];
    onDownload: () => void;
    onXlsDownload?: () => void;
    onPdfDownload?: () => void;
  } | null>(null);

  // Yearly Archive and Compressed Zip Import Modal States
  const [showYearlyArchiveModal, setShowYearlyArchiveModal] = useState(false);
  const [showArchiveExportModal, setShowArchiveExportModal] = useState(false);
  const [importedArchiveData, setImportedArchiveData] = useState<ArchivePackageData | null>(null);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  // Delete a Year's Transaction States & Countdown
  const [deleteYearInput, setDeleteYearInput] = useState<string>('');
  const [showDeleteYearModal, setShowDeleteYearModal] = useState<boolean>(false);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(10);
  const [isDeletingYear, setIsDeletingYear] = useState<boolean>(false);
  const [deleteYearToast, setDeleteYearToast] = useState<string | null>(null);

  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [modalStartX, setModalStartX] = useState(0);
  const [modalScrollLeft, setModalScrollLeft] = useState(0);

  const handleModalMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!modalScrollRef.current) return;
    setIsDraggingModal(true);
    setModalStartX(e.pageX - modalScrollRef.current.offsetLeft);
    setModalScrollLeft(modalScrollRef.current.scrollLeft);
  };

  const handleModalMouseLeaveOrUp = () => {
    setIsDraggingModal(false);
  };

  const handleModalMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingModal || !modalScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - modalScrollRef.current.offsetLeft;
    const walk = (x - modalStartX) * 1.5;
    modalScrollRef.current.scrollLeft = modalScrollLeft - walk;
  };

  useModalDismiss(showMonthlyDueModal, () => setShowMonthlyDueModal(false));
  useModalDismiss(showCollectionModal, () => setShowCollectionModal(false));
  useModalDismiss(Boolean(deleteTarget), () => setDeleteTarget(null));
  useModalDismiss(showLogoutModal, () => setShowLogoutModal(false));
  useModalDismiss(Boolean(previewModal), () => setPreviewModal(null));
  useModalDismiss(showYearlyArchiveModal, () => setShowYearlyArchiveModal(false));
  useModalDismiss(showArchiveExportModal, () => {
    setShowArchiveExportModal(false);
    setImportedArchiveData(null);
  });
  useModalDismiss(showDeleteYearModal, () => setShowDeleteYearModal(false));

  // Helper matching functions for a specific year
  const isRecordInYear = (r: any, targetYear: string | number) => {
    const yStr = String(targetYear);
    const pDate = r.paidDate || r.dueDate || r.updatedAt || r.createdAt || '';
    const covMonth = r.coveredMonth || '';
    const custName = r.customItemName || '';
    return pDate.includes(yStr) || covMonth.includes(yStr) || custName.includes(yStr);
  };

  const isExpenseInYear = (e: any, targetYear: string | number) => {
    const yStr = String(targetYear);
    const eDate = e.date || e.updatedAt || e.createdAt || '';
    return eDate.includes(yStr);
  };

  // Matched records for inputted year
  const matchedYearRecords = useMemo(() => {
    if (!deleteYearInput || deleteYearInput.length !== 4) return [];
    return reportPayments.filter(r => isRecordInYear(r, deleteYearInput));
  }, [deleteYearInput, reportPayments]);

  const matchedYearExpenses = useMemo(() => {
    if (!deleteYearInput || deleteYearInput.length !== 4) return [];
    return reportExpenses.filter(e => isExpenseInYear(e, deleteYearInput));
  }, [deleteYearInput, reportExpenses]);

  const isYearMatched = useMemo(() => {
    return Boolean(deleteYearInput && deleteYearInput.length === 4 && (matchedYearRecords.length > 0 || matchedYearExpenses.length > 0));
  }, [deleteYearInput, matchedYearRecords, matchedYearExpenses]);

  const isNoYearMatched = useMemo(() => {
    return Boolean(deleteYearInput && deleteYearInput.length === 4 && matchedYearRecords.length === 0 && matchedYearExpenses.length === 0);
  }, [deleteYearInput, matchedYearRecords, matchedYearExpenses]);

  // 10-second countdown timer for deletion modal
  useEffect(() => {
    if (!showDeleteYearModal) return;
    if (deleteCountdown <= 0) return;
    const timer = setInterval(() => {
      setDeleteCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [showDeleteYearModal, deleteCountdown]);

  const handleOpenDeleteYearModal = () => {
    if (!deleteYearInput || deleteYearInput.length !== 4) return;
    if (!isYearMatched) return;
    setDeleteCountdown(10);
    setShowDeleteYearModal(true);
  };

  const deleteRecordsForYear = async (targetYear: number) => {
    const yearStr = targetYear.toString();
    const recordsToDelete = reportPayments.filter(r => isRecordInYear(r, yearStr));
    const expensesToDelete = reportExpenses.filter(e => isExpenseInYear(e, yearStr));

    const updatedRecords = reportPayments.filter(r => !isRecordInYear(r, yearStr));
    const updatedExpenses = reportExpenses.filter(e => !isExpenseInYear(e, yearStr));

    setReportPayments(updatedRecords);
    setReportExpenses(updatedExpenses);
    localStorage.setItem('bcc_finance_records_v3', JSON.stringify(updatedRecords));
    localStorage.setItem('bcc_expense_records_v1', JSON.stringify(updatedExpenses));

    for (const rec of recordsToDelete) {
      if (rec.id) {
        try {
          await authFetch(`/api/mongodb/financeLogs?id=${encodeURIComponent(rec.id)}`, { method: 'DELETE' });
        } catch (err) {
          console.error(`Failed to delete finance log ${rec.id}:`, err);
        }
      }
    }

    for (const exp of expensesToDelete) {
      if (exp.id) {
        try {
          await authFetch(`/api/mongodb/liquidationLogs?id=${encodeURIComponent(exp.id)}`, { method: 'DELETE' });
        } catch (err) {
          console.error(`Failed to delete liquidation log ${exp.id}:`, err);
        }
      }
    }
  };

  const handleConfirmDeleteYear = async () => {
    if (!deleteYearInput || deleteYearInput.length !== 4 || deleteCountdown > 0) return;
    const yr = Number(deleteYearInput);
    setIsDeletingYear(true);
    try {
      await deleteRecordsForYear(yr);
      setShowDeleteYearModal(false);
      setDeleteYearToast(`Successfully deleted all transactions for FY ${deleteYearInput}.`);
      setDeleteYearInput('');
      setTimeout(() => setDeleteYearToast(null), 4000);
    } catch (err) {
      console.error('Error deleting year transactions:', err);
    } finally {
      setIsDeletingYear(false);
    }
  };

  const handleArchiveComplete = () => {
    loadReportsData();
    setShowYearlyArchiveModal(false);
  };

  const handleImportZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingZip(true);
    try {
      const archiveData = await extractZipArchive(file);
      setImportedArchiveData(archiveData);
      setShowArchiveExportModal(true);
    } catch (err: any) {
      console.error('Failed to parse zip archive:', err);
      setSettingsNoticeModal({
        title: 'Archive Import Error',
        message: 'Failed to read the compressed archive file. Please ensure it is a valid yearly finance archive .zip generated by BCC Riders Club.',
        isError: true,
      });
    } finally {
      setIsImportingZip(false);
      if (zipInputRef.current) {
        zipInputRef.current.value = '';
      }
    }
  };

  const loadReportsData = () => {
    // Users (Exclude Admin)
    const uList = store.getUsers().filter((u) => {
      const isUserAdmin =
        u.role === 'admin' ||
        u.role?.toLowerCase() === 'admin' ||
        u.role?.toLowerCase() === 'administrator' ||
        u.id === 'usr_admin' ||
        u.id === 'admin' ||
        u.username?.toLowerCase() === 'admin' ||
        u.email?.toLowerCase().includes('admin@');
      return !isUserAdmin;
    });
    setReportUsers(uList);

    // Payments & Dues (Include Membership Fees, Dues, and all Finance Records, Exclude Admin)
    let finList: any[] = store.getFinanceRecords();
    if (!Array.isArray(finList) || finList.length === 0) {
      try {
        const item = localStorage.getItem('bcc_finance_records_v3');
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) finList = parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Combine with store payments if any missing
    const combinedPayments = [...finList];
    const existingIds = new Set(finList.map((p) => p.id));
    store.getPayments().forEach((p) => {
      if (!existingIds.has(p.id)) {
        combinedPayments.push({
          id: p.id,
          userId: p.userId,
          userName: p.userName,
          itemType: p.type || 'Other',
          amount: p.amount,
          status: p.status,
          paymentMethod: p.paymentMethod,
          paidDate: p.createdAt,
          createdAt: p.createdAt,
          updatedAt: p.createdAt,
          notes: p.description,
        });
      }
    });

    const adminUserIds = new Set(
      store
        .getUsers()
        .filter(
          (u) =>
            u.role === 'admin' ||
            u.role?.toLowerCase() === 'admin' ||
            u.id === 'usr_admin' ||
            u.id === 'admin'
        )
        .map((u) => u.id)
    );

    const filterNonAdminPayments = (arr: any[]) =>
      arr.filter(
        (p) =>
          !adminUserIds.has(p.userId) &&
          p.userId !== 'usr_admin' &&
          p.userId !== 'admin' &&
          p.userName !== 'Admin' &&
          p.userName?.toLowerCase() !== 'admin'
      );

    setReportPayments(filterNonAdminPayments(combinedPayments));

    Promise.all([
      safeFetchJson('/api/mongodb/financeLogs'),
      safeFetchJson('/api/mongodb/monthlyDueLogs'),
    ])
      .then(([finData, mdData]) => {
        let combined: any[] = [];
        let deletedRecordIds: string[] = [];
        try {
          deletedRecordIds = loadFromSession<string[]>('bcc_deleted_finance_record_ids', []);
        } catch (e) {}

        if (finData.success && Array.isArray(finData.data)) {
          combined = [...combined, ...finData.data];
        }
        if (mdData.success && Array.isArray(mdData.data)) {
          const seen = new Set(combined.map((r: any) => r.id));
          mdData.data.forEach((r: any) => {
            if (!seen.has(r.id)) {
              combined.push(r);
              seen.add(r.id);
            }
          });
        }
        if (combined.length > 0) {
          if (deletedRecordIds.length > 0) {
            combined = combined.filter((r: any) => !deletedRecordIds.includes(r.id));
          }
          setReportPayments(filterNonAdminPayments(combined));
          localStorage.setItem('bcc_finance_records_v3', JSON.stringify(combined));
          saveToSession('bcc_finance_records_v3', combined);
          setCachedData('bcc_finance_records_v3', combined);
        }
      })
      .catch(() => {});

    // Expenses (Sync from bcc_expense_records_v1 & MongoDB liquidationLogs)
    let expList: any[] = [];
    try {
      const expItem = localStorage.getItem('bcc_expense_records_v1');
      if (expItem) {
        const parsed = JSON.parse(expItem);
        if (Array.isArray(parsed)) expList = parsed;
      }
    } catch (e) {
      console.error(e);
    }
    setReportExpenses(expList);

    authFetch('/api/mongodb/liquidationLogs')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setReportExpenses(data.data);
          localStorage.setItem('bcc_expense_records_v1', JSON.stringify(data.data));
          try {
            localStorage.removeItem('brc_finance_expenses');
          } catch {}
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    loadReportsData();
  }, [currentUser?.id]);

  const downloadXLSXFile = (filename: string, headers: string[], rows: (string | number)[][], sheetName = 'Sheet1') => {
    const wb = XLSX.utils.book_new();
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    const cleanFilename = filename.replace(/\.(csv|xls|xlsx)$/i, '') + '.xlsx';
    XLSX.writeFile(wb, cleanFilename);
  };

  const getMembersReportData = () => {
    const headers = [
      'Member ID',
      'Full Name',
      'Email',
      'Phone Number',
      'Role',
      'Approval Status',
      'Local Chapter',
      'Chapter Position',
      'Church Network',
      'Motorcycle Model',
      'Plate / License No',
      'Emergency Contact Name',
      'Emergency Phone',
      'Joined Date',
    ];

    const activeOrAllUsers = reportUsers.filter(
      (u) =>
        u.role !== 'admin' &&
        u.role?.toLowerCase() !== 'admin' &&
        u.id !== 'usr_admin' &&
        u.id !== 'admin' &&
        (u.approvalStatus === 'Approved' || !u.approvalStatus)
    );

    const rows = activeOrAllUsers.map((u) => [
      u.memberNumber || u.id || 'N/A',
      u.name || 'N/A',
      u.email || 'N/A',
      u.phone || 'N/A',
      u.role || 'Member',
      u.approvalStatus || 'Approved',
      u.chapter || 'Main Chapter',
      u.position || 'Member',
      u.churchNetwork || 'N/A',
      u.motorcycleModel || 'N/A',
      u.plateNumber || 'N/A',
      u.emergencyContactName || 'N/A',
      u.emergencyContactPhone || 'N/A',
      u.joinedAt || u.createdAt || 'N/A',
    ]);

    return { headers, rows };
  };

  const isRecordInPeriod = (
    dateCandidates: (string | undefined)[],
    targetYear: string,
    targetMonth: string
  ): boolean => {
    if (targetYear === 'All' && targetMonth === 'All') return true;

    const validStrings = dateCandidates.filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0
    );
    if (validStrings.length === 0) return false;

    const targetMonthNum = targetMonth === 'All' ? null : parseInt(targetMonth, 10);
    const targetMonthObj = targetMonth === 'All' ? null : REPORT_MONTH_OPTIONS.find((m) => m.value === targetMonth);
    const monthFullName = targetMonthObj?.label.toLowerCase() || '';
    const monthShortName = targetMonthObj?.short.toLowerCase() || '';

    for (const raw of validStrings) {
      const s = raw.trim();
      const lower = s.toLowerCase();

      // 1. Year match
      let matchesYear = targetYear === 'All';
      if (!matchesYear) {
        if (s.includes(targetYear)) {
          matchesYear = true;
        } else {
          const d = new Date(s);
          if (!isNaN(d.getTime()) && d.getFullYear().toString() === targetYear) {
            matchesYear = true;
          }
        }
      }

      if (!matchesYear) continue;

      // 2. Month match
      let matchesMonth = targetMonth === 'All';
      if (!matchesMonth && targetMonthNum !== null) {
        if (monthFullName && lower.includes(monthFullName)) {
          matchesMonth = true;
        } else if (monthShortName && lower.includes(monthShortName)) {
          matchesMonth = true;
        } else if (
          s.includes(`-${targetMonth}-`) ||
          s.includes(`-${targetMonth}`) ||
          s.includes(`/${targetMonth}/`) ||
          s.includes(`/${targetMonthNum}/`) ||
          new RegExp(`[-/.]0?${targetMonthNum}[-/.]`).test(s)
        ) {
          matchesMonth = true;
        } else {
          const d = new Date(s);
          if (!isNaN(d.getTime()) && d.getMonth() + 1 === targetMonthNum) {
            matchesMonth = true;
          }
        }
      }

      if (matchesYear && matchesMonth) {
        return true;
      }
    }

    return false;
  };

  const getReportPeriodSlug = () => {
    const mObj = REPORT_MONTH_OPTIONS.find((m) => m.value === reportMonthFilter);
    const monthSlug = reportMonthFilter === 'All' ? '' : (mObj?.short || reportMonthFilter);

    if (reportYearFilter === 'All' && reportMonthFilter === 'All') return 'All_Time';
    if (reportYearFilter !== 'All' && reportMonthFilter === 'All') return `FY_${reportYearFilter}`;
    if (reportYearFilter === 'All' && reportMonthFilter !== 'All') return `All_Years_${monthSlug}`;
    return `${reportYearFilter}_${monthSlug}`;
  };

  const getReportPeriodDisplay = () => {
    const mObj = REPORT_MONTH_OPTIONS.find((m) => m.value === reportMonthFilter);
    const monthName = mObj && reportMonthFilter !== 'All' ? mObj.label : '';

    if (reportYearFilter === 'All' && reportMonthFilter === 'All') return 'All Time';
    if (reportYearFilter !== 'All' && reportMonthFilter === 'All') return `FY ${reportYearFilter}`;
    if (reportYearFilter === 'All' && reportMonthFilter !== 'All') return `${monthName} (All Years)`;
    return `${monthName} ${reportYearFilter}`;
  };

  const getTransactionsReportData = () => {
    const headers = [
      'Transaction ID',
      'Paid Date',
      'Member ID',
      'Member Name',
      'Item Category',
      'Item Description / Covered Period',
      'Amount (PHP)',
      'Payment Status',
      'Payment Method',
      'Reference / Receipt No',
      'Notes',
      'Updated At',
    ];

    const filtered = reportPayments.filter((p) =>
      isRecordInPeriod(
        [p.paidDate, p.createdAt, p.coveredMonth, p.dueDate],
        reportYearFilter,
        reportMonthFilter
      )
    );

    const userMap = new Map(reportUsers.map((u) => [u.id, u.name]));

    const rows = filtered.map((p) => [
      p.id,
      p.paidTime ? `${p.paidDate || p.createdAt || 'N/A'} ${p.paidTime}` : (p.paidDate || p.createdAt || 'N/A'),
      p.userMemberNo || p.userId || 'N/A',
      userMap.get(p.userId) || p.userName || p.userMemberNo || 'N/A',
      p.itemType || p.type || 'Other',
      p.customItemName || p.coveredMonth || p.description || 'N/A',
      Number(p.amount) || 0,
      p.status,
      p.paymentMethod || 'Cash/G-Cash',
      p.referenceNo || 'N/A',
      p.notes || '',
      p.updatedAt || 'N/A',
    ]);

    return { headers, rows };
  };

  const getExpensesReportData = () => {
    const headers = [
      'Expense ID',
      'Date Disbursed',
      'Category',
      'Title / Particulars',
      'Disbursed To / Vendor',
      'Amount (PHP)',
      'Payment Method',
      'Receipt / Voucher Ref',
      'Approved By',
      'Notes',
    ];

    const filtered = reportExpenses.filter((e) =>
      isRecordInPeriod(
        [e.date, e.createdAt],
        reportYearFilter,
        reportMonthFilter
      )
    );

    const rows = filtered.map((e) => [
      e.id,
      e.date || e.createdAt || 'N/A',
      e.category || 'General Expense',
      e.title || 'N/A',
      e.disbursedTo || e.vendor || 'N/A',
      Number(e.amount) || 0,
      e.paymentMethod || 'Cash',
      e.receiptRef || e.voucherNo || 'N/A',
      e.approvedBy || 'Admin',
      e.notes || '',
    ]);

    return { headers, rows };
  };

  const calculateFinancialStatementMetrics = () => {
    const pFiltered = reportPayments.filter((p) =>
      isRecordInPeriod(
        [p.paidDate, p.createdAt, p.coveredMonth, p.dueDate],
        reportYearFilter,
        reportMonthFilter
      )
    );

    const eFiltered = reportExpenses.filter((e) =>
      isRecordInPeriod(
        [e.date, e.createdAt],
        reportYearFilter,
        reportMonthFilter
      )
    );

    const paidPayments = pFiltered.filter(
      (p) =>
        p.status === 'Paid' &&
        (!p.notes?.includes('Satisfied by Annual Upfront Promo Package') || p.itemType !== 'Monthly Due')
    );
    const pendingPayments = pFiltered.filter(
      (p) => p.status === 'Pending' || p.status === 'Overdue'
    );

    const totalIncome = paidPayments.reduce(
      (acc, p) => acc + (Number(p.amount) || 0),
      0
    );
    const totalExpenses = eFiltered.reduce(
      (acc, e) => acc + (Number(e.amount) || 0),
      0
    );
    const netSurplus = totalIncome - totalExpenses;

    // Accounts Receivable: Calculate remaining monthly dues that haven't been collected across approved members
    const activeMembers = reportUsers.filter(
      (u) =>
        u.role !== 'admin' &&
        u.role?.toLowerCase() !== 'admin' &&
        u.id !== 'usr_admin' &&
        u.id !== 'admin' &&
        (u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin'))
    );

    const activeDues = store.getMonthlyDues().filter((d) => {
      const coveredMonthStr = `${d.month} ${d.year}`;
      return isRecordInPeriod([d.createdAt, coveredMonthStr, String(d.year)], reportYearFilter, reportMonthFilter);
    });

    let uncollectedMonthlyDuesTotal = 0;
    activeMembers.forEach((member) => {
      const memberPayments = reportPayments.filter((p) => p.userId === member.id);
      activeDues.forEach((due) => {
        const coveredMonthStr = `${due.month} ${due.year}`;
        const hasPromo = memberPayments.some(
          (p) =>
            p.itemType === 'Annual Upfront Promo' &&
            p.status === 'Paid' &&
            (p.coveredMonth?.includes(String(due.year)) || p.customItemName?.includes(String(due.year)) || !p.coveredMonth)
        );
        if (hasPromo) return;

        const isPaidOrWaived = memberPayments.some(
          (p) =>
            p.itemType === 'Monthly Due' &&
            (p.status === 'Paid' || p.status === 'Waived') &&
            (p.coveredMonth === coveredMonthStr || p.customItemName === due.title || p.id === `rec_md_${due.id}_${member.id}` || p.id === `rec_md_${due.id.replace(/^md_/, '')}_${member.id}`)
        );
        if (isPaidOrWaived) return;

        const hasExplicitPending = pendingPayments.some(
          (p) =>
            p.userId === member.id &&
            p.itemType === 'Monthly Due' &&
            (p.coveredMonth === coveredMonthStr || p.customItemName === due.title || p.id.includes(due.id))
        );

        if (!hasExplicitPending) {
          uncollectedMonthlyDuesTotal += Number(due.amount) || 0;
        }
      });
    });

    const explicitPendingTotal = pendingPayments.reduce(
      (acc, p) => acc + (Number(p.amount) || 0),
      0
    );
    const totalReceivables = explicitPendingTotal + uncollectedMonthlyDuesTotal;
    const totalDiscount = paidPayments.filter((p) => p.itemType === 'Annual Upfront Promo').length * 200;

    const incomeByType: Record<string, number> = {};
    paidPayments.forEach((p) => {
      const key = p.itemType || p.type || 'Other Funds';
      incomeByType[key] = (incomeByType[key] || 0) + (Number(p.amount) || 0);
    });

    const expenseByCategory: Record<string, number> = {};
    eFiltered.forEach((e) => {
      const key = e.category || 'General Expense';
      expenseByCategory[key] = (expenseByCategory[key] || 0) + (Number(e.amount) || 0);
    });

    return {
      pFiltered,
      eFiltered,
      paidPayments,
      pendingPayments,
      totalIncome,
      totalExpenses,
      netSurplus,
      totalReceivables,
      totalDiscount,
      incomeByType,
      expenseByCategory,
    };
  };

  const getFinancialStatementReportData = () => {
    const {
      totalIncome,
      totalExpenses,
      netSurplus,
      totalReceivables,
      totalDiscount,
      incomeByType,
      expenseByCategory,
    } = calculateFinancialStatementMetrics();

    const headers = ['Account / Line Item', 'Amount (PHP)'];

    const rows: (string | number)[][] = [
      ['BCC RIDERS CLUB - FINANCIAL STATEMENT', getReportPeriodDisplay()],
      ['', ''],
      ['FUNDS', ''],
      ['Accounts Receivable (Pending Dues)', totalReceivables.toFixed(2)],
    ];

    if (Object.keys(incomeByType).length === 0) {
      rows.push(['  No funds items recorded', '0.00']);
    } else {
      const sortedIncome = Object.entries(incomeByType).sort(([a], [b]) => {
        if (a === 'Membership Fee') return -1;
        if (b === 'Membership Fee') return 1;
        if (a === 'Monthly Due') return -1;
        if (b === 'Monthly Due') return 1;
        return a.localeCompare(b);
      });
      sortedIncome.forEach(([cat, amt]) => {
        rows.push([`  ${cat}`, amt.toFixed(2)]);
      });
    }

    rows.push(['Discount', totalDiscount.toFixed(2)]);
    rows.push(['Total Funds', totalIncome.toFixed(2)]);
    rows.push(['', '']);
    rows.push(['EXPENSES', '']);

    if (Object.keys(expenseByCategory).length === 0) {
      rows.push(['  No expense items recorded', '0.00']);
    } else {
      Object.entries(expenseByCategory).forEach(([cat, amt]) => {
        rows.push([`  ${cat}`, amt.toFixed(2)]);
      });
    }

    rows.push(['Total Expenses', totalExpenses.toFixed(2)]);
    rows.push(['', '']);
    rows.push(['NET INCOME (OPERATING SURPLUS)', netSurplus.toFixed(2)]);

    return { headers, rows };
  };

  const exportFinancialStatementPDF = () => {
    const {
      totalIncome,
      totalExpenses,
      netSurplus,
      totalReceivables,
      totalDiscount,
      incomeByType,
      expenseByCategory,
    } = calculateFinancialStatementMetrics();

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let y = 18;

    // Header Top: Company Name Left, Income Statement Right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(27, 67, 50); // Primary dark green
    doc.text('BCC Riders Club', margin, y);

    doc.setFontSize(16);
    doc.setTextColor(27, 67, 50);
    doc.text('Income Statement', pageWidth - margin, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(82, 96, 93);
    const periodText =
      reportYearFilter === 'All' && reportMonthFilter === 'All'
        ? 'For All Recorded Fiscal Periods'
        : reportYearFilter !== 'All' && reportMonthFilter === 'All'
        ? `For the Year Ended December 31, ${reportYearFilter}`
        : `For the Period: ${getReportPeriodDisplay()}`;
    doc.text(periodText, pageWidth - margin, y, { align: 'right' });
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      margin,
      y
    );

    y += 4;
    // Subdued divider line
    doc.setDrawColor(226, 236, 226);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    y += 8;

    // SECTION 1: FUNDS
    // Funds Header Banner
    doc.setFillColor(27, 67, 50); // Dark Green #1b4332
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Funds', margin + 4, y + 5);
    doc.text('Amount (PHP)', pageWidth - margin - 4, y + 5, { align: 'right' });

    y += 7;

    // Accounts Receivable (Pending Dues) Row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text('Accounts Receivable (Pending Dues)', margin + 8, y + 5);
    doc.text(
      totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      pageWidth - margin - 4,
      y + 5,
      { align: 'right' }
    );
    doc.setDrawColor(243, 244, 246);
    doc.line(margin + 4, y + 6.5, pageWidth - margin - 4, y + 6.5);
    y += 6.5;

    const incomeEntries = Object.entries(incomeByType).sort(([a], [b]) => {
      if (a === 'Membership Fee') return -1;
      if (b === 'Membership Fee') return 1;
      if (a === 'Monthly Due') return -1;
      if (b === 'Monthly Due') return 1;
      return a.localeCompare(b);
    });

    if (incomeEntries.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('No funds recorded for this period', margin + 8, y + 5);
      doc.text('0.00', pageWidth - margin - 4, y + 5, { align: 'right' });
      y += 7;
    } else {
      incomeEntries.forEach(([cat, amt]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(31, 41, 55);
        doc.text(cat, margin + 8, y + 5);
        doc.text(
          amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          pageWidth - margin - 4,
          y + 5,
          { align: 'right' }
        );

        doc.setDrawColor(243, 244, 246);
        doc.line(margin + 4, y + 6.5, pageWidth - margin - 4, y + 6.5);
        y += 6.5;
      });
    }

    // Discount Row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text('Discount', margin + 8, y + 5);
    doc.text(
      totalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      pageWidth - margin - 4,
      y + 5,
      { align: 'right' }
    );
    doc.setDrawColor(243, 244, 246);
    doc.line(margin + 4, y + 6.5, pageWidth - margin - 4, y + 6.5);
    y += 6.5;

    // Total Funds Row
    doc.setFillColor(240, 247, 244);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(27, 67, 50);
    doc.text('Total Funds', margin + 4, y + 5);
    doc.text(
      totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      pageWidth - margin - 4,
      y + 5,
      { align: 'right' }
    );

    doc.setDrawColor(183, 228, 199);
    doc.line(margin, y, pageWidth - margin, y);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);

    y += 12;

    // SECTION 2: EXPENSES
    // Expenses Header Banner
    doc.setFillColor(27, 67, 50); // Dark Green #1b4332
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Expenses', margin + 4, y + 5);
    doc.text('Amount (PHP)', pageWidth - margin - 4, y + 5, { align: 'right' });

    y += 7;

    const expenseEntries = Object.entries(expenseByCategory);
    if (expenseEntries.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('No expenses recorded for this period', margin + 8, y + 5);
      doc.text('0.00', pageWidth - margin - 4, y + 5, { align: 'right' });
      y += 7;
    } else {
      expenseEntries.forEach(([cat, amt]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(31, 41, 55);
        doc.text(cat, margin + 8, y + 5);
        doc.text(
          amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          pageWidth - margin - 4,
          y + 5,
          { align: 'right' }
        );

        doc.setDrawColor(243, 244, 246);
        doc.line(margin + 4, y + 6.5, pageWidth - margin - 4, y + 6.5);
        y += 6.5;
      });
    }

    // Total Expenses Row
    doc.setFillColor(240, 247, 244);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(27, 67, 50);
    doc.text('Total Expenses', margin + 4, y + 5);
    doc.text(
      totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      pageWidth - margin - 4,
      y + 5,
      { align: 'right' }
    );

    doc.setDrawColor(183, 228, 199);
    doc.line(margin, y, pageWidth - margin, y);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);

    y += 12;

    // SECTION 3: NET INCOME
    doc.setFillColor(232, 245, 233); // #e8f5e9
    doc.setDrawColor(45, 106, 79); // #2d6a4f
    doc.setLineWidth(0.4);
    doc.rect(margin, y, pageWidth - margin * 2, 8.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(27, 67, 50);
    doc.text('Net Income / Operating Surplus', margin + 4, y + 5.8);

    const netIncomeFormatted = netSurplus.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    doc.text(netIncomeFormatted, pageWidth - margin - 4, y + 5.8, { align: 'right' });

    // Double underline for Net Income
    const netTextWidth = doc.getTextWidth(netIncomeFormatted);
    doc.setDrawColor(27, 67, 50);
    doc.setLineWidth(0.4);
    doc.line(
      pageWidth - margin - 4 - netTextWidth,
      y + 6.8,
      pageWidth - margin - 4,
      y + 6.8
    );
    doc.line(
      pageWidth - margin - 4 - netTextWidth,
      y + 7.5,
      pageWidth - margin - 4,
      y + 7.5
    );

    // Footer
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      doc.text(
        'BCC Riders Club • Executive Income Statement & Accounting Ledger',
        margin,
        pageHeight - 8
      );
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    doc.save(`BRC_Income_Statement_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getMemberComplianceReportData = () => {
    const headers = [
      'Member ID',
      'Member Name',
      'Chapter',
      'Membership Fee Paid (PHP)',
      'Total Monthly Dues Paid (PHP)',
      'Upfront Annual Promo Enrolled',
      'Pending / Overdue Dues Months Count',
      'Total Outstanding Balance (PHP)',
      'Financial Compliance Standing',
    ];

    const activeMembers = reportUsers.filter(
      (u) =>
        u.role !== 'admin' &&
        u.role?.toLowerCase() !== 'admin' &&
        u.id !== 'usr_admin' &&
        u.id !== 'admin' &&
        (u.approvalStatus === 'Approved' || !u.approvalStatus)
    );

    const rows = activeMembers.map((u) => {
      const userPayments = reportPayments.filter((p) => p.userId === u.id);
      const mfPaid = userPayments
        .filter((p) => p.itemType === 'Membership Fee' && p.status === 'Paid')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      const duesPaid = userPayments
        .filter((p) => p.itemType === 'Monthly Due' && p.status === 'Paid')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      const hasAnnualPromo = userPayments.some(
        (p) => p.itemType === 'Annual Upfront Promo' && p.status === 'Paid'
      );

      const pendingRecs = userPayments.filter(
        (p) => p.status === 'Pending' || p.status === 'Overdue'
      );
      const pendingCount = pendingRecs.length;
      const pendingTotal = pendingRecs.reduce(
        (acc, p) => acc + (Number(p.amount) || 0),
        0
      );

      let standing = 'Good Standing (Up to Date)';
      if (pendingCount > 0 && pendingCount <= 2) standing = 'Pending Dues';
      if (pendingCount > 2) standing = 'Overdue / Action Needed';
      if (hasAnnualPromo) standing = 'Good Standing (Annual Upfront Paid)';

      return [
        u.memberNumber || u.id,
        u.name,
        u.chapter || 'Main Chapter',
        mfPaid.toFixed(2),
        duesPaid.toFixed(2),
        hasAnnualPromo ? 'YES' : 'NO',
        pendingCount,
        pendingTotal.toFixed(2),
        standing,
      ];
    });

    return { headers, rows };
  };

  useEffect(() => {
    // Load approved members for collection calculations (strictly excluding admin accounts)
    const approved = getApprovedNonAdminMembers();
    setApprovedMembers(approved);

    const handleUsersUpdated = () => {
      const updated = getApprovedNonAdminMembers();
      setApprovedMembers((prev) => {
        if (prev.length === updated.length && prev.every((m, idx) => m.id === updated[idx]?.id)) {
          return prev;
        }
        return updated;
      });
    };
    window.addEventListener('bcc_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('bcc_users_updated', handleUsersUpdated);
  }, [getApprovedNonAdminMembers]);

  const refreshFinanceData = () => {
    setFinanceSettings(store.getFinanceSettings());
    setMonthlyDues([...store.getMonthlyDues()]);
    const cols = store.getDynamicCollections();
    setDynamicCollections([...cols]);
    const approved = getApprovedNonAdminMembers();
    setApprovedMembers(approved);

    cols.forEach((c) => {
      if (c.status !== 'Completed' && c.status !== 'Archived') {
        generatePendingCollectionRecords(c);
      }
    });
  };

  // Handle Save Fee Configuration
  const handleSaveFees = async (e: React.FormEvent) => {
    e.preventDefault();
    await runWithLoader(
      async () => {
        const newMembershipFee = Number(membershipFeeInput) || 200;
        const updated = store.updateFinanceSettings({
          membershipFee: newMembershipFee,
          annualFee: Number(annualFeeInput) || 0,
          annualPromoEnabled: financeSettings.annualPromoEnabled !== false,
        });
        setFinanceSettings(updated);

        // Sync existing Membership Fee records in local session and MongoDB to the new fee amount
        try {
          const recKey = 'bcc_finance_records_v3';
          const savedRecs = loadFromSession<any[]>(recKey, []);
          let changed = false;
          const updatedRecs = savedRecs.map((r: any) => {
            if (r.itemType === 'Membership Fee') {
              changed = true;
              const updatedRec = {
                ...r,
                amount: newMembershipFee,
                updatedAt: new Date().toISOString().split('T')[0],
              };
              authFetch('/api/mongodb/financeLogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRec),
              }).catch(() => {});
              return updatedRec;
            }
            return r;
          });
          if (changed) {
            saveToSession(recKey, updatedRecs);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('bcc_finance_updated'));
            }
          }
        } catch (err) {
          console.error('Failed to sync updated fee records:', err);
        }
      },
      {
        message: 'Updating Fee Configuration & Refreshing...',
        onComplete: () => {
          setFeeSavedToast(true);
          setTimeout(() => setFeeSavedToast(false), 3000);
        },
      }
    );
  };

  // Toggle Annual Upfront Promo State
  const handleToggleAnnualPromo = async () => {
    const isCurrentlyEnabled = financeSettings.annualPromoEnabled !== false;
    const newStatus = !isCurrentlyEnabled;
    await runWithLoader(
      async () => {
        const updated = store.updateFinanceSettings({
          membershipFee: Number(membershipFeeInput) || financeSettings.membershipFee || 200,
          annualFee: Number(annualFeeInput) || financeSettings.annualFee || 1000,
          annualPromoEnabled: newStatus,
        });
        setFinanceSettings(updated);
      },
      {
        message: newStatus ? 'Enabling Annual Upfront Promo...' : 'Disabling Annual Upfront Promo...',
        onComplete: () => {
          setFeeSavedToast(true);
          setTimeout(() => setFeeSavedToast(false), 3000);
        },
      }
    );
  };

  // Monthly Due Handlers
  const handleOpenCreateDue = () => {
    setEditingDue(null);
    setDueTitle('');
    setDueAmount(150);
    const currMonthName = new Date().toLocaleString('en-US', { month: 'long' });
    setDueMonth(MONTH_OPTIONS.includes(currMonthName) ? currMonthName : 'January');
    setDueYear(String(new Date().getFullYear()));
    setDueNotes('');
    setShowMonthlyDueModal(true);
  };

  const handleOpenEditDue = (due: MonthlyDue) => {
    setEditingDue(due);
    setDueTitle(due.title);
    setDueAmount(due.amount);
    setDueMonth(due.month);
    setDueYear(String(due.year));
    setDueNotes(due.notes || '');
    setShowMonthlyDueModal(true);
  };

  const handleSubmitDue = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleVal = `${dueMonth} ${dueYear} Monthly Due`;

    await runWithLoader(
      async () => {
        let savedDue: MonthlyDue;
        if (editingDue) {
          savedDue = store.updateMonthlyDue({
            ...editingDue,
            title: titleVal,
            amount: Number(dueAmount) || 0,
            month: dueMonth,
            year: Number(dueYear) || 2026,
            notes: dueNotes.trim(),
          });
        } else {
          savedDue = store.createMonthlyDue({
            title: titleVal,
            amount: Number(dueAmount) || 0,
            month: dueMonth,
            year: Number(dueYear) || 2026,
            status: 'Active',
            notes: dueNotes.trim(),
          });
        }

        refreshFinanceData();
        setShowMonthlyDueModal(false);
      },
      {
        message: editingDue ? 'Updating Monthly Due & Refreshing...' : 'Creating Monthly Due & Refreshing...',
      }
    );
  };

  // Helper to generate pending monthly due records for all approved non-admin members
  const generatePendingMonthlyDueRecords = (due: { id: string; month: string; year: number; amount: number; title: string }) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const recItem = localStorage.getItem('bcc_finance_records_v3');
      let recs: any[] = recItem ? JSON.parse(recItem) : [];
      const allUsers = store.getUsers();
      const approved = allUsers.filter(u => {
        const isUserAdmin =
          u.role === 'admin' ||
          u.role?.toLowerCase() === 'admin' ||
          u.role?.toLowerCase() === 'administrator' ||
          u.id === 'usr_admin' ||
          u.id === 'admin' ||
          u.username?.toLowerCase() === 'admin' ||
          u.email?.toLowerCase().includes('admin@');
        if (isUserAdmin) return false;
        return u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin');
      });

      const coveredMonthStr = `${due.month} ${due.year}`;
      let updated = false;

      approved.forEach(u => {
        // Check if member has availed Annual Upfront Promo for this year
        const hasAnnualPromo = recs.some(r =>
          r.userId === u.id &&
          r.itemType === 'Annual Upfront Promo' &&
          r.status === 'Paid' &&
          (r.coveredMonth?.includes(String(due.year)) || r.customItemName?.includes(String(due.year)) || !r.coveredMonth)
        );

        const cleanDueId = due.id.replace(/^md_/, '');
        const targetRecId = `rec_md_${cleanDueId}_${u.id}`;

        const existingIdx = recs.findIndex(r =>
          r.userId === u.id &&
          r.itemType === 'Monthly Due' &&
          (r.coveredMonth === coveredMonthStr || r.customItemName === due.title || r.id === targetRecId || r.id === `rec_md_${due.id}_${u.id}`)
        );

        if (existingIdx === -1) {
          const newRec = {
            id: targetRecId,
            itemType: 'Monthly Due',
            userId: u.id,
            userName: u.name,
            userMemberNo: u.memberNumber || 'BRC-MEMBER',
            amount: due.amount,
            coveredMonth: coveredMonthStr,
            customItemName: due.title,
            dueDate: todayStr,
            paidDate: hasAnnualPromo ? todayStr : undefined,
            status: hasAnnualPromo ? 'Paid' : 'Pending',
            paymentMethod: 'GCash',
            notes: hasAnnualPromo
              ? 'Satisfied by Annual Upfront Promo Package'
              : `Automated pending monthly due for ${coveredMonthStr}`,
            updatedAt: todayStr,
          };
          recs.push(newRec);
          updated = true;
          authFetch('/api/mongodb/monthlyDueLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRec),
          }).catch(err => console.warn('MongoDB auto monthly due log sync error:', err));
        } else if (hasAnnualPromo && (recs[existingIdx].status === 'Pending' || recs[existingIdx].status === 'Overdue')) {
          recs[existingIdx].status = 'Paid';
          recs[existingIdx].paidDate = recs[existingIdx].paidDate || todayStr;
          recs[existingIdx].notes = 'Satisfied by Annual Upfront Promo Package';
          recs[existingIdx].updatedAt = todayStr;
          updated = true;
          authFetch(`/api/mongodb/financeLogs/${recs[existingIdx].id}`, { method: 'DELETE' }).catch(() => {});
          authFetch('/api/mongodb/monthlyDueLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recs[existingIdx]),
          }).catch(err => console.warn('MongoDB update monthly due sync error:', err));
        } else if (!hasAnnualPromo && recs[existingIdx].notes?.includes('Satisfied by Annual Upfront Promo Package')) {
          authFetch(`/api/mongodb/monthlyDueLogs/${recs[existingIdx].id}`, { method: 'DELETE' }).catch(() => {});
          authFetch(`/api/mongodb/financeLogs/${recs[existingIdx].id}`, { method: 'DELETE' }).catch(() => {});
          recs.splice(existingIdx, 1);
          updated = true;
        } else if (!hasAnnualPromo && recs[existingIdx].status === 'Pending' && recs[existingIdx].amount !== due.amount) {
          recs[existingIdx].amount = due.amount;
          updated = true;
        }
      });

      if (updated) {
        localStorage.setItem('bcc_finance_records_v3', JSON.stringify(recs));
      }
    } catch (err) {
      console.error('Error generating pending monthly due records:', err);
    }
  };

  const deletePendingMonthlyDueRecords = (dueId: string) => {
    try {
      const allDues = store.getMonthlyDues();
      const targetDue = allDues.find(d => d.id === dueId);
      const coveredStr = targetDue ? `${targetDue.month} ${targetDue.year}` : '';

      const recItem = localStorage.getItem('bcc_finance_records_v3');
      if (!recItem) return Promise.resolve();
      let recs: any[] = JSON.parse(recItem);
      const promises: Promise<any>[] = [];
      const filtered = recs.filter(r => {
        if (
          r.itemType === 'Monthly Due' &&
          (r.status === 'Pending' || r.status === 'Overdue') &&
          (
            r.id.startsWith(`rec_md_${dueId}_`) ||
            (coveredStr && r.coveredMonth === coveredStr) ||
            (targetDue?.title && r.customItemName === targetDue.title)
          )
        ) {
          promises.push(authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {}));
          return false;
        }
        return true;
      });
      localStorage.setItem('bcc_finance_records_v3', JSON.stringify(filtered));
      return Promise.all(promises);
    } catch (e) {
      console.error(e);
      return Promise.resolve();
    }
  };

  // Helper to generate pending custom collection records for all approved non-admin members
  const generatePendingCollectionRecords = (col: DynamicCollection) => {
    try {
      // If collection is a Donation, do not include in pending collections
      if (col.collectionType === 'Donation' || col.name?.toLowerCase().includes('donation')) {
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const recItem = localStorage.getItem('bcc_finance_records_v3');
      let recs: any[] = recItem ? JSON.parse(recItem) : [];
      const approved = getApprovedNonAdminMembers();

      // If there are no approved members registered, mute generation of pending dues
      if (approved.length === 0) {
        return;
      }

      const memberCount = approved.length;
      const targetTotal =
        col.targetAmount !== undefined && col.targetAmount !== null && !isNaN(Number(col.targetAmount)) && Number(col.targetAmount) > 0
          ? Number(col.targetAmount)
          : memberCount * col.amount;

      const perMemberAmount = col.amount > 0 ? col.amount : Math.ceil(targetTotal / memberCount);
      let updated = false;

      approved.forEach(u => {
        const existingIdx = recs.findIndex(r =>
          r.userId === u.id &&
          (r.id === `rec_col_${col.id}_${u.id}` || (r.itemType === 'Other' && r.customItemName === col.name))
        );

        if (existingIdx === -1) {
          const newRec = {
            id: `rec_col_${col.id}_${u.id}`,
            itemType: 'Other',
            userId: u.id,
            userName: u.name,
            userMemberNo: u.memberNumber || 'BRC-MEMBER',
            amount: perMemberAmount,
            coveredMonth: col.name,
            customItemName: col.name,
            dueDate: todayStr,
            status: 'Pending',
            paymentMethod: 'GCash',
            notes: `Automated pending collection for ${col.name}`,
            updatedAt: todayStr,
          };
          recs.push(newRec);
          updated = true;
          authFetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRec),
          }).catch(err => console.warn('MongoDB auto collection sync error:', err));
        } else if (recs[existingIdx].status === 'Pending' && recs[existingIdx].amount !== perMemberAmount) {
          recs[existingIdx].amount = perMemberAmount;
          updated = true;
          authFetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recs[existingIdx]),
          }).catch(err => console.warn('MongoDB update collection sync error:', err));
        }
      });

      if (updated) {
        localStorage.setItem('bcc_finance_records_v3', JSON.stringify(recs));
      }
    } catch (err) {
      console.error('Error generating pending collection records:', err);
    }
  };

  const deletePendingCollectionRecords = (colId: string) => {
    try {
      const allCols = store.getDynamicCollections();
      const targetCol = allCols.find(c => c.id === colId);

      const recItem = localStorage.getItem('bcc_finance_records_v3');
      if (!recItem) return Promise.resolve();
      let recs: any[] = JSON.parse(recItem);
      const promises: Promise<any>[] = [];
      const filtered = recs.filter(r => {
        if (
          (r.status === 'Pending' || r.status === 'Overdue') &&
          (
            r.id.startsWith(`rec_col_${colId}_`) ||
            (targetCol?.name && (r.customItemName === targetCol.name || r.coveredMonth === targetCol.name))
          )
        ) {
          promises.push(authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {}));
          return false;
        }
        // Also remove direct donation entry if created from this collection
        if (r.id === `rec_donation_${colId}` || (r.itemType === 'Donation Collection' && targetCol?.name && r.customItemName === targetCol.name)) {
          promises.push(authFetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {}));
          return false;
        }
        return true;
      });
      localStorage.setItem('bcc_finance_records_v3', JSON.stringify(filtered));
      return Promise.all(promises);
    } catch (e) {
      console.error(e);
      return Promise.resolve();
    }
  };

  // Dynamic Collection Handlers
  const handleOpenCreateCollection = () => {
    setEditingCollection(null);
    setColType('Standard');
    setColName('');
    setColDonorName('');
    const count = approvedMembers.length;
    const initialAmount = 500;
    setColAmount(initialAmount);
    setColTargetAmount(count > 0 ? String(initialAmount * count) : '0');
    setColDescription('');
    setShowCollectionModal(true);
  };

  const handleOpenCreateDonation = () => {
    setEditingCollection(null);
    setColType('Donation');
    setColName('');
    setColDonorName('');
    setColAmount(1000);
    setColTargetAmount('');
    setColDescription('');
    setShowCollectionModal(true);
  };

  const handleOpenEditCollection = (col: DynamicCollection) => {
    setEditingCollection(col);
    const isDon = col.collectionType === 'Donation' || col.name?.toLowerCase().includes('donation');
    setColType(isDon ? 'Donation' : 'Standard');
    setColName(col.name);
    setColDonorName(col.donorName || '');
    setColAmount(col.amount);
    const count = approvedMembers.length;
    const target = col.targetAmount !== undefined && col.targetAmount !== null ? String(col.targetAmount) : (count > 0 ? String(col.amount * count) : '0');
    setColTargetAmount(target);
    setColDescription(col.description || '');
    setShowCollectionModal(true);
  };

  const handleSubmitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName.trim()) return;

    const isDonation = colType === 'Donation';
    const parsedTarget = !isDonation && colTargetAmount.trim() !== '' && !isNaN(Number(colTargetAmount)) ? Number(colTargetAmount) : undefined;

    await runWithLoader(
      async () => {
        let savedCol: DynamicCollection;
        if (editingCollection) {
          savedCol = store.updateDynamicCollection({
            ...editingCollection,
            name: colName.trim(),
            amount: Number(colAmount) || 0,
            targetAmount: isDonation ? undefined : parsedTarget,
            description: colDescription.trim(),
            collectionType: colType,
            donorName: isDonation ? (colDonorName.trim() || 'Club Donor / Voluntary Contributor') : undefined,
          });
        } else {
          savedCol = store.createDynamicCollection({
            name: colName.trim(),
            amount: Number(colAmount) || 0,
            targetAmount: isDonation ? undefined : parsedTarget,
            status: 'Active',
            description: colDescription.trim(),
            collectionType: colType,
            donorName: isDonation ? (colDonorName.trim() || 'Club Donor / Voluntary Contributor') : undefined,
          });
        }

        // If it's a Donation Collection, record it directly as Paid funds so it's added to Total Funds and Net Treasury (and NOT included in Pending collections)
        if (isDonation) {
          const todayStr = new Date().toISOString().split('T')[0];
          let recs: any[] = loadFromSession<any[]>('bcc_finance_records_v3', []);
          const donationRecId = `rec_donation_${savedCol.id}`;
          const existingIdx = recs.findIndex(r => r.id === donationRecId);

          const donationRecord = {
            id: donationRecId,
            itemType: 'Donation Collection',
            userId: 'usr_donation_pool',
            userName: colDonorName.trim() || 'Club Donor / Voluntary Contributor',
            userMemberNo: 'DONATION',
            amount: Number(colAmount) || 0,
            coveredMonth: savedCol.name,
            customItemName: savedCol.name,
            dueDate: todayStr,
            paidDate: todayStr,
            status: 'Paid',
            paymentMethod: 'Cash',
            notes: colDescription.trim() ? `Donation Collection: ${colDescription.trim()}` : `Voluntary Donation Collection for ${savedCol.name}`,
            updatedAt: todayStr,
          };

          if (existingIdx >= 0) {
            recs[existingIdx] = donationRecord;
          } else {
            recs.unshift(donationRecord);
          }
          saveToSession('bcc_finance_records_v3', recs);
          authFetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donationRecord),
          }).catch(err => console.warn('MongoDB donation financeLogs sync error:', err));
        } else {
          if (savedCol && approvedMembers.length > 0) {
            generatePendingCollectionRecords(savedCol);
          }
        }

        refreshFinanceData();
        setShowCollectionModal(false);
      },
      {
        message: editingCollection
          ? (isDonation ? 'Updating Donation Collection & Refreshing...' : 'Updating Collection & Refreshing...')
          : (isDonation ? 'Logging Donation Collection & Refreshing...' : 'Creating Collection & Refreshing...'),
      }
    );
  };

  // Execute Deletion
  const confirmDeleteAction = async () => {
    if (!deleteTarget) return;
    const targetType = deleteTarget.type === 'monthly_due' ? 'Monthly Due' : 'Collection';
    await runWithLoader(
      async () => {
        if (deleteTarget.type === 'monthly_due') {
          store.deleteMonthlyDue(deleteTarget.id);
          await deletePendingMonthlyDueRecords(deleteTarget.id);
        } else if (deleteTarget.type === 'dynamic_collection') {
          store.deleteDynamicCollection(deleteTarget.id);
          await deletePendingCollectionRecords(deleteTarget.id);
        }
        refreshFinanceData();
        setDeleteTarget(null);
      },
      {
        message: `Deleting ${targetType} & Refreshing...`,
      }
    );
  };

  const approvedMemberCount = approvedMembers.length;

  if (!isAdmin) {
    return (
      <div className="space-y-4 max-w-sm sm:max-w-md mx-auto pb-10">
        {/* MEMBER SETTINGS CARD */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#e2ece2] shadow-sm space-y-3.5 sm:space-y-4">
          <div className="pb-3 border-b border-[#e2ece2] flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-sm sm:text-base font-black text-[#1b4332] flex items-center gap-1.5">
                <SettingsIcon className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                <span className="truncate">Account & App Settings</span>
              </h2>
              <p className="text-[10.5px] sm:text-xs text-[#52605d] mt-0.5 leading-snug">
                Manage your member account session and app preferences
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#d8f3dc] text-[#1b4332] text-[10px] sm:text-[11px] font-extrabold shrink-0 border border-[#b7e4c7]">
              {currentUser?.role || 'Member'}
            </span>
          </div>

          {/* Member Profile Overview */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-[#52605d] block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider">
                Logged in as
              </span>
              <span className="font-heading font-black text-[#1b4332] text-xs sm:text-sm block truncate mt-0.5">
                {currentUser?.name}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[#52605d] block text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider">
                Username / Member ID
              </span>
              <span className="font-mono font-bold text-[#2d6a4f] text-[11px] sm:text-xs block truncate mt-0.5">
                @{currentUser?.username} {currentUser?.memberNumber ? `(#${currentUser.memberNumber})` : ''}
              </span>
            </div>
          </div>

          {/* 4-Digit Quick PIN Login */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <KeyRound className="w-4 h-4 text-[#74c69d]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-extrabold text-[#1b4332] text-xs sm:text-sm">
                      4-Digit Quick PIN Login
                    </h3>
                    {userPinCredential ? (
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active on Device
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-stone-200 text-stone-700 shrink-0">
                        Not Enrolled
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] sm:text-xs text-[#52605d] mt-0.5 leading-relaxed">
                    Set up a fast 4-digit PIN for instant access on devices without fingerprint hardware.
                  </p>
                </div>
              </div>
            </div>

            {pinSuccess && (
              <div className="p-2.5 bg-[#f0f9f1] border border-[#74c69d] rounded-xl flex items-center gap-2 text-[#1b4332] text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                <span>{pinSuccess}</span>
              </div>
            )}

            {pinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-[11px] font-semibold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPinSuccess(null);
                  setPinError(null);
                  setShowPinSetupModal(true);
                }}
                className="flex-1 py-2 px-3 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {userPinCredential
                    ? 'Change 4-Digit PIN'
                    : 'Set Up 4-Digit PIN'}
                </span>
              </button>
              {userPinCredential && (
                <button
                  type="button"
                  onClick={handleRemovePin}
                  disabled={isRemovingPin}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isRemovingPin ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          </div>

          {/* Biometric Authentication (Fingerprint / Face ID) */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Fingerprint className="w-4 h-4 text-[#74c69d]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-extrabold text-[#1b4332] text-xs sm:text-sm">
                      Biometric Login
                    </h3>
                    {userBioCredential ? (
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active on Device
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-stone-200 text-stone-700 shrink-0">
                        Not Enrolled
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] sm:text-xs text-[#52605d] mt-0.5 leading-relaxed">
                    Sign in with your fingerprint (Android) or Touch ID / Face ID (iOS) on mobile.
                  </p>
                </div>
              </div>
            </div>

            {bioSuccess && (
              <div className="p-2.5 bg-[#f0f9f1] border border-[#74c69d] rounded-xl flex items-center gap-2 text-[#1b4332] text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                <span>{bioSuccess}</span>
              </div>
            )}

            {bioError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-[11px] font-semibold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{bioError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleRegisterBiometrics}
                disabled={isEnrollingBio}
                className="flex-1 py-2 px-3 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>
                  {isEnrollingBio
                    ? 'Scanning Fingerprint...'
                    : userBioCredential
                    ? 'Update Fingerprint / Face ID'
                    : 'Set Up Fingerprint / Face ID'}
                </span>
              </button>
              {userBioCredential && (
                <button
                  type="button"
                  onClick={handleRemoveBiometrics}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Account Session / Sign Out Card */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-50/70 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                <h3 className="font-heading font-extrabold text-rose-950 text-xs sm:text-sm">
                  Account Session
                </h3>
              </div>
              <p className="text-[10.5px] sm:text-xs text-[#52605d] leading-relaxed">
                Sign out of your account session safely when you are done.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="w-full sm:w-auto px-3.5 py-2 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] sm:text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.98]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Account</span>
            </button>
          </div>
        </div>

        {/* SIGN OUT CONFIRMATION MODAL FOR MEMBER */}
        <AnimatePresence>
          {showLogoutModal && (
            <ModalPortal>
              <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3.5 sm:p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full text-center space-y-4 border border-[#e2ece2] shadow-2xl relative"
                >
                  <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                    <LogOut className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-heading text-base font-extrabold text-[#1b4332]">
                      Sign Out of Account?
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed">
                      Are you sure you want to sign out of your account? You will need to log in again to access the BCC Riders Club app.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e2ece2]">
                    <button
                      type="button"
                      onClick={() => setShowLogoutModal(false)}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-extrabold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogoutModal(false);
                        logout();
                      }}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            </ModalPortal>
          )}
        </AnimatePresence>
        {/* 4-Digit PIN Setup / Update Modal for Member */}
        {currentUser && (
          <PinSetupModal
            isOpen={showPinSetupModal}
            onClose={() => setShowPinSetupModal(false)}
            currentUser={{
              id: currentUser.id,
              username: currentUser.username,
              name: currentUser.name || currentUser.username,
              avatar: currentUser.avatar,
            }}
            hasExistingPin={Boolean(userPinCredential)}
            onSuccess={(msg) => {
              setPinSuccess(msg);
              setPinError(null);
              const pinCred = getDevicePinForUser(currentUser.id) || getDevicePinForUser(currentUser.username);
              setUserPinCredential(pinCred);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Interactive Sub-Navigation Dropdown */}
      <div className="relative max-w-sm w-full" ref={subTabDropdownRef}>
        <button
          type="button"
          onClick={() => setIsSubTabDropdownOpen((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] shadow-xs text-left transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]/20"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#1b4332] text-white shrink-0 shadow-xs">
              {activeSubTab === 'push_notifications' && <Bell className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'storage' && <HardDrive className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'finance' && <Wallet className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'reports' && <FileSpreadsheet className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'security' && <Shield className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'inbound' && <Mail className="w-4 h-4 text-[#74c69d]" />}
            </div>
            <div className="truncate">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#52605d]">Settings Category</p>
              <p className="text-sm font-extrabold text-[#1b4332] truncate">
                {SUB_TAB_OPTIONS.find((t) => t.id === activeSubTab)?.label}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
              isSubTabDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <AnimatePresence>
          {isSubTabDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 4, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-30 p-1.5 bg-white rounded-2xl border border-[#e2ece2] shadow-xl space-y-1 mt-1 overflow-hidden"
            >
              {SUB_TAB_OPTIONS.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(tab.id as 'push_notifications' | 'finance' | 'reports' | 'security' | 'inbound');
                      setIsSubTabDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#1b4332] text-white shadow-xs'
                        : 'hover:bg-[#f0f7f2] text-[#1b4332]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected ? 'bg-white/10 text-white' : 'bg-[#e8f5e9] text-[#1b4332]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-[#74c69d]' : 'text-[#2d6a4f]'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#1b4332]'}`}>
                          {tab.label}
                        </p>
                        <p
                          className={`text-[10px] truncate ${
                            isSelected ? 'text-[#d8f3dc]' : 'text-[#52605d]'
                          }`}
                        >
                          {tab.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#74c69d] shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SUB TAB 1: FINANCE SETTINGS */}
      {activeSubTab === 'finance' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Section 1: Standard Fee Configuration */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-sm sm:text-base font-black text-[#1b4332] flex items-center gap-2">
                  <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f] shrink-0" />
                  <span>Fee Rates</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                  Set baseline member registration fee
                </p>
              </div>

              {feeSavedToast && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Fee saved!</span>
                </motion.div>
              )}
            </div>

            <form onSubmit={handleSaveFees} className="space-y-3 max-w-md w-full">
              <div className="space-y-1.5 bg-[#f7f9f7] p-3 sm:p-4 rounded-2xl border border-[#e2ece2]">
                <label className="text-xs font-bold text-[#1b4332] block">
                  Membership Fee (₱)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={membershipFeeInput}
                    onChange={(e) => setMembershipFeeInput(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-sm font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                  />
                  <span className="absolute left-3 top-2 text-xs font-bold text-[#52605d]">₱</span>
                </div>
                <span className="text-[10.5px] text-[#52605d] block">One-time registration fee for new members</span>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Fee</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Monthly Dues Management */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-sm sm:text-base font-black text-[#1b4332] flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f] shrink-0" />
                  <span>Monthly Dues</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                  Configure monthly due schedules and amounts
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateDue}
                disabled={approvedMemberCount === 0}
                title={approvedMemberCount === 0 ? "Requires at least 1 registered active member" : "Create a new monthly due"}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shrink-0 ${
                  approvedMemberCount === 0
                    ? 'bg-[#e8efe8] text-[#86998d] border border-[#d2ddd2] cursor-not-allowed select-none shadow-none'
                    : 'bg-[#1b4332] hover:bg-[#2d6a4f] text-white shadow-md cursor-pointer hover:scale-[1.02]'
                }`}
              >
                <Plus className={`w-4 h-4 ${approvedMemberCount === 0 ? 'text-[#86998d]' : 'text-[#74c69d]'}`} />
                <span>+ Add Due</span>
              </button>
            </div>

            {/* Monthly Dues Grid / List */}
            <div className="space-y-3">
              {monthlyDues.length === 0 ? (
                <div className="p-6 text-center bg-[#f7f9f7] rounded-2xl border border-dashed border-[#e2ece2] space-y-1.5">
                  <Receipt className="w-7 h-7 text-[#52605d] mx-auto" />
                  <p className="text-xs text-[#52605d] font-bold">No Monthly Dues Configured</p>
                  <p className="text-[11px] text-[#52605d]">
                    Click "+ Add Due" to configure a due amount for a specific month and year.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {monthlyDues.map((due) => {
                    const totalPendingCollection = approvedMemberCount * due.amount;
                    return (
                      <div
                        key={due.id}
                        className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#e2ece2] shadow-xs hover:border-[#2d6a4f] transition-all space-y-3 relative overflow-hidden"
                      >
                        {/* Header: Period & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#d8f3dc] text-[#1b4332] text-[10px] font-extrabold mb-1">
                              <Calendar className="w-3 h-3 text-[#2d6a4f]" />
                              {due.month} {due.year}
                            </span>
                            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm leading-tight truncate">
                              {due.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDue(due)}
                              className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                              title="Edit Monthly Due"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'monthly_due',
                                  id: due.id,
                                  name: due.title,
                                厚: 'monthly_due',
                                })
                              }
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                              title="Delete Monthly Due"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Calculated Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#e2ece2] text-xs">
                          <div className="bg-[#f7f9f7] p-2 sm:p-2.5 rounded-xl border border-[#e2ece2] min-w-0">
                            <span className="text-[9.5px] sm:text-[10px] text-[#52605d] font-bold block truncate">
                              Due Amount
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{(Number(due.amount) || 0).toLocaleString()}
                            </span>
                          </div>

                          <div className="bg-[#e8f5e9] p-2 sm:p-2.5 rounded-xl border border-[#c8e6c9] min-w-0">
                            <span className="text-[9.5px] sm:text-[10px] text-[#2d6a4f] font-extrabold block truncate">
                              Target Total
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{(Number(totalPendingCollection) || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {due.notes && (
                          <p className="text-[10.5px] text-[#52605d] italic bg-[#f7f9f7] p-2 rounded-lg border border-[#e2ece2] truncate">
                            "{due.notes}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Promotional Campaigns & Special Packages Section */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2.5 pb-3 border-b border-[#e2ece2]">
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-sm sm:text-base font-black text-[#1b4332] flex items-center gap-1.5 sm:gap-2 truncate">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
                  <span className="truncate">Annual Promo</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5 truncate sm:whitespace-normal">
                  12-mo upfront dues discount
                </p>
              </div>

              {/* Annual Promo Global Toggle Switch */}
              <div className="flex items-center gap-2 shrink-0 bg-[#f7f9f7] px-2.5 py-1.5 rounded-xl sm:rounded-2xl border border-[#e2ece2]">
                <div className="text-right hidden xs:block sm:block">
                  <span className={`text-[10px] sm:text-xs font-extrabold block leading-none ${financeSettings.annualPromoEnabled !== false ? 'text-emerald-700' : 'text-stone-500'}`}>
                    {financeSettings.annualPromoEnabled !== false ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAnnualPromo}
                  role="switch"
                  aria-checked={financeSettings.annualPromoEnabled !== false}
                  className={`w-10 sm:w-11 h-5.5 sm:h-6 flex items-center rounded-full p-0.5 sm:p-1 transition-colors duration-200 cursor-pointer ${
                    financeSettings.annualPromoEnabled !== false ? 'bg-[#1b4332]' : 'bg-stone-300'
                  }`}
                  title={financeSettings.annualPromoEnabled !== false ? 'Disable Annual Promo' : 'Enable Annual Promo'}
                >
                  <motion.div
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`bg-white w-4.5 h-4.5 sm:w-4 sm:h-4 rounded-full shadow-md ${
                      financeSettings.annualPromoEnabled !== false ? 'ml-auto' : 'mr-auto'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className={`p-3 sm:p-4 rounded-2xl border space-y-2.5 transition-colors ${
              financeSettings.annualPromoEnabled !== false
                ? 'bg-gradient-to-br from-[#f7f9f7] via-emerald-50/60 to-[#f7f9f7] border-emerald-200/80'
                : 'bg-stone-50 border-stone-200 opacity-75'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${
                    financeSettings.annualPromoEnabled !== false
                      ? 'bg-amber-400 text-slate-950 shadow-2xs'
                      : 'bg-stone-200 text-stone-600'
                  }`}>
                    Upfront Package
                  </span>
                  <span className="text-xs font-bold text-[#1b4332] hidden sm:inline">12-Month Dues</span>
                </div>
                <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                  financeSettings.annualPromoEnabled !== false
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-stone-200 text-stone-700 border-stone-300'
                }`}>
                  {financeSettings.annualPromoEnabled !== false ? '🟢 Active' : '⚪ Disabled'}
                </span>
              </div>

              <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed">
                {financeSettings.annualPromoEnabled !== false ? (
                  <>
                    Members pay <strong>₱1,000</strong> for 12 mos (save <strong>₱200 / 16.7%</strong>).
                  </>
                ) : (
                  <>
                    Annual promo is currently <strong>disabled</strong>. Switch toggle to activate.
                  </>
                )}
              </p>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1">
                <div className="bg-white p-2 sm:p-3 rounded-xl border border-[#e2ece2] flex flex-col justify-center min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-[#52605d] font-bold block uppercase tracking-wider truncate">Promo</span>
                  <div className="flex items-baseline gap-0.5 sm:gap-1 mt-0.5 truncate">
                    <span className={`text-xs sm:text-base font-black truncate ${financeSettings.annualPromoEnabled !== false ? 'text-[#1b4332]' : 'text-stone-500'}`}>
                      ₱1,000
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-[#52605d] font-semibold">/yr</span>
                  </div>
                </div>
                <div className="bg-white p-2 sm:p-3 rounded-xl border border-[#e2ece2] flex flex-col justify-center min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-[#52605d] font-bold block uppercase tracking-wider truncate">Regular</span>
                  <div className="flex items-baseline gap-0.5 sm:gap-1 mt-0.5 truncate">
                    <span className="text-xs sm:text-base font-black text-slate-400 line-through truncate">₱1,200</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold">/yr</span>
                  </div>
                </div>
                <div className={`p-2 sm:p-3 rounded-xl border flex flex-col justify-center min-w-0 ${
                  financeSettings.annualPromoEnabled !== false
                    ? 'bg-emerald-100/80 border-emerald-200'
                    : 'bg-stone-100 border-stone-200'
                }`}>
                  <span className={`text-[9px] sm:text-[10px] font-extrabold block uppercase tracking-wider truncate ${
                    financeSettings.annualPromoEnabled !== false ? 'text-emerald-800' : 'text-stone-600'
                  }`}>
                    Savings
                  </span>
                  <div className="flex items-baseline gap-0.5 sm:gap-1 mt-0.5 truncate">
                    <span className={`text-xs sm:text-base font-black truncate ${
                      financeSettings.annualPromoEnabled !== false ? 'text-emerald-900' : 'text-stone-700'
                    }`}>
                      ₱200
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] font-extrabold hidden sm:inline ${
                      financeSettings.annualPromoEnabled !== false ? 'text-emerald-700' : 'text-stone-500'
                    }`}>
                      (16.7%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Collections & Donations Management */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-sm sm:text-base font-black text-[#1b4332] flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f] shrink-0" />
                  <span>Collections & Donations</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                  Manage custom drives, merchandise fees, or voluntary donations
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                <button
                  type="button"
                  onClick={handleOpenCreateDonation}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 bg-emerald-700 hover:bg-emerald-800 text-white shadow-md cursor-pointer hover:scale-[1.02]"
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                  <span className="truncate">+ Donation</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCreateCollection}
                  disabled={approvedMemberCount === 0}
                  title={approvedMemberCount === 0 ? "Requires at least 1 registered active member" : "Create a new custom assessment collection"}
                  className={`w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                    approvedMemberCount === 0
                      ? 'bg-[#e8efe8] text-[#86998d] border border-[#d2ddd2] cursor-not-allowed select-none shadow-none'
                      : 'bg-[#1b4332] hover:bg-[#2d6a4f] text-white shadow-md cursor-pointer hover:scale-[1.02]'
                  }`}
                >
                  <Plus className={`w-3.5 h-3.5 ${approvedMemberCount === 0 ? 'text-[#86998d]' : 'text-[#74c69d]'}`} />
                  <span className="truncate">+ Collection</span>
                </button>
              </div>
            </div>

            {/* Collections Grid */}
            <div className="space-y-3">
              {dynamicCollections.length === 0 ? (
                <div className="p-6 text-center bg-[#f7f9f7] rounded-2xl border border-dashed border-[#e2ece2] space-y-1.5">
                  <Layers className="w-7 h-7 text-[#52605d] mx-auto" />
                  <p className="text-xs text-[#52605d] font-bold">No Collections or Donations Created</p>
                  <p className="text-[11px] text-[#52605d]">
                    Add dynamic collections for merchandise, tours, or direct donation funds.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dynamicCollections.map((col) => {
                    const isDonation = col.collectionType === 'Donation' || col.name?.toLowerCase().includes('donation');
                    const totalTargetCollection =
                      col.targetAmount !== undefined && col.targetAmount !== null && !isNaN(Number(col.targetAmount)) && Number(col.targetAmount) > 0
                        ? Number(col.targetAmount)
                        : approvedMemberCount * col.amount;
                    return (
                      <div
                        key={col.id}
                        className={`bg-white rounded-2xl p-3.5 sm:p-4 border shadow-xs hover:border-[#2d6a4f] transition-all space-y-3 relative overflow-hidden ${
                          isDonation ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-[#e2ece2]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {isDonation ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold mb-1">
                                <HeartHandshake className="w-3 h-3 text-emerald-700" />
                                Donation
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold mb-1">
                                <Receipt className="w-3 h-3 text-amber-700" />
                                Custom Drive
                              </span>
                            )}
                            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm leading-tight truncate">
                              {col.name}
                            </h3>
                            {isDonation && col.donorName && (
                              <p className="text-[11px] text-emerald-800 font-semibold mt-0.5 truncate">
                                Donor: {col.donorName}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCollection(col)}
                              className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                              title="Edit Collection"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'dynamic_collection',
                                  id: col.id,
                                  name: col.name,
                                })
                              }
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                              title="Delete Collection"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {col.description && (
                          <p className="text-xs text-[#52605d] leading-relaxed line-clamp-2">
                            {col.description}
                          </p>
                        )}

                        {isDonation ? (
                          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-emerald-100 text-xs">
                            <div className="bg-emerald-50/70 p-2 sm:p-2.5 rounded-xl border border-emerald-200 min-w-0">
                              <span className="text-[9.5px] sm:text-[10px] text-emerald-800 font-bold block truncate">
                                Donation Amount
                              </span>
                              <span className="text-sm sm:text-base font-black text-emerald-900 truncate block">
                                ₱{(Number(col.amount) || 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-emerald-200 min-w-0 flex flex-col justify-center">
                              <span className="text-[9.5px] sm:text-[10px] text-emerald-800 font-extrabold block truncate">
                                Status
                              </span>
                              <span className="text-[10.5px] font-bold text-emerald-700 truncate block mt-0.5">
                                In Net Treasury
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#e2ece2] text-xs">
                            <div className="bg-[#f7f9f7] p-2 sm:p-2.5 rounded-xl border border-[#e2ece2] min-w-0">
                              <span className="text-[9.5px] sm:text-[10px] text-[#52605d] font-bold block truncate">
                                Per-Member Fee
                              </span>
                              <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                                ₱{(Number(col.amount) || 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="bg-amber-50 p-2 sm:p-2.5 rounded-xl border border-amber-200 min-w-0">
                              <span className="text-[9.5px] sm:text-[10px] text-amber-800 font-extrabold block truncate">
                                Target Goal
                              </span>
                              <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                                ₱{(Number(totalTargetCollection) || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: REPORTS & EXPORT CENTER */}
      {activeSubTab === 'reports' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Header & Controls Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-sm sm:text-base md:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#2d6a4f]" />
                  <span>Reports & Export</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                  Export member directories, transaction ledgers, and financial reports
                </p>
              </div>

              <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={loadReportsData}
                  className="px-2 sm:px-3 py-1.5 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span className="truncate">Sync</span>
                </button>

                {/* Year Filter Dropdown */}
                <div className="relative" ref={yearDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsYearDropdownOpen(!isYearDropdownOpen);
                      setIsMonthDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-1 bg-[#f7f9f7] hover:bg-[#e8f5e9] px-2 sm:px-3 py-1.5 rounded-xl border border-[#e2ece2] text-[11px] sm:text-xs font-bold transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <Filter className="w-3 h-3 text-[#2d6a4f] shrink-0" />
                      <span className="text-[10px] sm:text-[11px] font-bold text-[#52605d]">
                        <span className="sm:hidden">Yr:</span>
                        <span className="hidden sm:inline">Year:</span>
                      </span>
                      <span className="font-extrabold text-[#1b4332] truncate">
                        {reportYearFilter === 'All' ? 'All' : reportYearFilter}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-3 h-3 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
                        isYearDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isYearDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-1.5 w-32 bg-white border border-[#e2ece2] rounded-2xl shadow-xl z-50 overflow-hidden py-1"
                      >
                        {[
                          { value: 'All', label: 'All Time' },
                          ...availableYears.map((yr) => ({ value: yr, label: yr })),
                        ].map((opt) => {
                          const isSelected = reportYearFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setReportYearFilter(opt.value);
                                setIsYearDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#e8f5e9] text-[#1b4332] font-black'
                                  : 'text-[#52605d] hover:bg-[#f7f9f7] hover:text-[#1b4332]'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#2d6a4f]" />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Month Filter Dropdown */}
                <div className="relative" ref={monthDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMonthDropdownOpen(!isMonthDropdownOpen);
                      setIsYearDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-1 bg-[#f7f9f7] hover:bg-[#e8f5e9] px-2 sm:px-3 py-1.5 rounded-xl border border-[#e2ece2] text-[11px] sm:text-xs font-bold transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <Calendar className="w-3 h-3 text-[#2d6a4f] shrink-0" />
                      <span className="text-[10px] sm:text-[11px] font-bold text-[#52605d]">
                        <span className="sm:hidden">Mo:</span>
                        <span className="hidden sm:inline">Month:</span>
                      </span>
                      <span className="font-extrabold text-[#1b4332] truncate">
                        {REPORT_MONTH_OPTIONS.find((m) => m.value === reportMonthFilter)?.short || 'All'}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-3 h-3 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
                        isMonthDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isMonthDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 sm:left-0 mt-1.5 w-36 max-h-56 overflow-y-auto bg-white border border-[#e2ece2] rounded-2xl shadow-xl z-50 py-1"
                      >
                        {REPORT_MONTH_OPTIONS.map((opt) => {
                          const isSelected = reportMonthFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setReportMonthFilter(opt.value);
                                setIsMonthDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#e8f5e9] text-[#1b4332] font-black'
                                  : 'text-[#52605d] hover:bg-[#f7f9f7] hover:text-[#1b4332]'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#2d6a4f]" />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const stmtData = getFinancialStatementReportData();
                    downloadXLSXFile(
                      `BRC_Financial_Report_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                      stmtData.headers,
                      stmtData.rows,
                      'Financial Statement'
                    );
                  }}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-[11px] sm:text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.02]"
                  title="Export Financial Statement (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="sm:hidden">XLSX</span>
                  <span className="hidden sm:inline">Statement (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Quick Accounting Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-[#f7f9f7] p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-[#e2ece2] min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 truncate">
                  <Users className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-bold uppercase text-[#52605d] truncate">Members</span>
                </div>
                <span className="text-xs sm:text-base font-black text-[#1b4332] block truncate">
                  {reportUsers.filter((u) => u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin')).length}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block truncate">Active roster</span>
              </div>

              <div className="bg-emerald-50/70 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-200 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 truncate">
                  <Wallet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-emerald-900 truncate">Income</span>
                </div>
                <span className="text-xs sm:text-base font-black text-emerald-950 block truncate">
                  ₱
                  {reportPayments
                    .filter((p) =>
                      p.status === 'Paid' &&
                      (!p.notes?.includes('Satisfied by Annual Upfront Promo Package') || p.itemType !== 'Monthly Due') &&
                      isRecordInPeriod([p.paidDate, p.createdAt, p.coveredMonth, p.dueDate], reportYearFilter, reportMonthFilter)
                    )
                    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-emerald-800 block truncate">
                  {reportMonthFilter === 'All' && reportYearFilter === 'All' ? 'Collections' : 'Period Inflow'}
                </span>
              </div>

              <div className="bg-rose-50/70 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-200 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 truncate">
                  <TrendingUp className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-rose-900 truncate">Expenses</span>
                </div>
                <span className="text-xs sm:text-base font-black text-rose-950 block truncate">
                  ₱
                  {reportExpenses
                    .filter((e) => isRecordInPeriod([e.date, e.createdAt], reportYearFilter, reportMonthFilter))
                    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-rose-800 block truncate">
                  {reportMonthFilter === 'All' && reportYearFilter === 'All' ? 'Disbursed' : 'Period Outflow'}
                </span>
              </div>

              <div className="bg-amber-50/70 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-amber-200 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 truncate">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-amber-900 truncate">Net Balance</span>
                </div>
                <span className="text-xs sm:text-base font-black text-amber-950 block truncate">
                  ₱
                  {(
                    reportPayments
                      .filter((p) =>
                        p.status === 'Paid' &&
                        (!p.notes?.includes('Satisfied by Annual Upfront Promo Package') || p.itemType !== 'Monthly Due') &&
                        isRecordInPeriod([p.paidDate, p.createdAt, p.coveredMonth, p.dueDate], reportYearFilter, reportMonthFilter)
                      )
                      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0) -
                    reportExpenses
                      .filter((e) => isRecordInPeriod([e.date, e.createdAt], reportYearFilter, reportMonthFilter))
                      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-amber-800 block truncate">Net Flow</span>
              </div>
            </div>
          </div>


          {/* Export Report Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Card 1: Members Directory XLSX */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs space-y-3 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4 text-emerald-700" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-emerald-100 text-emerald-900 uppercase">
                    Members
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#1b4332]">
                  Members Directory
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export approved member profiles, contact numbers, chapters, and motorcycle details.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {reportUsers.filter((u) => u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin')).length} Members
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMembersReportData();
                      setPreviewModal({
                        title: 'Members Directory Preview',
                        subtitle: 'Active member records',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadXLSXFile(`BRC_Active_Members_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Members Directory'),
                      });
                    }}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMembersReportData();
                      downloadXLSXFile(`BRC_Active_Members_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Members Directory');
                    }}
                    className="px-3 py-1.5 sm:py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.xlsx</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Transaction Data & Collections Register XLSX */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs space-y-3 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                    <Wallet className="w-4 h-4 text-blue-700" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-blue-100 text-blue-900 uppercase">
                    Transactions
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#1b4332]">
                  Transaction Ledger
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export receipt records for dues, annual promos, and custom project collections.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {
                    reportPayments.filter((p) =>
                      isRecordInPeriod([p.paidDate, p.createdAt, p.coveredMonth, p.dueDate], reportYearFilter, reportMonthFilter)
                    ).length
                  } Transactions
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getTransactionsReportData();
                      setPreviewModal({
                        title: 'Transaction Ledger Preview',
                        subtitle: 'Collections and receipts log',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadXLSXFile(`BRC_Transactions_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Transactions'),
                      });
                    }}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getTransactionsReportData();
                      downloadXLSXFile(`BRC_Transactions_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Transactions');
                    }}
                    className="px-3 py-1.5 sm:py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.xlsx</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Disbursements & Expenses Register XLSX */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs space-y-3 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4 text-rose-700" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-rose-100 text-rose-900 uppercase">
                    Expenses
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#1b4332]">
                  Disbursements Register
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export liquidation records of all disbursements, rides, outreach, and operational costs.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {
                    reportExpenses.filter((e) =>
                      isRecordInPeriod([e.date, e.createdAt], reportYearFilter, reportMonthFilter)
                    ).length
                  } Expenses
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getExpensesReportData();
                      setPreviewModal({
                        title: 'Disbursements Register Preview',
                        subtitle: 'Liquidation and expense records',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadXLSXFile(`BRC_Expenses_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Disbursements'),
                      });
                    }}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getExpensesReportData();
                      downloadXLSXFile(`BRC_Expenses_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Disbursements');
                    }}
                    className="px-3 py-1.5 sm:py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.xlsx</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: Accounting Financial Statement XLSX & PDF */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs space-y-3 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                    <BarChart3 className="w-4 h-4 text-purple-700" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-purple-100 text-purple-900 uppercase">
                    Accounting
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#1b4332]">
                  Financial Statement
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export complete accounting statements with revenue, category breakdowns, and net surplus.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  Accounting Report
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getFinancialStatementReportData();
                      setPreviewModal({
                        title: 'Financial Statement Preview',
                        subtitle: 'Revenue, expenses, and net surplus summary',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadXLSXFile(`BRC_Financial_Statement_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Financial Statement'),
                        onPdfDownload: exportFinancialStatementPDF,
                      });
                    }}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getFinancialStatementReportData();
                      downloadXLSXFile(`BRC_Financial_Statement_${getReportPeriodSlug()}_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Financial Statement');
                    }}
                    className="px-3 py-1.5 sm:py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.xlsx</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportFinancialStatementPDF}
                    className="p-1.5 sm:p-2 rounded-xl bg-purple-900 hover:bg-purple-950 text-white text-xs font-black shadow-xs cursor-pointer"
                    title="Export PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 5: Member Dues Compliance & Aging Ledger XLSX */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs space-y-3 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-teal-100 text-teal-900 uppercase">
                    Compliance
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#1b4332]">
                  Dues Compliance
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export per-member dues paid, annual promo status, unpaid months, and balances.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {reportUsers.filter((u) => u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin')).length} Records
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMemberComplianceReportData();
                      setPreviewModal({
                        title: 'Dues Compliance Preview',
                        subtitle: 'Member compliance and dues status',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadXLSXFile(`BRC_Member_Compliance_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Dues Compliance'),
                      });
                    }}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMemberComplianceReportData();
                      downloadXLSXFile(`BRC_Member_Compliance_${new Date().toISOString().slice(0, 10)}.xlsx`, data.headers, data.rows, 'Dues Compliance');
                    }}
                    className="px-3 py-1.5 sm:py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.xlsx</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 6: Dynamic Custom Collections Ledger XLSX */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs space-y-3 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Layers className="w-4 h-4 text-amber-700" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-black bg-amber-100 text-amber-900 uppercase">
                    Drives
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#1b4332]">
                  Custom Drives Ledger
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export progress ledgers for special drives with target goals and collected totals.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {dynamicCollections.length} Drives
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const headers = [
                        'Collection ID',
                        'Collection Name',
                        'Per-Member Amount (PHP)',
                        'Status',
                      ];
                      const rows = dynamicCollections.map((c) => [c.id, c.name, c.amount, c.status]);
                      setPreviewModal({
                        title: 'Custom Drives Preview',
                        subtitle: 'Overview of collection items',
                        headers,
                        rows,
                        onDownload: () => downloadXLSXFile(`BRC_Dynamic_Collections_${new Date().toISOString().slice(0, 10)}.xlsx`, headers, rows, 'Custom Drives'),
                      });
                    }}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const headers = [
                        'Collection ID',
                        'Collection Name',
                        'Per-Member Amount (PHP)',
                        'Status',
                      ];
                      const rows = dynamicCollections.map((c) => [c.id, c.name, c.amount, c.status]);
                      downloadXLSXFile(`BRC_Dynamic_Collections_${new Date().toISOString().slice(0, 10)}.xlsx`, headers, rows, 'Custom Drives');
                    }}
                    className="px-3 py-1.5 sm:py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.xlsx</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Yearly Financial Archiving & Audit */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-sm sm:text-base font-black text-[#1b4332] flex items-center gap-2">
                  <Archive className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                  <span>Yearly Archiving</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5 leading-snug">
                  Audit and archive annual finances into .zip packages, or import previous archives.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setShowYearlyArchiveModal(true)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                  title="Audit & Archive Financial Year"
                >
                  <Archive className="w-3.5 h-3.5 text-[#74c69d] shrink-0" />
                  <span className="truncate">Archive Year</span>
                </button>

                <button
                  type="button"
                  onClick={() => zipInputRef.current?.click()}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 bg-[#d8f3dc] hover:bg-[#b7e4c7] text-[#1b4332] border border-[#b7e4c7] rounded-xl text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                  title="Import .zip Archive Package"
                >
                  <Upload className="w-3.5 h-3.5 text-[#1b4332] shrink-0" />
                  <span className="truncate">Import .zip</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
              <div className="bg-[#f7f9f7] p-2.5 sm:p-3.5 rounded-xl border border-[#e2ece2] space-y-0.5">
                <span className="font-bold text-[#1b4332] text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  Remaining Funds Handling
                </span>
                <p className="text-[#52605d] text-[10.5px] sm:text-[11px] leading-relaxed">
                  Record remaining funds manually as a payment note (e.g. 2021 Year-End Carryover).
                </p>
              </div>

              <div className="bg-[#f7f9f7] p-2.5 sm:p-3.5 rounded-xl border border-[#e2ece2] space-y-0.5">
                <span className="font-bold text-[#1b4332] text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  Archive Import & Export
                </span>
                <p className="text-[#52605d] text-[10.5px] sm:text-[11px] leading-relaxed">
                  Import .zip packages to inspect records and export Excel / PDF statements.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Delete a Year's Transactions */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-rose-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-rose-100">
              <div>
                <h2 className="font-heading text-sm sm:text-base font-black text-rose-900 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Delete Year Transactions</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5 leading-snug">
                  Permanently purge records for a fiscal year.
                </p>
              </div>

              {deleteYearToast && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>{deleteYearToast}</span>
                </motion.div>
              )}
            </div>

            <div className="bg-rose-50/50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-200/60 space-y-2.5">
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-bold text-[#1b4332] block">
                  Fiscal Year
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={deleteYearInput}
                      onChange={(e) => {
                        const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setDeleteYearInput(numericOnly);
                      }}
                      placeholder="e.g. 2024"
                      className={`w-full pl-8.5 pr-2.5 py-2 rounded-xl bg-white border text-xs sm:text-sm font-extrabold text-[#1b4332] focus:outline-hidden placeholder:font-normal placeholder:text-stone-400 transition-colors ${
                        isNoYearMatched
                          ? 'border-rose-300 ring-1 ring-rose-200'
                          : isYearMatched
                          ? 'border-emerald-400 ring-1 ring-emerald-200'
                          : 'border-[#e2ece2] focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      }`}
                    />
                    <Calendar className={`w-3.5 h-3.5 absolute left-2.5 top-3 pointer-events-none ${
                      isNoYearMatched ? 'text-rose-500' : isYearMatched ? 'text-emerald-600' : 'text-stone-400'
                    }`} />
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenDeleteYearModal}
                    disabled={!isYearMatched || isDeletingYear}
                    className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                      isYearMatched && !isDeletingYear
                        ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs active:scale-95'
                        : 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200/80 opacity-70 select-none'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{isYearMatched ? `Delete FY ${deleteYearInput}` : 'Delete Year'}</span>
                  </button>
                </div>
              </div>

              {deleteYearInput.length === 4 && isYearMatched && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-100/70 border border-emerald-200 text-emerald-900 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>FY {deleteYearInput} Matched</span>
                  </span>
                  <span className="text-[10px] text-emerald-800 font-semibold shrink-0">
                    {matchedYearRecords.length} recs, {matchedYearExpenses.length} exp
                  </span>
                </div>
              )}

              {deleteYearInput.length === 4 && isNoYearMatched && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-100/80 border border-rose-200 text-rose-800 text-[11px] font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>No Year is matched</span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Report Data Preview Modal */}
          <AnimatePresence>
            {previewModal && (
              <ModalPortal>
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-md overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col border border-[#e2ece2] shadow-2xl overflow-hidden my-auto"
                  >
                    {/* Modal Header */}
                    <div className="p-4 sm:p-6 bg-[#f7f9f7] border-b border-[#e2ece2] flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-heading font-black text-base sm:text-lg text-[#1b4332] flex items-center gap-2">
                          <Table className="w-5 h-5 text-[#2d6a4f]" />
                          {previewModal.title}
                        </h3>
                        <p className="text-xs text-[#52605d] mt-0.5">{previewModal.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewModal(null)}
                        className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Scrollable Table Body */}
                    <div className="p-4 sm:p-6 overflow-auto flex-1">
                      {previewModal.rows.length === 0 ? (
                        <div className="text-center py-12 text-xs text-[#52605d] font-bold">
                          No records found for the selected period filter.
                        </div>
                      ) : (
                        <div
                          ref={modalScrollRef}
                          onMouseDown={handleModalMouseDown}
                          onMouseLeave={handleModalMouseLeaveOrUp}
                          onMouseUp={handleModalMouseLeaveOrUp}
                          onMouseMove={handleModalMouseMove}
                          className={`border border-[#e2ece2] rounded-2xl overflow-x-auto shadow-xs select-none touch-pan-x ${
                            isDraggingModal ? 'cursor-grabbing' : 'cursor-grab'
                          }`}
                        >
                            <table className="w-full text-left text-xs min-w-max">
                              <thead className="bg-[#1b4332] text-white font-extrabold uppercase text-[10px] tracking-wider">
                                <tr>
                                  {previewModal.headers.map((h, i) => (
                                    <th key={i} className="px-3.5 py-2.5 whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#e2ece2] bg-white font-medium text-[#1b4332]">
                                {previewModal.rows.slice(0, 100).map((row, rIdx) => {
                                  const firstCell = String(row[0] || '').trim();
                                  if (firstCell.startsWith('---') || firstCell.startsWith('===')) {
                                    return null;
                                  }
                                  const isHeaderRow = ['FUNDS', 'EXPENSES', 'SUPPLEMENTARY ACCOUNTS', 'BCC RIDERS CLUB - FINANCIAL STATEMENT'].includes(firstCell);
                                  const isTotalRow = firstCell.startsWith('Total') || firstCell.startsWith('NET INCOME');

                                  return (
                                    <tr
                                      key={rIdx}
                                      className={`hover:bg-[#f7f9f7] transition-colors ${
                                        isHeaderRow ? 'bg-[#e8f5e9] font-black text-[#1b4332]' : ''
                                      } ${isTotalRow ? 'bg-[#f0f7f4] font-black text-[#1b4332]' : ''}`}
                                    >
                                      {row.map((cell, cIdx) => (
                                        <td
                                          key={cIdx}
                                          className={`px-3.5 py-2 whitespace-nowrap max-w-sm truncate ${
                                            cIdx === 1 ? 'text-right font-mono font-bold' : ''
                                          }`}
                                        >
                                          {String(cell)}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      {previewModal.rows.length > 50 && (
                        <p className="text-[11px] text-[#52605d] italic text-center mt-3">
                          Showing first 50 rows of {previewModal.rows.length} total records. Download .xlsx to view full dataset.
                        </p>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 bg-[#f7f9f7] border-t border-[#e2ece2] flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-[#52605d]">
                        {previewModal.rows.length} Total Rows Recorded
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewModal(null)}
                          className="px-4 py-2 rounded-xl border border-[#e2ece2] text-xs font-bold text-[#52605d] hover:bg-white cursor-pointer"
                        >
                          Close
                        </button>
                        {previewModal.onPdfDownload && (
                          <button
                            type="button"
                            onClick={() => {
                              previewModal.onPdfDownload!();
                              setPreviewModal(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-950 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Export PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            previewModal.onDownload();
                            setPreviewModal(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title="Export Excel (.xlsx)"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>.xlsx</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </ModalPortal>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SUB TAB 3: SYSTEM SECURITY */}
      {activeSubTab === 'security' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-5">
          {/* Section Header */}
          <div className="pb-3 border-b border-[#e2ece2] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading text-sm sm:text-base md:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#2d6a4f] shrink-0" />
                  <span>System Security</span>
                </h2>
                <span className="sm:hidden px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7] flex items-center gap-1 shrink-0">
                  <Shield className="w-3 h-3 text-[#2d6a4f]" />
                  Executive
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5 leading-relaxed">
                Admin 2FA authorization, credentials, and session controls
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7] flex items-center gap-1.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-[#2d6a4f]" />
                Executive Access
              </span>
            </div>
          </div>

          {/* Toast Notification for Security Changes */}
          <AnimatePresence>
            {securityToast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between gap-3 ${
                  securityToast.type === 'success'
                    ? 'bg-[#f0f9f1] border-[#74c69d] text-[#1b4332]'
                    : 'bg-stone-50 border-stone-300 text-stone-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                  <span>{securityToast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSecurityToast(null)}
                  className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card 1: Admin 2FA OTP Toggle Settings */}
          <div className="bg-[#f7f9f7] rounded-2xl p-3.5 sm:p-4 md:p-5 border border-[#e2ece2] space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
                  <Key className="w-4 h-4 text-[#74c69d]" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                    <h3 className="font-heading font-black text-xs sm:text-sm md:text-base text-[#1b4332] leading-snug">
                      Admin 2FA (OTP)
                    </h3>
                    {securitySettings.adminOtpEnabled ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-stone-200 text-stone-700 border border-stone-300 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-500"></span>
                        Bypassed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed">
                    Require a 6-digit email OTP verification code upon administrator sign in.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e2ece2] shrink-0">
                <span className="text-[11px] sm:text-xs font-black text-[#1b4332]">
                  {securitySettings.adminOtpEnabled ? 'OTP Enabled' : 'OTP Disabled'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={securitySettings.adminOtpEnabled}
                  onClick={handleToggleAdminOtp}
                  className={`relative inline-flex h-6 sm:h-6.5 w-11 sm:w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] focus:ring-offset-2 ${
                    securitySettings.adminOtpEnabled ? 'bg-[#1b4332]' : 'bg-stone-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 sm:h-5.5 sm:w-5.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      securitySettings.adminOtpEnabled ? 'translate-x-5 sm:translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Explanatory Details Box */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#e2ece2] space-y-1.5 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-[#1b4332]">
                <Mail className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                <span>Email Dispatch Info</span>
              </div>
              <p className="text-[#52605d] leading-relaxed break-words text-[11px]">
                When enabled, sign-in OTP codes are dispatched from <span className="font-mono text-[#2d6a4f] font-semibold">noreply@bccriders.cc</span> to <strong className="text-[#1b4332] break-all">{currentUser?.email || 'admin@bccriders.org'}</strong>.
              </p>
              <div className="pt-1.5 border-t border-[#f0f4f0] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] sm:text-[11px] text-[#52605d]">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span>Validity: <strong>5 minutes</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span>Security: <strong>Single-use token</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Biometric Authentication (Fingerprint / Touch ID / Face ID) */}
          <div className="bg-[#f7f9f7] rounded-2xl p-3.5 sm:p-4 md:p-5 border border-[#e2ece2] space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
                  <Fingerprint className="w-5 h-5 text-[#74c69d]" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-black text-xs sm:text-sm md:text-base text-[#1b4332] leading-snug">
                      Biometric Login (Fingerprint / Face ID)
                    </h3>
                    {userBioCredential ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active on Device
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-stone-200 text-stone-700 border border-stone-300 flex items-center gap-1 shrink-0">
                        Not Enrolled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed">
                    Enroll this phone or tablet to sign in directly with Android fingerprint scanner, iOS Touch ID, or Face ID.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e2ece2] shrink-0">
                <button
                  type="button"
                  onClick={handleRegisterBiometrics}
                  disabled={isEnrollingBio}
                  className="px-4 py-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>
                    {isEnrollingBio
                      ? 'Scanning Sensor...'
                      : userBioCredential
                      ? 'Re-enroll Biometrics'
                      : 'Enroll Fingerprint / Face ID'}
                  </span>
                </button>
                {userBioCredential && (
                  <button
                    type="button"
                    onClick={handleRemoveBiometrics}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-rose-200"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Live Feedback */}
            {bioSuccess && (
              <div className="p-3 bg-[#f0f9f1] border border-[#74c69d] rounded-xl flex items-center gap-2 text-[#1b4332] text-xs font-bold animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                <span>{bioSuccess}</span>
              </div>
            )}

            {bioError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bioError}</span>
              </div>
            )}

            {/* Device Info */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#e2ece2] space-y-1.5 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-[#1b4332]">
                <Smartphone className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                <span>Hardware Compatibility</span>
              </div>
              <p className="text-[#52605d] leading-relaxed text-[11px]">
                {biometricsSupported
                  ? `Your device (${getDeviceDescription()}) supports native biometric hardware authentication (WebAuthn / Passkeys).`
                  : 'Biometric hardware sensor is currently verifying or device requires biometric authorization permission.'}
              </p>
              {userBioCredential && (
                <div className="pt-1.5 border-t border-[#f0f4f0] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] sm:text-[11px] text-[#52605d]">
                  <div>
                    Enrolled device: <strong>{userBioCredential.deviceName}</strong>
                  </div>
                  <div>
                    Enrolled at: <strong>{new Date(userBioCredential.createdAt).toLocaleDateString()}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: 4-Digit Quick PIN Login (For Devices without Fingerprint) */}
          <div className="bg-[#f7f9f7] rounded-2xl p-3.5 sm:p-4 md:p-5 border border-[#e2ece2] space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
                  <KeyRound className="w-5 h-5 text-[#74c69d]" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-black text-xs sm:text-sm md:text-base text-[#1b4332] leading-snug">
                      4-Digit Quick PIN Login
                    </h3>
                    {userPinCredential ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active on Device
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-stone-200 text-stone-700 border border-stone-300 flex items-center gap-1 shrink-0">
                        Not Enrolled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed">
                    Set up a fast 4-digit security PIN for instant sign-in on devices or phones without a biometric fingerprint scanner.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e2ece2] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPinSuccess(null);
                    setPinError(null);
                    setShowPinSetupModal(true);
                  }}
                  className="px-4 py-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {userPinCredential ? 'Change 4-Digit PIN' : 'Set Up 4-Digit PIN'}
                  </span>
                </button>
                {userPinCredential && (
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    disabled={isRemovingPin}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-rose-200 disabled:opacity-50"
                  >
                    {isRemovingPin ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            </div>

            {/* Live Feedback */}
            {pinSuccess && (
              <div className="p-3 bg-[#f0f9f1] border border-[#74c69d] rounded-xl flex items-center gap-2 text-[#1b4332] text-xs font-bold animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                <span>{pinSuccess}</span>
              </div>
            )}

            {pinError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Device Info */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#e2ece2] space-y-1.5 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-[#1b4332]">
                <Smartphone className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                <span>Device Enrolled Status</span>
              </div>
              <p className="text-[#52605d] leading-relaxed text-[11px]">
                {userPinCredential
                  ? `Configured for fast 4-digit PIN authentication on this browser (${userPinCredential.deviceName || getPinDeviceName()}).`
                  : `Compatible with all desktop and mobile web browsers on ${getPinDeviceName()}.`}
              </p>
              {userPinCredential && (
                <div className="pt-1.5 border-t border-[#f0f4f0] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] sm:text-[11px] text-[#52605d]">
                  <div>
                    Enrolled username: <strong>@{userPinCredential.username}</strong>
                  </div>
                  <div>
                    Configured on: <strong>{userPinCredential.createdAt ? new Date(userPinCredential.createdAt).toLocaleDateString() : 'Active'}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Official Club Roles Management */}
          <div className="pt-2 border-t border-[#e2ece2]">
            <RolesSettings />
          </div>

          {/* Card 4: Executive Sign Out Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <LogOut className="w-4 h-4 text-rose-700 shrink-0" />
                <h3 className="font-heading font-extrabold text-rose-950 text-xs sm:text-sm">
                  Account Session
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed">
                Sign out of your active administrator account session safely.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB TAB 4: EMAIL (SENDING & INBOUND INBOX) */}
      {activeSubTab === 'inbound' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Section 1: Sending Email via Resend */}
          <EmailSender members={approvedMembers} />

          {/* Section 2: Inbound Email Webhook Inbox */}
          <InboundEmailViewer />
        </div>
      )}

      {/* SUB TAB 5: WEB PUSH NOTIFICATIONS & CHANNEL CUSTOMIZATION */}
      {activeSubTab === 'push_notifications' && (
        <PushNotificationSettings />
      )}

      {/* SUB TAB 6: GOOGLE SHARED DRIVE & STORAGE CONFIGURATION */}
      {activeSubTab === 'storage' && (
        <DriveStorageSettings />
      )}

      {/* MODAL: CREATE / EDIT MONTHLY DUE */}
      <AnimatePresence>
        {showMonthlyDueModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl max-w-[340px] sm:max-w-[390px] w-[94vw] max-h-[66dvh] sm:max-h-[70dvh] shadow-2xl border border-[#e2ece2] relative my-auto flex flex-col overflow-hidden"
              >
                <form onSubmit={handleSubmitDue} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Header (Fixed) */}
                  <div className="p-2.5 sm:p-3 pb-2 border-b border-[#e2ece2] relative shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowMonthlyDueModal(false)}
                      className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 pr-6">
                      <div className="w-7 h-7 rounded-lg bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-[#2d6a4f]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-heading font-extrabold text-[#1b4332] text-xs sm:text-sm leading-tight truncate">
                          {editingDue ? 'Edit Monthly Due' : 'Set Monthly Due'}
                        </h3>
                        <p className="text-[9px] sm:text-[10px] text-[#52605d] leading-tight truncate">
                          Configure due amount for selected period
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Body (Scrollable) */}
                  <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2 sm:space-y-2.5 text-xs pr-1.5">
                    {/* Amount Due */}
                    <div>
                      <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                        Due Per Member (₱) <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          value={dueAmount}
                          onChange={(e) => setDueAmount(Number(e.target.value))}
                          className="w-full pl-5 pr-2 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                        />
                        <span className="absolute left-2 top-1 sm:top-1.5 text-xs font-bold text-[#52605d]">₱</span>
                      </div>
                    </div>

                    {/* Amount Due Period: Month & Year Dropdown Selection */}
                    <div className="grid grid-cols-2 gap-1 bg-[#f0f9f1] p-1.5 rounded-lg border border-[#c8e6c9]">
                      <CustomSelect
                        label="Month"
                        required
                        value={dueMonth}
                        onChange={(val) => setDueMonth(val)}
                        options={MONTH_OPTIONS}
                      />

                      <CustomSelect
                        label="Year"
                        required
                        value={dueYear}
                        onChange={(val) => setDueYear(val)}
                        options={YEAR_OPTIONS}
                      />
                    </div>

                    {/* Live Calculated Pending Collection Preview */}
                    <div className="p-2 bg-[#1b4332] text-white rounded-lg space-y-0.5">
                      <span className="text-[8.5px] text-[#74c69d] font-bold uppercase tracking-wider block">
                        Expected Total ({approvedMemberCount} members)
                      </span>
                      <div className="text-xs font-black text-white">
                        ₱{(approvedMemberCount * (Number(dueAmount) || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Fixed Footer Buttons */}
                  <div className="p-2 sm:p-2.5 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowMonthlyDueModal(false)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-[11px] cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-[11px] shadow-sm cursor-pointer transition-all flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-[#74c69d] shrink-0" />
                      <span>{editingDue ? 'Save' : 'Save Due'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE / EDIT DYNAMIC COLLECTION */}
      <AnimatePresence>
        {showCollectionModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl max-w-[340px] sm:max-w-[390px] w-[94vw] max-h-[66dvh] sm:max-h-[70dvh] shadow-2xl border border-[#e2ece2] relative my-auto flex flex-col overflow-hidden"
              >
                <form onSubmit={handleSubmitCollection} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Header (Fixed) */}
                  <div className="p-2.5 sm:p-3 pb-2 border-b border-[#e2ece2] relative shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowCollectionModal(false)}
                      className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 pr-6">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        colType === 'Donation' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {colType === 'Donation' ? <HeartHandshake className="w-3.5 h-3.5 text-emerald-700" /> : <PiggyBank className="w-3.5 h-3.5 text-amber-700" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-heading font-extrabold text-[#1b4332] text-xs sm:text-sm leading-tight truncate">
                          {editingCollection
                            ? (colType === 'Donation' ? 'Edit Donation' : 'Edit Collection')
                            : (colType === 'Donation' ? 'Add Donation' : 'New Collection')}
                        </h3>
                        <p className="text-[9px] sm:text-[10px] text-[#52605d] leading-tight truncate">
                          {colType === 'Donation'
                            ? 'Voluntary fund for Net Treasury'
                            : 'Set custom collection drive'}
                        </p>
                      </div>
                    </div>

                    {/* Type Switcher */}
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#f7f9f7] rounded-lg border border-[#e2ece2] mt-1.5">
                      <button
                        type="button"
                        onClick={() => setColType('Standard')}
                        className={`py-0.5 px-1.5 rounded-md font-extrabold text-[9.5px] sm:text-[10.5px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          colType === 'Standard'
                            ? 'bg-white text-[#1b4332] shadow-2xs border border-[#e2ece2]'
                            : 'text-[#52605d] hover:text-[#1b4332]'
                        }`}
                      >
                        <Receipt className="w-3 h-3 shrink-0" />
                        <span className="truncate">Standard Drive</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setColType('Donation')}
                        className={`py-0.5 px-1.5 rounded-md font-extrabold text-[9.5px] sm:text-[10.5px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          colType === 'Donation'
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'text-[#52605d] hover:text-emerald-700'
                        }`}
                      >
                        <HeartHandshake className="w-3 h-3 shrink-0" />
                        <span className="truncate">Donation</span>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Form Body */}
                  <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2 sm:space-y-2.5 text-xs pr-1.5">
                    {colType === 'Donation' ? (
                      <>
                        {/* Donation Collection Name */}
                        <div>
                          <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                            Donation Drive / Purpose <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={colName}
                            onChange={(e) => setColName(e.target.value)}
                            placeholder="e.g., Medical Relief Fund"
                            className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                          />
                        </div>

                        {/* Donor / Contributor Name */}
                        <div>
                          <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                            Donor / Contributor <span className="text-[9px] font-normal text-[#52605d]">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={colDonorName}
                            onChange={(e) => setColDonorName(e.target.value)}
                            placeholder="e.g., Anonymous Sponsor"
                            className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                          />
                        </div>

                        {/* Donation Amount */}
                        <div>
                          <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                            Donation Amount (₱) <span className="text-rose-600">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              required
                              min="1"
                              step="any"
                              value={colAmount}
                              onChange={(e) => setColAmount(Number(e.target.value) || 0)}
                              className="w-full pl-5 pr-2 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                            />
                            <span className="absolute left-2 top-1 sm:top-1.5 text-xs font-bold text-[#52605d]">₱</span>
                          </div>
                          <p className="text-[9px] text-emerald-800 font-semibold mt-0.5">
                            Directly credited to Net Treasury upon creation.
                          </p>
                        </div>

                        {/* Educational Info Box */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-emerald-950 space-y-0.5">
                          <div className="flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-900">
                            <Sparkles className="w-3 h-3 text-emerald-700 shrink-0" />
                            <span>Treasury Impact</span>
                          </div>
                          <p className="text-[9px] leading-tight text-emerald-800">
                            This donation is logged as paid revenue and immediately increases the Net Treasury.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Collection Name */}
                        <div>
                          <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                            Collection Title <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={colName}
                            onChange={(e) => setColName(e.target.value)}
                            placeholder="e.g., Club Shirt / Uniform"
                            className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                          />
                        </div>

                        {/* Amount */}
                        <div>
                          <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                            Amount Per Member (₱) <span className="text-rose-600">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              value={colAmount}
                              onChange={(e) => {
                                const valStr = e.target.value;
                                const numVal = Number(valStr);
                                setColAmount(numVal);
                                const count = approvedMembers.length;
                                if (valStr !== '' && !isNaN(numVal) && numVal >= 0) {
                                  setColTargetAmount(String(Math.round(numVal * count * 100) / 100));
                                } else {
                                  setColTargetAmount('');
                                }
                              }}
                              className="w-full pl-5 pr-2 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                            />
                            <span className="absolute left-2 top-1 sm:top-1.5 text-xs font-bold text-[#52605d]">₱</span>
                          </div>
                        </div>

                        {/* Expected Target Collection */}
                        <div>
                          <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                            Target Goal (₱) <span className="text-[9px] font-normal text-[#52605d]">(Optional)</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={colTargetAmount}
                              onChange={(e) => {
                                const targetValStr = e.target.value;
                                setColTargetAmount(targetValStr);
                                const count = approvedMembers.length;
                                const targetNum = Number(targetValStr);
                                if (targetValStr !== '' && !isNaN(targetNum) && targetNum >= 0) {
                                  const calculatedAmount = count > 0 ? Math.round((targetNum / count) * 100) / 100 : 0;
                                  setColAmount(calculatedAmount);
                                }
                              }}
                              placeholder={approvedMembers.length > 0 ? `Auto: ₱${(approvedMembers.length * (Number(colAmount) || 0)).toLocaleString()}` : 'Auto: ₱0.00'}
                              className="w-full pl-5 pr-2 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                            />
                            <span className="absolute left-2 top-1 sm:top-1.5 text-xs font-bold text-[#52605d]">₱</span>
                          </div>
                          <p className="text-[9px] text-[#52605d] mt-0.5">
                            For {approvedMembers.length} active member(s).
                          </p>
                        </div>
                      </>
                    )}

                    {/* Description */}
                    <div>
                      <label className="text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332] mb-0.5 block">
                        Description / Notes
                      </label>
                      <textarea
                        rows={2}
                        value={colDescription}
                        onChange={(e) => setColDescription(e.target.value)}
                        placeholder={colType === 'Donation' ? 'Notes on donation...' : 'Details on drive...'}
                        className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] resize-none"
                      />
                    </div>
                  </div>

                  {/* Fixed Footer Buttons */}
                  <div className="p-2 sm:p-2.5 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCollectionModal(false)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-[11px] cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-3 py-1 rounded-lg text-white font-extrabold text-[11px] shadow-sm cursor-pointer transition-all flex items-center gap-1 ${
                        colType === 'Donation'
                          ? 'bg-emerald-700 hover:bg-emerald-800'
                          : 'bg-[#1b4332] hover:bg-[#2d6a4f]'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-200 shrink-0" />
                      <span className="truncate">
                        {editingCollection
                          ? (colType === 'Donation' ? 'Save' : 'Save Drive')
                          : (colType === 'Donation' ? 'Log Donation' : 'Create')}
                      </span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DELETE MODAL */}
      <AnimatePresence>
        {deleteTarget && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full text-center space-y-3.5 border border-[#e2ece2] shadow-2xl relative"
              >
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base">
                    Delete Item?
                  </h3>
                  <p className="text-xs text-[#52605d] leading-relaxed">
                    Permanently delete <strong className="text-rose-700">"{deleteTarget.name}"</strong>?
                    This item will be removed from system records.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteAction}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* SIGN OUT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showLogoutModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full text-center space-y-4 border border-[#e2ece2] shadow-2xl relative"
              >
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                  <LogOut className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-heading text-base sm:text-lg font-extrabold text-[#1b4332]">
                    Sign Out?
                  </h3>
                  <p className="text-xs text-[#52605d] leading-relaxed">
                    Are you sure you want to sign out of your account?
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogoutModal(false);
                      logout();
                    }}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* DELETE A YEAR'S TRANSACTIONS CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteYearModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-rose-200 relative my-auto overflow-hidden text-left"
              >
                {/* Header */}
                <div className="p-3.5 sm:p-4 border-b border-rose-100 bg-rose-50/70 relative">
                  <button
                    type="button"
                    onClick={() => setShowDeleteYearModal(false)}
                    className="absolute top-3 right-3 p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2.5 pr-6">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-black text-rose-950 text-sm sm:text-base leading-tight truncate">
                        Delete FY {deleteYearInput} Records
                      </h3>
                      <p className="text-[11px] text-rose-700 leading-tight mt-0.5">
                        Irreversible Fiscal Year Purge
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-3.5 sm:p-4 space-y-3 text-xs">
                  {/* Mandatory Archiving Instructions Callout */}
                  <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Important Instruction</span>
                    </div>
                    <p className="font-black text-amber-950 text-xs leading-snug">
                      "Make sure to Archive the Year and download the Zip file first"
                    </p>
                    <p className="text-amber-900 text-[10.5px] sm:text-[11px] leading-relaxed">
                      Permanently deletes all active collection records & expense vouchers for FY <strong>{deleteYearInput}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteYearModal(false);
                        setShowYearlyArchiveModal(true);
                      }}
                      className="mt-1 w-full py-1.5 px-3 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <FolderArchive className="w-3.5 h-3.5 text-amber-800" />
                      <span>Archive FY {deleteYearInput} & Download .ZIP First</span>
                    </button>
                  </div>

                  {/* Match Summary */}
                  <div className="p-2.5 bg-[#f7f9f7] rounded-xl border border-[#e2ece2] space-y-1">
                    <span className="text-[10px] font-bold text-[#52605d] uppercase tracking-wider block">
                      Records to be deleted
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-white rounded-lg border border-[#e2ece2]">
                        <span className="text-[#52605d] text-[10px] block">Collections</span>
                        <strong className="text-[#1b4332] text-xs sm:text-sm">{matchedYearRecords.length} records</strong>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-[#e2ece2]">
                        <span className="text-[#52605d] text-[10px] block">Expenses</span>
                        <strong className="text-rose-700 text-xs sm:text-sm">{matchedYearExpenses.length} vouchers</strong>
                      </div>
                    </div>
                  </div>

                  {/* 10-Second Countdown Indicator */}
                  <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${deleteCountdown > 0 ? 'text-amber-600 animate-pulse' : 'text-emerald-600'}`} />
                      <span className="text-[11px] font-bold text-stone-700 truncate">
                        {deleteCountdown > 0 ? `Safety delay (${deleteCountdown}s)` : 'Delay complete. Ready.'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                      deleteCountdown > 0
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}>
                      {deleteCountdown > 0 ? `${deleteCountdown}s` : 'Ready'}
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-3 sm:p-3.5 border-t border-[#e2ece2] bg-[#fafcfa] flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDeleteYearModal(false)}
                    disabled={isDeletingYear}
                    className="px-3.5 py-1.5 sm:py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteYear}
                    disabled={deleteCountdown > 0 || isDeletingYear}
                    className={`px-4 py-1.5 sm:py-2 rounded-xl font-black text-xs shadow-xs transition-all flex items-center gap-1.5 ${
                      deleteCountdown > 0 || isDeletingYear
                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-60'
                        : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    {isDeletingYear ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {deleteCountdown > 0 ? `Confirm (${deleteCountdown}s)` : 'Confirm'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* Hidden File Input for Importing Zip Archives */}
      <input
        type="file"
        ref={zipInputRef}
        onChange={handleImportZipFile}
        accept=".zip,application/zip"
        className="hidden"
      />

      {/* Yearly Archive Modal */}
      <YearlyArchiveModal
        isOpen={showYearlyArchiveModal}
        onClose={() => setShowYearlyArchiveModal(false)}
        records={reportPayments}
        expenses={reportExpenses}
        users={reportUsers}
        dynamicCols={dynamicCollections}
        currentUser={currentUser}
        onArchiveComplete={handleArchiveComplete}
        deleteRecordsForYear={deleteRecordsForYear}
      />

      {/* Archive Export Modal for Imported Zip Files */}
      <ArchiveExportModal
        isOpen={showArchiveExportModal}
        onClose={() => {
          setShowArchiveExportModal(false);
          setImportedArchiveData(null);
        }}
        data={importedArchiveData}
      />

      <OfficialLoader isLoading={isProcessing} message="Deleting..." />

      {/* 4-Digit PIN Setup / Update Modal */}
      {currentUser && (
        <PinSetupModal
          isOpen={showPinSetupModal}
          onClose={() => setShowPinSetupModal(false)}
          currentUser={{
            id: currentUser.id,
            username: currentUser.username,
            name: currentUser.name || currentUser.username,
            avatar: currentUser.avatar,
          }}
          hasExistingPin={Boolean(userPinCredential)}
          onSuccess={(msg) => {
            setPinSuccess(msg);
            setPinError(null);
            const pinCred = getDevicePinForUser(currentUser.id) || getDevicePinForUser(currentUser.username);
            setUserPinCredential(pinCred);
          }}
        />
      )}

      {/* Settings Action / Error Notice Modal */}
      <ModalPortal>
        {settingsNoticeModal && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className={`w-12 h-12 rounded-2xl ${settingsNoticeModal.isError ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-[#1b4332] border border-emerald-200'} flex items-center justify-center mx-auto`}>
                {settingsNoticeModal.isError ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-[#2d6a4f]" />
                )}
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-heading font-black text-stone-900">
                  {settingsNoticeModal.title}
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  {settingsNoticeModal.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsNoticeModal(null)}
                className="w-full py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </ModalPortal>
    </div>
  );
};
