const express = require('express');
const router = express.Router();
const {
  getShipments,
  getShipmentLabel,
  updatePackingMetadata,
} = require('../services/mlShipments.service');
const { addScanLog, getScanLogs } = require('../db/store');

// GET /api/shipments
router.get('/', async (req, res) => {
  try {
    const data = await getShipments(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// GET /api/shipments/scan-logs (Scan audit history from Neon / store)
router.get('/scan-logs', (req, res) => {
  try {
    const logs = getScanLogs(50);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments/scan (Scan barcode/QR on mobile to pack & verify)
router.post('/scan', async (req, res) => {
  try {
    const { rawCode, autoPack = true } = req.body;
    if (!rawCode || typeof rawCode !== 'string') {
      return res.status(400).json({ error: 'Código de barras o QR no provisto.' });
    }

    const trimmed = rawCode.trim();
    // Normalize code: extract numbers or clean string
    // Mercado Envíos barcodes usually are the shipment_id (e.g. 48168467003) or URL/JSON with shipment_id
    const numberMatch = trimmed.match(/\b\d{9,16}\b/);
    const candidateId = numberMatch ? numberMatch[0] : trimmed;

    // Fetch active shipments
    const shipmentsData = await getShipments({ limit: 50 });
    const shipments = shipmentsData.results || [];

    // Find match by shipment ID, order ID, tracking number, or SKU
    let matched = shipments.find(s => 
      String(s.id) === candidateId ||
      String(s.order_id) === candidateId ||
      String(s.tracking_number) === candidateId ||
      (s.order_items && s.order_items.some(it => 
        (it.item?.id && it.item.id.toUpperCase() === candidateId.toUpperCase()) ||
        (it.item?.seller_sku && it.item.seller_sku.toUpperCase() === candidateId.toUpperCase())
      ))
    );

    if (matched) {
      const wasAlreadyPacked = Boolean(matched.packing?.packed);
      let updatedPacking = matched.packing;

      if (autoPack) {
        updatedPacking = updatePackingMetadata(String(matched.id), {
          packed: true,
          qualityChecked: true,
          packedAt: new Date().toISOString(),
        });
      }

      const firstItem = (matched.order_items && matched.order_items[0]?.item) || {};
      await addScanLog(candidateId, String(matched.id), 'PACK_VERIFIED', {
        title: firstItem.title || 'Producto Mercado Libre',
        buyer: matched.buyer?.nickname || 'Comprador',
        status: matched.status,
      });

      return res.json({
        success: true,
        found: true,
        alreadyPacked: wasAlreadyPacked,
        shipment: {
          ...matched,
          packing: updatedPacking,
        },
        message: wasAlreadyPacked 
          ? `El paquete #${matched.id} ya estaba marcado como empaquetado.`
          : `¡Paquete #${matched.id} verificado y marcado como EMPAQUETADO con éxito!`,
      });
    }

    // If not found in current active shipments
    await addScanLog(candidateId, null, 'NOT_FOUND', { raw: trimmed });

    return res.json({
      success: true,
      found: false,
      scannedCode: candidateId,
      message: `No se encontró un envío activo con el código "${candidateId}".`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
