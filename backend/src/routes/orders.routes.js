const express = require('express');
const router = express.Router();
const { getOrders, getOrderById } = require('../services/mlOrders.service');
const { optionalSession } = require('../middleware/session');
const { resolveMlEmail } = require('../middleware/mlContext');

// Resuelve la cuenta de ML del llamante (sesión web o dispositivo móvil).
router.use(optionalSession);
const mlCtx = (req) => ({ email: resolveMlEmail(req) });

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const data = await getOrders(req.query, mlCtx(req));
    res.json({ ...data, serverTime: data.serverTime || new Date().toISOString() });
  } catch (err) {
    res.json({
      results: [],
      total: 0,
      connected: false,
      message: err.message || 'Mercado Libre no conectado',
      serverTime: new Date().toISOString(),
    });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await getOrderById(req.params.id, mlCtx(req));
    res.json(order);
  } catch (err) {
    res.status(404).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
