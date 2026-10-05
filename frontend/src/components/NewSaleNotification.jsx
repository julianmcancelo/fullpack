import React from 'react';
import { ShoppingBag, X, ExternalLink, Sparkles, DollarSign } from 'lucide-react';

export default function NewSaleNotification({ sale, onClose, onViewOrders }) {
  if (!sale) return null;

  const item = (sale.order_items && sale.order_items[0]?.item) || {};
  const amount = (sale.total_amount || 0).toLocaleString('es-AR');

  return (
    <div className="fixed top-4 right-4 left-4 z-50 animate-slide-down sm:left-auto sm:w-96">
      <div className="card card-accent overflow-hidden border-brand/40 shadow-pop">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="kpi-icon kpi-icon-brand shrink-0">
              <ShoppingBag className="h-5 w-5 animate-bounce" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="badge badge-brand">
                  <Sparkles className="h-3 w-3" />
                  ¡Nueva venta!
                </span>
                <span className="tabular inline-flex items-center gap-0.5 font-display text-xl font-extrabold leading-none text-ink">
                  <DollarSign className="h-4 w-4 text-success" />
                  {amount}
                </span>
              </div>

              <h4 className="mt-2 line-clamp-1 font-display text-sm font-extrabold tracking-tight text-ink">
                {item.title || 'Producto de Mercado Libre'}
              </h4>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                <span className="badge badge-neutral">
                  {sale.buyer?.nickname || 'Cliente'}
                </span>
                <span className="tabular">Orden #{sale.id}</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onViewOrders) onViewOrders();
                    if (onClose) onClose();
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver la orden
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar la notificación de venta"
            title="Cerrar"
            className="btn btn-ghost btn-icon-sm shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
