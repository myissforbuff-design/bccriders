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
  INITIAL_SECURITY_SETTINGS,
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
  SecuritySettings,
  FinanceYearArchive,
  TreasurerActionRequest,
  TreasurerActionType,
  TreasurerRequestStatus,
  ClubRoleDefinition,
  DEFAULT_CLUB_ROLE_DEFINITIONS,
} from '../types';
import {
  clearSensitiveStorage,
  loadFromLocal,
  saveToLocal,
  loadFromSession,
  saveToSession,
  removeFromSession,
  hasActiveUserSession,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from './storageSecurity';
import {
  getCachedData,
  setCachedData,
  removeCachedData,
  clearAllApiCache,
} from './apiCache';
import {
  triggerFinancePushNotification,
  triggerMemberApprovalPushNotification,
  triggerActivityCreatedPushNotification,
  triggerAnnouncementPushNotification,
} from './pushNotifications';

export { getCachedData, setCachedData, removeCachedData, clearAllApiCache };

// Storage Keys for session state persistence
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
  SECURITY_SETTINGS: 'bcc_security_settings_v1',
  FINANCE_ARCHIVES: 'bcc_finance_yearly_archives_v1',
  TREASURER_REQUESTS: 'bcc_treasurer_requests_v1',
  CLUB_ROLES: 'bcc_club_roles_v1',
  CURRENT_USER: 'bcc_current_user_id_v2',
  USER_PROFILE: 'bcc_user_profile_v2',
};

// Helper for localStorage persistence
function loadFromStorage<T>(key: string, initialFallback: T): T {
  return loadFromLocal<T>(key, initialFallback);
}

function saveToStorage<T>(key: string, data: T): void {
  saveToLocal<T>(key, data);
}

/**
 * Session expiry signalling.
 *
 * Every `/api/mongodb/*` route is now authenticated server-side, so a rejected
 * or expired token comes back as `401`. Swallowing that into an empty array
 * would render blank screens and spinners with no explanation, so instead we
 * clear the dead token once and let `AuthContext` sign the rider out and show
 * the login screen. The guard keeps a burst of parallel 401s from firing the
 * event (and the logout) several times over.
 */
let sessionExpiryNotified = false;

export function resetSessionExpiryNotice(): void {
  sessionExpiryNotified = false;
}

function handleUnauthorizedResponse(url: string): void {
  clearAuthToken();
  if (sessionExpiryNotified) return;
  sessionExpiryNotified = true;
  console.warn(`[Auth] Session rejected by the server while requesting ${url} — signing out.`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bcc_session_expired', { detail: { url } }));
  }
}

// Authenticated fetch wrapper injecting Bearer token
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const existingHeaders = (options?.headers as Record<string, string>) || {};
  const authHeaders: Record<string, string> = {
    ...existingHeaders,
  };

  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
    authHeaders['x-session-token'] = token;
  }

  const res = await fetch(url, {
    ...options,
    headers: authHeaders,
  });

  // Catch a dead session here rather than at each call site — most mutation
  // callers end in `.catch(() => {})` and would otherwise fail silently,
  // leaving the rider looking at a screen that quietly stopped saving.
  if (res.status === 401 || res.status === 403) {
    handleUnauthorizedResponse(url);
  }

  return res;
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
  const method = (options?.method || 'GET').toUpperCase();
  try {
    const res = await authFetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (res.status === 401 || res.status === 403) {
      handleUnauthorizedResponse(url);
      return { success: false, unauthorized: true, data: [] as any };
    }
    if (!res.ok || !contentType.includes('application/json')) {
      const cached = getCachedData<T | null>(url, null);
      if (cached !== null) {
        return { success: true, data: cached };
      }
      return { success: false, data: [] as any };
    }
    const result = await res.json();
    if (result && result.success && result.data !== undefined && method === 'GET') {
      setCachedData(url, result.data);
      // Synchronize associated entity caches
      if (url.startsWith('/api/mongodb/financeLogs')) {
        setCachedData('bcc_finance_records_v3', result.data);
        saveToSession('bcc_finance_records_v3', result.data);
      } else if (url.startsWith('/api/mongodb/liquidationLogs') || url.startsWith('/api/mongodb/expenseLogs')) {
        setCachedData('bcc_expense_records_v1', result.data);
        saveToSession('bcc_expense_records_v1', result.data);
      } else if (url.startsWith('/api/mongodb/activities')) {
        setCachedData('bcc_activities_cache_v1', result.data);
        saveToSession('bcc_activities_cache_v1', result.data);
      } else if (url.startsWith('/api/mongodb/attendanceLogs')) {
        setCachedData('bcc_attendance_logs_cache_v1', result.data);
        saveToSession('bcc_attendance_logs_cache_v1', result.data);
      }
    }
    return result;
  } catch {
    const cached = getCachedData<T | null>(url, null);
    if (cached !== null) {
      return { success: true, data: cached };
    }
    return { success: false, data: [] as any };
  }
}

export async function checkMongoDbStatus(): Promise<MongoStatusResponse> {
  try {
    const res = await authFetch('/api/mongodb/status');
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

// Upload / Storage Helper for Google Drive / MongoDB with automatic compression
export async function uploadStorageFile(
  file: File | Blob | string,
  folder = 'avatars',
  maxDimension = 800,
  quality = 0.82,
  lastName?: string
): Promise<string | null> {
  // Helper to send data URL to Google Drive upload API
  const pushToDriveIfConfigured = async (dataUrl: string): Promise<string> => {
    try {
      const res = await authFetch('/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, folder, lastName }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.url) {
          return json.url;
        }
      }
    } catch (e) {
      console.warn('[Drive Upload] Direct API upload attempt:', e);
    }
    return dataUrl;
  };

  if (typeof file === 'string') {
    if (!file.startsWith('data:image')) return file;
    const compressed = await new Promise<string>((resolve) => {
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

    return await pushToDriveIfConfigured(compressed);
  }

  const rawCompressed = await new Promise<string | null>((resolve) => {
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

  if (!rawCompressed) return null;
  return await pushToDriveIfConfigured(rawCompressed);
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
  private securitySettings: SecuritySettings;
  private financeArchives: FinanceYearArchive[];
  private treasurerRequests: TreasurerActionRequest[];
  private clubRoles: ClubRoleDefinition[];
  private currentUserId: string;

  constructor() {
    this.events = loadFromStorage(STORAGE_KEYS.EVENTS, INITIAL_EVENTS);
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
    this.currentUserId = loadFromStorage(STORAGE_KEYS.CURRENT_USER, '');
    this.users = loadFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
    this.payments = loadFromStorage(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
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
    this.securitySettings = loadFromStorage(
      STORAGE_KEYS.SECURITY_SETTINGS,
      INITIAL_SECURITY_SETTINGS
    );
    this.financeArchives = loadFromStorage(
      STORAGE_KEYS.FINANCE_ARCHIVES,
      []
    );
    this.treasurerRequests = loadFromStorage(
      STORAGE_KEYS.TREASURER_REQUESTS,
      []
    );
    this.clubRoles = loadFromStorage(
      STORAGE_KEYS.CLUB_ROLES,
      DEFAULT_CLUB_ROLE_DEFINITIONS
    );
  }

  async initMongoDb(): Promise<MongoStatusResponse> {
    const status = await checkMongoDbStatus();
    if (status.status === 'connected') {
      try {
        await this.refreshUsersFromServer({ seedIfEmpty: true });
        await this.refreshAnnouncementsFromServer();
        await this.refreshSettingsFromServer();
        await this.refreshMonthlyDuesFromServer();
      } catch (err) {
        console.warn('MongoDB sync fetch notice:', err);
      }
    }
    return status;
  }

  // ==========================================
  // Server-authoritative refresh helpers
  // ==========================================
  //
  // These pull the current truth out of MongoDB and push it into in-memory state, then
  // announce it on the existing `bcc_*_updated` event bus so every mounted component
  // re-renders. Real-time change stream events call straight into these (see
  // lib/realtimeSync.ts) — no page refresh, no tab switch, no `storage` event needed.
  //
  // localStorage is still written on the way through, but only as an offline cache for the
  // next cold start. It is no longer how two devices learn about each other's writes.

  /** Re-reads `members` + `registration` and republishes the merged user list. */
  async refreshUsersFromServer(options: { seedIfEmpty?: boolean } = {}): Promise<User[]> {
    // Fetch active members from 'members' table
    const dataMembers = await safeFetchJson('/api/mongodb/members');
    const activeMembers = (dataMembers.success && Array.isArray(dataMembers.data)) ? dataMembers.data : [];

    // Fetch pending registrations from 'registration' table
    const dataRegistration = await safeFetchJson('/api/mongodb/registration');
    const pendingRegistrations = (dataRegistration.success && Array.isArray(dataRegistration.data)) ? dataRegistration.data : [];

    if (activeMembers.length > 0 || pendingRegistrations.length > 0) {
      // Merge active members and pending registration forms with guaranteed usernames
      const sanitizedList = [...activeMembers, ...pendingRegistrations].map((u) => this.sanitizeUser(u));

      // Ensure the system admin exists in the list
      if (!sanitizedList.some((u) => u.id === 'usr_admin' || u.username?.toLowerCase() === 'admin' || u.role === 'admin')) {
        sanitizedList.unshift(INITIAL_USERS[0]);
      }

      this.users = sanitizedList;
      saveToStorage(STORAGE_KEYS.USERS, this.users);

      // Keep the cached profile of the signed-in rider aligned with the server copy
      const activeProfile = this.currentUserId
        ? this.users.find((u) => u.id === this.currentUserId)
        : undefined;
      if (activeProfile) {
        saveToStorage(STORAGE_KEYS.USER_PROFILE, activeProfile);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
      }
    } else if (options.seedIfEmpty) {
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

    return this.users;
  }

  /** Re-reads the `updates` collection and republishes announcements. */
  async refreshAnnouncementsFromServer(): Promise<Announcement[]> {
    const dataUpdates = await safeFetchJson('/api/mongodb/updates');
    if (dataUpdates.success && Array.isArray(dataUpdates.data)) {
      this.announcements = dataUpdates.data;
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, this.announcements);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bcc_announcements_updated', { detail: this.announcements }));
      }
    }
    return this.announcements;
  }

  /** Re-reads the `settings` collection (finance config, dues, collections, security). */
  async refreshSettingsFromServer(): Promise<void> {
    const dataSettings = await safeFetchJson('/api/mongodb/settings');
    if (!dataSettings.success || !Array.isArray(dataSettings.data) || dataSettings.data.length === 0) {
      return;
    }

    const finSettingsDoc = dataSettings.data.find((s: any) => s.id === 'finance_settings');
    if (finSettingsDoc) {
      this.financeSettings = {
        membershipFee: Number(finSettingsDoc.membershipFee) || 200,
        annualFee: Number(finSettingsDoc.annualFee) || 1000,
        annualPromoEnabled: finSettingsDoc.annualPromoEnabled !== undefined ? Boolean(finSettingsDoc.annualPromoEnabled) : true,
      };
      if (this.currentUserId || hasActiveUserSession()) {
        saveToStorage(STORAGE_KEYS.FINANCE_SETTINGS, this.financeSettings);
      }
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
      if (this.currentUserId || hasActiveUserSession()) {
        saveToStorage(STORAGE_KEYS.DYNAMIC_COLLECTIONS, this.dynamicCollections);
      }
    }

    const secSettingsDoc = dataSettings.data.find((s: any) => s.id === 'security_settings' || s.category === 'security');
    if (secSettingsDoc) {
      this.securitySettings = {
        adminOtpEnabled: secSettingsDoc.adminOtpEnabled !== undefined ? Boolean(secSettingsDoc.adminOtpEnabled) : true,
      };
      if (this.currentUserId || hasActiveUserSession()) {
        saveToStorage(STORAGE_KEYS.SECURITY_SETTINGS, this.securitySettings);
      }
    }

    const rolesDoc = dataSettings.data.find((s: any) => s.id === 'club_roles' || s.category === 'club_roles' || s.id === 'custom_roles');
    if (rolesDoc && Array.isArray(rolesDoc.roles) && rolesDoc.roles.length > 0) {
      this.clubRoles = rolesDoc.roles;
      if (this.currentUserId || hasActiveUserSession()) {
        saveToStorage(STORAGE_KEYS.CLUB_ROLES, this.clubRoles);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_settings_updated'));
      window.dispatchEvent(new CustomEvent('bcc_roles_updated', { detail: this.clubRoles }));
    }
  }

  async refreshMonthlyDuesFromServer(): Promise<MonthlyDue[]> {
    const data = await safeFetchJson('/api/mongodb/monthlyDues');
    if (data.success && Array.isArray(data.data)) {
      this.monthlyDues = data.data.map((d: any) => ({
        id: d.id,
        title: d.title || `${d.month || 'August'} ${d.year || 2026} Monthly Due`,
        month: d.month || 'August',
        year: Number(d.year) || 2026,
        amount: Number(d.amount) || 0,
        notes: d.notes || d.description || '',
        createdAt: d.createdAt || new Date().toISOString().split('T')[0],
        status: (d.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
      }));
      if (this.currentUserId || hasActiveUserSession()) {
        saveToStorage(STORAGE_KEYS.MONTHLY_DUES, this.monthlyDues);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bcc_monthly_dues_updated', { detail: this.monthlyDues }));
      }
    }
    return this.monthlyDues;
  }

  /** Re-reads `treasurerRequests` and republishes them. */
  async refreshTreasurerRequestsFromServer(): Promise<TreasurerActionRequest[]> {
    const data = await safeFetchJson('/api/mongodb/treasurerRequests');
    if (data.success && Array.isArray(data.data)) {
      this.treasurerRequests = data.data;
      saveToStorage(STORAGE_KEYS.TREASURER_REQUESTS, this.treasurerRequests);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bcc_treasurer_requests_updated', { detail: this.treasurerRequests }));
      }
    }
    return this.treasurerRequests;
  }

  /** Re-reads `financeArchives` and republishes them. */
  async refreshFinanceArchivesFromServer(): Promise<FinanceYearArchive[]> {
    const data = await safeFetchJson('/api/mongodb/financeArchives');
    if (data.success && Array.isArray(data.data)) {
      this.financeArchives = [...data.data].sort((a, b) => b.year - a.year);
      saveToStorage(STORAGE_KEYS.FINANCE_ARCHIVES, this.financeArchives);
    }
    return this.financeArchives;
  }

  // Explicitly fetch and initialize data upon successful authentication
  async fetchAuthenticatedData(): Promise<void> {
    await this.initMongoDb().catch((err) =>
      console.warn('MongoDB authenticated fetch notice:', err)
    );
  }

  // Clear all sensitive storage when unauthenticated
  clearStorageOnUnauthenticated(): void {
    this.currentUserId = '';
  }

  // Current User Session
  getCurrentUser(): User | null {
    // No server-signed token means no session. The cached user id on its own is
    // just a browser-owned string, and every API route now rejects it, so
    // trusting it would only produce a signed-in shell with no data in it.
    if (!hasActiveUserSession()) {
      this.currentUserId = '';
      return null;
    }
    if (!this.currentUserId) {
      const activeSessionId = loadFromStorage(STORAGE_KEYS.CURRENT_USER, '');
      if (activeSessionId) {
        this.currentUserId = activeSessionId;
      } else {
        return null;
      }
    }
    const found = this.users.find((u) => u.id === this.currentUserId);
    if (found) return found;

    // Check cached profile if users array hasn't completed MongoDB sync yet
    const cachedProfile = loadFromStorage<User | null>(STORAGE_KEYS.USER_PROFILE, null);
    if (cachedProfile && cachedProfile.id === this.currentUserId) {
      if (!this.users.some((u) => u.id === cachedProfile.id)) {
        this.users.push(cachedProfile);
      }
      return cachedProfile;
    }

    return null;
  }

  setCurrentUser(userOrId: User | string | null, token?: string): User | null {
    if (!userOrId) {
      this.logout();
      return null;
    }

    let targetId = '';
    let targetUser: User | undefined;

    if (typeof userOrId === 'object' && userOrId !== null) {
      targetUser = this.sanitizeUser(userOrId);
      targetId = targetUser.id;
    } else {
      targetId = String(userOrId);
      targetUser = this.users.find((u) => u.id === targetId);
    }

    this.currentUserId = targetId;
    if (token) {
      setAuthToken(token);
      resetSessionExpiryNotice();
    }
    saveToStorage(STORAGE_KEYS.CURRENT_USER, targetId);

    if (targetUser) {
      if (!this.users.some((u) => u.id === targetUser.id)) {
        this.users.unshift(targetUser);
      } else {
        this.users = this.users.map((u) => (u.id === targetUser.id ? targetUser! : u));
      }
      saveToStorage(STORAGE_KEYS.USERS, this.users);
      saveToStorage(STORAGE_KEYS.USER_PROFILE, targetUser);
    }

    this.initMongoDb().catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
    }

    return this.getCurrentUser();
  }

  logout(): void {
    this.currentUserId = '';
    clearAuthToken();
    resetSessionExpiryNotice();
    clearSensitiveStorage();
  }

  // Helper to ensure all required User fields are present and clean
  private sanitizeUser(user: User): User {
    const emailStr = (user.email || '').trim();
    const fallbackUsername = emailStr ? emailStr.split('@')[0] : `rider_${String(user.id || Date.now()).slice(-4)}`;
    const rawUsername = (user.username || '').trim();
    const cleanUsername = rawUsername || fallbackUsername;

    return {
      ...user,
      username: cleanUsername,
      email: emailStr,
      approvalStatus: user.approvalStatus || 'Approved',
      role: user.role || 'Member',
      memberNumber: user.memberNumber || 'BRC-0000',
    };
  }

  // Pre-flight lookup for the sign-in form (used by the 2FA OTP flow).
  //
  // This does NOT check the password and never did anything but drive local UI hints — the server
  // is the only thing that verifies credentials, via /api/auth/login-otp. It used to compare the
  // attempt against `matched.password` from the cached user list, which is doubly meaningless now:
  // the browser owns that cache, and the API no longer sends password fields to clients at all.
  // Kept because it gives the rider an instant "your application is still pending" message and a
  // fallback display identity if the server response omits one.
  checkCredentials(usernameInput: string, passwordAttempt: string): { success: boolean; user?: User; error?: string } {
    const rawInput = (usernameInput || '').trim();
    const normalizedUsername = rawInput.toLowerCase();
    const cleanPassword = (passwordAttempt || '').trim();

    if (!normalizedUsername || !cleanPassword) {
      return { success: false, error: 'Please enter both your registered username and password.' };
    }

    const matched = this.users.find((u) => {
      const uUsername = (u.username || '').trim().toLowerCase();
      const uRole = (u.role || '').trim().toLowerCase();

      return (
        (uUsername && uUsername === normalizedUsername) ||
        (normalizedUsername === 'admin' && (uRole === 'admin' || u.role === 'admin'))
      );
    });

    if (!matched) {
      return { success: false, error: 'Invalid Username or Password.' };
    }

    if (matched.approvalStatus === 'Pending') {
      return {
        success: false,
        error: 'Registration Pending: Your member application is currently awaiting admin approval before you can sign in to the portal.',
      };
    }

    return { success: true, user: this.sanitizeUser(matched) };
  }

  // Authorize sign-in directly after successful 2FA OTP verification
  loginWithUserId(userOrId: User | string, token?: string): User | null {
    return this.setCurrentUser(userOrId, token);
  }

  // Auth / Login — REMOVED.
  //
  // This used to verify `passwordAttempt` against the locally cached user list and grant a session
  // with no server token. Both inputs were browser-owned (`bcc_users_v2`), so it authenticated
  // against data the caller could edit. All sign-ins now go through /api/auth/login-otp or
  // /api/auth/webauthn/verify, which check credentials server-side and return a signed token.
  // `checkCredentials` is retained: it only drives local UI hints and grants nothing.

  // Users Management
  getUsers(): User[] {
    return this.users;
  }

  updateUserPassword(email: string, newPassword: string): boolean {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (newPassword || '').trim();
    let updated = false;

    this.users = this.users.map((u) => {
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) {
        updated = true;
        return { ...u, password: cleanPassword };
      }
      return u;
    });

    if (updated) {
      saveToStorage(STORAGE_KEYS.USERS, this.users);
    }
    return updated;
  }

  updateUser(updatedUser: User): User {
    const sanitized = this.sanitizeUser(updatedUser);
    const previousUser = this.users.find((u) => u.id === sanitized.id);
    const wasNotApproved = !previousUser || previousUser.approvalStatus !== 'Approved';
    const isNowApproved = sanitized.approvalStatus === 'Approved';

    this.users = this.users.map((u) => (u.id === sanitized.id ? sanitized : u));
    saveToStorage(STORAGE_KEYS.USERS, this.users);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
    }

    const endpoint = sanitized.approvalStatus === 'Pending' ? '/api/mongodb/registration' : '/api/mongodb/members';

    // Sync to MongoDB asynchronously and update with Google Drive URLs if converted
    authFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitized),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          let changed = false;
          if (data.avatar && data.avatar !== sanitized.avatar) {
            sanitized.avatar = data.avatar;
            changed = true;
          }
          if (data.bikePhotoUrl && sanitized.bikeInfo && data.bikePhotoUrl !== sanitized.bikeInfo.photoUrl) {
            sanitized.bikeInfo.photoUrl = data.bikePhotoUrl;
            changed = true;
          }
          if (changed) {
            this.users = this.users.map((u) => (u.id === sanitized.id ? { ...sanitized } : u));
            saveToStorage(STORAGE_KEYS.USERS, this.users);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
            }
          }
        }
      })
      .catch((err) => console.warn('MongoDB updateUser sync error:', err));

    if (wasNotApproved && isNowApproved) {
      // Trigger Web Push Alert for Member Approval
      triggerMemberApprovalPushNotification(sanitized.name, true).catch(() => {});
    }

    return sanitized;
  }

  addUser(newUser: Partial<User>): User {
    const isPending = (newUser.approvalStatus || 'Pending') === 'Pending';
    const userId = newUser.id || (isPending ? `reg_${Date.now()}` : `usr_${Date.now()}`);
    const emailStr = (newUser.email || '').trim();
    const cleanUsername = (newUser.username || '').trim() || (emailStr ? emailStr.split('@')[0] : `rider_${Date.now().toString().slice(-4)}`);

    const user: User = {
      ...newUser,
      id: userId,
      username: cleanUsername,
      name: newUser.name || `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || 'New Club Rider',
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      birthdate: newUser.birthdate,
      age: newUser.age,
      gender: newUser.gender || 'Male',
      email: emailStr || 'rider@bccriders.org',
      // No publicly-known default: an applicant who somehow submits without a password gets an
      // account that cannot sign in until one is set, rather than one everybody can sign into.
      password: newUser.password || '',
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

    const finalUser = this.sanitizeUser(user);
    this.users.unshift(finalUser);
    saveToStorage(STORAGE_KEYS.USERS, this.users);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
    }

    // Save to appropriate MongoDB collection: 'registration' if Pending, 'members' if Approved
    const endpoint = isPending ? '/api/mongodb/registration' : '/api/mongodb/members';
    authFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalUser),
    }).catch((err) => console.warn('MongoDB addUser sync error:', err));

    return finalUser;
  }

  // Helper placeholder kept for backward compatibility (no automated transactions on member approval)
  recordMembershipFeePayment(_approvedUser: User): void {
    // Automated membership fee creation on member approval disabled
  }

  // Approve a pending registration form, removing it from 'registration' table and transferring to 'members' table
  approveRegistration(approvedUser: User): User {
    const sanitized = this.sanitizeUser({
      ...approvedUser,
      approvalStatus: 'Approved',
    });

    // Update in local memory list (or insert if not present)
    const existsInList = this.users.some((u) => u.id === sanitized.id);
    if (existsInList) {
      this.users = this.users.map((u) => (u.id === sanitized.id ? sanitized : u));
    } else {
      this.users.unshift(sanitized);
    }
    saveToStorage(STORAGE_KEYS.USERS, this.users);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
    }

    // Call MongoDB transfer endpoint and dispatch approval email from info@bccriders.cc
    authFetch(`/api/mongodb/registration/accept/${sanitized.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitized),
    })
      .then((res) => {
        if (!res.ok) {
          // Fallback to standalone approval email endpoint if MongoDB accept fails or is offline
          authFetch('/api/members/send-approval-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized),
          }).catch((err) => console.warn('Fallback approval email error:', err));
        }
      })
      .catch((err) => {
        console.warn('MongoDB approveRegistration transfer error:', err);
        // Fallback standalone dispatch
        authFetch('/api/members/send-approval-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitized),
        }).catch((e) => console.warn('Approval email standalone error:', e));
      });

    return sanitized;
  }

  // Reject a pending registration form, removing from registration table and sending rejection email from info@bccriders.cc
  rejectRegistration(rejectedUser: User): void {
    const userId = rejectedUser.id;
    this.users = this.users.filter((u) => u.id !== userId);
    saveToStorage(STORAGE_KEYS.USERS, this.users);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
    }

    // Ensure any finance logs for this rejected applicant are purged locally
    try {
      const recKey = 'bcc_finance_records_v3';
      const savedRecs = loadFromSession<any[]>(recKey, []);
      const updatedRecs = savedRecs.filter(
        (r: any) =>
          r.userId !== userId &&
          r.id !== `rec_mf_${userId}` &&
          r.userMemberNo !== userId &&
          (!rejectedUser.name || r.userName !== rejectedUser.name)
      );
      saveToSession(recKey, updatedRecs);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bcc_finance_updated'));
      }
    } catch (e) {
      console.error(e);
    }

    // Call MongoDB reject endpoint with applicant data so rejection email is dispatched and logs are deleted
    authFetch(`/api/mongodb/registration/reject/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rejectedUser),
    })
      .then((res) => {
        if (!res.ok) {
          // Fallback to standalone rejection email endpoint if needed
          authFetch('/api/members/send-rejection-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rejectedUser),
          }).catch((err) => console.warn('Fallback rejection email error:', err));
        }
      })
      .catch((err) => {
        console.warn('MongoDB rejectRegistration error:', err);
        authFetch('/api/members/send-rejection-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rejectedUser),
        }).catch((e) => console.warn('Rejection email standalone error:', e));
      });

    // Also ensure deleted from MongoDB members and financeLogs if present
    authFetch(`/api/mongodb/members/${userId}`, { method: 'DELETE' }).catch(() => {});
    authFetch(`/api/mongodb/financeLogs/rec_mf_${userId}`, { method: 'DELETE' }).catch(() => {});
    authFetch(`/api/mongodb/financeLogs?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }).catch(() => {});
  }

  deleteUser(userId: string): void {
    const targetUser = this.users.find((u) => u.id === userId);
    this.users = this.users.filter((u) => u.id !== userId);
    saveToStorage(STORAGE_KEYS.USERS, this.users);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_users_updated', { detail: this.users }));
    }

    // Purge finance records
    try {
      const recKey = 'bcc_finance_records_v3';
      const savedRecs = loadFromSession<any[]>(recKey, []);
      const updatedRecs = savedRecs.filter(
        (r: any) =>
          r.userId !== userId &&
          r.id !== `rec_mf_${userId}` &&
          r.userMemberNo !== userId &&
          (!targetUser?.name || r.userName !== targetUser.name)
      );
      saveToSession(recKey, updatedRecs);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bcc_finance_updated'));
      }
    } catch (e) {
      console.error(e);
    }

    // Remove from both 'members' and 'registration' tables and financeLogs in MongoDB
    authFetch(`/api/mongodb/members/${userId}`, { method: 'DELETE' }).catch(() => {});
    authFetch(`/api/mongodb/registration/${userId}`, { method: 'DELETE' }).catch(() => {});
    authFetch(`/api/mongodb/financeLogs/rec_mf_${userId}`, { method: 'DELETE' }).catch(() => {});
    authFetch(`/api/mongodb/financeLogs?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }).catch(() => {});
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

    authFetch('/api/mongodb/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    }).catch((err) => console.warn('MongoDB addEvent sync error:', err));

    // Trigger Web Push Alert for Activity Created
    triggerActivityCreatedPushNotification(newEvent.title, newEvent.date, newEvent.startLocation).catch(() => {});

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

    authFetch('/api/mongodb/events', {
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

    authFetch('/api/mongodb/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayment),
    }).catch((err) => console.warn('MongoDB addPayment sync error:', err));

    // Trigger Web Push Alert for Finance Transaction
    triggerFinancePushNotification(newPayment.type || 'payment', newPayment.amount, newPayment.description || `${newPayment.userName} - ${newPayment.type}`).catch(() => {});

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

    authFetch('/api/mongodb/posts', {
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

    authFetch('/api/mongodb/posts', {
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

    authFetch('/api/mongodb/logs', {
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

    authFetch('/api/mongodb/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAnn),
    }).catch((err) => console.warn('MongoDB createAnnouncement sync error:', err));

    // Trigger Web Push Alert for Announcement & Updates
    triggerAnnouncementPushNotification(newAnn.title, newAnn.content).catch(() => {});

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

      authFetch('/api/mongodb/updates', {
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

    authFetch(`/api/mongodb/updates/${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('MongoDB deleteAnnouncement sync error:', err));
  }

  togglePinAnnouncement(id: string): Announcement {
    const ann = this.announcements.find((a) => a.id === id);
    if (ann) {
      ann.pinned = !ann.pinned;
      saveToStorage(STORAGE_KEYS.ANNOUNCEMENTS, this.announcements);

      authFetch('/api/mongodb/updates', {
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
      const fromCache = getCachedData<any[]>('/api/mongodb/financeLogs', null as any);
      if (fromCache && Array.isArray(fromCache) && fromCache.length > 0) {
        return fromCache;
      }
      return loadFromSession<any[]>('bcc_finance_records_v3', []);
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

    authFetch('/api/mongodb/settings', {
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

    authFetch('/api/mongodb/monthlyDues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDue),
    }).catch((err) => console.warn('MongoDB monthly dues sync notice:', err));

    return newDue;
  }

  updateMonthlyDue(due: MonthlyDue): MonthlyDue {
    const idx = this.monthlyDues.findIndex((d) => d.id === due.id);
    if (idx > -1) {
      this.monthlyDues[idx] = { ...due };
      saveToStorage(STORAGE_KEYS.MONTHLY_DUES, this.monthlyDues);

      authFetch('/api/mongodb/monthlyDues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.monthlyDues[idx]),
      }).catch((err) => console.warn('MongoDB monthly dues sync notice:', err));
    }
    return due;
  }

  deleteMonthlyDue(id: string): void {
    this.monthlyDues = this.monthlyDues.filter((d) => d.id !== id);
    saveToStorage(STORAGE_KEYS.MONTHLY_DUES, this.monthlyDues);

    authFetch(`/api/mongodb/monthlyDues/${id}`, {
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

    authFetch('/api/mongodb/settings', {
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

      authFetch('/api/mongodb/settings', {
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

    authFetch(`/api/mongodb/settings/${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('MongoDB dynamic collection delete notice:', err));
  }

  // Security Settings
  getSecuritySettings(): SecuritySettings {
    return this.securitySettings;
  }

  updateSecuritySettings(settings: Partial<SecuritySettings>): SecuritySettings {
    this.securitySettings = {
      ...this.securitySettings,
      ...settings,
    };
    saveToStorage(STORAGE_KEYS.SECURITY_SETTINGS, this.securitySettings);

    authFetch('/api/settings/security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.securitySettings),
    }).catch((err) => console.warn('Server security settings sync notice:', err));

    authFetch('/api/mongodb/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'security_settings', category: 'security', ...this.securitySettings }),
    }).catch((err) => console.warn('MongoDB security settings sync notice:', err));

    return this.securitySettings;
  }

  // Club Roles Management (Settings > System Security & Biometrics)
  getClubRoles(): ClubRoleDefinition[] {
    try {
      const parsed = loadFromSession<ClubRoleDefinition[]>(STORAGE_KEYS.CLUB_ROLES, this.clubRoles);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.clubRoles = parsed;
      }
    } catch {}
    return this.clubRoles;
  }

  getClubRoleNames(): string[] {
    const roles = this.getClubRoles();
    return roles.map((r) => r.name);
  }

  saveClubRole(roleData: Omit<ClubRoleDefinition, 'id'> & { id?: string }): ClubRoleDefinition {
    const roleId = roleData.id || `role_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newRole: ClubRoleDefinition = {
      id: roleId,
      name: roleData.name.trim(),
      category: roleData.category || 'Custom',
      badgeAbbr: roleData.badgeAbbr?.trim() || roleData.name.trim().slice(0, 3).toUpperCase(),
      badgeBgColor: roleData.badgeBgColor || '#059669',
      badgeTextColor: roleData.badgeTextColor || '#ffffff',
      description: roleData.description?.trim() || '',
      isSystemDefault: roleData.isSystemDefault ?? false,
      createdAt: roleData.createdAt || new Date().toISOString(),
    };

    const existingIdx = this.clubRoles.findIndex(
      (r) => r.id === roleId || r.name.toLowerCase() === newRole.name.toLowerCase()
    );

    if (existingIdx > -1) {
      this.clubRoles[existingIdx] = {
        ...this.clubRoles[existingIdx],
        ...newRole,
        // preserve system default flag if it was core
        isSystemDefault: this.clubRoles[existingIdx].isSystemDefault ?? newRole.isSystemDefault,
      };
    } else {
      this.clubRoles.push(newRole);
    }

    saveToStorage(STORAGE_KEYS.CLUB_ROLES, this.clubRoles);

    authFetch('/api/mongodb/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'club_roles', category: 'club_roles', roles: this.clubRoles }),
    }).catch((err) => console.warn('MongoDB club roles sync error:', err));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_roles_updated', { detail: this.clubRoles }));
      window.dispatchEvent(new CustomEvent('bcc_settings_updated'));
    }

    return newRole;
  }

  deleteClubRole(id: string): boolean {
    const roleToDelete = this.clubRoles.find((r) => r.id === id);
    if (!roleToDelete || roleToDelete.isSystemDefault) {
      return false;
    }

    this.clubRoles = this.clubRoles.filter((r) => r.id !== id);
    saveToStorage(STORAGE_KEYS.CLUB_ROLES, this.clubRoles);

    authFetch('/api/mongodb/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'club_roles', category: 'club_roles', roles: this.clubRoles }),
    }).catch((err) => console.warn('MongoDB club roles delete sync error:', err));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bcc_roles_updated', { detail: this.clubRoles }));
      window.dispatchEvent(new CustomEvent('bcc_settings_updated'));
    }

    return true;
  }

  // Finance Yearly Archives
  getFinanceArchives(): FinanceYearArchive[] {
    try {
      const parsed = loadFromSession<FinanceYearArchive[]>(STORAGE_KEYS.FINANCE_ARCHIVES, []);
      if (Array.isArray(parsed)) {
        this.financeArchives = parsed;
      }
    } catch {}
    return this.financeArchives;
  }

  saveFinanceArchive(archive: FinanceYearArchive): FinanceYearArchive {
    const existingIdx = this.financeArchives.findIndex((a) => a.id === archive.id || a.year === archive.year);
    if (existingIdx > -1) {
      this.financeArchives[existingIdx] = { ...archive };
    } else {
      this.financeArchives.push(archive);
    }
    // Sort archives by year descending
    this.financeArchives.sort((a, b) => b.year - a.year);
    saveToStorage(STORAGE_KEYS.FINANCE_ARCHIVES, this.financeArchives);

    authFetch('/api/mongodb/financeArchives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(archive),
    }).catch((err) => console.warn('MongoDB financeArchives sync error:', err));

    return archive;
  }

  deleteFinanceArchive(idOrYear: string | number): void {
    this.financeArchives = this.financeArchives.filter(
      (a) => a.id !== idOrYear && String(a.year) !== String(idOrYear)
    );
    saveToStorage(STORAGE_KEYS.FINANCE_ARCHIVES, this.financeArchives);

    authFetch(`/api/mongodb/financeArchives/${idOrYear}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('MongoDB financeArchives delete error:', err));
  }

  getTotalCarriedOverTreasury(): number {
    const archives = this.getFinanceArchives();
    return archives.reduce((sum, a) => sum + (Number(a.carriedOverTreasury) || 0), 0);
  }

  // Treasurer Security & Anti-Tampering Authorization Requests
  getTreasurerRequests(): TreasurerActionRequest[] {
    try {
      const parsed = loadFromSession<TreasurerActionRequest[]>(STORAGE_KEYS.TREASURER_REQUESTS, []);
      if (Array.isArray(parsed)) {
        this.treasurerRequests = parsed;
      }
    } catch {}
    return this.treasurerRequests;
  }

  createTreasurerRequest(
    data: Omit<TreasurerActionRequest, 'id' | 'createdAt' | 'status'>
  ): TreasurerActionRequest {
    const newReq: TreasurerActionRequest = {
      ...data,
      id: `treq_${Date.now()}`,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    this.treasurerRequests.unshift(newReq);
    saveToStorage(STORAGE_KEYS.TREASURER_REQUESTS, this.treasurerRequests);

    // Create immediate notification for the Admin
    const actionLabel = newReq.actionType === 'edit' ? 'edit/modify' : 'permanently delete';
    this.addNotification({
      title: 'Treasurer Authorization Request',
      message: `${newReq.requesterName} (Treasurer) requested admin approval to ${actionLabel} "${newReq.targetTitle}". Reason: ${newReq.reason || 'Not specified'}`,
      type: 'system',
      read: false,
    });

    authFetch('/api/mongodb/treasurerRequests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReq),
    }).catch((err) => console.warn('MongoDB treasurerRequests sync error:', err));

    return newReq;
  }

  updateTreasurerRequestStatus(
    id: string,
    status: TreasurerRequestStatus,
    adminName: string,
    adminNotes?: string
  ): TreasurerActionRequest | null {
    const req = this.treasurerRequests.find((r) => r.id === id);
    if (!req) return null;

    req.status = status;
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = adminName;
    if (adminNotes !== undefined) {
      req.adminNotes = adminNotes;
    }

    saveToStorage(STORAGE_KEYS.TREASURER_REQUESTS, this.treasurerRequests);

    // Notify the Treasurer of the Admin's decision
    const statusText = status === 'Granted' ? 'GRANTED access' : status === 'Denied' ? 'DENIED access' : status;
    this.addNotification({
      title: status === 'Granted' ? 'Treasurer Access Granted' : 'Treasurer Access Denied',
      message: `Admin ${adminName} has ${statusText} for your request to ${req.actionType} "${req.targetTitle}".${adminNotes ? ` Note: "${adminNotes}"` : ''}`,
      type: 'system',
      read: false,
      userId: req.requesterId,
    });

    authFetch('/api/mongodb/treasurerRequests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }).catch((err) => console.warn('MongoDB treasurerRequests update error:', err));

    return req;
  }

  hasGrantedTreasurerAccess(
    requesterId: string,
    targetId: string,
    actionType: TreasurerActionType
  ): TreasurerActionRequest | null {
    const requests = this.getTreasurerRequests();
    const match = requests.find(
      (r) =>
        r.targetId === targetId &&
        r.actionType === actionType &&
        r.status === 'Granted'
    );
    return match || null;
  }

  completeTreasurerRequest(targetId: string, actionType: TreasurerActionType): void {
    const requests = this.getTreasurerRequests();
    let modified = false;
    requests.forEach((r) => {
      if (r.targetId === targetId && r.actionType === actionType && r.status === 'Granted') {
        r.status = 'Completed';
        modified = true;
      }
    });

    if (modified) {
      this.treasurerRequests = requests;
      saveToStorage(STORAGE_KEYS.TREASURER_REQUESTS, this.treasurerRequests);

      // Sync completed status to backend
      const completed = requests.filter((r) => r.targetId === targetId && r.actionType === actionType);
      completed.forEach((r) => {
        authFetch('/api/mongodb/treasurerRequests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(r),
        }).catch((err) => console.warn('MongoDB treasurerRequests completion sync error:', err));
      });
    }
  }

  deleteTreasurerRequest(id: string): void {
    this.treasurerRequests = this.treasurerRequests.filter((r) => r.id !== id);
    saveToStorage(STORAGE_KEYS.TREASURER_REQUESTS, this.treasurerRequests);

    authFetch(`/api/mongodb/treasurerRequests/${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('MongoDB treasurerRequests delete error:', err));
  }
}

export const store = new DataStoreService();
