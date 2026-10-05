const express = require('express');
const router = express.Router();
const {
  getAuthUrl,
  exchangeCodeForToken,
  saveManualToken,
  refreshAccessToken,
  checkConnectionStatus,
} = require('../services/mlAuth.service');
const { clearAuthAsync } = require('../db/store');
const { optionalSession, requireSession } = require('../middleware/session');
const { resolveMlEmail } = require('../middleware/mlContext');

// Todas las rutas resuelven el email ML del llamante (sesión web o dispositivo
// móvil). Sin identidad se usa el legado de cuenta única (Fase 2).
router.use(optionalSession);

// GET /api/auth/status
router.get('/status', async (req, res) => {
  try {
    const status = await checkConnectionStatus(resolveMlEmail(req));
    res.json(status);
  } catch (err) {
    res.json({
      connected: false,
      message: 'No hay conexión activa con Mercado Libre o el token ha expirado.',
      error: err.message,
    });
  }
});

// GET /api/auth/url (embebe `state` con la sesión para atar los tokens al usuario)
router.get('/url', (req, res) => {
  try {
    const state = req.session ? req.session.token : '';
    const url = getAuthUrl(state);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/exchange-code (Direct code exchange)
router.post('/exchange-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'El código de autorización es requerido.' });
    }
    const cleanCode = code.trim().replace(/^code=/, '');
    const result = await exchangeCodeForToken(cleanCode, resolveMlEmail(req));
    res.json({ success: true, auth: result });
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error_description || err.message;
    res.status(400).json({ error: `Error al canjear código: ${msg}` });
  }
});

// GET /api/auth/callback (Mercado Libre OAuth redirect)
// El `state` trae el session token de quien inició el flujo: los tokens
// quedan guardados bajo SU email, no en una cuenta global.
router.get('/callback', async (req, res) => {
  const { code, error, error_description, state } = req.query;
  const host = req.get('host') || '';
  const base = host.includes('localhost') ? 'http://localhost:5173' : `https://${host}`;

  if (error) {
    return res.redirect(`${base}/settings?auth_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.status(400).send('No se proporcionó el código de autorización de Mercado Libre.');
  }

  try {
    const store = require('../db/store');
    let email = '';
    if (state) {
      const session = await store.getSessionByToken(String(state));
      if (session) email = session.email;
    }
    if (!email) {
      return res.redirect(
        `${base}/settings?auth_error=${encodeURIComponent('Sesión expirada. Volvé a la app e iniciá de nuevo la conexión.')}`
      );
    }
    await exchangeCodeForToken(code, email);
    res.redirect(`${base}/settings?auth_success=true`);
  } catch (err) {
    console.error('Callback error:', err.response?.data || err.message);
    const msg = err.response?.data?.message || err.message;
    res.redirect(`${base}/settings?auth_error=${encodeURIComponent(msg)}`);
  }
});

// POST /api/auth/manual-token (Direct Access Token paste, cuenta propia)
router.post('/manual-token', requireSession, async (req, res) => {
  try {
    const { accessToken, refreshToken, userId } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'El Access Token es obligatorio.' });
    }
    const result = await saveManualToken(accessToken, refreshToken, userId, req.user.email);
    res.json(result);
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ error: `Token inválido: ${msg}` });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshed = await refreshAccessToken(resolveMlEmail(req));
    res.json({ success: true, auth: refreshed });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// POST /api/auth/disconnect (desvincula TU cuenta de ML)
router.post('/disconnect', async (req, res) => {
  try {
    await clearAuthAsync(resolveMlEmail(req));
    res.json({ success: true, message: 'Cuenta de Mercado Libre desvinculada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
