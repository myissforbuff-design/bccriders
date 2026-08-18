import express from 'express';
import path from 'path';
import { MongoClient, Db } from 'mongodb';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';

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
  name?: string;
  type?: 'reset' | 'login';
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

// Initial default seed data for automatic database creation
const INITIAL_SEED_MEMBERS = [
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
    emergencyContact: { name: 'Helen Vance', relationship: 'Spouse', phone: '+63 917 987 6543' },
    bikeInfo: { make: 'Honda', model: 'CRF1100L Africa Twin', year: 2024, engineCc: '1084cc', licensePlate: 'BCC-01' },
    approvalStatus: 'Approved',
  },
  {
    id: 'usr_member_1',
    username: 'elena_r',
    name: 'Elena Rostova',
    email: 'elena.rostova@example.com',
    role: 'Members',
    memberNumber: 'BRC-0001',
    password: 'bccriders123',
    phone: '+63 918 234 5678',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
    bio: 'Adventure touring & off-road trail enthusiast.',
    joinDate: '2026-02-15',
    emergencyContact: { name: 'Dmitri Rostova', relationship: 'Brother', phone: '+63 918 876 5432' },
    bikeInfo: { make: 'BMW', model: 'R 1250 GS Adventure', year: 2023, engineCc: '1254cc', licensePlate: 'ELN-88' },
    approvalStatus: 'Approved',
  }
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
    password: rest.password || 'bccriders123',
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

    // Auto seed members if empty so the database and collection appear in MongoDB Compass / Atlas immediately
    const count = await database.collection('members').countDocuments();
    if (count === 0) {
      console.log('Seeding initial member documents into MongoDB...');
      for (const member of INITIAL_SEED_MEMBERS) {
        await database.collection('members').updateOne(
          { id: member.id },
          { $set: sanitizeMemberForMongo(member) },
          { upsert: true }
        );
      }
      console.log('Successfully created "bcc-riders-club-db" database and "members" collection in MongoDB!');
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
  res.json({ status: 'ok', time: new Date().toISOString() });
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

      // If not found in members, check registration collection to detect pending registration
      if (!doc) {
        doc = await database.collection('registration').findOne({ $or: orConditions });
      }

      if (doc) {
        matchedUser = doc;
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

  // Verify password
  const expectedPassword = String(matchedUser.password || 'bccriders123').trim();
  if (cleanPassword !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid Username or Password.' });
  }

  const memberId = matchedUser.id || matchedUser._id?.toString();

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
    return res.json({
      success: true,
      requiresOtp: false,
      isAdmin: true,
      userId: memberId,
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

  otpCache.set(`login_${memberEmail}`, {
    email: memberEmail,
    otp,
    expiresAt,
    userId: memberId,
    name: memberName,
    type: 'login',
  });

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@bccriders.cc';
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
          &copy; 2026 BCC Riders Club &bull; Sent from noreply@bccriders.cc
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
      message: `Authorization code generated for ${maskedEmail}.`,
      devOtp: otp,
    });
  }
});

// AUTH: Verify Login OTP and Complete Sign-In
app.post('/api/auth/verify-login-otp', (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const entry = otpCache.get(`login_${normalizedEmail}`);

  if (!entry) {
    return res.status(400).json({ error: 'No active sign-in authorization found. Please try signing in again.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpCache.delete(`login_${normalizedEmail}`);
    return res.status(400).json({ error: 'The sign-in code has expired. Please sign in again to receive a fresh code.' });
  }

  if (entry.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
  }

  // Invalidate OTP after successful verification
  otpCache.delete(`login_${normalizedEmail}`);

  res.json({
    success: true,
    verified: true,
    userId: entry.userId,
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

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@bccriders.cc';
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
          &copy; 2026 BCC Riders Club &bull; Sent from noreply@bccriders.cc
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
    // Clean _id field and sanitize fields for frontend consistency
    const members = docs.map(({ _id, ...rest }) => {
      const cleaned = sanitizeMemberForMongo(rest);
      const docId = cleaned.id || (_id ? _id.toString() : `usr_${Math.random().toString(36).substring(2, 9)}`);
      const emailStr = (cleaned.email || '').trim();
      const fallbackUser = emailStr
        ? emailStr.split('@')[0]
        : cleaned.name
        ? String(cleaned.name).trim().toLowerCase().replace(/\s+/g, '_')
        : `user_${docId.substring(0, 6)}`;
      const finalUsername = (cleaned.username && String(cleaned.username).trim()) || fallbackUser;

      return {
        ...cleaned,
        id: docId,
        username: finalUsername,
        name: cleaned.name || finalUsername || 'Club Member',
        role: cleaned.role || 'Members',
        duesStatus: cleaned.duesStatus || 'Active',
        approvalStatus: cleaned.approvalStatus || 'Approved',
        duesExpiryDate: cleaned.duesExpiryDate || '2027-12-31',
      };
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
    const registrations = docs.map(({ _id, ...rest }) => ({
      id: rest.id,
      ...rest,
      approvalStatus: 'Pending',
    }));
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

    // 4. Send official approval email to the registered email address from info@bccriders.cc (No-Reply)
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

// ACTIVITIES API
app.get('/api/mongodb/activities', async (req, res) => {
  const database = await getMongoDb();
  if (!database) return res.status(503).json({ error: 'MongoDB not connected', data: [] });
  try {
    const docs = await database.collection('activities').find({}).toArray();
    const data = docs.map(({ _id, ...rest }) => rest);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.post('/api/mongodb/activities', async (req, res) => {
  const database = await getMongoDb();
  const activity = req.body;
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    await database.collection('activities').updateOne(
      { id: activity.id },
      { $set: { ...activity, updatedAt: new Date().toISOString() } },
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
    const data = docs.map(({ _id, ...rest }) => rest);
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
  if (!database) return res.status(503).json({ error: 'MongoDB not connected' });
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    const result = await database.collection('financeLogs').deleteOne({ id });
    res.json({ success: true, id, deletedCount: result.deletedCount });
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
    console.log(`[Resend Webhook] Received webhook POST event:`, payload?.type || 'unknown_event');

    if (!payload) {
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

// Catch-all route for API requests to ensure JSON response instead of HTML SPA fallback
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}`, data: [] });
});

// Start Express and Vite Server
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BCC Riders Club Full-Stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
