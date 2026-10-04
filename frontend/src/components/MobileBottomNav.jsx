import React from 'react';
import { 
  LayoutDashboard, 
  Boxes, 
  Truck, 
  ShoppingCart, 
  QrCode,
  Settings
} from 'lucide-react';

export default function MobileBottomNav({ activeTab, setActiveTab, onOpenScanner }) {
  const tabs = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'scanner_action', label: 'Escanear', icon: QrCode, isAction: true },
    { id: 'shipments', label: 'Envíos', icon: Truck },
    { id: 'orders', label: 'Ventas', icon: ShoppingCart },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 shadow-lg safe-area-bottom">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                onClick={onOpenScanner}
                className="-mt-5 p-3 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 shadow-lg shadow-yellow-400/40 border-4 border-white dark:border-slate-900 flex flex-col items-center justify-center active:scale-95 transition"
                title="Escanear QR con Cámara del Celular"
              >
                <Icon className="w-6 h-6 stroke-[2.5]" />
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
                isActive
                  ? 'text-yellow-600 dark:text-yellow-400 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
