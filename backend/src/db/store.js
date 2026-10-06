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
    appId: '',
    clientSecret: '',
    redirectUri: '',
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
  users: [],
  loginTokens: [],
  pairingSessions: [],
  devices: [],
  sessions: [],
};

// In-memory cache for ultra-fast response
let inMemoryCache = null;

/**
 * Lee un JSON tolerando el BOM UTF-8.
 *
 * Un editor que guarde el archivo como "UTF-8 con BOM" (PowerShell 5.1 lo hace por
 * defecto con `Set-Content -Encoding UTF8`) rompía `JSON.parse`, el servidor caía a
 * los valores por defecto y el primer guardado **borraba** la configuración, los
 * tokens de Mercado Libre y el historial de empaque. Ya pasó una vez.
 */
function parseJsonFile(file, raw) {
  return JSON.parse(String(raw).replace(/^\uFEFF/, ''));
}

/** Copia de seguridad antes de tocar un archivo que no se pudo interpretar. */
function backupUnreadableFile(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const backup = `${file}.unreadable-${Date.now()}`;
    fs.copyFileSync(file, backup);
    console.error(`store.json ilegible: se guardó una copia en ${backup}`);
    return backup;
  } catch (e) {
    console.error('No se pudo respaldar store.json:', e.message);
    return null;
  }
}

function getInitialData() {
  try {
    if (fs.existsSync(BUNDLED_DB_FILE)) {
      const raw = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
      return parseJsonFile(BUNDLED_DB_FILE, raw);
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
    const parsed = parseJsonFile(DB_FILE, raw);
    inMemoryCache = {
      ...parsed,
      settings: parsed.settings || { ...defaultData.settings },
      auth: parsed.auth || { ...defaultData.auth },
      packingMetadata: parsed.packingMetadata || {},
      scanLogs: parsed.scanLogs || [],
      users: parsed.users || [],
      loginTokens: parsed.loginTokens || [],
      pairingSessions: parsed.pairingSessions || [],
      devices: parsed.devices || [],
      sessions: parsed.sessions || [],
      authByEmail: parsed.authByEmail || {},
    };
    return inMemoryCache;
  } catch (err) {
    // NUNCA reemplazar en silencio los datos del usuario: se respalda el archivo
    // ilegible antes de que cualquier guardado posterior lo pise.
    console.error('Error leyendo store.json, se respalda antes de continuar:', err.message);
    backupUnreadableFile(DB_FILE);
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

// Background sync from Neon if available.
// NOTA: no se deduce "reset" del store local: un usuario nuevo sin credenciales
// locales NO puede implicar que Neon deba vaciarse. El reset se dispara solo si
// el store bundleado trae el flag explícito `pendingFactoryReset`, que se apaga
// en cuanto se ejecuta.
(async () => {
  try {
    const db0 = readDb();

    if (db0.pendingFactoryReset) {
      const result = await factoryResetAll();
      console.log('[store] reset de plataforma ejecutado:', JSON.stringify(result.neon));
      return;
    }

    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const neonAuth = adminEmail ? await neon.getAuthFromNeon(adminEmail) : null;
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
  const settings = { ...(db.settings || {}) };
  if (!settings.appId && process.env.ML_APP_ID) settings.appId = process.env.ML_APP_ID;
  if (!settings.clientSecret && process.env.ML_CLIENT_SECRET) settings.clientSecret = process.env.ML_CLIENT_SECRET;
  if (!settings.redirectUri && process.env.ML_REDIRECT_URI) settings.redirectUri = process.env.ML_REDIRECT_URI;
  return settings;
}

function isAdminEmail(email) {
  const cfg = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!cfg && String(email || '').trim().toLowerCase() === cfg;
}

function updateSettings(newSettings) {
  const db = readDb();
  db.settings = { ...db.settings, ...newSettings };
  writeDb(db);
  neon.saveSettingsToNeon(db.settings).catch(() => {});
  return db.settings;
}

function emptyAuth() {
  return { ...defaultData.auth };
}

// Phase 2 multi-user: credenciales de ML por email de cuenta.
// Sin email se usa el legado global (compatibilidad: instancia de una cuenta).
async function getAuthAsync(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail) {
    try {
      const neonAuth = await neon.getAuthFromNeon(cleanEmail);
      if (neonAuth && neonAuth.accessToken) return neonAuth;
    } catch {}
    const db = readDb();
    const local = (db.authByEmail || {})[cleanEmail];
    if (local && local.accessToken) return local;
  }
  return getAuth();
}

function getAuth() {
  const db = readDb();
  return db.auth;
}

async function updateAuthAsync(email, newAuth) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return updateAuth(newAuth);
  try {
    await neon.saveAuthToNeon(cleanEmail, { ...emptyAuth(), ...newAuth });
  } catch (e) {
    console.warn('Neon saveAuth failed:', e.message);
  }
  const db = readDb();
  if (!db.authByEmail) db.authByEmail = {};
  db.authByEmail[cleanEmail] = { ...(db.authByEmail[cleanEmail] || emptyAuth()), ...newAuth };
  writeDb(db);
  return db.authByEmail[cleanEmail];
}

function updateAuth(newAuth) {
  const db = readDb();
  db.auth = { ...db.auth, ...newAuth };
  writeDb(db);
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail) neon.saveAuthToNeon(adminEmail, db.auth).catch(() => {});
  return db.auth;
}

async function clearAuthAsync(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return clearAuth();
  try {
    await neon.clearAuthInNeon(cleanEmail);
  } catch {}
  const db = readDb();
  if (db.authByEmail) {
    delete db.authByEmail[cleanEmail];
    writeDb(db);
  }
  return emptyAuth();
}

function clearAuth() {
  const db = readDb();
  db.auth = { ...defaultData.auth };
  writeDb(db);
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail) neon.clearAuthInNeon(adminEmail).catch(() => {});
  return db.auth;
}

/**
 * Reset total y explícito (solo SuperAdmin): deja la plataforma como recién
 * creada — sin cuentas de Mercado Libre, sin sesiones y sinpacking previo —
 * conservando únicamente la cuenta administradora.
 *
 * A diferencia del sync del arranque, acá sí se vacía Neon: es una orden
 * explícita del administrador, no una inferencia.
 */
async function factoryResetAll() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  // 1) Neon: se inicializa el esquema antes de borrar (si las tablas no
  //    existen, los DELETE fallarían y los datos quedarían intactos).
  await neon.initNeonDb().catch(() => {});

  const neonResults = {
    auth: await neon.clearAllAuthInNeon().catch(() => false),
    sessions: await neon.clearAllSessionsInNeon().catch(() => false),
    users: await neon.clearAllUsersInNeon().catch(() => false),
    packing: await neon.clearPackingMetadataInNeon().catch(() => false),
  };

  // 2) Store local (incluye /tmp en serverless): todo limpio + solo el admin.
  const db = readDb();
  db.auth = { ...defaultData.auth };
  db.authByEmail = {};
  db.packingMetadata = {};
  db.scanLogs = [];
  db.loginTokens = [];
  db.pairingSessions = [];
  db.devices = [];
  db.sessions = [];
  db.users = adminEmail
    ? [
        {
          id: 1,
          email: adminEmail,
          name: 'Administrador',
          avatar: '',
          role: 'admin',
          status: 'active',
          authProvider: 'email',
          createdAt: new Date().toISOString(),
        },
      ]
    : [];
  // El flag es de un solo uso: se apaga en cuanto el reset se aplicó.
  db.pendingFactoryReset = false;
  writeDb(db);

  return { success: true, neon: neonResults, keptAdmin: adminEmail || null };
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

// Persists to Neon and WAITS for the write (required on serverless: the function
// may be frozen right after responding, losing fire-and-forget writes).
async function updatePackingMetadataAsync(shipmentId, updates) {
  await refreshPackingFromNeon();
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
  try {
    await neon.savePackingMetadataToNeon(shipmentId, db.packingMetadata[shipmentId]);
  } catch (e) {
    console.warn('Neon persist packing failed:', e.message);
  }
  return db.packingMetadata[shipmentId];
}

// Pulls the latest packing state from Neon (source of truth shared by all instances).
async function refreshPackingFromNeon() {
  try {
    const neonPacking = await neon.getPackingMetadataFromNeon();
    if (neonPacking && Object.keys(neonPacking).length > 0) {
      const db = readDb();
      db.packingMetadata = { ...(db.packingMetadata || {}), ...neonPacking };
      writeDb(db);
    }
  } catch (e) {
    // fall back to local cache
  }
  return getPackingMetadata();
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
  try { await neon.logScanToNeon(barcode, shipmentId, action, details); } catch (e) {}
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
  if (!db.users) db.users = [];

  const local = db.users.find(u => String(u.email || '').toLowerCase() === cleanEmail);
  return local || null;
}

async function upsertUser({ email, name, avatar, role = 'user', status = 'pending', authProvider = 'email' }) {
  const cleanEmail = (email || '').trim().toLowerCase();

  let userResult = null;
  try {
    userResult = await neon.upsertUserInNeon({
      email: cleanEmail,
      name,
      avatar: avatar || '',
      role,
      status,
      authProvider,
    });
  } catch (e) {
    console.warn('Neon upsertUser fallback:', e.message);
  }

  const db = readDb();
  if (!db.users) db.users = [];

  const existingIdx = db.users.findIndex(u => String(u.email || '').toLowerCase() === cleanEmail);
  const userObj = userResult || {
    id: existingIdx >= 0 ? db.users[existingIdx].id : Date.now(),
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    avatar: avatar || '',
    role,
    status,
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
  if (!db.users) db.users = [];
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

/**
 * Actualiza el rol de un usuario (`admin` | `user`).
 * El SuperAdmin no se puede degradar a sí mismo.
 */
async function updateUserRole(userId, newRole) {
  const db = readDb();
  const user = (db.users || []).find((u) => String(u.id) === String(userId));
  if (!user) return { ok: false, error: 'Usuario no encontrado' };
  if (isAdminEmail(user.email) && newRole !== 'admin') {
    return { ok: false, error: 'No podés quitarte a vos mismo el rol de administrador.' };
  }
  user.role = newRole === 'admin' ? 'admin' : 'user';
  writeDb(db);
  try {
    await neon.updateUserRoleInNeon(userId, user.role);
  } catch (e) {
    console.warn('Neon updateUserRole fallback:', e.message);
  }
  return { ok: true, user };
}

/** Suspende o reactiva una cuenta. Al suspender se revocan sus sesiones vivas. */
async function setUserSuspended(userId, suspended, sessionsOf) {
  const db = readDb();
  const user = (db.users || []).find((u) => String(u.id) === String(userId));
  if (!user) return { ok: false, error: 'Usuario no encontrado' };
  if (isAdminEmail(user.email)) {
    return { ok: false, error: 'No podés suspender la cuenta administradora.' };
  }

  user.status = suspended ? 'suspended' : 'active';
  writeDb(db);
  await updateUserStatus(userId, user.status);

  // Un usuario suspendido no debe conservar una sesión abierta.
  let revoked = 0;
  if (suspended && typeof sessionsOf === 'function') {
    revoked = await sessionsOf(user.email);
  }
  return { ok: true, user, revokedSessions: revoked };
}

/** Revoca todas las sesiones de un email (apertura y dispositivos). */
async function revokeAllSessions(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return 0;
  let revoked = 0;

  try {
    await neon.query('DELETE FROM ml_sessions WHERE LOWER(email) = LOWER($1)', [clean]);
    revoked += 1;
  } catch (e) {
    console.warn('revokeAllSessions (web):', e.message);
  }
  try {
    await neon.query('UPDATE ml_devices SET revoked = TRUE WHERE LOWER(email) = LOWER($1)', [clean]);
  } catch (e) {
    console.warn('revokeAllSessions (devices):', e.message);
  }

  const db = readDb();
  const before = (db.sessions || []).length;
  db.sessions = (db.sessions || []).filter((s) => s.email !== clean);
  writeDb(db);

  return Math.max(revoked, before - db.sessions.length);
}

/**
 * Resumen de plataforma para el SuperAdmin: conteos por estado, cuentas de
 * Mercado Libre vinculadas y sesiones activas.
 */
async function getPlatformOverview() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const users = await getAllUsers();

  const byStatus = { active: 0, pending: 0, rejected: 0, suspended: 0 };
  let linkedAccounts = 0;
  const accounts = [];

  for (const u of users) {
    if (byStatus[u.status] !== undefined) byStatus[u.status] += 1;
    let nickname = '';
    let linked = false;
    try {
      const auth = await neon.getAuthFromNeon(u.email);
      if (auth && auth.accessToken) {
        linked = true;
        nickname = auth.nickname || '';
      }
    } catch {
      /* sin datos de ML: se reporta como no vinculado */
    }
    if (linked) linkedAccounts += 1;
    accounts.push({ email: u.email, linked, nickname, isSuperAdmin: u.email === adminEmail });
  }

  let activeSessions = 0;
  try {
    const r = await neon.query(
      'SELECT COUNT(*)::int AS n FROM ml_sessions WHERE expires_at > CURRENT_TIMESTAMP',
      []
    );
    activeSessions = r.rows[0]?.n || 0;
  } catch {
    activeSessions = 0;
  }

  return {
    totalUsers: users.length,
    byStatus,
    linkedAccounts,
    activeSessions,
    superAdminEmail: adminEmail,
    accounts,
  };
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

// ---------------------------------------------------------------------------
// SaaS web sessions (Phase 1 multi-user): opaque Bearer tokens.
// Neon is the source of truth; local JSON is the offline fallback.
// ---------------------------------------------------------------------------
async function createSession(email, daysValid = 30) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  // La sesión debe vivir en Neon: es el único almacén compartido entre
  // instancias serverless. Un token guardado solo en la memoria de esta
  // instancia sería válido acá y 401 en la siguiente petición.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await neon.createSessionInNeon(cleanEmail, daysValid);
      if (!created) continue;

      // Verificación de escritura: si el token no se puede leer de vuelta,
      // la escritura no quedó y no hay que entregarlo.
      const readBack = await neon.getSessionFromNeon(created.token);
      if (readBack && readBack.email === cleanEmail) return created;

      console.warn(`createSession: escritura no verificable (intento ${attempt + 1}/3)`);
    } catch (e) {
      console.warn(`createSession: ${e.message} (intento ${attempt + 1}/3)`);
    }
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }

  // Sin base compartida no hay sesión válida posible: es preferible fallar
  // que devolver un token que va a producir 401 al siguiente request.
  throw new Error('No se pudo abrir la sesión (base de datos no disponible). Intentá de nuevo.');
}

async function getSessionByToken(token) {
  const clean = String(token || '').trim();
  if (!clean) return null;
  try {
    const neonSession = await neon.getSessionFromNeon(clean);
    if (neonSession) return neonSession;
  } catch (e) {
    console.warn('Neon getSession fallback:', e.message);
  }
  const db = readDb();
  const found = (db.sessions || []).find(
    (s) => s.token === clean && new Date(s.expiresAt).getTime() > Date.now()
  );
  return found || null;
}

async function deleteSession(token) {
  const clean = String(token || '').trim();
  try {
    await neon.deleteSessionFromNeon(clean);
  } catch (e) {
    console.warn('Neon deleteSession fallback:', e.message);
  }
  const db = readDb();
  if (db.sessions) {
    db.sessions = db.sessions.filter((s) => s.token !== clean);
    writeDb(db);
  }
  return true;
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

// ---------------------------------------------------------------------------
// Mobile pairing sessions & device tokens
// Neon is the source of truth (the phone and the web may hit different
// serverless instances); the local JSON store is the offline fallback.
// ---------------------------------------------------------------------------
async function createPairingSession({ code, secret, email, expiresAt }) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  try {
    const neonSession = await neon.createPairingSessionInNeon({
      code,
      secret,
      email: cleanEmail,
      expiresAt: new Date(expiresAt),
    });
    if (neonSession) return neonSession;
  } catch (e) {
    console.warn('Neon createPairingSession fallback:', e.message);
  }

  const db = readDb();
  if (!db.pairingSessions) db.pairingSessions = [];
  const session = {
    code,
    secret,
    email: cleanEmail,
    status: 'pending',
    deviceId: null,
    deviceName: null,
    devicePlatform: null,
    appVersion: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    claimedAt: null,
  };
  db.pairingSessions = db.pairingSessions.filter((s) => s.code !== code);
  db.pairingSessions.push(session);
  if (db.pairingSessions.length > 100) db.pairingSessions = db.pairingSessions.slice(-100);
  writeDb(db);
  return session;
}

async function getPairingSession(code) {
  try {
    const neonSession = await neon.getPairingSessionFromNeon(code);
    if (neonSession) return neonSession;
  } catch (e) {
    console.warn('Neon getPairingSession fallback:', e.message);
  }
  const db = readDb();
  return (db.pairingSessions || []).find((s) => s.code === code) || null;
}

async function claimPairingSession(code, device) {
  try {
    const neonClaimed = await neon.claimPairingSessionInNeon(code, device);
    if (neonClaimed) return neonClaimed;
  } catch (e) {
    console.warn('Neon claimPairingSession fallback:', e.message);
  }

  const db = readDb();
  const session = (db.pairingSessions || []).find((s) => s.code === code);
  if (!session) return null;
  const stillValid =
    session.status === 'pending' && new Date(session.expiresAt).getTime() > Date.now();
  if (!stillValid) return null;

  session.status = 'claimed';
  session.deviceId = device.deviceId;
  session.deviceName = device.deviceName;
  session.devicePlatform = device.devicePlatform;
  session.appVersion = device.appVersion || null;
  session.claimedAt = new Date().toISOString();
  writeDb(db);
  return session;
}

async function createDevice({ id, token, email, name, platform, appVersion }) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  try {
    const neonDevice = await neon.createDeviceInNeon({
      id,
      token,
      email: cleanEmail,
      name,
      platform,
      appVersion,
    });
    if (neonDevice) return neonDevice;
  } catch (e) {
    console.warn('Neon createDevice fallback:', e.message);
  }

  const db = readDb();
  if (!db.devices) db.devices = [];
  const device = {
    id,
    token,
    email: cleanEmail,
    name: name || 'Dispositivo móvil',
    platform: platform || 'android',
    appVersion: appVersion || '',
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    revoked: false,
  };
  db.devices.push(device);
  writeDb(db);
  return device;
}

async function getDeviceByToken(token) {
  try {
    const neonDevice = await neon.getDeviceByTokenFromNeon(token);
    if (neonDevice) return neonDevice;
  } catch (e) {
    console.warn('Neon getDeviceByToken fallback:', e.message);
  }
  const db = readDb();
  return (db.devices || []).find((d) => d.token === token && !d.revoked) || null;
}

async function listDevices(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  try {
    const neonDevices = await neon.listDevicesFromNeon(cleanEmail);
    if (neonDevices && neonDevices.length > 0) return neonDevices;
  } catch (e) {
    console.warn('Neon listDevices fallback:', e.message);
  }
  const db = readDb();
  return (db.devices || []).filter((d) => d.email === cleanEmail && !d.revoked);
}

async function deleteDevice(id) {
  try {
    await neon.deleteDeviceFromNeon(id);
  } catch (e) {
    console.warn('Neon deleteDevice fallback:', e.message);
  }
  const db = readDb();
  let removed = false;
  if (db.devices) {
    db.devices = db.devices.map((d) => {
      if (d.id === id || d.token === id) {
        removed = true;
        return { ...d, revoked: true };
      }
      return d;
    });
    writeDb(db);
  }
  return removed;
}

async function touchDevice(id) {
  try {
    await neon.touchDeviceInNeon(id);
  } catch (e) {
    /* best effort */
  }
  const db = readDb();
  const device = (db.devices || []).find((d) => d.id === id);
  if (device) {
    device.lastSeenAt = new Date().toISOString();
    writeDb(db);
  }
}

module.exports = {
  getSettings,
  isAdminEmail,
  updateSettings,
  getAuth,
  updateAuth,
  clearAuth,
  factoryResetAll,
  getPackingMetadata,
  updatePackingMetadata,
  updatePackingMetadataAsync,
  refreshPackingFromNeon,
  addScanLog,
  getScanLogs,
  findUserByEmail,
  upsertUser,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  setUserSuspended,
  revokeAllSessions,
  getPlatformOverview,
  createLoginToken,
  verifyLoginToken,
  getDatabaseStatus,
  createSession,
  getSessionByToken,
  deleteSession,
  getAuthAsync,
  updateAuthAsync,
  clearAuthAsync,
  createPairingSession,
  getPairingSession,
  claimPairingSession,
  createDevice,
  getDeviceByToken,
  listDevices,
  deleteDevice,
  touchDevice,
};
