import {
  INITIAL_USERS,
  INITIAL_EVENTS,
  INITIAL_PAYMENTS,
  INITIAL_POSTS,
  INITIAL_RIDE_LOGS,
  INITIAL_ROUTES,
  INITIAL_NOTIFICATIONS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_FINANCE_SETTINGS,
  INITIAL_MONTHLY_DUES,
  INITIAL_DYNAMIC_COLLECTIONS,
} from './mockData';
import {
  User,
  Event,
  Payment,
  CommunityPost,
  RideLog,
  RouteMap,
  NotificationItem,
  Announcement,
  FinanceSettings,
  MonthlyDue,
  DynamicCollection,
} from '../types';

// Storage Keys for local state persistence
const STORAGE_KEYS = {
  USERS: 'bcc_users_v2',
  EVENTS: 'bcc_events_v2',
  PAYMENTS: 'bcc_payments_v2',
  POSTS: 'bcc_posts_v2',
  LOGS: 'bcc_logs_v2',
  ROUTES: 'bcc_routes_v2',
  NOTIFS: 'bcc_notifs_v2',
  ANNOUNCEMENTS: 'bcc_announcements_v3',
  FINANCE_SETTINGS: 'bcc_finance_settings_v1',
  MONTHLY_DUES: 'bcc_monthly_dues_v2',
  DYNAMIC_COLLECTIONS: 'bcc_dynamic_collections_v2',
  CURRENT_USER: 'bcc_current_user_id_v2',
};

// Helper for local state fallback
function loadFromStorage<T>(key: string, initialFallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed) && parsed.length === 0 && Array.isArray(initialFallback) && initialFallback.length > 0) {
        return initialFallback;
      }
      return parsed;
    }
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
  }
  return initialFallback;
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
}

// MongoDB Status Helper
export interface MongoStatusResponse {
  status: 'connected' | 'not_configured' | 'error';
  uriConfigured: boolean;
  message: string;
  dbName: string;
  collections?: Record<string, number>;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; [key: string]: any }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return { success: false, data: [] as any };
    }
    return await res.json();
  } catch {
    return { success: false, data: [] as any };
  }
}

export async function checkMongoDbStatus(): Promise<MongoStatusResponse> {
  try {
    const res = await fetch('/api/mongodb/status');
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error('API server returned non-JSON response');
    }
    return await res.json();
  } catch (err: any) {
    return {
      status: 'not_configured',
      uriConfigured: false,
      message: 'Server API endpoint offline or not configured',
      dbName: 'bcc-riders-club-db',
    };
  }
}

// Upload / Storage Helper for MongoDB / Server with automatic image compression
export async function uploadStorageFile(
  file: File | Blob | string,
  folder = 'avatars',
  maxDimension = 500,
  quality = 0.8
): Promise<string | null> {
  if (typeof file === 'string') {
    if (!file.startsWith('data:image')) return file;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(file);
      img.src = file;
    });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result;
      if (typeof rawDataUrl !== 'string') {
        resolve(null);
        return;
      }

      // Check if file is an image for compression
      if (file.type && !file.type.startsWith('image/')) {
        resolve(rawDataUrl);
        return;
      }

      // Compress image via Canvas
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio & scale down to maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl); // Fallback if canvas context unavailable
          return;
        }

        // Draw background white for transparency safety
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with specified quality (~20KB - 80KB output)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        resolve(rawDataUrl);
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function deleteStorageFile(url?: string | null): Promise<void> {
  // Safe cleanup stub
}

export const isMongoDbConfigured = true;

export class DataStoreService {
  private users: User[];
  private events: Event[];
  private payments: Payment[];
  private posts: CommunityPost[];
  private logs: RideLog[];
  private routes: RouteMap[];
  private notifications: NotificationItem[];
  private announcements: Announcement[];
  private financeSettings: FinanceSettings;
  private monthlyDues: MonthlyDue[];
  private dynamicCollections: DynamicCollection[];
  private currentUserId: string;

  constructor() {
    this.users = loadFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
    this.events = loadFromStorage(STORAGE_KEYS.EVENTS, INITIAL_EVENTS);
    this.payments = loadFromStorage(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
    this.posts = loadFromStorage(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    this.logs = loadFromStorage(STORAGE_KEYS.LOGS, INITIAL_RIDE_LOGS);
    this.routes = loadFromStorage(STORAGE_KEYS.ROUTES, INITIAL_ROUTES);
    this.notifications = loadFromStorage(
      STORAGE_KEYS.NOTIFS,
      INITIAL_NOTIFICATIONS
    );
    this.announcements = loadFromStorage(
      STORAGE_KEYS.ANNOUNCEMENTS,
      INITIAL_ANNOUNCEMENTS
    );
    this.financeSettings = loadFromStorage(
      STORAGE_KEYS.FINANCE_SETTINGS,
      INITIAL_FINANCE_SETTINGS
    );
    this.monthlyDues = loadFromStorage(
      STORAGE_KEYS.MONTHLY_DUES,
      INITIAL_MONTHLY_DUES
    );
    this.dynamicCollections = loadFromStorage(
      STORAGE_KEYS.DYNAMIC_COLLECTIONS,
      INITIAL_DYNAMIC_COLLECTIONS
    );
    this.currentUserId = loadFromStorage(STORAGE_KEYS.CURRENT_USER, '');

    // Init MongoDB background synchronization
    this.initMongoDb().catch((err) =>
      console.warn('MongoDB background sync notice:', err)
    );
  }

  async initMongoDb(): Promise<MongoStatusResponse> {
    const status = await checkMongoDbStatus();
    if (status.status === 'connected') {
      try {
        // Fetch active members from 'members' table
        const dataMembers = await safeFetchJson('/api/mongodb/members');
        const activeMembers = (dataMembers.success && Array.isArray(dataMembers.data)) ? dataMembers.data : [];

        // Fetch pending registrations from 'registration' table
        const dataRegistration = await safeFetchJson('/api/mongodb/registration');
        const pendingRegistrations = (dataRegistration.success && Array.isArray(dataRegistration.data)) ? dataRegistration.data : [];

        if (activeMembers.length > 0 || pendingRegistrations.length > 0) {
          // Merge active members and pending registration forms
          this.users = [...activeMembers, ...pendingRegistrations];
          saveToStorage(STORAGE_KEYS.USERS, this.users);
        } else {
          // Seed initial data into MongoDB if collection is empty
          await safeFetchJson('/api/mongodb/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              members: INITIAL_USERS,
              events: INITIAL_EVENTS,
              payments: INITIAL_PAYMENTS,
              posts: INITIAL_POSTS,
            }),
          });
        }

        // Fetch updates from MongoDB 'updates' table
        const dataUpdates = await safeFetchJson('/api/mongodb/updates');
        if (dataUpdates.success && Array.isArray(dataUpdates.data)) {
          this.announcements = dataUpdates.data;
          saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, this.announcements);
        }

        // Fetch settings from MongoDB 'settings' table
        const dataSettings = await safeFetchJson('/api/mongodb/settings');
        if (dataSettings.success && Array.isArray(dataSettings.data) && dataSettings.data.length > 0) {
          const finSettingsDoc = dataSettings.data.find((s: any) => s.id === 'finance_settings');
          if (finSettingsDoc) {
            this.financeSettings = {
              membershipFee: Number(finSettingsDoc.membershipFee) || 500,
              annualFee: Number(finSettingsDoc.annualFee) || 1200,
            };
            saveToStorage(STORAGE_KEYS.FINANCE_SETTINGS, this.financeSettings);
          }

          const duesDocs = dataSettings.data.filter((s: any) => s.category === 'monthly_due' || (s.id && s.id.startsWith('md_')));
          if (duesDocs.length > 0) {
            this.monthlyDues = duesDocs.map((d: any) => ({
              id: d.id,
              title: d.title || `${d.month || 'August'} ${d.year || 2026} Monthly Due`,
              month: d.month || 'August',
              year: Number(d.year) || 2026,
              amount: Number(d.amount) || 0,
              notes: d.description || '',
              createdAt: d.createdAt || new Date().toISOString().split('T')[0],
              status: (d.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
            }));
            saveToStorage(STORAGE_KEYS.MONTHLY_DUES, this.monthlyDues);
          }

          const dynamicColDocs = dataSettings.data.filter((s: any) => s.category === 'dynamic_collection' || (s.id && s.id.startsWith('dc_')));
          if (dynamicColDocs.length > 0) {
            this.dynamicCollections = dynamicColDocs.map((c: any) => ({
              id: c.id,
              name: c.name || c.title || 'Dynamic Collection',
              amount: Number(c.amount) || Number(c.targetAmount) || 0,
              targetAmount: Number(c.targetAmount) || 0,
              description: c.description || '',
              createdAt: c.createdAt || new Date().toISOString().split('T')[0],
              status: (c.status || 'Active') as 'Active' | 'Completed' | 'Archived',
            }));
            saveToStorage(STORAGE_KEYS.DYNAMIC_COLLECTIONS, this.dynamicCollections);
          }
        }
      } catch (err) {
        console.warn('MongoDB sync fetch notice:', err);
      }
    }
    return status;
  }

  // Current User Session
  getCurrentUser(): User | null {
    if (!this.currentUserId) return null;
    return this.users.find((u) => u.id === this.currentUserId) || null;
  }

  setCurrentUser(userId: string | null): User | null {
    this.currentUserId = userId || '';
    if (userId) {
      saveToStorage(STORAGE_KEYS.CURRENT_USER, userId);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      } catch (e) {
        // ignore
      }
    }
    return this.getCurrentUser();
  }

  logout(): void {
    this.currentUserId = '';
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch (e) {
      // ignore
    }
  }

  // Auth / Login Simulation
  login(usernameOrEmail: string, passwordAttempt: string): User | null {
    const normalizedInput = usernameOrEmail.trim().toLowerCase();

    const matched = this.users.find(
      (u) =>
        u.username.toLowerCase() === normalizedInput ||
        u.email.toLowerCase() === normalizedInput ||
        (normalizedInput === 'admin' && u.role === 'admin')
    );

    if (matched) {
      if (matched.approvalStatus === 'Pending') {
        return null;
      }
      const expectedPassword = matched.password || 'bccriders123';
      if (passwordAttempt !== expectedPassword) {
        return null;
      }
      return this.setCurrentUser(matched.id);
    }

    return null;
  }

  // Users Management
  getUsers(): User[] {
    return this.users;
  }

  updateUser(updatedUser: User): User {
    this.users = this.users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    saveToStorage(STORAGE_KEYS.USERS, this.users);

    const endpoint = updatedUser.approvalStatus === 'Pending' ? '/api/mongodb/registration' : '/api/mongodb/members';

    // Sync to MongoDB asynchronously
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch((err) => console.warn('MongoDB updateUser sync error:', err));

    if (updatedUser.approvalStatus === 'Approved') {
      this.recordMembershipFeePayment(updatedUser);
    }

    return updatedUser;
  }

  addUser(newUser: Partial<User>): User {
    const isPending = (newUser.approvalStatus || 'Pending') === 'Pending';
    const userId = newUser.id || (isPending ? `reg_${Date.now()}` : `usr_${Date.now()}`);
    const user: User = {
      ...newUser,
      id: userId,
      username:
        newUser.username ||
        (newUser.email ? newUser.email.split('@')[0] : `rider_${Date.now().toString().slice(-4)}`),
      name: newUser.name || `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || 'New Club Rider',
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      birthdate: newUser.birthdate,
      age: newUser.age,
      gender: newUser.gender || 'Male',
      email: newUser.email || 'rider@bccriders.org',
      password: newUser.password || 'bccriders123',
      role: newUser.role || 'Member',
      memberNumber: isPending ? 'Pending' : (newUser.memberNumber || `BRC-${String(this.users.length).padStart(4, '0')}`).replace(/^BCC-/, 'BRC-'),
      phone: newUser.phone || newUser.mobileNo || '+63 917 000 0000',
      avatar: newUser.avatar || '/avatar.svg',
      bio: newUser.bio || 'Passionate rider and BCC Club Member.',
      joinDate: newUser.joinDate || new Date().toISOString().split('T')[0],
      emergencyContact: newUser.emergencyContact || {
        name: 'Emergency Contact',
        relationship: 'Family',
        phone: '+63 917 999 9999',
      },
      bikeInfo: newUser.bikeInfo || { make: 'Honda', model: 'CRF300L', year: 2024, engineCc: '286cc' },
      approvalStatus: isPending ? 'Pending' : 'Approved',
    };

    this.users.unshift(user);
    saveToStorage(STORAGE_KEYS.USERS, this.users);

    // Save to appropriate MongoDB collection: 'registration' if Pending, 'members' if Approved
    const endpoint = isPending ? '/api/mongodb/registration' : '/api/mongodb/members';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    }).catch((err) => console.warn('MongoDB addUser sync error:', err));

    if (!isPending) {
      this.recordMembershipFeePayment(user);
    }

    return user;
  }

  // Helper to automatically record Membership Fee payment upon member approval
  recordMembershipFeePayment(approvedUser: User): void {
    const todayStr = new Date().toISOString().split('T')[0];
    const recKey = 'bcc_finance_records_v3';
    let savedRecs: any[] = [];
    try {
      const item = localStorage.getItem(recKey);
      if (item) savedRecs = JSON.parse(item);
    } catch (e) {
      console.error(e);
    }

    // Check if membership fee payment already exists for this user
    const exists = savedRecs.some(
      (r: any) => r.userId === approvedUser.id && r.itemType === 'Membership Fee'
    );

    if (!exists) {
      const newRec = {
        id: `rec_mf_${approvedUser.id}`,
        itemType: 'Membership Fee',
        userId: approvedUser.id,
        userName: approvedUser.name,
        userMemberNo: approvedUser.memberNumber || 'BRC-MEMBER',
        amount: 200,
        dueDate: approvedUser.joinDate || todayStr,
        paidDate: todayStr,
        status: 'Paid',
        paymentMethod: 'Cash',
        referenceNo: undefined,
        notes: 'Payment recorded upon member approval',
        updatedAt: todayStr,
      };

      savedRecs.unshift(newRec);
      try {
        localStorage.setItem(recKey, JSON.stringify(savedRecs));
      } catch (e) {
        console.error(e);
      }

      // Sync to MongoDB financeLogs collection
      fetch('/api/mongodb/financeLogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRec),
      }).catch((err) => console.warn('MongoDB financeLogs auto-record error:', err));
    }
  }

  // Approve a pending registration form, removing it from 'registration' table and transferring to 'members' table
  approveRegistration(approvedUser: User): User {
    approvedUser.approvalStatus = 'Approved';

    // Update in local memory list
    this.users = this.users.map((u) => (u.id === approvedUser.id ? approvedUser : u));

    // Call MongoDB transfer endpoint
    fetch(`/api/mongodb/registration/accept/${approvedUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approvedUser),
    }).catch((err) => console.warn('MongoDB approveRegistration transfer error:', err));

    this.recordMembershipFeePayment(approvedUser);

    return approvedUser;
  }

  deleteUser(userId: string): void {
    this.users = this.users.filter((u) => u.id !== userId);

    // Remove from both 'members' and 'registration' tables in MongoDB
    fetch(`/api/mongodb/members/${userId}`, { method: 'DELETE' }).catch(() => {});
    fetch(`/api/mongodb/registration/${userId}`, { method: 'DELETE' }).catch(() => {});
  }

  // Events Management
  getEvents(): Event[] {
    return this.events;
  }

  addEvent(event: Omit<Event, 'id' | 'registeredUserIds'>): Event {
    const newEvent: Event = {
      ...event,
      id: `evt_${Date.now()}`,
      registeredUserIds: [],
    };
    this.events.unshift(newEvent);
    saveToStorage(STORAGE_KEYS.EVENTS, this.events);

    fetch('/api/mongodb/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    }).catch((err) => console.warn('MongoDB addEvent sync error:', err));

    return newEvent;
  }

  createEvent(event: Omit<Event, 'id' | 'registeredUserIds' | 'createdAt'> & { status?: Event['status'] }): Event {
    return this.addEvent({
      ...event,
      status: event.status || 'Upcoming',
      createdAt: new Date().toISOString(),
    });
  }

  toggleEventRsvp(eventId: string, userId: string): Event {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) throw new Error('Event not found');

    if (!event.registeredUserIds) {
      event.registeredUserIds = [];
    }

    const index = event.registeredUserIds.indexOf(userId);
    if (index > -1) {
      event.registeredUserIds.splice(index, 1);
    } else {
      event.registeredUserIds.push(userId);
    }

    saveToStorage(STORAGE_KEYS.EVENTS, this.events);

    fetch('/api/mongodb/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch((err) => console.warn('MongoDB toggleRsvp sync error:', err));

    return event;
  }

  registerForEvent(eventId: string, userId: string, amount: number = 0, paymentMethod: any = 'Club Wallet'): { event: Event; payment?: Payment } {
    const event = this.toggleEventRsvp(eventId, userId);
    let payment: Payment | undefined;
    if (amount > 0) {
      const user = this.users.find((u) => u.id === userId);
      payment = this.addPayment({
        userId,
        userName: user?.name || 'Rider',
        type: 'Event Registration',
        amount,
        status: 'Paid',
        paymentMethod,
        description: `Registration fee for ${event.title}`,
        createdAt: new Date().toISOString(),
      });
    }
    return { event, payment };
  }

  // Payments & Dues Management
  getPayments(): Payment[] {
    return this.payments;
  }

  addPayment(payment: Omit<Payment, 'id' | 'transactionRef'>): Payment {
    const newPayment: Payment = {
      ...payment,
      id: `pay_${Date.now()}`,
      transactionRef: `BRC-DUES-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    this.payments.unshift(newPayment);
    saveToStorage(STORAGE_KEYS.PAYMENTS, this.payments);

    fetch('/api/mongodb/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayment),
    }).catch((err) => console.warn('MongoDB addPayment sync error:', err));

    return newPayment;
  }

  payAnnualDues(userId: string, amount: number, paymentMethod: any = 'Credit Card'): Payment {
    const user = this.users.find((u) => u.id === userId);
    const payment = this.addPayment({
      userId,
      userName: user?.name || 'Rider',
      type: 'Club Gear',
      amount,
      status: 'Paid',
      paymentMethod,
      description: `Membership Fee (${new Date().getFullYear()})`,
      createdAt: new Date().toISOString(),
    });
    return payment;
  }

  // Community Feed
  getPosts(): CommunityPost[] {
    return this.posts;
  }

  createPost(
    post: Omit<CommunityPost, 'id' | 'likesCount' | 'likedBy' | 'commentsCount' | 'createdAt'>
  ): CommunityPost {
    const newPost: CommunityPost = {
      ...post,
      id: `post_${Date.now()}`,
      likesCount: 0,
      likedBy: [],
      commentsCount: 0,
      createdAt: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
    };

    this.posts.unshift(newPost);
    saveToStorage(STORAGE_KEYS.POSTS, this.posts);

    fetch('/api/mongodb/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPost),
    }).catch((err) => console.warn('MongoDB createPost sync error:', err));

    return newPost;
  }

  toggleLikePost(postId: string, userId: string): CommunityPost {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found');

    const index = post.likedBy.indexOf(userId);
    if (index > -1) {
      post.likedBy.splice(index, 1);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likedBy.push(userId);
      post.likesCount += 1;
    }

    saveToStorage(STORAGE_KEYS.POSTS, this.posts);

    fetch('/api/mongodb/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    }).catch((err) => console.warn('MongoDB toggleLikePost sync error:', err));

    return post;
  }

  // Ride Logs
  getRideLogs(): RideLog[] {
    return this.logs;
  }

  logRide(log: Omit<RideLog, 'id' | 'verifiedByAdmin'>): RideLog {
    const newLog: RideLog = {
      ...log,
      id: `log_${Date.now()}`,
      verifiedByAdmin: true,
    };

    this.logs.unshift(newLog);
    saveToStorage(STORAGE_KEYS.LOGS, this.logs);

    fetch('/api/mongodb/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    }).catch((err) => console.warn('MongoDB logRide sync error:', err));

    const user = this.users.find((u) => u.id === log.userId);
    if (user) {
      if (user.totalMiles !== undefined) user.totalMiles += log.distanceMiles;
      if (user.totalRides !== undefined) user.totalRides += 1;
      this.updateUser(user);
    }

    return newLog;
  }

  // Routes
  getRoutes(): RouteMap[] {
    return this.routes;
  }

  toggleOfflineRouteCache(routeId: string): RouteMap {
    const route = this.routes.find((r) => r.id === routeId);
    if (!route) throw new Error('Route not found');

    route.offlineCached = !route.offlineCached;
    route.downloadedAt = route.offlineCached
      ? new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      : undefined;

    saveToStorage(STORAGE_KEYS.ROUTES, this.routes);
    return route;
  }

  // Notifications
  getNotifications(): NotificationItem[] {
    return this.notifications;
  }

  addNotification(notif: Omit<NotificationItem, 'id' | 'timestamp'>): NotificationItem {
    const newNotif: NotificationItem = {
      ...notif,
      id: `notif_${Date.now()}`,
      timestamp: 'Just now',
    };
    this.notifications.unshift(newNotif);
    saveToStorage(STORAGE_KEYS.NOTIFS, this.notifications);
    return newNotif;
  }

  markNotificationRead(id: string): void {
    const n = this.notifications.find((item) => item.id === id);
    if (n) {
      n.read = true;
      saveToStorage(STORAGE_KEYS.NOTIFS, this.notifications);
    }
  }

  markAllNotificationsRead(): void {
    this.notifications.forEach((n) => (n.read = true));
    saveToStorage(STORAGE_KEYS.NOTIFS, this.notifications);
  }

  // Announcements
  getAnnouncements(): Announcement[] {
    return this.announcements;
  }

  createAnnouncement(
    data: Omit<Announcement, 'id' | 'createdAt'>
  ): Announcement {
    const newAnn: Announcement = {
      ...data,
      id: `ann_${Date.now()}`,
      createdAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    };
    this.announcements.unshift(newAnn);
    saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, this.announcements);

    fetch('/api/mongodb/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAnn),
    }).catch((err) => console.warn('MongoDB createAnnouncement sync error:', err));

    return newAnn;
  }

  updateAnnouncement(ann: Announcement): Announcement {
    const index = this.announcements.findIndex((a) => a.id === ann.id);
    if (index > -1) {
      this.announcements[index] = {
        ...ann,
        updatedAt: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      };
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, this.announcements);

      fetch('/api/mongodb/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.announcements[index]),
      }).catch((err) => console.warn('MongoDB updateAnnouncement sync error:', err));

      return this.announcements[index];
    }
    return ann;
  }

  deleteAnnouncement(id: string): void {
    this.announcements = this.announcements.filter((a) => a.id !== id);
    saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, this.announcements);

    fetch(`/api/mongodb/updates/${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('MongoDB deleteAnnouncement sync error:', err));
  }

  togglePinAnnouncement(id: string): Announcement {
    const ann = this.announcements.find((a) => a.id === id);
    if (ann) {
      ann.pinned = !ann.pinned;
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, this.announcements);

      fetch('/api/mongodb/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ann),
      }).catch((err) => console.warn('MongoDB togglePin sync error:', err));

      return ann;
    }
    throw new Error('Announcement not found');
  }

  // Finance Settings & Configs
  getFinanceRecords(): any[] {
    try {
      const item = localStorage.getItem('bcc_finance_records_v3');
      if (item) return JSON.parse(item);
    } catch (e) {
      console.error('Failed to parse finance records:', e);
    }
    return [];
  }

  getFinanceSettings(): FinanceSettings {
    return this.financeSettings;
  }

  updateFinanceSettings(settings: FinanceSettings): FinanceSettings {
    this.financeSettings = { ...settings };
    saveToStorage(STORAGE_KEYS.FINANCE_SETTINGS, this.financeSettings);

    fetch('/api/mongodb/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'finance_settings', category: 'finance', ...this.financeSettings }),
    }).catch((err) => console.warn('MongoDB settings sync notice:', err));

    return this.financeSettings;
  }

  // Monthly Dues
  getMonthlyDues(): MonthlyDue[] {
    return this.monthlyDues;
  }

  createMonthlyDue(data: Omit<MonthlyDue, 'id' | 'createdAt'>): MonthlyDue {
    const newDue: MonthlyDue = {
      ...data,
      id: `md_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    this.monthlyDues.unshift(newDue);
    saveToStorage(STORAGE_KEYS.MONTHLY_DUES, this.monthlyDues);

    fetch('/api/mongodb/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'monthly_due', ...newDue }),
    }).catch((err) => console.warn('MongoDB monthly dues sync notice:', err));

    return newDue;
  }

  updateMonthlyDue(due: MonthlyDue): MonthlyDue {
    const idx = this.monthlyDues.findIndex((d) => d.id === due.id);
    if (idx > -1) {
      this.monthlyDues[idx] = { ...due };
      saveToStorage(STORAGE_KEYS.MONTHLY_DUES, this.monthlyDues);

      fetch('/api/mongodb/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'monthly_due', ...this.monthlyDues[idx] }),
      }).catch((err) => console.warn('MongoDB monthly dues sync notice:', err));
    }
    return due;
  }

  deleteMonthlyDue(id: string): void {
    this.monthlyDues = this.monthlyDues.filter((d) => d.id !== id);
    saveToStorage(STORAGE_KEYS.MONTHLY_DUES, this.monthlyDues);

    fetch(`/api/mongodb/settings/${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('MongoDB monthly dues delete notice:', err));
  }

  // Dynamic Collections
  getDynamicCollections(): DynamicCollection[] {
    return this.dynamicCollections;
  }

  createDynamicCollection(
    data: Omit<DynamicCollection, 'id' | 'createdAt'>
  ): DynamicCollection {
    const newCol: DynamicCollection = {
      ...data,
      id: `dc_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    this.dynamicCollections.unshift(newCol);
    saveToStorage(STORAGE_KEYS.DYNAMIC_COLLECTIONS, this.dynamicCollections);

    fetch('/api/mongodb/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'dynamic_collection', ...newCol }),
    }).catch((err) => console.warn('MongoDB dynamic collection sync notice:', err));

    return newCol;
  }

  updateDynamicCollection(col: DynamicCollection): DynamicCollection {
    const idx = this.dynamicCollections.findIndex((c) => c.id === col.id);
    if (idx > -1) {
      this.dynamicCollections[idx] = { ...col };
      saveToStorage(STORAGE_KEYS.DYNAMIC_COLLECTIONS, this.dynamicCollections);

      fetch('/api/mongodb/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'dynamic_collection', ...this.dynamicCollections[idx] }),
      }).catch((err) => console.warn('MongoDB dynamic collection sync notice:', err));
    }
    return col;
  }

  deleteDynamicCollection(id: string): void {
    this.dynamicCollections = this.dynamicCollections.filter(
      (c) => c.id !== id
    );
    saveToStorage(STORAGE_KEYS.DYNAMIC_COLLECTIONS, this.dynamicCollections);

    fetch(`/api/mongodb/settings/${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('MongoDB dynamic collection delete notice:', err));
  }
}

export const store = new DataStoreService();
