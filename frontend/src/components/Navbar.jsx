import React from 'react';
import {
  ShoppingBag,
  RefreshCw,
  Search,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Users,
  ChevronDown,
  Smartphone,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

export default function Navbar({
  connection,
  onRefresh,
  refreshing,
  onNavigate,
  onOpenCommand,
  onOpenLogin,
  onOpenUsersAdmin,
  onOpenPairDevice,
}) {
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, logout, isAdmin } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  // Close the account menu on outside click / Escape (it used to stay open).
  React.useEffect(() => {
    if (!userMenuOpen) return undefined;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setUserMenuOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userMenuOpen]);

  const connected = Boolean(connection?.connected);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-[1700px] items-center justify-between gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        {/* ---- Brand ---- */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="group flex shrink-0 select-none items-center gap-3 rounded-2xl text-left"
          title="Ir al panel de control"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow transition-transform duration-300 ease-spring group-hover:-rotate-6">
            <ShoppingBag className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="hidden sm:block">
            <span className="flex items-center gap-1.5">
              <span className="font-display text-lg font-extrabold leading-none tracking-tight text-ink">
                ML
              </span>
              <span className="badge badge-brand !py-0">Pro Suite</span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-none text-ink-subtle">
              Stock, ventas y envíos
            </span>
          </span>
        </button>

        {/* ---- Live connection pill ---- */}
        <span
          className={`chip hidden xl:inline-flex ${
            connected
              ? 'border-success/30 bg-success-soft text-success'
              : 'border-warning/30 bg-warning-soft text-warning'
          }`}
          title={connected ? 'API de Mercado Libre conectada' : 'Sin conexión con Mercado Libre'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse-ring bg-success' : 'bg-warning'}`}
          />
          {connected ? `@${connection?.nickname || 'conectado'}` : 'Sin conexión'}
        </span>

        {/* ---- Command palette trigger ---- */}
        <button
          type="button"
          onClick={() => onOpenCommand(true)}
          className="mx-2 hidden max-w-md flex-1 items-center justify-between gap-3 rounded-xl border border-line bg-muted px-3.5 py-2 text-xs text-ink-subtle transition duration-200 hover:border-line-strong hover:bg-card hover:text-ink-muted md:flex"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Buscar publicaciones, órdenes o herramientas…</span>
          </span>
          <span className="kbd">Ctrl K</span>
        </button>

        {/* ---- Actions ---- */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenCommand(true)}
            aria-label="Buscar"
            title="Buscar (Ctrl+K)"
            className="btn btn-outline btn-icon md:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="btn btn-outline btn-icon"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-brand-400" />
            ) : (
              <Moon className="h-4 w-4 text-ink-muted" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenPairDevice}
            title="Vincular celular"
            aria-label="Vincular celular"
            className="btn btn-outline btn-icon"
          >
            <Smartphone className="h-4 w-4 text-ink-muted" />
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Sincronizar datos con Mercado Libre"
            className="btn btn-outline btn-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-brand-500' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Sincronizando' : 'Sincronizar'}</span>
          </button>

          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-2xl border border-line bg-muted p-1.5 pr-2 transition duration-200 hover:border-line-strong sm:pr-2.5"
              >
                <UserAvatar
                  avatar={currentUser.avatar}
                  name={currentUser.name}
                  email={currentUser.email}
                  size={28}
                  className="h-7 w-7 rounded-full border border-brand/40 p-0.5"
                />
                <span className="hidden max-w-[130px] items-center gap-1.5 lg:flex">
                  <span className="truncate text-xs font-bold text-ink">
                    {currentUser.name || currentUser.email}
                  </span>
                  {isAdmin && <span className="badge badge-brand !py-0">Admin</span>}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-ink-subtle transition-transform duration-200 ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div className="popover right-0 mt-2 w-64" role="menu">
                  <div className="border-b border-line bg-muted/60 px-4 py-3">
                    <p className="truncate text-xs font-bold text-ink">
                      {currentUser.name || 'Usuario'}
                    </p>
                    <p className="truncate text-[11px] text-ink-subtle">{currentUser.email}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-success">
                        {isAdmin ? 'SuperAdmin principal' : 'Usuario autorizado'}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenUsersAdmin();
                        }}
                        className="menu-item"
                      >
                        <Users className="h-4 w-4 text-brand-500" />
                        <span>Gestionar y aprobar usuarios</span>
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenLogin();
                      }}
                      className="menu-item"
                    >
                      <LogIn className="h-4 w-4 text-accent" />
                      <span>Cambiar de cuenta</span>
                    </button>
                  </div>

                  <div className="border-t border-line py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="menu-item menu-item-danger"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={onOpenLogin} className="btn btn-primary btn-sm">
              <LogIn className="h-3.5 w-3.5" />
              <span>Iniciar sesión</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
