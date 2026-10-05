const express = require('express');
const router = express.Router();
const {
  getItems,
  getItemById,
  updateStock,
  updatePrice,
  toggleItemStatus,
  batchUpdateStock,
} = require('../services/mlItems.service');

// GET /api/items
router.get('/', async (req, res) => {
  try {
    const data = await getItems(req.query);
    res.json(data);
  } catch (err) {
    res.json({
      results: [],
      total: 0,
      connected: false,
      message: err.message || 'Mercado Libre no conectado',
    });
  }
});

// GET /api/items/:id
router.get('/:id', async (req, res) => {
  try {
    const item = await getItemById(req.params.id);
    res.json(item);
  } catch (err) {
    res.status(404).json({ error: err.response?.data || err.message });
  }
});

// PUT /api/items/:id/stock
router.put('/:id/stock', async (req, res) => {
  try {
    const { quantity, variationId } = req.body;
    const result = await updateStock(req.params.id, quantity, variationId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// PUT /api/items/:id/price
router.put('/:id/price', async (req, res) => {
  try {
    const { price, variationId } = req.body;
    const result = await updatePrice(req.params.id, price, variationId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// PUT /api/items/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await toggleItemStatus(req.params.id, status);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// POST /api/items/batch-price-percentage
router.post('/batch-price-percentage', async (req, res) => {
  try {
    const { itemIds, percentage } = req.body;
    const pct = parseFloat(percentage);
    if (isNaN(pct)) {
      return res.status(400).json({ error: 'Porcentaje inválido.' });
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una publicación.' });
    }

    const multiplier = 1 + (pct / 100);
    const results = [];

    for (const id of itemIds) {
      try {
        const item = await getItemById(id);
        const newPrice = Math.round(item.price * multiplier);
        const updateRes = await updatePrice(id, newPrice);
        results.push({ id, oldPrice: item.price, newPrice, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/items/batch-status
router.post('/batch-status', async (req, res) => {
  try {
    const { itemIds, status } = req.body;
    if (!['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una publicación.' });
    }

    const results = [];
    for (const id of itemIds) {
      try {
        await toggleItemStatus(id, status);
        results.push({ id, status, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
