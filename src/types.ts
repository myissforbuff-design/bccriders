export type UserRole =
  | 'admin'
  | 'President'
  | 'Vice-President'
  | 'Secretary'
  | 'Treasurer'
  | 'Road Captain'
  | 'Safety Officer'
  | 'Social Media'
  | 'Members Representative'
  | 'Member'
  | string;

export const CLUB_ROLES = [
  'President',
  'Vice-President',
  'Secretary',
  'Treasurer',
  'Road Captain',
  'Safety Officer',
  'Social Media',
  'Members Representative',
  'Member',
] as const;
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
  month?: string;
  year?: number;
  status: 'Active' | 'Completed' | 'Archived';
  description?: string;
  createdAt: string;
}
