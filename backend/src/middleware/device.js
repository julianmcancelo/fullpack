const store = require('../db/store');
const { verificar, estaVencido } = require('../services/mobileTokens.service');

/**
 * Mobile device authentication.
 *
 * The phone never holds Mercado Libre credentials: it holds an opaque device
 * token issued by /api/pair/claim. `attachDevice` resolves that token on every
 * request but never rejects, so the existing web routes keep working exactly as
 * before. `/api/mobile/*` additionally requires `requireDevice`.
 */

function extractToken(req) {
  const header = req.get('X-Device-Token');
  if (header) return String(header).trim();

  const auth = req.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();

  if (typeof req.query.deviceToken === 'string') return req.query.deviceToken.trim();
  return '';
}

async function attachDevice(req, res, next) {
  req.device = null;
  req.mobileUser = null;

  const token = extractToken(req);
  if (!token) return next();

  try {
    let device = await store.getDeviceByToken(token);

    // Sin base compartida (o en una instancia nueva) el registro no aparece, pero el
    // token está firmado: se valida solo y el dispositivo sigue operativo.
    if (!device) {
      const ticket = verificar(token);
      if (ticket && ticket.k === 'device' && ticket.e && !estaVencido(ticket)) {
        device = {
          id: ticket.d || 'dispositivo',
          token,
          email: ticket.e,
          name: ticket.n || 'Dispositivo móvil',
          platform: ticket.p || 'android',
          appVersion: ticket.a || '',
          createdAt: null,
          lastSeenAt: null,
          revoked: false,
        };
      }
    }

    if (device) {
      req.device = device;
      req.mobileUser = await store.findUserByEmail(device.email);
      // Best effort: nunca bloquea un request porque falle el timestamp.
      store.touchDevice(device.id).catch(() => {});
    }
  } catch (e) {
    console.warn('attachDevice error:', e.message);
  }

  return next();
}

async function requireDevice(req, res, next) {
  if (!req.device) {
    return res.status(401).json({
      success: false,
      error: 'device_not_linked',
      message:
        'Este dispositivo no está vinculado. Abrí la web, entrá a Vincular celular y escaneá el código QR.',
    });
  }

  if (req.mobileUser && req.mobileUser.status && req.mobileUser.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'account_not_active',
      message: 'Tu cuenta no está autorizada para operar desde el celular.',
    });
  }

  return next();
}

module.exports = { attachDevice, requireDevice, extractToken };
