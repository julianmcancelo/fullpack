const fs = require('fs');
const path = require('path');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_FILE = isVercel
  ? path.join('/tmp', 'store.json')
  : path.join(__dirname, '..', '..', 'data', 'store.json');

const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    console.warn('Could not create dataDir:', e.message);
  }
}

// Configured with user's live credentials & packing operational metadata
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
  packingMetadata: {}, // { [shipmentId]: { printed: bool, packed: bool, qualityChecked: bool, note: string, printedAt: string, packedAt: string } }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      settings: {
        ...parsed.settings,
        appId: '8410220120357196',
        clientSecret: 'KJWBdQk7fNkSVuZpBY8EYzcAegZDKtqt',
        redirectUri: parsed.settings?.redirectUri || 'https://httpbin.org/get',
      },
      packingMetadata: parsed.packingMetadata || {},
    };
  } catch (err) {
    console.error('Error reading store.json, restoring default state:', err);
    return defaultData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing store.json:', err);
  }
}

function getSettings() {
  const db = readDb();
  return db.settings;
}

function updateSettings(newSettings) {
  const db = readDb();
  db.settings = { ...db.settings, ...newSettings };
  writeDb(db);
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
  return db.auth;
}

function clearAuth() {
  const db = readDb();
  db.auth = { ...defaultData.auth };
  writeDb(db);
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
  return db.packingMetadata[shipmentId];
}

module.exports = {
  getSettings,
  updateSettings,
  getAuth,
  updateAuth,
  clearAuth,
  getPackingMetadata,
  updatePackingMetadata,
};
