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
    res.json({
      results: [],
      total: 0,
      connected: false,
      message: err.message || 'Mercado Libre no conectado',
    });
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

// POST /api/shipments/scan (Scan barcode/QR on mobile to pack & verify with duplicate alerts)
router.post('/scan', async (req, res) => {
  try {
    const { rawCode, autoPack = true } = req.body;
    if (!rawCode || typeof rawCode !== 'string') {
      return res.status(400).json({ error: 'Código de barras o QR no provisto.' });
    }

    const trimmed = rawCode.trim();
    // Normalize code: extract numbers, extract parameters from ML QR URLs, or use clean string
    const numbersFound = trimmed.match(/\b\d{9,16}\b/g) || [];
    const candidatePool = [trimmed, ...numbersFound];
    
    // Also support parsing URLs like https://.../shipments/48164856585 or ?shipment_id=...
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsedUrl = new URL(trimmed);
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        candidatePool.push(...pathSegments);
        parsedUrl.searchParams.forEach((val) => candidatePool.push(val));
      }
    } catch {}

    // Fetch active shipments
    const shipmentsData = await getShipments({ limit: 50 });
    const shipments = shipmentsData.results || [];

    // Find match by shipment ID, order ID, tracking number, or SKU
    let matched = shipments.find(s => {
      const sId = String(s.id);
      const oId = String(s.order_id);
      const trk = s.tracking_number ? String(s.tracking_number).toUpperCase() : '';
      
      return candidatePool.some(cand => {
        const candNorm = String(cand).toUpperCase();
        if (sId === cand || oId === cand || (trk && trk === candNorm)) return true;
        if (s.items && s.items.some(it => 
          (it.item?.id && it.item.id.toUpperCase() === candNorm) ||
          (it.item?.seller_sku && it.item.seller_sku.toUpperCase() === candNorm)
        )) return true;
        return false;
      });
    });

    if (matched) {
      const prevPacking = matched.packing || {};
      const wasAlreadyPacked = Boolean(prevPacking.packed);
      const newScanCount = (Number(prevPacking.scanCount) || 0) + 1;
      const nowIso = new Date().toISOString();
      const firstScannedAt = prevPacking.firstScannedAt || prevPacking.packedAt || nowIso;

      let updatedPacking = {
        ...prevPacking,
        scanCount: newScanCount,
        lastScannedAt: nowIso,
        firstScannedAt,
      };

      if (autoPack && !wasAlreadyPacked) {
        updatedPacking = updatePackingMetadata(String(matched.id), {
          packed: true,
          qualityChecked: true,
          packedAt: nowIso,
          firstScannedAt,
          lastScannedAt: nowIso,
          scanCount: newScanCount,
        });
      } else {
        // Just update scan count and timestamps
        updatedPacking = updatePackingMetadata(String(matched.id), {
          scanCount: newScanCount,
          lastScannedAt: nowIso,
          firstScannedAt,
        });
      }

      const firstItem = (matched.items && matched.items[0]?.item) || {};
      const buyerName = matched.buyer?.first_name 
        ? `${matched.buyer.first_name} ${matched.buyer.last_name || ''}`.trim()
        : (matched.buyer?.nickname || 'Comprador');

      const actionType = wasAlreadyPacked ? 'DUPLICATE_SCAN' : 'FIRST_PACK_VERIFIED';

      await addScanLog(candidateId, String(matched.id), actionType, {
        title: firstItem.title || 'Producto Mercado Libre',
        buyer: buyerName,
        status: matched.status,
        scanCount: newScanCount,
        firstScannedAt,
      });

      return res.json({
        success: true,
        found: true,
        alreadyPacked: wasAlreadyPacked,
        scanCount: newScanCount,
        firstScannedAt,
        lastScannedAt: nowIso,
        shipment: {
          ...matched,
          packing: updatedPacking,
        },
        message: wasAlreadyPacked 
          ? `⚠️ ATENCIÓN: El paquete #${matched.id} ya había sido empaquetado previamente (Lectura #${newScanCount}).`
          : `✅ ¡Paquete #${matched.id} verificado y marcado como EMPAQUETADO con éxito!`,
      });
    }

    // If not found in current active shipments
    await addScanLog(candidateId, null, 'NOT_FOUND', { raw: trimmed });

    return res.json({
      success: true,
      found: false,
      scannedCode: candidateId,
      message: `Código "${candidateId}" no corresponde a ningún envío activo pendiente.`,
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

// PUT /api/shipments/:id/packing (Update packing checklist: printed, packed, qualityChecked, note, statusOverride)
router.put('/:id/packing', (req, res) => {
  try {
    const { printed, packed, qualityChecked, note, statusOverride } = req.body;
    const nowIso = new Date().toISOString();
    const updated = updatePackingMetadata(req.params.id, {
      ...(printed !== undefined ? { printed: Boolean(printed), ...(printed ? { printedAt: nowIso } : {}) } : {}),
      ...(packed !== undefined ? { packed: Boolean(packed), ...(packed ? { packedAt: nowIso } : {}) } : {}),
      ...(qualityChecked !== undefined ? { qualityChecked: Boolean(qualityChecked) } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(statusOverride !== undefined ? { statusOverride } : {}),
    });
    res.json({ success: true, packing: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments/batch-packing (Bulk mark as printed or packed or update statusOverride)
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
