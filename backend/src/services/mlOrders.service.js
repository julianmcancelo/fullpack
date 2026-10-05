const axios = require('axios');
const { getAuth } = require('../db/store');
const { getValidAccessToken } = require('./mlAuth.service');

const ML_API_BASE = 'https://api.mercadolibre.com';

async function getOrders(query = {}) {
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

  if (query.status && query.status !== 'all') {
    params['order.status'] = query.status;
  }
  if (query.q) {
    params.q = query.q;
  }
  if (query.dateFrom) {
    params['order.date_created.from'] = query.dateFrom;
  }
  if (query.dateTo) {
    params['order.date_created.to'] = query.dateTo;
  }

  const searchRes = await axios.get(`${ML_API_BASE}/orders/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

  const { getPackingMetadata } = require('../db/store');
  const packingMeta = getPackingMetadata();

  const enrichedResults = (searchRes.data.results || []).map(o => {
    const shippingId = o.shipping?.id ? String(o.shipping.id) : null;
    const packing = shippingId ? (packingMeta[shippingId] || null) : null;
    return {
      ...o,
      packing
    };
  });

  return {
    results: enrichedResults,
    total: searchRes.data.paging?.total || 0,
    paging: searchRes.data.paging,
  };
}

async function getOrderById(orderId) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const res = await axios.get(`${ML_API_BASE}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

module.exports = {
  getOrders,
  getOrderById,
};
