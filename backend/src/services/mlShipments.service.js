const axios = require('axios');
const { getAuth, getPackingMetadata, updatePackingMetadata } = require('../db/store');
const { getValidAccessToken } = require('./mlAuth.service');

const ML_API_BASE = 'https://api.mercadolibre.com';

async function getShipments(query = {}) {
  const token = await getValidAccessToken();
  const auth = getAuth();
  if (!token || !auth.userId) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const params = {
    seller: auth.userId,
    sort: 'date_desc',
    limit: query.limit ? Math.min(parseInt(query.limit, 10), 50) : 50,
    offset: query.offset ? parseInt(query.offset, 10) : 0,
  };

  const ordersRes = await axios.get(`${ML_API_BASE}/orders/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

  const orders = ordersRes.data.results || [];
  const shipmentsList = [];
  const packingMeta = getPackingMetadata();

  for (const o of orders) {
    if (o.shipping && o.shipping.id) {
      const sId = String(o.shipping.id);
      const meta = packingMeta[sId] || {
        printed: false,
        packed: false,
        qualityChecked: false,
        note: '',
      };

      shipmentsList.push({
        id: o.shipping.id,
        order_id: o.id,
        order_date: o.date_created,
        status: o.shipping.status || o.status,
        substatus: o.shipping.substatus || '',
        logistic_type: o.shipping.logistic_type || 'default',
        tracking_number: o.shipping.tracking_number || null,
        receiver_address: o.shipping.receiver_address || {},
        buyer: o.buyer,
        items: o.order_items,
        total_amount: o.total_amount,
        shipping_mode: o.shipping.shipping_mode,
        // Internal packing & operational metadata
        packing: meta,
      });
    }
  }

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
    paging: ordersRes.data.paging,
  };
}

async function getShipmentDetail(shipmentId) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const res = await axios.get(`${ML_API_BASE}/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function getShipmentLabel(shipmentId, format = 'pdf') {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  // When printing/downloading label, automatically flag as printed!
  updatePackingMetadata(String(shipmentId), {
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
  getShipmentDetail,
  getShipmentLabel,
  updatePackingMetadata,
};
