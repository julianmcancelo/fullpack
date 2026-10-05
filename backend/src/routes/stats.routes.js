const express = require('express');
const router = express.Router();
const { getItems } = require('../services/mlItems.service');
const { getOrders } = require('../services/mlOrders.service');
const { getShipments } = require('../services/mlShipments.service');
const { getSettings } = require('../db/store');

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

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const settings = getSettings();
    const threshold = settings.lowStockThreshold || 5;

    // Parallel fetch from Mercado Libre API
    const [itemsData, ordersData, shipmentsData] = await Promise.all([
      getItems({ limit: 50 }).catch(err => ({ results: [], total: 0, error: err.message })),
      getOrders({ limit: 50 }).catch(err => ({ results: [], total: 0, error: err.message })),
      getShipments({ limit: 50 }).catch(err => ({ results: [], total: 0, error: err.message })),
    ]);

    const items = itemsData.results || [];
    const orders = ordersData.results || [];
    const shipments = shipmentsData.results || [];

    // Financial & Sales metrics
    const totalSalesAmount = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
    const paidOrders = orders.filter(o => o.status === 'paid');
    const totalUnitsSold = orders.reduce((acc, o) => {
      const units = (o.order_items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
      return acc + units;
    }, 0);

    // Stock metrics
    const activeItems = items.filter(i => i.status === 'active');
    const pausedItems = items.filter(i => i.status === 'paused');
    const lowStockItems = items.filter(i => (i.available_quantity || 0) <= threshold && (i.available_quantity || 0) > 0);
    const outOfStockItems = items.filter(i => (i.available_quantity || 0) === 0);

    // Shipments metrics
    const pendingShipments = shipments.filter(s => s.status === 'ready_to_ship');
    const inTransitShipments = shipments.filter(s => s.status === 'shipped');
    const deliveredShipments = shipments.filter(s => s.status === 'delivered');

    // Ventas reales por día (últimos 7 días, zona horaria de Argentina)
    let salesByDay = [];
    try {
      const salesData = await getOrders({ limit: 100 });
      const salesOrders = salesData.results || [];
      const paidSales = salesOrders.filter(o => o.status === 'paid');
      salesByDay = buildSalesByDay(paidSales);
    } catch {
      salesByDay = [];
    }

    res.json({
      summary: {
        totalSalesAmount,
        paidOrdersCount: paidOrders.length,
        totalOrdersCount: ordersData.total || orders.length,
        totalUnitsSold,
        totalItemsCount: itemsData.total || items.length,
        activeItemsCount: activeItems.length,
        pausedItemsCount: pausedItems.length,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        pendingShipmentsCount: pendingShipments.length,
        inTransitShipmentsCount: inTransitShipments.length,
        deliveredShipmentsCount: deliveredShipments.length,
      },
      salesByDay,
      lowStockAlerts: lowStockItems.slice(0, 6),
      urgentShipments: pendingShipments.slice(0, 6),
      recentOrders: orders.slice(0, 6),
      itemsError: itemsData.error,
      ordersError: ordersData.error,
      shipmentsError: shipmentsData.error,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      summary: {
        totalSalesAmount: 0,
        paidOrdersCount: 0,
        totalOrdersCount: 0,
        totalUnitsSold: 0,
        totalItemsCount: 0,
        activeItemsCount: 0,
        pausedItemsCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        pendingShipmentsCount: 0,
        inTransitShipmentsCount: 0,
        deliveredShipmentsCount: 0,
      },
      salesByDay: [],
      lowStockAlerts: [],
      urgentShipments: [],
      recentOrders: [],
      error: err.message,
      serverTime: new Date().toISOString(),
    });
  }
});

module.exports = router;
