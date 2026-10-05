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

function requireAdmin(req, res, next) {
  const user = req.user;
  const isAdmin = Boolean(
    user && (user.role === 'admin' || store.isAdminEmail(user.email))
  );
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'Solo la cuenta administradora puede hacer esto.',
    });
  }
  return next();
}

module.exports = { requireSession, optionalSession, requireAdmin, extractSessionToken };
