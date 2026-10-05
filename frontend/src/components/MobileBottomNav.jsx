import React from 'react';
import { LayoutDashboard, Boxes, Truck, ShoppingCart, QrCode } from 'lucide-react';

export default function MobileBottomNav({ activeTab, setActiveTab, onOpenScanner }) {
  const tabs = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'scanner_action', label: 'Escanear', icon: QrCode, isAction: true },
    { id: 'shipments', label: 'Envíos', icon: Truck },
    { id: 'orders', label: 'Ventas', icon: ShoppingCart },
  ];

  return (
    <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-card/90 px-2 pb-1.5 pt-2 shadow-pop backdrop-blur-xl backdrop-saturate-150 md:hidden">
      <div className="mx-auto flex max-w-md items-end justify-around gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={onOpenScanner}
                title="Escanear QR con la cámara del celular"
                aria-label="Escanear QR con la cámara del celular"
                className="fab"
              >
                <Icon className="h-6 w-6" strokeWidth={2.5} />
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`mobile-tab relative ${isActive ? 'mobile-tab-active' : ''}`}
            >
              <span
                className={`absolute top-0 h-0.5 w-6 rounded-full transition-colors duration-200 ${
                  isActive ? 'bg-brand-400' : 'bg-transparent'
                }`}
              />
              <Icon
                className={`h-5 w-5 transition-colors duration-200 ${
                  isActive ? 'text-brand-500' : ''
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
