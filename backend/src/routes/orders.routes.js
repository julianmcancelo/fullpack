const express = require('express');
const router = express.Router();
const { getOrders, getOrderById } = require('../services/mlOrders.service');

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const data = await getOrders(req.query);
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
    const order = await getOrderById(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(404).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
