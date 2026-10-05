const axios = require('axios');
const { getSettings, getAuth, getAuthAsync } = require('../db/store');
const { getValidAccessToken } = require('./mlAuth.service');

const ML_API_BASE = 'https://api.mercadolibre.com';

async function getItems(query = {}, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  const auth = ctx.email ? await getAuthAsync(ctx.email) : getAuth();
  if (!token || !auth.userId) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre con tus credenciales primero.');
  }

  // 1. Search item IDs of seller
  const params = {
    limit: query.limit ? Math.min(parseInt(query.limit, 10), 50) : 50,
    offset: query.offset ? parseInt(query.offset, 10) : 0,
  };

  if (query.status && query.status !== 'all') {
    params.status = query.status;
  }
  if (query.q) {
    params.q = query.q;
  }

  const searchUrl = `${ML_API_BASE}/users/${auth.userId}/items/search`;
  const searchRes = await axios.get(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

  const itemIds = searchRes.data.results || [];
  if (itemIds.length === 0) {
    return {
      results: [],
      total: searchRes.data.paging?.total || 0,
      paging: searchRes.data.paging || { total: 0, offset: 0, limit: 50 },
    };
  }

  // 2. Multi-get item details in parallel chunks of 20
  const batches = [];
  for (let i = 0; i < itemIds.length; i += 20) {
    batches.push(itemIds.slice(i, i + 20));
  }

  let allItems = [];
  for (const batch of batches) {
    const multiRes = await axios.get(`${ML_API_BASE}/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        ids: batch.join(','),
        attributes: 'id,title,price,currency_id,available_quantity,sold_quantity,status,permalink,thumbnail,pictures,shipping,variations,listing_type_id,date_created,last_updated,condition,category_id',
      },
    });

    const parsed = multiRes.data
      .filter(entry => entry.code === 200 && entry.body)
      .map(entry => entry.body);
    allItems = allItems.concat(parsed);
  }

  const settings = getSettings();
  let filteredResults = allItems;

  if (query.lowStock === 'true') {
    const threshold = settings.lowStockThreshold || 5;
    filteredResults = filteredResults.filter(i => (i.available_quantity || 0) <= threshold && (i.available_quantity || 0) > 0);
  } else if (query.outOfStock === 'true') {
    filteredResults = filteredResults.filter(i => (i.available_quantity || 0) === 0);
  }

  return {
    results: filteredResults,
    total: searchRes.data.paging?.total || filteredResults.length,
    paging: searchRes.data.paging,
  };
}

async function getItemById(itemId, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const res = await axios.get(`${ML_API_BASE}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

async function updateStock(itemId, quantity, variationId = null, ctx = {}) {
  const numQuantity = parseInt(quantity, 10);
  if (isNaN(numQuantity) || numQuantity < 0) {
    throw new Error('La cantidad de stock debe ser un número entero mayor o igual a 0.');
  }

  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  let payload = {};
  if (variationId) {
    payload = {
      variations: [
        {
          id: variationId,
          available_quantity: numQuantity,
        },
      ],
    };
  } else {
    payload = {
      available_quantity: numQuantity,
    };
  }

  const res = await axios.put(`${ML_API_BASE}/items/${itemId}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    success: true,
    message: `Stock de la publicación ${itemId} actualizado exitosamente en Mercado Libre.`,
    data: res.data,
  };
}

async function updatePrice(itemId, price, variationId = null, ctx = {}) {
  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    throw new Error('El precio debe ser un número válido mayor a 0.');
  }

  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  let payload = {};
  if (variationId) {
    payload = {
      variations: [
        {
          id: variationId,
          price: numPrice,
        },
      ],
    };
  } else {
    payload = {
      price: numPrice,
    };
  }

  const res = await axios.put(`${ML_API_BASE}/items/${itemId}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    success: true,
    message: `Precio de la publicación ${itemId} actualizado a $${numPrice} en Mercado Libre.`,
    data: res.data,
  };
}

async function toggleItemStatus(itemId, newStatus, ctx = {}) {
  if (!['active', 'paused', 'closed'].includes(newStatus)) {
    throw new Error(`Estado '${newStatus}' no válido. Valores permitidos: active, paused, closed.`);
  }

  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const res = await axios.put(
    `${ML_API_BASE}/items/${itemId}`,
    { status: newStatus },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    success: true,
    message: `Publicación ${itemId} cambiada a '${newStatus}' en Mercado Libre.`,
    data: res.data,
  };
}

async function batchUpdateStock(updates, ctx = {}) {
  // updates: array of { itemId, variationId, available_quantity, price }
  const results = [];
  for (const item of updates) {
    try {
      let res;
      if (item.available_quantity !== undefined) {
        res = await updateStock(item.itemId, item.available_quantity, item.variationId, ctx);
      }
      if (item.price !== undefined) {
        res = await updatePrice(item.itemId, item.price, item.variationId, ctx);
      }
      results.push({ ...item, success: true, res });
    } catch (err) {
      results.push({
        ...item,
        success: false,
        error: err.response?.data?.message || err.message,
      });
    }
  }
  return results;
}

module.exports = {
  getItems,
  getItemById,
  updateStock,
  updatePrice,
  toggleItemStatus,
  batchUpdateStock,
};
