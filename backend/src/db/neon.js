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
          note TEXT DEFAULT '',
          printed_at TIMESTAMP,
          packed_at TIMESTAMP,
          sku VARCHAR(255),
          buyer_name VARCHAR(255),
          order_id VARCHAR(100),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ml_scan_logs (
          id SERIAL PRIMARY KEY,
          barcode VARCHAR(255) NOT NULL,
          shipment_id VARCHAR(100),
          action VARCHAR(100),
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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

// Auth operations in Neon
async function getAuthFromNeon() {
  const p = getPool();
  if (!p) return null;
  try {
    await initNeonDb();
    const res = await p.query('SELECT * FROM ml_auth WHERE id = $1', ['default']);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      accessToken: row.access_token || '',
      refreshToken: row.refresh_token || '',
      expiresAt: row.expires_at ? Number(row.expires_at) : null,
      userId: row.user_id ? Number(row.user_id) : '',
      nickname: row.nickname || '',
      siteId: row.site_id || 'MLA',
      permalink: row.permalink || '',
    };
  } catch (e) {
    console.warn('Neon getAuth error:', e.message);
    return null;
  }
}

async function saveAuthToNeon(auth) {
  const p = getPool();
  if (!p) return;
  try {
    await initNeonDb();
    await p.query(
      `INSERT INTO ml_auth (id, access_token, refresh_token, expires_at, user_id, nickname, site_id, permalink, updated_at)
       VALUES ('default', $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         user_id = EXCLUDED.user_id,
         nickname = EXCLUDED.nickname,
         site_id = EXCLUDED.site_id,
         permalink = EXCLUDED.permalink,
         updated_at = CURRENT_TIMESTAMP`,
      [
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
        note: row.note || '',
        printedAt: row.printed_at ? row.printed_at.toISOString() : null,
        packedAt: row.packed_at ? row.packed_at.toISOString() : null,
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
      `INSERT INTO ml_packing_metadata (shipment_id, printed, packed, quality_checked, note, printed_at, packed_at, sku, buyer_name, order_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (shipment_id) DO UPDATE SET
         printed = EXCLUDED.printed,
         packed = EXCLUDED.packed,
         quality_checked = EXCLUDED.quality_checked,
         note = EXCLUDED.note,
         printed_at = EXCLUDED.printed_at,
         packed_at = EXCLUDED.packed_at,
         sku = EXCLUDED.sku,
         buyer_name = EXCLUDED.buyer_name,
         order_id = EXCLUDED.order_id,
         updated_at = CURRENT_TIMESTAMP`,
      [
        String(shipmentId),
        Boolean(data.printed),
        Boolean(data.packed),
        Boolean(data.qualityChecked),
        data.note || '',
        data.printedAt ? new Date(data.printedAt) : null,
        data.packedAt ? new Date(data.packedAt) : null,
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
};
