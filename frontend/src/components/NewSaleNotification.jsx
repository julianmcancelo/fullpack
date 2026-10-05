import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, ExternalLink, Sparkles, DollarSign } from 'lucide-react';

export default function NewSaleNotification({ sale, onClose, onViewOrders }) {
  if (!sale) return null;

  const item = (sale.order_items && sale.order_items[0]?.item) || {};
  const amount = (sale.total_amount || 0).toLocaleString('es-AR');

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-top-4 duration-300">
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 rounded-3xl shadow-2xl border-2 border-yellow-300 flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3 min-w-0">
          <div className="p-2.5 bg-yellow-400 text-slate-950 rounded-2xl shadow-md shrink-0">
            <ShoppingBag className="w-6 h-6 animate-bounce" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 uppercase tracking-wide">
                ¡NUEVA VENTA!
              </span>
              <span className="text-xs font-black text-yellow-200">
                ${amount} ARS
              </span>
            </div>

            <h4 className="text-xs font-black text-white mt-1 line-clamp-1">
              {item.title || 'Producto de Mercado Libre'}
            </h4>

            <p className="text-[11px] text-emerald-100 mt-0.5">
              Comprador: <b>{sale.buyer?.nickname || 'Cliente'}</b> • Orden #{sale.id}
            </p>

            <div className="mt-2.5 flex items-center space-x-2">
              <button
                onClick={() => {
                  if (onViewOrders) onViewOrders();
                  if (onClose) onClose();
                }}
                className="px-3 py-1 bg-white text-emerald-950 font-black text-xs rounded-xl shadow-xs hover:bg-emerald-50 transition"
              >
                Ver en Ventas
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
