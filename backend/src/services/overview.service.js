const { getItems } = require('./mlItems.service');
const { getOrders } = require('./mlOrders.service');
const { buildShipmentsFromOrders } = require('./mlShipments.service');
const { getValidAccessToken } = require('./mlAuth.service');
const { getSettings } = require('../db/store');

// Ventanas canónicas: TODAS las pantallas (web y móvil) calculan sobre estas
// mismas ventanas, así los números coinciden en todos lados.
// - Órdenes/dinero: últimas 100 (2 páginas de ML).
// - Envíos: envíos de las últimas 50 órdenes (1 página + estados en vivo).
// - Publicaciones: últimas 50.
const ORDERS_WINDOW = 100;
const SHIPMENTS_WINDOW = 50;
const ITEMS_WINDOW = 50;

const SALES_TZ = 'America/Argentina/Buenos_Aires';
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function toBaKey(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: SALES_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return null;
  }
}

function baWeekday(date) {
  try {
    const baStr = date.toLocaleString('en-US', { timeZone: SALES_TZ });
    return new Date(baStr).getDay();
  } catch {
    return date.getDay();
  }
}

function buildSalesByDay(paidOrders) {
  const now = new Date();
  const buckets = [];
  const keyToIndex = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = toBaKey(d);
    const label = DAY_SHORT[baWeekday(d)] || '';
    if (key && !(key in keyToIndex)) {
      keyToIndex[key] = buckets.length;
      buckets.push({ key, day: label, total: 0, ordenes: 0 });
    }
  }
  for (const o of paidOrders || []) {
    const rawDate = o.date_created || o.created_at || o.date_closed;
    if (!rawDate) continue;
    const key = toBaKey(rawDate);
    if (!key || !(key in keyToIndex)) continue;
    const bucket = buckets[keyToIndex[key]];
    bucket.total += Number(o.total_amount || 0);
    bucket.ordenes += 1;
  }
  return buckets.map(({ day, total, ordenes }) => ({
    day,
    total: Math.round(total * 100) / 100,
    ordenes,
  }));
}

// Resumen canónico compartido por /stats/dashboard y /mobile/bootstrap.
// Dinero y unidades: SOLO órdenes pagadas (las canceladas no son ventas).
// `ctx.email` selecciona la cuenta de ML (Fase 2 multi-usuario).
async function getOverview(ctx = {}) {
  const settings = getSettings();
  const threshold = settings.lowStockThreshold || 5;

  const [itemsData, ordersData] = await Promise.all([
    getItems({ limit: ITEMS_WINDOW }, ctx).catch((err) => ({ results: [], total: 0, error: err.message })),
    getOrders({ limit: ORDERS_WINDOW }, ctx).catch((err) => ({ results: [], total: 0, error: err.message })),
  ]);

  const items = itemsData.results || [];
  const orders = ordersData.results || [];
  const paidOrders = orders.filter((o) => o.status === 'paid');

  let shipments = [];
  let shipmentsError = null;
  try {
    const token = await getValidAccessToken(ctx.email);
    shipments = await buildShipmentsFromOrders(orders.slice(0, SHIPMENTS_WINDOW), token, {});
  } catch (err) {
    shipmentsError = err.message;
  }

  const totalSalesAmount = paidOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
  const totalUnitsSold = paidOrders.reduce((acc, o) => {
    const units = (o.order_items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
    return acc + units;
  }, 0);

  const activeItems = items.filter((i) => i.status === 'active');
  const pausedItems = items.filter((i) => i.status === 'paused');
  const lowStockItems = items.filter(
    (i) => Number(i.available_quantity || 0) <= threshold && Number(i.available_quantity || 0) > 0,
  );
  const outOfStockItems = items.filter((i) => Number(i.available_quantity || 0) === 0);

  const readyToShip = shipments.filter((s) => s.status === 'ready_to_ship');
  const unpackedReady = readyToShip.filter((s) => !s.packing?.packed);
  const packedReady = readyToShip.filter((s) => s.packing?.packed);
  const inTransit = shipments.filter((s) => s.status === 'shipped');
  const delivered = shipments.filter((s) => s.status === 'delivered');

  return {
    items,
    itemsData,
    orders,
    ordersData,
    shipments,
    summary: {
      totalSalesAmount: Math.round(totalSalesAmount * 100) / 100,
      paidOrdersCount: paidOrders.length,
      totalOrdersCount: ordersData.total || orders.length,
      totalUnitsSold,
      totalItemsCount: itemsData.total || items.length,
      activeItemsCount: activeItems.length,
      pausedItemsCount: pausedItems.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      pendingShipmentsCount: readyToShip.length,
      readyToShipCount: readyToShip.length,
      unpackedCount: unpackedReady.length,
      packedCount: packedReady.length,
      inTransitShipmentsCount: inTransit.length,
      deliveredShipmentsCount: delivered.length,
    },
    salesByDay: buildSalesByDay(paidOrders),
    lowStockItems,
    pendingShipments: readyToShip,
    recentOrders: orders.slice(0, 6),
    errors: {
      items: itemsData.error || null,
      orders: ordersData.error || null,
      shipments: shipmentsError,
    },
    serverTime: new Date().toISOString(),
  };
}

module.exports = {
  getOverview,
  ORDERS_WINDOW,
  SHIPMENTS_WINDOW,
  ITEMS_WINDOW,
};
