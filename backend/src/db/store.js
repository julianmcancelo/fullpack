const fs = require('fs');
const path = require('path');
const neon = require('./neon');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BUNDLED_DB_FILE = path.join(__dirname, '..', '..', 'data', 'store.json');
const DB_FILE = isVercel
  ? path.join('/tmp', 'store.json')
  : BUNDLED_DB_FILE;

const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    console.warn('Could not create dataDir:', e.message);
  }
}

const defaultData = {
  settings: {
    appId: '8410220120357196',
    clientSecret: 'KJWBdQk7fNkSVuZpBY8EYzcAegZDKtqt',
    redirectUri: 'https://httpbin.org/get',
    siteId: 'MLA',
    lowStockThreshold: 5,
    autoSyncMinutes: 15,
  },
  auth: {
    accessToken: '',
    refreshToken: '',
    expiresAt: null,
    userId: '',
    nickname: '',
    permalink: '',
    siteId: 'MLA',
  },
  packingMetadata: {},
  scanLogs: [],
  users: [
    {
      id: 1,
      email: 'jcancelo.dev@gmail.com',
      name: 'Julián Cancelo (Admin)',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=jcancelo.dev@gmail.com',
      role: 'admin',
      status: 'active',
      authProvider: 'google',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  loginTokens: [],
};

// In-memory cache for ultra-fast response
let inMemoryCache = null;

function getInitialData() {
  try {
    if (fs.existsSync(BUNDLED_DB_FILE)) {
      const raw = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read bundled store.json:', e.message);
  }
  return defaultData;
}

function readDb() {
  if (inMemoryCache) {
    return inMemoryCache;
  }
  try {
    if (!fs.existsSync(DB_FILE)) {
      const init = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2), 'utf-8');
      inMemoryCache = init;
      return init;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    inMemoryCache = {
      ...parsed,
      settings: {
        ...parsed.settings,
        appId: '8410220120357196',
        clientSecret: 'KJWBdQk7fNkSVuZpBY8EYzcAegZDKtqt',
        redirectUri: parsed.settings?.redirectUri || 'https://httpbin.org/get',
      },
      packingMetadata: parsed.packingMetadata || {},
      scanLogs: parsed.scanLogs || [],
      users: parsed.users || defaultData.users,
      loginTokens: parsed.loginTokens || [],
    };
    return inMemoryCache;
  } catch (err) {
    console.error('Error reading store.json, restoring default state:', err);
    inMemoryCache = defaultData;
    return defaultData;
  }
}

function writeDb(data) {
  inMemoryCache = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store.json:', err);
  }
}

// Background sync from Neon if available
(async () => {
  try {
    const neonAuth = await neon.getAuthFromNeon();
    if (neonAuth && neonAuth.accessToken) {
      const db = readDb();
      db.auth = { ...db.auth, ...neonAuth };
      writeDb(db);
    }
    const neonSettings = await neon.getSettingsFromNeon();
    if (neonSettings) {
      const db = readDb();
      db.settings = { ...db.settings, ...neonSettings };
      writeDb(db);
    }
    const neonPacking = await neon.getPackingMetadataFromNeon();
    if (neonPacking && Object.keys(neonPacking).length > 0) {
      const db = readDb();
      db.packingMetadata = { ...db.packingMetadata, ...neonPacking };
      writeDb(db);
    }
    const neonUsers = await neon.getAllUsersFromNeon();
    if (neonUsers && neonUsers.length > 0) {
      const db = readDb();
      db.users = neonUsers;
      writeDb(db);
    }
  } catch (e) {
    // Silent background sync attempt
  }
})();

function getSettings() {
  const db = readDb();
  return db.settings;
}

function updateSettings(newSettings) {
  const db = readDb();
  db.settings = { ...db.settings, ...newSettings };
  writeDb(db);
  neon.saveSettingsToNeon(db.settings).catch(() => {});
  return db.settings;
}

function getAuth() {
  const db = readDb();
  return db.auth;
}

function updateAuth(newAuth) {
  const db = readDb();
  db.auth = { ...db.auth, ...newAuth };
  writeDb(db);
  neon.saveAuthToNeon(db.auth).catch(() => {});
  return db.auth;
}

function clearAuth() {
  const db = readDb();
  db.auth = { ...defaultData.auth };
  writeDb(db);
  neon.saveAuthToNeon(db.auth).catch(() => {});
  return db.auth;
}

function getPackingMetadata() {
  const db = readDb();
  return db.packingMetadata || {};
}

function updatePackingMetadata(shipmentId, updates) {
  const db = readDb();
  if (!db.packingMetadata) db.packingMetadata = {};
  db.packingMetadata[shipmentId] = {
    ...(db.packingMetadata[shipmentId] || {
      printed: false,
      packed: false,
      qualityChecked: false,
      note: '',
    }),
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeDb(db);
  neon.savePackingMetadataToNeon(shipmentId, db.packingMetadata[shipmentId]).catch(() => {});
  return db.packingMetadata[shipmentId];
}

async function addScanLog(barcode, shipmentId, action, details = {}) {
  const db = readDb();
  if (!db.scanLogs) db.scanLogs = [];
  const logItem = {
    id: Date.now().toString(),
    barcode,
    shipmentId,
    action,
    details,
    createdAt: new Date().toISOString(),
  };
  db.scanLogs.unshift(logItem);
  if (db.scanLogs.length > 200) db.scanLogs = db.scanLogs.slice(0, 200);
  writeDb(db);
  neon.logScanToNeon(barcode, shipmentId, action, details).catch(() => {});
  return logItem;
}

function getScanLogs(limit = 50) {
  const db = readDb();
  return (db.scanLogs || []).slice(0, limit);
}

// Resilient SaaS User & Auth operations with Neon fallback
async function findUserByEmail(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  try {
    const neonUser = await neon.findUserByEmailInNeon(cleanEmail);
    if (neonUser) return neonUser;
  } catch (e) {
    console.warn('Neon findUser fallback:', e.message);
  }

  const db = readDb();
  if (!db.users) db.users = [...defaultData.users];

  let local = db.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (cleanEmail === 'jcancelo.dev@gmail.com') {
    if (!local) {
      local = {
        id: 1,
        email: 'jcancelo.dev@gmail.com',
        name: 'Julián Cancelo (Admin)',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=jcancelo.dev@gmail.com',
        role: 'admin',
        status: 'active',
        authProvider: 'google',
        createdAt: new Date().toISOString(),
      };
      db.users.push(local);
      writeDb(db);
    } else {
      local.role = 'admin';
      local.status = 'active';
    }
  }
  return local || null;
}

async function upsertUser({ email, name, avatar, role = 'user', status = 'pending', authProvider = 'email' }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const isAdmin = cleanEmail === 'jcancelo.dev@gmail.com';
  const finalRole = isAdmin ? 'admin' : role;
  const finalStatus = isAdmin ? 'active' : status;

  let userResult = null;
  try {
    userResult = await neon.upsertUserInNeon({
      email: cleanEmail,
      name,
      avatar,
      role: finalRole,
      status: finalStatus,
      authProvider,
    });
  } catch (e) {
    console.warn('Neon upsertUser fallback:', e.message);
  }

  const db = readDb();
  if (!db.users) db.users = [...defaultData.users];

  const existingIdx = db.users.findIndex(u => u.email.toLowerCase() === cleanEmail);
  const userObj = userResult || {
    id: existingIdx >= 0 ? db.users[existingIdx].id : Date.now(),
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
    role: finalRole,
    status: finalStatus,
    authProvider,
    createdAt: existingIdx >= 0 ? db.users[existingIdx].createdAt : new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    db.users[existingIdx] = { ...db.users[existingIdx], ...userObj, lastLoginAt: new Date().toISOString() };
  } else {
    db.users.push(userObj);
  }
  writeDb(db);
  return userObj;
}

async function getAllUsers() {
  try {
    const neonUsers = await neon.getAllUsersFromNeon();
    if (neonUsers && neonUsers.length > 0) return neonUsers;
  } catch (e) {
    console.warn('Neon getAllUsers fallback:', e.message);
  }

  const db = readDb();
  if (!db.users || db.users.length === 0) {
    db.users = [...defaultData.users];
    writeDb(db);
  }
  return db.users;
}

async function updateUserStatus(userId, newStatus) {
  try {
    await neon.updateUserStatusInNeon(userId, newStatus);
  } catch (e) {
    console.warn('Neon updateUserStatus fallback:', e.message);
  }

  const db = readDb();
  if (db.users) {
    const user = db.users.find(u => String(u.id) === String(userId));
    if (user) {
      user.status = newStatus;
      writeDb(db);
    }
  }
  return true;
}

async function createLoginToken(email, code, token, expireMinutes = 15) {
  try {
    await neon.createLoginTokenInNeon(email, code, token, expireMinutes);
  } catch (e) {
    console.warn('Neon createLoginToken fallback:', e.message);
  }

  const db = readDb();
  if (!db.loginTokens) db.loginTokens = [];
  const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString();
  db.loginTokens.push({
    email: email.trim().toLowerCase(),
    code,
    token,
    expiresAt,
    used: false,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  return { email, code, token, expiresAt };
}

async function verifyLoginToken(email, codeOrToken) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (codeOrToken || '').trim();

  try {
    const neonValid = await neon.verifyLoginTokenInNeon(cleanEmail, cleanCode);
    if (neonValid) return true;
  } catch (e) {
    console.warn('Neon verifyLoginToken fallback:', e.message);
  }

  const db = readDb();
  if (!db.loginTokens) return false;

  const now = new Date();
  const found = db.loginTokens.find(
    t => t.email === cleanEmail &&
         (t.code === cleanCode || t.token === cleanCode) &&
         !t.used &&
         new Date(t.expiresAt) > now
  );

  if (found) {
    found.used = true;
    writeDb(db);
    return true;
  }

  return false;
}

async function getDatabaseStatus() {
  const neonActive = await neon.isNeonConnected();
  const connStr = neon.getConnectionString();
  return {
    provider: neonActive ? 'Neon PostgreSQL' : 'Almacenamiento Local / Serverless Flash',
    neonConnected: neonActive,
    hasConnectionString: Boolean(connStr),
    mode: neonActive ? 'Cloud PostgreSQL (Neon)' : 'Local File JSON',
  };
}

module.exports = {
  getSettings,
  updateSettings,
  getAuth,
  updateAuth,
  clearAuth,
  getPackingMetadata,
  updatePackingMetadata,
  addScanLog,
  getScanLogs,
  findUserByEmail,
  upsertUser,
  getAllUsers,
  updateUserStatus,
  createLoginToken,
  verifyLoginToken,
  getDatabaseStatus,
};
