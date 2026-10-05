const axios = require('axios');
const { getAuth, getAuthAsync } = require('../db/store');
const { getValidAccessToken } = require('./mlAuth.service');

const ML_API_BASE = 'https://api.mercadolibre.com';

// Mercado Libre acepta máximo 50 resultados por llamada en /orders/search.
// Si se piden más, se pagina con offset (máx. 200 por consulta).
const ML_PAGE_SIZE = 50;
const ML_MAX_RESULTS = 200;

async function getOrders(query = {}, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  const auth = ctx.email ? await getAuthAsync(ctx.email) : getAuth();
  if (!token || !auth.userId) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const wanted = query.limit ? Math.min(parseInt(query.limit, 10) || 50, ML_MAX_RESULTS) : 50;
  const startOffset = query.offset ? parseInt(query.offset, 10) : 0;

  const baseParams = {
    seller: auth.userId,
    sort: 'date_desc',
  };

  // order.status solo acepta estados de ORDEN de ML: cualquier otro valor
  // (p.ej. un estado de envío) se ignora en vez de romper la consulta.
  const ORDER_STATUSES = ['paid', 'cancelled'];
  if (query.status && query.status !== 'all' && ORDER_STATUSES.includes(query.status)) {
    baseParams['order.status'] = query.status;
  }
  if (query.q) {
    baseParams.q = query.q;
  }
  if (query.dateFrom) {
    baseParams['order.date_created.from'] = query.dateFrom;
  }
  if (query.dateTo) {
    baseParams['order.date_created.to'] = query.dateTo;
  }

  let allResults = [];
  let firstPaging = null;
  for (let offset = startOffset; allResults.length < wanted; offset += ML_PAGE_SIZE) {
    const need = Math.min(ML_PAGE_SIZE, wanted - allResults.length);
    let searchRes;
    try {
      searchRes = await axios.get(`${ML_API_BASE}/orders/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ...baseParams, limit: need, offset },
      });
    } catch (err) {
      const detail = err.response?.data?.message || err.response?.data?.error || err.message;
      throw new Error(`Mercado Libre rechazó la consulta de ventas: ${detail}`);
    }
    const page = searchRes.data.results || [];
    if (!firstPaging) firstPaging = searchRes.data.paging;
    if (page.length === 0) break;
    allResults = allResults.concat(page);
    if (page.length < need) break;
  }

  let packingMeta = {};
  try {
    const { refreshPackingFromNeon } = require('../db/store');
    packingMeta = await refreshPackingFromNeon();
  } catch {
    const { getPackingMetadata } = require('../db/store');
    packingMeta = getPackingMetadata();
  }

  const enrichedResults = allResults.map(o => {
    const shippingId = o.shipping?.id ? String(o.shipping.id) : null;
    const packing = shippingId ? (packingMeta[shippingId] || null) : null;
    return {
      ...o,
      packing
    };
  });

  return {
    results: enrichedResults,
    total: firstPaging?.total || 0,
    paging: firstPaging,
    serverTime: new Date().toISOString(),
    connected: true,
  };
}

async function getOrderById(orderId, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
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
