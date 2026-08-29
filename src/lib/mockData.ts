import {
  User,
  Event,
  Payment,
  CommunityPost,
  RideLog,
  RouteMap,
  MilestoneBadge,
  NotificationItem,
  Announcement,
  FinanceSettings,
  MonthlyDue,
  DynamicCollection,
  SecuritySettings,
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    name: 'BCC Riders (Admin)',
    email: 'admin@bccriders.org',
    role: 'admin',
    memberNumber: 'BRC-0000',
    password: 'bccriders123',
    phone: '+63 917 123 4567',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    bio: 'BCC Riders Club Administrator.',
    joinDate: '2026-01-01',
    approvalStatus: 'Approved',
    emergencyContact: {
      name: 'BCC Support',
      relationship: 'Club Officer',
      phone: '+63 917 123 4567',
    },
    bikeInfo: {
      make: 'Honda',
      model: 'CRF1100L Africa Twin',
      year: 2024,
      engineCc: '1084cc',
      licensePlate: 'BCC-01',
    },
  },
  {
    id: 'usr_member_1',
    username: 'elena_rostova',
    name: 'Elena Rostova',
    email: 'elena@bccriders.org',
    role: 'member',
    memberNumber: 'BRC-0001',
    password: 'password123',
    phone: '+63 918 234 5678',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
    bio: 'Adventure touring rider and trail explorer.',
    joinDate: '2026-01-10',
    approvalStatus: 'Approved',
    emergencyContact: { name: 'Dmitri Rostova', relationship: 'Brother', phone: '+63 918 999 8888' },
    bikeInfo: { make: 'Yamaha', model: 'Tenere 700', year: 2023, engineCc: '689cc', licensePlate: 'BCC-02' },
  },
  {
    id: 'usr_member_2',
    username: 'noel_tabanay',
    name: 'Noel Tabanay',
    email: 'noel@bccriders.org',
    role: 'member',
    memberNumber: 'BRC-0002',
    password: 'password123',
    phone: '+63 919 345 6789',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
    bio: 'Weekend rider and club treasurer supporter.',
    joinDate: '2026-01-15',
    approvalStatus: 'Approved',
    emergencyContact: { name: 'Maria Tabanay', relationship: 'Spouse', phone: '+63 919 111 2222' },
    bikeInfo: { make: 'Kawasaki', model: 'Versys 650', year: 2024, engineCc: '649cc', licensePlate: 'BCC-03' },
  },
];

export const INITIAL_EVENTS: Event[] = [];

export const INITIAL_PAYMENTS: Payment[] = [];

export const INITIAL_POSTS: CommunityPost[] = [];

export const INITIAL_RIDE_LOGS: RideLog[] = [];

export const INITIAL_ROUTES: RouteMap[] = [
  {
    id: 'rt_001',
    name: 'Sierra Madre Mountain Highway Trail',
    region: 'Rizal & Quezon Province, PH',
    distanceMiles: 85,
    difficulty: 'Moderate',
    elevationGainFt: 3400,
    coordinates: [
      [14.6507, 121.1029],
      [14.6789, 121.2104],
      [14.7123, 121.3150],
      [14.7500, 121.4200],
    ],
    waypoints: [
      { name: 'Marikina Club Staging Grounds', lat: 14.6507, lng: 121.1029, type: 'Start', description: 'Main gathering point' },
      { name: 'Boso-Boso Ridge Viewpoint', lat: 14.6789, lng: 121.2104, type: 'Scenic', description: 'Mountain pass photo stop' },
      { name: 'Sampaloc Fuel Stop', lat: 14.7123, lng: 121.3150, type: 'Fuel', description: 'Re-fuel and refreshments' },
      { name: 'Real Pacific Ocean Finish', lat: 14.7500, lng: 121.4200, type: 'Finish', description: 'Seafood lunch & group meetup' },
    ],
    description: 'Scenic winding mountain pass connecting Rizal and Quezon, featuring lush views and smooth pavement.',
    offlineCached: true,
    downloadedAt: '2026-08-01 08:00',
  },
];

export const BADGES: MilestoneBadge[] = [
  {
    id: 'bdg_founder',
    title: 'Founding Member',
    description: 'Joined BCC Riders Club in the inaugural launch era.',
    iconName: 'ShieldAlert',
    category: 'Special',
    reqValue: 1,
  },
  {
    id: 'bdg_century',
    title: 'Century Crusher',
    description: 'Completed a single group ride exceeding 100 continuous miles.',
    iconName: 'Trophy',
    category: 'Mileage',
    reqValue: 100,
  },
  {
    id: 'bdg_10k',
    title: '10,000 Mile Master',
    description: 'Logged 10,000 total club miles in the official ERP tracker.',
    iconName: 'Award',
    category: 'Mileage',
    reqValue: 10000,
  },
  {
    id: 'bdg_mountain',
    title: 'Mountain Apex Rider',
    description: 'Scaled 3 mountain passes over 3,000 ft elevation gain.',
    iconName: 'Mountain',
    category: 'Rides',
    reqValue: 3,
  },
  {
    id: 'bdg_night',
    title: 'Night Owl Navigator',
    description: 'Participated in official club midnight or sunset sweeps.',
    iconName: 'Moon',
    category: 'Rides',
    reqValue: 5,
  },
  {
    id: 'bdg_speedster',
    title: 'Track & Pace Leader',
    description: 'Certified Road Captain for group rides.',
    iconName: 'Zap',
    category: 'Leadership',
    reqValue: 10,
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

export const INITIAL_FINANCE_SETTINGS: FinanceSettings = {
  membershipFee: 200,
  annualFee: 1000,
  annualPromoEnabled: true,
};

export const INITIAL_MONTHLY_DUES: MonthlyDue[] = [];

export const INITIAL_DYNAMIC_COLLECTIONS: DynamicCollection[] = [];

export const INITIAL_SECURITY_SETTINGS: SecuritySettings = {
  adminOtpEnabled: true,
};


