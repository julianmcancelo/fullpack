const store = require('../db/store');

/**
 * Supervisión de cuentas: permite que un Admin (o el SuperAdmin) opere la
 * cuenta de Mercado Libre de otro usuario.
 *
 * El llamante declara a quién está mirando con la cabecera `X-Acting-User`
 * (o el query `actingUser`). Aquí se valida que:
 *   1. tenga sesión,
 *   2. sea supervisor (`admin` o `superadmin`) — un usuario común no puede,
 *   3. la cuenta destino exista y esté `active`.
 *
 * Sólo se usa en las rutas de datos de la operación (stock, órdenes, envíos,
 * preguntas, stats). Deliberadamente NO en `/api/auth/*`: un Admin no debe
 * poder vincular ni desconectar la cuenta de Mercado Libre de otro.
 */
const ACTING_HEADER = 'x-acting-user';

function readRequestedEmail(req) {
  const fromHeader = String(req.get(ACTING_HEADER) || '').trim();
  const fromQuery = typeof req.query?.actingUser === 'string' ? req.query.actingUser.trim() : '';
  return (fromHeader || fromQuery).toLowerCase();
}

async function resolveActingUser(req, res, next) {
  const requested = readRequestedEmail(req);
  if (!requested) return next();

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'not_authenticated',
      message: 'Iniciá sesión para supervisar otra cuenta.',
    });
  }

  if (!store.isSupervisor(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'Necesitás permisos de administrador para supervisar otra cuenta.',
    });
  }

  const own = String(req.user.email).trim().toLowerCase();
  if (requested === own) {
    // Supervisar la cuenta propia es lo mismo que operar: se ignora.
    return next();
  }

  let target;
  try {
    target = await store.findUserByEmail(requested);
  } catch (err) {
    return res.status(503).json({
      success: false,
      error: 'service_unavailable',
      message: 'No pudimos verificar la cuenta a supervisar. Intentá en unos segundos.',
    });
  }

  if (!target) {
    return res.status(404).json({
      success: false,
      error: 'not_found',
      message: 'Esa cuenta no existe en la plataforma.',
    });
  }

  if (target.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'account_not_active',
      message: `La cuenta ${requested} está ${target.status}: no se puede operar.`,
    });
  }

  req.actingUser = {
    email: requested,
    name: target.name || '',
    nickname: target.nickname || '',
    isSelf: false,
  };
  return next();
}

module.exports = { resolveActingUser, ACTING_HEADER };