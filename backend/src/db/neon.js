const { Pool } = require('pg');

let pool = null;
let isInitialized = false;

function getConnectionString() {
  return process.env.DATABASE_URL || 
         process.env.POSTGRES_URL || 
         process.env.POSTGRES_PRISMA_URL || 
         process.env.NEON_DATABASE_URL ||
         '';
}

function getPool() {
  const connectionString = getConnectionString();
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

async function initNeonDb() {
  const p = getPool();
  if (!p || isInitialized) return;

  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ml_settings (
          key VARCHAR(100) PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ml_auth (
          id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
          access_token TEXT,
          refresh_token TEXT,
          expires_at BIGINT,
          user_id BIGINT,
          nickname VARCHAR(200),
          site_id VARCHAR(20),
          permalink TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ml_packing_metadata (
          shipment_id VARCHAR(100) PRIMARY KEY,
          printed BOOLEAN DEFAULT FALSE,
          packed BOOLEAN DEFAULT FALSE,
          quality_checked BOOLEAN DEFAULT FALSE,
          dispatch_checked BOOLEAN DEFAULT FALSE,
          note TEXT DEFAULT '',
          status_override VARCHAR(50),
          printed_at TIMESTAMP,
          packed_at TIMESTAMP,
          first_scanned_at TIMESTAMP,
          last_scanned_at TIMESTAMP,
          dispatch_checked_at TIMESTAMP,
          scan_count INT DEFAULT 0,
          sku VARCHAR(255),
          buyer_name VARCHAR(255),
          order_id VARCHAR(100),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Add columns if table already exists
        DO $$ BEGIN
          ALTER TABLE ml_packing_metadata ADD COLUMN IF NOT EXISTS status_override VARCHAR(50);
          ALTER TABLE ml_packing_metadata ADD COLUMN IF NOT EXISTS dispatch_checked BOOLEAN DEFAULT FALSE;
          ALTER TABLE ml_packing_metadata ADD COLUMN IF NOT EXISTS dispatch_checked_at TIMESTAMP;
        EXCEPTION WHEN others THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS ml_scan_logs (
          id SERIAL PRIMARY KEY,
          barcode VARCHAR(255) NOT NULL,
          shipment_id VARCHAR(100),
          action VARCHAR(100),
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ml_users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          avatar TEXT,
          role VARCHAR(50) DEFAULT 'user', -- 'admin' or 'user'
          status VARCHAR(50) DEFAULT 'pending', -- 'active', 'pending', 'rejected'
          auth_provider VARCHAR(50) DEFAULT 'email', -- 'google' or 'email'
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ml_login_tokens (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          code VARCHAR(10) NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- SaaS web sessions: opaque tokens issued at login, validated on every
        -- authenticated request (Phase 1 multi-user: the backend knows who calls).
        CREATE TABLE IF NOT EXISTS ml_sessions (
          token VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS ml_sessions_email_idx ON ml_sessions (email);

        -- Phase 2 multi-user: ML credentials are keyed by user email instead of
        -- a single global row. Legacy single-account row is adopted in code.
        DO $$ BEGIN
          BEGIN
            ALTER TABLE ml_auth ADD COLUMN IF NOT EXISTS email VARCHAR(255);
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END $$;
        CREATE UNIQUE INDEX IF NOT EXISTS ml_auth_email_uidx ON ml_auth (email);

        -- Mobile device pairing: the web app creates a session and renders it as
        -- a QR code; the phone claims it and receives a long-lived device token.
        CREATE TABLE IF NOT EXISTS ml_pairing_sessions (
          code VARCHAR(12) PRIMARY KEY,
          secret VARCHAR(64) NOT NULL,
          email VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          device_id VARCHAR(100),
          device_name VARCHAR(255),
          device_platform VARCHAR(50),
          app_version VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          claimed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ml_devices (
          id VARCHAR(100) PRIMARY KEY,
          token VARCHAR(128) UNIQUE NOT NULL,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          platform VARCHAR(50),
          app_version VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_seen_at TIMESTAMP,
          revoked BOOLEAN DEFAULT FALSE
        );

        CREATE INDEX IF NOT EXISTS ml_devices_email_idx ON ml_devices (email);
        CREATE INDEX IF NOT EXISTS ml_pairing_created_idx ON ml_pairing_sessions (created_at);
      `);

      // Migration check for existing tables (ensure new columns exist)
      await client.query(`
        DO $$ 
        BEGIN
          BEGIN
            ALTER TABLE ml_users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
            ALTER TABLE ml_users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END $$;
      `);

      isInitialized = true;
      console.log(' Base de datos Neon PostgreSQL inicializada con éxito.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(' Error inicializando Neon PostgreSQL:', err.message);
  }
}

async function isNeonConnected() {
  const p = getPool();
  if (!p) return false;
  try {
    const client = await p.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

// Auth operations in Neon (Phase 2: keyed by user email)
function mapAuthRow(row) {
  if (!row) return null;
  return {
    email: row.email || '',
    accessToken: row.access_token || '',
    refreshToken: row.refresh_token || '',
    expiresAt: row.expires_at ? Number(row.expires_at) : null,
    userId: row.user_id ? Number(row.user_id) : '',
    nickname: row.nickname || '',
    siteId: row.site_id || 'MLA',
    permalink: row.permalink || '',
  };
}

async function getAuthFromNeon(email) {
  const p = getPool();
  if (!p) return null;
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    await initNeonDb();
    const res = await p.query('SELECT * FROM ml_auth WHERE email = $1', [cleanEmail]);
    if (res.rows.length > 0) return mapAuthRow(res.rows[0]);
    // One-time adoption: the legacy single-account row belongs to the admin.
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail && cleanEmail === adminEmail) {
      const legacy = await p.query('SELECT * FROM ml_auth WHERE id = $1', ['default']);
      if (legacy.rows.length > 0) {
        const adopted = mapAuthRow(legacy.rows[0]);
        await saveAuthToNeon(cleanEmail, adopted);
        return { ...adopted, email: cleanEmail };
      }
    }
    return null;
  } catch (e) {
    console.warn('Neon getAuth error:', e.message);
    return null;
  }
}

async function saveAuthToNeon(email, auth) {
  const p = getPool();
  if (!p) return;
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    await initNeonDb();
    await p.query(
      `INSERT INTO ml_auth (id, email, access_token, refresh_token, expires_at, user_id, nickname, site_id, permalink, updated_at)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (email) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         user_id = EXCLUDED.user_id,
         nickname = EXCLUDED.nickname,
         site_id = EXCLUDED.site_id,
         permalink = EXCLUDED.permalink,
         updated_at = CURRENT_TIMESTAMP`,
      [
        cleanEmail,
        auth.accessToken || '',
        auth.refreshToken || '',
        auth.expiresAt || null,
        auth.userId || null,
        auth.nickname || '',
        auth.siteId || 'MLA',
        auth.permalink || '',
      ]
    );
  } catch (e) {
    console.warn('Neon saveAuth error:', e.message);
  }
}

// Settings operations in Neon
async function getSettingsFromNeon() {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query('SELECT value FROM ml_settings WHERE key = $1', ['app_settings']);
    if (res.rows.length === 0) return null;
    return res.rows[0].value;
  } catch (e) {
    console.warn('Neon getSettings error:', e.message);
    return null;
  }
}

async function saveSettingsToNeon(settings) {
  const p = getPool();
  if (!p) return;
  try {
    await initNeonDb();
    await p.query(
      `INSERT INTO ml_settings (key, value, updated_at)
       VALUES ('app_settings', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(settings)]
    );
  } catch (e) {
    console.warn('Neon saveSettings error:', e.message);
  }
}

// Packing operations in Neon
async function getPackingMetadataFromNeon() {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query('SELECT * FROM ml_packing_metadata');
    const map = {};
    for (const row of res.rows) {
      map[row.shipment_id] = {
        printed: Boolean(row.printed),
        packed: Boolean(row.packed),
        qualityChecked: Boolean(row.quality_checked),
        dispatchChecked: Boolean(row.dispatch_checked),
        note: row.note || '',
        statusOverride: row.status_override || null,
        printedAt: row.printed_at ? row.printed_at.toISOString() : null,
        packedAt: row.packed_at ? row.packed_at.toISOString() : null,
        firstScannedAt: row.first_scanned_at ? row.first_scanned_at.toISOString() : null,
        lastScannedAt: row.last_scanned_at ? row.last_scanned_at.toISOString() : null,
        dispatchCheckedAt: row.dispatch_checked_at ? row.dispatch_checked_at.toISOString() : null,
        scanCount: Number(row.scan_count || 0),
        sku: row.sku || '',
        buyerName: row.buyer_name || '',
        orderId: row.order_id || '',
        updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
      };
    }
    return map;
  } catch (e) {
    console.warn('Neon getPacking error:', e.message);
    return null;
  }
}

async function savePackingMetadataToNeon(shipmentId, data) {
  const p = getPool();
  if (!p) return;
  try {
    await initNeonDb();
    await p.query(
      `INSERT INTO ml_packing_metadata (
         shipment_id, printed, packed, quality_checked, dispatch_checked, note, status_override,
         printed_at, packed_at, first_scanned_at, last_scanned_at, dispatch_checked_at, scan_count, 
         sku, buyer_name, order_id, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
       ON CONFLICT (shipment_id) DO UPDATE SET
         printed = EXCLUDED.printed,
         packed = EXCLUDED.packed,
         quality_checked = EXCLUDED.quality_checked,
         dispatch_checked = EXCLUDED.dispatch_checked,
         note = EXCLUDED.note,
         status_override = EXCLUDED.status_override,
         printed_at = EXCLUDED.printed_at,
         packed_at = EXCLUDED.packed_at,
         first_scanned_at = COALESCE(ml_packing_metadata.first_scanned_at, EXCLUDED.first_scanned_at),
         last_scanned_at = EXCLUDED.last_scanned_at,
         dispatch_checked_at = EXCLUDED.dispatch_checked_at,
         scan_count = EXCLUDED.scan_count,
         sku = EXCLUDED.sku,
         buyer_name = EXCLUDED.buyer_name,
         order_id = EXCLUDED.order_id,
         updated_at = CURRENT_TIMESTAMP`,
      [
        String(shipmentId),
        Boolean(data.printed),
        Boolean(data.packed),
        Boolean(data.qualityChecked),
        Boolean(data.dispatchChecked),
        data.note || '',
        data.statusOverride || null,
        data.printedAt ? new Date(data.printedAt) : null,
        data.packedAt ? new Date(data.packedAt) : null,
        data.firstScannedAt ? new Date(data.firstScannedAt) : (data.packedAt ? new Date(data.packedAt) : null),
        data.lastScannedAt ? new Date(data.lastScannedAt) : new Date(),
        data.dispatchCheckedAt ? new Date(data.dispatchCheckedAt) : null,
        Number(data.scanCount || 1),
        data.sku || null,
        data.buyerName || null,
        data.orderId || null,
      ]
    );
  } catch (e) {
    console.warn('Neon savePacking error:', e.message);
  }
}

// Scan log operations in Neon
async function logScanToNeon(barcode, shipmentId, action, details = {}) {
  const p = getPool();
  if (!p) return;
  try {
    await initNeonDb();
    await p.query(
      `INSERT INTO ml_scan_logs (barcode, shipment_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [barcode, shipmentId || null, action, JSON.stringify(details)]
    );
  } catch (e) {
    console.warn('Neon logScan error:', e.message);
  }
}

async function getRecentScanLogsFromNeon(limit = 50) {
  const p = getPool();
  if (!p) return [];
  try {
    await initNeonDb();
    const res = await p.query(
      'SELECT * FROM ml_scan_logs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return res.rows.map(r => ({
      id: r.id,
      barcode: r.barcode,
      shipmentId: r.shipment_id,
      action: r.action,
      details: r.details,
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.warn('Neon getScanLogs error:', e.message);
    return [];
  }
}

// SaaS Multi-user and Approval Operations
async function findUserByEmailInNeon(email) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query('SELECT * FROM ml_users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      avatar: r.avatar,
      role: r.role,
      status: r.status,
      authProvider: r.auth_provider,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    };
  } catch (e) {
    console.warn('Neon findUserByEmail error:', e.message);
    return null;
  }
}

async function getAllUsersFromNeon() {
  const p = getPool();
  if (!p) return [];
  try {
    await initNeonDb();
    const res = await p.query('SELECT * FROM ml_users ORDER BY id ASC');
    return res.rows.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      avatar: r.avatar,
      role: r.role,
      status: r.status,
      authProvider: r.auth_provider,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    }));
  } catch (e) {
    console.warn('Neon getAllUsers error:', e.message);
    return [];
  }
}

async function upsertUserInNeon({ email, name, avatar, role = 'user', status = 'pending', authProvider = 'email' }) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const cleanEmail = email.trim().toLowerCase();

    const res = await p.query(
      `INSERT INTO ml_users (email, name, avatar, role, status, auth_provider, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, ml_users.name),
         avatar = COALESCE(EXCLUDED.avatar, ml_users.avatar),
         last_login_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [cleanEmail, name, avatar || null, role, status, authProvider]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      avatar: r.avatar,
      role: r.role,
      status: r.status,
      authProvider: r.auth_provider,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    };
  } catch (e) {
    console.warn('Neon upsertUser error:', e.message);
    return null;
  }
}

async function updateUserStatusInNeon(userId, newStatus) {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    await p.query('UPDATE ml_users SET status = $1 WHERE id = $2', [newStatus, userId]);
    return true;
  } catch (e) {
    console.warn('Neon updateUserStatus error:', e.message);
    return false;
  }
}

async function createLoginTokenInNeon(email, code, token, expireMinutes = 15) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);
    await p.query(
      `INSERT INTO ml_login_tokens (email, code, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email.trim().toLowerCase(), code, token, expiresAt]
    );
    return { email, code, token, expiresAt };
  } catch (e) {
    console.warn('Neon createLoginToken error:', e.message);
    return null;
  }
}

async function verifyLoginTokenInNeon(email, codeOrToken) {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    const cleanEmail = email.trim().toLowerCase();
    const res = await p.query(
      `SELECT * FROM ml_login_tokens 
       WHERE LOWER(email) = LOWER($1) 
         AND (code = $2 OR token = $2)
         AND used = FALSE 
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, codeOrToken.trim()]
    );

    if (res.rows.length === 0) return false;

    // Mark as used
    await p.query('UPDATE ml_login_tokens SET used = TRUE WHERE id = $1', [res.rows[0].id]);
    return true;
  } catch (e) {
    console.warn('Neon verifyLoginToken error:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// SaaS web sessions (Phase 1 multi-user)
// ---------------------------------------------------------------------------
async function createSessionInNeon(email, daysValid = 30) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + daysValid * 24 * 3600 * 1000);
    await p.query(
      'INSERT INTO ml_sessions (token, email, expires_at) VALUES ($1, $2, $3)',
      [String(email).trim().toLowerCase(), token, expiresAt]
    );
    return { email: String(email).trim().toLowerCase(), token, expiresAt };
  } catch (e) {
    console.warn('Neon createSession error:', e.message);
    return null;
  }
}

async function getSessionFromNeon(token) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query(
      'SELECT * FROM ml_sessions WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [String(token || '').trim()]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return { email: r.email, token: r.token, expiresAt: r.expires_at };
  } catch (e) {
    console.warn('Neon getSession error:', e.message);
    return null;
  }
}

async function deleteSessionFromNeon(token) {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    await p.query('DELETE FROM ml_sessions WHERE token = $1', [String(token || '').trim()]);
    return true;
  } catch (e) {
    console.warn('Neon deleteSession error:', e.message);
    return false;
  }
}

async function clearAuthInNeon(email) {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    await p.query('DELETE FROM ml_auth WHERE email = $1', [String(email || '').trim().toLowerCase()]);
    return true;
  } catch (e) {
    console.warn('Neon clearAuth error:', e.message);
    return false;
  }
}

async function purgeExpiredSessionsInNeon() {
  const p = getPool();
  if (!p) return;
  try {
    await initNeonDb();
    await p.query('DELETE FROM ml_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
  } catch (e) {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Mobile pairing sessions & device tokens
// ---------------------------------------------------------------------------
function mapPairingRow(row) {
  if (!row) return null;
  return {
    code: row.code,
    secret: row.secret,
    email: row.email,
    status: row.status,
    deviceId: row.device_id || null,
    deviceName: row.device_name || null,
    devicePlatform: row.device_platform || null,
    appVersion: row.app_version || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
  };
}

function mapDeviceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    token: row.token,
    email: row.email,
    name: row.name || 'Dispositivo móvil',
    platform: row.platform || 'android',
    appVersion: row.app_version || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    revoked: Boolean(row.revoked),
  };
}

async function createPairingSessionInNeon({ code, secret, email, expiresAt }) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query(
      `INSERT INTO ml_pairing_sessions (code, secret, email, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (code) DO UPDATE SET
         secret = EXCLUDED.secret,
         email = EXCLUDED.email,
         status = 'pending',
         device_id = NULL,
         device_name = NULL,
         device_platform = NULL,
         app_version = NULL,
         claimed_at = NULL,
         created_at = CURRENT_TIMESTAMP,
         expires_at = EXCLUDED.expires_at
       RETURNING *`,
      [code, secret, String(email).trim().toLowerCase(), expiresAt]
    );
    return mapPairingRow(res.rows[0]);
  } catch (e) {
    console.warn('Neon createPairingSession error:', e.message);
    return null;
  }
}

async function getPairingSessionFromNeon(code) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query('SELECT * FROM ml_pairing_sessions WHERE code = $1', [code]);
    return mapPairingRow(res.rows[0]);
  } catch (e) {
    console.warn('Neon getPairingSession error:', e.message);
    return null;
  }
}

// Race-safe: only the first claimer of a pending, unexpired code wins.
async function claimPairingSessionInNeon(code, { deviceId, deviceName, devicePlatform, appVersion }) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query(
      `UPDATE ml_pairing_sessions
       SET status = 'claimed',
           device_id = $2,
           device_name = $3,
           device_platform = $4,
           app_version = $5,
           claimed_at = CURRENT_TIMESTAMP
       WHERE code = $1
         AND status = 'pending'
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING *`,
      [code, deviceId, deviceName, devicePlatform, appVersion || null]
    );
    return mapPairingRow(res.rows[0]);
  } catch (e) {
    console.warn('Neon claimPairingSession error:', e.message);
    return null;
  }
}

async function createDeviceInNeon({ id, token, email, name, platform, appVersion }) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query(
      `INSERT INTO ml_devices (id, token, email, name, platform, app_version, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, token, String(email).trim().toLowerCase(), name, platform, appVersion || null]
    );
    return mapDeviceRow(res.rows[0]);
  } catch (e) {
    console.warn('Neon createDevice error:', e.message);
    return null;
  }
}

async function getDeviceByTokenFromNeon(token) {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query(
      'SELECT * FROM ml_devices WHERE token = $1 AND revoked = FALSE',
      [token]
    );
    return mapDeviceRow(res.rows[0]);
  } catch (e) {
    console.warn('Neon getDeviceByToken error:', e.message);
    return null;
  }
}

async function listDevicesFromNeon(email) {
  const p = getPool();
  if (!p) return [];
  try {
    await initNeonDb();
    const res = await p.query(
      'SELECT * FROM ml_devices WHERE LOWER(email) = LOWER($1) AND revoked = FALSE ORDER BY created_at DESC',
      [String(email).trim()]
    );
    return res.rows.map(mapDeviceRow);
  } catch (e) {
    console.warn('Neon listDevices error:', e.message);
    return [];
  }
}

async function deleteDeviceFromNeon(id) {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    const res = await p.query(
      `UPDATE ml_devices SET revoked = TRUE WHERE id = $1 OR token = $1`,
      [String(id)]
    );
    return res.rowCount > 0;
  } catch (e) {
    console.warn('Neon deleteDevice error:', e.message);
    return false;
  }
}

async function touchDeviceInNeon(id) {
  const p = getPool();
  if (!p) return;
  try {
    await initNeonDb();
    await p.query('UPDATE ml_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  } catch (e) {
    /* best effort */
  }
}

async function purgeExpiredPairingSessionsInNeon() {
  const p = getPool();
  if (!p) return;
  try {
    await initNeonDb();
    await p.query(
      `DELETE FROM ml_pairing_sessions
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2 days'`
    );
  } catch (e) {
    /* best effort */
  }
}

// Reset total: limpiar todo el auth (todas las cuentas ML)
async function clearAllAuthInNeon() {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    await p.query('DELETE FROM ml_auth');
    return true;
  } catch (e) {
    console.warn('Neon clearAllAuth error:', e.message);
    return false;
  }
}

// Reset total: limpiar todas las sesiones
async function clearAllSessionsInNeon() {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    await p.query('DELETE FROM ml_sessions');
    return true;
  } catch (e) {
    console.warn('Neon clearAllSessions error:', e.message);
    return false;
  }
}

// Reset total: limpiar todos los usuarios excepto el admin
async function clearAllUsersInNeon() {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail) {
      await p.query('DELETE FROM ml_users WHERE LOWER(email) != LOWER($1)', [adminEmail]);
    } else {
      await p.query('DELETE FROM ml_users');
    }
    return true;
  } catch (e) {
    console.warn('Neon clearAllUsers error:', e.message);
    return false;
  }
}

// Reset total: limpiar metadata de empaque
async function clearPackingMetadataInNeon() {
  const p = getPool();
  if (!p) return false;
  try {
    await initNeonDb();
    await p.query('DELETE FROM ml_packing_metadata');
    return true;
  } catch (e) {
    console.warn('Neon clearPackingMetadata error:', e.message);
    return false;
  }
}

module.exports = {
  getConnectionString,
  initNeonDb,
  isNeonConnected,
  getAuthFromNeon,
  saveAuthToNeon,
  getSettingsFromNeon,
  saveSettingsToNeon,
  getPackingMetadataFromNeon,
  savePackingMetadataToNeon,
  logScanToNeon,
  getRecentScanLogsFromNeon,
  findUserByEmailInNeon,
  getAllUsersFromNeon,
  upsertUserInNeon,
  updateUserStatusInNeon,
  createLoginTokenInNeon,
  verifyLoginTokenInNeon,
  createSessionInNeon,
  getSessionFromNeon,
  deleteSessionFromNeon,
  clearAuthInNeon,
  clearAllAuthInNeon,
  purgeExpiredSessionsInNeon,
  clearAllSessionsInNeon,
  clearAllUsersInNeon,
  clearPackingMetadataInNeon,
  createPairingSessionInNeon,
  getPairingSessionInNeon,
  claimPairingSessionInNeon,
  createDeviceInNeon,
  getDeviceByTokenFromNeon,
  listDevicesFromNeon,
  deleteDeviceFromNeon,
  touchDeviceInNeon,
  purgeExpiredPairingSessionsInNeon,
};
