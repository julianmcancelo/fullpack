const store = require('../db/store');

/**
 * Fase 2 multi-user: resuelve el email dueño de la cuenta de Mercado Libre
 * para este request.
 *
 * Orden de precedencia:
 * - `req.actingUser`: un supervisor (Admin o SuperAdmin) operando la cuenta de
 *   otro usuario. Lo valida `middleware/actingUser.js` antes de llegar acá.
 * - Web: `req.user` (sesión validada por `middleware/session.js`).
 * - Móvil: `req.device` (token de dispositivo atado a un email).
 * - Sin identidad: email del SuperAdmin (legado de cuenta única).
 */
function resolveMlEmail(req) {
  if (req && req.actingUser && req.actingUser.email) {
    return String(req.actingUser.email).trim().toLowerCase();
  }
  if (req && req.user && req.user.email) {
    return String(req.user.email).trim().toLowerCase();
  }
  if (req && req.device && req.device.email) {
    return String(req.device.email).trim().toLowerCase();
  }
  return String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

/**
 * Email de la cuenta que realmente se está operando: la supervisionada si
 * hay, si no la propia. Es lo que la UI necesita para rotular la pantalla
 * ("Estás viendo la cuenta de ...").
 */
function resolveEffectiveOwnerEmail(req) {
  if (req && req.actingUser && req.actingUser.email) {
    return String(req.actingUser.email).trim().toLowerCase();
  }
  return resolveMlEmail(req);
}

module.exports = { resolveMlEmail, resolveEffectiveOwnerEmail };