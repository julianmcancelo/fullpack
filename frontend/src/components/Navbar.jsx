import React from 'react';
import { 
  ShoppingBag, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck,
  User,
  Search,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ connection, onRefresh, refreshing, onNavigate, onOpenCommand }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={() => onNavigate('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-yellow-300 flex items-center justify-center shadow-md shadow-yellow-400/20">
            <ShoppingBag className="w-5 h-5 text-slate-950 font-black" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-lg text-slate-950 dark:text-white tracking-tight">ML</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-yellow-400/20 text-yellow-900 dark:text-yellow-300 border border-yellow-400/40">
                PRO SUITE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">Gestión de Stock, Ventas y Envíos</p>
          </div>
        </div>

        {/* Global Command Search Bar (Ctrl+K) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <button
            onClick={() => onOpenCommand(true)}
            className="w-full px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-400 dark:text-slate-400 flex items-center justify-between transition shadow-xs"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Buscar publicaciones, órdenes o herramientas...</span>
            </div>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 shadow-xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* Mobile search button */}
          <button
            onClick={() => onOpenCommand(true)}
            className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Buscar (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-yellow-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Refresh Data Button */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Sincronizar datos con Mercado Libre"
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center space-x-1.5 text-xs font-bold shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-yellow-500' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          {/* Connection Status Badge */}
          {connection?.connected ? (
            <div 
              onClick={() => onNavigate('settings')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition shadow-xs"
              title="Cuenta de Mercado Libre Conectada y Activa"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-black flex items-center space-x-1">
                <User className="w-3.5 h-3.5 inline mr-1 text-emerald-600 dark:text-emerald-400" />
                <span className="max-w-[120px] truncate font-extrabold">{connection.nickname || 'Conectado'}</span>
              </span>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('settings')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition text-xs font-bold"
            >
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Conectar Cuenta</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
