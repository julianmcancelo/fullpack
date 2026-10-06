const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../db/store');
const { requireSession } = require('../middleware/session');
const { resolveRedirectUri } = require('../services/oauthOrigin');

// Ajustes contiene el `clientSecret` de la app de Mercado Libre y decide a
// dónde vuelve la autorización. Sin sesión, cualquiera podría leer el secreto
// o apuntar el `redirect_uri` a un servidor propio para robar el código.
router.use(requireSession);

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const settings = getSettings();
    const { clientSecret, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      // `hasSecret` le permite a la UI mostrar "secreto configurado" sin
      // exponer el valor, y decidir si hace falta enviarlo al guardar.
      hasSecret: Boolean(clientSecret && clientSecret.length > 3),
      // Lo que realmente se usa en el flujo, aunque en Ajustes figure otro
      // valor (o un placeholder): sirve para diagnosticar de un vistazo.
      effectiveRedirectUri: resolveRedirectUri(req),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings
router.post('/', (req, res) => {
  try {
    const {
      appId,
      clientSecret,
      redirectUri,
      siteId,
      demoMode,
      lowStockThreshold,
      autoSyncMinutes,
    } = req.body;

    // La UI no siempre reenvía el secreto: al leer Ajustes ya no lo recibe.
    // Un string vacío o con asteriscos no debe borrar lo que ya estaba bien.
    const incomingSecret = String(clientSecret ?? '').trim();
    const secretIsPlaceholder =
      !incomingSecret ||
      /^\*+$/.test(incomingSecret) ||
      incomingSecret === '********';

    const updated = updateSettings({
      ...(appId !== undefined ? { appId: String(appId).trim() } : {}),
      ...(!secretIsPlaceholder ? { clientSecret: incomingSecret } : {}),
      ...(redirectUri !== undefined ? { redirectUri: String(redirectUri).trim() } : {}),
      ...(siteId !== undefined ? { siteId } : {}),
      ...(demoMode !== undefined ? { demoMode: Boolean(demoMode) } : {}),
      ...(lowStockThreshold !== undefined ? { lowStockThreshold: Number(lowStockThreshold) } : {}),
      ...(autoSyncMinutes !== undefined ? { autoSyncMinutes: Number(autoSyncMinutes) } : {}),
    });

    const { clientSecret: _secret, ...safeSettings } = updated;
    res.json({
      success: true,
      settings: safeSettings,
      hasSecret: Boolean(_secret && _secret.length > 3),
      effectiveRedirectUri: resolveRedirectUri(req),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/database (Get Neon status)
router.get('/database', async (req, res) => {
  try {
    const { getDatabaseStatus } = require('../db/store');
    const status = await getDatabaseStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
