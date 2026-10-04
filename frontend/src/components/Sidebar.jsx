import React from 'react';
import { 
  LayoutDashboard, 
  Boxes, 
  ShoppingCart, 
  Truck, 
  MessageSquare,
  Calculator, 
  Smartphone,
  Settings, 
  HelpCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, connection }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'stock', label: 'Stock & Publicaciones', icon: Boxes, badge: '96 Ítems' },
    { id: 'orders', label: 'Ventas & Órdenes', icon: ShoppingCart, badge: null },
    { id: 'shipments', label: 'Logística & Envíos', icon: Truck, badge: 'Etiquetas' },
    { id: 'mobile_terminal', label: 'Terminal Móvil', icon: Smartphone, badge: 'QR/Móvil' },
    { id: 'questions', label: 'Preguntas Clientes', icon: MessageSquare, badge: null },
    { id: 'calculator', label: 'Calculadora ML', icon: Calculator, badge: 'Utilidad' },
    { id: 'settings', label: 'Credenciales & Config', icon: Settings, badge: !connection?.connected ? '!' : null },
  ];

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col justify-between py-6 px-3 flex-shrink-0 transition-colors hidden md:flex">
      <div className="space-y-1">
        <div className="px-3 pb-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>Menú Principal</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500" title="API ML Conectada"></span>
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                isActive
                  ? 'bg-yellow-400 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    item.badge === '!'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : isActive
                      ? 'bg-yellow-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info Card */}
      <div className="mt-8 pt-4 border-t border-slate-200/80 dark:border-slate-800 px-2">
        <div className="p-3.5 bg-slate-900 dark:bg-slate-950 text-white rounded-2xl shadow-md border border-slate-700 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-xs font-bold text-yellow-400">
            <Sparkles className="w-4 h-4" />
            <span>Mercado Libre Pro</span>
          </div>
          <p className="text-[11px] text-slate-300 dark:text-slate-400 mt-1 leading-relaxed">
            Cuenta: <b className="text-white">@{connection?.nickname || 'GRANA3DOK'}</b>
          </p>
          <a
            href="https://developers.mercadolibre.com.ar/devcenter"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-[11px] text-yellow-300 hover:underline mt-2 font-bold"
          >
            <span>DevCenter Oficial</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </aside>
  );
}
