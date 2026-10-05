import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  RefreshCw, 
  User, 
  CreditCard, 
  DollarSign, 
  Truck, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  AlertCircle,
  QrCode,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

export default function OrdersManager({ connection }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [error, setError] = useState(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (search) {
        params.q = search;
      }

      const res = await api.getOrders(params);
      setOrders(res.results || []);
    } catch (err) {
      console.error('Error al cargar órdenes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadOrders();
  };

  const toggleExpand = (orderId) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="page">

      {/* Cabecera y acciones */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Centro de Ventas y Órdenes</h1>
          <p className="page-sub">
            Historial de ventas, comisiones de Mercado Libre, cobros y datos del comprador.
          </p>
        </div>

        <div className="toolbar">
          <button
            onClick={loadOrders}
            className="btn btn-outline btn-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Actualizar Ventas</span>
          </button>
        </div>
      </div>

      {/* Tira de resumen */}
      <div className="stat-strip">
        <span className="flex items-center gap-2 text-xs font-bold text-ink-muted">
          <ShoppingCart className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Órdenes listadas
          <span className="tabular text-sm font-extrabold text-ink">
            {loading ? '—' : orders.length}
          </span>
        </span>

        <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />

        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <CreditCard className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>Cobros, comisiones y neto acreditado en el detalle de cada venta.</span>
        </span>
      </div>

      {/* Alerta de error */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs font-semibold text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="card card-pad">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por ID de orden, Comprador o Producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-search text-xs"
            />
          </form>

          <div className="segmented flex-wrap">
            {[
              { id: 'all', label: 'Todas las Ventas' },
              { id: 'paid', label: 'Pagadas / Acreditadas' },
              { id: 'cancelled', label: 'Canceladas' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                aria-pressed={statusFilter === tab.id}
                className={`segmented-btn whitespace-nowrap ${
                  statusFilter === tab.id ? 'segmented-btn-active' : ''
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Listado de órdenes */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="card card-pad" aria-busy="true">
            <div className="flex items-center gap-3.5">
              <div className="skeleton h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-3.5 w-40 max-w-full" />
                <div className="skeleton h-3 w-56 max-w-full" />
                <div className="skeleton h-3 w-32 max-w-full" />
              </div>
              <div className="hidden shrink-0 space-y-2 sm:block">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-3 w-20" />
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-subtle">Consultando órdenes en Mercado Libre...</p>
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const itemsList = order.order_items || [];
            const primaryItem = itemsList[0]?.item;
            const primaryPayment = order.payments?.[0];
            const netAmount = primaryPayment?.net_received_amount || order.total_amount;
            const saleFee = itemsList.reduce((acc, it) => acc + (it.sale_fee || 0), 0);

            return (
              <React.Fragment key={order.id}>
                <div className="card card-hover overflow-hidden">

                  {/* Fila principal de la orden */}
                  <div
                    className="flex cursor-pointer select-none flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between"
                    onClick={() => toggleExpand(order.id)}
                  >
                    {/* Orden, artículos, fecha y comprador */}
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand-soft text-brand-700">
                        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-extrabold text-ink">
                            Orden #{order.id}
                          </span>

                          <span className={`badge ${order.status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                            {order.status === 'paid' ? 'Pagada' : order.status}
                          </span>

                          {/* Estado de empaque / escaneo */}
                          {order.packing?.packed ? (
                            <span className="badge badge-success">
                              <QrCode className="h-3 w-3" aria-hidden="true" />
                              <span>Leído por lector QR · listo</span>
                            </span>
                          ) : order.shipping?.id ? (
                            <span className="badge badge-warning">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              <span>Pendiente escaneo</span>
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 line-clamp-1 text-xs font-medium text-ink-muted">
                          {itemsList.map((it) => `${it.quantity}x ${it.item?.title || 'Producto'}`).join(', ')}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
                            <span>{formatDate(order.date_created)}</span>
                          </span>
                          <span aria-hidden="true">•</span>
                          <span className="flex items-center gap-1.5 text-ink-muted">
                            <span className="avatar flex h-5 w-5 items-center justify-center bg-muted">
                              <User className="h-3 w-3 text-ink-subtle" aria-hidden="true" />
                            </span>
                            <span>{order.buyer?.first_name ? `${order.buyer.first_name} ${order.buyer.last_name || ''}` : order.buyer?.nickname}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Importes y control de detalle */}
                    <div className="flex items-center justify-between gap-5 border-t border-line pt-3 md:justify-end md:border-t-0 md:pt-0">
                      <div className="text-left md:text-right">
                        <div className="tabular text-base font-black text-ink">
                          {formatMoney(order.total_amount)}
                        </div>
                        <div className="text-[11px] font-semibold text-success">
                          Neto a recibir: <span className="tabular">{formatMoney(netAmount)}</span>
                        </div>
                      </div>

                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-muted text-ink-subtle"
                        aria-hidden="true"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalle expandible de la orden */}
                {isExpanded && (
                  <div className="overlay" role="dialog" aria-modal="true" aria-label={`Detalle de la orden ${order.id}`}>
                    <div className="modal modal-lg">

                      <div className="modal-head">
                        <div className="min-w-0">
                          <h2 className="modal-title">Orden #{order.id}</h2>
                          <p className="modal-sub">
                            {formatDate(order.date_created)} · {itemsList.length} {itemsList.length === 1 ? 'producto' : 'productos'}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`badge ${order.status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                            {order.status === 'paid' ? 'Pagada' : order.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpand(order.id)}
                            className="modal-close"
                            title="Cerrar detalle"
                            aria-label="Cerrar detalle de la orden"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="modal-body">

                        {/* Productos de la orden */}
                        <div className="rounded-xl border border-line bg-muted/50 p-4">
                          <h3 className="section-title mb-3 flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-brand-600" aria-hidden="true" />
                            Productos en la orden
                          </h3>

                          <div className="divide-y divide-line">
                            {itemsList.map((it, idx) => (
                              <div key={idx} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-muted">
                                  {it.item?.thumbnail ? (
                                    <img src={it.item.thumbnail} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <ShoppingCart className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-ink">{it.item?.title}</p>
                                  <p className="mt-0.5 text-[11px] text-ink-subtle">
                                    {it.quantity} x <span className="tabular">{formatMoney(it.unit_price)}</span>
                                  </p>
                                </div>

                                <span className="tabular shrink-0 text-xs font-bold text-ink">
                                  {formatMoney(it.quantity * it.unit_price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                          {/* Comprador y envío */}
                          <div className="rounded-xl border border-line bg-muted/50 p-4">
                            <h3 className="section-title mb-3 flex items-center gap-2">
                              <Truck className="h-4 w-4 text-accent" aria-hidden="true" />
                              Comprador y envío
                            </h3>

                            <div className="space-y-1.5 text-xs text-ink-muted">
                              <p className="font-bold text-ink">
                                {order.buyer?.first_name ? `${order.buyer.first_name} ${order.buyer.last_name || ''}` : order.buyer?.nickname}
                              </p>
                              <p className="text-[11px] text-ink-subtle">Usuario: @{order.buyer?.nickname}</p>
                              {order.buyer?.email && <p className="text-[11px]">Email: {order.buyer.email}</p>}
                              {order.buyer?.phone?.number && (
                                <p className="text-[11px]">Tel: ({order.buyer.phone.area_code}) {order.buyer.phone.number}</p>
                              )}
                              {order.shipping?.receiver_address && (
                                <div className="mt-2 flex items-start gap-1.5 border-t border-line pt-2 text-[11px] text-ink-muted">
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                                  <span>
                                    {order.shipping.receiver_address.street_name} {order.shipping.receiver_address.street_number},{' '}
                                    {order.shipping.receiver_address.city?.name}, {order.shipping.receiver_address.state?.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Liquidación del dinero */}
                          <div className="rounded-xl border border-line bg-muted/50 p-4">
                            <h3 className="section-title mb-3 flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-success" aria-hidden="true" />
                              Liquidación de dinero
                            </h3>

                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-3 text-ink-muted">
                                <span>Cobro bruto</span>
                                <span className="tabular font-semibold text-ink">{formatMoney(order.total_amount)}</span>
                              </div>

                              <div className="flex items-center justify-between gap-3 text-danger">
                                <span>Comisión ML (aprox.)</span>
                                <span className="tabular font-semibold">-{formatMoney(saleFee || (order.total_amount * 0.13))}</span>
                              </div>

                              <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 text-sm font-extrabold text-success">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  Neto acreditado
                                </span>
                                <span className="tabular">{formatMoney(netAmount)}</span>
                              </div>

                              {primaryPayment?.payment_method_id && (
                                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-subtle">
                                  <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                                  Medio: {primaryPayment.payment_method_id.toUpperCase()}
                                </p>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>

                      <div className="modal-foot">
                        <button
                          type="button"
                          onClick={() => toggleExpand(order.id)}
                          className="btn btn-outline btn-sm"
                        >
                          Cerrar
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        ) : (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">
                <ShoppingCart className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="empty-title">Sin ventas para mostrar</p>
              <p className="empty-text">No se encontraron ventas con los filtros aplicados.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
