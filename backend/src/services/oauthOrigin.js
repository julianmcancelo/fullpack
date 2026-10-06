/**
 * Resolución del origen público y de la URL de retorno de OAuth (Mercado Libre).
 *
 * El `redirect_uri` que se le manda a Mercado Libre tiene que coincidir
 * **exactamente** con el registrado en el panel del desarrollador, y debe
 * apuntar a `/api/auth/callback`. Durante el desarrollo se usó
 * `https://httpbin.org/get` como placeholder: con ese valor Mercado Libre
 * devolvía el código a un servicio de terceros y el callback nunca se
 * ejecutaba, así que la autorización "funcionaba" pero no conectaba nada.
 *
 * Estos helpers dejan de depender de ese valor escrito a mano:
 *   1. `ML_REDIRECT_URI` si está definido (fija el de producción).
 *   2. El valor guardado en Ajustes, si es utilizable.
 *   3. El callback derivado del origen real de la petición.
 *
 * En Vercel el origen no sale de `req.protocol` (sin `trust proxy` sería
 * `http`), por eso se leen las cabeceras que reenvía el proxy.
 */

// Valores que sirven para probar pero que NO pueden usarse como `redirect_uri`
// de OAuth: nunca alcanzan nuestro callback.
const PLACEHOLDER_REDIRECT_URIS = [
  'httpbin.org',
  'localhost:5173',
  'localhost:3001',
  'localhost',
];

/**
 * ¿Este `redirect_uri` sirve para el flujo real?
 * @param {string} value
 * @returns {boolean}
 */
function isUsableRedirectUri(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const lower = raw.toLowerCase();
  return !PLACEHOLDER_REDIRECT_URIS.some((host) => lower.includes(host));
}

/**
 * Origen público desde el que el usuario está usando la app.
 * @param {import('express').Request} req
 * @returns {string} origen sin barra final, o '' si no se puede determinar
 */
function getPublicOrigin(req) {
  const explicit = String(process.env.ML_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;

  const headers = req?.headers || {};
  const forwardedHost = String(headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = String(forwardedHost || headers.host || '').trim();
  if (!host) return '';

  const forwardedProto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${proto}://${host}`;
}

/**
 * URL completa del callback de OAuth para la petición actual.
 * @param {import('express').Request} req
 * @returns {string}
 */
function getCallbackUrl(req) {
  const origin = getPublicOrigin(req);
  return origin ? `${origin}/api/auth/callback` : '';
}

/**
 * `redirect_uri` efectiva para hablar con Mercado Libre.
 * @param {import('express').Request} [req]
 * @returns {string} '' si no hay forma de construir una
 */
function resolveRedirectUri(req) {
  // La variable de entorno tiene prioridad, pero tampoco puede ser un
  // placeholder: `ML_REDIRECT_URI=https://httpbin.org/get` en el panel de
  // Vercel fue justamente lo que dejó el OAuth sin conectar.
  const fromEnv = String(process.env.ML_REDIRECT_URI || '').trim();
  if (isUsableRedirectUri(fromEnv)) return fromEnv;
  if (fromEnv) {
    console.warn(
      `[oauth] ML_REDIRECT_URI="${fromEnv}" no es utilizable como redirect_uri; se usa el callback del dominio actual.`
    );
  }

  // `require` diferido: este módulo lo usa `store`, que a su vez lo usa.
  const { getSettings } = require('../db/store');
  const stored = getSettings().redirectUri;
  if (isUsableRedirectUri(stored)) return String(stored).trim();

  return getCallbackUrl(req);
}

/**
 * A dónde mandar al usuario cuando el callback terminó (no el `redirect_uri`
 * de Mercado Libre: es una URL interna de nuestra SPA).
 * @param {import('express').Request} req
 * @param {{ success?: boolean, error?: string }} [result]
 * @returns {string}
 */
function getPostAuthRedirect(req, result = {}) {
  const origin = getPublicOrigin(req);
  // Sin origen no hay a dónde volver: el propio callback es un destino válido.
  if (!origin) return '/api/auth/callback';
  if (result.error) {
    return `${origin}/?auth_error=${encodeURIComponent(result.error)}`;
  }
  if (result.success) {
    return `${origin}/?auth_success=1`;
  }
  return `${origin}/`;
}

module.exports = {
  resolveRedirectUri,
  getPostAuthRedirect,
};