import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArchivePackageData, FinanceRecord, ExpenseRecord, User, DynamicCollection, FinanceYearArchive } from '../types';

/**
 * Builds the comprehensive archive package structure for a given fiscal year.
 */
export function buildArchivePackageData(params: {
  year: number;
  records: FinanceRecord[];
  expenses: ExpenseRecord[];
  users: User[];
  dynamicCols?: DynamicCollection[];
  auditedBy: string;
  auditNotes?: string;
}): ArchivePackageData {
  const { year, records, expenses, users, dynamicCols = [], auditedBy, auditNotes } = params;
  const yearStr = String(year);

  // 1. Filter Records & Expenses for the outgoing year
  const yearRecords = records.filter((r) => {
    const pDate = r.paidDate || r.dueDate || r.updatedAt || '';
    const covMonth = r.coveredMonth || '';
    const custName = r.customItemName || '';
    return (
      pDate.includes(yearStr) ||
      covMonth.includes(yearStr) ||
      custName.includes(yearStr)
    );
  });

  const yearExpenses = expenses.filter((e) => {
    const eDate = e.date || e.updatedAt || '';
    return eDate.includes(yearStr);
  });

  // Active Approved Non-Admin Members
  const activeMembersList = users.filter((u) => {
    const isUserAdmin =
      u.role === 'admin' ||
      u.role?.toLowerCase() === 'admin' ||
      u.role?.toLowerCase() === 'administrator' ||
      u.id === 'usr_admin' ||
      u.id === 'admin';
    if (isUserAdmin) return false;
    return u.approvalStatus === 'Approved' || (!u.approvalStatus && u.role !== 'admin');
  });

  // Calculate totals
  const paidYearRecords = yearRecords.filter((r) => r.status === 'Paid');
  const totalIncome = paidYearRecords.reduce((sum, r) => {
    if (r.itemType === 'Monthly Due' && r.notes?.includes('Satisfied by Annual Upfront Promo Package')) {
      return sum;
    }
    return sum + (Number(r.amount) || 0);
  }, 0);

  const totalDisbursements = yearExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netSurplus = totalIncome - totalDisbursements;

  // 2. Active Members Roster
  const activeMembers = activeMembersList.map((u) => ({
    id: u.id,
    name: u.name || 'N/A',
    memberNumber: u.memberNumber || u.id || 'N/A',
    role: u.role || 'Member',
    chapter: u.chapter || 'Main Chapter',
    phone: u.phone || 'N/A',
    email: u.email || 'N/A',
    bikeInfo: u.bikeInfo ? `${u.bikeInfo.year || ''} ${u.bikeInfo.make || ''} ${u.bikeInfo.model || ''} (${u.bikeInfo.licensePlate || u.bikeInfo.plateNo || 'N/A'})`.trim() : 'N/A',
    affiliation: u.affiliation || u.network || 'N/A',
    joinDate: u.joinDate || 'N/A',
    status: u.approvalStatus || 'Approved',
  }));

  // 3. Collections Register
  const collectionsRegister = yearRecords.map((r) => ({
    id: r.id,
    date: r.paidDate || r.dueDate || 'N/A',
    memberName: r.userName || 'N/A',
    memberNo: r.userMemberNo || r.userId || 'N/A',
    itemType: r.itemType,
    description: r.customItemName || r.coveredMonth || r.itemType,
    amount: Number(r.amount) || 0,
    status: r.status,
    paymentMethod: r.paymentMethod || 'Cash',
    referenceNo: r.referenceNo || 'N/A',
    notes: r.notes || '',
  }));

  // 4. Disbursements Log
  const disbursementsLog = yearExpenses.map((e) => ({
    id: e.id,
    date: e.date || 'N/A',
    title: e.title || 'General Expense',
    category: e.category || 'Other',
    amount: Number(e.amount) || 0,
    payee: e.payeeOrDisbursedTo || 'N/A',
    loggedBy: e.loggedBy || 'Treasurer',
    receiptRef: e.receiptRef || 'N/A',
    notes: e.notes || '',
  }));

  // 5. Financial Statement breakdown
  const incomeByCategory: Record<string, number> = {};
  paidYearRecords.forEach((r) => {
    const key = r.itemType || 'Other Income';
    incomeByCategory[key] = (incomeByCategory[key] || 0) + (Number(r.amount) || 0);
  });

  const expensesByCategory: Record<string, number> = {};
  yearExpenses.forEach((e) => {
    const key = e.category || 'General Expense';
    expensesByCategory[key] = (expensesByCategory[key] || 0) + (Number(e.amount) || 0);
  });

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthlyBreakdown = MONTHS.map((m) => {
    const mPrefix = `${year}-${String(MONTHS.indexOf(m) + 1).padStart(2, '0')}`;
    const mIncome = paidYearRecords
      .filter((r) => (r.paidDate && r.paidDate.startsWith(mPrefix)) || (r.coveredMonth && r.coveredMonth.includes(m)))
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const mExpense = yearExpenses
      .filter((e) => e.date && e.date.startsWith(mPrefix))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    return {
      month: m,
      income: mIncome,
      expenses: mExpense,
      surplus: mIncome - mExpense,
    };
  });

  // 6. Aging & Compliance
  const agingAndCompliance = activeMembersList.map((u) => {
    const userRecs = yearRecords.filter((r) => r.userId === u.id);
    const hasMembershipFeePaid = userRecs.some((r) => r.itemType === 'Membership Fee' && r.status === 'Paid');
    const hasAnnualPromo = userRecs.some((r) => r.itemType === 'Annual Upfront Promo' && r.status === 'Paid');

    const paidDues = userRecs.filter(
      (r) => (r.itemType === 'Monthly Due' || r.itemType === 'Annual Upfront Promo') && r.status === 'Paid'
    );
    const pendingDues = userRecs.filter(
      (r) => r.itemType === 'Monthly Due' && (r.status === 'Pending' || r.status === 'Overdue')
    );

    const overdueAmount = pendingDues.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const paidMonthsCount = hasAnnualPromo ? 12 : paidDues.length;
    const pendingMonthsCount = hasAnnualPromo ? 0 : pendingDues.length;
    const complianceRate = hasAnnualPromo || paidMonthsCount >= 12 ? '100%' : `${Math.round((paidMonthsCount / 12) * 100)}%`;

    return {
      memberId: u.id,
      memberName: u.name,
      memberNo: u.memberNumber || u.id,
      role: u.role || 'Member',
      membershipFeePaid: hasMembershipFeePaid,
      annualPromoEnrolled: hasAnnualPromo,
      paidMonthsCount,
      pendingMonthsCount,
      overdueAmount,
      complianceRate,
    };
  });

  // 7. Custom Projects
  const customProjects = dynamicCols.map((col) => {
    const colPayments = yearRecords.filter(
      (r) =>
        r.status === 'Paid' &&
        (r.customItemName === col.name || (r.coveredMonth && r.coveredMonth === col.name))
    );
    const totalCol = colPayments.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const colExpenses = yearExpenses.filter(
      (e) => (e.notes && e.notes.includes(col.name)) || (e.title && e.title.includes(col.name))
    );
    const totalExp = colExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    return {
      id: col.id,
      name: col.name,
      type: col.collectionType || 'Standard',
      targetAmount: col.targetAmount,
      amountPerMember: col.amount,
      totalCollected: totalCol,
      totalExpenses: totalExp,
      netBalance: totalCol - totalExp,
      status: col.status,
      donorName: col.donorName,
    };
  });

  return {
    manifest: {
      archiveId: `archive_${year}`,
      clubName: 'BCC Riders Club',
      year,
      archivedAt: new Date().toISOString(),
      archivedBy: auditedBy || 'Club Treasurer & System Administrator',
      isAudited: true,
      auditNotes: auditNotes || `Complete Audited Financial Archive for Fiscal Year ${year} (January 1 - December 31).`,
      totalIncome,
      totalDisbursements,
      netSurplus,
      carriedOverTreasury: netSurplus,
      activeMemberCount: activeMembers.length,
      totalTransactionsCount: collectionsRegister.length,
      totalExpensesCount: disbursementsLog.length,
      version: '1.0.0',
    },
    activeMembers,
    collectionsRegister,
    disbursementsLog,
    financialStatement: {
      year,
      totalIncome,
      totalDisbursements,
      netSurplus,
      incomeByCategory,
      expensesByCategory,
      monthlyBreakdown,
    },
    agingAndCompliance,
    customProjects,
  };
}

/**
 * Packs the archive data into a compressed .zip file and triggers browser download.
 */
export async function downloadZipArchive(archiveData: ArchivePackageData): Promise<Blob> {
  const zip = new JSZip();
  const year = archiveData.manifest.year;
  const folderName = `BCC_Financial_Archive_${year}`;
  const root = zip.folder(folderName) || zip;

  // 1. Manifest
  root.file('archive_manifest.json', JSON.stringify(archiveData.manifest, null, 2));

  // 2. Summary Income Statement
  root.file('summary_income_statement.json', JSON.stringify(archiveData.financialStatement, null, 2));

  // 3. Active Members Roster
  root.file('members_roster.json', JSON.stringify(archiveData.activeMembers, null, 2));

  // 4. Collections Register
  root.file('collections_register.json', JSON.stringify(archiveData.collectionsRegister, null, 2));

  // 5. Disbursements Log
  root.file('disbursements_log.json', JSON.stringify(archiveData.disbursementsLog, null, 2));

  // 6. Aging & Compliance
  root.file('member_compliance.json', JSON.stringify(archiveData.agingAndCompliance, null, 2));

  // 7. Custom Projects
  root.file('custom_projects.json', JSON.stringify(archiveData.customProjects, null, 2));

  // 8. Human-Readable Audit Report Text
  const auditReportText = `
========================================================================
             BCC RIDERS CLUB - AUDITED FINANCIAL ARCHIVE
========================================================================
Fiscal Year: ${year} (January 1 - December 31)
Date Archived: ${new Date(archiveData.manifest.archivedAt).toLocaleString()}
Audited & Verified By: ${archiveData.manifest.archivedBy}
Audit Resolution Notes: ${archiveData.manifest.auditNotes || 'Reconciled and certified.'}

------------------------------------------------------------------------
EXECUTIVE FINANCIAL METRICS
------------------------------------------------------------------------
  • Active Members Roster:       ${archiveData.manifest.activeMemberCount} Members
  • Total Revenue & Collections: ₱${archiveData.manifest.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
  • Total Disbursements:         ₱${archiveData.manifest.totalDisbursements.toLocaleString('en-US', { minimumFractionDigits: 2 })}
  • Net Operating Surplus:       ₱${archiveData.manifest.netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
  • Net Treasury Carried Over:   ₱${archiveData.manifest.carriedOverTreasury.toLocaleString('en-US', { minimumFractionDigits: 2 })}

------------------------------------------------------------------------
RECORD BOOKS INCLUDED IN ARCHIVE
------------------------------------------------------------------------
  1. Active Members Directory (${archiveData.activeMembers.length} records)
  2. Total Income Collections (${archiveData.collectionsRegister.length} transactions)
  3. Disbursements Liquidation Log (${archiveData.disbursementsLog.length} items)
  4. Executive Financial Statement (Income Statement & Monthly Cash Flow)
  5. Member Dues Aging & Compliance Ledger (${archiveData.agingAndCompliance.length} records)
  6. Dynamic Collections & Custom Projects (${archiveData.customProjects.length} projects)

========================================================================
Certified by:
Club Treasurer & Executive Council &bull; BCC Riders Club
========================================================================
  `.trim();

  root.file('README_AUDIT_REPORT.txt', auditReportText);

  // Generate zip binary
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BCC_Financial_Archive_${year}_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return blob;
}

/**
 * Extracts an uploaded .zip archive file and parses its contents into ArchivePackageData.
 */
export async function extractZipArchive(file: File | Blob): Promise<ArchivePackageData> {
  const zip = await JSZip.loadAsync(file);

  // Find files inside zip (handling optional root directory)
  const findFile = (filename: string) => {
    return Object.keys(zip.files).find((f) => f.endsWith(filename));
  };

  const manifestPath = findFile('archive_manifest.json');
  let manifest: any = null;
  if (manifestPath) {
    const raw = await zip.files[manifestPath].async('string');
    manifest = JSON.parse(raw);
  }

  const parseJsonFile = async <T>(filename: string, fallback: T): Promise<T> => {
    const path = findFile(filename);
    if (!path) return fallback;
    try {
      const raw = await zip.files[path].async('string');
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const activeMembers = await parseJsonFile('members_roster.json', []);
  const collectionsRegister = await parseJsonFile('collections_register.json', []);
  const disbursementsLog = await parseJsonFile('disbursements_log.json', []);
  const financialStatement = await parseJsonFile('summary_income_statement.json', {
    year: manifest?.year || new Date().getFullYear(),
    totalIncome: manifest?.totalIncome || 0,
    totalDisbursements: manifest?.totalDisbursements || 0,
    netSurplus: manifest?.netSurplus || 0,
    incomeByCategory: {},
    expensesByCategory: {},
    monthlyBreakdown: [],
  });
  const agingAndCompliance = await parseJsonFile('member_compliance.json', []);
  const customProjects = await parseJsonFile('custom_projects.json', []);

  const year = manifest?.year || (collectionsRegister[0]?.date ? parseInt(collectionsRegister[0].date.slice(0, 4), 10) : new Date().getFullYear());

  const completedManifest = manifest || {
    archiveId: `archive_${year}`,
    clubName: 'BCC Riders Club',
    year,
    archivedAt: new Date().toISOString(),
    archivedBy: 'Club Treasurer & System Administrator',
    isAudited: true,
    auditNotes: `Audited Financial Archive for Fiscal Year ${year}.`,
    totalIncome: collectionsRegister.reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0),
    totalDisbursements: disbursementsLog.reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0),
    netSurplus: 0,
    carriedOverTreasury: 0,
    activeMemberCount: activeMembers.length,
    totalTransactionsCount: collectionsRegister.length,
    totalExpensesCount: disbursementsLog.length,
    version: '1.0.0',
  };

  if (!completedManifest.netSurplus) {
    completedManifest.netSurplus = completedManifest.totalIncome - completedManifest.totalDisbursements;
    completedManifest.carriedOverTreasury = completedManifest.netSurplus;
  }

  return {
    manifest: completedManifest,
    activeMembers,
    collectionsRegister,
    disbursementsLog,
    financialStatement,
    agingAndCompliance,
    customProjects,
  };
}

/**
 * Builds and downloads a multi-tab Excel Workbook (.xlsx) with all 10 records cleanly separated.
 */
export function exportArchiveToMultiTabXLSX(data: ArchivePackageData) {
  const wb = XLSX.utils.book_new();
  const year = data.manifest.year;

  // TAB 1: Executive Summary
  const summaryAoa = [
    ['BCC RIDERS CLUB - AUDITED FINANCIAL ARCHIVE SUMMARY'],
    [`Fiscal Year: ${year}`, `Audited Date: ${new Date(data.manifest.archivedAt).toLocaleDateString()}`],
    [`Audited By: ${data.manifest.archivedBy}`, `Status: Audited & Closed`],
    [''],
    ['KEY PERFORMANCE INDICATORS', 'AMOUNT / COUNT', 'DESCRIPTION'],
    ['Active Members Roster', data.manifest.activeMemberCount, 'Approved club membership count'],
    ['Total Income / Collections (PHP)', data.manifest.totalIncome, 'Membership fees, dues, promos, donations'],
    ['Total Disbursements / Liquidation (PHP)', data.manifest.totalDisbursements, 'Operating and event expenses'],
    ['Net Surplus (PHP)', data.manifest.netSurplus, 'Audited Net Treasury surplus'],
    ['Carried Over Net Treasury (PHP)', data.manifest.carriedOverTreasury, 'Balance forwarded to subsequent fiscal funds'],
    ['Total Transactions Processed', data.manifest.totalTransactionsCount, 'Receipted collections'],
    ['Total Liquidated Expense Logs', data.manifest.totalExpensesCount, 'Audited disbursement vouchers'],
    [''],
    ['AUDIT RESOLUTION NOTES'],
    [data.manifest.auditNotes || 'Reconciled and approved.'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // TAB 2: Financial Statement
  const fsAoa: (string | number)[][] = [
    ['BCC RIDERS CLUB - OFFICIAL INCOME STATEMENT', `FY ${year}`],
    ['Period Covered: January 1 - December 31', `Archived: ${new Date(data.manifest.archivedAt).toLocaleDateString()}`],
    [''],
    ['ACCOUNT / PARTICULAR', 'AMOUNT (PHP)'],
    ['FUNDS & REVENUES', ''],
  ];

  if (Object.keys(data.financialStatement.incomeByCategory || {}).length === 0) {
    fsAoa.push(['  No funds items recorded', 0]);
  } else {
    Object.entries(data.financialStatement.incomeByCategory).forEach(([cat, amt]) => {
      fsAoa.push([`  ${cat}`, amt]);
    });
  }
  fsAoa.push(['Total Revenue & Funds', data.manifest.totalIncome]);
  fsAoa.push(['', '']);
  fsAoa.push(['OPERATING DISBURSEMENTS & EXPENSES', '']);

  if (Object.keys(data.financialStatement.expensesByCategory || {}).length === 0) {
    fsAoa.push(['  No expense items recorded', 0]);
  } else {
    Object.entries(data.financialStatement.expensesByCategory).forEach(([cat, amt]) => {
      fsAoa.push([`  ${cat}`, amt]);
    });
  }
  fsAoa.push(['Total Disbursements', data.manifest.totalDisbursements]);
  fsAoa.push(['', '']);
  fsAoa.push(['NET OPERATING SURPLUS / NET TREASURY', data.manifest.netSurplus]);
  fsAoa.push(['', '']);
  fsAoa.push(['MONTHLY CASH FLOW BREAKDOWN', '', '', '']);
  fsAoa.push(['Month', 'Income (PHP)', 'Expenses (PHP)', 'Net Surplus (PHP)']);
  data.financialStatement.monthlyBreakdown?.forEach((m) => {
    fsAoa.push([m.month, m.income, m.expenses, m.surplus]);
  });

  const wsFs = XLSX.utils.aoa_to_sheet(fsAoa);
  XLSX.utils.book_append_sheet(wb, wsFs, 'Financial Statement');

  // TAB 3: Member Records
  const membersAoa: (string | number)[][] = [
    ['Member ID', 'Full Name', 'Role', 'Status', 'Chapter', 'Contact Phone', 'Email Address', 'Motorcycle Details', 'Church Network', 'Joined Date'],
  ];
  data.activeMembers.forEach((m) => {
    membersAoa.push([
      m.memberNumber,
      m.name,
      m.role,
      m.status,
      m.chapter || 'Main Chapter',
      m.phone,
      m.email,
      m.bikeInfo || 'N/A',
      m.affiliation || 'N/A',
      m.joinDate,
    ]);
  });
  const wsMembers = XLSX.utils.aoa_to_sheet(membersAoa);
  XLSX.utils.book_append_sheet(wb, wsMembers, 'Member Records');

  // TAB 4: Collections Register
  const collectionsAoa: (string | number)[][] = [
    ['Transaction ID', 'Payment Date', 'Member ID', 'Member Name', 'Category', 'Description / Period', 'Amount (PHP)', 'Status', 'Payment Method', 'Reference / Receipt No', 'Notes'],
  ];
  data.collectionsRegister.forEach((r) => {
    collectionsAoa.push([
      r.id,
      r.date,
      r.memberNo,
      r.memberName,
      r.itemType,
      r.description,
      r.amount,
      r.status,
      r.paymentMethod,
      r.referenceNo || 'N/A',
      r.notes || '',
    ]);
  });
  const wsCollections = XLSX.utils.aoa_to_sheet(collectionsAoa);
  XLSX.utils.book_append_sheet(wb, wsCollections, 'Collections Register');

  // TAB 5: Disbursements Log
  const disbursementsAoa: (string | number)[][] = [
    ['Expense ID', 'Disbursement Date', 'Title / Particulars', 'Expense Category', 'Amount (PHP)', 'Disbursed To / Vendor', 'Logged By', 'Receipt / Voucher Ref', 'Notes'],
  ];
  data.disbursementsLog.forEach((e) => {
    disbursementsAoa.push([
      e.id,
      e.date,
      e.title,
      e.category,
      e.amount,
      e.payee,
      e.loggedBy,
      e.receiptRef || 'N/A',
      e.notes || '',
    ]);
  });
  const wsDisbursements = XLSX.utils.aoa_to_sheet(disbursementsAoa);
  XLSX.utils.book_append_sheet(wb, wsDisbursements, 'Disbursements Log');

  // TAB 6: Aging & Compliance
  const complianceAoa: (string | number)[][] = [
    ['Member ID', 'Member Name', 'Club Role', 'Membership Fee Paid', 'Annual Upfront Promo Enrolled', 'Paid Months Count', 'Pending Months Count', 'Overdue Balance (PHP)', 'Compliance Rate'],
  ];
  data.agingAndCompliance.forEach((c) => {
    complianceAoa.push([
      c.memberNo,
      c.memberName,
      c.role,
      c.membershipFeePaid ? 'YES' : 'NO',
      c.annualPromoEnrolled ? 'YES (₱1,000 Upfront)' : 'NO',
      c.paidMonthsCount,
      c.pendingMonthsCount,
      c.overdueAmount,
      c.complianceRate,
    ]);
  });
  const wsCompliance = XLSX.utils.aoa_to_sheet(complianceAoa);
  XLSX.utils.book_append_sheet(wb, wsCompliance, 'Aging & Compliance');

  // TAB 7: Custom Projects
  const projectsAoa: (string | number)[][] = [
    ['Project ID', 'Project / Collection Name', 'Collection Type', 'Target Amount (PHP)', 'Per Member Amount (PHP)', 'Total Collected (PHP)', 'Disbursements (PHP)', 'Net Balance (PHP)', 'Status', 'Donor / Sponsor'],
  ];
  data.customProjects.forEach((p) => {
    projectsAoa.push([
      p.id,
      p.name,
      p.type,
      p.targetAmount || 'N/A',
      p.amountPerMember || 0,
      p.totalCollected,
      p.totalExpenses,
      p.netBalance,
      p.status,
      p.donorName || 'N/A',
    ]);
  });
  const wsProjects = XLSX.utils.aoa_to_sheet(projectsAoa);
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Custom Projects');

  // Write file
  XLSX.writeFile(wb, `BCC_Financial_Archive_${year}_Audit_Workbook.xlsx`);
}

/**
 * Generates an official, publication-ready Income Statement & Financial Statement PDF.
 */
export function exportArchiveToIncomeStatementPDF(data: ArchivePackageData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 16;

  // Header Banner
  doc.setFillColor(27, 67, 50); // Dark Green
  doc.rect(margin, y, pageWidth - margin * 2, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('BCC RIDERS CLUB', margin + 8, y + 10);

  doc.setFontSize(10);
  doc.setTextColor(149, 213, 178);
  doc.text('OFFICIAL AUDITED INCOME STATEMENT', margin + 8, y + 18);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`FY ${data.manifest.year}`, pageWidth - margin - 8, y + 10, { align: 'right' });
  doc.text('AUDITED & CLOSED', pageWidth - margin - 8, y + 18, { align: 'right' });

  y += 30;

  // Audit Details Block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 96, 93);
  doc.text(`Period Covered: January 1, ${data.manifest.year} to December 31, ${data.manifest.year}`, margin, y);
  doc.text(`Archived Date: ${new Date(data.manifest.archivedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth - margin, y, { align: 'right' });
  y += 5;
  doc.text(`Audited By: ${data.manifest.archivedBy}`, margin, y);
  doc.text(`Status: Certified Final`, pageWidth - margin, y, { align: 'right' });

  y += 8;

  // Key KPI Cards Row in PDF
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'ACTIVE MEMBERS', val: `${data.manifest.activeMemberCount}`, color: [240, 253, 244], textColor: [22, 101, 52] },
    { label: 'TOTAL INCOME', val: `₱${data.manifest.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: [240, 253, 244], textColor: [22, 101, 52] },
    { label: 'DISBURSEMENTS', val: `₱${data.manifest.totalDisbursements.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: [255, 241, 242], textColor: [159, 18, 57] },
    { label: 'NET SURPLUS', val: `₱${data.manifest.netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: [254, 243, 199], textColor: [146, 64, 14] },
  ];

  cards.forEach((c, idx) => {
    const xPos = margin + idx * (cardWidth + 3);
    doc.setFillColor(c.color[0], c.color[1], c.color[2]);
    doc.roundedRect(xPos, y, cardWidth, 16, 2, 2, 'F');
    doc.setDrawColor(226, 236, 226);
    doc.roundedRect(xPos, y, cardWidth, 16, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(c.textColor[0], c.textColor[1], c.textColor[2]);
    doc.text(c.label, xPos + cardWidth / 2, y + 5.5, { align: 'center' });

    doc.setFontSize(8.5);
    doc.text(c.val, xPos + cardWidth / 2, y + 12, { align: 'center' });
  });

  y += 22;

  // Income Statement Table using autoTable
  const tableRows: any[] = [
    [{ content: '1. FUNDS & REVENUE COLLECTIONS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 249, 241], textColor: [27, 67, 50] } }],
  ];

  if (Object.keys(data.financialStatement.incomeByCategory || {}).length === 0) {
    tableRows.push(['  No funds recorded', '₱0.00']);
  } else {
    Object.entries(data.financialStatement.incomeByCategory).forEach(([cat, amt]) => {
      tableRows.push([`  ${cat}`, `₱${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
    });
  }
  tableRows.push([
    { content: 'TOTAL FUNDS & REVENUE', styles: { fontStyle: 'bold', textColor: [27, 67, 50] } },
    { content: `₱${data.manifest.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', halign: 'right', textColor: [27, 67, 50] } },
  ]);

  tableRows.push([
    { content: '2. OPERATING DISBURSEMENTS & LIQUIDATION', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [255, 241, 242], textColor: [159, 18, 57] } },
  ]);

  if (Object.keys(data.financialStatement.expensesByCategory || {}).length === 0) {
    tableRows.push(['  No expense items recorded', '₱0.00']);
  } else {
    Object.entries(data.financialStatement.expensesByCategory).forEach(([cat, amt]) => {
      tableRows.push([`  ${cat}`, `₱${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
    });
  }
  tableRows.push([
    { content: 'TOTAL DISBURSEMENTS & EXPENSES', styles: { fontStyle: 'bold', textColor: [159, 18, 57] } },
    { content: `₱${data.manifest.totalDisbursements.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', halign: 'right', textColor: [159, 18, 57] } },
  ]);

  tableRows.push([
    { content: 'NET OPERATING SURPLUS / NET TREASURY', styles: { fontStyle: 'bold', fillColor: [232, 245, 233], textColor: [22, 101, 52] } },
    { content: `₱${data.manifest.netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [232, 245, 233], textColor: [22, 101, 52] } },
  ]);

  tableRows.push([
    { content: 'NET TREASURY FORWARDED TO SUBSEQUENT ACTIVE FUNDS', styles: { fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [146, 64, 14] } },
    { content: `+ ₱${data.manifest.carriedOverTreasury.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [254, 243, 199], textColor: [146, 64, 14] } },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Financial Line Item / Account Description', 'Amount (PHP)']],
    body: tableRows as any,
    theme: 'grid',
    headStyles: {
      fillColor: [27, 67, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 50, halign: 'right' },
    },
  });

  // Monthly Breakdown Table
  const finalY = (doc as any).lastAutoTable?.finalY || y + 80;

  if (finalY < 210) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(27, 67, 50);
    doc.text('Monthly Financial Cash Flow Breakdown', margin, finalY + 8);

    const monthlyRows = data.financialStatement.monthlyBreakdown?.map((m) => [
      m.month,
      `₱${m.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `₱${m.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `₱${m.surplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    ]) || [];

    autoTable(doc, {
      startY: finalY + 11,
      margin: { left: margin, right: margin },
      head: [['Month', 'Collections / Income', 'Disbursements', 'Net Cash Flow']],
      body: monthlyRows,
      theme: 'striped',
      headStyles: {
        fillColor: [45, 106, 79],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
      },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });
  }

  // Signature Block on Last Page
  const signY = doc.internal.pageSize.getHeight() - 32;
  doc.setDrawColor(200, 210, 200);
  doc.line(margin, signY - 4, pageWidth - margin, signY - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(27, 67, 50);
  doc.text('CERTIFIED AUDITED & RECONCILED:', margin, signY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(82, 96, 93);
  doc.text(`Audited By: ${data.manifest.archivedBy}`, margin, signY + 5);
  doc.text(`Resolution: ${data.manifest.auditNotes || 'Reconciled and certified.'}`, margin, signY + 10);

  doc.text('____________________________________', pageWidth - margin, signY + 5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text('Club Treasurer & System Administrator', pageWidth - margin, signY + 10, { align: 'right' });

  // Save PDF
  doc.save(`BCC_Income_Statement_${data.manifest.year}_Audited.pdf`);
}
