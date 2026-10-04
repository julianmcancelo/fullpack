const express = require('express');
const router = express.Router();
const { getItems } = require('../services/mlItems.service');
const { getOrders } = require('../services/mlOrders.service');
const { getShipments } = require('../services/mlShipments.service');
const { getSettings } = require('../db/store');

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
      lowStockAlerts: lowStockItems.slice(0, 6),
      urgentShipments: pendingShipments.slice(0, 6),
      recentOrders: orders.slice(0, 6),
      itemsError: itemsData.error,
      ordersError: ordersData.error,
      shipmentsError: shipmentsData.error,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
