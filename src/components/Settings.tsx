import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import { CustomSelect } from './CustomSelect';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  FinanceSettings,
  MonthlyDue,
  DynamicCollection,
  User,
} from '../types';
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
} from 'lucide-react';

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
  { id: 'finance', label: 'Finance & Fee Settings', icon: Wallet, description: 'Manage club fees, dues, & custom collections' },
  { id: 'reports', label: 'Reports & Export Center', icon: FileSpreadsheet, description: 'Export CSV data for members, transactions, and financial statements' },
  { id: 'security', label: 'System & Security', icon: Shield, description: 'Executive permissions and security controls' },
] as const;

export const Settings: React.FC = () => {
  const { currentUser, isAdmin, logout } = useAuth();

  // Settings Sub-Navigation Dropdown & Tabs
  const [activeSubTab, setActiveSubTab] = useState<'finance' | 'reports' | 'security'>('finance');
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
  const [approvedMembers, setApprovedMembers] = useState<User[]>([]);

  // Fee Form State
  const [membershipFeeInput, setMembershipFeeInput] = useState<number>(
    financeSettings.membershipFee
  );
  const [annualFeeInput, setAnnualFeeInput] = useState<number>(
    financeSettings.annualFee
  );
  const [feeSavedToast, setFeeSavedToast] = useState(false);

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
  const [colName, setColName] = useState('');
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
  const [reportYearFilter, setReportYearFilter] = useState<string>('All');
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(event.target as Node)
      ) {
        setIsYearDropdownOpen(false);
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
    let finList: any[] = [];
    try {
      const item = localStorage.getItem('bcc_finance_records_v3');
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) finList = parsed;
      }
    } catch (e) {
      console.error(e);
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

    fetch('/api/mongodb/financeLogs')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setReportPayments(filterNonAdminPayments(data.data));
          localStorage.setItem('bcc_finance_records_v3', JSON.stringify(data.data));
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

    fetch('/api/mongodb/liquidationLogs')
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
    loadReportsData();
  }, []);

  const escapeCSVCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const downloadCSVFile = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const allLines = [
      headers.map(escapeCSVCell).join(','),
      ...rows.map((r) => r.map(escapeCSVCell).join(',')),
    ];
    const csvContent = allLines.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadXLSFile = (filename: string, headers: string[], rows: (string | number)[][]) => {
    let tableRowsHtml = '';

    rows.forEach((row) => {
      const cell1 = String(row[0] || '').trim();
      const rawCell2 = row[1] !== undefined && row[1] !== '' ? String(row[1]) : '';

      const isBorderLine = cell1.startsWith('---') || cell1.startsWith('===');
      if (isBorderLine) {
        return;
      }

      const isMainTitle = cell1 === 'BCC RIDERS CLUB - FINANCIAL STATEMENT';
      const isSectionHeader = ['FUNDS', 'EXPENSES', 'SUPPLEMENTARY ACCOUNTS'].includes(cell1);
      const isTotalRow = cell1.startsWith('Total');
      const isNetRow = cell1.startsWith('NET INCOME');

      if (isMainTitle) {
        tableRowsHtml += `
          <tr>
            <td colspan="2" style="font-weight: bold; font-size: 11pt; text-align: center; background-color: #1b4332; color: #ffffff; padding: 8px; border: 1px solid #1b4332;">
              ${cell1} ${rawCell2 ? `(${rawCell2})` : ''}
            </td>
          </tr>
        `;
      } else if (isSectionHeader) {
        tableRowsHtml += `
          <tr>
            <td style="font-weight: bold; font-size: 10pt; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px;">${cell1}</td>
            <td style="border: 1px solid #cbd5e1; background-color: #f8fafc;"></td>
          </tr>
        `;
      } else if (isTotalRow) {
        const numVal = Number(rawCell2);
        const formattedAmount = !isNaN(numVal) ? `₱${numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : rawCell2;
        tableRowsHtml += `
          <tr>
            <td style="font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px; background-color: #ffffff;">${cell1}</td>
            <td style="font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; background-color: #ffffff;">${formattedAmount}</td>
          </tr>
        `;
      } else if (isNetRow) {
        const numVal = Number(rawCell2);
        const formattedAmount = !isNaN(numVal) ? `₱${numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : rawCell2;
        tableRowsHtml += `
          <tr>
            <td style="font-weight: bold; font-size: 11pt; border: 1px solid #cbd5e1; padding: 8px 10px; background-color: #f0fdf4; color: #166534;">${cell1}</td>
            <td style="font-weight: bold; font-size: 11pt; border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; background-color: #f0fdf4; color: #166534;">${formattedAmount}</td>
          </tr>
        `;
      } else if (cell1 === '' && rawCell2 === '') {
        tableRowsHtml += `
          <tr>
            <td style="height: 12px; border: none;"></td>
            <td style="height: 12px; border: none;"></td>
          </tr>
        `;
      } else {
        const isIndented = String(row[0] || '').startsWith('  ');
        const numVal = Number(rawCell2);
        const formattedAmount = rawCell2 !== '' && !isNaN(numVal) ? `₱${numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : rawCell2;
        tableRowsHtml += `
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 5px 10px ${isIndented ? '; padding-left: 24px' : ''};">${cell1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">${formattedAmount}</td>
          </tr>
        `;
      }
    });

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Sheet1</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          th { font-weight: bold; background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 12px; }
          td { border: 1px solid #cbd5e1; padding: 6px 12px; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th style="width: 320px; text-align: left; border: 1px solid #cbd5e1;">${headers[0] || 'Account / Line Item'}</th>
              <th style="width: 180px; text-align: right; border: 1px solid #cbd5e1;">${headers[1] || 'Amount (PHP)'}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.replace(/\.csv$/, '.xls'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

    const filtered =
      reportYearFilter !== 'All'
        ? reportPayments.filter(
            (p) =>
              p.paidDate?.includes(reportYearFilter) ||
              p.createdAt?.includes(reportYearFilter) ||
              p.coveredMonth?.includes(reportYearFilter) ||
              p.dueDate?.includes(reportYearFilter)
          )
        : reportPayments;

    const userMap = new Map(reportUsers.map((u) => [u.id, u.name]));

    const rows = filtered.map((p) => [
      p.id,
      p.paidDate || p.createdAt || 'N/A',
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

    const filtered =
      reportYearFilter !== 'All'
        ? reportExpenses.filter(
            (e) =>
              e.date?.includes(reportYearFilter) ||
              e.createdAt?.includes(reportYearFilter)
          )
        : reportExpenses;

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

  const getFinancialStatementReportData = () => {
    const pFiltered =
      reportYearFilter !== 'All'
        ? reportPayments.filter(
            (p) =>
              p.paidDate?.includes(reportYearFilter) ||
              p.createdAt?.includes(reportYearFilter) ||
              p.coveredMonth?.includes(reportYearFilter) ||
              p.dueDate?.includes(reportYearFilter)
          )
        : reportPayments;

    const eFiltered =
      reportYearFilter !== 'All'
        ? reportExpenses.filter(
            (e) =>
              e.date?.includes(reportYearFilter) ||
              e.createdAt?.includes(reportYearFilter)
          )
        : reportExpenses;

    const paidPayments = pFiltered.filter((p) => p.status === 'Paid');
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
    const totalReceivables = pendingPayments.reduce(
      (acc, p) => acc + (Number(p.amount) || 0),
      0
    );

    const incomeByType: Record<string, number> = {};
    paidPayments.forEach((p) => {
      const key = p.itemType || p.type || 'Other Funds';
      incomeByType[key] = (incomeByType[key] || 0) + (Number(p.amount) || 0);
    });

    const expenseByCategory: Record<string, number> = {};
    eFiltered.forEach((e) => {
      const key = e.category || 'General Expense';
      expenseByCategory[key] =
        (expenseByCategory[key] || 0) + (Number(e.amount) || 0);
    });

    const headers = ['Account / Line Item', 'Amount (PHP)'];

    const rows: (string | number)[][] = [
      ['BCC RIDERS CLUB - FINANCIAL STATEMENT', reportYearFilter === 'All' ? 'All Time' : `FY ${reportYearFilter}`],
      ['', ''],
      ['FUNDS', ''],
    ];

    if (Object.keys(incomeByType).length === 0) {
      rows.push(['  No funds items recorded', '0.00']);
    } else {
      Object.entries(incomeByType).forEach(([cat, amt]) => {
        rows.push([`  ${cat}`, amt.toFixed(2)]);
      });
    }

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
    rows.push(['', '']);
    rows.push(['SUPPLEMENTARY ACCOUNTS', '']);
    rows.push(['Accounts Receivable (Pending Dues)', totalReceivables.toFixed(2)]);

    return { headers, rows };
  };

  const exportFinancialStatementPDF = () => {
    const pFiltered =
      reportYearFilter !== 'All'
        ? reportPayments.filter(
            (p) =>
              p.paidDate?.includes(reportYearFilter) ||
              p.createdAt?.includes(reportYearFilter) ||
              p.coveredMonth?.includes(reportYearFilter) ||
              p.dueDate?.includes(reportYearFilter)
          )
        : reportPayments;

    const eFiltered =
      reportYearFilter !== 'All'
        ? reportExpenses.filter(
            (e) =>
              e.date?.includes(reportYearFilter) ||
              e.createdAt?.includes(reportYearFilter)
          )
        : reportExpenses;

    const paidPayments = pFiltered.filter((p) => p.status === 'Paid');
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
    const totalReceivables = pendingPayments.reduce(
      (acc, p) => acc + (Number(p.amount) || 0),
      0
    );

    const incomeByType: Record<string, number> = {};
    paidPayments.forEach((p) => {
      const key = p.itemType || p.type || 'Other Funds';
      incomeByType[key] = (incomeByType[key] || 0) + (Number(p.amount) || 0);
    });

    const expenseByCategory: Record<string, number> = {};
    eFiltered.forEach((e) => {
      const key = e.category || 'General Expense';
      expenseByCategory[key] =
        (expenseByCategory[key] || 0) + (Number(e.amount) || 0);
    });

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
      reportYearFilter === 'All'
        ? 'For All Recorded Fiscal Periods'
        : `For the Year Ended December 31, ${reportYearFilter}`;
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

    const incomeEntries = Object.entries(incomeByType);
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

    y += 15;

    // Supplementary Info: Accounts Receivable
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(82, 96, 93);
    doc.text('SUPPLEMENTARY ACCOUNTS:', margin, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text('Accounts Receivable (Pending / Uncollected Dues)', margin + 4, y);
    doc.text(
      totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      pageWidth - margin - 4,
      y,
      { align: 'right' }
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

    doc.save(`BRC_Income_Statement_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
    // Load approved members for collection calculations (excluding admin accounts)
    const allUsers = store.getUsers();
    const approved = allUsers.filter((u) => {
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
    setApprovedMembers(approved);
  }, []);

  const refreshFinanceData = () => {
    setFinanceSettings(store.getFinanceSettings());
    setMonthlyDues([...store.getMonthlyDues()]);
    setDynamicCollections([...store.getDynamicCollections()]);
    const allUsers = store.getUsers();
    const approved = allUsers.filter((u) => {
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
    setApprovedMembers(approved);
  };

  // Handle Save Fee Configuration
  const handleSaveFees = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = store.updateFinanceSettings({
      membershipFee: Number(membershipFeeInput) || 0,
      annualFee: Number(annualFeeInput) || 0,
    });
    setFinanceSettings(updated);
    setFeeSavedToast(true);
    setTimeout(() => setFeeSavedToast(false), 3000);
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

  const handleSubmitDue = (e: React.FormEvent) => {
    e.preventDefault();
    const titleVal = `${dueMonth} ${dueYear} Monthly Due`;

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

    if (savedDue) {
      generatePendingMonthlyDueRecords(savedDue);
    }

    refreshFinanceData();
    setShowMonthlyDueModal(false);
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
        const existingIdx = recs.findIndex(r =>
          r.userId === u.id &&
          r.itemType === 'Monthly Due' &&
          (r.coveredMonth === coveredMonthStr || r.customItemName === due.title || r.id === `rec_md_${due.id}_${u.id}`)
        );

        if (existingIdx === -1) {
          const newRec = {
            id: `rec_md_${due.id}_${u.id}`,
            itemType: 'Monthly Due',
            userId: u.id,
            userName: u.name,
            userMemberNo: u.memberNumber || 'BRC-MEMBER',
            amount: due.amount,
            coveredMonth: coveredMonthStr,
            customItemName: due.title,
            dueDate: todayStr,
            status: 'Pending',
            paymentMethod: 'GCash',
            notes: `Automated pending monthly due for ${coveredMonthStr}`,
            updatedAt: todayStr,
          };
          recs.push(newRec);
          updated = true;
          fetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRec),
          }).catch(err => console.warn('MongoDB auto monthly due sync error:', err));
        } else if (recs[existingIdx].status === 'Pending' && recs[existingIdx].amount !== due.amount) {
          recs[existingIdx].amount = due.amount;
          updated = true;
          fetch('/api/mongodb/financeLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recs[existingIdx]),
          }).catch(err => console.warn('MongoDB update monthly due sync error:', err));
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
      const recItem = localStorage.getItem('bcc_finance_records_v3');
      if (!recItem) return;
      let recs: any[] = JSON.parse(recItem);
      const filtered = recs.filter(r => {
        if (r.itemType === 'Monthly Due' && r.status === 'Pending' && r.id.startsWith(`rec_md_${dueId}_`)) {
          fetch(`/api/mongodb/financeLogs/${r.id}`, { method: 'DELETE' }).catch(() => {});
          return false;
        }
        return true;
      });
      localStorage.setItem('bcc_finance_records_v3', JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  };

  // Dynamic Collection Handlers
  const handleOpenCreateCollection = () => {
    setEditingCollection(null);
    setColName('');
    setColAmount(500);
    setColTargetAmount('');
    setColDescription('');
    setShowCollectionModal(true);
  };

  const handleOpenEditCollection = (col: DynamicCollection) => {
    setEditingCollection(col);
    setColName(col.name);
    setColAmount(col.amount);
    setColTargetAmount(col.targetAmount !== undefined && col.targetAmount !== null ? String(col.targetAmount) : '');
    setColDescription(col.description || '');
    setShowCollectionModal(true);
  };

  const handleSubmitCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName.trim()) return;

    const parsedTarget = colTargetAmount.trim() !== '' && !isNaN(Number(colTargetAmount)) ? Number(colTargetAmount) : undefined;

    if (editingCollection) {
      store.updateDynamicCollection({
        ...editingCollection,
        name: colName.trim(),
        amount: Number(colAmount) || 0,
        targetAmount: parsedTarget,
        description: colDescription.trim(),
      });
    } else {
      store.createDynamicCollection({
        name: colName.trim(),
        amount: Number(colAmount) || 0,
        targetAmount: parsedTarget,
        status: 'Active',
        description: colDescription.trim(),
      });
    }
    refreshFinanceData();
    setShowCollectionModal(false);
  };

  // Execute Deletion
  const confirmDeleteAction = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'monthly_due') {
      store.deleteMonthlyDue(deleteTarget.id);
      deletePendingMonthlyDueRecords(deleteTarget.id);
    } else if (deleteTarget.type === 'dynamic_collection') {
      store.deleteDynamicCollection(deleteTarget.id);
    }
    refreshFinanceData();
    setDeleteTarget(null);
  };

  const approvedMemberCount = approvedMembers.length;

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* MEMBER SETTINGS CARD */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e2ece2] shadow-xs space-y-6">
          <div className="pb-4 border-b border-[#e2ece2] flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-black text-[#1b4332] flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-[#2d6a4f]" />
                Account & App Settings
              </h2>
              <p className="text-xs text-[#52605d] mt-1">
                Manage your member account session and app preferences
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#d8f3dc] text-[#1b4332] text-xs font-bold shrink-0">
              {currentUser?.role || 'Member'}
            </span>
          </div>

          {/* Member Profile Overview */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#52605d] block text-[11px] font-medium">Logged in as</span>
              <span className="font-extrabold text-[#1b4332] text-sm">{currentUser?.name}</span>
            </div>
            <div>
              <span className="text-[#52605d] block text-[11px] font-medium">Username / Member ID</span>
              <span className="font-extrabold text-[#2d6a4f] text-sm">@{currentUser?.username} {currentUser?.memberNumber ? `(#${currentUser.memberNumber})` : ''}</span>
            </div>
          </div>

          {/* Account Session / Sign Out Card */}
          <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-700" />
                <h3 className="font-heading font-extrabold text-rose-950 text-sm">
                  Account Session
                </h3>
              </div>
              <p className="text-xs text-[#52605d]">
                Sign out of your account session safely when you are done.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2 shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Account</span>
            </button>
          </div>
        </div>

        {/* SIGN OUT CONFIRMATION MODAL FOR MEMBER */}
        <AnimatePresence>
          {showLogoutModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-5 border border-[#e2ece2] shadow-2xl relative"
              >
                <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                  <LogOut className="w-7 h-7" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-heading text-lg font-extrabold text-[#1b4332]">
                    Sign Out of Account?
                  </h3>
                  <p className="text-xs text-[#52605d] leading-relaxed">
                    Are you sure you want to sign out of your account? You will need to log in again to access the BCC Riders Club app.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogoutModal(false);
                      logout();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
              {activeSubTab === 'finance' && <Wallet className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'reports' && <FileSpreadsheet className="w-4 h-4 text-[#74c69d]" />}
              {activeSubTab === 'security' && <Shield className="w-4 h-4 text-[#74c69d]" />}
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
                      setActiveSubTab(tab.id as 'finance' | 'reports' | 'security');
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
        <div className="space-y-6 sm:space-y-8">
          {/* Section 1: Standard Fee Configuration */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-base sm:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#2d6a4f]" />
                  Standard Fee Rates
                </h2>
              </div>

              {feeSavedToast && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Fee Rates Saved Successfully!</span>
                </motion.div>
              )}
            </div>

            <form onSubmit={handleSaveFees} className="space-y-4 max-w-md w-full">
              {/* Membership Fee */}
              <div className="space-y-1.5 bg-[#f7f9f7] p-3.5 sm:p-4 rounded-2xl border border-[#e2ece2]">
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
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-[#52605d]">₱</span>
                </div>
                <span className="text-[10px] text-[#52605d]">Base membership joining fee</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02]"
                >
                  <Save className="w-4 h-4" />
                  <span>Update & Save Fee Rates</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Monthly Dues Management */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-base sm:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#2d6a4f]" />
                  Monthly Dues Management
                </h2>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateDue}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl sm:rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] shrink-0"
              >
                <Plus className="w-4 h-4 text-[#74c69d]" />
                <span>Create Monthly Due</span>
              </button>
            </div>

            {/* Monthly Dues Grid / List */}
            <div className="space-y-4">
              {monthlyDues.length === 0 ? (
                <div className="p-6 sm:p-8 text-center bg-[#f7f9f7] rounded-2xl border border-dashed border-[#e2ece2] space-y-2">
                  <Receipt className="w-8 h-8 text-[#52605d] mx-auto" />
                  <p className="text-xs text-[#52605d] font-bold">No Monthly Dues Configured</p>
                  <p className="text-[11px] text-[#52605d]">
                    Click "Create Monthly Due" to set up a monthly due amount for a specific month and year.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {monthlyDues.map((due) => {
                    const totalPendingCollection = approvedMemberCount * due.amount;
                    return (
                      <div
                        key={due.id}
                        className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs hover:border-[#2d6a4f] transition-all space-y-3 sm:space-y-4 relative overflow-hidden"
                      >
                        {/* Header: Period & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#d8f3dc] text-[#1b4332] text-[10px] font-extrabold mb-1">
                              <Calendar className="w-3 h-3 text-[#2d6a4f]" />
                              {due.month} {due.year}
                            </span>
                            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base leading-tight">
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
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-3 border-t border-[#e2ece2] text-xs">
                          <div className="bg-[#f7f9f7] p-2.5 sm:p-3 rounded-xl border border-[#e2ece2] min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-[#52605d] font-bold block truncate">
                              Due Amount Per Member
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{(Number(due.amount) || 0).toLocaleString()}
                            </span>
                          </div>

                          <div className="bg-[#e8f5e9] p-2.5 sm:p-3 rounded-xl border border-[#c8e6c9] min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-[#2d6a4f] font-extrabold block truncate">
                              Total Pending Collection
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{(Number(totalPendingCollection) || 0).toLocaleString()}
                            </span>
                            <span className="text-[9px] text-[#2d6a4f] block mt-0.5 truncate">
                              ({approvedMemberCount} members × ₱{due.amount})
                            </span>
                          </div>
                        </div>

                        {due.notes && (
                          <p className="text-[11px] text-[#52605d] italic bg-[#f7f9f7] p-2 rounded-lg border border-[#e2ece2]">
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
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-3.5 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-[#e2ece2]">
              <div>
                <h3 className="font-heading text-base sm:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
                  <span>Promotional Campaigns & Packages</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5 sm:mt-1">
                  Active promotional offers, upfront annual discounts, and seasonal campaign rates
                </p>
              </div>
              <span className="self-start sm:self-center text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-700 shrink-0" />
                <span>January Campaign Window</span>
              </span>
            </div>

            <div className="p-3 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f7f9f7] via-emerald-50/60 to-[#f7f9f7] border border-[#e2ece2] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider whitespace-nowrap">
                    Annual Upfront Promo
                  </span>
                  <span className="text-xs font-bold text-[#1b4332]">Full Year Monthly Dues Package</span>
                </div>
                <span className={`text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 rounded-full border self-start sm:self-auto shrink-0 ${
                  new Date().getMonth() === 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {new Date().getMonth() === 0 ? '🟢 Active Campaign (January)' : '🗓️ Available in January'}
                </span>
              </div>

              <p className="text-xs text-[#52605d] leading-relaxed">
                Members who pay for a full year upfront during the month of <strong>January</strong> receive a discounted flat rate of <strong>₱1,000</strong> for all 12 monthly dues (regular value: ₱1,200/year at ₱100/month).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-white p-3 rounded-xl border border-[#e2ece2] flex flex-col justify-center min-w-0">
                  <span className="text-[10px] text-[#52605d] font-bold block uppercase tracking-wider">Promo Price</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base sm:text-lg font-black text-[#1b4332]">₱1,000.00</span>
                    <span className="text-xs text-[#52605d] font-semibold">/ yr</span>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e2ece2] flex flex-col justify-center min-w-0">
                  <span className="text-[10px] text-[#52605d] font-bold block uppercase tracking-wider">Regular Value</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base sm:text-lg font-black text-slate-400 line-through">₱1,200.00</span>
                    <span className="text-xs text-slate-400 font-semibold">/ yr</span>
                  </div>
                </div>
                <div className="bg-emerald-100/80 p-3 rounded-xl border border-emerald-200 flex flex-col justify-center min-w-0">
                  <span className="text-[10px] text-emerald-800 font-extrabold block uppercase tracking-wider">Member Savings</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-base sm:text-lg font-black text-emerald-900">₱200.00</span>
                    <span className="text-xs font-extrabold text-emerald-700">(16.7% OFF)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Collections Management */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-base sm:text-lg font-black text-[#1b4332] flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-[#2d6a4f]" />
                  Dynamic Custom Collections
                </h2>
                <p className="text-xs text-[#52605d] mt-1">
                  Create custom payment drives, special event tickets, or uniform/merchandise collections with custom amounts.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateCollection}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl sm:rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] shrink-0"
              >
                <Plus className="w-4 h-4 text-[#74c69d]" />
                <span>Create Collection</span>
              </button>
            </div>

            {/* Collections Grid */}
            <div className="space-y-4">
              {dynamicCollections.length === 0 ? (
                <div className="p-6 sm:p-8 text-center bg-[#f7f9f7] rounded-2xl border border-dashed border-[#e2ece2] space-y-2">
                  <Layers className="w-8 h-8 text-[#52605d] mx-auto" />
                  <p className="text-xs text-[#52605d] font-bold">No Custom Collections Created</p>
                  <p className="text-[11px] text-[#52605d]">
                    Add dynamic collections for merchandise, fellowship tours, or special fundraisers.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {dynamicCollections.map((col) => {
                    const totalTargetCollection =
                      col.targetAmount !== undefined && col.targetAmount !== null && !isNaN(Number(col.targetAmount)) && Number(col.targetAmount) > 0
                        ? Number(col.targetAmount)
                        : approvedMemberCount * col.amount;
                    return (
                      <div
                        key={col.id}
                        className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e2ece2] shadow-xs hover:border-[#2d6a4f] transition-all space-y-3 sm:space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold mb-1">
                              <Receipt className="w-3 h-3 text-amber-700" />
                              Custom Collection
                            </span>
                            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base leading-tight">
                              {col.name}
                            </h3>
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
                          <p className="text-xs text-[#52605d] leading-relaxed">
                            {col.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-3 border-t border-[#e2ece2] text-xs">
                          <div className="bg-[#f7f9f7] p-2.5 sm:p-3 rounded-xl border border-[#e2ece2] min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-[#52605d] font-bold block truncate">
                              Set Collection Amount
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{(Number(col.amount) || 0).toLocaleString()}
                            </span>
                          </div>

                          <div className="bg-amber-50 p-2.5 sm:p-3 rounded-xl border border-amber-200 min-w-0">
                            <span className="text-[9px] sm:text-[10px] text-amber-800 font-extrabold block truncate">
                              Expected Target Collection
                            </span>
                            <span className="text-sm sm:text-base font-black text-[#1b4332] truncate block">
                              ₱{(Number(totalTargetCollection) || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
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
        <div className="space-y-6 sm:space-y-8">
          {/* Header & Controls Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-[#e2ece2] shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2ece2]">
              <div>
                <h2 className="font-heading text-base sm:text-lg md:text-xl font-black text-[#1b4332] flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-[#2d6a4f]" />
                  Reports & Export Center
                </h2>
                <p className="text-xs text-[#52605d] mt-1">
                  Export audit-ready CSV ledgers, active member directories, transaction history, and accounting financial statements
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loadReportsData}
                  className="px-3 py-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  <span>Refresh</span>
                </button>

                <div className="relative" ref={yearDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                    className="flex items-center gap-1.5 bg-[#f7f9f7] hover:bg-[#e8f5e9] px-3 py-1.5 rounded-xl border border-[#e2ece2] text-xs font-bold transition-all cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span className="text-[11px] font-bold text-[#52605d]">Year:</span>
                    <span className="font-extrabold text-[#1b4332]">
                      {reportYearFilter === 'All' ? 'All Time' : reportYearFilter}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#2d6a4f] transition-transform duration-200 ${
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
                        className="absolute right-0 sm:left-0 mt-1.5 w-36 bg-white border border-[#e2ece2] rounded-2xl shadow-xl z-50 overflow-hidden py-1"
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
                              className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
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
                    downloadCSVFile(
                      `BRC_Master_Executive_Financial_Report_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.csv`,
                      stmtData.headers,
                      stmtData.rows
                    );
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                </button>
              </div>
            </div>

            {/* Quick Accounting Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#f7f9f7] p-3.5 sm:p-4 rounded-2xl border border-[#e2ece2]">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-[#2d6a4f]" />
                  <span className="text-[10px] font-bold uppercase text-[#52605d]">Active Members</span>
                </div>
                <span className="text-base sm:text-lg font-black text-[#1b4332]">
                  {reportUsers.filter((u) => u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin')).length}
                </span>
                <span className="text-[10px] text-[#52605d] block">Approved Membership Roster</span>
              </div>

              <div className="bg-emerald-50/70 p-3.5 sm:p-4 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                  <span className="text-[10px] font-extrabold uppercase text-emerald-900">Total Income</span>
                </div>
                <span className="text-base sm:text-lg font-black text-emerald-950">
                  ₱
                  {reportPayments
                    .filter((p) => p.status === 'Paid')
                    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-800 block">Total Collections</span>
              </div>

              <div className="bg-rose-50/70 p-3.5 sm:p-4 rounded-2xl border border-rose-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-rose-700" />
                  <span className="text-[10px] font-extrabold uppercase text-rose-900">Disbursements</span>
                </div>
                <span className="text-base sm:text-lg font-black text-rose-950">
                  ₱
                  {reportExpenses
                    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-rose-800 block">Total Liquidation Expenses</span>
              </div>

              <div className="bg-amber-50/70 p-3.5 sm:p-4 rounded-2xl border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-amber-700" />
                  <span className="text-[10px] font-extrabold uppercase text-amber-900">Net Surplus</span>
                </div>
                <span className="text-base sm:text-lg font-black text-amber-950">
                  ₱
                  {(
                    reportPayments
                      .filter((p) => p.status === 'Paid')
                      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0) -
                    reportExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-amber-800 block">Net Operating Cash Flow</span>
              </div>
            </div>
          </div>

          {/* Export Report Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Card 1: Members Directory CSV */}
            <div className="bg-white rounded-2xl p-5 border border-[#e2ece2] shadow-xs space-y-4 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5 text-emerald-700" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 uppercase">
                    Member Records
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                  Active Members Data Directory
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export full profile records of active and approved members, including contact numbers, chapters, designations, motorcycle details, and church network affiliations.
                </p>
              </div>

              <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {reportUsers.filter((u) => u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin')).length} Member Profiles
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMembersReportData();
                      setPreviewModal({
                        title: 'Active Members Directory Preview',
                        subtitle: 'Sample view of member directory CSV records',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadCSVFile(`BRC_Active_Members_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows),
                      });
                    }}
                    className="p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMembersReportData();
                      downloadCSVFile(`BRC_Active_Members_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Transaction Data & Collections Register CSV */}
            <div className="bg-white rounded-2xl p-5 border border-[#e2ece2] shadow-xs space-y-4 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                    <Wallet className="w-5 h-5 text-blue-700" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 uppercase">
                    Collections Register
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                  Transaction Data & Revenue Ledger
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export complete itemized receipt logs for membership fees, monthly dues, upfront annual promos, and custom project collections with payment methods and reference numbers.
                </p>
              </div>

              <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {reportPayments.length} Transaction Records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getTransactionsReportData();
                      setPreviewModal({
                        title: 'Transaction Data Ledger Preview',
                        subtitle: 'Sample view of collections & dues receipt transactions',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadCSVFile(`BRC_Transactions_Register_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows),
                      });
                    }}
                    className="p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getTransactionsReportData();
                      downloadCSVFile(`BRC_Transactions_Register_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Disbursements & Expenses Register CSV */}
            <div className="bg-white rounded-2xl p-5 border border-[#e2ece2] shadow-xs space-y-4 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                    <TrendingUp className="w-5 h-5 text-rose-700" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 uppercase">
                    Disbursements Log
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                  Disbursements & Expense Register
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export liquidation records of all club disbursements, event expenses, CSR outreach, ride logistics, emergency assistance funds, and operational costs.
                </p>
              </div>

              <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {reportExpenses.length} Expense Logs
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getExpensesReportData();
                      setPreviewModal({
                        title: 'Disbursements & Expense Register Preview',
                        subtitle: 'Sample view of liquidation and expense records',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadCSVFile(`BRC_Expenses_Disbursements_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows),
                      });
                    }}
                    className="p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getExpensesReportData();
                      downloadCSVFile(`BRC_Expenses_Disbursements_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: Accounting Financial Statement CSV */}
            <div className="bg-white rounded-2xl p-5 border border-[#e2ece2] shadow-xs space-y-4 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                    <BarChart3 className="w-5 h-5 text-purple-700" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 uppercase">
                    Financial Statement
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                  Executive Financial Report & Cash Flow
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export executive financial statements with Executive Revenue vs Disbursement summaries, Category-by-category Inflow breakdowns, and Net Operating Surplus margins.
                </p>
              </div>

              <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  Accounting Summary
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getFinancialStatementReportData();
                      setPreviewModal({
                        title: 'Executive Financial Statement Preview',
                        subtitle: 'Overview of revenue, expenses, and net surplus',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadCSVFile(`BRC_Financial_Statement_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows),
                        onXlsDownload: () => downloadXLSFile(`BRC_Financial_Statement_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.xls`, data.headers, data.rows),
                        onPdfDownload: exportFinancialStatementPDF,
                      });
                    }}
                    className="p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getFinancialStatementReportData();
                      downloadCSVFile(`BRC_Financial_Statement_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getFinancialStatementReportData();
                      downloadXLSFile(`BRC_Financial_Statement_${reportYearFilter}_${new Date().toISOString().slice(0, 10)}.xls`, data.headers, data.rows);
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export Formatted Excel (.xls)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={exportFinancialStatementPDF}
                    className="px-3.5 py-2 rounded-xl bg-purple-900 hover:bg-purple-950 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Export PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 5: Member Dues Compliance & Aging Ledger CSV */}
            <div className="bg-white rounded-2xl p-5 border border-[#e2ece2] shadow-xs space-y-4 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5 text-teal-700" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-900 uppercase">
                    Aging & Compliance
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                  Member Dues Compliance Ledger
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export per-member compliance ledger displaying total dues paid, upfront annual promo enrollment status, pending months count, and outstanding balances.
                </p>
              </div>

              <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {reportUsers.filter((u) => u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin')).length} Compliance Records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMemberComplianceReportData();
                      setPreviewModal({
                        title: 'Member Dues Compliance Ledger Preview',
                        subtitle: 'Sample view of member compliance and overdue dues status',
                        headers: data.headers,
                        rows: data.rows,
                        onDownload: () => downloadCSVFile(`BRC_Member_Compliance_Ledger_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows),
                      });
                    }}
                    className="p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
                    title="Preview Data"
                  >
                    <Eye className="w-4 h-4 text-[#2d6a4f]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const data = getMemberComplianceReportData();
                      downloadCSVFile(`BRC_Member_Compliance_Ledger_${new Date().toISOString().slice(0, 10)}.csv`, data.headers, data.rows);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 6: Dynamic Custom Collections Ledger CSV */}
            <div className="bg-white rounded-2xl p-5 border border-[#e2ece2] shadow-xs space-y-4 hover:border-[#2d6a4f] transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Layers className="w-5 h-5 text-amber-700" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 uppercase">
                    Custom Projects
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                  Dynamic Collections & Special Projects Ledger
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Export progress ledgers for dynamic custom collections (e.g. Anniversary Vest, Building Fund, CSR Drive) detailing target goals, collected amounts, and progress percentages.
                </p>
              </div>

              <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1b4332]">
                  {dynamicCollections.length} Collection Items
                </span>
                <div className="flex items-center gap-2">
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
                        title: 'Dynamic Custom Collections Preview',
                        subtitle: 'Overview of custom collection items and status',
                        headers,
                        rows,
                        onDownload: () => downloadCSVFile(`BRC_Dynamic_Collections_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows),
                      });
                    }}
                    className="p-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e8f5e9] text-[#1b4332] border border-[#e2ece2] text-xs font-bold cursor-pointer"
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
                      downloadCSVFile(`BRC_Dynamic_Collections_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Report Data Preview Modal */}
          <AnimatePresence>
            {previewModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-[#e2ece2] shadow-2xl overflow-hidden"
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
                        Showing first 50 rows of {previewModal.rows.length} total records. Download CSV to view full dataset.
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
                      {previewModal.onXlsDownload && (
                        <button
                          type="button"
                          onClick={() => {
                            previewModal.onXlsDownload!();
                            setPreviewModal(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title="Export Formatted Excel (.xls)"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Excel</span>
                        </button>
                      )}
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
                        title="Export CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SUB TAB 3: SYSTEM SECURITY */}
      {activeSubTab === 'security' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e2ece2] shadow-xs space-y-6">
          <div className="pb-4 border-b border-[#e2ece2]">
            <h2 className="font-heading text-lg font-black text-[#1b4332] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#2d6a4f]" />
              System & Security Settings
            </h2>
            <p className="text-xs text-[#52605d] mt-1">
              Manage your administrator session and account security
            </p>
          </div>

          {/* Sign Out Card */}
          <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-700" />
                <h3 className="font-heading font-extrabold text-rose-950 text-sm">
                  Executive Account Session
                </h3>
              </div>
              <p className="text-xs text-[#52605d]">
                Sign out of your administrator account session safely when done.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2 shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Account</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT MONTHLY DUE */}
      <AnimatePresence>
        {showMonthlyDueModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#e2ece2] space-y-6 relative my-8"
            >
              <button
                type="button"
                onClick={() => setShowMonthlyDueModal(false)}
                className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-lg">
                    {editingDue ? 'Edit Monthly Due' : 'Create Monthly Due'}
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Set monthly due amount for a specific month and year period
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitDue} className="space-y-4 text-xs">
                {/* Amount Due */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Amount Due Per Member (₱) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={dueAmount}
                      onChange={(e) => setDueAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <span className="absolute left-3 top-3 text-xs font-bold text-[#52605d]">₱</span>
                  </div>
                </div>

                {/* Amount Due Period: Month & Year Dropdown Selection */}
                <div className="grid grid-cols-2 gap-3 bg-[#f0f9f1] p-3.5 rounded-2xl border border-[#c8e6c9]">
                  <CustomSelect
                    label="Select Month"
                    required
                    value={dueMonth}
                    onChange={(val) => setDueMonth(val)}
                    options={MONTH_OPTIONS}
                  />

                  <CustomSelect
                    label="Select Year"
                    required
                    value={dueYear}
                    onChange={(val) => setDueYear(val)}
                    options={YEAR_OPTIONS}
                  />
                </div>

                {/* Live Calculated Pending Collection Preview */}
                <div className="p-3.5 bg-[#1b4332] text-white rounded-2xl space-y-1">
                  <span className="text-[10px] text-[#74c69d] font-bold uppercase tracking-wider block">
                    Calculated Total Pending Collection
                  </span>
                  <div className="text-lg font-black text-white">
                    ₱{(approvedMemberCount * (Number(dueAmount) || 0)).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#d8f3dc] block">
                    Based on {approvedMemberCount} approved member account(s)
                  </span>
                </div>



                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setShowMonthlyDueModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                    <span>{editingDue ? 'Save Changes' : 'Save Monthly Due'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE / EDIT DYNAMIC COLLECTION */}
      <AnimatePresence>
        {showCollectionModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#e2ece2] space-y-6 relative my-8"
            >
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-lg">
                    {editingCollection ? 'Edit Dynamic Collection' : 'Create Dynamic Collection'}
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Name the custom collection and set amount & target period
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitCollection} className="space-y-4 text-xs">
                {/* Collection Name */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Collection Name / Title <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={colName}
                    onChange={(e) => setColName(e.target.value)}
                    placeholder="e.g., Annual Fellowship Gala Shirt, Outreach Relief Fund"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Amount Per Contributor (₱) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={colAmount}
                      onChange={(e) => setColAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <span className="absolute left-3 top-3 text-xs font-bold text-[#52605d]">₱</span>
                  </div>
                </div>

                {/* Expected Target Collection */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Expected Target Collection (₱) <span className="text-[10px] font-normal text-[#52605d]">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={colTargetAmount}
                      onChange={(e) => setColTargetAmount(e.target.value)}
                      placeholder={`Auto: ₱${(approvedMemberCount * (Number(colAmount) || 0)).toLocaleString()}`}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm font-extrabold text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <span className="absolute left-3 top-3 text-xs font-bold text-[#52605d]">₱</span>
                  </div>
                  <p className="text-[10px] text-[#52605d] mt-1">
                    Custom target goal amount, or leave blank to auto-calculate (₱{colAmount || 0} × {approvedMemberCount} members).
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="font-bold text-[#1b4332] mb-1 block">
                    Description / Details
                  </label>
                  <textarea
                    rows={2}
                    value={colDescription}
                    onChange={(e) => setColDescription(e.target.value)}
                    placeholder="Details about what this custom collection covers..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] resize-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e2ece2]">
                  <button
                    type="button"
                    onClick={() => setShowCollectionModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                    <span>{editingCollection ? 'Save Collection' : 'Create Collection'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DELETE MODAL */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 border border-[#e2ece2] shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-[#1b4332] text-base">
                  Confirm Item Deletion?
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-rose-700">"{deleteTarget.name}"</strong>?
                  This financial item will be removed from your system records.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAction}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                >
                  Yes, Delete Item
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* SIGN OUT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-5 border border-[#e2ece2] shadow-2xl relative"
            >
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                <LogOut className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-heading text-lg font-extrabold text-[#1b4332]">
                  Sign Out of Account?
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed">
                  Are you sure you want to sign out of your executive account? You will need to log in again to access the BCC Riders Club app.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-[#f7f9f7] font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutModal(false);
                    logout();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
