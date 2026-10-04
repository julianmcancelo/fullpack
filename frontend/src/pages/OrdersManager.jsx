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
  AlertCircle
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
    <div className="space-y-6">
      
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Centro de Ventas y Órdenes</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Historial de ventas, comisiones de Mercado Libre, cobros y datos del comprador.
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-600' : ''}`} />
          <span>Actualizar Ventas</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ID de orden, Comprador o Producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        </form>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Todas las Ventas' },
            { id: 'paid', label: 'Pagadas / Acreditadas' },
            { id: 'cancelled', label: 'Canceladas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* Orders List / Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />
            <p className="text-xs">Consultando órdenes en Mercado Libre...</p>
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
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition"
              >
                {/* Main Order Row */}
                <div
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  onClick={() => toggleExpand(order.id)}
                >
                  {/* Left: ID, Date, Buyer */}
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div className="p-3 bg-yellow-50 rounded-xl text-slate-900 font-bold text-xs shrink-0 border border-yellow-200">
                      <ShoppingCart className="w-5 h-5 text-yellow-600" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-slate-900">
                          Orden #{order.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            order.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {order.status === 'paid' ? 'Pagada' : order.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1 line-clamp-1 font-medium">
                        {itemsList.map((it) => `${it.quantity}x ${it.item?.title || 'Producto'}`).join(', ')}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-400">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(order.date_created)}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 text-slate-600">
                          <User className="w-3 h-3" />
                          <span>{order.buyer?.first_name ? `${order.buyer.first_name} ${order.buyer.last_name || ''}` : order.buyer?.nickname}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amounts & Toggle */}
                  <div className="flex items-center justify-between md:justify-end space-x-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <div className="text-base font-black text-slate-900">
                        {formatMoney(order.total_amount)}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-semibold">
                        Neto a recibir: {formatMoney(netAmount)}
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-50">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-5 space-y-4">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Products breakdown */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                          Productos en la Orden
                        </h4>
                        <div className="divide-y divide-slate-100">
                          {itemsList.map((it, idx) => (
                            <div key={idx} className="py-2 first:pt-0 last:pb-0 text-xs">
                              <p className="font-semibold text-slate-800">{it.item?.title}</p>
                              <div className="flex justify-between text-slate-500 mt-1">
                                <span>{it.quantity} x {formatMoney(it.unit_price)}</span>
                                <span className="font-bold text-slate-900">{formatMoney(it.quantity * it.unit_price)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Buyer and Shipping Details */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                          Comprador y Envío
                        </h4>
                        <div className="text-xs space-y-1.5 text-slate-600">
                          <p className="font-bold text-slate-900">
                            {order.buyer?.first_name ? `${order.buyer.first_name} ${order.buyer.last_name || ''}` : order.buyer?.nickname}
                          </p>
                          <p className="text-[11px] text-slate-400">Usuario: @{order.buyer?.nickname}</p>
                          {order.buyer?.email && <p className="text-[11px]">Email: {order.buyer.email}</p>}
                          {order.buyer?.phone?.number && (
                            <p className="text-[11px]">Tel: ({order.buyer.phone.area_code}) {order.buyer.phone.number}</p>
                          )}
                          {order.shipping?.receiver_address && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-start space-x-1.5 text-[11px] text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span>
                                {order.shipping.receiver_address.street_name} {order.shipping.receiver_address.street_number},{' '}
                                {order.shipping.receiver_address.city?.name}, {order.shipping.receiver_address.state?.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Financial Detail */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                          Liquidación de Dinero
                        </h4>
                        <div className="text-xs space-y-1.5">
                          <div className="flex justify-between text-slate-600">
                            <span>Cobro bruto:</span>
                            <span>{formatMoney(order.total_amount)}</span>
                          </div>
                          <div className="flex justify-between text-rose-600">
                            <span>Comisión ML (aprox):</span>
                            <span>-{formatMoney(saleFee || (order.total_amount * 0.13))}</span>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex justify-between font-extrabold text-emerald-700 text-sm">
                            <span>Neto acreditado:</span>
                            <span>{formatMoney(netAmount)}</span>
                          </div>
                          {primaryPayment?.payment_method_id && (
                            <p className="text-[11px] text-slate-400 mt-2">
                              Medio: {primaryPayment.payment_method_id.toUpperCase()}
                            </p>
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                )}

              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
            <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No se encontraron ventas con los filtros aplicados.</p>
          </div>
        )}
      </div>

    </div>
  );
}
