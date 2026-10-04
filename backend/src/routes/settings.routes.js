const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../db/store');

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const settings = getSettings();
    // Mask clientSecret slightly for UI security while retaining access
    res.json({
      ...settings,
      hasSecret: Boolean(settings.clientSecret && settings.clientSecret.length > 3),
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

    const updated = updateSettings({
      ...(appId !== undefined ? { appId: appId.trim() } : {}),
      ...(clientSecret !== undefined ? { clientSecret: clientSecret.trim() } : {}),
      ...(redirectUri !== undefined ? { redirectUri: redirectUri.trim() } : {}),
      ...(siteId !== undefined ? { siteId } : {}),
      ...(demoMode !== undefined ? { demoMode: Boolean(demoMode) } : {}),
      ...(lowStockThreshold !== undefined ? { lowStockThreshold: Number(lowStockThreshold) } : {}),
      ...(autoSyncMinutes !== undefined ? { autoSyncMinutes: Number(autoSyncMinutes) } : {}),
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
