import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Ban,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Search,
  Crown,
  Link2,
  Link2Off,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  X,
  Activity,
  Database,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import UserAvatar from '../components/UserAvatar';

/* ---------------------------------------------------------------------------
 * Configuración de estados: etiqueta, color e icono. Se usa en filtros,
 * contador y acciones para que el estado se lea igual en toda la pantalla.
 * ------------------------------------------------------------------------- */
const STATUS = {
  active: { label: 'Activo', badge: 'badge-success', Icon: UserCheck, chip: 'border-success/40 bg-success-soft text-success' },
  pending: { label: 'Pendiente', badge: 'badge-warning', Icon: Clock, chip: 'border-warning/40 bg-warning-soft text-warning' },
  suspended: { label: 'Suspendido', badge: 'badge-danger', Icon: Ban, chip: 'border-danger/40 bg-danger-soft text-danger' },
  rejected: { label: 'Rechazado', badge: 'badge-neutral', Icon: UserX, chip: 'border-line bg-muted text-ink-muted' },
};

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'active', label: 'Activos' },
  { id: 'suspended', label: 'Suspendidos' },
  { id: 'rejected', label: 'Rechazados' },
];

function relativeTime(value) {
  if (!value) return 'sin registros';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'sin registros';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export default function SuperAdminDashboard({ onNavigate }) {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [menuFor, setMenuFor] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ov, list] = await Promise.all([
        api.getPlatformOverview(),
        api.getUsersList(),
      ]);
      setOverview(ov);
      setUsers(Array.isArray(list?.users) ? list.users : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Cierra el menú de acciones al hacer clic fuera.
  useEffect(() => {
    if (menuFor == null) return undefined;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);

  /** Ejecuta una acción y refresca; muestra el resultado en un aviso. */
  const run = async (userId, fn, successText) => {
    setBusyId(userId);
    setMenuFor(null);
    setError(null);
    setFlash(null);
    try {
      const res = await fn();
      setFlash({ type: 'success', text: res?.message || successText });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = (user, status) =>
    run(
      user.id,
      () => api.updateUserStatus(user.id, status),
      `Cuenta actualizada a '${status}'.`,
    );

  const setRole = (user, role) =>
    run(user.id, () => api.updateUserRole(user.id, role), 'Rol actualizado.');

  const revoke = (user) =>
    run(user.id, () => api.revokeUserSessions(user.id), 'Sesiones cerradas.');

  // Cruce entre el listado de usuarios y el resumen de cuentas de ML.
  const linkedByEmail = useMemo(() => {
    const map = new Map();
    (overview?.accounts || []).forEach((a) => map.set(a.email, a));
    return map;
  }, [overview]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((u) => (filter === 'all' ? true : u.status === filter))
      .filter((u) =>
        !term
          ? true
          : `${u.name || ''} ${u.email}`.toLowerCase().includes(term),
      )
      .sort((a, b) => {
        const order = { pending: 0, suspended: 1, active: 2, rejected: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
  }, [users, filter, search]);

  const counts = overview?.byStatus || {};
  const kpis = [
    {
      label: 'Usuarios totales',
      value: overview?.totalUsers ?? 0,
      Icon: Users,
      tone: 'brand',
      hint: 'Registrados en la plataforma',
    },
    {
      label: 'Esperando aprobación',
      value: counts.pending ?? 0,
      Icon: Clock,
      tone: 'warning',
      hint: 'Solicitan acceso',
      onClick: () => setFilter('pending'),
      active: filter === 'pending',
    },
    {
      label: 'Cuentas de ML vinculadas',
      value: overview?.linkedAccounts ?? 0,
      Icon: Link2,
      tone: 'success',
      hint: 'Con operación habilitada',
    },
    {
      label: 'Sesiones activas',
      value: overview?.activeSessions ?? 0,
      Icon: Activity,
      tone: 'accent',
      hint: 'Web y dispositivos',
    },
  ];

  return (
    <div className="page">
      {/* ---------------- Encabezado ---------------- */}
      <div className="page-head">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title text-balance">Administración de la plataforma</h1>
            <span className="badge badge-brand">
              <Crown className="h-3 w-3" />
              SuperAdmin
            </span>
          </div>
          <p className="page-sub text-pretty">
            Gestionás las cuentas de la plataforma. La operación de Mercado Libre de cada
            usuario se administra aparte, en su propio tablero.
          </p>
        </div>

        <div className="toolbar">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn btn-outline btn-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Actualizando…' : 'Actualizar'}</span>
          </button>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate('dashboard')} className="btn btn-ghost btn-sm">
              <span>Ir a mi operación</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------- Avisos ---------------- */}
      {(error || flash) && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs font-semibold ${
            error
              ? 'border-danger/30 bg-danger-soft text-danger'
              : 'border-success/30 bg-success-soft text-success'
          }`}
          role="status"
        >
          {error ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 break-words">{error || flash?.text}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setFlash(null);
            }}
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ---------------- KPIs ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.Icon;
          const Card = (
            <div className={`kpi ${k.tone ? `kpi-${k.tone}` : ''} ${k.active ? 'ring-2 ring-brand' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="kpi-label">{k.label}</span>
                <span className={`kpi-icon kpi-icon-${k.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="kpi-value tabular">{loading && overview == null ? '—' : k.value}</p>
              <div className="kpi-foot">
                <span className="truncate">{k.hint}</span>
              </div>
              <span className="kpi-spark" aria-hidden="true" />
            </div>
          );
          return k.onClick ? (
            <button
              key={k.label}
              type="button"
              onClick={k.onClick}
              className="text-left"
              aria-pressed={k.active}
            >
              {Card}
            </button>
          ) : (
            <div key={k.label}>{Card}</div>
          );
        })}
      </div>

      {/* ---------------- Salud de la plataforma ---------------- */}
      {overview?.database && (
        <section className="card card-accent" aria-label="Estado de la plataforma">
          <div className="card-head">
            <div className="flex min-w-0 items-center gap-3">
              <span className="kpi-icon kpi-icon-brand shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="card-title">Estado de la plataforma</h2>
                <p className="card-sub">Servicios de los que depende la operación.</p>
              </div>
            </div>
          </div>
          <div className="card-body grid grid-cols-1 gap-3 sm:grid-cols-3">
            <HealthRow
              Icon={Database}
              label="Base de datos"
              value={overview.database.mode}
              ok={overview.database.neonConnected}
            />
            <HealthRow
              Icon={KeyRound}
              label="Administrador"
              value={overview.superAdminEmail || '(sin configurar)'}
              ok={Boolean(overview.superAdminEmail)}
            />
            <HealthRow
              Icon={Link2}
              label="Cuentas ML conectadas"
              value={`${overview.linkedAccounts} de ${overview.totalUsers}`}
              ok={overview.linkedAccounts > 0}
            />
          </div>
        </section>
      )}

      {/* ---------------- Gestión de usuarios ---------------- */}
      <section className="card" aria-label="Usuarios de la plataforma">
        <div className="card-head">
          <div className="flex min-w-0 items-center gap-3">
            <span className="kpi-icon kpi-icon-accent shrink-0">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">Cuentas de la plataforma</h2>
              <p className="card-sub">
                Aprobá, suspendé o rechazá el acceso de cada usuario.
              </p>
            </div>
          </div>
          <span className="badge badge-neutral tabular shrink-0">{visible.length}</span>
        </div>

        <div className="card-body space-y-4">
          {/* Filtros + búsqueda */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
              {FILTERS.map((f) => {
                const n =
                  f.id === 'all'
                    ? users.length
                    : users.filter((u) => u.status === f.id).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    aria-pressed={filter === f.id}
                    className={`btn btn-sm whitespace-nowrap ${
                      filter === f.id ? 'btn-primary' : 'btn-ghost'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="tabular opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>

            <form className="relative min-w-0 lg:w-72" onSubmit={(e) => e.preventDefault()}>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o email…"
                aria-label="Buscar usuarios"
                className="input-search pl-10"
              />
            </form>
          </div>

          {/* Lista */}
          {loading && users.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton skeleton-shimmer h-[68px] w-full rounded-2xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="empty-title">
                {search ? 'Sin coincidencias' : 'No hay usuarios en esta vista'}
              </h3>
              <p className="empty-text">
                {search
                  ? 'Probá con otro nombre o correo.'
                  : 'Cuando alguien solicite acceso, va a aparecer acá.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((u) => {
                const cfg = STATUS[u.status] || STATUS.pending;
                const StatusIcon = cfg.Icon;
                const isSuper = u.email === overview?.superAdminEmail;
                const ml = linkedByEmail.get(u.email);
                const busy = busyId === u.id;

                return (
                  <li
                    key={u.id}
                    className={`relative flex flex-col gap-3 rounded-2xl border bg-card p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      cfg.chip.split(' ')[0]
                    } ${busy ? 'opacity-60' : ''}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar
                        avatar={u.avatar}
                        name={u.name}
                        email={u.email}
                        size={40}
                        className="h-10 w-10 shrink-0 border-line bg-muted p-0.5"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-bold text-ink">
                            {u.name || u.email}
                          </span>
                          {isSuper && (
                            <span className="badge badge-brand">
                              <Crown className="h-3 w-3" />
                              SuperAdmin
                            </span>
                          )}
                          <span className={`badge ${cfg.badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                          {u.email}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                          <span className="inline-flex items-center gap-1">
                            {ml?.linked ? (
                              <>
                                <Link2 className="h-3 w-3 text-success" />
                                <span className="font-semibold text-success">
                                  ML {ml.nickname ? `@${ml.nickname}` : 'vinculada'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Link2Off className="h-3 w-3" />
                                <span>Sin cuenta de ML</span>
                              </>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {u.role === 'admin' ? 'Admin' : 'Usuario'}
                          </span>
                          <span>Último acceso: {relativeTime(u.lastLoginAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      {u.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setStatus(u, 'active')}
                            disabled={busy}
                            className="btn btn-success btn-sm"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Aprobar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(u, 'rejected')}
                            disabled={busy}
                            className="btn btn-danger-soft btn-sm"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Rechazar</span>
                          </button>
                        </>
                      )}

                      {u.status === 'active' && !isSuper && (
                        <button
                          type="button"
                          onClick={() => setStatus(u, 'suspended')}
                          disabled={busy}
                          className="btn btn-outline btn-sm"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Suspender</span>
                        </button>
                      )}

                      {u.status === 'suspended' && (
                        <button
                          type="button"
                          onClick={() => setStatus(u, 'active')}
                          disabled={busy}
                          className="btn btn-success btn-sm"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Reactivar</span>
                        </button>
                      )}

                      {u.status === 'rejected' && (
                        <button
                          type="button"
                          onClick={() => setStatus(u, 'active')}
                          disabled={busy}
                          className="btn btn-outline btn-sm"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Aprobar de nuevo</span>
                        </button>
                      )}

                      {!isSuper && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor(menuFor === u.id ? null : u.id);
                            }}
                            disabled={busy}
                            className="btn btn-icon-sm btn-outline"
                            aria-label={`Más acciones para ${u.email}`}
                            aria-expanded={menuFor === u.id}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>

                          {menuFor === u.id && (
                            <div
                              className="popover right-0 mt-1 w-60"
                              role="menu"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    setRole(u, u.role === 'admin' ? 'user' : 'admin')
                                  }
                                  className="menu-item"
                                >
                                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                                  <span>
                                    {u.role === 'admin'
                                      ? 'Quitar rol de admin'
                                      : 'Dar rol de admin'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => revoke(u)}
                                  className="menu-item"
                                >
                                  <LogOut className="h-4 w-4 text-warning" />
                                  <span>Cerrar sesiones y equipos</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/* Fila de salud: icono, estado y detalle. */
function HealthRow({ Icon, label, value, ok }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${
        ok ? 'border-line bg-muted/50' : 'border-warning/40 bg-warning-soft'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          ok ? 'bg-success-soft text-success' : 'bg-warning/15 text-warning'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs font-bold text-ink">{value || '—'}</p>
      </div>
    </div>
  );
}