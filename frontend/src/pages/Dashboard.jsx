import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Package, 
  Boxes, 
  Truck, 
  AlertTriangle, 
  ArrowUpRight, 
  Clock, 
  ChevronRight,
  TrendingUp,
  FileText,
  Sparkles,
  BarChart3,
  CreditCard,
  CheckCircle2,
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid
} from 'recharts';
import { api } from '../services/api';

export default function Dashboard({ stats, loading, onNavigate, onRefresh, connection }) {
  const summary = stats?.summary || {
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
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const averageTicket = summary.paidOrdersCount > 0 
    ? Math.round(summary.totalSalesAmount / summary.paidOrdersCount) 
    : 0;

  // Reputación real desde la API (connection.sellerReputation)
  const powerStatus =
    typeof connection?.sellerReputation?.power_seller_status === 'string' &&
    connection.sellerReputation.power_seller_status.trim() !== ''
      ? connection.sellerReputation.power_seller_status.trim()
      : null;
  const powerLabel = powerStatus
    ? powerStatus.charAt(0).toUpperCase() + powerStatus.slice(1).toLowerCase()
    : null;

  const subtitle = connection?.connected
    ? `Monitoreo oficial de la tienda: @${connection.nickname}${powerLabel ? ` (MercadoLíder ${powerLabel})` : ''}`
    : 'Resumen en tiempo real de tu tienda en Mercado Libre';

  // Gráfico real: últimos 7 días desde la API (stats.salesByDay)
  const salesByDay = Array.isArray(stats?.salesByDay) ? stats.salesByDay : [];
  const salesChartData = salesByDay.map((d) => ({
    day: d.day,
    total: Number(d.total) || 0,
    ordenes: Number(d.ordenes) || 0,
  }));

  // Widget "Últimas ventas": ya viene del backend en stats.recentOrders.
  const recentOrders = Array.isArray(stats?.recentOrders) ? stats.recentOrders : [];

  // Hora local de la última sincronización (solo presentación).
  const [lastSync, setLastSync] = useState(null);
  useEffect(() => {
    if (stats) setLastSync(new Date());
  }, [stats]);

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
  };

  const formatSyncTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Errores parciales no bloqueantes (catálogo / ventas / envíos)
  const staleSources = [
    stats?.itemsError ? 'catálogo' : null,
    stats?.ordersError ? 'ventas' : null,
    stats?.shipmentsError ? 'envíos' : null,
  ].filter(Boolean);

  return (
    <div className="page">

      {/* Encabezado del panel */}
      <div className="page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title text-balance">Panel de Control & KPIs</h1>
            <span className="badge badge-success">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success animate-pulse-ring" aria-hidden="true" />
              API EN VIVO
            </span>
          </div>
          <p className="page-sub text-pretty">
            {subtitle}
            {lastSync && (
              <>
                {' '}· <span className="tabular font-semibold">Actualizado {formatSyncTime(lastSync)}</span>
              </>
            )}
          </p>
        </div>

        <div className="toolbar">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-outline btn-sm"
            title="Actualizar los datos del panel"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>{loading ? 'Actualizando…' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* Aviso no bloqueante: datos parciales desactualizados */}
      {staleSources.length > 0 && (
        <div
          className="flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-xs font-semibold text-warning"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Algunos datos no pudieron actualizarse: {staleSources.join(', ')}.</span>
        </div>
      )}

      {/* Grilla de KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Ventas cobradas */}
        <div className="kpi">
          <div className="flex items-start justify-between gap-3">
            <span className="kpi-label">Ventas Cobradas</span>
            <div className="kpi-icon kpi-icon-success">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="kpi-value tabular break-words">{formatMoney(summary.totalSalesAmount)}</p>
          <div className="kpi-foot">
            <span className="inline-flex items-center gap-1 font-bold text-success">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="tabular">{summary.paidOrdersCount} órdenes</span>
            </span>
            <span className="text-ink-subtle">•</span>
            <span className="tabular">{summary.totalUnitsSold} unidades</span>
          </div>
          <span className="kpi-spark" aria-hidden="true" />
        </div>

        {/* Ticket promedio */}
        <div className="kpi">
          <div className="flex items-start justify-between gap-3">
            <span className="kpi-label">Ticket Promedio</span>
            <div className="kpi-icon kpi-icon-accent">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <p className="kpi-value tabular break-words">{formatMoney(averageTicket)}</p>
          <div className="kpi-foot">
            <span className="inline-flex items-center gap-1 font-bold text-accent">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Por cada venta</span>
            </span>
            <span className="text-ink-subtle">•</span>
            <span>Neto estimado</span>
          </div>
          <span className="kpi-spark" aria-hidden="true" />
        </div>

        {/* Catálogo de ítems */}
        <div className="kpi">
          <div className="flex items-start justify-between gap-3">
            <span className="kpi-label">Catálogo de Ítems</span>
            <div className="kpi-icon kpi-icon-brand">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <p className="kpi-value tabular break-words">
            {summary.totalItemsCount || summary.activeItemsCount + summary.pausedItemsCount}
          </p>
          <div className="kpi-foot">
            <span className="inline-flex items-center gap-1 font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="tabular">{summary.activeItemsCount} activas</span>
            </span>
            <span className="text-ink-subtle">•</span>
            <span className="tabular">{summary.pausedItemsCount} pausadas</span>
          </div>
          <span className="kpi-spark" aria-hidden="true" />
        </div>

        {/* Envíos por despachar */}
        <div className="kpi">
          <div className="flex items-start justify-between gap-3">
            <span className="kpi-label">Por Despachar</span>
            <div className="kpi-icon kpi-icon-warning">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <p className="kpi-value tabular break-words">{summary.pendingShipmentsCount}</p>
          <div className="kpi-foot">
            <span className="inline-flex items-center gap-1 font-bold text-warning">
              <Clock className="h-3.5 w-3.5" />
              <span>Listos en empaque</span>
            </span>
            <span className="text-ink-subtle">•</span>
            <span className="tabular">{summary.inTransitShipmentsCount} en camino</span>
          </div>
          <span className="kpi-spark" aria-hidden="true" />
        </div>

      </div>

      {/* Gráfico de facturación */}
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="kpi-icon kpi-icon-brand">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="card-title">
                <span className="min-w-0">Facturación Semanal & Volumen de Pedidos</span>
              </h2>
              <p className="card-sub">Evolución de ingresos y órdenes cobradas</p>
            </div>
          </div>
          <span className="chip">
            <Sparkles className="h-3.5 w-3.5" />
            Últimos 7 días
          </span>
        </div>

        <div className="card-body">
          {salesChartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.45} />
                    <stop offset="55%" stopColor="rgb(var(--brand))" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="rgb(var(--brand-strong))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line-strong) / 0.6)" vertical={false} />
                <XAxis dataKey="day" stroke="rgb(var(--ink-subtle))" fontSize={12} tickLine={false} axisLine={false} dy={6} />
                <YAxis
                  stroke="rgb(var(--ink-subtle))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip
                  formatter={(val) => [formatMoney(val), 'Facturado']}
                  cursor={{ stroke: 'rgb(var(--ink-subtle) / 0.5)', strokeDasharray: '4 4' }}
                  contentStyle={{
                    backgroundColor: 'rgb(var(--raised))',
                    border: '1px solid rgb(var(--line-strong) / 0.6)',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    color: 'rgb(var(--ink))',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 18px 40px -18px rgb(var(--shadow-color) / 0.45)',
                  }}
                  labelStyle={{ color: 'rgb(var(--ink-subtle))', fontSize: '11px', fontWeight: '700', marginBottom: '2px' }}
                  itemStyle={{ color: 'rgb(var(--brand-strong))' }}
                />
                <Area type="monotone" dataKey="total" stroke="rgb(var(--brand-strong))" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <BarChart3 className="h-6 w-6" />
              </div>
              <p className="empty-title">Sin ventas registradas en los últimos 7 días</p>
              <p className="empty-text">Cuando se concreten ventas, acá verás la evolución diaria de tu facturación.</p>
              <button onClick={handleRefresh} className="btn btn-outline btn-sm mt-2">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reintentar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Envíos urgentes y stock crítico */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Widget: envíos por despachar */}
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">
              <Truck className="h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0">Envíos por Despachar</span>
            </h2>
            <button
              onClick={() => onNavigate('shipments')}
              className="btn btn-ghost btn-xs text-accent"
            >
              <span>Ver todos</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="card-body space-y-3">
            {stats?.urgentShipments && stats.urgentShipments.length > 0 ? (
              stats.urgentShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-muted/60 p-3.5 transition duration-200 ease-spring hover:border-line-strong hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-xs font-bold text-ink">
                        Orden #{shipment.order_id}
                      </span>
                      <span
                        className={`badge ${
                          shipment.logistic_type === 'self_service'
                            ? 'badge-warning'
                            : shipment.logistic_type === 'cross_docking'
                            ? 'badge-info'
                            : shipment.logistic_type === 'fulfillment'
                            ? 'badge-brand'
                            : 'badge-neutral'
                        }`}
                      >
                        {shipment.logistic_type === 'self_service' ? 'FLEX' : shipment.logistic_type === 'cross_docking' ? 'COLECTA' : shipment.logistic_type === 'fulfillment' ? 'FULL' : 'CORREO'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      Destino: {shipment.receiver_address?.city?.name || 'Local'}, {shipment.receiver_address?.state?.name || ''}
                    </p>
                  </div>

                  <a
                    href={api.downloadLabelUrl(shipment.id, 'pdf')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Etiqueta PDF</span>
                  </a>
                </div>
              ))
            ) : (
              <div className="empty">
                <div className="empty-icon">
                  <Truck className="h-6 w-6" />
                </div>
                <p className="empty-title">Todo despachado</p>
                <p className="empty-text">No hay envíos pendientes de despacho por el momento.</p>
                <button onClick={handleRefresh} className="btn btn-outline btn-sm mt-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reintentar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Widget: stock crítico */}
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
              <span className="min-w-0">Alerta de Stock Crítico</span>
            </h2>
            <button
              onClick={() => onNavigate('stock')}
              className="btn btn-ghost btn-xs text-accent"
            >
              <span>Gestionar Stock</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="card-body space-y-3">
            {stats?.lowStockAlerts && stats.lowStockAlerts.length > 0 ? (
              stats.lowStockAlerts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-muted/60 p-3.5 transition duration-200 ease-spring hover:border-danger/40 hover:bg-danger-soft/40"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="avatar h-10 w-10 rounded-xl bg-muted"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-muted">
                        <Package className="h-5 w-5 text-ink-subtle" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-xs font-bold text-ink">
                        {item.title}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="badge badge-danger tabular">
                          {item.available_quantity === 0 ? 'AGOTADO' : `Quedan ${item.available_quantity} unidades`}
                        </span>
                        <span className="tabular text-[11px] text-ink-subtle">
                          • {formatMoney(item.price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('stock')}
                    className="btn btn-danger-soft btn-sm shrink-0"
                  >
                    Reponer
                  </button>
                </div>
              ))
            ) : (
              <div className="empty">
                <div className="empty-icon border-success/25 bg-success-soft text-success">
                  <Boxes className="h-6 w-6" />
                </div>
                <p className="empty-title">Stock bajo control</p>
                <p className="empty-text">¡Excelente! No tienes publicaciones con stock crítico.</p>
                <button onClick={handleRefresh} className="btn btn-outline btn-sm mt-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reintentar</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Widget: últimas ventas (full-width, debajo de la grilla de 2 columnas) */}
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">
            <ShoppingCart className="h-4 w-4 shrink-0 text-success" />
            <span className="min-w-0">Últimas ventas</span>
          </h2>
          <button
            onClick={() => onNavigate('orders')}
            className="btn btn-ghost btn-xs text-accent"
          >
            <span>Ver todas</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="card-body space-y-3">
          {recentOrders.length > 0 ? (
            recentOrders.map((order) => {
              const firstItem = order.order_items?.[0]?.item;
              const title = firstItem?.title || `Orden #${order.id}`;
              const buyer = order.buyer?.first_name
                ? `${order.buyer.first_name} ${order.buyer.last_name || ''}`.trim()
                : order.buyer?.nickname || 'Comprador';
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => onNavigate('orders')}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-muted/60 p-3.5 text-left transition duration-200 ease-spring hover:border-line-strong hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">{title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-muted">
                      <span className="truncate">{buyer}</span>
                      <span aria-hidden="true">•</span>
                      <span className="tabular shrink-0">{formatTime(order.date_created)}</span>
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-extrabold text-ink">
                    {formatMoney(order.total_amount)}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <p className="empty-title">Sin ventas recientes</p>
              <p className="empty-text">Cuando se concreten ventas, acá verás las últimas con su monto, comprador y hora.</p>
              <button onClick={handleRefresh} className="btn btn-outline btn-sm mt-2">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reintentar</span>
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
