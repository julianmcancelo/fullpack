const store = require('../db/store');

/**
 * SaaS web sessions (Phase 1 multi-user).
 *
 * The browser sends `Authorization: Bearer <token>` (issued at login).
 * `requireSession` rejects without a valid session; `optionalSession`
 * attaches `req.user` when present but never rejects (for public pages).
 * Mobile keeps using device tokens (`middleware/device.js`), untouched.
 */

function extractSessionToken(req) {
  const auth = req.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  if (typeof req.query.sessionToken === 'string') return req.query.sessionToken.trim();
  return '';
}

async function resolveUser(req) {
  const token = extractSessionToken(req);
  if (!token) return null;
  const session = await store.getSessionByToken(token);
  if (!session) return null;
  const user = await store.findUserByEmail(session.email);
  if (!user) return null;
  return { user, session };
}

async function requireSession(req, res, next) {
  try {
    const resolved = await resolveUser(req);
    if (!resolved) {
      return res.status(401).json({
        success: false,
        error: 'not_authenticated',
        message: 'Iniciá sesión para continuar.',
      });
    }
    req.user = resolved.user;
    req.session = resolved.session;
    return next();
  } catch (e) {
    console.warn('requireSession error:', e.message);
    return res.status(401).json({
      success: false,
      error: 'not_authenticated',
      message: 'Iniciá sesión para continuar.',
    });
  }
}

async function optionalSession(req, res, next) {
  try {
    const resolved = await resolveUser(req);
    if (resolved) {
      req.user = resolved.user;
      req.session = resolved.session;
    }
  } catch (e) {
    /* best effort: public routes keep working */
  }
  return next();
}

/**
 * Exige rol de supervisor: `admin` o `superadmin`.
 *
 * Deliberadamente NO incluye la gestión de cuentas de la plataforma. Esa es
 * `requireSuperAdmin`.
 */
function requireAdmin(req, res, next) {
  if (!store.isSupervisor(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'Necesitás permisos de administrador para hacer esto.',
    });
  }
  return next();
}

/**
 * Exige rol `superadmin`: el dueño de la plataforma.
 *
 * Aprobar, rechazar, suspender, cambiar roles, revocar sesiones y resetear la
 * plataforma son acciones de SuperAdmin. Un `admin` (que supervisa la
 * operación de otros) queda fuera por diseño.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || !store.isSuperAdminEmail(req.user.email)) {
    return res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'Sólo el SuperAdmin puede gestionar las cuentas de la plataforma.',
    });
  }
  return next();
}

module.exports = {
  requireSession,
  optionalSession,
  requireAdmin,
  requireSuperAdmin,
  extractSessionToken,
};
