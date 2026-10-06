/**
 * Envío de correos de la plataforma.
 *
 * Dos transportes, en este orden de preferencia:
 *   1. Resend  → `RESEND_API_KEY`. Una sola API key, sin servidor SMTP.
 *   2. SMTP    → `SMTP_URL` (+ `SMTP_USER`/`SMTP_PASS`).
 *
 * Sin transporte configurado NO se finge el envío: se devuelve
 * `delivered: false` y el route lo dice explícitamente. Antes además se
 * exponía el código en la respuesta de la API, lo que era una puerta
 * trasera de autenticación (cualquiera con el endpoint podía ver el
 * código de otra persona).
 */

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM = String(process.env.RESEND_FROM || '').trim();
const SMTP_URL = String(process.env.SMTP_URL || '').trim();
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const MAIL_FROM = String(process.env.MAIL_FROM || RESEND_FROM || SMTP_USER || '').trim();
const MAIL_FROM_NAME = String(process.env.MAIL_FROM_NAME || 'Plataforma').trim();

const RESEND_API_BASE = 'https://api.resend.com';

/** `true` si hay algún transporte capaz de enviar. */
function isConfigured() {
  return Boolean(RESEND_API_KEY || SMTP_URL);
}

/** Qué transporte se usaría, para diagnostics y ajustes. */
function getTransport() {
  if (RESEND_API_KEY) return 'resend';
  if (SMTP_URL) return 'smtp';
  return 'none';
}

/** De qué dominio sale el correo: es lo que Resend exige tener verificado. */
function getSenderDomain() {
  if (RESEND_FROM && RESEND_FROM.includes('@')) return RESEND_FROM.split('@')[1];
  if (SMTP_USER && SMTP_USER.includes('@')) return SMTP_USER.split('@')[1];
  if (MAIL_FROM && MAIL_FROM.includes('@')) return MAIL_FROM.split('@')[1];
  return '';
}

async function sendWithResend({ to, subject, html, text, replyTo }) {
  const { Resend } = require('resend');
  const resend = new Resend(RESEND_API_KEY);

  const payload = {
    from: RESEND_FROM || `${MAIL_FROM_NAME} <${MAIL_FROM}>`,
    to: [to],
    subject,
    html,
    text,
  };
  // Reply-To con `base@<dominio>`: Resend usa el tag `+base` para aislar estas
  // plantillas de las de marketing de la misma cuenta (transactional vs bulk).
  if (replyTo) payload.reply_to = replyTo;

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(error.message || 'Resend rechazó el envío.');
  }
  return { id: data?.id || '' };
}

async function sendWithSmtp({ to, subject, html, text }) {
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport(SMTP_URL, {
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  const info = await transport.sendMail({
    from: MAIL_FROM_NAME ? `"${MAIL_FROM_NAME}" <${MAIL_FROM}>` : MAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  return { id: info.messageId || '' };
}

/**
 * Envía un correo ya renderizado.
 *
 * @param {{ to: string, subject: string, html: string, text: string, replyTo?: string }} mail
 * @returns {Promise<{ delivered: boolean, id?: string, transport?: string, reason?: string }>}
 */
async function sendMail(mail) {
  const transport = getTransport();
  if (transport === 'none') {
    return { delivered: false, reason: 'sin transporte de correo configurado' };
  }

  try {
    const result = transport === 'resend'
      ? await sendWithResend(mail)
      : await sendWithSmtp(mail);
    return { delivered: true, id: result.id, transport };
  } catch (err) {
    console.warn(`mailer (${transport}): no se pudo enviar a ${mail.to}:`, err.message);
    return { delivered: false, transport, reason: err.message };
  }
}

/**
 * Correo con el código de acceso de 6 dígitos.
 * @returns {Promise<{ delivered: boolean, reason?: string }>}
 */
async function sendAccessCode({ to, code, minutes = 15 }) {
  const { accessCodeEmail } = require('./mailTemplates');
  const mail = accessCodeEmail({ code, minutes });
  return sendMail({ to, ...mail });
}

/**
 * Aviso al SuperAdmin de que alguien pidió acceso.
 * @returns {Promise<{ delivered: boolean, reason?: string }>}
 */
async function sendAccessRequestNotice({ to, email, name }) {
  const { accessRequestEmail } = require('./mailTemplates');
  const domain = getSenderDomain();
  const mail = accessRequestEmail({ email, name });
  return sendMail({
    to,
    ...mail,
    replyTo: domain ? `base@${domain}` : undefined,
  });
}

/**
 * Estado de la configuración de correo, para Ajustes.
 * Nunca expone la API key: sólo si está definida.
 */
function getStatus() {
  return {
    configured: isConfigured(),
    transport: getTransport(),
    sender: MAIL_FROM,
    senderDomain: getSenderDomain(),
    hasSmtp: Boolean(SMTP_URL),
    hasResend: Boolean(RESEND_API_KEY),
    fromName: MAIL_FROM_NAME,
  };
}

module.exports = {
  isConfigured,
  getTransport,
  getStatus,
  sendMail,
  sendAccessCode,
  sendAccessRequestNotice,
};