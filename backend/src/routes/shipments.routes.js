const express = require('express');
const router = express.Router();
const {
  getShipments,
  getShipmentLabel,
  updatePackingMetadata,
} = require('../services/mlShipments.service');

// GET /api/shipments
router.get('/', async (req, res) => {
  try {
    const data = await getShipments(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// GET /api/shipments/:id/label
router.get('/:id/label', async (req, res) => {
  try {
    const format = req.query.format || 'pdf';
    const labelData = await getShipmentLabel(req.params.id, format);

    res.setHeader('Content-Type', labelData.contentType);
    res.setHeader('Content-Disposition', `inline; filename="etiqueta-${req.params.id}.${format}"`);
    res.send(labelData.buffer);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// PUT /api/shipments/:id/packing (Update packing checklist: printed, packed, qualityChecked, note)
router.put('/:id/packing', (req, res) => {
  try {
    const { printed, packed, qualityChecked, note } = req.body;
    const updated = updatePackingMetadata(req.params.id, {
      ...(printed !== undefined ? { printed: Boolean(printed) } : {}),
      ...(packed !== undefined ? { packed: Boolean(packed) } : {}),
      ...(qualityChecked !== undefined ? { qualityChecked: Boolean(qualityChecked) } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(packed ? { packedAt: new Date().toISOString() } : {}),
    });
    res.json({ success: true, packing: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments/batch-packing (Bulk mark as printed or packed)
router.post('/batch-packing', (req, res) => {
  try {
    const { shipmentIds, updates } = req.body;
    if (!Array.isArray(shipmentIds)) {
      return res.status(400).json({ error: 'Array de shipmentIds requerido.' });
    }
    const results = shipmentIds.map(id => updatePackingMetadata(String(id), updates));
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
