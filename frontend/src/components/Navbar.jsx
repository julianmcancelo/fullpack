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
  Sparkles,
  LogIn,
  LogOut,
  Users,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ connection, onRefresh, refreshing, onNavigate, onOpenCommand, onOpenLogin, onOpenUsersAdmin }) {
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, logout, isAdmin } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
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

          {/* SaaS User Profile & Auth Menu */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(prev => !prev)}
                className="flex items-center space-x-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs"
              >
                <img
                  src={currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.email}`}
                  alt=""
                  className="w-6 h-6 rounded-full bg-yellow-400 p-0.5 border border-yellow-500/30"
                />
                <div className="text-left hidden lg:block">
                  <div className="flex items-center space-x-1">
                    <span className="max-w-[110px] truncate">{currentUser.name || currentUser.email}</span>
                    {isAdmin && (
                      <span className="text-[9px] font-black px-1 py-0.2 bg-yellow-400 text-slate-950 rounded uppercase">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name || 'Usuario'}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                    <div className="mt-1.5 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                        {isAdmin ? 'SuperAdmin Principal' : 'Usuario Autorizado'}
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenUsersAdmin();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2 transition"
                    >
                      <Users className="w-4 h-4 text-yellow-500" />
                      <span>Gestionar y Aprobar Usuarios</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2 transition"
                  >
                    <LogIn className="w-4 h-4 text-blue-500" />
                    <span>Cambiar de Cuenta</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2 transition"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="px-3.5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-sm transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
