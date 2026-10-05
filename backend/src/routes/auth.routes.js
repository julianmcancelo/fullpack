const express = require('express');
const router = express.Router();
const {
  getAuthUrl,
  exchangeCodeForToken,
  saveManualToken,
  refreshAccessToken,
  checkConnectionStatus,
  clearAuth,
} = require('../services/mlAuth.service');

// GET /api/auth/status
router.get('/status', async (req, res) => {
  try {
    const status = await checkConnectionStatus();
    res.json(status);
  } catch (err) {
    res.json({
      connected: false,
      message: 'No hay conexión activa con Mercado Libre o el token ha expirado.',
      error: err.message,
    });
  }
});

// GET /api/auth/url
router.get('/url', (req, res) => {
  try {
    const url = getAuthUrl();
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
    const result = await exchangeCodeForToken(cleanCode);
    res.json({ success: true, auth: result });
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error_description || err.message;
    res.status(400).json({ error: `Error al canjear código: ${msg}` });
  }
});

// GET /api/auth/callback (Mercado Libre OAuth redirect)
router.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  const host = req.get('host') || '';
  const base = host.includes('localhost') ? 'http://localhost:5173' : `https://${host}`;

  if (error) {
    return res.redirect(`${base}/settings?auth_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.status(400).send('No se proporcionó el código de autorización de Mercado Libre.');
  }

  try {
    await exchangeCodeForToken(code);
    res.redirect(`${base}/settings?auth_success=true`);
  } catch (err) {
    console.error('Callback error:', err.response?.data || err.message);
    const msg = err.response?.data?.message || err.message;
    res.redirect(`${base}/settings?auth_error=${encodeURIComponent(msg)}`);
  }
});

// POST /api/auth/manual-token (Direct Access Token paste)
router.post('/manual-token', async (req, res) => {
  try {
    const { accessToken, refreshToken, userId } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'El Access Token es obligatorio.' });
    }
    const result = await saveManualToken(accessToken, refreshToken, userId);
    res.json(result);
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ error: `Token inválido: ${msg}` });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshed = await refreshAccessToken();
    res.json({ success: true, auth: refreshed });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// POST /api/auth/disconnect
router.post('/disconnect', (req, res) => {
  try {
    clearAuth();
    res.json({ success: true, message: 'Cuenta de Mercado Libre desvinculada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
