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
const { resolveRedirectUri, getPostAuthRedirect } = require('../services/oauthOrigin');

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
// Exige sesión: sin ella el `state` iría vacío y el callback no podría saber a
// qué usuario pertenecen los tokens, así que la conexión quedaría huérfana.
router.get('/url', requireSession, (req, res) => {
  try {
    const state = req.session ? req.session.token : '';
    const url = getAuthUrl(state, req);
    res.json({ url, redirectUri: resolveRedirectUri(req) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/exchange-code (Direct code exchange)
// Sin sesión, `resolveMlEmail` cae a la cuenta del admin: cualquier visitante
// podría conectar la cuenta de Mercado Libre del administrador. Se exige
// sesión para que los tokens siempre vayan a quien los pidió. La app móvil
// no usa este endpoint: sigue autenticando por token de dispositivo.
router.post('/exchange-code', requireSession, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'El código de autorización es requerido.' });
    }
    const cleanCode = code.trim().replace(/^code=/, '');
    const result = await exchangeCodeForToken(cleanCode, resolveMlEmail(req), req);
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

  if (error) {
    return res.redirect(
      getPostAuthRedirect(req, { error: error_description || String(error) })
    );
  }

  if (!code) {
    return res
      .status(400)
      .send('No se proporcionó el código de autorización de Mercado Libre.');
  }

  try {
    const store = require('../db/store');
    let email = '';
    if (state) {
      const session = await store.getSessionByToken(String(state));
      if (session) email = session.email;
    }
    if (!email) {
      // Sin sesión no hay dueño para los tokens: no se guardan en una cuenta
      // global compartida, se pide volver a empezar autenticado.
      return res.redirect(
        getPostAuthRedirect(req, {
          error: 'Sesión expirada. Volvé a la app e iniciá de nuevo la conexión.',
        })
      );
    }
    await exchangeCodeForToken(String(code), email, req);
    res.redirect(getPostAuthRedirect(req, { success: true }));
  } catch (err) {
    console.error('Callback error:', err.response?.data || err.message);
    const msg = err.response?.data?.message || err.error || err.message;
    res.redirect(getPostAuthRedirect(req, { error: msg }));
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
