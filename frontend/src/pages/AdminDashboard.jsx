import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Eye,
  ShieldCheck,
  Crown,
  Link2,
  Link2Off,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Store,
} from 'lucide-react';
import { api } from '../services/api';
import UserAvatar from '../components/UserAvatar';

/* ---------------------------------------------------------------------------
 * Pantalla del ADMIN (supervisor).
 *
 * Es deliberadamente distinta de la del SuperAdmin: acá NO hay gestión de
 * cuentas. No se aprueba, no se suspende, no se cambia el rol y no se resetea.
 * Lo único que hace un Admin es mirar la operación de Mercado Libre de las
 * cuentas activas: entra a su tablero, stock, órdenes y envíos.
 *
 * Cualquier acción destructiva o de aprobación vive en SuperAdminDashboard y el
 * backend la rechaza con 403 si el llamante no es el SuperAdmin.
 * ------------------------------------------------------------------------- */

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

export default function AdminDashboard({ onNavigate, onSupervise }) {
  const [accounts, setAccounts] = useState([]);
  const [superAdminEmail, setSuperAdminEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSupervisableAccounts();
      setAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
      setSuperAdminEmail(res?.superAdminEmail || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.name, a.email, a.nickname].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [accounts, search]);

  const linkedCount = accounts.filter((a) => a.linked).length;

  const supervise = (account) => {
    api.setActingUser(account.email);
    setFlash(`Estás operando la cuenta de ${account.email}.`);
    onSupervise?.(account);
  };

  const goBack = () => {
    api.setActingUser(null);
    setFlash(null);
    onNavigate?.('dashboard');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title text-balance">Supervisión de cuentas</h1>
            <span className="badge badge-accent">
              <ShieldCheck className="h-3 w-3" />
              Administrador
            </span>
          </div>
          <p className="page-sub text-pretty">
            Ves la operación de Mercado Libre de cada cuenta y podés operarla vos
            mismo. Aprobar, suspender o cambiar roles es tarea del SuperAdmin.
          </p>
        </div>

        <div className="toolbar">
          <button type="button" onClick={load} disabled={loading} className="btn btn-outline btn-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Actualizando…' : 'Actualizar'}</span>
          </button>
          {onNavigate && (
            <button type="button" onClick={() => onNavigate('dashboard')} className="btn btn-ghost btn-sm">
              <ArrowLeft className="h-4 w-4" />
              <span>Mi propia cuenta</span>
            </button>
          )}
        </div>
      </div>

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
          <span className="min-w-0 flex-1">{error || flash}</span>
          {flash && (
            <button
              type="button"
              onClick={() => setFlash(null)}
              className="shrink-0 rounded-lg px-2 py-0.5 font-bold opacity-70 hover:opacity-100"
            >
              Volver a mi cuenta
            </button>
          )}
        </div>
      )}

      {/* Estado de la supervisión */}
      <section className="card" aria-label="Resumen de supervisión">
        <div className="card-body grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-muted/50 px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                Cuentas activas
              </p>
              <p className="mt-0.5 text-lg font-black tabular text-ink">{accounts.length}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-muted/50 px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
              <Store className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                Con ML vinculada
              </p>
              <p className="mt-0.5 text-lg font-black tabular text-ink">
                {linkedCount}
                <span className="text-sm font-bold text-ink-subtle"> / {accounts.length}</span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-muted/50 px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-500">
              <Crown className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                SuperAdmin
              </p>
              <p className="mt-0.5 truncate text-xs font-bold text-ink">
                {superAdminEmail || '(sin configurar)'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Listado de cuentas operables */}
      <section className="card" aria-label="Cuentas supervisables">
        <div className="card-head">
          <div className="flex min-w-0 items-center gap-3">
            <span className="kpi-icon kpi-icon-accent shrink-0">
              <Eye className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">Cuentas que podés operar</h2>
              <p className="card-sub">
                Sólo cuentas activas. Entrás a ver y operar su Mercado Libre; no podés
                aprobar ni suspender.
              </p>
            </div>
          </div>
          <span className="badge badge-neutral tabular shrink-0">{visible.length}</span>
        </div>

        <div className="card-body space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o nickname de Mercado Libre"
              className="input w-full pl-9"
              aria-label="Buscar cuentas"
            />
          </div>

          {loading && !accounts.length ? (
            <p className="py-6 text-center text-sm text-ink-muted">Cargando cuentas…</p>
          ) : !visible.length ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              {accounts.length
                ? 'Ninguna cuenta coincide con la búsqueda.'
                : 'Todavía no hay cuentas activas para supervisar.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((a) => {
                const isOwner = a.email === superAdminEmail;
                return (
                  <li
                    key={a.email}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 transition hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={a} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-extrabold text-ink">
                            {a.name || a.email.split('@')[0]}
                          </span>
                          {isOwner && (
                            <span className="badge badge-brand">
                              <Crown className="h-3 w-3" />
                              SuperAdmin
                            </span>
                          )}
                          {!isOwner && a.role === 'admin' && (
                            <span className="badge badge-accent">
                              <ShieldCheck className="h-3 w-3" />
                              Administrador
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                          {a.email}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                          <span className="inline-flex items-center gap-1">
                            {a.linked ? (
                              <>
                                <Link2 className="h-3 w-3 text-success" />
                                <span className="font-semibold text-success">
                                  ML {a.nickname ? `@${a.nickname}` : 'vinculada'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Link2Off className="h-3 w-3" />
                                <span>Sin cuenta de ML</span>
                              </>
                            )}
                          </span>
                          <span>Último acceso: {relativeTime(a.lastLoginAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 sm:text-right">
                      <button
                        type="button"
                        onClick={() => supervise(a)}
                        disabled={!a.linked}
                        title={
                          a.linked
                            ? `Operar la cuenta de ${a.email}`
                            : 'Esa cuenta todavía no vinculó Mercado Libre'
                        }
                        className="btn btn-primary btn-sm w-full sm:w-auto"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{a.linked ? 'Supervisar' : 'Sin ML vinculada'}</span>
                      </button>
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