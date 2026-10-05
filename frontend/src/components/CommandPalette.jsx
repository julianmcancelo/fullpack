import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Truck,
  MessageSquare,
  Calculator,
  Settings,
  ArrowRight,
  X,
} from 'lucide-react';

const ACTIONS = [
  { id: 'dashboard', label: 'Dashboard & Estadísticas', icon: LayoutDashboard, category: 'Navegación' },
  { id: 'stock', label: 'Gestión de Stock y Publicaciones (96 ítems)', icon: Boxes, category: 'Navegación' },
  { id: 'orders', label: 'Centro de Ventas y Facturación', icon: ShoppingCart, category: 'Navegación' },
  { id: 'shipments', label: 'Mesa de Empaque y Etiquetas de Envío', icon: Truck, category: 'Navegación' },
  { id: 'questions', label: 'Preguntas y Dudas de Compradores', icon: MessageSquare, category: 'Navegación' },
  { id: 'calculator', label: 'Calculadora de Comisiones y Margen', icon: Calculator, category: 'Herramientas' },
  { id: 'settings', label: 'Credenciales & Configuración API', icon: Settings, category: 'Ajustes' },
];

export default function CommandPalette({ isOpen, onClose, onNavigate, connection }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);

  const filteredActions = ACTIONS.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (tabId) => {
    onNavigate(tabId);
    onClose(false);
  };

  // Keyboard shortcuts + list navigation (the footer advertises both)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(!isOpen);
        return;
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(filteredActions.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        const action = filteredActions[activeIndex];
        if (action) {
          e.preventDefault();
          handleSelect(action.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Keep the highlighted row visible and reset it whenever the query changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="overlay overlay-top">
      <div className="modal modal-lg">
        {/* Encabezado: búsqueda */}
        <div className="flex items-center gap-3 border-b border-line bg-muted/60 px-4 py-3.5 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand-soft text-brand-700">
            <Search className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <input
            type="text"
            placeholder="Escribe un comando o busca una sección... (ej: Stock, Envíos, Ventas)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full border-0 bg-transparent text-base font-semibold text-ink outline-none placeholder:text-ink-subtle"
          />
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Cerrar la paleta de comandos"
            title="Cerrar (ESC)"
            className="shrink-0 rounded-lg p-1.5 text-ink-subtle transition hover:bg-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="kbd hidden shrink-0 sm:inline-flex">ESC</span>
        </div>

        {/* Lista de resultados */}
        <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto p-2 sm:p-3">
          {filteredActions.length > 0 ? (
            filteredActions.map((action, index) => {
              const Icon = action.icon;
              const isActive = index === activeIndex;
              return (
                <button
                  key={action.id}
                  type="button"
                  data-active={isActive}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(action.id)}
                  className={`menu-item group relative overflow-hidden rounded-xl py-3 ${
                    isActive
                      ? 'border-l-[3px] border-brand bg-muted text-ink'
                      : 'border-l-[3px] border-transparent'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-2 transition group-hover:bg-brand group-hover:text-brand-ink ${
                      isActive ? 'bg-card text-ink' : 'bg-muted text-ink-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-ink">{action.label}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                      {action.category}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </button>
              );
            })
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <Search className="h-6 w-6" />
              </div>
              <p className="empty-title">Sin resultados</p>
              <p className="empty-text">
                No se encontraron resultados para "{query}". Probá con otra palabra: Stock, Ventas o
                Envíos.
              </p>
            </div>
          )}
        </div>

        {/* Pie con atajos */}
        <div className="modal-foot justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
            <span>Navegar</span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            <span className="kbd">Enter</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
            <span>Cerrar</span>
            <span className="kbd">ESC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
