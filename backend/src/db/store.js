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
  getDatabaseStatus,
};
