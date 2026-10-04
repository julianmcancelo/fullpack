const express = require('express');
const router = express.Router();
const { getOrders, getOrderById } = require('../services/mlOrders.service');

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const data = await getOrders(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
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
