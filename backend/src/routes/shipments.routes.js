const express = require('express');
const router = express.Router();
const {
  getShipments,
  getShipmentDetail,
  getShipmentLiveStatus,
  getShipmentLabel,
  updatePackingMetadata,
} = require('../services/mlShipments.service');
const { addScanLog, getScanLogs, updatePackingMetadataAsync } = require('../db/store');
const { optionalSession } = require('../middleware/session');
const { resolveMlEmail } = require('../middleware/mlContext');

// Resuelve la cuenta de ML del llamante (sesión web o dispositivo móvil).
router.use(optionalSession);
const mlCtx = (req) => ({ email: resolveMlEmail(req) });

// ---------------------------------------------------------------------------
// Lectura de etiquetas
// ---------------------------------------------------------------------------
/**
 * Un QR de etiqueta de Mercado Libre trae mucha información (envío, orden,
 * seguimiento, SKU, URLs). Antes se armaba una bolsa de candidatos y se aceptaba
 * el primer envío que coincidiera con *cualquiera* de ellos; como el id de
 * publicación es el mismo en todos los envíos de un producto, escanear una
 * etiqueta podía marcar OTRO paquete y descuadrar los conteos.
 *
 * Ahora se compara por prioridad estricta (envío → orden → seguimiento → SKU) y,
 * si dos paquetes empatan, se avisa en lugar de adivinar.
 */
const SCAN_DEDUPE_MS = 8000; // relecturas del mismo paquete dentro de esta ventana no cuentan
const PRIORITY_FIELDS = ['shipment_id', 'order_id', 'tracking', 'sku'];
const CLAVES_ID = [
  'id',
  'shipment',
  'shipment_id',
  'order',
  'order_id',
  'tracking',
  'tracking_number',
  'sku',
  'seller_sku',
  'package',
  'package_id',
];

const ETIQUETA_CAMPO = {
  shipment_id: 'número de envío',
  order_id: 'número de orden',
  tracking: 'número de seguimiento',
  sku: 'SKU',
};

function normalizar(value) {
  return String(value == null ? '' : value).trim().toUpperCase();
}

/** Valores del código leído que pueden identificar un envío, sin duplicados. */
function candidatosDeCodigo(rawCode) {
  const texto = String(rawCode || '').trim();
  const salida = [];
  const agregar = (valor) => {
    const v = normalizar(valor);
    if (v && v.length >= 3 && !salida.includes(v)) salida.push(v);
  };

  agregar(texto);

  // URLs del estilo https://.../shipments/48164856585 o ?shipment_id=...
  try {
    if (/^https?:\/\//i.test(texto)) {
      const url = new URL(texto);
      url.pathname.split('/').filter(Boolean).forEach(agregar);
      url.searchParams.forEach((valor) => agregar(valor));
    }
  } catch {
    // no es una URL: seguimos con el texto plano
  }

  // Pares "clave:valor" típicos de las etiquetas (sólo claves que identifican).
  texto.split(/[;,\s|]+/).forEach((trozo) => {
    const corte = trozo.indexOf(':');
    if (corte <= 0) return;
    const clave = trozo.slice(0, corte).toLowerCase().trim();
    if (CLAVES_ID.some((c) => clave === c || clave.endsWith(`_${c}`))) {
      agregar(trozo.slice(corte + 1));
    }
  });

  // Números con pinta de id de envío (9 a 16 dígitos).
  (texto.match(/\b\d{9,16}\b/g) || []).forEach(agregar);

  return salida;
}

/** Valores comparables de un envío, por campo. */
function camposDeEnvio(shipment) {
  const skus = [];
  for (const linea of shipment.items || []) {
    const sku = normalizar(linea.item && linea.item.seller_sku);
    if (sku) skus.push(sku);
  }
  return {
    shipment_id: [normalizar(shipment.id)],
    order_id: [normalizar(shipment.order_id)],
    tracking: [normalizar(shipment.tracking_number)],
    sku: skus,
  };
}

/**
 * Busca el envío comparando por prioridad. Devuelve el paquete sólo si hay un
 * único candidato en el primer nivel que tenga coincidencias.
 */
function buscarEnvio(shipments, candidatos) {
  const buscados = new Set(candidatos);
  for (const campo of PRIORITY_FIELDS) {
    const encontrados = shipments.filter((s) =>
      camposDeEnvio(s)[campo].some((valor) => valor && buscados.has(valor)),
    );
    if (encontrados.length === 1) {
      return { matched: encontrados[0], matchedBy: campo, ambiguous: false, count: 1 };
    }
    if (encontrados.length > 1) {
      return { matched: null, matchedBy: campo, ambiguous: true, count: encontrados.length };
    }
  }
  return { matched: null, matchedBy: null, ambiguous: false, count: 0 };
}

// GET /api/shipments
router.get('/', async (req, res) => {
  try {
    const data = await getShipments(req.query, {}, mlCtx(req));
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

// GET /api/shipments/scan-logs (Scan audit history from Neon / store)
router.get('/scan-logs', (req, res) => {
  try {
    const logs = getScanLogs(50);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments/scan (Scan barcode/QR on mobile to pack or dispatch-verify)
router.post('/scan', async (req, res) => {
  try {
    const { rawCode, autoPack = true, scanMode = 'pack', carrierFilter = 'all' } = req.body;
    if (!rawCode || typeof rawCode !== 'string') {
      return res.status(400).json({ error: 'Código de barras o QR no provisto.' });
    }

    const trimmed = rawCode.trim();
    const candidatos = candidatosDeCodigo(trimmed);
    const codigoLeido = candidatos[0] || trimmed;

    // Envíos recientes para matchear (sin estados en vivo: rápido y liviano).
    // Si hay match, se enriquece SOLO ese envío con su estado oficial.
    const shipmentsData = await getShipments({ limit: 60 }, { skipLive: true }, mlCtx(req));
    let shipments = shipmentsData.results || [];

    let { matched, matchedBy, ambiguous, count } = buscarEnvio(shipments, candidatos);

    // Código que apunta a más de un paquete: no adivinamos.
    if (ambiguous) {
      await addScanLog(trimmed, null, 'AMBIGUOUS_CODE', { matchedBy, count });
      return res.json({
        success: true,
        found: false,
        ambiguous: true,
        matchedBy,
        scannedCode: codigoLeido,
        message: `Ese código coincide con ${count} paquetes (por ${ETIQUETA_CAMPO[matchedBy] || matchedBy}). Escaneá el QR o el código de barras de la etiqueta del paquete.`,
      });
    }

    if (matched) {
      // Enriquece solo el match con el estado oficial en vivo de ML.
      try {
        const live = await getShipmentLiveStatus(matched.id, mlCtx(req));
        matched = {
          ...matched,
          status: matched.packing?.statusOverride || live.status || matched.status,
          substatus: live.substatus || matched.substatus,
          logistic_type: live.logistic_type || matched.logistic_type,
          tracking_number: live.tracking_number || matched.tracking_number,
          receiver_address: live.receiver_address || matched.receiver_address,
        };
      } catch {
        // Sin estado en vivo se sigue con los datos de la orden.
      }
      const prevPacking = matched.packing || {};
      const nowIso = new Date().toISOString();
      const firstItem = (matched.items && matched.items[0]?.item) || {};
      const buyerName = matched.buyer?.first_name 
        ? `${matched.buyer.first_name} ${matched.buyer.last_name || ''}`.trim()
        : (matched.buyer?.nickname || 'Comprador');
      const loggedCode = String(matched.id) || codigoLeido;
      const scanCountPrevio = Number(prevPacking.scanCount) || 0;

      // Relectura inmediata del mismo paquete (la etiqueta trae QR *y* código de
      // barras, y la cámara puede entregar los dos): no se vuelve a contar.
      const ultimoEscaneo = prevPacking.lastScannedAt ? new Date(prevPacking.lastScannedAt).getTime() : 0;
      const relectura = ultimoEscaneo > 0 && Date.now() - ultimoEscaneo < SCAN_DEDUPE_MS;
      if (relectura) {
        return res.json({
          success: true,
          found: true,
          duplicateRead: true,
          matchedBy,
          scannedCode: codigoLeido,
          alreadyPacked: Boolean(prevPacking.packed),
          alreadyDispatchChecked: Boolean(prevPacking.dispatchChecked),
          scanCount: scanCountPrevio,
          shipment: matched,
          message: `Este paquete ya se escaneó hace instantes (lectura #${scanCountPrevio}). No se volvió a contar.`,
        });
      }

      // -------------------------------------------------------------
      // MODE: CONTROL DE DESPACHO / SALIDA A TRANSPORTE
      // -------------------------------------------------------------
      if (scanMode === 'dispatch') {
        const isCarrierMatch = carrierFilter === 'all' || 
          (carrierFilter === 'self_service' && matched.logistic_type === 'self_service') ||
          (carrierFilter === 'cross_docking' && matched.logistic_type === 'cross_docking') ||
          (carrierFilter === 'drop_off' && (matched.logistic_type === 'drop_off' || matched.logistic_type === 'xd_drop_off' || matched.logistic_type === 'default'));

        if (!isCarrierMatch) {
          const expectedName = carrierFilter === 'self_service' ? 'FLEX' : carrierFilter === 'cross_docking' ? 'COLECTA' : 'CORREO';
          const actualName = matched.logistic_type === 'self_service' ? 'FLEX' : matched.logistic_type === 'cross_docking' ? 'COLECTA' : 'CORREO';

          await addScanLog(loggedCode, String(matched.id), 'DISPATCH_CARRIER_MISMATCH', {
            title: firstItem.title || 'Producto Mercado Libre',
            buyer: buyerName,
            status: matched.status,
            expected: expectedName,
            actual: actualName,
          });

          return res.json({
            success: true,
            found: true,
            carrierMismatch: true,
            matchedBy,
            scannedCode: codigoLeido,
            expectedCarrier: expectedName,
            actualCarrier: actualName,
            shipment: matched,
            message: `🚨 ¡ALERTA DE ERROR! Este paquete es de ${actualName}, pero estás despachando ${expectedName}. ¡NO entregar al chofer!`,
          });
        }

        const wasAlreadyDispatchChecked = Boolean(prevPacking.dispatchChecked);
        const updatedPacking = await updatePackingMetadataAsync(String(matched.id), {
          dispatchChecked: true,
          dispatchCheckedAt: nowIso,
          lastScannedAt: nowIso,
        });

        await addScanLog(loggedCode, String(matched.id), wasAlreadyDispatchChecked ? 'DISPATCH_DUPLICATE' : 'DISPATCH_VERIFIED', {
          title: firstItem.title || 'Producto Mercado Libre',
          buyer: buyerName,
          status: matched.status,
          dispatchChecked: true,
        });

        return res.json({
          success: true,
          found: true,
          scanMode: 'dispatch',
          carrierMismatch: false,
          matchedBy,
          scannedCode: codigoLeido,
          alreadyDispatchChecked: wasAlreadyDispatchChecked,
          shipment: {
            ...matched,
            packing: updatedPacking,
          },
          message: wasAlreadyDispatchChecked
            ? `⚠️ Paquete #${matched.id} ya había sido verificado para despacho.`
            : `🚚 ¡Paquete #${matched.id} verificado para salida a transporte!`,
        });
      }

      // -------------------------------------------------------------
      // MODE: EMPAQUE Y PREPARACIÓN (DEFAULT)
      // -------------------------------------------------------------
      const wasAlreadyPacked = Boolean(prevPacking.packed);
      const newScanCount = (Number(prevPacking.scanCount) || 0) + 1;
      const firstScannedAt = prevPacking.firstScannedAt || prevPacking.packedAt || nowIso;

      let updatedPacking = {
        ...prevPacking,
        scanCount: newScanCount,
        lastScannedAt: nowIso,
        firstScannedAt,
      };

      if (autoPack && !wasAlreadyPacked) {
        updatedPacking = await updatePackingMetadataAsync(String(matched.id), {
          packed: true,
          qualityChecked: true,
          packedAt: nowIso,
          firstScannedAt,
          lastScannedAt: nowIso,
          scanCount: newScanCount,
        });
      } else {
        updatedPacking = await updatePackingMetadataAsync(String(matched.id), {
          scanCount: newScanCount,
          lastScannedAt: nowIso,
          firstScannedAt,
        });
      }

      const actionType = wasAlreadyPacked ? 'DUPLICATE_SCAN' : 'FIRST_PACK_VERIFIED';

      await addScanLog(loggedCode, String(matched.id), actionType, {
        title: firstItem.title || 'Producto Mercado Libre',
        buyer: buyerName,
        status: matched.status,
        scanCount: newScanCount,
        firstScannedAt,
      });

      return res.json({
        success: true,
        found: true,
        scanMode: 'pack',
        matchedBy,
        scannedCode: codigoLeido,
        alreadyPacked: wasAlreadyPacked,
        scanCount: newScanCount,
        firstScannedAt,
        lastScannedAt: nowIso,
        shipment: {
          ...matched,
          packing: updatedPacking,
        },
        message: wasAlreadyPacked
          ? `⚠️ El paquete #${matched.id} ya estaba empaquetado (lectura #${newScanCount}). No hace falta volver a escanearlo.`
          : `✅ Paquete #${matched.id} empaquetado y verificado.`,
      });
    }

    // Sin coincidencias en la ventana de envíos activos.
    await addScanLog(codigoLeido, null, 'NOT_FOUND', { raw: trimmed });

    return res.json({
      success: true,
      found: false,
      scannedCode: codigoLeido,
      message: `No encontramos ningún paquete activo con el código "${codigoLeido}". Probá con el QR de la etiqueta o revisá que el envío siga pendiente.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipments/:id/status
router.get('/:id/status', async (req, res) => {
  try {
    const data = await getShipmentLiveStatus(req.params.id, mlCtx(req));
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shipments/:id/label
router.get('/:id/label', async (req, res) => {
  try {
    const format = req.query.format || 'pdf';
    const labelData = await getShipmentLabel(req.params.id, format, mlCtx(req));

    res.setHeader('Content-Type', labelData.contentType);
    res.setHeader('Content-Disposition', `inline; filename="etiqueta-${req.params.id}.${format}"`);
    res.send(labelData.buffer);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// PUT /api/shipments/:id/packing (Update packing checklist: printed, packed, qualityChecked, note, statusOverride)
router.put('/:id/packing', async (req, res) => {
  try {
    const { printed, packed, qualityChecked, dispatchChecked, note, statusOverride } = req.body;
    const nowIso = new Date().toISOString();
    const updated = await updatePackingMetadataAsync(req.params.id, {
      ...(printed !== undefined ? { printed: Boolean(printed), ...(printed ? { printedAt: nowIso } : {}) } : {}),
      ...(packed !== undefined ? { packed: Boolean(packed), ...(packed ? { packedAt: nowIso } : {}) } : {}),
      ...(qualityChecked !== undefined ? { qualityChecked: Boolean(qualityChecked) } : {}),
      ...(dispatchChecked !== undefined ? { dispatchChecked: Boolean(dispatchChecked), ...(dispatchChecked ? { dispatchCheckedAt: nowIso } : {}) } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(statusOverride !== undefined ? { statusOverride } : {}),
    });
    res.json({ success: true, packing: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments/batch-packing (Bulk mark as printed or packed or update statusOverride)
router.post('/batch-packing', async (req, res) => {
  try {
    const { shipmentIds, updates } = req.body;
    if (!Array.isArray(shipmentIds)) {
      return res.status(400).json({ error: 'Array de shipmentIds requerido.' });
    }
    const results = [];
    for (const id of shipmentIds) {
      results.push(await updatePackingMetadataAsync(String(id), updates));
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
