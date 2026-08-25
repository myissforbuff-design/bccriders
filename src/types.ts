export type UserRole =
  | 'admin'
  | 'President'
  | 'Vice-President'
  | 'Secretary'
  | 'Treasurer'
  | 'Road Captain'
  | 'Safety Officer'
  | 'Sgt. at Arms'
  | 'P.I.O.'
  | 'Social Media'
  | 'Members Representative'
  | 'Member'
  | string;

export const CLUB_OFFICER_ROLES = [
  'President',
  'Vice-President',
  'Secretary',
  'Treasurer',
  'Road Captain',
  'Safety Officer',
  'Sgt. at Arms',
  'P.I.O.',
  'Social Media',
  'Members Representative',
] as const;

export const CLUB_ROLES = [
  'President',
  'Vice-President',
  'Secretary',
  'Treasurer',
  'Road Captain',
  'Safety Officer',
  'Sgt. at Arms',
  'P.I.O.',
  'Social Media',
  'Members Representative',
  'Member',
] as const;

export type ActivityAudience = 'Both' | 'Officers' | 'Members';

export interface ActivityAttendance {
  name: string;
  memberId: string;
  network: string;
  date: string;
  time: string;
  avatar?: string;
  bikeInfo?: BikeInfo;
  isRegistered?: boolean;
}

export interface Activity {
  id: string;
  name: string;
  date: string;
  status: 'Open' | 'Closed';
  attendance: ActivityAttendance[];
  targetAudience?: ActivityAudience;
  allowedRoles?: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function isOfficerRole(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  if (r === 'admin' || r === 'administrator') return false;
  if (r === 'member' || r === 'regular' || r === 'regular member') return false;
  return true;
}

export function isMemberOnlyRole(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  if (r === 'admin' || r === 'administrator') return false;
  return r === 'member' || r === 'regular' || r === 'regular member';
}

export function isActivityApplicableToUser(
  activity: { targetAudience?: ActivityAudience; allowedRoles?: string[] } | null | undefined,
  user: { role?: string; id?: string } | null | undefined
): boolean {
  if (!user) return false;
  if (user.role?.toLowerCase() === 'admin' || user.id === 'usr_admin') return true;

  const audience = activity?.targetAudience || 'Both';
  const isOfficer = isOfficerRole(user.role);

  if (audience === 'Officers') {
    return isOfficer;
  }
  if (audience === 'Members') {
    return !isOfficer;
  }
  return true;
}

export type MembershipType = 'Standard' | 'Premium' | 'VIP' | 'Executive';
export type ApprovalStatus = 'Approved' | 'Pending' | 'Rejected';

export interface BikeInfo {
  make: string;
  model: string;
  year: number;
  engineCc?: string;
  engineNo?: string;
  chassisNo?: string;
  crNo?: string;
  orNo?: string;
  orExpiryDate?: string;
  vin?: string;
  licensePlate?: string;
  color?: string;
  plateNo?: string;
  condition?: string;
  yearsInService?: string;
  licenseRestrictionCode?: string;
  conditionCode?: string;
  restrictionCodes?: string[];
  ltoConditions?: string[];
  photoUrl?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthdate?: string;
  age?: number;
  gender?: string;
  email: string;
  password?: string;
  role: UserRole;
  memberNumber: string;
  membershipType?: MembershipType;
  phone: string;
  address?: string;
  streetAddress?: string;
  network?: string;
  chapter?: string;
  civilStatus?: string;
  leadersName?: string;
  leadersContactNo?: string;
  affiliation?: 'House Church' | 'Life Group' | 'Plug-In' | 'Y2DN' | 'Others' | string;
  mobileNo?: string;
  occupation?: string;
  occupationStatus?: 'Active' | 'Retired' | string;
  lifeInsurance?: string;
  licenseNo?: string;
  licenseExpiryDate?: string;
  ridingExperience?: 'Regular' | 'Motorcross' | 'Enduro' | 'Extreme' | string;
  riderType?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  reasonForJoining?: string;
  recommendedBy?: string;
  applicantSignature?: string;
  declarationDate?: string;
  avatar: string;
  bio: string;
  joinDate: string;
  emergencyContact: EmergencyContact;
  bikeInfo: BikeInfo;
  totalMiles?: number;
  totalRides?: number;
  streakDays?: number;
  unlockedBadgeIds?: string[];
  approvalStatus?: ApprovalStatus;
}

export type EventType = 'Group Ride' | 'Club Meeting' | 'Workshop' | 'Rally' | 'Charity Run';
export type PaceLevel = 'Casual 15-20mph' | 'Moderate 20-25mph' | 'Fast 25+mph' | 'All Pace';

export interface Event {
  id: string;
  title: string;
  type: EventType;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  startLocation: string;
  endLocation?: string;
  distanceMiles: number;
  paceLevel: PaceLevel;
  fee: number; // 0 for free
  maxAttendees?: number;
  registeredUserIds: string[];
  routeId?: string;
  mandatoryGear: string[];
  status: 'Upcoming' | 'In Progress' | 'Completed' | 'Cancelled';
  createdBy: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  type: 'Event Registration' | 'Club Gear';
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
  paymentMethod: 'Credit Card' | 'Apple Pay' | 'Bank Transfer' | 'Club Wallet';
  transactionRef: string;
  description: string;
  createdAt: string;
  receiptUrl?: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  title: string;
  content: string;
  category: 'Group Ride Setup' | 'Route Suggestion' | 'General Talk' | 'Equipment & Gear';
  paceLevel?: PaceLevel;
  distanceMiles?: number;
  meetingPoint?: string;
  meetingTime?: string;
  likesCount: number;
  likedBy: string[];
  commentsCount: number;
  createdAt: string;
  routeId?: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface RideLog {
  id: string;
  userId: string;
  userName: string;
  title: string;
  distanceMiles: number;
  durationMinutes: number;
  elevationGainFt: number;
  avgSpeedMph: number;
  date: string;
  routeName: string;
  notes?: string;
  verifiedByAdmin?: boolean;
}

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
  type: 'Start' | 'Fuel' | 'Scenic' | 'Rest Stop' | 'Finish';
  description?: string;
}

export interface RouteMap {
  id: string;
  name: string;
  region: string;
  distanceMiles: number;
  difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Extreme';
  elevationGainFt: number;
  coordinates: [number, number][]; // [lat, lng]
  waypoints: Waypoint[];
  description: string;
  offlineCached?: boolean;
  downloadedAt?: string;
}

export interface MilestoneBadge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: 'Mileage' | 'Rides' | 'Leadership' | 'Special';
  reqValue: number;
}

export interface NotificationItem {
  id: string;
  userId?: string; // empty means broadcast to all
  title: string;
  message: string;
  type: 'ride' | 'due' | 'meeting' | 'social' | 'system';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export type AnnouncementPriority = 'Important' | 'General' | 'Event' | 'Emergency';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  authorId: string;
  authorName: string;
  authorRole: string;
  pinned?: boolean;
  facebookUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FinanceSettings {
  membershipFee: number;
  annualFee: number;
  annualPromoEnabled?: boolean;
}

export interface MonthlyDue {
  id: string;
  title: string;
  amount: number;
  month: string;
  year: number;
  status: 'Active' | 'Inactive';
  notes?: string;
  createdAt: string;
}

export interface DynamicCollection {
  id: string;
  name: string;
  amount: number;
  targetAmount?: number;
  month?: string;
  year?: number;
  status: 'Active' | 'Completed' | 'Archived';
  description?: string;
  createdAt: string;
  collectionType?: 'Standard' | 'Donation';
  donorName?: string;
}

export interface SecuritySettings {
  adminOtpEnabled: boolean;
}

export type FinanceItemType = 'Membership Fee' | 'Monthly Due' | 'Vest Payment' | 'Annual Upfront Promo' | 'Donation Collection' | 'Other';

export interface FinanceRecord {
  id: string;
  itemType: FinanceItemType;
  coveredMonth?: string; // e.g., "August 2026"
  customItemName?: string;
  userId: string;
  userName: string;
  userMemberNo?: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Waived';
  paymentMethod?: 'GCash' | 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Other';
  referenceNo?: string;
  notes?: string;
  updatedAt: string;
  createdAt?: string;
}

export type ExpenseCategory =
  | 'Event Logistics'
  | 'Equipment & Gear'
  | 'Venue & Rental'
  | 'Food & Catering'
  | 'Administrative'
  | 'Fuel & Travel'
  | 'Utilities'
  | 'Other';

export interface ExpenseRecord {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  receiptRef?: string;
  payeeOrDisbursedTo?: string;
  loggedBy?: string;
  notes?: string;
  updatedAt: string;
  createdAt?: string;
}

export interface FinanceYearArchive {
  id: string;
  year: number;
  archivedAt: string;
  archivedBy: string;
  totalIncome: number;
  totalDisbursements: number;
  netSurplus: number;
  carriedOverTreasury: number;
  activeMemberCount: number;
  totalTransactionsCount: number;
  totalExpensesCount: number;
  auditNotes?: string;
  isAudited: boolean;
  status: 'Audited & Closed';
}

export interface ArchivePackageData {
  manifest: {
    archiveId: string;
    clubName: string;
    year: number;
    archivedAt: string;
    archivedBy: string;
    isAudited: boolean;
    auditNotes?: string;
    totalIncome: number;
    totalDisbursements: number;
    netSurplus: number;
    carriedOverTreasury: number;
    activeMemberCount: number;
    totalTransactionsCount: number;
    totalExpensesCount: number;
    version: string;
  };
  activeMembers: {
    id: string;
    name: string;
    memberNumber: string;
    role: string;
    chapter?: string;
    phone: string;
    email: string;
    bikeInfo?: string;
    affiliation?: string;
    joinDate: string;
    status: string;
  }[];
  collectionsRegister: {
    id: string;
    date: string;
    memberName: string;
    memberNo: string;
    itemType: string;
    description: string;
    amount: number;
    status: string;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
  }[];
  disbursementsLog: {
    id: string;
    date: string;
    title: string;
    category: string;
    amount: number;
    payee: string;
    loggedBy: string;
    receiptRef?: string;
    notes?: string;
  }[];
  financialStatement: {
    year: number;
    totalIncome: number;
    totalDisbursements: number;
    netSurplus: number;
    incomeByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
    monthlyBreakdown: { month: string; income: number; expenses: number; surplus: number }[];
  };
  agingAndCompliance: {
    memberId: string;
    memberName: string;
    memberNo: string;
    role: string;
    membershipFeePaid: boolean;
    annualPromoEnrolled: boolean;
    paidMonthsCount: number;
    pendingMonthsCount: number;
    overdueAmount: number;
    complianceRate: string;
  }[];
  customProjects: {
    id: string;
    name: string;
    type: string;
    targetAmount?: number;
    amountPerMember?: number;
    totalCollected: number;
    totalExpenses: number;
    netBalance: number;
    status: string;
    donorName?: string;
  }[];
}

// Treasurer Security & Anti-Tampering Admin Authorization
export type TreasurerActionType = 'edit' | 'delete';
export type TreasurerTargetType = 'fund' | 'expense' | 'collection' | 'record';
export type TreasurerRequestStatus = 'Pending' | 'Granted' | 'Denied' | 'Completed' | 'Cancelled';

export interface TreasurerActionRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  actionType: TreasurerActionType;
  targetType: TreasurerTargetType;
  targetId: string;
  targetTitle: string;
  targetSubtitle?: string;
  targetAmount?: number;
  targetDate?: string;
  targetRef?: string;
  reason: string;
  status: TreasurerRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  adminNotes?: string;
}

export interface InboundEmailAttachment {
  id: string;
  filename: string;
  content_type: string;
  content_disposition?: string;
  content_id?: string;
  size?: number;
  url?: string;
}

export interface InboundEmail {
  id: string;
  emailId?: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  receivedFor?: string[];
  messageId?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: InboundEmailAttachment[];
  rawEvent?: any;
  receivedAt: string;
  createdAt?: string;
  read?: boolean;
  starred?: boolean;
  status?: string;
}

export interface OutboundEmail {
  id: string;
  resendId?: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'simulated';
  error?: string;
  senderName?: string;
}



