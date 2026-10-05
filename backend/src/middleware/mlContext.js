const store = require('../db/store');

/**
 * Phase 2 multi-user: resuelve el email dueño de la cuenta de Mercado Libre
 * para este request.
 *
 * - Web: `req.user` (sesión validada por `middleware/session.js`).
 * - Móvil: `req.device` (token de dispositivo atado a un email).
 * - Sin identidad: email del admin (legado de cuenta única, preserva el
 *   comportamiento actual hasta la Fase 4 que exigirá sesión).
 */
function resolveMlEmail(req) {
  if (req && req.user && req.user.email) {
    return String(req.user.email).trim().toLowerCase();
  }
  if (req && req.device && req.device.email) {
    return String(req.device.email).trim().toLowerCase();
  }
  return String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

module.exports = { resolveMlEmail };
