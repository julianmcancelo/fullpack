const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const store = require('../db/store');
const neon = require('../db/neon');
const mailer = require('../services/mailer');
const { requireSession, requireAdmin } = require('../middleware/session');

// POST /api/users/google-login
// Handles Google OAuth sign-in / verification
router.post('/google-login', async (req, res) => {
  try {
    // Sin base compartida no hay sesiones válidas: mejor un 503 explícito
    // (el frontend reintenta) que un token que va a dar 401 después.
    if (!(await neon.isNeonConnected())) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Base de datos no disponible. Intentá en unos segundos.',
      });
    }
  } catch {
    return res.status(503).json({
      error: 'service_unavailable',
      message: 'Base de datos no disponible. Intentá en unos segundos.',
    });
  }

  try {
    const { email, name, avatar, googleId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El email de Google es requerido.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isAdmin = store.isAdminEmail(cleanEmail);
    const existentes = await store.getAllUsers();
    const esPrimero = !existentes || existentes.length === 0;

    // Check if user exists
    let user = await store.findUserByEmail(cleanEmail);

    if (!user) {
      // First time registration
      user = await store.upsertUser({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        avatar: avatar || '',
        role: (isAdmin || esPrimero) ? 'admin' : 'user',
        status: (isAdmin || esPrimero) ? 'active' : 'pending',
        authProvider: 'google',
      });
    } else if (isAdmin) {
      // Enforce active admin for the configured admin account
      user.role = 'admin';
      user.status = 'active';
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'pending_approval',
        message: 'Tu cuenta ha sido registrada y se encuentra pendiente de autorización por administración.',
        user,
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'account_rejected',
        message: 'Tu acceso a la plataforma no ha sido autorizado. Contacta a administración.',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'account_suspended',
        message: 'Tu cuenta está suspendida. Contacta a administración para reactivarla.',
      });
    }

    // Generate session token (persisted: validated on every request)
    const session = await store.createSession(cleanEmail);
    const sessionToken = session.token;

    res.json({
      success: true,
      user,
      token: sessionToken,
      message: 'Inicio de sesión exitoso',
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: err.message || 'Error en autenticación Google' });
  }
});

// POST /api/users/request-code (Send magic 6-digit OTP code to email)
router.post('/request-code', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isAdmin = store.isAdminEmail(cleanEmail);
    const existentes = await store.getAllUsers();
    const esPrimero = !existentes || existentes.length === 0;

    // Check or register user
    let user = await store.findUserByEmail(cleanEmail);
    if (!user) {
      user = await store.upsertUser({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        avatar: '',
        role: (isAdmin || esPrimero) ? 'admin' : 'user',
        status: (isAdmin || esPrimero) ? 'active' : 'pending',
        authProvider: 'email',
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'account_rejected',
        message: 'Tu cuenta ha sido rechazada o suspendida.',
      });
    }

    // Generate 6-digit OTP code and secret token
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomBytes(24).toString('hex');

    await store.createLoginToken(cleanEmail, otpCode, token, 15);

    // Envío real del correo. Sin transporte configurado NO se dice "enviado":
    // se devuelve el código para que el usuario pueda entrar igual.
    const mail = await mailer.sendAccessCode({ to: cleanEmail, code: otpCode, minutes: 15 });

    const allowDebugOtp = process.env.ALLOW_DEBUG_OTP === 'true';
    const payload = {
      success: true,
      message: mail.delivered
        ? `Código de acceso enviado a ${cleanEmail}. Expira en 15 minutos.`
        : `Código de acceso generado para ${cleanEmail}. Expira en 15 minutos.`,
      email: cleanEmail,
      status: user.status,
    };

    if (!mail.delivered || allowDebugOtp) {
      payload.code = otpCode;
      payload.deliveredByEmail = mail.delivered;
      if (!mail.delivered) {
        payload.notice =
          'El envío de correo no está configurado en el servidor, por eso te mostramos el código acá.';
      }
    }
    res.json(payload);
  } catch (err) {
    console.error('Request code error:', err);
    res.status(500).json({ error: err.message || 'Error al generar código' });
  }
});

// POST /api/users/verify-code (Verify 6-digit OTP or magic token)
router.post('/verify-code', async (req, res) => {
  try {
    if (!(await neon.isNeonConnected())) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Base de datos no disponible. Intentá en unos segundos.',
      });
    }
  } catch {
    return res.status(503).json({ error: 'service_unavailable', message: 'Base de datos no disponible.' });
  }

  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email y código son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isValid = await store.verifyLoginToken(cleanEmail, code);

    if (!isValid) {
      return res.status(400).json({ error: 'El código de seguridad es inválido o ha expirado.' });
    }

    const user = await store.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'pending_approval',
        message: 'Tu código es correcto, pero tu cuenta está esperando la autorización por administración.',
        user,
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'account_suspended',
        message: 'Tu cuenta está suspendida. Contacta a administración para reactivarla.',
        user,
      });
    }

    // Real persisted session (validated on every request)
    const session = await store.createSession(cleanEmail);
    const sessionToken = session.token;
    res.json({
      success: true,
      user,
      token: sessionToken,
      message: 'Autenticación exitosa',
    });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ error: err.message || 'Error al verificar código' });
  }
});

// GET /api/users/me (who am I, from a valid session)
router.get('/me', requireSession, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/users/logout (revoke current session)
router.post('/logout', requireSession, async (req, res) => {
  try {
    await store.deleteSession(req.session.token);
  } catch {}
  res.json({ success: true, message: 'Sesión cerrada.' });
});

// GET /api/users/list (Admin only - List all platform users and pending approvals)
router.get('/list', requireSession, requireAdmin, async (req, res) => {
  try {
    const users = await store.getAllUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// SuperAdmin: administración de la plataforma (distinta de operar una cuenta
// de Mercado Libre). Todo exige requireSession + requireAdmin.
// ---------------------------------------------------------------------------

const VALID_STATUS = ['active', 'pending', 'rejected', 'suspended'];

// GET /api/users/overview (SuperAdmin) - KPIs y estado de la plataforma
router.get('/overview', requireSession, requireAdmin, async (req, res) => {
  try {
    const overview = await store.getPlatformOverview();
    const db = await store.getDatabaseStatus();
    res.json({ success: true, ...overview, database: db });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/status (SuperAdmin) - suspender / reactivar / rechazar
router.patch('/:id/status', requireSession, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({
        error: `Estado inválido. Valores permitidos: ${VALID_STATUS.join(', ')}.`,
      });
    }

    const { id } = req.params;
    const users = await store.getAllUsers();
    const target = users.find((u) => String(u.id) === String(id));
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (status === 'suspended') {
      const result = await store.setUserSuspended(id, true, (email) =>
        store.revokeAllSessions(email),
      );
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.json({
        success: true,
        message: `Cuenta de ${target.email} suspendida. Se revocaron ${result.revokedSessions} sesión(es).`,
        user: result.user,
      });
    }

    await store.updateUserStatus(id, status);
    res.json({
      success: true,
      message: `Cuenta de ${target.email} actualizada a '${status}'.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/role (SuperAdmin) - promover o degradar a admin
router.patch('/:id/role', requireSession, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: "Rol inválido. Valores: 'admin' o 'user'." });
    }
    const result = await store.updateUserRole(req.params.id, role);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({
      success: true,
      message: `Rol de ${result.user.email} actualizado a '${role}'.`,
      user: result.user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:id/revoke-sessions (SuperAdmin) - cerrar sesiones y equipos
router.post('/:id/revoke-sessions', requireSession, requireAdmin, async (req, res) => {
  try {
    const users = await store.getAllUsers();
    const target = users.find((u) => String(u.id) === String(req.params.id));
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const revoked = await store.revokeAllSessions(target.email);
    res.json({
      success: true,
      message: `Se cerraron ${revoked} sesión(es) y sus dispositivos de ${target.email}.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/approve (Admin only - Approve or reject pending user)
router.post('/approve', requireSession, requireAdmin, async (req, res) => {
  try {
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'userId y status (active, pending, rejected) son obligatorios.' });
    }

    await store.updateUserStatus(userId, status);
    res.json({ success: true, message: `Usuario actualizado a estado '${status}'.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/reset-platform (SuperAdmin only)
// Deja la plataforma como recién creada: sin cuentas de Mercado Libre, sin
// sesiones, sin packing previo y con un único usuario (el admin).
// Es una acción destructiva e irreversible.
router.post('/reset-platform', requireSession, requireAdmin, async (req, res) => {
  try {
    const result = await store.factoryResetAll();
    res.json({
      success: true,
      message: 'Plataforma reseteada. Todos deben vincular su cuenta de Mercado Libre de nuevo.',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
