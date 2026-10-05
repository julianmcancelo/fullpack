const express = require('express');
const router = express.Router();
const { getOverview } = require('../services/overview.service');

// GET /api/stats/dashboard (resumen canónico compartido con la app móvil)
router.get('/dashboard', async (req, res) => {
  try {
    const data = await getOverview();

    res.json({
      summary: data.summary,
      salesByDay: data.salesByDay,
      lowStockAlerts: data.lowStockItems.slice(0, 6),
      urgentShipments: data.pendingShipments.slice(0, 6),
      recentOrders: data.recentOrders,
      itemsError: data.errors.items,
      ordersError: data.errors.orders,
      shipmentsError: data.errors.shipments,
      serverTime: data.serverTime,
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
        readyToShipCount: 0,
        unpackedCount: 0,
        packedCount: 0,
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
