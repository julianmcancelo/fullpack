const crypto = require('crypto');
const { getSettings } = require('../db/store');

/**
 * Tokens firmados para el flujo mobile.
 *
 * En Vercel cada request puede caer en una instancia distinta y el proyecto puede no
 * tener base de datos (hoy es el caso: `/api/settings/database` responde
 * "Serverless Flash"). Guardar la sesión de vinculación y el token de dispositivo sólo
 * en `/tmp` hace que el flujo funcione a veces: si el `claim` cae en otra instancia, no
 * encuentra nada, y el token deja de valer apenas la instancia se recicla.
 *
 * Por eso el QR lleva un **ticket firmado** con el código, el email y el vencimiento, y
 * el dispositivo recibe un **token firmado**. Cualquier instancia los puede verificar sin
 * estado compartido. Si además hay base de datos, se sigue registrando todo ahí: el
 * camino con base tiene prioridad y conserva la revocación real.
 */

const PAIR_TICKET_TTL_MS = 10 * 60 * 1000; // 10 minutos
const DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 días

/**
 * Clave de firma. Se prefiere una variable de entorno propia; si no está, se usa el
 * `clientSecret` de la configuración, que ya viaja con el despliegue y es igual en todas
 * las instancias (no requiere configurar nada para que el flujo funcione).
 */
function signingKey() {
  const fromEnv = process.env.MOBILE_TOKEN_SECRET;
  if (fromEnv && String(fromEnv).trim().length >= 16) return String(fromEnv).trim();

  try {
    const settings = getSettings();
    if (settings && settings.clientSecret) return String(settings.clientSecret);
  } catch {
    // sin configuración disponible: se usa la clave de respaldo
  }
  return 'mlpro-mobile-fallback-signing-key';
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function firmar(payload) {
  const body = base64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/**
 * Devuelve el payload si la firma es válida; si no, `null`.
 * El vencimiento se consulta aparte con [estaVencido] para poder distinguir
 * "código inválido" de "código vencido" y dar un mensaje útil.
 */
function verificar(token) {
  if (!token || typeof token !== 'string') return null;

  const corte = token.lastIndexOf('.');
  if (corte <= 0) return null;

  const body = token.slice(0, corte);
  const mac = token.slice(corte + 1);

  const esperado = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}

/** `true` si el payload firmado ya venció. */
function estaVencido(payload) {
  return Boolean(payload && payload.exp && Date.now() > Number(payload.exp));
}

/** Ticket que viaja dentro del QR. */
function crearTicketVinculacion({ code, email }) {
  return firmar({
    v: 1,
    k: 'pair',
    c: code,
    e: String(email).trim().toLowerCase(),
    exp: Date.now() + PAIR_TICKET_TTL_MS,
  });
}

/** Token de dispositivo de larga duración. */
function crearTokenDispositivo({ deviceId, email, name, platform, appVersion }) {
  return firmar({
    v: 1,
    k: 'device',
    d: deviceId,
    e: String(email).trim().toLowerCase(),
    n: name || 'Dispositivo móvil',
    p: platform || 'android',
    a: appVersion || '',
    exp: Date.now() + DEVICE_TTL_MS,
  });
}

/** `true` si el string tiene forma de ticket firmado por nosotros. */
function pareceTicket(valor) {
  return typeof valor === 'string' && valor.includes('.') && valor.length > 40;
}

module.exports = {
  firmar,
  verificar,
  estaVencido,
  crearTicketVinculacion,
  crearTokenDispositivo,
  pareceTicket,
  PAIR_TICKET_TTL_MS,
  DEVICE_TTL_MS,
};
