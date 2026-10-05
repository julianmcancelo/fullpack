const axios = require('axios');
const { getAuth, getAuthAsync, getPackingMetadata, updatePackingMetadata, updatePackingMetadataAsync, refreshPackingFromNeon } = require('../db/store');
const { getValidAccessToken } = require('./mlAuth.service');

const ML_API_BASE = 'https://api.mercadolibre.com';

// Construye la lista de envíos a partir de órdenes ya obtenidas, con UNA sola
// derivación de estado (override local > vivo ML > orden). La usan getShipments
// y el resumen compartido (overview), así todos muestran los mismos estados.
async function buildShipmentsFromOrders(orders, token, options = {}) {
  const shipmentsList = [];
  const packingMeta = await refreshPackingFromNeon();

  // Extract unique shipment IDs to fetch official live status from /shipments in parallel chunks.
  // Con skipLive se omite (el escaneo solo necesita matchear y enriquece 1 envío).
  const shipmentIds = options.skipLive ? [] : orders.map(o => o.shipping && o.shipping.id).filter(Boolean);
  const liveShipmentsMap = {};

  // Fetch in concurrency-controlled chunks of 10
  for (let i = 0; i < shipmentIds.length; i += 10) {
    const chunk = shipmentIds.slice(i, i + 10);
    await Promise.all(
      chunk.map(async (sId) => {
        try {
          const sRes = await axios.get(`${ML_API_BASE}/shipments/${sId}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 4000,
          });
          liveShipmentsMap[String(sId)] = sRes.data;
        } catch {
          // Fallback gracefully if single shipment query fails
        }
      })
    );
  }

  for (const o of orders) {
    if (o.shipping && o.shipping.id) {
      const sId = String(o.shipping.id);
      const meta = packingMeta[sId] || {
        printed: false,
        packed: false,
        qualityChecked: false,
        note: '',
      };

      const liveShipment = liveShipmentsMap[sId] || {};

      // Priority of status:
      // 1. Local user manual override in packing metadata (if marked delivered / shipped manually)
      // 2. Official live Mercado Libre shipment status (/shipments/:id)
      // 3. Order status & order tags
      // 4. Default fallback
      let shipStatus = meta.statusOverride || liveShipment.status || o.shipping.status || 'ready_to_ship';

      // Check order cancellation
      if (o.status === 'cancelled') {
        shipStatus = 'cancelled';
      } else if (!meta.statusOverride) {
        // Tag sync if not overridden
        if (o.tags && Array.isArray(o.tags)) {
          if (o.tags.includes('delivered')) {
            shipStatus = 'delivered';
          }
        }
      }

      const substatus = liveShipment.substatus || o.shipping.substatus || '';
      const logisticType = liveShipment.logistic_type || o.shipping.logistic_type || 'default';
      const trackingNumber = liveShipment.tracking_number || o.shipping.tracking_number || null;
      const receiverAddress = liveShipment.receiver_address || o.shipping.receiver_address || {};

      shipmentsList.push({
        id: o.shipping.id,
        order_id: o.id,
        order_date: o.date_created,
        status: shipStatus,
        substatus,
        logistic_type: logisticType,
        tracking_number: trackingNumber,
        receiver_address: receiverAddress,
        buyer: o.buyer,
        items: o.order_items,
        total_amount: o.total_amount,
        shipping_mode: liveShipment.mode || o.shipping.shipping_mode,
        shipping_option: liveShipment.shipping_option || null,
        lead_time: liveShipment.lead_time || null,
        estimated_handling_limit: liveShipment.estimated_handling_limit || null,
        status_history: liveShipment.status_history || null,
        // Internal packing & operational metadata
        packing: meta,
      });
    }
  }

  return shipmentsList;
}

async function getShipments(query = {}, options = {}, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  const auth = ctx.email ? await getAuthAsync(ctx.email) : getAuth();
  if (!token || !auth.userId) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  // Reutiliza el paginado de órdenes (ML acepta máx. 50 por llamada).
  // Solo se pasan filtros de ORDEN: los de envío (status, logistic_type,
  // printed, packed) se aplican después sobre la lista construida.
  const { getOrders } = require('./mlOrders.service');
  const ordersData = await getOrders({
    limit: query.limit,
    offset: query.offset,
    q: query.q,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  }, ctx);
  const orders = ordersData.results || [];

  const shipmentsList = await buildShipmentsFromOrders(orders, token, options);

  let filtered = shipmentsList;
  if (query.status && query.status !== 'all') {
    filtered = filtered.filter(s => s.status === query.status);
  }
  if (query.logistic_type && query.logistic_type !== 'all') {
    filtered = filtered.filter(s => s.logistic_type === query.logistic_type);
  }
  if (query.printed === 'true') {
    filtered = filtered.filter(s => s.packing?.printed);
  } else if (query.printed === 'false') {
    filtered = filtered.filter(s => !s.packing?.printed);
  }
  if (query.packed === 'true') {
    filtered = filtered.filter(s => s.packing?.packed);
  } else if (query.packed === 'false') {
    filtered = filtered.filter(s => !s.packing?.packed);
  }
  if (query.q) {
    const qLower = query.q.toLowerCase();
    filtered = filtered.filter(
      s =>
        String(s.id).includes(qLower) ||
        String(s.order_id).includes(qLower) ||
        s.tracking_number?.toLowerCase().includes(qLower) ||
        s.buyer?.nickname?.toLowerCase().includes(qLower) ||
        s.buyer?.first_name?.toLowerCase().includes(qLower) ||
        s.buyer?.last_name?.toLowerCase().includes(qLower)
    );
  }

  return {
    results: filtered,
    total: filtered.length,
    paging: ordersData.paging,
    connected: true,
    serverTime: new Date().toISOString(),
  };
}

async function getShipmentLiveStatus(shipmentId, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const res = await axios.get(`${ML_API_BASE}/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = res.data || {};
  return {
    id: d.id,
    status: d.status,
    substatus: d.substatus,
    logistic_type: d.logistic_type,
    tracking_number: d.tracking_number,
    receiver_address: d.receiver_address,
    status_history: d.status_history,
    estimated_handling_limit: d.estimated_handling_limit,
    serverTime: new Date().toISOString(),
  };
}

async function getShipmentDetail(shipmentId, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const res = await axios.get(`${ML_API_BASE}/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function getShipmentLabel(shipmentId, format = 'pdf', ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  // When printing/downloading label, automatically flag as printed!
  await updatePackingMetadataAsync(String(shipmentId), {
    printed: true,
    printedAt: new Date().toISOString(),
  });

  const responseType = format === 'zpl' ? 'zpl2' : 'pdf';
  const res = await axios.get(`${ML_API_BASE}/shipment_labels`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      shipment_ids: shipmentId,
      response_type: responseType,
    },
    responseType: 'arraybuffer',
  });

  return {
    buffer: res.data,
    contentType: format === 'zpl' ? 'text/plain' : 'application/pdf',
  };
}

module.exports = {
  getShipments,
  buildShipmentsFromOrders,
  getShipmentDetail,
  getShipmentLiveStatus,
  getShipmentLabel,
  updatePackingMetadata,
};
