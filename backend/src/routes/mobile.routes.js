const express = require('express');
const router = express.Router();
const store = require('../db/store');
const { requireDevice } = require('../middleware/device');
const { getShipments, getShipmentLabel } = require('../services/mlShipments.service');
const { getOverview } = require('../services/overview.service');
const { checkConnectionStatus } = require('../services/mlAuth.service');

/**
 * Mobile API. Everything here requires a paired device (`X-Device-Token`).
 * The payloads are flattened and trimmed for a phone on warehouse Wi-Fi.
 */

router.use(requireDevice);

const LOGISTIC_LABELS = {
  self_service: 'FLEX',
  cross_docking: 'COLECTA',
  fulfillment: 'FULL',
  drop_off: 'CORREO',
  xd_drop_off: 'CORREO',
  default: 'CORREO',
};

function logisticLabel(type) {
  return LOGISTIC_LABELS[type] || 'CORREO';
}

function buyerNameOf(shipment) {
  const b = shipment.buyer || {};
  const full = [b.first_name, b.last_name].filter(Boolean).join(' ').trim();
  return full || b.nickname || 'Comprador';
}

function compactShipment(s) {
  const firstItem = (s.items && s.items[0]) || {};
  const item = firstItem.item || {};
  const addr = s.receiver_address || {};
  const packing = s.packing || {};

  return {
    id: String(s.id),
    orderId: String(s.order_id || ''),
    status: s.status || '',
    substatus: s.substatus || '',
    logisticType: s.logistic_type || 'default',
    logisticLabel: logisticLabel(s.logistic_type),
    trackingNumber: s.tracking_number || '',
    buyerName: buyerNameOf(s),
    buyerNickname: (s.buyer && s.buyer.nickname) || '',
    city: (addr.city && addr.city.name) || '',
    state: (addr.state && addr.state.name) || '',
    zipCode: addr.zip_code || '',
    itemTitle: item.title || 'Producto de Mercado Libre',
    itemThumbnail: item.thumbnail || '',
    itemSku: item.seller_sku || '',
    quantity: Number(firstItem.quantity || 1),
    totalAmount: Number(s.total_amount || 0),
    orderDate: s.order_date || null,
    packing: {
      printed: Boolean(packing.printed),
      packed: Boolean(packing.packed),
      qualityChecked: Boolean(packing.qualityChecked),
      dispatchChecked: Boolean(packing.dispatchChecked),
      note: packing.note || '',
      scanCount: Number(packing.scanCount || 0),
      firstScannedAt: packing.firstScannedAt || null,
      lastScannedAt: packing.lastScannedAt || null,
    },
  };
}

function sortByOldestFirst(a, b) {
  return new Date(a.orderDate || 0).getTime() - new Date(b.orderDate || 0).getTime();
}

// GET /api/mobile/me
router.get('/me', async (req, res) => {
  try {
    const connection = await checkConnectionStatus().catch(() => ({ connected: false }));
    res.json({
      success: true,
      user: req.mobileUser,
      device: {
        id: req.device.id,
        name: req.device.name,
        platform: req.device.platform,
        appVersion: req.device.appVersion,
        createdAt: req.device.createdAt,
        lastSeenAt: req.device.lastSeenAt,
      },
      connection,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mobile/queue  (packing queue: ready to ship, still unpacked)
router.get('/queue', async (req, res) => {
  try {
    const parsedLimit = req.query.limit
      ? Math.min(parseInt(req.query.limit, 10) || 50, 50)
      : 50;
    let statusParam = req.query.status ? String(req.query.status).toLowerCase() : null;
    if (statusParam === 'pending') statusParam = 'ready_to_ship';
    const includePacked =
      req.query.includePacked === '1' ||
      req.query.includePacked === 'true' ||
      req.query.includePacked === true;

    const data = await getShipments({ limit: parsedLimit });
    const all = (data.results || []).map(compactShipment);

    let queue;
    if (statusParam === 'all' || includePacked) {
      queue = all.slice();
      if (statusParam && statusParam !== 'all') {
        queue = queue.filter((s) => s.status === statusParam);
      }
    } else if (statusParam) {
      if (statusParam === 'ready_to_ship') {
        queue = all.filter((s) => s.status === 'ready_to_ship' && !s.packing.packed);
      } else {
        queue = all.filter((s) => s.status === statusParam);
      }
    } else {
      queue = all.filter((s) => s.status === 'ready_to_ship' && !s.packing.packed);
    }
    queue.sort(sortByOldestFirst);

    res.json({
      success: true,
      total: queue.length,
      readyToShip: all.filter((s) => s.status === 'ready_to_ship').length,
      packed: all.filter((s) => s.packing.packed).length,
      shipped: all.filter((s) => s.status === 'shipped').length,
      delivered: all.filter((s) => s.status === 'delivered').length,
      queue,
      queueFull: queue,
      all,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      success: false,
      total: 0,
      queue: [],
      error: err.message || 'Mercado Libre no conectado',
    });
  }
});

// GET /api/mobile/bootstrap  (single call with everything the app needs on open)
// Usa el resumen canónico compartido con /stats/dashboard: mismos números.
router.get('/bootstrap', async (req, res) => {
  try {
    const settings = store.getSettings();
    const threshold = settings.lowStockThreshold || 5;

    const [connection, data] = await Promise.all([
      checkConnectionStatus().catch(() => ({ connected: false })),
      getOverview().catch((e) => null),
    ]);

    if (!data) throw new Error('No se pudo sincronizar con Mercado Libre.');

    const shipments = (data.shipments || []).map(compactShipment);
    const items = data.items || [];

    // Universo del día: envíos listos para despachar, separados por estado de empaque.
    // Se cuenta ANTES de recortar la cola, así el progreso no miente cuando hay más
    // de 30 pendientes.
    const readyToShip = shipments.filter((s) => s.status === 'ready_to_ship');
    const unpackedReady = readyToShip.filter((s) => !s.packing.packed);

    const queue = unpackedReady.slice().sort(sortByOldestFirst).slice(0, 30);

    const lowStock = items.filter(
      (i) => Number(i.available_quantity || 0) <= threshold,
    );

    res.json({
      success: true,
      serverTime: data.serverTime,
      user: req.mobileUser,
      device: { id: req.device.id, name: req.device.name, platform: req.device.platform },
      connection,
      summary: data.summary,
      queue,
      queueFull: shipments.slice(0, 50),
      lowStock: lowStock.slice(0, 12).map((i) => ({
        id: String(i.id),
        title: i.title || 'Publicación',
        thumbnail: i.thumbnail || '',
        sku: i.seller_sku || '',
        availableQuantity: Number(i.available_quantity || 0),
        price: Number(i.price || 0),
        status: i.status || '',
      })),
      recentLogs: store.getScanLogs(15),
      errors: data.errors,
    });
  } catch (err) {
    console.error('mobile/bootstrap error:', err);
    res.json({
      success: false,
      error: err.message,
      serverTime: new Date().toISOString(),
      summary: null,
      queue: [],
      lowStock: [],
      recentLogs: [],
    });
  }
});

// GET /api/mobile/label/:id?format=pdf|zpl  (streams the Mercado Libre label)
router.get('/label/:id', async (req, res) => {
  try {
    const format = req.query.format === 'zpl' ? 'zpl' : 'pdf';
    const label = await getShipmentLabel(req.params.id, format);
    res.setHeader('Content-Type', label.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="etiqueta-${req.params.id}.${format}"`,
    );
    res.send(label.buffer);
  } catch (err) {
    res.status(500).json({ error: (err.response && err.response.data) || err.message });
  }
});

// POST /api/mobile/unlink  (forget this device)
router.post('/unlink', async (req, res) => {
  try {
    await store.deleteDevice(req.device.id);
    res.json({ success: true, message: 'Dispositivo desvinculado.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
