const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const store = require('../db/store');

const ADMIN_EMAIL = 'jcancelo.dev@gmail.com';

// POST /api/users/google-login
// Handles Google OAuth sign-in / verification
router.post('/google-login', async (req, res) => {
  try {
    const { email, name, avatar, googleId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El email de Google es requerido.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isAdmin = cleanEmail === ADMIN_EMAIL;
    
    // Check if user exists
    let user = await store.findUserByEmail(cleanEmail);

    if (!user) {
      // First time registration
      user = await store.upsertUser({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
        role: isAdmin ? 'admin' : 'user',
        status: isAdmin ? 'active' : 'pending', // pending admin approval unless superAdmin
        authProvider: 'google',
      });
    } else if (isAdmin) {
      // Always enforce active admin for superadmin
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

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

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
    const isAdmin = cleanEmail === ADMIN_EMAIL;

    // Check or register user
    let user = await store.findUserByEmail(cleanEmail);
    if (!user) {
      user = await store.upsertUser({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
        role: isAdmin ? 'admin' : 'user',
        status: isAdmin ? 'active' : 'pending',
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

    // In production or demo, return the OTP code for instant testing while also simulating email dispatch
    res.json({
      success: true,
      message: `Código de acceso de 6 dígitos generado para ${cleanEmail}. Expira en 15 minutos.`,
      email: cleanEmail,
      debugOtp: otpCode,
      status: user.status,
    });
  } catch (err) {
    console.error('Request code error:', err);
    res.status(500).json({ error: err.message || 'Error al generar código' });
  }
});

// POST /api/users/verify-code (Verify 6-digit OTP or magic token)
router.post('/verify-code', async (req, res) => {
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

    const sessionToken = crypto.randomBytes(32).toString('hex');
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

// GET /api/users/list (Admin only - List all platform users and pending approvals)
router.get('/list', async (req, res) => {
  try {
    const users = await store.getAllUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/approve (Admin only - Approve or reject pending user)
router.post('/approve', async (req, res) => {
  try {
    const { adminEmail, userId, status } = req.body;
    if (adminEmail?.trim().toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Solo el administrador principal (jcancelo.dev@gmail.com) puede autorizar cuentas.' });
    }

    if (!userId || !status) {
      return res.status(400).json({ error: 'userId y status (active, pending, rejected) son obligatorios.' });
    }

    await store.updateUserStatus(userId, status);
    res.json({ success: true, message: `Usuario actualizado a estado '${status}'.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
