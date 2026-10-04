import React, { useState, useEffect } from 'react';
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
  Sparkles,
  X,
  ExternalLink
} from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onNavigate, connection }) {
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { id: 'dashboard', label: 'Dashboard & Estadísticas', icon: LayoutDashboard, category: 'Navegación' },
    { id: 'stock', label: 'Gestión de Stock y Publicaciones (96 ítems)', icon: Boxes, category: 'Navegación' },
    { id: 'orders', label: 'Centro de Ventas y Facturación', icon: ShoppingCart, category: 'Navegación' },
    { id: 'shipments', label: 'Mesa de Empaque y Etiquetas de Envío', icon: Truck, category: 'Navegación' },
    { id: 'questions', label: 'Preguntas y Dudas de Compradores', icon: MessageSquare, category: 'Navegación' },
    { id: 'calculator', label: 'Calculadora de Comisiones y Margen', icon: Calculator, category: 'Herramientas' },
    { id: 'settings', label: 'Credenciales & Configuración API', icon: Settings, category: 'Ajustes' },
  ];

  const filteredActions = actions.filter(a => 
    a.label.toLowerCase().includes(query.toLowerCase()) || 
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (tabId) => {
    onNavigate(tabId);
    onClose(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-yellow-500 shrink-0" />
          <input
            type="text"
            placeholder="Escribe un comando o busca una sección... (ej: Stock, Envíos, Ventas)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          <button 
            onClick={() => onClose(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredActions.length > 0 ? (
            filteredActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleSelect(action.id)}
                  className="w-full px-3.5 py-3 rounded-xl flex items-center justify-between text-left hover:bg-yellow-50 dark:hover:bg-slate-800/80 group transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-yellow-400 group-hover:text-slate-950 transition">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-yellow-700 dark:group-hover:text-yellow-400 transition">
                        {action.label}
                      </p>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {action.category}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-1 transition" />
                </button>
              );
            })
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No se encontraron resultados para "{query}"
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <span>Navegar</span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono">↓</kbd>
          </div>
          <div className="flex items-center space-x-1">
            <span>Cerrar</span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono">ESC</kbd>
          </div>
        </div>

      </div>
    </div>
  );
}
