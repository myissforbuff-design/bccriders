import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, Db } from 'mongodb';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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
    console.log(`Connected successfully to MongoDB database: ${dbName}`);
    return db;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return null;
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
  return rest;
}

// Helper to sanitize registration documents containing all submitted form fields as columns
function sanitizeRegistrationForMongo(rawReg: any) {
  if (!rawReg || typeof rawReg !== 'object') return rawReg;
  const { _id, ...rest } = rawReg;
  return {
    id: rest.id || `reg_${Date.now()}`,
    username: rest.username || (rest.email ? rest.email.split('@')[0] : `user_${Date.now()}`),
    name: rest.name || `${rest.firstName || ''} ${rest.lastName || ''}`.trim() || 'Applicant',
    firstName: rest.firstName || '',
    lastName: rest.lastName || '',
    birthdate: rest.birthdate || '',
    age: rest.age,
    gender: rest.gender || 'Male',
    email: rest.email || '',
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
    await database.collection('members').createIndex({ email: 1 });

    await database.collection('registration').createIndex({ id: 1 }, { unique: true });
    await database.collection('registration').createIndex({ email: 1 });

    await database.collection('attendanceLogs').createIndex({ id: 1 }, { unique: true });
    await database.collection('attendanceLogs').createIndex({ "Member ID": 1, "Event Name": 1 });

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
  } catch (e) {
    console.warn('MongoDB index initialization notice:', e);
  }
}
initMongoIndexes();

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
      return {
        id: docId,
        username: cleaned.username || cleaned.email?.split('@')[0] || `user_${docId.substring(0, 6)}`,
        name: cleaned.name || cleaned.username || 'Club Member',
        role: cleaned.role || 'Members',
        duesStatus: cleaned.duesStatus || 'Active',
        approvalStatus: cleaned.approvalStatus || 'Approved',
        duesExpiryDate: cleaned.duesExpiryDate || '2027-12-31',
        ...cleaned,
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

// Transfer accepted item from "registration" table to "members" table in MongoDB
app.post('/api/mongodb/registration/accept/:id', async (req, res) => {
  const database = await getMongoDb();
  const { id } = req.params;
  const payload = req.body || {};

  if (!database) {
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

    res.json({
      success: true,
      message: `Form item "${id}" accepted, removed from "registration" table and transferred to "members" table in MongoDB.`,
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
