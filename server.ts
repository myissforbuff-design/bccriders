import express from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { MongoClient, Db, ChangeStream } from 'mongodb';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import webpush from 'web-push';

const app = express();
const PORT = 3000;

// Security Hardening: Enable Cloudflare Trust Proxy so client IPs are accurately parsed from CF-Connecting-IP & X-Forwarded-For
app.set('trust proxy', 1);

// Security Hardening: Remove Express signature to prevent server fingerprinting
app.disable('x-powered-by');

// Security Hardening: Apply comprehensive HTTP security headers (A+ Security Grade & Preview Compatible)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Allow framing by AI Studio preview while maintaining clickjacking defense
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; " +
    "img-src 'self' https: data: blob: https://images.unsplash.com https://*.resend.com; " +
    "font-src 'self' https: data:; " +
    "connect-src 'self' https: wss: http: data: blob:; " +
    "frame-ancestors 'self' https://aistudio.google.com https://*.google.com;"
  );
  next();
});

// Canonical domain redirect: Redirect default *.onrender.com traffic to custom domain bccriders.cc
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.includes('onrender.com')) {
    const targetUrl = `https://bccriders.cc${req.originalUrl || req.url}`;
    return res.redirect(301, targetUrl);
  }
  next();
});

// Lazy initialize Resend client
let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// In-memory OTP storage for Password Resets & Login 2FA Authorization (5 min TTL)
interface OtpEntry {
  email: string;
  otp: string;
  expiresAt: number;
  userId?: string;
  username?: string;
  user?: any;
  name?: string;
  type?: 'reset' | 'login';
  role?: string;
}
const otpCache = new Map<string, OtpEntry>();

// Increase payload limit for avatar image base64 uploads or large documents
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection Setup
const mongoUri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB_NAME || 'bcc-riders-club-db';

let mongoClient: MongoClient | null = null;
let db: Db | null = null;

async function getMongoDb(): Promise<Db | null> {
  if (!mongoUri) return null;
  if (db) return db;
  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    console.log(`Connected successfully to Primary MongoDB database: ${dbName}`);
    return db;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return null;
  }
}

// Dedicated Inbound Email MongoDB Connection Setup
const inboundMongoUri = process.env.MONGODB_INBOUND_URI || process.env.INBOUND_MONGODB_URI || mongoUri;
const inboundDbName = process.env.MONGODB_INBOUND_DB_NAME || process.env.INBOUND_MONGODB_DB_NAME || (process.env.MONGODB_INBOUND_URI ? 'bcc-inbound-emails' : dbName);

let inboundMongoClient: MongoClient | null = null;
let inboundDb: Db | null = null;

async function getInboundMongoDb(): Promise<Db | null> {
  if (!inboundMongoUri) return null;
  if (inboundDb) return inboundDb;
  try {
    // If the URI is identical to the primary, reuse primary connection
    if (inboundMongoUri === mongoUri && inboundDbName === dbName) {
      inboundDb = await getMongoDb();
      return inboundDb;
    }
    inboundMongoClient = new MongoClient(inboundMongoUri);
    await inboundMongoClient.connect();
    inboundDb = inboundMongoClient.db(inboundDbName);
    console.log(`[Resend Inbound] Connected to Dedicated Inbound MongoDB database: ${inboundDbName}`);
    return inboundDb;
  } catch (err) {
    console.error('[Resend Inbound] Dedicated MongoDB connection error, falling back to primary:', err);
    return getMongoDb();
  }
}

// Bootstrap password for the seeded administrator, used only when the database has no admin yet.
// It lives in the environment rather than in this file: a constant committed to the repo is a
// published credential, and this one was `bccriders123`.
const ADMIN_BOOTSTRAP_PASSWORD = (process.env.ADMIN_INITIAL_PASSWORD || '').trim() || 'bccriders123';

if (!process.env.ADMIN_INITIAL_PASSWORD) {
  console.warn(
    '[Auth] ADMIN_INITIAL_PASSWORD is not set, so the seeded admin still uses the password published ' +
      "in this repository. Set ADMIN_INITIAL_PASSWORD, or change the admin's password in the app."
  );
}

// Initial default seed data for automatic database creation
const INITIAL_SEED_MEMBERS = [
  {
    id: 'usr_admin',
    username: 'admin',
    name: 'Marcus Vance (Admin)',
    email: 'admin@bccriders.org',
    role: 'admin',
    memberNumber: 'BRC-0000',
    password: ADMIN_BOOTSTRAP_PASSWORD,
    phone: '+63 917 123 4567',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    bio: 'Founder & Club President. Honda Africa Twin enthusiast.',
    joinDate: '2026-01-01',
    emergencyContact: { name: 'Helen Vance', relationship: 'Spouse', phone: '+63 917 987 6543' },
    bikeInfo: { make: 'Honda', model: 'CRF1100L Africa Twin', year: 2024, engineCc: '1084cc', licensePlate: 'BCC-01' },
    approvalStatus: 'Approved',
  },
];

// Helper to sanitize member documents by stripping removed properties and enforcing BRC-0000 format
function sanitizeMemberForMongo(rawMember: any) {
  if (!rawMember || typeof rawMember !== 'object') return rawMember;
  const {
    annualDuesAmount,
    duesStatus,
    duesExpiryDate,
    unlockedBadgeIds,
    membershipType,
    streakDays,
    totalMiles,
    totalRides,
    _id,
    ...rest
  } = rawMember;

  if (rest.memberNumber && typeof rest.memberNumber === 'string') {
    if (rest.memberNumber.startsWith('BCC-')) {
      rest.memberNumber = rest.memberNumber.replace(/^BCC-/, 'BRC-');
    }
  } else {
    rest.memberNumber = 'BRC-0000';
  }

  const emailStr = (rest.email || '').trim();
  const fallbackUsername = emailStr
    ? emailStr.split('@')[0]
    : rest.name
    ? String(rest.name).trim().toLowerCase().replace(/\s+/g, '_')
    : `rider_${String(rest.id || Date.now()).slice(-4)}`;

  rest.username = (rest.username && String(rest.username).trim()) || fallbackUsername;
  rest.email = emailStr;

  return rest;
}

// Helper to sanitize registration documents containing all submitted form fields as columns
function sanitizeRegistrationForMongo(rawReg: any) {
  if (!rawReg || typeof rawReg !== 'object') return rawReg;
  const { _id, ...rest } = rawReg;
  const emailStr = (rest.email || '').trim();
  const fallbackUsername = emailStr
    ? emailStr.split('@')[0]
    : rest.name
    ? String(rest.name).trim().toLowerCase().replace(/\s+/g, '_')
    : `user_${Date.now()}`;
  const cleanUsername = (rest.username && String(rest.username).trim()) || fallbackUsername;

  return {
    id: rest.id || `reg_${Date.now()}`,
    username: cleanUsername,
    name: rest.name || `${rest.firstName || ''} ${rest.lastName || ''}`.trim() || 'Applicant',
    firstName: rest.firstName || '',
    lastName: rest.lastName || '',
    birthdate: rest.birthdate || '',
    age: rest.age,
    gender: rest.gender || 'Male',
    email: emailStr,
    // No default password. An applicant record with no credential simply cannot sign in
    // (see verifyPassword) instead of accepting the well-known string this used to fall back to.
    password: rest.password || '',
    phone: rest.phone || rest.mobileNo || '',
    mobileNo: rest.mobileNo || rest.phone || '',
    address: rest.address || '',
    network: rest.network || '',
    chapter: rest.chapter || '',
    civilStatus: rest.civilStatus || 'Single',
    leadersContactNo: rest.leadersContactNo || '',
    affiliation: rest.affiliation || 'House Church',
    occupation: rest.occupation || '',
    occupationStatus: rest.occupationStatus || 'Active',
    lifeInsurance: rest.lifeInsurance || '',
    licenseNo: rest.licenseNo || '',
    licenseExpiryDate: rest.licenseExpiryDate || '',
    membershipType: rest.membershipType || 'Standard',
    avatar: rest.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250',
    emergencyContact: rest.emergencyContact || { name: '', relationship: '', phone: '' },
    bikeInfo: rest.bikeInfo || { make: 'Yamaha', model: 'MT-09', year: 2024, engineCc: '890cc' },
    ridingExperience: rest.ridingExperience || 'Regular',
    riderType: rest.riderType || 'Beginner',
    reasonForJoining: rest.reasonForJoining || '',
    recommendedBy: rest.recommendedBy || '',
    applicantSignature: rest.applicantSignature || '',
    declarationDate: rest.declarationDate || new Date().toISOString().split('T')[0],
    role: rest.role || 'Members',
    memberNumber: rest.memberNumber || 'Pending',
    approvalStatus: 'Pending',
    joinDate: rest.joinDate || new Date().toISOString().split('T')[0],
    ...rest,
  };
}

// Ensure database indexes for fast query lookup and auto-seed initial members collection
async function initMongoIndexes() {
  const database = await getMongoDb();
  if (!database) return;
  try {
    // Initialize 'members', 'registration', and 'attendanceLogs' collections
    await database.collection('members').createIndex({ id: 1 }, { unique: true });
    await database.collection('members').createIndex({ username: 1 });
    await database.collection('members').createIndex({ email: 1 });

    await database.collection('registration').createIndex({ id: 1 }, { unique: true });
    await database.collection('registration').createIndex({ username: 1 });
    await database.collection('registration').createIndex({ email: 1 });

    await database.collection('attendanceLogs').createIndex({ id: 1 }, { unique: true });
    await database.collection('attendanceLogs').createIndex({ "Member ID": 1, "Event Name": 1 });

    await database.collection('financeLogs').createIndex({ id: 1 }, { unique: true });
    await database.collection('financeLogs').createIndex({ userId: 1 });

    await database.collection('expenseLogs').createIndex({ id: 1 }, { unique: true });
    await database.collection('liquidationLogs').createIndex({ id: 1 }, { unique: true });
    await database.collection('settings').createIndex({ id: 1 }, { unique: true });
    await database.collection('monthlyDues').createIndex({ id: 1 }, { unique: true });
    await database.collection('monthlyDueLogs').createIndex({ id: 1 }, { unique: true });
    await database.collection('monthlyDueLogs').createIndex({ userId: 1 });
    await database.collection('activities').createIndex({ id: 1 }, { unique: true });

    // Clean up 'avatar' and 'photoUrl' columns/fields from 'activities' (and any legacy 'activites') collections
    await cleanupActivitiesCollection(database);

    // Clean up obsolete fields from existing MongoDB documents in 'members' collection
    await database.collection('members').updateMany(
      {},
      {
        $unset: {
          annualDuesAmount: '',
          unlockedBadgeIds: '',
          membershipType: '',
          streakDays: '',
          totalMiles: '',
          totalRides: '',
        },
      }
    );

    // Ensure all existing documents in 'members' collection have non-empty, trimmed username
    const membersWithoutUsername = await database.collection('members').find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' },
        { username: { $type: 'string', $regex: /^\s*$/ } },
      ],
    }).toArray();

    for (const doc of membersWithoutUsername) {
      const emailStr = (doc.email || '').trim();
      const fallbackUser = emailStr
        ? emailStr.split('@')[0]
        : doc.name
        ? String(doc.name).trim().toLowerCase().replace(/\s+/g, '_')
        : `rider_${String(doc.id || doc._id).slice(-4)}`;
      await database.collection('members').updateOne(
        { _id: doc._id },
        { $set: { username: fallbackUser } }
      );
    }

    // Ensure all existing documents in 'registration' collection have non-empty, trimmed username
    const regsWithoutUsername = await database.collection('registration').find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' },
        { username: { $type: 'string', $regex: /^\s*$/ } },
      ],
    }).toArray();

    for (const doc of regsWithoutUsername) {
      const emailStr = (doc.email || '').trim();
      const fallbackUser = emailStr
        ? emailStr.split('@')[0]
        : doc.name
        ? String(doc.name).trim().toLowerCase().replace(/\s+/g, '_')
        : `user_${String(doc.id || doc._id).slice(-4)}`;
      await database.collection('registration').updateOne(
        { _id: doc._id },
        { $set: { username: fallbackUser } }
      );
    }

    // Update legacy BCC- member numbers to BRC- format
    const legacyDocs = await database.collection('members').find({ memberNumber: /^BCC-/i }).toArray();
    for (const doc of legacyDocs) {
      const updatedNumber = doc.memberNumber.replace(/^BCC-/i, 'BRC-');
      await database.collection('members').updateOne(
        { _id: doc._id },
        { $set: { memberNumber: updatedNumber } }
      );
    }

    // Purge any mock/test seed records for Elena Rostova across collections
    await database.collection('members').deleteMany({
      $or: [{ id: 'usr_member_1' }, { username: 'elena_r' }, { name: 'Elena Rostova' }],
    });
    await database.collection('registration').deleteMany({
      $or: [{ id: 'usr_member_1' }, { username: 'elena_r' }, { name: 'Elena Rostova' }],
    });
    await database.collection('financeLogs').deleteMany({
      $or: [
        { id: 'rec_mf_usr_member_1' },
        { memberId: 'usr_member_1' },
        { memberName: 'Elena Rostova' },
        { particulars: { $regex: /Elena Rostova/i } },
      ],
    });

    // Auto seed members if empty so the database and collection appear in MongoDB Compass / Atlas immediately
    const count = await database.collection('members').countDocuments();
    if (count === 0) {
      console.log('Seeding initial member documents into MongoDB...');
      for (const member of INITIAL_SEED_MEMBERS) {
        const seedDoc = sanitizeMemberForMongo({ ...member });
        normalizePasswordForWrite(seedDoc);
        await database.collection('members').updateOne(
          { id: member.id },
          { $set: seedDoc },
          { upsert: true }
        );
      }
    }

    // Purge any stray finance logs for pending applicants in the registration table who have not been approved
    const pendingRegs = await database.collection('registration').find({}).toArray();
    const approvedDocs = await database.collection('members').find({}).toArray();
    const approvedIds = new Set(approvedDocs.map((m: any) => m.id));
    const strictlyPendingIds = pendingRegs.map((r: any) => r.id).filter((id: string) => id && !approvedIds.has(id));

    if (strictlyPendingIds.length > 0) {
      await database.collection('financeLogs').deleteMany({
        $or: [
          { userId: { $in: strictlyPendingIds } },
          { id: { $in: strictlyPendingIds.map((id: string) => `rec_mf_${id}`) } },
          { userMemberNo: { $in: strictlyPendingIds } },
        ],
      });
    }

    // Auto seed settings collection if empty
    const settingsCount = await database.collection('settings').countDocuments();
    if (settingsCount === 0) {
      console.log('Seeding initial settings documents into MongoDB "settings" table...');
      const defaultSettings = [
        {
          id: 'finance_settings',
          category: 'finance',
          membershipFee: 500,
          annualFee: 1200,
          currency: 'PHP',
          paymentInstructions: 'GCash / Bank Transfer to BRC Treasury Account: 0917-123-4567 (Juan Dela Cruz)',
          autoGeneratePendingDues: true,
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'club_profile',
          category: 'club_info',
          clubName: 'BCC Riders Club',
          tagline: 'Precision, Passion, & Brotherhood on Two Wheels',
          contactEmail: 'treasury@bccridersclub.ph',
          contactPhone: '+63 917 123 4567',
          address: 'Baguio City, Philippines',
          establishedYear: '2020',
          updatedAt: new Date().toISOString(),
        },
      ];
      for (const item of defaultSettings) {
        await database.collection('settings').updateOne(
          { id: item.id },
          { $set: item },
          { upsert: true }
        );
      }
      console.log('Successfully seeded initial settings into MongoDB "settings" collection table!');
    }
  } catch (e) {
    console.warn('MongoDB index initialization notice:', e);
  }
}
initMongoIndexes();

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    // Surfaced so the keep-alive ping doubles as a real-time sync check.
    realtime: {
      mode: realtimeState.mode,
      connectedClients: io.engine.clientsCount,
      lastChangeAt: realtimeState.lastChangeAt,
    },
  });
});

// Resend Status & Configuration Endpoint
app.get('/api/resend/status', (req, res) => {
  const hasKey = !!process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@bccriders.cc';
  res.json({
    configured: hasKey,
    fromEmail,
    domain: 'bccriders.cc',
  });
});

// ==========================================
// Session Token & API Authorization Guard
// ==========================================
// Tokens are `base64url(payload).base64url(HMAC-SHA256(payload))`.
//
// The previous scheme reduced the signature to `Math.abs(djb2Hash).toString(36)` — at most 2^31
// possible signatures over a payload the client fully controls. Minting a token that claimed
// `role: "admin"` and a ten-year expiry was a few seconds of offline brute force, so every guard
// built on top of it was decorative. HMAC-SHA256 makes the signature unforgeable without the key.

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const SERVER_AUTH_SECRET = resolveAuthSecret();

function resolveAuthSecret(): string {
  const explicit = (process.env.AUTH_SECRET || '').trim();
  if (explicit.length >= 24) return explicit;
  if (explicit) {
    console.warn('[Auth] AUTH_SECRET is under 24 characters — too weak to sign sessions with, ignoring it.');
  }

  // Never fall back to a constant committed to the repo: anyone who can read the source could mint
  // valid admin sessions. Deriving from the Mongo URI keeps the key server-only and stable across
  // restarts, so sessions survive a Render redeploy or spin-down.
  const mongoUri = (process.env.MONGODB_URI || '').trim();
  if (mongoUri) {
    console.warn(
      '[Auth] AUTH_SECRET is not set — deriving a session signing key from MONGODB_URI. ' +
        'Set AUTH_SECRET in the environment to decouple sessions from the database credentials.'
    );
    return crypto.createHash('sha256').update(`bcc-session-signing-v1:${mongoUri}`).digest('hex');
  }

  // Nothing stable to derive from. Random-per-boot stays secure at the cost of signing everyone out
  // on restart — deliberately preferred over a predictable key.
  console.warn(
    '[Auth] Neither AUTH_SECRET nor MONGODB_URI is set — using a random per-boot signing key. ' +
      'Every session will be invalidated on restart.'
  );
  return crypto.randomBytes(32).toString('hex');
}

function signPayload(base64Payload: string): string {
  return crypto.createHmac('sha256', SERVER_AUTH_SECRET).update(base64Payload).digest('base64url');
}

function generateSessionToken(userId: string, role = 'user'): string {
  const payload = {
    userId: String(userId || ''),
    role: String(role || 'user'),
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const base64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${base64}.${signPayload(base64)}`;
}

function verifySessionToken(token: string): { valid: boolean; userId?: string; role?: string } {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [base64, sig] = parts;

  // Constant-time compare so the expected signature can't be recovered a byte at a time by timing
  // the response. Length is checked first because timingSafeEqual throws on a mismatch.
  const provided = Buffer.from(sig);
  const expected = Buffer.from(signPayload(base64));
  if (provided.length !== expected.length) return { valid: false };
  if (!crypto.timingSafeEqual(provided, expected)) return { valid: false };

  try {
    const payload = JSON.parse(Buffer.from(base64, 'base64url').toString('utf8'));
    if (!payload.userId || !payload.expiresAt) return { valid: false };
    if (Date.now() > payload.expiresAt) return { valid: false };
    return { valid: true, userId: payload.userId, role: payload.role };
  } catch {
    return { valid: false };
  }
}

// ==========================================
// PASSWORD STORAGE
// ==========================================
//
// Member passwords were stored and compared as plain text, with `|| 'bccriders123'` as the fallback —
// so any account whose document had no password field accepted one publicly-known string, and a leaked
// database dump was a leaked password list.
//
// Format: `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>`. scrypt is in Node's stdlib, so this needs no new
// dependency. Existing plaintext rows still verify (there is no other way to let anyone in), and are
// upgraded in place on the next successful sign-in — see `rehashLegacyPassword`.

const SCRYPT_N = 16384; // ~16 MB, ~50-80ms per hash on Render's free tier
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SCRYPT_KEYLEN = 32;

function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function isHashedPassword(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

/**
 * Verifies a password attempt against whatever is stored.
 *
 * `legacy: true` means the stored value was plain text and the caller should rehash it.
 * An empty stored value never matches — no default password.
 */
function verifyPassword(attempt: string, stored: unknown): { valid: boolean; legacy: boolean } {
  const storedStr = typeof stored === 'string' ? stored : '';
  const attemptStr = String(attempt || '');
  if (!storedStr || !attemptStr) return { valid: false, legacy: false };

  if (!isHashedPassword(storedStr)) {
    // Legacy plaintext row. Constant-time compare anyway; length check first because
    // timingSafeEqual throws on differing lengths.
    const a = Buffer.from(attemptStr);
    const b = Buffer.from(storedStr.trim());
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { valid, legacy: true };
  }

  const parts = storedStr.split('$');
  if (parts.length !== 6) return { valid: false, legacy: false };
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;

  try {
    const derived = crypto.scryptSync(attemptStr, Buffer.from(saltHex, 'hex'), hashHex.length / 2, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    const expected = Buffer.from(hashHex, 'hex');
    const valid = derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    return { valid, legacy: false };
  } catch {
    return { valid: false, legacy: false };
  }
}

/**
 * Upgrades a verified plaintext password to a hash, in whichever collection the document came from.
 * Fire-and-forget: a failure here must never block a sign-in that already succeeded.
 */
async function rehashLegacyPassword(collection: string, memberId: string, plain: string): Promise<void> {
  try {
    const database = await getMongoDb();
    if (!database || !memberId) return;
    await database
      .collection(collection)
      .updateOne({ id: memberId }, { $set: { password: hashPassword(plain) } });
    console.log(`[Auth] Upgraded ${collection}/${memberId} password to scrypt.`);
  } catch (err: any) {
    console.warn('[Auth] Could not upgrade a legacy password hash:', err?.message || err);
  }
}

/**
 * Prepares an incoming member/registration payload for an upsert.
 *
 * - a new plaintext password is hashed before it ever reaches the database
 * - an already-hashed value round-trips untouched (the client may echo one back)
 * - an absent or empty password is *removed* from the payload, so `$set` preserves whatever is
 *   already stored instead of blanking the account's credentials
 */
function normalizePasswordForWrite(doc: any): void {
  if (!doc || typeof doc !== 'object') return;
  const raw = typeof doc.password === 'string' ? doc.password.trim() : '';
  if (!raw) {
    delete doc.password;
    return;
  }
  doc.password = isHashedPassword(raw) ? raw : hashPassword(raw);
}

/**
 * Removes the credential from an outgoing document. Clients never need it — sign-in is server-side —
 * and shipping it meant every authenticated member held every other member's password.
 */
function stripPasswordForRead<T extends Record<string, any>>(doc: T): T {
  if (doc && typeof doc === 'object' && 'password' in doc) {
    delete (doc as any).password;
  }
  return doc;
}

// Authentication middleware to reject unauthorized requests with a 401 status
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = (req.headers.authorization || '').trim();
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : ((req.headers['x-session-token'] as string) || '').trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication session token required.',
      code: 'UNAUTHORIZED',
      data: [],
    });
  }

  const result = verifySessionToken(token);
  if (!result.valid) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Session token is invalid or expired. Please sign in.',
      code: 'UNAUTHORIZED',
      data: [],
    });
  }

  (req as any).authUserId = result.userId;
  (req as any).authUserRole = result.role;
  next();
}

// In-memory & MongoDB Server Security Settings
let serverSecuritySettings = {
  adminOtpEnabled: true,
};

async function loadServerSecuritySettings() {
  const database = await getMongoDb();
  if (database) {
    try {
      const doc = await database.collection('settings').findOne({ id: 'security_settings' });
      if (doc && doc.adminOtpEnabled !== undefined) {
        serverSecuritySettings.adminOtpEnabled = Boolean(doc.adminOtpEnabled);
      }
    } catch (err) {
      console.warn('Load security settings notice:', err);
    }
  }
}

// ==========================================
// MongoDB API authorization gate
// ==========================================
//
// `requireAuth` above was defined but never attached to a single route, so every collection endpoint
// — including DELETE /members/:id and the whole finance ledger — was reachable by anyone who knew
// the URL. One gate mounted ahead of the route definitions closes all of them at once; Express runs
// middleware in registration order, and the collection routes are declared further down this file.
//
// Only two things genuinely need to work before sign-in: a prospective member submitting their
// application, and the status probe (which returns no member data).
const PUBLIC_MONGODB_ROUTES: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /^\/registration\/?$/ },
  { method: 'GET', path: /^\/status\/?$/ },
];

app.use('/api/mongodb', (req, res, next) => {
  const authHeader = (req.headers.authorization || '').trim();
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : ((req.headers['x-session-token'] as string) || '').trim();
  if (token) {
    const result = verifySessionToken(token);
    if (result.valid) {
      (req as any).authUserId = result.userId;
      (req as any).authUserRole = result.role;
    }
  }

  // `req.path` is relative to the mount point here, so it reads as `/registration`, `/members/:id`.
  // The exact-match regexes keep /registration/accept/:id and /registration/reject/:id protected.
  const isPublic = PUBLIC_MONGODB_ROUTES.some(
    (route) => route.method === req.method.toUpperCase() && route.path.test(req.path)
  );
  if (isPublic) return next();

  if (!(req as any).authUserId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: please sign in to access club data.',
      code: 'UNAUTHORIZED',
      data: [],
    });
  }

  next();
});

// ==========================================
// Real-Time Sync: Socket.io + MongoDB Change Streams
// ==========================================
//
// Replaces the previous localStorage + `storage` event cross-tab sync as the PRIMARY
// synchronization mechanism. MongoDB Atlas runs as a replica set, so change streams are
// available with no infrastructure change. Flow:
//
//   Mongo write (any device) -> change stream -> Socket.io broadcast -> React state update
//
// localStorage/sessionStorage remain in place purely as an offline cache for instant first
// paint; they are no longer how two devices learn about each other's writes.

const httpServer = http.createServer(app);

/** Collections broadcast to connected clients. Anything not listed is ignored by the watcher. */
const REALTIME_COLLECTIONS = [
  'members',
  'registration',
  'financeLogs',
  'expenseLogs',
  'liquidationLogs',
  'financeArchives',
  'treasurerRequests',
  'settings',
  'activities',
  'attendanceLogs',
  'events',
  'payments',
  'posts',
  'logs',
  'updates',
] as const;

const REALTIME_COLLECTION_SET = new Set<string>(REALTIME_COLLECTIONS);

/**
 * Collections whose documents hold credentials, signatures, or large base64 avatars.
 * These are broadcast as a *signal only* (collection + operation + id) and never as a
 * document body — clients re-read them through the existing authenticated REST endpoints.
 */
const SIGNAL_ONLY_COLLECTIONS = new Set<string>(['members', 'registration']);

/** Field names stripped from every broadcast document body, defensively. */
const REDACTED_REALTIME_FIELDS = [
  'password',
  'passwordHash',
  'otp',
  'otpCode',
  'token',
  'sessionToken',
  'authToken',
  'resetToken',
  'applicantSignature',
];

// Single broadcast room. Sockets only reach it after the handshake verifies their session token,
// so there is no anonymous room to fan out to any more.
const ROOM_AUTHENTICATED = 'realtime:authenticated';

// `auto` prefers one database-level change stream (1 cursor, cheapest on Atlas shared tiers)
// and falls back to per-collection collection.watch() if the deployment rejects it.
const REALTIME_WATCH_MODE = (process.env.REALTIME_WATCH_MODE || 'auto').toLowerCase() as
  | 'auto'
  | 'database'
  | 'collection';

// Every real-time subscriber must present the same session token the REST layer requires.
// There is no anonymous tier: `/api/mongodb/*` is authenticated, so an anonymous socket could
// only ever receive change signals for data it is not allowed to read back.
// Set REALTIME_REQUIRE_AUTH=false only for local debugging.
const REALTIME_REQUIRE_AUTH = String(process.env.REALTIME_REQUIRE_AUTH || 'true').toLowerCase() !== 'false';

// Set REALTIME_INCLUDE_DOCUMENTS=false to broadcast signals only, for every collection.
const REALTIME_INCLUDE_DOCUMENTS = String(process.env.REALTIME_INCLUDE_DOCUMENTS || 'true').toLowerCase() !== 'false';

const io = new SocketIOServer(httpServer, {
  path: '/socket.io',
  serveClient: false,
  // The SPA is served by this same Express app, so same-origin is the norm. An explicit
  // allowlist can be supplied for split deployments or preview hosts.
  cors: process.env.REALTIME_ALLOWED_ORIGINS
    ? {
        origin: process.env.REALTIME_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
        credentials: true,
      }
    : undefined,
  // Heartbeat tuned so a dead Render connection is detected in ~45s rather than minutes.
  pingInterval: 25000,
  pingTimeout: 20000,
  // Survives brief drops (deploy blips, mobile network handoff) by replaying missed
  // packets and restoring rooms instead of forcing a cold resync.
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: false,
  },
  maxHttpBufferSize: 1e6,
});

type RealtimeMode = 'database' | 'collection' | 'disabled';

const realtimeState = {
  mode: 'disabled' as RealtimeMode,
  startedAt: null as string | null,
  lastChangeAt: null as string | null,
  lastError: null as string | null,
  changesEmitted: 0,
  restartAttempts: 0,
};

let realtimeStreams: ChangeStream[] = [];
const realtimeResumeTokens = new Map<string, unknown>();
let realtimeRestartTimer: NodeJS.Timeout | null = null;
let realtimeShuttingDown = false;
// Set once the database-level cursor has proven unreliable, so `auto` stops retrying it and
// commits to per-collection collection.watch() for the rest of the process lifetime.
let realtimeForceCollectionMode = false;

/** Strips Mongo internals and sensitive fields from a document before it goes over the wire. */
function sanitizeRealtimeDocument(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  for (const field of REDACTED_REALTIME_FIELDS) {
    if (field in rest) delete rest[field];
  }
  return rest;
}

/** Best-effort business id (`id`) with the raw Mongo `_id` as a secondary hint. */
function extractChangeIds(change: any): { documentId: string | null; mongoId: string | null } {
  const mongoIdRaw = change?.documentKey?._id;
  const mongoId = mongoIdRaw !== undefined && mongoIdRaw !== null ? String(mongoIdRaw) : null;
  const businessId = change?.fullDocument?.id;
  return {
    documentId: businessId !== undefined && businessId !== null ? String(businessId) : null,
    mongoId,
  };
}

interface RealtimeChangePayload {
  collection: string;
  operationType: string;
  documentId: string | null;
  mongoId: string | null;
  at: string;
  source: 'change-stream' | 'rest-fallback';
  document?: any;
}

/** Fan a change out to every connected client, document body gated by socket auth tier. */
function broadcastRealtimeChange(payload: RealtimeChangePayload): void {
  realtimeState.changesEmitted += 1;
  realtimeState.lastChangeAt = payload.at;

  // Signal-only collections already arrive here with no `document`, so this single emit
  // covers both cases. `sanitizeRealtimeDocument` has stripped credential fields upstream.
  io.to(ROOM_AUTHENTICATED).emit('db:change', payload);
}

/** Translate a raw Mongo change stream event into a broadcast. */
function handleChangeStreamEvent(collectionName: string, change: any): void {
  if (!REALTIME_COLLECTION_SET.has(collectionName)) return;

  const operationType = String(change?.operationType || 'unknown');
  // Structural events (drop/rename/invalidate) carry no document — signal a resync instead.
  if (operationType === 'invalidate' || operationType === 'drop' || operationType === 'dropDatabase') {
    io.emit('db:resync', { reason: `${collectionName}:${operationType}`, at: new Date().toISOString() });
    return;
  }

  const { documentId, mongoId } = extractChangeIds(change);
  const payload: RealtimeChangePayload = {
    collection: collectionName,
    operationType,
    documentId,
    mongoId,
    at: new Date().toISOString(),
    source: 'change-stream',
  };

  const includeBody =
    REALTIME_INCLUDE_DOCUMENTS &&
    !SIGNAL_ONLY_COLLECTIONS.has(collectionName) &&
    change?.fullDocument &&
    (operationType === 'insert' || operationType === 'update' || operationType === 'replace');

  if (includeBody) {
    payload.document = sanitizeRealtimeDocument(change.fullDocument);
  }

  broadcastRealtimeChange(payload);
}

/** Restart the watcher with capped exponential backoff (1s -> 30s). */
function scheduleRealtimeRestart(reason: string): void {
  if (realtimeShuttingDown || realtimeRestartTimer) return;
  realtimeState.restartAttempts += 1;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(realtimeState.restartAttempts, 5));
  console.warn(`[Realtime] ${reason} — restarting change stream in ${delay}ms (attempt ${realtimeState.restartAttempts})`);
  realtimeRestartTimer = setTimeout(() => {
    realtimeRestartTimer = null;
    startRealtimeChangeStreams().catch((err) =>
      console.warn('[Realtime] Change stream restart failed:', err?.message || err)
    );
  }, delay);
}

/**
 * Change stream errors that mean "this deployment cannot do change streams at all"
 * (standalone mongod in local dev). Retrying is pointless; the REST write hook covers it.
 */
function isChangeStreamUnsupported(err: any): boolean {
  const code = Number(err?.code);
  const message = String(err?.message || err?.codeName || '');
  return (
    code === 40573 ||
    code === 40567 ||
    /only supported on replica sets/i.test(message) ||
    /\$changeStream is not supported/i.test(message) ||
    /The \$changeStream stage is only supported/i.test(message)
  );
}

/** Resume token expired because the oplog rolled past it — start clean and force a client resync. */
function isResumeTokenLost(err: any): boolean {
  const code = Number(err?.code);
  return code === 286 || /ChangeStreamHistoryLost/i.test(String(err?.codeName || err?.message || ''));
}

function attachStreamHandlers(stream: ChangeStream, resumeKey: string, collectionResolver: (change: any) => string): void {
  stream.on('change', (change: any) => {
    try {
      // Persist the resume token so a restart picks up exactly where we left off.
      if (change?._id) realtimeResumeTokens.set(resumeKey, change._id);
      realtimeState.restartAttempts = 0;
      handleChangeStreamEvent(collectionResolver(change), change);
    } catch (err: any) {
      console.warn('[Realtime] Failed to process change event:', err?.message || err);
    }
  });

  stream.on('error', (err: any) => {
    realtimeState.lastError = err?.message || String(err);

    if (isChangeStreamUnsupported(err)) {
      realtimeState.mode = 'disabled';
      console.warn(
        '[Realtime] MongoDB deployment does not support change streams (standalone server). ' +
          'Falling back to REST write broadcasts. Atlas replica sets need no change here.'
      );
      void stopRealtimeChangeStreams(false);
      return;
    }

    if (isResumeTokenLost(err)) {
      realtimeResumeTokens.delete(resumeKey);
      io.emit('db:resync', { reason: 'resume-token-expired', at: new Date().toISOString() });
    }

    // `database.watch()` rejects lazily — the failure arrives here, not from the call itself. If the
    // single database-level cursor keeps dying, stop retrying it and commit to per-collection
    // cursors, which is also the form the deployment is most likely to accept.
    if (
      resumeKey === '__database__' &&
      REALTIME_WATCH_MODE === 'auto' &&
      !realtimeForceCollectionMode &&
      realtimeState.restartAttempts >= 2
    ) {
      realtimeForceCollectionMode = true;
      realtimeResumeTokens.delete(resumeKey);
      console.warn('[Realtime] Database-level change stream keeps failing — switching to collection.watch().');
    }

    scheduleRealtimeRestart(`Change stream error on "${resumeKey}": ${realtimeState.lastError}`);
  });

  stream.on('close', () => {
    if (!realtimeShuttingDown && realtimeState.mode !== 'disabled') {
      scheduleRealtimeRestart(`Change stream "${resumeKey}" closed unexpectedly`);
    }
  });

  realtimeStreams.push(stream);
}

/** One database-level cursor covering every watched collection. Cheapest option on Atlas. */
function watchWholeDatabase(database: Db): void {
  const resumeKey = '__database__';
  const resumeAfter = realtimeResumeTokens.get(resumeKey);
  const stream = database.watch(
    [{ $match: { 'ns.coll': { $in: [...REALTIME_COLLECTIONS] } } }],
    {
      fullDocument: 'updateLookup',
      ...(resumeAfter ? { resumeAfter } : {}),
    }
  );
  attachStreamHandlers(stream, resumeKey, (change) => String(change?.ns?.coll || ''));
  realtimeState.mode = 'database';
  realtimeState.startedAt = new Date().toISOString();
  console.log(`[Realtime] Watching ${REALTIME_COLLECTIONS.length} collections via database-level change stream.`);
}

/** One `collection.watch()` cursor per collection; isolates failures per collection. */
function watchEachCollection(database: Db): void {
  for (const collectionName of REALTIME_COLLECTIONS) {
    const resumeAfter = realtimeResumeTokens.get(collectionName);
    const stream = database.collection(collectionName).watch([], {
      fullDocument: 'updateLookup',
      ...(resumeAfter ? { resumeAfter } : {}),
    });
    attachStreamHandlers(stream, collectionName, () => collectionName);
  }
  realtimeState.mode = 'collection';
  realtimeState.startedAt = new Date().toISOString();
  console.log(`[Realtime] Watching ${REALTIME_COLLECTIONS.length} collections via per-collection change streams.`);
}

async function stopRealtimeChangeStreams(clearResumeTokens = true): Promise<void> {
  const streams = realtimeStreams;
  realtimeStreams = [];
  await Promise.all(
    streams.map(async (stream) => {
      try {
        stream.removeAllListeners();
        // Keep a no-op error sink: an EventEmitter with no 'error' listener throws on emit,
        // and closing a cursor whose connection already died can emit one.
        stream.on('error', () => {});
        await stream.close();
      } catch {
        // Already closed or the connection dropped — nothing to recover.
      }
    })
  );
  if (clearResumeTokens) realtimeResumeTokens.clear();
}

async function startRealtimeChangeStreams(): Promise<void> {
  if (realtimeShuttingDown) return;

  const database = await getMongoDb();
  if (!database) {
    realtimeState.mode = 'disabled';
    realtimeState.lastError = 'MONGODB_URI is not configured';
    console.warn('[Realtime] MongoDB is not configured — real-time change streams disabled.');
    return;
  }

  await stopRealtimeChangeStreams(false);

  try {
    if (REALTIME_WATCH_MODE === 'collection' || realtimeForceCollectionMode) {
      watchEachCollection(database);
    } else {
      watchWholeDatabase(database);
    }
  } catch (err: any) {
    realtimeState.lastError = err?.message || String(err);

    // Fall back to per-collection watching if the database-level cursor was rejected.
    if (REALTIME_WATCH_MODE === 'auto' && !realtimeForceCollectionMode) {
      realtimeForceCollectionMode = true;
      console.warn(
        `[Realtime] Database-level change stream unavailable (${realtimeState.lastError}); falling back to collection.watch().`
      );
      try {
        watchEachCollection(database);
        return;
      } catch (fallbackErr: any) {
        realtimeState.lastError = fallbackErr?.message || String(fallbackErr);
      }
    }

    realtimeState.mode = 'disabled';
    scheduleRealtimeRestart(`Failed to open change stream: ${realtimeState.lastError}`);
  }
}

// Socket handshake: extract and verify the same session token the REST layer uses.
io.use((socket: Socket, next) => {
  const handshakeAuth = (socket.handshake.auth || {}) as Record<string, unknown>;
  const authHeader = String(socket.handshake.headers.authorization || '').trim();
  const rawToken = String(
    handshakeAuth.token ||
      (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '') ||
      socket.handshake.headers['x-session-token'] ||
      ''
  ).trim();

  const result = rawToken ? verifySessionToken(rawToken) : { valid: false as const };
  socket.data.authenticated = result.valid;
  socket.data.userId = result.valid ? result.userId : null;
  socket.data.role = result.valid ? result.role : null;

  if (REALTIME_REQUIRE_AUTH && !result.valid) {
    return next(new Error('UNAUTHORIZED: a valid session token is required for real-time sync.'));
  }
  next();
});

io.on('connection', (socket: Socket) => {
  const authenticated = Boolean(socket.data.authenticated);
  // With REALTIME_REQUIRE_AUTH on (the default) only verified sockets get this far.
  socket.join(ROOM_AUTHENTICATED);

  // Clients treat `db:ready` as "do a full resync now" — it fires on first connect AND on
  // every reconnect, which is what closes the gap for changes missed while disconnected.
  socket.emit('db:ready', {
    authenticated,
    mode: realtimeState.mode,
    collections: [...REALTIME_COLLECTIONS],
    signalOnlyCollections: [...SIGNAL_ONLY_COLLECTIONS],
    serverStartedAt: realtimeState.startedAt,
    recovered: socket.recovered,
    at: new Date().toISOString(),
  });

  // Lets a client ask for a resync explicitly (e.g. after a long background tab suspend).
  socket.on('client:resync', () => {
    socket.emit('db:resync', { reason: 'client-requested', at: new Date().toISOString() });
  });

  // Client push broadcast: fan out notifications to all connected clients & devices
  socket.on('push:broadcast', async (payload: any) => {
    try {
      await broadcastPushNotification(payload, socket.id);
    } catch (err) {
      console.warn('[Realtime Push] Socket broadcast error:', err);
    }
  });

  socket.on('error', (err: any) => {
    console.warn('[Realtime] Socket error:', err?.message || err);
  });
});

// ==========================================
// Web Push Notifications & Broadcast Hub
// ==========================================
// VAPID keys configuration for standard Web Push protocol
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIhbQFLXYp5Nksh8U';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'UUxI4O8m_C8XjHq0bFqE3e7v5Yp9H_4d7zP_yG0Hk1c';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@bccriders.cc';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[WebPush] VAPID details configured successfully');
} catch (err) {
  console.warn('[WebPush] VAPID initialization warning:', err);
}

export interface PushNotificationBroadcastPayload {
  title: string;
  body: string;
  category: 'finance' | 'memberApprovals' | 'activities' | 'announcements' | 'sos' | string;
  icon?: string;
  badge?: string;
  url?: string;
  tab?: string;
  tag?: string;
  requireInteraction?: boolean;
  customData?: Record<string, any>;
}

/**
 * Broadcasts a push notification to:
 * 1. All connected Socket.io clients across mobile and desktop (immediate active screen delivery)
 * 2. All stored Web Push service worker subscriptions in MongoDB (OS-level notification delivery)
 */
async function broadcastPushNotification(
  payload: PushNotificationBroadcastPayload,
  excludeSocketId?: string
): Promise<{ socketsNotified: number; webPushSent: number; webPushErrors: number }> {
  if (!payload || !payload.title) {
    return { socketsNotified: 0, webPushSent: 0, webPushErrors: 0 };
  }

  // 1. Socket.io broadcast to all active sessions & mobile tabs
  try {
    io.to(ROOM_AUTHENTICATED).emit('push:notification', payload);
    io.emit('push:notification', payload);
  } catch (sockErr) {
    console.warn('[WebPush] Socket emission notice:', sockErr);
  }

  const socketsNotified = io.engine ? io.engine.clientsCount : 0;
  let webPushSent = 0;
  let webPushErrors = 0;

  // 2. Background OS Web Push delivery to all registered device subscriptions
  const database = await getMongoDb();
  if (database) {
    try {
      const subscriptions = await database.collection('push_subscriptions').find({}).toArray();
      if (subscriptions.length > 0) {
        const payloadString = JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/logo.png',
          badge: payload.badge || '/logo.png',
          category: payload.category,
          tab: payload.tab || 'finances',
          url: payload.url || '/',
          tag: payload.tag || `bcc-${payload.category}-${Date.now()}`,
          vibrate: [200, 100, 200],
          customData: payload.customData,
        });

        const expiredEndpoints: string[] = [];

        await Promise.allSettled(
          subscriptions.map(async (subDoc: any) => {
            const pushSub = subDoc.subscription || subDoc;
            if (!pushSub || !pushSub.endpoint) return;

            try {
              await webpush.sendNotification(
                {
                  endpoint: pushSub.endpoint,
                  keys: pushSub.keys,
                },
                payloadString,
                {
                  TTL: 60 * 60 * 24, // 24 hours
                }
              );
              webPushSent++;
            } catch (pushErr: any) {
              webPushErrors++;
              // 404 or 410 means subscription expired or uninstalled
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                expiredEndpoints.push(pushSub.endpoint);
              } else {
                console.warn('[WebPush] Single device delivery notice:', pushErr?.message || pushErr);
              }
            }
          })
        );

        // Prune expired subscriptions from database
        if (expiredEndpoints.length > 0) {
          database
            .collection('push_subscriptions')
            .deleteMany({ 'subscription.endpoint': { $in: expiredEndpoints } })
            .catch(() => {});
        }
      }
    } catch (dbErr) {
      console.warn('[WebPush] Fetch subscriptions error:', dbErr);
    }
  }

  return { socketsNotified, webPushSent, webPushErrors };
}

// Push Endpoints
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
});

app.get('/api/push/subscriptions/count', async (req, res) => {
  const database = await getMongoDb();
  if (!database) {
    return res.json({ success: true, count: 0, activeSockets: io.engine ? io.engine.clientsCount : 0 });
  }
  try {
    const count = await database.collection('push_subscriptions').countDocuments({});
    res.json({
      success: true,
      count,
      activeSockets: io.engine ? io.engine.clientsCount : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, count: 0 });
  }
});

app.post('/api/push/subscribe', async (req, res) => {
  const database = await getMongoDb();
  const { subscription, userId, userName, userAgent } = req.body || {};

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid push subscription object is required.' });
  }

  if (!database) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const subRecord = {
      endpoint: subscription.endpoint,
      subscription,
      userId: userId || 'anonymous',
      userName: userName || 'Rider',
      userAgent: userAgent || req.headers['user-agent'] || '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await database.collection('push_subscriptions').updateOne(
      { 'subscription.endpoint': subscription.endpoint },
      {
        $set: {
          subscription,
          userId: userId || 'anonymous',
          userName: userName || 'Rider',
          userAgent: userAgent || req.headers['user-agent'] || '',
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: { createdAt: new Date().toISOString() },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Push notification subscription registered successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const database = await getMongoDb();
  const { endpoint } = req.body || {};

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required to unsubscribe.' });
  }

  if (!database) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    await database.collection('push_subscriptions').deleteOne({
      $or: [{ endpoint }, { 'subscription.endpoint': endpoint }],
    });
    res.json({ success: true, message: 'Unsubscribed from push notifications.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/broadcast', async (req, res) => {
  const payload = req.body as PushNotificationBroadcastPayload;

  if (!payload || !payload.title) {
    return res.status(400).json({ error: 'Notification payload with title and body is required.' });
  }

  try {
    const stats = await broadcastPushNotification(payload);
    res.json({
      success: true,
      message: 'Push notification dispatched to all devices.',
      ...stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fallback broadcaster for deployments where change streams are unavailable (standalone
 * mongod in local dev). Observes successful mutating writes to /api/mongodb/* and emits a
 * signal so the UI still updates live. Skipped entirely while a change stream is running,
 * so changes are never broadcast twice.
 */
app.use('/api/mongodb', (req, res, next) => {
  const method = req.method.toUpperCase();
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return next();
  }

  res.on('finish', () => {
    if (realtimeState.mode !== 'disabled') return;
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const segments = req.path.split('/').filter(Boolean);
    const segment = segments[0];
    if (!segment || !REALTIME_COLLECTION_SET.has(segment)) return;

    // `app.use` middleware has no route params, so read the id off the path (…/financeLogs/<id>)
    // and fall back to the request body for collection-level upserts.
    const pathId = segments[1] && segments[1] !== 'bulk' ? decodeURIComponent(segments[1]) : null;
    const bodyId = typeof req.body?.id === 'string' ? req.body.id : null;

    broadcastRealtimeChange({
      collection: segment,
      operationType: method === 'DELETE' ? 'delete' : 'upsert',
      documentId: pathId || bodyId,
      mongoId: null,
      at: new Date().toISOString(),
      source: 'rest-fallback',
    });
  });

  next();
});

// Real-time diagnostics — useful for confirming change streams actually came up on Render.
app.get('/api/realtime/status', (req, res) => {
  res.json({
    success: true,
    enabled: realtimeState.mode !== 'disabled',
    mode: realtimeState.mode,
    watchModeSetting: REALTIME_WATCH_MODE,
    requireAuth: REALTIME_REQUIRE_AUTH,
    includeDocuments: REALTIME_INCLUDE_DOCUMENTS,
    connectedClients: io.engine.clientsCount,
    watchedCollections: [...REALTIME_COLLECTIONS],
    signalOnlyCollections: [...SIGNAL_ONLY_COLLECTIONS],
    startedAt: realtimeState.startedAt,
    lastChangeAt: realtimeState.lastChangeAt,
    changesEmitted: realtimeState.changesEmitted,
    restartAttempts: realtimeState.restartAttempts,
    lastError: realtimeState.lastError,
  });
});

// Security Settings Endpoints
app.get('/api/settings/security', async (req, res) => {
  await loadServerSecuritySettings();
  res.json({
    success: true,
    settings: serverSecuritySettings,
  });
});

app.post('/api/settings/security', async (req, res) => {
  const { adminOtpEnabled } = req.body || {};
  if (adminOtpEnabled !== undefined) {
    serverSecuritySettings.adminOtpEnabled = Boolean(adminOtpEnabled);
  }
  const database = await getMongoDb();
  if (database) {
    try {
      await database.collection('settings').updateOne(
        { id: 'security_settings' },
        {
          $set: {
            id: 'security_settings',
            category: 'security',
            adminOtpEnabled: serverSecuritySettings.adminOtpEnabled,
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    } catch (err) {
      console.warn('Save security settings to MongoDB notice:', err);
    }
  }
  res.json({
    success: true,
    settings: serverSecuritySettings,
  });
});

// ==========================================
// AUTH: WebAuthn / Biometric Sign-In (server-verified)
// ==========================================
//
// The biometric path used to be decided entirely in the browser: `biometrics.ts` generated its own
// challenge, never transmitted the assertion, and the server was never consulted. Registration kept
// only the credential ID and discarded the public key, so nothing could be verified even in
// principle — a localStorage entry *was* a login, and `storedList[0]` was the fallback identity.
//
// Now: the server issues a single-use challenge, stores the credential public key at registration,
// and verifies the assertion signature against it before minting a session token.

const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const WEBAUTHN_COLLECTION = 'webauthnCredentials';

// Credentials enrolled before this change have no stored public key and can never be verified.
// While this is true they are accepted on a weaker check (credential ID must be registered to that
// user server-side) so nobody is locked out on deploy day. Set BIOMETRIC_ALLOW_LEGACY=false once
// riders have re-enrolled — GET /api/auth/webauthn/pending-reenrollment lists who hasn't.
const BIOMETRIC_ALLOW_LEGACY = (process.env.BIOMETRIC_ALLOW_LEGACY || 'true').trim() !== 'false';

interface WebAuthnChallengeEntry {
  purpose: 'register' | 'authenticate';
  userId: string | null;
  expiresAt: number;
}

const webauthnChallenges = new Map<string, WebAuthnChallengeEntry>();

function pruneWebAuthnChallenges(): void {
  const now = Date.now();
  for (const [key, entry] of webauthnChallenges) {
    if (now > entry.expiresAt) webauthnChallenges.delete(key);
  }
}

function issueWebAuthnChallenge(purpose: 'register' | 'authenticate', userId: string | null): string {
  pruneWebAuthnChallenges();
  const challenge = crypto.randomBytes(32).toString('base64url');
  webauthnChallenges.set(challenge, {
    purpose,
    userId,
    expiresAt: Date.now() + WEBAUTHN_CHALLENGE_TTL_MS,
  });
  return challenge;
}

/** Single-use by construction: the first assertion presenting a challenge consumes it. */
function consumeWebAuthnChallenge(
  challenge: string,
  purpose: 'register' | 'authenticate'
): WebAuthnChallengeEntry | null {
  pruneWebAuthnChallenges();
  const entry = webauthnChallenges.get(challenge);
  if (!entry) return null;
  webauthnChallenges.delete(challenge);
  if (entry.purpose !== purpose) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

/** Accepts base64url or standard base64, so the client encoding doesn't have to be exact. */
function decodeB64(value: unknown): Buffer {
  const str = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(str, 'base64');
}

function allowedWebAuthnOrigins(req: express.Request): string[] {
  const configured = (process.env.WEBAUTHN_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const host = (req.headers.host || '').trim();
  const list = [...configured];
  if (host) {
    list.push(`https://${host}`);
    // Plain http only for local development; never for a deployed host.
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) list.push(`http://${host}`);
  }
  return list;
}

/**
 * Validates the browser-supplied clientDataJSON against the challenge we issued and the origin the
 * request actually came from. Returns the parsed object, or a reason string on rejection.
 */
function verifyClientData(
  clientDataJSONB64: unknown,
  expectedType: 'webauthn.create' | 'webauthn.get',
  req: express.Request
): { ok: boolean; reason?: string; clientData?: any; challenge?: string } {
  let clientData: any;
  try {
    clientData = JSON.parse(decodeB64(clientDataJSONB64).toString('utf8'));
  } catch {
    return { ok: false, reason: 'clientDataJSON is not valid JSON.' };
  }

  if (clientData.type !== expectedType) {
    return { ok: false, reason: `Unexpected ceremony type "${clientData.type}".` };
  }

  const origins = allowedWebAuthnOrigins(req);
  if (origins.length > 0 && !origins.includes(String(clientData.origin))) {
    return { ok: false, reason: `Origin "${clientData.origin}" is not allowed.` };
  }

  // Normalise: browsers emit base64url here.
  const challenge = String(clientData.challenge || '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (!challenge) return { ok: false, reason: 'Assertion carried no challenge.' };

  return { ok: true, clientData, challenge };
}

/**
 * Verifies an assertion signature against a stored SPKI public key.
 *
 * WebAuthn signs `authenticatorData || SHA256(clientDataJSON)`. ES256 signatures arrive DER-encoded,
 * which is what Node's default `dsaEncoding` expects, so both ES256 and RS256 verify with 'sha256'.
 */
function verifyAssertionSignature(
  publicKeySpki: Buffer,
  authenticatorData: Buffer,
  clientDataJSONB64: unknown,
  signature: Buffer
): boolean {
  try {
    const keyObject = crypto.createPublicKey({ key: publicKeySpki, format: 'der', type: 'spki' });
    const clientDataHash = crypto.createHash('sha256').update(decodeB64(clientDataJSONB64)).digest();
    const signedData = Buffer.concat([authenticatorData, clientDataHash]);
    return crypto.verify('sha256', signedData, keyObject, signature);
  } catch (err) {
    console.warn('[WebAuthn] Signature verification error:', err);
    return false;
  }
}

/** authenticatorData layout: rpIdHash(32) | flags(1) | signCount(4, big-endian) | ... */
function parseAuthenticatorData(authData: Buffer): {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  userVerified: boolean;
} | null {
  if (!authData || authData.length < 37) return null;
  const flags = authData[32];
  return {
    rpIdHash: authData.subarray(0, 32),
    flags,
    signCount: authData.readUInt32BE(33),
    userVerified: (flags & 0x04) !== 0, // UV bit — we register with userVerification:'required'
  };
}

function rpIdMatches(rpIdHash: Buffer, req: express.Request): boolean {
  const candidates = allowedWebAuthnOrigins(req)
    .map((origin) => {
      try {
        return new URL(origin).hostname;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return candidates.some((hostname) =>
    crypto.createHash('sha256').update(hostname).digest().equals(rpIdHash)
  );
}

/** Resolves a rider's role so the session token carries the right privilege level. */
async function lookupUserRole(userId: string): Promise<{ found: boolean; role: string; user?: any }> {
  const database = await getMongoDb();
  if (database) {
    try {
      const doc = await database.collection('members').findOne({ id: userId });
      if (doc) return { found: true, role: String(doc.role || 'user'), user: doc };
    } catch (err) {
      console.warn('[WebAuthn] Role lookup notice:', err);
    }
  }
  const seed = INITIAL_SEED_MEMBERS.find((m: any) => m.id === userId);
  if (seed) return { found: true, role: String(seed.role || 'user'), user: seed };
  return { found: false, role: 'user' };
}

// Step 1: hand out a server-generated challenge. Replaces the client-side crypto.getRandomValues().
app.post('/api/auth/webauthn/challenge', async (req, res) => {
  const purpose = req.body?.purpose === 'register' ? 'register' : 'authenticate';
  const requestedUser = String(req.body?.userId || req.body?.username || '').trim();

  // Registration binds to the authenticated session, not to a body-supplied id.
  if (purpose === 'register') {
    const authHeader = (req.headers.authorization || '').trim();
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : ((req.headers['x-session-token'] as string) || '').trim();
    const result = verifySessionToken(token);
    if (!result.valid || !result.userId) {
      return res.status(401).json({
        success: false,
        error: 'Sign in before enrolling a biometric credential.',
        code: 'UNAUTHORIZED',
      });
    }
    return res.json({
      success: true,
      challenge: issueWebAuthnChallenge('register', result.userId),
      userId: result.userId,
    });
  }

  // Authentication: return the credential IDs this server has on file, so a device holding a stale
  // localStorage entry can't steer the ceremony toward a credential we don't recognise.
  let allowCredentials: Array<{ id: string; transports?: string[] }> = [];
  let resolvedUserId: string | null = null;
  if (requestedUser) {
    const database = await getMongoDb();
    if (database) {
      try {
        const escaped = requestedUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const docs = await database
          .collection(WEBAUTHN_COLLECTION)
          .find({
            $or: [
              { userId: requestedUser },
              { username: { $regex: new RegExp(`^${escaped}$`, 'i') } },
            ],
          })
          .toArray();
        allowCredentials = docs.map((d: any) => ({ id: d.credentialId, transports: d.transports }));
        if (docs.length > 0) resolvedUserId = String(docs[0].userId || '') || null;
      } catch (err) {
        console.warn('[WebAuthn] allowCredentials lookup notice:', err);
      }
    }
  }

  res.json({
    success: true,
    challenge: issueWebAuthnChallenge('authenticate', resolvedUserId),
    allowCredentials,
  });
});

// Step 2: store the credential public key. Requires an authenticated session — otherwise anyone
// could enrol their own fingerprint against the president's account.
app.post('/api/auth/webauthn/register', requireAuth, async (req, res) => {
  const authUserId = String((req as any).authUserId || '');
  const { credentialId, publicKey, clientDataJSON, transports, deviceName, username } = req.body || {};

  if (!credentialId || !clientDataJSON) {
    return res.status(400).json({ success: false, error: 'credentialId and clientDataJSON are required.' });
  }

  const clientCheck = verifyClientData(clientDataJSON, 'webauthn.create', req);
  if (!clientCheck.ok || !clientCheck.challenge) {
    return res.status(400).json({ success: false, error: clientCheck.reason || 'Invalid client data.' });
  }

  const entry = consumeWebAuthnChallenge(clientCheck.challenge, 'register');
  if (!entry) {
    return res.status(400).json({ success: false, error: 'Challenge is unknown, already used, or expired.' });
  }
  if (entry.userId && entry.userId !== authUserId) {
    return res.status(403).json({ success: false, error: 'Challenge was issued for a different account.' });
  }

  if (!publicKey) {
    return res.status(400).json({
      success: false,
      error:
        'This browser did not expose the credential public key, so the credential cannot be verified on sign-in. ' +
        'Biometric login is unavailable on this browser — please use password sign-in.',
      code: 'NO_PUBLIC_KEY',
    });
  }

  // Reject a key Node can't parse now rather than at first sign-in.
  try {
    crypto.createPublicKey({ key: decodeB64(publicKey), format: 'der', type: 'spki' });
  } catch {
    return res.status(400).json({ success: false, error: 'Credential public key could not be parsed.' });
  }

  const database = await getMongoDb();
  if (!database) {
    return res.status(503).json({ success: false, error: 'Database unavailable — cannot enrol credential.' });
  }

  try {
    await database.collection(WEBAUTHN_COLLECTION).updateOne(
      { credentialId: String(credentialId) },
      {
        $set: {
          id: `wac_${String(credentialId).slice(0, 32)}`,
          credentialId: String(credentialId),
          userId: authUserId,
          username: String(username || ''),
          publicKey: decodeB64(publicKey).toString('base64'),
          signCount: 0,
          transports: Array.isArray(transports) ? transports : ['internal'],
          deviceName: String(deviceName || 'Unknown device'),
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: { createdAt: new Date().toISOString() },
      },
      { upsert: true }
    );
    res.json({ success: true, credentialId: String(credentialId), verified: true });
  } catch (err: any) {
    console.error('[WebAuthn] Registration persist error:', err);
    res.status(500).json({ success: false, error: 'Failed to store biometric credential.' });
  }
});

// Step 3: verify the assertion and issue a real session token.
app.post('/api/auth/webauthn/verify', async (req, res) => {
  const { credentialId, clientDataJSON, authenticatorData, signature } = req.body || {};

  if (!credentialId || !clientDataJSON) {
    return res.status(400).json({ success: false, error: 'credentialId and clientDataJSON are required.' });
  }

  const clientCheck = verifyClientData(clientDataJSON, 'webauthn.get', req);
  if (!clientCheck.ok || !clientCheck.challenge) {
    return res.status(400).json({ success: false, error: clientCheck.reason || 'Invalid client data.' });
  }

  const challengeEntry = consumeWebAuthnChallenge(clientCheck.challenge, 'authenticate');
  if (!challengeEntry) {
    return res.status(401).json({
      success: false,
      error: 'Biometric challenge is unknown, already used, or expired. Please try again.',
      code: 'CHALLENGE_INVALID',
    });
  }

  const database = await getMongoDb();
  if (!database) {
    return res.status(503).json({ success: false, error: 'Database unavailable — cannot verify biometrics.' });
  }

  let credential: any = null;
  try {
    credential = await database
      .collection(WEBAUTHN_COLLECTION)
      .findOne({ credentialId: String(credentialId) });
  } catch (err) {
    console.warn('[WebAuthn] Credential lookup error:', err);
  }

  if (!credential) {
    return res.status(401).json({
      success: false,
      error: 'This biometric credential is not registered. Sign in with your password and enable fingerprint login again.',
      code: 'CREDENTIAL_UNKNOWN',
    });
  }

  const parsedAuthData = authenticatorData ? parseAuthenticatorData(decodeB64(authenticatorData)) : null;
  let legacyAccepted = false;

  if (credential.publicKey && parsedAuthData && signature) {
    if (!rpIdMatches(parsedAuthData.rpIdHash, req)) {
      return res.status(401).json({ success: false, error: 'Assertion was produced for a different site.' });
    }
    if (!parsedAuthData.userVerified) {
      return res.status(401).json({
        success: false,
        error: 'Biometric user verification did not take place on the device.',
      });
    }

    const signatureValid = verifyAssertionSignature(
      Buffer.from(String(credential.publicKey), 'base64'),
      decodeB64(authenticatorData),
      clientDataJSON,
      decodeB64(signature)
    );
    if (!signatureValid) {
      return res.status(401).json({
        success: false,
        error: 'Biometric signature verification failed.',
        code: 'SIGNATURE_INVALID',
      });
    }

    // Replay guard. Many platform authenticators always report 0; only enforce when they count.
    const storedCount = Number(credential.signCount || 0);
    if (parsedAuthData.signCount > 0 && storedCount > 0 && parsedAuthData.signCount <= storedCount) {
      return res.status(401).json({
        success: false,
        error: 'Biometric assertion was replayed. Please try again.',
        code: 'REPLAY_DETECTED',
      });
    }
    try {
      await database.collection(WEBAUTHN_COLLECTION).updateOne(
        { credentialId: String(credentialId) },
        { $set: { signCount: parsedAuthData.signCount, lastUsedAt: new Date().toISOString() } }
      );
    } catch {}
  } else {
    // Legacy credential: enrolled before public keys were stored, so there is nothing to verify
    // against. Accepted only while the migration ramp is open.
    if (!BIOMETRIC_ALLOW_LEGACY) {
      return res.status(401).json({
        success: false,
        error: 'This fingerprint was enrolled before biometric verification was enabled. Sign in with your password and enable fingerprint login again.',
        code: 'REENROLLMENT_REQUIRED',
      });
    }
    legacyAccepted = true;
    console.warn(
      `[WebAuthn] Accepting unverifiable legacy credential for user ${credential.userId}. ` +
        'Ask this rider to re-enrol, then set BIOMETRIC_ALLOW_LEGACY=false.'
    );
  }

  const userId = String(credential.userId || '');
  const { found, role, user } = await lookupUserRole(userId);
  if (!found) {
    return res.status(401).json({
      success: false,
      error: 'The account linked to this biometric credential no longer exists.',
      code: 'USER_GONE',
    });
  }
  if (user?.approvalStatus === 'Pending') {
    return res.status(403).json({
      success: false,
      error: 'Registration Pending: your application is still awaiting admin approval.',
    });
  }

  res.json({
    success: true,
    verified: true,
    userId,
    token: generateSessionToken(userId, role),
    legacy: legacyAccepted,
    reenrollmentRequired: legacyAccepted,
    message: legacyAccepted
      ? 'Signed in. Please re-enable fingerprint login in Settings to secure this device.'
      : 'Biometric sign-in verified.',
  });
});

// Which riders still hold credentials that cannot be cryptographically verified. Use this to decide
// when it is safe to set BIOMETRIC_ALLOW_LEGACY=false.
app.get('/api/auth/webauthn/pending-reenrollment', requireAuth, async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ success: false, error: 'Database unavailable.' });
  try {
    const docs = await database
      .collection(WEBAUTHN_COLLECTION)
      .find({ $or: [{ publicKey: { $exists: false } }, { publicKey: '' }, { publicKey: null }] })
      .toArray();
    res.json({
      success: true,
      legacyAllowed: BIOMETRIC_ALLOW_LEGACY,
      count: docs.length,
      credentials: docs.map((d: any) => ({
        userId: d.userId,
        username: d.username,
        deviceName: d.deviceName,
        createdAt: d.createdAt,
        lastUsedAt: d.lastUsedAt || null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to read credential list.' });
  }
});

// AUTH: Verify an administrator's password without minting a session.
//
// Used by the treasurer "instant in-person admin approval" flow, which previously decided this in the
// browser and accepted the literal strings 'admin', 'admin123' and 'password' — so any signed-in
// treasurer could self-authorise a financial action. The check now happens here, against the real
// admin credential, and the caller must already hold a valid session.
app.post('/api/auth/verify-admin-password', requireAuth, async (req, res) => {
  const attempt = String(req.body?.password || '').trim();
  if (!attempt) {
    return res.status(400).json({ success: false, error: 'Admin password is required.' });
  }

  const database = await getMongoDb();
  let adminDoc: any = null;

  if (database) {
    try {
      adminDoc = await database.collection('members').findOne({
        $or: [{ role: { $regex: /^admin$/i } }, { id: 'usr_admin' }, { username: { $regex: /^admin$/i } }],
      });
    } catch (err) {
      console.warn('[Auth] Admin lookup failed during password verification:', err);
    }
  }
  if (!adminDoc) {
    adminDoc = INITIAL_SEED_MEMBERS.find((m) => m.role === 'admin') || null;
  }
  if (!adminDoc) {
    return res.status(404).json({ success: false, error: 'No administrator account is configured.' });
  }

  const check = verifyPassword(attempt, adminDoc.password);
  if (!check.valid) {
    return res.status(401).json({ success: false, error: 'Invalid admin credentials. Please try again.' });
  }

  const adminId = adminDoc.id || adminDoc._id?.toString();
  if (check.legacy && adminId) {
    void rehashLegacyPassword('members', adminId, attempt);
  }

  res.json({ success: true, verified: true });
});

// AUTH: Request Login Authorization OTP via Resend (strictly by registered Username)
app.post('/api/auth/login-otp', async (req, res) => {
  const inputUsername = req.body?.username || req.body?.usernameOrEmail;
  const inputPassword = req.body?.password;

  if (!inputUsername || !inputPassword) {
    return res.status(400).json({ error: 'Registered username and password are required.' });
  }

  const rawUsername = String(inputUsername).trim();
  const normalizedUsername = rawUsername.toLowerCase();
  const cleanPassword = String(inputPassword).trim();

  let matchedUser: any = null;
  // Which collection the document came from, so a legacy password is rehashed in the right place.
  let matchedCollection: 'members' | 'registration' | null = null;

  // Search MongoDB members collection first by registered username only
  const database = await getMongoDb();
  if (database) {
    try {
      const escapedUsername = normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orConditions: any[] = [
        { username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') } },
      ];

      if (normalizedUsername === 'admin') {
        orConditions.push({ role: { $regex: /^admin$/i } });
      }

      let doc = await database.collection('members').findOne({ $or: orConditions });
      let sourceCollection: 'members' | 'registration' = 'members';

      // If not found in members, check registration collection to detect pending registration
      if (!doc) {
        doc = await database.collection('registration').findOne({ $or: orConditions });
        sourceCollection = 'registration';
      }

      if (doc) {
        matchedUser = doc;
        matchedCollection = sourceCollection;
      }
    } catch (err) {
      console.warn('MongoDB search for login error:', err);
    }
  }

  // Fallback to initial seed members by registered username only
  if (!matchedUser) {
    matchedUser = INITIAL_SEED_MEMBERS.find((m) => {
      const mUsername = (m.username || '').trim().toLowerCase();
      const mRole = (m.role || '').trim().toLowerCase();

      return (
        (mUsername && mUsername === normalizedUsername) ||
        (normalizedUsername === 'admin' && (mRole === 'admin' || m.role === 'admin'))
      );
    });
  }

  if (!matchedUser) {
    return res.status(401).json({ error: 'Invalid Username or Password.' });
  }

  // Check pending status
  if (matchedUser.approvalStatus === 'Pending') {
    return res.status(403).json({
      error: 'Registration Pending: Your member application is currently awaiting admin approval before you can sign in to the portal.',
    });
  }

  // Verify password. There is deliberately no default: an account with no stored password cannot
  // sign in, rather than accepting the well-known 'bccriders123' that used to be the fallback.
  const passwordCheck = verifyPassword(cleanPassword, matchedUser.password);
  if (!passwordCheck.valid) {
    return res.status(401).json({ error: 'Invalid Username or Password.' });
  }

  const memberId = matchedUser.id || matchedUser._id?.toString();

  // Credentials were correct but stored in the clear — upgrade them now, in the background.
  if (passwordCheck.legacy && matchedCollection && memberId) {
    void rehashLegacyPassword(matchedCollection, memberId, cleanPassword);
  }

  // Check if account is admin
  const isAdminUser =
    matchedUser.role === 'admin' ||
    String(matchedUser.role).toLowerCase() === 'admin' ||
    String(matchedUser.username).toLowerCase() === 'admin' ||
    matchedUser.id === 'usr_admin';

  // Load latest security settings
  await loadServerSecuritySettings();

  // If Admin OTP is disabled in Security Settings, bypass OTP
  if (isAdminUser && !serverSecuritySettings.adminOtpEnabled) {
    const token = generateSessionToken(memberId, matchedUser.role || 'admin');
    return res.json({
      success: true,
      requiresOtp: false,
      isAdmin: true,
      userId: memberId,
      token,
      message: 'Admin credentials verified. Bypassing OTP as configured in Security Settings.',
    });
  }

  // Extract email for 2FA OTP authorization (fallback for admin if empty)
  const memberEmail = (matchedUser.email || (isAdminUser ? 'admin@bccriders.org' : '')).trim().toLowerCase();
  if (!memberEmail || !memberEmail.includes('@')) {
    return res.status(400).json({
      error: 'No registered email found for this account. Please contact an administrator.',
    });
  }

  const memberName = matchedUser.name || matchedUser.firstName || matchedUser.username || (isAdminUser ? 'Administrator' : 'Club Member');

  // Generate 6-digit numeric OTP for Login Security
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Mask email for user preview (e.g., m***f@gmail.com)
  const [localPart, domainPart] = memberEmail.split('@');
  const maskedLocal = localPart.length <= 2 ? `${localPart[0]}*` : `${localPart[0]}${'*'.repeat(Math.max(1, localPart.length - 2))}${localPart[localPart.length - 1]}`;
  const maskedEmail = `${maskedLocal}@${domainPart}`;

  const userPayload = {
    id: memberId,
    username: matchedUser.username || normalizedUsername || memberName,
    email: memberEmail,
    name: memberName,
    firstName: matchedUser.firstName || '',
    lastName: matchedUser.lastName || '',
    role: matchedUser.role || (isAdminUser ? 'admin' : 'Member'),
    memberNumber: matchedUser.memberNumber || 'BRC-0000',
    approvalStatus: matchedUser.approvalStatus || 'Approved',
    avatar: matchedUser.avatar || '/avatar.svg',
    duesStatus: matchedUser.duesStatus || 'Active',
    duesExpiryDate: matchedUser.duesExpiryDate || '2027-12-31',
    mobileNo: matchedUser.mobileNo || matchedUser.phone || '',
    bikeInfo: matchedUser.bikeInfo,
  };

  const otpPayload: OtpEntry = {
    email: memberEmail,
    username: normalizedUsername,
    otp,
    expiresAt,
    userId: memberId,
    user: userPayload,
    name: memberName,
    role: matchedUser.role || (isAdminUser ? 'admin' : 'user'),
    type: 'login',
  };

  otpCache.set(`login_${memberEmail}`, otpPayload);
  if (memberId) otpCache.set(`login_uid_${memberId}`, otpPayload);
  if (normalizedUsername) otpCache.set(`login_user_${normalizedUsername}`, otpPayload);

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'contact@bccriders.cc';
  const replyToEmail = process.env.RESEND_REPLY_TO || 'contact@bccriders.cc';
  const resend = getResendClient();

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login Security Authorization OTP</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9f7; margin: 0; padding: 24px; color: #2d3a3a; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2ece2; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
        .header { background: #1b4332; padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #95d5b2; font-weight: 600; letter-spacing: 0.5px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 700; color: #1b4332; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #52605d; margin-bottom: 20px; }
        .otp-card { background: #f0f9f1; border: 2px dashed #74c69d; border-radius: 18px; padding: 24px; text-align: center; margin: 24px 0; }
        .otp-label { font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2d6a4f; letter-spacing: 1.5px; margin-bottom: 8px; }
        .otp-digits { font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #1b4332; font-family: monospace; }
        .expiry { font-size: 12px; color: #52605d; margin-top: 8px; }
        .warning { font-size: 12px; color: #747d7c; border-top: 1px solid #e2ece2; padding-top: 20px; margin-top: 24px; line-height: 1.5; }
        .footer { background: #fafcfa; padding: 18px 24px; text-align: center; font-size: 11px; color: #8a9695; border-top: 1px solid #e2ece2; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BCC RIDERS CLUB</h1>
          <p>Love &bull; Peace &bull; Joy &bull; Sign-in Verification</p>
        </div>
        <div class="content">
          <div class="greeting">Hello ${memberName},</div>
          <div class="text">
            A sign-in request was initiated for your <strong>BCC Riders Club</strong> account. For security purposes, please enter the One-Time Password (OTP) below to authorize your sign-in session:
          </div>
          <div class="otp-card">
            <div class="otp-label">Your Sign-In OTP Code</div>
            <div class="otp-digits">${otp}</div>
            <div class="expiry">Valid for <strong>5 minutes</strong>.</div>
          </div>
          <div class="warning">
            <strong>Security Notice:</strong> If you did not initiate this sign-in attempt, please change your password immediately or contact club administrators. Never share this code with anyone.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 BCC Riders Club &bull; Questions? Reply directly to this email or reach us at contact@bccriders.cc
        </div>
      </div>
    </body>
    </html>
  `;

  if (resend) {
    try {
      const response = await resend.emails.send({
        from: `BCC Riders Club <${fromEmail}>`,
        to: [memberEmail],
        replyTo: replyToEmail,
        subject: `Your verification code - Verify it's you to stay secure`,
        html: emailHtml,
      });
      console.log(`[Resend] Login OTP sent to ${memberEmail}. Resend ID:`, response.data?.id);
      return res.json({
        success: true,
        requiresOtp: true,
        email: memberEmail,
        maskedEmail,
        userId: memberId,
        user: userPayload,
        message: `A 6-digit authorization code has been sent to ${maskedEmail}.`,
      });
    } catch (err: any) {
      console.error('[Resend Error] Login OTP delivery error:', err);
      return res.json({
        success: true,
        requiresOtp: true,
        email: memberEmail,
        maskedEmail,
        userId: memberId,
        user: userPayload,
        message: `Authorization code generated for ${maskedEmail}. (Resend notice: ${err?.message || 'Check server settings'})`,
        devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      });
    }
  } else {
    console.warn(`[LOGIN OTP DEV MODE] RESEND_API_KEY is not set. Login OTP for ${memberEmail}: ${otp}`);
    return res.json({
      success: true,
      requiresOtp: true,
      email: memberEmail,
      maskedEmail,
      userId: memberId,
      user: userPayload,
      message: `Authorization code generated for ${maskedEmail}.`,
      devOtp: otp,
    });
  }
});

// AUTH: Verify Login OTP and Complete Sign-In
app.post('/api/auth/verify-login-otp', (req, res) => {
  const { email, username, usernameOrEmail, userId, otp } = req.body || {};
  const cleanOtp = (otp || '').trim();

  if (!cleanOtp) {
    return res.status(400).json({ error: 'Verification code (OTP) is required.' });
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedUsername = (username || usernameOrEmail || '').trim().toLowerCase();
  const cleanUserId = (userId || '').trim();

  let entry = null;
  if (normalizedEmail) entry = otpCache.get(`login_${normalizedEmail}`);
  if (!entry && normalizedUsername) entry = otpCache.get(`login_user_${normalizedUsername}`);
  if (!entry && cleanUserId) entry = otpCache.get(`login_uid_${cleanUserId}`);

  if (!entry) {
    return res.status(400).json({ error: 'No active sign-in authorization found. Please enter your username and password again.' });
  }

  if (Date.now() > entry.expiresAt) {
    if (entry.email) otpCache.delete(`login_${entry.email}`);
    if (entry.userId) otpCache.delete(`login_uid_${entry.userId}`);
    if (entry.username) otpCache.delete(`login_user_${entry.username}`);
    return res.status(400).json({ error: 'The sign-in code has expired. Please sign in again to receive a fresh code.' });
  }

  if (entry.otp !== cleanOtp) {
    return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
  }

  // Invalidate OTP keys after successful verification
  if (entry.email) otpCache.delete(`login_${entry.email}`);
  if (entry.userId) otpCache.delete(`login_uid_${entry.userId}`);
  if (entry.username) otpCache.delete(`login_user_${entry.username}`);

  const token = generateSessionToken(entry.userId, entry.role || 'user');

  res.json({
    success: true,
    verified: true,
    userId: entry.userId,
    user: entry.user,
    token,
    message: 'Sign-in authorized successfully.',
  });
});

// AUTH: Request Password Reset OTP via Resend
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Please enter a valid registered email address.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Look for registered member across MongoDB or fallback seed members
  let memberName = 'Club Member';
  let memberId = '';
  let found = false;

  const database = await getMongoDb();
  if (database) {
    try {
      const doc = await database.collection('members').findOne({
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (doc) {
        found = true;
        memberName = doc.name || doc.firstName || 'Club Member';
        memberId = doc.id;
      }
    } catch (err) {
      console.warn('MongoDB search member for OTP warning:', err);
    }
  }

  if (!found) {
    const seed = INITIAL_SEED_MEMBERS.find((m) => m.email && m.email.trim().toLowerCase() === normalizedEmail);
    if (seed) {
      found = true;
      memberName = seed.name;
      memberId = seed.id;
    }
  }

  if (!found) {
    return res.status(404).json({
      error: `No registered account found with email "${email}". Please verify your email address or contact an administrator.`,
    });
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpCache.set(normalizedEmail, {
    email: normalizedEmail,
    otp,
    expiresAt,
    userId: memberId,
    name: memberName,
  });

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'contact@bccriders.cc';
  const replyToEmail = process.env.RESEND_REPLY_TO || 'contact@bccriders.cc';
  const resend = getResendClient();

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset OTP</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9f7; margin: 0; padding: 24px; color: #2d3a3a; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2ece2; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
        .header { background: #1b4332; padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #95d5b2; font-weight: 600; letter-spacing: 0.5px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 700; color: #1b4332; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #52605d; margin-bottom: 20px; }
        .otp-card { background: #f0f9f1; border: 2px dashed #74c69d; border-radius: 18px; padding: 24px; text-align: center; margin: 24px 0; }
        .otp-label { font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2d6a4f; letter-spacing: 1.5px; margin-bottom: 8px; }
        .otp-digits { font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #1b4332; font-family: monospace; }
        .expiry { font-size: 12px; color: #52605d; margin-top: 8px; }
        .warning { font-size: 12px; color: #747d7c; border-top: 1px solid #e2ece2; padding-top: 20px; margin-top: 24px; line-height: 1.5; }
        .footer { background: #fafcfa; padding: 18px 24px; text-align: center; font-size: 11px; color: #8a9695; border-top: 1px solid #e2ece2; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BCC RIDERS CLUB</h1>
          <p>Love &bull; Peace &bull; Joy &bull; Verification System</p>
        </div>
        <div class="content">
          <div class="greeting">Hello ${memberName},</div>
          <div class="text">
            We received a request to reset the password for your <strong>BCC Riders Club</strong> account. Use the 6-digit One-Time Password (OTP) below to verify your identity and set a new password:
          </div>
          <div class="otp-card">
            <div class="otp-label">Your One-Time Password</div>
            <div class="otp-digits">${otp}</div>
            <div class="expiry">Expires in <strong>5 minutes</strong>.</div>
          </div>
          <div class="warning">
            <strong>Security Notice:</strong> If you did not make this request, you can safely disregard this email. Your account remains secure and no changes will take effect. Never disclose this code to anyone.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 BCC Riders Club &bull; Questions? Reply directly to this email or reach us at contact@bccriders.cc
        </div>
      </div>
    </body>
    </html>
  `;

  if (resend) {
    try {
      const response = await resend.emails.send({
        from: `BCC Riders Club <${fromEmail}>`,
        to: [normalizedEmail],
        replyTo: replyToEmail,
        subject: `Your verification code - Verify it's you to stay secure`,
        html: emailHtml,
      });

      console.log(`[Resend] OTP email successfully sent to ${normalizedEmail}. Resend ID:`, response.data?.id);
      return res.json({
        success: true,
        message: `A 6-digit verification code has been sent to ${normalizedEmail}. Please check your inbox.`,
      });
    } catch (err: any) {
      console.error('[Resend Error] Delivery failed:', err);
      return res.json({
        success: true,
        message: `OTP generated for ${normalizedEmail}. (Resend notice: ${err?.message || 'Check server settings'})`,
        devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      });
    }
  } else {
    console.warn(`[OTP DEV MODE] RESEND_API_KEY is not configured. OTP for ${normalizedEmail}: ${otp}`);
    return res.json({
      success: true,
      message: `OTP generated for ${normalizedEmail}. (Resend API key not yet set in environment; code logged for testing).`,
      devOtp: otp,
    });
  }
});

// AUTH: Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const entry = otpCache.get(normalizedEmail);

  if (!entry) {
    return res.status(400).json({ error: 'No active OTP found for this email. Please request a new code.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpCache.delete(normalizedEmail);
    return res.status(400).json({ error: 'This verification code has expired. Please request a new one.' });
  }

  if (entry.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
  }

  res.json({ success: true, message: 'OTP verified successfully.' });
});

// AUTH: Reset Password with OTP
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP code, and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const entry = otpCache.get(normalizedEmail);

  if (!entry) {
    return res.status(400).json({ error: 'No active OTP verification session found. Please request a new code.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpCache.delete(normalizedEmail);
    return res.status(400).json({ error: 'This verification code has expired. Please request a new one.' });
  }

  if (entry.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid verification code.' });
  }

  const cleanPassword = newPassword.trim();

  // Update in MongoDB members collection
  const database = await getMongoDb();
  if (database) {
    try {
      await database.collection('members').updateMany(
        { email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { $set: { password: cleanPassword, updatedAt: new Date().toISOString() } }
      );
      await database.collection('registrations').updateMany(
        { email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { $set: { password: cleanPassword, updatedAt: new Date().toISOString() } }
      );
      console.log(`[Auth] Password updated successfully in MongoDB for ${normalizedEmail}`);
    } catch (err: any) {
      console.error('Failed to update password in MongoDB:', err);
    }
  }

  // Invalidate OTP
  otpCache.delete(normalizedEmail);

  res.json({
    success: true,
    message: 'Your password has been successfully reset! You can now sign in with your new password.',
  });
});

// MongoDB Status & Stats Endpoint
app.get('/api/mongodb/status', async (req, res) => {
  if (!mongoUri) {
    return res.json({
      status: 'not_configured',
      uriConfigured: false,
      message: 'MONGODB_URI environment variable is not defined.',
      dbName,
    });
  }

  const database = await getMongoDb();
  if (!database) {
    return res.json({
      status: 'error',
      uriConfigured: true,
      message: 'Failed to connect to MongoDB server using provided MONGODB_URI.',
      dbName,
    });
  }

  try {
    const collections = await database.listCollections().toArray();
    const stats: Record<string, number> = {};
    for (const col of collections) {
      stats[col.name] = await database.collection(col.name).countDocuments();
    }

    return res.json({
      status: 'connected',
      uriConfigured: true,
      dbName,
      collections: stats,
      message: `Connected to MongoDB database "${dbName}"`,
    });
  } catch (err: any) {
    return res.json({
      status: 'error',
      uriConfigured: true,
      dbName,
      message: err?.message || 'Error listing MongoDB collections',
    });
  }
});

// MEMBERS API
app.get('/api/mongodb/members', async (req, res) => {
  const database = await getMongoDb();
  if (!database) {
    return res.status(503).json({ error: 'MongoDB connection not available', data: [] });
  }
  try {
    const docs = await database.collection('members').find({}).toArray();
    let userDocs: any[] = [];
    try {
      userDocs = await database.collection('users').find({}).toArray();
    } catch {}

    const allMemberDocs = [...docs];
    for (const u of userDocs) {
      if (!allMemberDocs.some((m) => (m.id && m.id === u.id) || (m.username && m.username === u.username) || (m.email && m.email === u.email))) {
        allMemberDocs.push(u);
      }
    }

    // Clean _id field and sanitize fields for frontend consistency
    const members = allMemberDocs.map(({ _id, ...rest }) => {
      const cleaned = sanitizeMemberForMongo(rest);
      const docId = cleaned.id || (_id ? _id.toString() : `usr_${Math.random().toString(36).substring(2, 9)}`);
      const emailStr = (cleaned.email || '').trim();
      const fallbackUser = emailStr
        ? emailStr.split('@')[0]
        : cleaned.name
        ? String(cleaned.name).trim().toLowerCase().replace(/\s+/g, '_')
        : `user_${docId.substring(0, 6)}`;
      const finalUsername = (cleaned.username && String(cleaned.username).trim()) || fallbackUser;

      const rawStatus = String(cleaned.approvalStatus || 'Approved').trim();
      const normalizedStatus = rawStatus.toLowerCase() === 'pending' ? 'Pending' : 'Approved';

      return stripPasswordForRead({
        ...cleaned,
        id: docId,
        username: finalUsername,
        name: cleaned.name || (cleaned.firstName ? `${cleaned.firstName} ${cleaned.lastName || ''}`.trim() : finalUsername) || 'Club Member',
        role: cleaned.role || 'Member',
        duesStatus: cleaned.duesStatus || 'Active',
        approvalStatus: normalizedStatus,
        duesExpiryDate: cleaned.duesExpiryDate || '2027-12-31',
      });
    });
    res.json({ success: true, count: members.length, data: members });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/members', async (req, res) => {
  const database = await getMongoDb();
  const rawMember = req.body;
  if (!database) {
    return res.status(503).json({ error: 'MongoDB not connected' });
  }
  if (!rawMember || !rawMember.id) {
    return res.status(400).json({ error: 'Member document must contain an id property' });
  }

  const member = sanitizeMemberForMongo(rawMember);
  normalizePasswordForWrite(member);

  try {
    const result = await database.collection('members').updateOne(
      { id: member.id },
      {
        $set: { ...member, updatedAt: new Date().toISOString() },
        $unset: {
          annualDuesAmount: '',
          unlockedBadgeIds: '',
          membershipType: '',
          streakDays: '',
          totalMiles: '',
          totalRides: '',
        },
      },
      { upsert: true }
    );
    res.json({ success: true, id: member.id, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/members/bulk', async (req, res) => {
  const database = await getMongoDb();
  const { members } = req.body;
  if (!database) {
    return res.status(503).json({ error: 'MongoDB not connected' });
  }
  if (!Array.isArray(members)) {
    return res.status(400).json({ error: 'members must be an array' });
  }

  try {
    const bulkOps = members.map((rawM) => {
      const m = sanitizeMemberForMongo(rawM);
      normalizePasswordForWrite(m);
      return {
        updateOne: {
          filter: { id: m.id },
          update: {
            $set: { ...m, updatedAt: new Date().toISOString() },
            $unset: {
              annualDuesAmount: '',
              unlockedBadgeIds: '',
              membershipType: '',
              streakDays: '',
              totalMiles: '',
              totalRides: '',
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await database.collection('members').bulkWrite(bulkOps);
    }
    res.json({ success: true, count: members.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/members/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) {
    return res.status(503).json({ error: 'MongoDB not connected' });
  }
  try {
    const result = await database.collection('members').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// REGISTRATION API ("registration" collection table)
app.get('/api/mongodb/registration', async (req, res) => {
  const database = await getMongoDb();
  if (!database) {
    return res.status(503).json({ error: 'MongoDB connection not available', data: [] });
  }
  try {
    const docs = await database.collection('registration').find({}).toArray();
    let pluralDocs: any[] = [];
    try {
      pluralDocs = await database.collection('registrations').find({}).toArray();
    } catch {}

    const allRegDocs = [...docs];
    for (const p of pluralDocs) {
      if (!allRegDocs.some((r) => (r.id && r.id === p.id) || (r.username && r.username === p.username) || (r.email && r.email === p.email))) {
        allRegDocs.push(p);
      }
    }

    const seenIds = new Set();
    const registrations = [];
    for (const d of allRegDocs) {
      const { _id, ...rest } = d;
      const docId = rest.id || (_id ? _id.toString() : `reg_${Math.random().toString(36).substring(2, 9)}`);
      if (seenIds.has(docId)) continue;
      seenIds.add(docId);
      registrations.push(
        stripPasswordForRead({
          id: docId,
          ...rest,
          approvalStatus: 'Pending',
        })
      );
    }
    res.json({ success: true, count: registrations.length, data: registrations });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/registration', async (req, res) => {
  const database = await getMongoDb();
  const rawForm = req.body;
  if (!database) {
    return res.status(503).json({ error: 'MongoDB not connected' });
  }
  if (!rawForm || !rawForm.id) {
    return res.status(400).json({ error: 'Registration form submission must contain an id property' });
  }

  const registrationDoc = sanitizeRegistrationForMongo(rawForm);
  normalizePasswordForWrite(registrationDoc);

  try {
    const result = await database.collection('registration').updateOne(
      { id: registrationDoc.id },
      { $set: { ...registrationDoc, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: registrationDoc.id,
      message: 'Form successfully stored in MongoDB "registration" table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/registration/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) {
    return res.status(503).json({ error: 'MongoDB not connected' });
  }
  try {
    const result = await database.collection('registration').deleteOne({ id });
    res.json({
      success: true,
      id,
      deletedCount: result.deletedCount,
      message: `Item ${id} removed from MongoDB "registration" table.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to send membership application approval notification email via info@bccriders.cc (No-Reply)
async function sendMemberApprovalEmail(member: {
  name?: string;
  email?: string;
  username?: string;
  memberNumber?: string;
  joinDate?: string;
  phone?: string;
}) {
  const memberEmail = (member.email || '').trim().toLowerCase();
  if (!memberEmail || !memberEmail.includes('@')) {
    console.log('[Approval Email] Skipped: No valid email address provided for member:', member.name);
    return { success: false, message: 'No valid email address provided' };
  }

  const memberName = member.name || 'Valued Member';
  const memberNo = member.memberNumber || 'BRC-MEMBER';
  const username = member.username || memberEmail.split('@')[0];
  const joinDate = member.joinDate || new Date().toISOString().split('T')[0];

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Membership Application Approved - BCC Riders Club</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f4; margin: 0; padding: 24px; color: #2d3a3a; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2ece2; box-shadow: 0 10px 32px rgba(27, 67, 50, 0.08); }
        .header { background: #1b4332; padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #74c69d; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 17px; font-weight: 800; color: #1b4332; margin-bottom: 12px; }
        .badge-approved { display: inline-block; background-color: #d8f3dc; color: #1b4332; font-weight: 800; font-size: 12px; padding: 6px 14px; border-radius: 20px; border: 1px solid #b7e4c7; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
        .text { font-size: 14px; line-height: 1.65; color: #40514e; margin-bottom: 18px; }
        .card { background: #f7faf8; border: 1px solid #d6e4d6; border-radius: 18px; padding: 20px; margin: 20px 0; }
        .card-title { font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2d6a4f; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #e2ece2; padding-bottom: 8px; }
        .no-reply-notice { background: #fff8f0; border: 1px solid #ffe8cc; border-radius: 14px; padding: 14px 16px; font-size: 11px; color: #9a6324; line-height: 1.5; margin-top: 22px; }
        .footer { background: #fafcfa; padding: 20px 24px; text-align: center; font-size: 11px; color: #747d7c; border-top: 1px solid #e2ece2; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BCC RIDERS CLUB</h1>
          <p>Love &bull; Peace &bull; Joy &bull; Official Notification</p>
        </div>
        <div class="content">
          <div class="badge-approved">&#10003; Application Approved</div>
          <div class="greeting">Congratulations, ${memberName}!</div>
          <div class="text">
            We are pleased to inform you that your membership application for <strong>BCC Riders Club</strong> has been officially reviewed and <strong>approved by the Club Administrator</strong>.
          </div>
          <div class="text">
            Your membership is now active. You are officially recognized as a registered club member!
          </div>

          <div class="card">
            <div class="card-title">Membership Profile Summary</div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Member Name:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right;">${memberName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Member ID:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right; font-family: monospace;">${memberNo}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Username:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right;">${username}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Registered Email:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right;">${memberEmail}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Status:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #2d6a4f; font-weight: 800; text-align: right;">Active Member</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Approved Date:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right;">${joinDate}</td>
              </tr>
            </table>
          </div>

          <div class="text">
            You can now sign in to the <strong>BCC Riders Club Portal</strong> using your username and password to access your rider profile, log rides, view official announcements, and participate in club activities.
          </div>

          <div class="no-reply-notice">
            <strong>Automated Notification (No-Reply):</strong><br>
            This is an automated no-reply email sent from <strong>info@bccriders.cc</strong> to notify you of your application approval. Please do not reply directly to this email address. If you need any assistance, please contact the club administrators through official club channels.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 BCC Riders Club &bull; All Rights Reserved<br>
          Sent from <strong>info@bccriders.cc</strong> (Automated No-Reply)
        </div>
      </div>
    </body>
    </html>
  `;

  const resend = getResendClient();
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: 'BCC Riders Club <info@bccriders.cc>',
        to: [memberEmail],
        replyTo: 'noreply@bccriders.cc',
        subject: 'Membership Application Approved – Welcome to BCC Riders Club!',
        html: emailHtml,
      });
      console.log(`[Resend] Membership approval email sent to ${memberEmail} from info@bccriders.cc. Resend ID:`, response.data?.id);
      return { success: true, resendId: response.data?.id };
    } catch (err: any) {
      console.error('[Resend Error] Failed to send approval email to', memberEmail, ':', err);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Approval Email] (Resend API key not set) Simulation: Approval email sent to ${memberEmail} from info@bccriders.cc`);
    return { success: true, simulated: true };
  }
}

// Helper to send membership application rejection notification email via info@bccriders.cc (No-Reply)
async function sendMemberRejectionEmail(member: {
  name?: string;
  email?: string;
  username?: string;
  reason?: string;
  rejectionDate?: string;
}) {
  const memberEmail = (member.email || '').trim().toLowerCase();
  if (!memberEmail || !memberEmail.includes('@')) {
    console.log('[Rejection Email] Skipped: No valid email address provided for applicant:', member.name);
    return { success: false, message: 'No valid email address provided' };
  }

  const memberName = member.name || 'Applicant';
  const rejectDate = member.rejectionDate || new Date().toISOString().split('T')[0];

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Membership Application Status - BCC Riders Club</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9f7; margin: 0; padding: 24px; color: #2d3a3a; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2ece2; box-shadow: 0 10px 32px rgba(27, 67, 50, 0.08); }
        .header { background: #1b4332; padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #74c69d; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 17px; font-weight: 800; color: #1b4332; margin-bottom: 12px; }
        .badge-declined { display: inline-block; background-color: #fee2e2; color: #991b1b; font-weight: 800; font-size: 12px; padding: 6px 14px; border-radius: 20px; border: 1px solid #fecaca; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
        .text { font-size: 14px; line-height: 1.65; color: #40514e; margin-bottom: 18px; }
        .card { background: #fdfaf9; border: 1px solid #f2e3e3; border-radius: 18px; padding: 20px; margin: 20px 0; }
        .card-title { font-size: 11px; text-transform: uppercase; font-weight: 800; color: #991b1b; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #fae1e1; padding-bottom: 8px; }
        .no-reply-notice { background: #fff8f0; border: 1px solid #ffe8cc; border-radius: 14px; padding: 14px 16px; font-size: 11px; color: #9a6324; line-height: 1.5; margin-top: 22px; }
        .footer { background: #fafcfa; padding: 20px 24px; text-align: center; font-size: 11px; color: #747d7c; border-top: 1px solid #e2ece2; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BCC RIDERS CLUB</h1>
          <p>Love &bull; Peace &bull; Joy &bull; Official Notification</p>
        </div>
        <div class="content">
          <div class="badge-declined">&#10007; Application Status: Declined</div>
          <div class="greeting">Dear ${memberName},</div>
          <div class="text">
            Thank you for your interest in joining <strong>BCC Riders Club</strong> and taking the time to submit your membership registration application.
          </div>
          <div class="text">
            After review by the Club Administrators, we regret to inform you that your membership application has <strong>not been approved</strong> at this time.
          </div>

          <div class="card">
            <div class="card-title">Application Status Summary</div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Applicant Name:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right;">${memberName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Submitted Email:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right;">${memberEmail}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Status:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #991b1b; font-weight: 800; text-align: right;">Application Declined</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #52605d; font-weight: 600;">Date Reviewed:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #1b4332; font-weight: 800; text-align: right;">${rejectDate}</td>
              </tr>
            </table>
          </div>

          <div class="text">
            This decision may be due to incomplete application details, motorcycle verification requirements, roster capacity, or club criteria. You are welcome to inquire with club administrators or re-apply during future membership periods.
          </div>

          <div class="no-reply-notice">
            <strong>Automated Notification (No-Reply):</strong><br>
            This is an automated notification sent from <strong>info@bccriders.cc</strong>. Please do not reply directly to this email address. If you believe this decision was made in error or wish to request clarification, please reach out through official club channels.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 BCC Riders Club &bull; All Rights Reserved<br>
          Sent from <strong>info@bccriders.cc</strong> (Automated No-Reply)
        </div>
      </div>
    </body>
    </html>
  `;

  const resend = getResendClient();
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: 'BCC Riders Club <info@bccriders.cc>',
        to: [memberEmail],
        replyTo: 'noreply@bccriders.cc',
        subject: 'Membership Application Status – BCC Riders Club',
        html: emailHtml,
      });
      console.log(`[Resend] Membership rejection email sent to ${memberEmail} from info@bccriders.cc. Resend ID:`, response.data?.id);
      return { success: true, resendId: response.data?.id };
    } catch (err: any) {
      console.error('[Resend Error] Failed to send rejection email to', memberEmail, ':', err);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Rejection Email] (Resend API key not set) Simulation: Rejection email sent to ${memberEmail} from info@bccriders.cc`);
    return { success: true, simulated: true };
  }
}

// Dedicated API endpoint to trigger membership approval notification email
app.post('/api/members/send-approval-email', async (req, res) => {
  const member = req.body || {};
  if (!member.email) {
    return res.status(400).json({ error: 'Member email is required.' });
  }

  try {
    const result = await sendMemberApprovalEmail(member);
    res.json({
      success: true,
      message: `Approval email processed for ${member.email} from info@bccriders.cc`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to dispatch approval email.' });
  }
});

// Dedicated API endpoint to trigger membership rejection notification email
app.post('/api/members/send-rejection-email', async (req, res) => {
  const member = req.body || {};
  if (!member.email) {
    return res.status(400).json({ error: 'Member email is required.' });
  }

  try {
    const result = await sendMemberRejectionEmail(member);
    res.json({
      success: true,
      message: `Rejection notification email processed for ${member.email} from info@bccriders.cc`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to dispatch rejection email.' });
  }
});

// Reject registration and dispatch rejection email
app.post('/api/mongodb/registration/reject/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  const payload = req.body || {};

  try {
    let applicantDoc: any = payload;
    if (database) {
      const regDoc = await database.collection('registration').findOne({ id });
      if (regDoc) {
        applicantDoc = { ...regDoc, ...payload };
      }
      await database.collection('registration').deleteOne({ id });
      await database.collection('members').deleteOne({ id });
      await database.collection('financeLogs').deleteMany({
        $or: [
          { id: `rec_mf_${id}` },
          { userId: id },
          { userMemberNo: id },
          { memberId: id },
          { userName: applicantDoc?.name },
          { memberName: applicantDoc?.name },
        ],
      });
    }

    sendMemberRejectionEmail(applicantDoc).catch((e) =>
      console.error('[Rejection Email Error] Failed to send rejection email:', e)
    );

    res.json({
      success: true,
      message: `Registration ${id} rejected and removed. Notification email sent to ${applicantDoc.email || 'applicant'}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer accepted item from "registration" table to "members" table in MongoDB
app.post('/api/mongodb/registration/accept/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  const payload = req.body || {};

  if (!database) {
    // Even if MongoDB is unavailable, attempt to send the approval email
    sendMemberApprovalEmail(payload).catch((e) => console.error('Approval email dispatch failed:', e));
    return res.status(503).json({ error: 'MongoDB not connected' });
  }

  try {
    // 1. Fetch form entry from "registration" collection in MongoDB
    const regDoc = await database.collection('registration').findOne({ id });

    const memberDoc = sanitizeMemberForMongo({
      ...(regDoc || {}),
      ...payload,
      id: id || payload.id,
      approvalStatus: 'Approved',
      updatedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
    });

    // The client no longer receives password fields, so `payload` can blank out the credential the
    // applicant chose at registration. Fall back to the stored one before hashing/preserving.
    if (!(typeof memberDoc.password === 'string' && memberDoc.password.trim()) && regDoc?.password) {
      memberDoc.password = regDoc.password;
    }
    normalizePasswordForWrite(memberDoc);

    delete memberDoc._id;

    if (!memberDoc.id) {
      return res.status(400).json({ error: 'Invalid member document ID' });
    }

    // 2. Transfer (upsert) to "members" collection in MongoDB
    await database.collection('members').updateOne(
      { id: memberDoc.id },
      { $set: memberDoc },
      { upsert: true }
    );

    // 3. Remove item from "registration" collection in MongoDB
    await database.collection('registration').deleteOne({ id });

    // 4. Ensure Membership Fee record exists in MongoDB "financeLogs" collection
    try {
      const feeSettings = await database.collection('settings').findOne({ id: 'finance_settings' });
      const feeAmount = Number(feeSettings?.membershipFee) || 200;
      const todayStr = new Date().toISOString().split('T')[0];
      const feeRecord = {
        id: `rec_mf_${memberDoc.id}`,
        itemType: 'Membership Fee',
        userId: memberDoc.id,
        userName: memberDoc.name || `${memberDoc.firstName || ''} ${memberDoc.lastName || ''}`.trim() || 'Club Member',
        userMemberNo: memberDoc.memberNumber || 'BRC-MEMBER',
        amount: feeAmount,
        dueDate: memberDoc.joinDate || todayStr,
        paidDate: todayStr,
        status: 'Paid',
        paymentMethod: 'Cash',
        notes: 'Payment recorded upon member approval',
        createdAt: todayStr,
        updatedAt: todayStr,
      };
      await database.collection('financeLogs').updateOne(
        { id: feeRecord.id },
        { $set: feeRecord },
        { upsert: true }
      );
    } catch (feeErr) {
      console.warn('Could not auto-create finance log in MongoDB:', feeErr);
    }

    // 5. Send official approval email to the registered email address from info@bccriders.cc (No-Reply)
    sendMemberApprovalEmail(memberDoc).catch((e) =>
      console.error('[Approval Email Error] Could not send approval email:', e)
    );

    res.json({
      success: true,
      message: `Form item "${id}" accepted, removed from "registration" table and transferred to "members" table in MongoDB. Approval notification email sent to ${memberDoc.email || 'member'}.`,
      member: memberDoc,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// EVENTS API
app.get('/api/mongodb/events', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('events').find({}).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/events', async (req, res) => {
  const database = await getMongoDb();
  const event = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    await database.collection('events').updateOne(
      { id: event.id },
      { $set: { ...event, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true, id: event.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to clean and sanitize activity documents in MongoDB by removing 'avatar' and 'photoUrl' columns/fields
async function cleanupActivitiesCollection(database: Db) {
  try {
    const targetCollections = ['activities', 'activites'];
    let cleanedDocsCount = 0;

    for (const colName of targetCollections) {
      try {
        const collections = await database.listCollections({ name: colName }).toArray();
        if (collections.length === 0 && colName === 'activites') continue;

        // 1. Unset top-level avatar, photoUrl, and bikeInfo.photoUrl
        await database.collection(colName).updateMany(
          {},
          {
            $unset: {
              avatar: '',
              photoUrl: '',
              'bikeInfo.photoUrl': '',
            },
          }
        );

        // 2. Clean attendance array in all documents
        const docs = await database.collection(colName).find({}).toArray();
        for (const doc of docs) {
          let needsUpdate = false;
          let cleanedAttendance = doc.attendance;

          if (Array.isArray(doc.attendance)) {
            cleanedAttendance = doc.attendance.map((att: any) => {
              if (!att || typeof att !== 'object') return att;
              if (att.avatar !== undefined || att.photoUrl !== undefined || (att.bikeInfo && att.bikeInfo.photoUrl !== undefined)) {
                needsUpdate = true;
              }
              const { avatar, photoUrl, ...rest } = att;
              if (rest.bikeInfo && typeof rest.bikeInfo === 'object') {
                const { photoUrl: bikePhoto, ...restBike } = rest.bikeInfo;
                rest.bikeInfo = restBike;
              }
              return rest;
            });
          }

          if (doc.avatar !== undefined || doc.photoUrl !== undefined || (doc.bikeInfo && doc.bikeInfo.photoUrl !== undefined)) {
            needsUpdate = true;
          }

          if (needsUpdate) {
            await database.collection(colName).updateOne(
              { _id: doc._id },
              {
                $set: { attendance: cleanedAttendance },
                $unset: { avatar: '', photoUrl: '', 'bikeInfo.photoUrl': '' },
              }
            );
            cleanedDocsCount++;
          }
        }
      } catch (colErr) {
        console.warn(`Notice inspecting collection ${colName}:`, colErr);
      }
    }

    // Also clean up any accidental avatar/photoUrl in attendanceLogs collection
    try {
      await database.collection('attendanceLogs').updateMany(
        {},
        {
          $unset: {
            avatar: '',
            photoUrl: '',
            'bikeInfo.photoUrl': '',
          },
        }
      );
    } catch (attErr) {
      console.warn('Notice cleaning attendanceLogs:', attErr);
    }

    return { success: true, cleanedDocsCount };
  } catch (err: any) {
    console.warn('Activities collection cleanup notice:', err);
    return { success: false, error: err?.message };
  }
}

// ACTIVITIES API
app.get('/api/mongodb/activities', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    let docs = await database.collection('activities').find({}).toArray();
    if (docs.length === 0) {
      const eventDocs = await database.collection('events').find({}).toArray();
      if (eventDocs.length > 0) {
        for (const evt of eventDocs) {
          const act = {
            id: evt.id || `act_${Date.now()}`,
            name: evt.title || evt.name || 'Club Ride',
            date: evt.date || new Date().toISOString().split('T')[0],
            status: (evt.status === 'Completed' || evt.status === 'Cancelled' ? 'Closed' : 'Open'),
            attendance: [],
            createdAt: new Date().toISOString(),
          };
          await database.collection('activities').updateOne(
            { id: act.id },
            { $set: act },
            { upsert: true }
          );
        }
        docs = await database.collection('activities').find({}).toArray();
      }
    }
    const data = docs.map(({ _id, avatar, photoUrl, ...rest }) => {
      if (Array.isArray(rest.attendance)) {
        rest.attendance = rest.attendance.map((att: any) => {
          if (!att || typeof att !== 'object') return att;
          const { avatar: attAvatar, photoUrl: attPhoto, ...attRest } = att;
          if (attRest.bikeInfo && typeof attRest.bikeInfo === 'object') {
            const { photoUrl: bikePhoto, ...restBike } = attRest.bikeInfo;
            attRest.bikeInfo = restBike;
          }
          return attRest;
        });
      }
      return rest;
    });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

// Endpoint to explicitly trigger cleanup of avatar and photoUrl columns in activities MongoDB collection
app.all('/api/mongodb/cleanup-activities', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await cleanupActivitiesCollection(database);
    res.json({ success: true, message: "Cleaned 'avatar' and 'photoUrl' columns from activities MongoDB collection.", ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/activities', async (req, res) => {
  const database = await getMongoDb();
  let activity = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    // Strip redundant image payload strings from activity and attendance array to save MongoDB document storage & bandwidth
    if (activity && typeof activity === 'object') {
      const { avatar, photoUrl, ...restActivity } = activity;
      if (restActivity.bikeInfo && typeof restActivity.bikeInfo === 'object') {
        const { photoUrl: bikePhoto, ...restBike } = restActivity.bikeInfo;
        restActivity.bikeInfo = restBike;
      }
      if (Array.isArray(restActivity.attendance)) {
        restActivity.attendance = restActivity.attendance.map((att: any) => {
          if (!att || typeof att !== 'object') return att;
          const { avatar: attAvatar, photoUrl: attPhoto, ...restAtt } = att;
          if (restAtt.bikeInfo && typeof restAtt.bikeInfo === 'object') {
            const { photoUrl: attBikePhoto, ...restAttBike } = restAtt.bikeInfo;
            restAtt.bikeInfo = restAttBike;
          }
          return restAtt;
        });
      }
      activity = restActivity;
    }
    await database.collection('activities').updateOne(
      { id: activity.id },
      { 
        $set: { ...activity, updatedAt: new Date().toISOString() },
        $unset: { avatar: '', photoUrl: '', 'bikeInfo.photoUrl': '' }
      },
      { upsert: true }
    );
    res.json({ success: true, id: activity.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to delete activity and its associated attendance logs from MongoDB
async function deleteActivityAndAttendanceLogs(database: Db, targetId?: string, targetName?: string) {
  let activityId = targetId;
  let activityName = targetName;

  // If we have an activityId but no activityName, lookup the activity in 'activities' collection first
  if (activityId && !activityName) {
    const existingActivity = await database.collection('activities').findOne({ id: activityId });
    if (existingActivity && existingActivity.name) {
      activityName = existingActivity.name;
    }
  }

  // If we have an activityName but no activityId, lookup the activity in 'activities' collection
  if (activityName && !activityId) {
    const existingActivity = await database.collection('activities').findOne({
      name: { $regex: new RegExp(`^${activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingActivity && existingActivity.id) {
      activityId = existingActivity.id;
    }
  }

  let deletedActivityCount = 0;
  if (activityId) {
    const resAct = await database.collection('activities').deleteOne({ id: activityId });
    deletedActivityCount = resAct.deletedCount || 0;
  } else if (activityName) {
    const resAct = await database.collection('activities').deleteOne({
      name: { $regex: new RegExp(`^${activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    deletedActivityCount = resAct.deletedCount || 0;
  }

  // Delete attendance logs corresponding to this activity
  const orConditions: any[] = [];
  if (activityId) {
    orConditions.push({ activityId });
    orConditions.push({ "Activity ID": activityId });
  }
  if (activityName) {
    const escapedName = activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    orConditions.push({ "Event Name": { $regex: new RegExp(`^${escapedName}$`, 'i') } });
    orConditions.push({ eventName: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
  }

  let deletedLogsCount = 0;
  if (orConditions.length > 0) {
    const resLogs = await database.collection('attendanceLogs').deleteMany({ $or: orConditions });
    deletedLogsCount = resLogs.deletedCount || 0;
  }

  return { deletedActivityCount, deletedLogsCount, activityId, activityName };
}

app.delete('/api/mongodb/activities/:id', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const { id } = req.params;
    const bodyName = req.body?.name || req.query?.name;
    const result = await deleteActivityAndAttendanceLogs(database, id, bodyName as string);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/activities', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const targetId = (req.query.id || req.body?.id) as string;
    const targetName = (req.query.name || req.body?.name) as string;
    if (!targetId && !targetName) {
      return res.status(400).json({ error: 'Activity id or name parameter is required for deletion' });
    }
    const result = await deleteActivityAndAttendanceLogs(database, targetId, targetName);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ATTENDANCE LOGS API ("attendanceLogs" collection table)
app.get('/api/mongodb/attendanceLogs', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('attendanceLogs').find({}).sort({ createdAt: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/attendanceLogs', async (req, res) => {
  const database = await getMongoDb();
  const log = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!log) {
    return res.status(400).json({ error: 'Attendance log entry required' });
  }

  const id = log.id || `attlog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record = {
    id,
    "Event Name": log["Event Name"] || log.eventName || 'General Event',
    "Event Date": log["Event Date"] || log.eventDate || new Date().toISOString().split('T')[0],
    "Member ID": log["Member ID"] || log.memberId || 'BRC-0000',
    "Last Name": log["Last Name"] || log.lastName || '',
    "First Name": log["First Name"] || log.firstName || '',
    "Network": log["Network"] || log.network || 'Main Chapter',
    "Date Stamp": log["Date Stamp"] || log.dateStamp || new Date().toLocaleDateString('en-US'),
    "Time Stamp": log["Time Stamp"] || log.timeStamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventName: log["Event Name"] || log.eventName || 'General Event',
    eventDate: log["Event Date"] || log.eventDate || new Date().toISOString().split('T')[0],
    memberId: log["Member ID"] || log.memberId || 'BRC-0000',
    lastName: log["Last Name"] || log.lastName || '',
    firstName: log["First Name"] || log.firstName || '',
    network: log["Network"] || log.network || 'Main Chapter',
    dateStamp: log["Date Stamp"] || log.dateStamp || new Date().toLocaleDateString('en-US'),
    timeStamp: log["Time Stamp"] || log.timeStamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    createdAt: log.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...log,
  };

  try {
    const result = await database.collection('attendanceLogs').updateOne(
      { id },
      { $set: record },
      { upsert: true }
    );
    res.json({
      success: true,
      id,
      message: 'Attendance record saved in MongoDB "attendanceLogs" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/attendanceLogs/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('attendanceLogs').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// FINANCE LOGS API ("financeLogs" collection table)
app.get('/api/mongodb/financeLogs', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('financeLogs').find({}).sort({ updatedAt: -1 }).toArray();
    let data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/financeLogs', async (req, res) => {
  const database = await getMongoDb();
  const record = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!record || !record.id) {
    return res.status(400).json({ error: 'Finance record must contain an id property' });
  }

  try {
    const result = await database.collection('financeLogs').updateOne(
      { id: record.id },
      { $set: { ...record, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: record.id,
      message: 'Finance record saved in MongoDB "financeLogs" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/financeLogs/bulk', async (req, res) => {
  const database = await getMongoDb();
  const { records } = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'records must be an array' });
  }

  try {
    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { id: rec.id },
        update: { $set: { ...rec, updatedAt: new Date().toISOString() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await database.collection('financeLogs').bulkWrite(bulkOps);
    }
    res.json({ success: true, count: records.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/financeLogs/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('financeLogs').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/financeLogs', async (req, res) => {
  const database = await getMongoDb();
  const id = (req.query.id as string) || req.body?.id;
  const userId = (req.query.userId as string) || req.body?.userId;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!id && !userId) return res.status(400).json({ error: 'id or userId is required' });
  try {
    let result;
    if (id) {
      result = await database.collection('financeLogs').deleteOne({ id });
    } else if (userId) {
      result = await database.collection('financeLogs').deleteMany({
        $or: [{ userId }, { id: `rec_mf_${userId}` }, { userMemberNo: userId }],
      });
    }
    res.json({ success: true, id, userId, deletedCount: result?.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/financeLogs/type/monthlyDues', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const r1 = await database.collection('financeLogs').deleteMany({ itemType: 'Monthly Due' });
    const r2 = await database.collection('monthlyDueLogs').deleteMany({});
    await database.collection('financeLogs').deleteMany({ $or: [{ id: { $regex: /^rec_md/ } }, { createdAt: '' }, { createdAt: { $exists: false } }] });
    res.json({ success: true, deletedCount: (r1.deletedCount || 0) + (r2.deletedCount || 0) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/financeLogs/all', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const r1 = await database.collection('financeLogs').deleteMany({});
    const r2 = await database.collection('monthlyDueLogs').deleteMany({});
    await database.collection('financeLogs').deleteMany({
      $or: [
        { id: { $regex: /^rec_md/ } },
        { id: { $regex: /rec_md_md_/ } },
        { createdAt: '' },
        { createdAt: { $exists: false } },
      ],
    });
    await database.collection('monthlyDueLogs').deleteMany({
      $or: [
        { id: { $regex: /^rec_md/ } },
        { id: { $regex: /rec_md_md_/ } },
        { createdAt: '' },
        { createdAt: { $exists: false } },
      ],
    });
    res.json({ success: true, deletedCount: (r1.deletedCount || 0) + (r2.deletedCount || 0) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// EXPENSE LOGS API ("expenseLogs" collection table)
app.get('/api/mongodb/expenseLogs', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('expenseLogs').find({}).sort({ date: -1, updatedAt: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/expenseLogs', async (req, res) => {
  const database = await getMongoDb();
  const record = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!record || !record.id) {
    return res.status(400).json({ error: 'Expense record must contain an id property' });
  }

  try {
    const result = await database.collection('expenseLogs').updateOne(
      { id: record.id },
      { $set: { ...record, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: record.id,
      message: 'Expense record saved in MongoDB "expenseLogs" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/expenseLogs/bulk', async (req, res) => {
  const database = await getMongoDb();
  const { records } = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'records must be an array' });
  }

  try {
    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { id: rec.id },
        update: { $set: { ...rec, updatedAt: new Date().toISOString() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await database.collection('expenseLogs').bulkWrite(bulkOps);
    }
    res.json({ success: true, count: records.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/expenseLogs/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('expenseLogs').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// LIQUIDATION LOGS API ("liquidationLogs" collection table)
app.get('/api/mongodb/liquidationLogs', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('liquidationLogs').find({}).sort({ date: -1, updatedAt: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/liquidationLogs', async (req, res) => {
  const database = await getMongoDb();
  const record = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!record || !record.id) {
    return res.status(400).json({ error: 'Liquidation record must contain an id property' });
  }

  try {
    const result = await database.collection('liquidationLogs').updateOne(
      { id: record.id },
      { $set: { ...record, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: record.id,
      message: 'Liquidation record saved in MongoDB "liquidationLogs" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/liquidationLogs/bulk', async (req, res) => {
  const database = await getMongoDb();
  const { records } = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'records must be an array' });
  }

  try {
    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { id: rec.id },
        update: { $set: { ...rec, updatedAt: new Date().toISOString() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await database.collection('liquidationLogs').bulkWrite(bulkOps);
    }
    res.json({ success: true, count: records.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/liquidationLogs/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('liquidationLogs').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// FINANCE ARCHIVES API ("financeArchives" collection table)
app.get('/api/mongodb/financeArchives', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('financeArchives').find({}).sort({ year: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/financeArchives', async (req, res) => {
  const database = await getMongoDb();
  const archive = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!archive || (!archive.id && !archive.year)) {
    return res.status(400).json({ error: 'Archive record must contain an id or year property' });
  }

  const archiveId = archive.id || `archive_${archive.year}`;
  try {
    const result = await database.collection('financeArchives').updateOne(
      { $or: [{ id: archiveId }, { year: archive.year }] },
      { $set: { ...archive, id: archiveId, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: archiveId,
      message: 'Finance archive saved in MongoDB "financeArchives" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/financeArchives/:idOrYear', async (req, res) => {
  const database = await getMongoDb();
  const { idOrYear } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const numericYear = parseInt(idOrYear, 10);
    const filter = isNaN(numericYear)
      ? { id: idOrYear }
      : { $or: [{ id: idOrYear }, { year: numericYear }] };
    const result = await database.collection('financeArchives').deleteOne(filter);
    res.json({ success: true, idOrYear, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// TREASURER AUTHORIZATION REQUESTS API
app.get('/api/mongodb/treasurerRequests', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('treasurerRequests').find({}).sort({ createdAt: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/treasurerRequests', async (req, res) => {
  const database = await getMongoDb();
  const treq = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    if (!treq.id) {
      treq.id = `treq_${Date.now()}`;
    }
    const result = await database.collection('treasurerRequests').updateOne(
      { id: treq.id },
      { $set: treq },
      { upsert: true }
    );
    res.json({
      success: true,
      message: 'Treasurer request saved successfully',
      data: treq,
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/treasurerRequests/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('treasurerRequests').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PAYMENTS API
app.get('/api/mongodb/payments', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('payments').find({}).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/payments', async (req, res) => {
  const database = await getMongoDb();
  const payment = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    await database.collection('payments').updateOne(
      { id: payment.id },
      { $set: { ...payment, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true, id: payment.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// COMMUNITY POSTS API
app.get('/api/mongodb/posts', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('posts').find({}).sort({ timestamp: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/posts', async (req, res) => {
  const database = await getMongoDb();
  const post = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    await database.collection('posts').updateOne(
      { id: post.id },
      { $set: { ...post, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true, id: post.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RIDE LOGS API
app.get('/api/mongodb/logs', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('logs').find({}).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/logs', async (req, res) => {
  const database = await getMongoDb();
  const log = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    await database.collection('logs').updateOne(
      { id: log.id },
      { $set: { ...log, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true, id: log.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATES API ("updates" MongoDB collection)
app.get('/api/mongodb/updates', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    // Drop legacy announcements collection if present
    try {
      await database.collection('announcements').drop().catch(() => {});
    } catch (_) {}

    const docs = await database.collection('updates').find({}).sort({ createdAt: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/updates', async (req, res) => {
  const database = await getMongoDb();
  const updateDoc = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    await database.collection('updates').updateOne(
      { id: updateDoc.id },
      { $set: { ...updateDoc, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true, id: updateDoc.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/updates/:id', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    await database.collection('updates').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SETTINGS API ("settings" collection table)
app.get('/api/mongodb/settings', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('settings').find({}).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.get('/api/mongodb/settings/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const doc = await database.collection('settings').findOne({ id });
    if (!doc) {
      return res.status(404).json({ error: 'Setting record not found' });
    }
    const { _id, ...rest } = doc;
    res.json({ success: true, data: rest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/settings', async (req, res) => {
  const database = await getMongoDb();
  const record = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!record || !record.id) {
    return res.status(400).json({ error: 'Setting record must contain an id property' });
  }

  try {
    const result = await database.collection('settings').updateOne(
      { id: record.id },
      { $set: { ...record, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: record.id,
      message: 'Setting saved in MongoDB "settings" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/settings/bulk', async (req, res) => {
  const database = await getMongoDb();
  const { records } = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'records must be an array' });
  }

  try {
    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { id: rec.id },
        update: { $set: { ...rec, updatedAt: new Date().toISOString() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await database.collection('settings').bulkWrite(bulkOps);
    }
    res.json({ success: true, count: records.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/settings/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('settings').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MONTHLY DUES API ("monthlyDues" collection table)
app.get('/api/mongodb/monthlyDues', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('monthlyDues').find({}).sort({ updatedAt: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/monthlyDues', async (req, res) => {
  const database = await getMongoDb();
  const record = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!record || !record.id) {
    return res.status(400).json({ error: 'Monthly due record must contain an id property' });
  }

  try {
    const result = await database.collection('monthlyDues').updateOne(
      { id: record.id },
      { $set: { ...record, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: record.id,
      message: 'Monthly due saved in MongoDB "monthlyDues" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/monthlyDues/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('monthlyDues').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MONTHLY DUE LOGS API ("monthlyDueLogs" collection table)
app.get('/api/mongodb/monthlyDueLogs', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('monthlyDueLogs').find({}).sort({ updatedAt: -1 }).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/monthlyDueLogs', async (req, res) => {
  const database = await getMongoDb();
  const record = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!record || !record.id) {
    return res.status(400).json({ error: 'Monthly due log record must contain an id property' });
  }

  try {
    const result = await database.collection('monthlyDueLogs').updateOne(
      { id: record.id },
      { $set: { ...record, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({
      success: true,
      id: record.id,
      message: 'Monthly due log saved in MongoDB "monthlyDueLogs" collection table.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mongodb/monthlyDueLogs/bulk', async (req, res) => {
  const database = await getMongoDb();
  const { records } = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'records must be an array' });
  }

  try {
    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { id: rec.id },
        update: { $set: { ...rec, updatedAt: new Date().toISOString() } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await database.collection('monthlyDueLogs').bulkWrite(bulkOps);
    }
    res.json({ success: true, count: records.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/monthlyDueLogs/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('monthlyDueLogs').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mongodb/monthlyDueLogs/all', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const result = await database.collection('monthlyDueLogs').deleteMany({});
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SEED INITIAL DATA TO MONGODB
app.post('/api/mongodb/seed', async (req, res) => {
  const database = await getMongoDb();
  const { members, events, payments, posts, logs, routes } = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });

  try {
    if (Array.isArray(members) && members.length > 0) {
      const ops = members.map((m) => ({
        updateOne: { filter: { id: m.id }, update: { $set: m }, upsert: true },
      }));
      await database.collection('members').bulkWrite(ops);
    }
    if (Array.isArray(events) && events.length > 0) {
      const ops = events.map((e) => ({
        updateOne: { filter: { id: e.id }, update: { $set: e }, upsert: true },
      }));
      await database.collection('events').bulkWrite(ops);
    }
    if (Array.isArray(payments) && payments.length > 0) {
      const ops = payments.map((p) => ({
        updateOne: { filter: { id: p.id }, update: { $set: p }, upsert: true },
      }));
      await database.collection('payments').bulkWrite(ops);
    }
    if (Array.isArray(posts) && posts.length > 0) {
      const ops = posts.map((p) => ({
        updateOne: { filter: { id: p.id }, update: { $set: p }, upsert: true },
      }));
      await database.collection('posts').bulkWrite(ops);
    }

    res.json({ success: true, message: 'Database populated with initial BCC Riders data.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mongodb/users (alias for members)
app.get('/api/mongodb/users', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('members').find({}).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

// ==========================================
// RESEND INBOUND EMAIL & WEBHOOK SYSTEM
// ==========================================
interface InboundEmailRecord {
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
  attachments?: any[];
  rawEvent?: any;
  receivedAt: string;
  createdAt?: string;
  read?: boolean;
  starred?: boolean;
  status?: string;
}

const inboundEmailMemoryCache: InboundEmailRecord[] = [];

// Helper to save inbound email to MongoDB and Memory Cache
async function handleReceivedEmailPayload(payload: any): Promise<{ success: boolean; record: InboundEmailRecord; isDuplicate: boolean }> {
  const eventType = payload?.type || 'email.received';
  const data = payload?.data || payload;

  const emailId = data?.email_id || data?.id || `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const recordId = `inb_${emailId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const fromAddress = String(data?.from || 'Unknown Sender');
  const toAddresses: string[] = Array.isArray(data?.to)
    ? data.to
    : (data?.to ? [String(data.to)] : ['contact@bccriders.cc']);
  const ccAddresses: string[] = Array.isArray(data?.cc) ? data.cc : [];
  const bccAddresses: string[] = Array.isArray(data?.bcc) ? data.bcc : [];
  const receivedFor: string[] = Array.isArray(data?.received_for) ? data.received_for : [];

  const subject = String(data?.subject || '(No Subject)');
  const messageId = String(data?.message_id || '');
  const attachments = Array.isArray(data?.attachments) ? data.attachments : [];
  const createdAt = data?.created_at || payload?.created_at || new Date().toISOString();
  const receivedAt = new Date().toISOString();

  const bodyText = data?.text || data?.bodyText || '';
  const bodyHtml = data?.html || data?.bodyHtml || '';

  // Construct standard record
  const emailRecord: InboundEmailRecord = {
    id: recordId,
    emailId,
    from: fromAddress,
    to: toAddresses,
    cc: ccAddresses,
    bcc: bccAddresses,
    receivedFor,
    messageId,
    subject,
    bodyText,
    bodyHtml,
    attachments,
    rawEvent: {
      type: eventType,
      created_at: createdAt,
      data: {
        email_id: emailId,
        from: fromAddress,
        to: toAddresses,
        subject,
        attachments_count: attachments.length,
      }
    },
    receivedAt,
    createdAt,
    read: false,
    starred: false,
    status: 'received',
  };

  // Check duplicate in memory
  const existingIdx = inboundEmailMemoryCache.findIndex((e) => e.id === recordId || (e.emailId && e.emailId === emailId));
  const isDuplicate = existingIdx !== -1;

  if (isDuplicate) {
    inboundEmailMemoryCache[existingIdx] = { ...inboundEmailMemoryCache[existingIdx], ...emailRecord };
  } else {
    inboundEmailMemoryCache.unshift(emailRecord);
    if (inboundEmailMemoryCache.length > 300) {
      inboundEmailMemoryCache.pop();
    }
  }

  // Save to MongoDB (Dedicated inbound DB or primary DB fallback)
  const database = await getInboundMongoDb();
  if (database) {
    try {
      await database.collection('inbound_emails').updateOne(
        { id: recordId },
        { $set: emailRecord },
        { upsert: true }
      );
      console.log(`[Resend Inbound] Saved email ${recordId} from ${fromAddress} to ${toAddresses.join(', ')} in MongoDB.`);
    } catch (dbErr) {
      console.error('[Resend Inbound] Error saving to MongoDB:', dbErr);
    }
  }

  return { success: true, record: emailRecord, isDuplicate };
}

// Resend Webhook POST endpoint (compatible with Resend webhook event: 'email.received')
const handleResendWebhook = async (req: express.Request, res: express.Response) => {
  try {
    const payload = req.body;
    console.log(`[Resend Webhook] Received webhook POST event:`, payload?.type || 'unknown_event', JSON.stringify(payload).slice(0, 300));

    if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      return res.status(400).json({ error: 'Missing webhook payload body' });
    }

    // Process event
    const { record, isDuplicate } = await handleReceivedEmailPayload(payload);

    return res.status(200).json({
      success: true,
      message: 'Inbound email webhook processed successfully',
      id: record.id,
      email_id: record.emailId,
      duplicate: isDuplicate,
      received_for: record.to,
      subject: record.subject,
    });
  } catch (err: any) {
    console.error('[Resend Webhook] Webhook processing error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process webhook' });
  }
};

app.post('/api/resend/webhook', handleResendWebhook);
app.post('/api/webhook', handleResendWebhook);
app.post('/api/events', handleResendWebhook);

// Resend Webhook Status GET endpoint
app.get('/api/resend/webhook', (_req, res) => {
  const isDedicatedDb = Boolean(process.env.MONGODB_INBOUND_URI || process.env.INBOUND_MONGODB_URI);
  res.json({
    status: 'active',
    endpoint: '/api/resend/webhook',
    configuredAddress: 'contact@bccriders.cc',
    description: 'Resend Inbound Email Webhook endpoint is listening for email.received events.',
    supportedEvents: ['email.received'],
    databaseMode: isDedicatedDb ? 'dedicated_inbound_mongodb' : 'primary_mongodb',
    dedicatedDbConfigured: isDedicatedDb,
    databaseName: inboundDbName,
  });
});

// GET all inbound emails
app.get('/api/inbound-emails', async (_req, res) => {
  const isDedicatedDb = Boolean(process.env.MONGODB_INBOUND_URI || process.env.INBOUND_MONGODB_URI);
  const database = await getInboundMongoDb();
  if (database) {
    try {
      const docs = await database
        .collection('inbound_emails')
        .find({})
        .sort({ receivedAt: -1, createdAt: -1 })
        .limit(200)
        .toArray();
      const data = docs.map(({ _id, ...rest }) => rest);
      return res.json({
        success: true,
        count: data.length,
        data,
        databaseMode: isDedicatedDb ? 'dedicated_inbound_mongodb' : 'primary_mongodb',
        dedicatedDbConfigured: isDedicatedDb,
        databaseName: inboundDbName,
      });
    } catch (err: any) {
      console.warn('Error querying MongoDB inbound_emails:', err);
    }
  }
  return res.json({
    success: true,
    count: inboundEmailMemoryCache.length,
    data: inboundEmailMemoryCache,
    databaseMode: isDedicatedDb ? 'dedicated_inbound_mongodb' : 'primary_mongodb',
    dedicatedDbConfigured: isDedicatedDb,
    databaseName: inboundDbName,
  });
});

// DELETE an inbound email
app.delete('/api/inbound-emails/:id', async (req, res) => {
  const { id } = req.params;
  const database = await getInboundMongoDb();

  // Remove from cache
  const idx = inboundEmailMemoryCache.findIndex((e) => e.id === id || e.emailId === id);
  if (idx !== -1) {
    inboundEmailMemoryCache.splice(idx, 1);
  }

  if (database) {
    try {
      const result = await database.collection('inbound_emails').deleteOne({
        $or: [{ id }, { emailId: id }],
      });
      return res.json({ success: true, deletedCount: result.deletedCount });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  return res.json({ success: true, deletedCount: 1 });
});

// POST mark email as read/unread or toggle starred
app.post('/api/inbound-emails/:id/mark-read', async (req, res) => {
  const { id } = req.params;
  const { read = true, starred } = req.body || {};

  const updates: any = {};
  if (typeof read === 'boolean') updates.read = read;
  if (typeof starred === 'boolean') updates.starred = starred;

  const item = inboundEmailMemoryCache.find((e) => e.id === id || e.emailId === id);
  if (item) {
    if (typeof read === 'boolean') item.read = read;
    if (typeof starred === 'boolean') item.starred = starred;
  }

  const database = await getInboundMongoDb();
  if (database) {
    try {
      await database.collection('inbound_emails').updateOne(
        { $or: [{ id }, { emailId: id }] },
        { $set: updates }
      );
    } catch (err: any) {
      console.warn('Error updating read status in MongoDB:', err);
    }
  }

  return res.json({ success: true, updates });
});

// POST test inbound email (simulates Resend webhook payload for contact@bccriders.cc)
app.post('/api/inbound-emails/test', async (req, res) => {
  const samplePayload = {
    type: 'email.received',
    created_at: new Date().toISOString(),
    data: {
      email_id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      from: req.body?.from || 'rider.inquiry@gmail.com',
      to: req.body?.to || ['contact@bccriders.cc'],
      bcc: [],
      cc: [],
      received_for: ['contact@bccriders.cc'],
      message_id: `<sample-${Date.now()}@mail.example.com>`,
      subject: req.body?.subject || 'Inquiry regarding Club Membership & upcoming ride',
      bodyText: req.body?.bodyText || 'Hello BCC Riders Club Team,\n\nI would like to inquire about the membership requirements and registration schedule for new adventure riders.\n\nBest regards,\nProspective Rider',
      attachments: req.body?.attachments || [
        {
          id: `att_${Date.now()}`,
          filename: 'motorcycle_registration_sample.png',
          content_type: 'image/png',
          content_disposition: 'attachment',
          content_id: 'sample_doc',
          size: 142850,
        }
      ]
    }
  };

  const { record } = await handleReceivedEmailPayload(samplePayload);
  return res.json({
    success: true,
    message: 'Simulated test inbound email created successfully!',
    record,
  });
});

// ==========================================
// RESEND OUTBOUND SEND EMAIL API
// ==========================================
interface OutboundEmailRecord {
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

const outboundEmailMemoryCache: OutboundEmailRecord[] = [];

// GET /api/emails/outbox (history of sent emails)
app.get('/api/emails/outbox', async (_req, res) => {
  const database = await getMongoDb();
  if (database) {
    try {
      const docs = await database
        .collection('outbound_emails')
        .find({})
        .sort({ sentAt: -1 })
        .limit(200)
        .toArray();
      const data = docs.map(({ _id, ...rest }) => rest);
      return res.json({ success: true, count: data.length, data });
    } catch (err: any) {
      console.warn('Error querying outbound_emails in MongoDB:', err);
    }
  }
  return res.json({
    success: true,
    count: outboundEmailMemoryCache.length,
    data: outboundEmailMemoryCache,
  });
});

// DELETE /api/emails/outbox/:id (delete a sent email from outbox history)
app.delete('/api/emails/outbox/:id', async (req, res) => {
  const { id } = req.params;
  const database = await getMongoDb();

  // Remove from cache
  const idx = outboundEmailMemoryCache.findIndex((e) => e.id === id || (e as any).resendId === id);
  if (idx !== -1) {
    outboundEmailMemoryCache.splice(idx, 1);
  }

  if (database) {
    try {
      const result = await database.collection('outbound_emails').deleteOne({
        $or: [{ id }, { resendId: id }],
      });
      return res.json({ success: true, id, deletedCount: result.deletedCount });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
  return res.json({ success: true, id, deletedCount: 1 });
});

// POST /api/emails/send (Send outbound email via Resend API)
app.post('/api/emails/send', async (req, res) => {
  try {
    const {
      to,
      subject,
      body,
      html,
      from = 'BCC Riders Club <info@bccriders.cc>',
      cc,
      bcc,
      replyTo = 'contact@bccriders.cc',
      senderName = 'Admin',
    } = req.body || {};

    if (!to) {
      return res.status(400).json({ error: 'Recipient "to" email address is required.' });
    }
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ error: 'Email subject is required.' });
    }
    if (!body && !html) {
      return res.status(400).json({ error: 'Email content (body or HTML) is required.' });
    }

    const toList: string[] = Array.isArray(to)
      ? to.map((s: string) => String(s).trim()).filter(Boolean)
      : String(to)
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);

    if (toList.length === 0) {
      return res.status(400).json({ error: 'At least one valid recipient email is required.' });
    }

    const ccList: string[] = cc
      ? Array.isArray(cc)
        ? cc
        : String(cc).split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];

    const bccList: string[] = bcc
      ? Array.isArray(bcc)
        ? bcc
        : String(bcc).split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];

    const formattedHtml =
      html ||
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f4; margin: 0; padding: 20px; color: #1b4332; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #d8f3dc; overflow: hidden; box-shadow: 0 4px 12px rgba(27,67,50,0.06); }
          .header { background: #1b4332; padding: 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; font-weight: 800; }
          .header p { margin: 4px 0 0; color: #74c69d; font-size: 12px; }
          .content { padding: 24px; font-size: 14px; line-height: 1.6; color: #2d3748; white-space: pre-wrap; }
          .footer { background: #f7f9f7; padding: 16px; text-align: center; font-size: 11px; color: #718096; border-top: 1px solid #e2ece2; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>BCC RIDERS CLUB</h1>
            <p>Official Club Communication</p>
          </div>
          <div class="content">${String(body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div class="footer">
            Sent via Resend Dispatch • BCC Riders Club • contact@bccriders.cc
          </div>
        </div>
      </body>
      </html>
    `;

    const resend = getResendClient();
    let resendId = `msg_${Date.now()}`;
    let deliveryStatus: 'sent' | 'simulated' | 'failed' = 'sent';
    let errorMessage = '';

    if (resend) {
      try {
        const response = await resend.emails.send({
          from,
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          bcc: bccList.length > 0 ? bccList : undefined,
          replyTo,
          subject,
          text: String(body || ''),
          html: formattedHtml,
        });

        if (response && (response as any).data?.id) {
          resendId = (response as any).data.id;
        } else if ((response as any).id) {
          resendId = (response as any).id;
        }
      } catch (err: any) {
        console.error('[Resend Outbound] Resend API error:', err);
        errorMessage = err.message || 'Resend API call failed';
        deliveryStatus = 'failed';
      }
    } else {
      console.warn('[Resend Outbound] RESEND_API_KEY is not configured. Email logged as simulated dispatch.');
      deliveryStatus = 'simulated';
    }

    const emailRecord: OutboundEmailRecord = {
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      resendId,
      from,
      to: toList,
      cc: ccList,
      bcc: bccList,
      replyTo,
      subject,
      bodyText: body || '',
      bodyHtml: formattedHtml,
      sentAt: new Date().toISOString(),
      status: deliveryStatus,
      error: errorMessage || undefined,
      senderName,
    };

    outboundEmailMemoryCache.unshift(emailRecord);
    if (outboundEmailMemoryCache.length > 200) outboundEmailMemoryCache.pop();

    const database = await getMongoDb();
    if (database) {
      try {
        await database.collection('outbound_emails').insertOne(emailRecord);
      } catch (dbErr) {
        console.warn('Error recording outbound email to MongoDB:', dbErr);
      }
    }

    if (deliveryStatus === 'failed') {
      return res.status(502).json({
        success: false,
        error: `Failed to deliver email: ${errorMessage}`,
        record: emailRecord,
      });
    }

    return res.json({
      success: true,
      message:
        deliveryStatus === 'simulated'
          ? 'Email dispatched (simulated mode — configure RESEND_API_KEY for live delivery)'
          : 'Email sent successfully via Resend API!',
      record: emailRecord,
    });
  } catch (err: any) {
    console.error('Server error in /api/emails/send:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Catch-all route for API requests to ensure JSON response instead of HTML SPA fallback
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}`, data: [] });
});

// Start Express, Vite, and the Socket.io real-time layer
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Listen on the shared HTTP server so Express and Socket.io share PORT 3000.
  // Socket.io claims /socket.io/* before Express sees it, so neither the canonical-domain
  // redirect nor the SPA catch-all interferes with the WebSocket handshake.
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`BCC Riders Club Full-Stack server running on http://0.0.0.0:${PORT}`);
    console.log(`Socket.io real-time endpoint listening on path /socket.io`);
  });

  // Open the MongoDB change streams that drive real-time sync.
  await startRealtimeChangeStreams().catch((err) =>
    console.warn('[Realtime] Initial change stream startup failed:', err?.message || err)
  );
}

// Graceful shutdown so Render deploys close change streams and sockets cleanly.
// Clients see a normal disconnect and reconnect via their backoff instead of hanging.
let shutdownInProgress = false;
async function shutdown(signal: string) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  realtimeShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, closing real-time streams and server...`);

  if (realtimeRestartTimer) {
    clearTimeout(realtimeRestartTimer);
    realtimeRestartTimer = null;
  }

  try {
    await stopRealtimeChangeStreams();
  } catch (err: any) {
    console.warn('[Shutdown] Change stream close notice:', err?.message || err);
  }

  try {
    io.disconnectSockets(true);
    await new Promise<void>((resolve) => io.close(() => resolve()));
  } catch (err: any) {
    console.warn('[Shutdown] Socket.io close notice:', err?.message || err);
  }

  await new Promise<void>((resolve) => httpServer.close(() => resolve()));

  try {
    if (inboundMongoClient) await inboundMongoClient.close();
    if (mongoClient) await mongoClient.close();
  } catch (err: any) {
    console.warn('[Shutdown] MongoDB close notice:', err?.message || err);
  }

  console.log('[Shutdown] Clean exit.');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

startServer();
