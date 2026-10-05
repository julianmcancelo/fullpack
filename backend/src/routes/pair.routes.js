const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const store = require('../db/store');
const neon = require('../db/neon');
const {
  verificar,
  estaVencido,
  crearTicketVinculacion,
  crearTokenDispositivo,
  pareceTicket,
} = require('../services/mobileTokens.service');

/**
 * QR device pairing.
 *
 *   1. The signed-in web app calls POST /api/pair/create and renders qrPayload
 *      as a QR code.
 *   2. The Android app scans it and calls POST /api/pair/claim, receiving a
 *      long-lived device token bound to that user.
 *   3. The web app polls GET /api/pair/status to confirm the link.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 look-alikes
const CODE_LENGTH = 6;
const PAIRING_TTL_MINUTES = 10;

function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function generateSecret() {
  return crypto.randomBytes(24).toString('hex');
}

function generateDeviceToken() {
  return `mld_${crypto.randomBytes(32).toString('hex')}`;
}

function generateDeviceId() {
  return `dev_${crypto.randomBytes(8).toString('hex')}`;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Absolute API base URL, so the phone knows where to talk to. */
function apiBaseFrom(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3001';
  return `${proto}://${host}/api`;
}

function buildQrPayload({ code, secret, apiBase, email }) {
  return JSON.stringify({
    v: 1,
    t: 'mlpro-pair',
    c: code,
    s: secret,
    a: apiBase,
    u: email,
  });
}

function isExpired(session) {
  return !session?.expiresAt || new Date(session.expiresAt).getTime() <= Date.now();
}

// POST /api/pair/create  { email }
router.post('/create', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'El email del usuario es obligatorio.' });
    }

    const user = await store.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (user.status && user.status !== 'active') {
      return res.status(403).json({ error: 'Tu cuenta no está autorizada para vincular dispositivos.' });
    }

    const code = generateCode();
    const secret = generateSecret();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000).toISOString();
    const apiBase = apiBaseFrom(req);

    // El QR lleva un ticket firmado: cualquier instancia lo puede verificar aunque no
    // haya base de datos compartida ni caché en común.
    const ticket = crearTicketVinculacion({ code, email: user.email });

    // La sesión en la base (si existe) es lo que permite que la web confirme en vivo y
    // que el código sea de un solo uso.
    await store.createPairingSession({ code, secret, email: user.email, expiresAt });

    res.json({
      success: true,
      code,
      secret,
      ticket,
      expiresAt,
      expiresInSeconds: PAIRING_TTL_MINUTES * 60,
      apiBase,
      email: user.email,
      qrPayload: buildQrPayload({ code, secret: ticket, apiBase, email: user.email }),
    });
  } catch (err) {
    console.error('pair/create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pair/status?code=XXXXXX&secret=...
router.get('/status', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    const secret = String(req.query.secret || '').trim();
    if (!code || !secret) {
      return res.status(400).json({ error: 'code y secret son obligatorios.' });
    }

    const session = await store.getPairingSession(code);
    const porBaseCompartida = Boolean(session && timingSafeEqual(session.secret, secret));

    // El ticket firmado sirve para validar el código aunque no haya estado compartido.
    const ticketTexto = porBaseCompartida
      ? null
      : (pareceTicket(secret) ? secret : String(req.query.ticket || '').trim());
    const ticket = ticketTexto ? verificar(ticketTexto) : null;
    const ticketValido = Boolean(
      ticket && ticket.k === 'pair' && String(ticket.c || '').toUpperCase() === code,
    );

    /**
     * Señal honesta para la web: `true` sólo si hay almacenamiento COMPARTIDO entre
     * instancias (Neon). El archivo `/tmp` de Vercel sirve dentro de una misma instancia
     * —por eso el sondeo a veces acierta— pero no garantiza la confirmación en vivo.
     */
    const almacenCompartido = Boolean(neon.getConnectionString());

    if (!porBaseCompartida && !ticketValido) {
      return res.status(404).json({ error: 'Sesión de vinculación no encontrada.', status: 'invalid' });
    }

    if (!porBaseCompartida && estaVencido(ticket)) {
      return res.json({
        success: true,
        status: 'expired',
        code,
        dbAvailable: almacenCompartido,
        expiresAt: new Date(ticket.exp).toISOString(),
      });
    }

    if (porBaseCompartida && session.status === 'claimed') {
      const device = session.deviceId
        ? (await store.listDevices(session.email)).find((d) => d.id === session.deviceId)
        : null;
      const user = await store.findUserByEmail(session.email);
      return res.json({
        success: true,
        status: 'claimed',
        code,
        dbAvailable: almacenCompartido,
        expiresAt: session.expiresAt,
        claimedAt: session.claimedAt,
        user,
        device: device || {
          id: session.deviceId,
          name: session.deviceName,
          platform: session.devicePlatform,
          email: session.email,
        },
      });
    }

    if (porBaseCompartida && isExpired(session)) {
      return res.json({
        success: true,
        status: 'expired',
        code,
        dbAvailable: almacenCompartido,
        expiresAt: session.expiresAt,
      });
    }

    res.json({
      success: true,
      status: 'pending',
      code,
      // `false` = sin almacenamiento compartido: la web avisa y deja de sondear en vez
      // de quedarse girando esperando una confirmación que no puede llegar.
      dbAvailable: almacenCompartido,
      expiresAt: porBaseCompartida
        ? session.expiresAt
        : new Date(Number(ticket.exp)).toISOString(),
      qrPayload: buildQrPayload({
        code,
        secret: porBaseCompartida ? session.secret : secret,
        apiBase: apiBaseFrom(req),
        email: porBaseCompartida ? session.email : ticket.e,
      }),
    });
  } catch (err) {
    console.error('pair/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pair/claim  { code, secret, deviceName, platform, appVersion, deviceId }
router.post('/claim', async (req, res) => {
  try {
    const {
      code: rawCode,
      secret: rawSecret,
      deviceName,
      platform = 'android',
      appVersion = '',
      deviceId: providedDeviceId,
    } = req.body || {};

    const code = String(rawCode || '').trim().toUpperCase();
    const secret = String(rawSecret || '').trim();

    if (!code || !secret) {
      return res.status(400).json({ error: 'El código y la clave del QR son obligatorios.' });
    }

    // Camino 1: sesión en base compartida → permite un solo uso y confirmación en vivo.
    const session = await store.getPairingSession(code);
    const porBaseCompartida = Boolean(session && timingSafeEqual(session.secret, secret));

    // Camino 2: ticket firmado dentro del QR → funciona sin estado compartido (Vercel
    // sin base de datos reparte los requests entre instancias distintas).
    const ticket = porBaseCompartida ? null : verificar(secret);
    const ticketValido = Boolean(
      ticket && ticket.k === 'pair' && String(ticket.c || '').toUpperCase() === code && ticket.e,
    );

    if (!porBaseCompartida && !ticketValido) {
      return res.status(404).json({
        error: 'invalid_code',
        message: 'El código QR no es válido. Generá uno nuevo desde la web.',
      });
    }

    if (!porBaseCompartida && ticketValido && estaVencido(ticket)) {
      return res.status(410).json({
        error: 'expired_code',
        message: 'El código QR venció. Generá uno nuevo desde la web.',
      });
    }

    if (porBaseCompartida) {
      if (session.status === 'claimed') {
        return res.status(409).json({
          error: 'already_claimed',
          message: 'Este código QR ya fue usado. Generá uno nuevo desde la web.',
        });
      }

      if (isExpired(session)) {
        return res.status(410).json({
          error: 'expired_code',
          message: 'El código QR venció. Generá uno nuevo desde la web.',
        });
      }
    }

    const emailVinculado = porBaseCompartida ? session.email : ticket.e;
    const user = await store.findUserByEmail(emailVinculado);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'El usuario ya no existe.' });
    }
    if (user.status && user.status !== 'active') {
      return res.status(403).json({
        error: 'account_not_active',
        message: 'Tu cuenta todavía no está autorizada por administración.',
      });
    }

    const deviceId = providedDeviceId || generateDeviceId();
    const nombreDispositivo = deviceName || 'Celular de ' + (user.name || user.email);

    // El token es un ticket firmado: cualquier instancia lo valida sin consultar estado.
    const deviceToken = crearTokenDispositivo({
      deviceId,
      email: user.email,
      name: nombreDispositivo,
      platform,
      appVersion,
    });

    if (porBaseCompartida) {
      await store.claimPairingSession(code, {
        deviceId,
        deviceName: nombreDispositivo,
        devicePlatform: platform,
        appVersion,
      });
    }

    const device = await store.createDevice({
      id: deviceId,
      token: deviceToken,
      email: user.email,
      name: nombreDispositivo,
      platform,
      appVersion,
    });

    res.json({
      success: true,
      deviceToken,
      device,
      user,
      apiBase: apiBaseFrom(req),
      serverTime: new Date().toISOString(),
      message: `Dispositivo vinculado como ${user.name || user.email}.`,
    });
  } catch (err) {
    console.error('pair/claim error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pair/devices?email=...
router.get('/devices', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'El email es obligatorio.' });
    const devices = await store.listDevices(email);
    res.json({
      success: true,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        platform: d.platform,
        appVersion: d.appVersion,
        createdAt: d.createdAt,
        lastSeenAt: d.lastSeenAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pair/devices/:id
router.delete('/devices/:id', async (req, res) => {
  try {
    const removed = await store.deleteDevice(req.params.id);
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
