import {
  User,
  Event,
  Payment,
  CommunityPost,
  RideLog,
  RouteMap,
  MilestoneBadge,
  NotificationItem,
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    name: 'Marcus Vance (Admin)',
    email: 'admin@bccriders.org',
    role: 'admin',
    memberNumber: 'BRC-0000',
    password: 'bccriders123',
    phone: '+63 917 123 4567',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    bio: 'Founder & Club President. Honda Africa Twin enthusiast.',
    joinDate: '2026-01-01',
    emergencyContact: {
      name: 'Helen Vance',
      relationship: 'Spouse',
      phone: '+63 917 987 6543',
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
    id: 'usr_marcus',
    username: 'marcus.vance',
    name: 'Marcus Vance',
    email: 'marcus.vance@bccriders.org',
    role: 'admin',
    memberNumber: 'BRC-0001',
    password: 'bccriders123',
    phone: '+63 917 123 4567',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    bio: 'Founder & Club President. Honda Africa Twin enthusiast.',
    joinDate: '2026-01-01',
    emergencyContact: {
      name: 'Helen Vance',
      relationship: 'Spouse',
      phone: '+63 917 987 6543',
    },
    bikeInfo: {
      make: 'Honda',
      model: 'CRF1100L Africa Twin',
      year: 2024,
      engineCc: '1084cc',
      licensePlate: 'BCC-01',
    },
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
