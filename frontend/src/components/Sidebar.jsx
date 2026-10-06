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
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab, connection, onOpenPairDevice, stats, shipments, pendingAdmins = 0, actingAsEmail = null, onStopSupervising }) {
  // Dos capacidades distintas, no una sola:
  //   isSuperAdmin -> gestiona las cuentas de la plataforma (sección Plataforma)
  //   isSupervisor -> puede operar la cuenta de otro usuario (sección Supervisión)
  // El Admin tiene la segunda y NO la primera.
  const { isSuperAdmin, isSupervisor } = useAuth();
  const summary = stats?.summary || {};
  // Solo se muestra badge con dato real ya cargado: nunca 0 ni inventados.
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('es-AR') : null);
  const pendingPack = Array.isArray(shipments)
    ? shipments.filter((s) => s.status === 'ready_to_ship' && !s.packing?.packed).length
    : null;
  const stockCount = num(summary.totalItemsCount);
  const paidCount = num(summary.paidOrdersCount);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null, title: null },
    { id: 'stock', label: 'Stock & Publicaciones', icon: Boxes, badge: stockCount, title: stockCount ? `${stockCount} publicaciones` : null },
    { id: 'orders', label: 'Ventas & Órdenes', icon: ShoppingCart, badge: paidCount, title: paidCount ? `${paidCount} órdenes pagadas` : null },
    { id: 'shipments', label: 'Logística & Envíos', icon: Truck, badge: pendingPack, title: pendingPack != null ? `${pendingPack} por empaquetar` : null },
    { id: 'mobile_terminal', label: 'Terminal Móvil', icon: Smartphone, badge: null, title: null },
    { id: 'questions', label: 'Preguntas Clientes', icon: MessageSquare, badge: null, title: null },
    { id: 'calculator', label: 'Calculadora ML', icon: Calculator, badge: null, title: null },
    // Sección de SUPERVISIÓN (Admin y SuperAdmin): operar la cuenta de otro.
    // No gestiona cuentas: sólo se entra a mirar y trabajar su operación.
    ...(isSupervisor
      ? [
          {
            id: 'adminsupervision',
            label: 'Supervisión',
            icon: Eye,
            badge: null,
            title: null,
            group: 'supervision',
          },
        ]
      : []),
    // Sección de PLATAFORMA (sólo SuperAdmin): gestión de cuentas de usuario.
    ...(isSuperAdmin
      ? [
          {
            id: 'superadmin',
            label: 'Administración',
            icon: ShieldCheck,
            badge: pendingAdmins || null,
            title: pendingAdmins ? `${pendingAdmins} pendientes de aprobación` : null,
            group: 'platform',
          },
        ]
      : []),
    {
      id: 'settings',
      label: 'Credenciales & Config',
      icon: Settings,
      badge: !connection?.connected ? '!' : null,
      title: !connection?.connected ? 'Cuenta sin conectar' : null,
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
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            // Separador con título antes de cada sección de gestión.
            const previous = navItems[index - 1];
            const startsGroup = item.group && (!previous || previous.group !== item.group);
            return (
              <React.Fragment key={item.id}>
                {startsGroup && (
                  <div className="px-3 pb-1 pt-5">
                    <span className="nav-label !px-0">
                      {item.group === 'platform'
                        ? 'Plataforma'
                        : item.group === 'supervision'
                          ? 'Supervisión'
                          : ''}
                    </span>
                  </div>
                )}
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? '' : 'text-ink-subtle'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="truncate">{item.label}</span>
                </span>

                {item.badge != null && (
                  <span
                    title={item.title || undefined}
                    className={`badge shrink-0 !px-2 tabular ${
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
              </React.Fragment>
            );
          })}
        </nav>

        {/* Aviso persistente mientras se está operando la cuenta de otro. Sin
            esto el Supervisor podría creerse estar en su propia tienda. */}
        {actingAsEmail && (
          <div className="mt-5 rounded-2xl border border-warning/40 bg-warning-soft px-3.5 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-warning">
              Operando otra cuenta
            </p>
            <p className="mt-1 truncate font-mono text-[11px] font-semibold text-ink">
              {actingAsEmail}
            </p>
            <button
              type="button"
              onClick={onStopSupervising}
              className="btn btn-outline btn-sm mt-2 w-full"
            >
              Volver a mi cuenta
            </button>
          </div>
        )}
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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink">
              <Smartphone className="h-4 w-4" />
            </span>
            <span>Vincular celular</span>
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-muted">
            Mostrá el código QR en pantalla y escanealo con la app Plataforma.
          </span>
        </button>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-gradient p-4 text-white shadow-card">
          <span className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full bg-brand/25 blur-2xl" />
          <div className="relative flex items-center gap-2 text-xs font-bold text-brand-300">
            <Sparkles className="h-4 w-4" />
            <span>Mercado Libre Pro</span>
          </div>
          <p className="relative mt-1.5 text-[11px] leading-relaxed text-white/70">
            Cuenta: <b className="text-white">@{connection?.nickname || 'Mi tienda'}</b>
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
