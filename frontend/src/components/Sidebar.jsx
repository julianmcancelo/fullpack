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
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, connection, onOpenPairDevice }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'stock', label: 'Stock & Publicaciones', icon: Boxes, badge: '96 Ítems' },
    { id: 'orders', label: 'Ventas & Órdenes', icon: ShoppingCart, badge: null },
    { id: 'shipments', label: 'Logística & Envíos', icon: Truck, badge: 'Etiquetas' },
    { id: 'mobile_terminal', label: 'Terminal Móvil', icon: Smartphone, badge: 'QR/Móvil' },
    { id: 'questions', label: 'Preguntas Clientes', icon: MessageSquare, badge: null },
    { id: 'calculator', label: 'Calculadora ML', icon: Calculator, badge: 'Utilidad' },
    {
      id: 'settings',
      label: 'Credenciales & Config',
      icon: Settings,
      badge: !connection?.connected ? '!' : null,
    },
  ];

  const connected = Boolean(connection?.connected);

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-line bg-card px-3 py-6 transition-colors md:flex">
      <div>
        <div className="flex items-center justify-between px-3 pb-3">
          <span className="nav-label !px-0">Menú principal</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse-ring bg-success' : 'bg-warning'}`}
            title={connected ? 'API de Mercado Libre conectada' : 'API desconectada'}
          />
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? '' : 'text-ink-subtle'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span>{item.label}</span>
                </span>

                {item.badge && (
                  <span
                    className={`badge !px-2 ${
                      item.badge === '!'
                        ? 'badge-danger animate-pulse'
                        : isActive
                          ? 'border-transparent bg-brand-ink/15 text-brand-ink'
                          : 'badge-neutral'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer info card */}
      <div className="mt-8 space-y-3 border-t border-line px-1 pt-5">
        {/* Acceso directo a la vinculación del celular: es el paso que pide la app. */}
        <button
          type="button"
          onClick={onOpenPairDevice}
          className="group w-full rounded-2xl border border-accent/30 bg-accent-soft p-3.5 text-left transition-all duration-200 ease-spring hover:border-accent/60 hover:shadow-glow-accent"
        >
          <span className="flex items-center gap-2 text-xs font-extrabold text-accent">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
              <Smartphone className="h-4 w-4" />
            </span>
            <span>Vincular celular</span>
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-muted">
            Mostrá el código QR en pantalla y escanealo con la app ML Pro Mobile.
          </span>
        </button>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-gradient p-4 text-white shadow-card">
          <span className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-brand/25 blur-2xl" />
          <div className="relative flex items-center gap-2 text-xs font-bold text-brand-300">
            <Sparkles className="h-4 w-4" />
            <span>Mercado Libre Pro</span>
          </div>
          <p className="relative mt-1.5 text-[11px] leading-relaxed text-white/70">
            Cuenta: <b className="text-white">@{connection?.nickname || 'GRANA3DOK'}</b>
          </p>
          <a
            href="https://developers.mercadolibre.com.ar/devcenter"
            target="_blank"
            rel="noopener noreferrer"
            className="relative mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-brand-300 transition hover:text-brand-200 hover:underline"
          >
            <span>DevCenter oficial</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </aside>
  );
}
