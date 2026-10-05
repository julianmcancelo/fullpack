import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function UsersAdminModal({ isOpen, onClose }) {
  const { adminEmail } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getUsersList();
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const handleUpdateStatus = async (userId, newStatus) => {
    try {
      setActionLoading(userId);
      setError(null);
      setSuccessMsg(null);

      await api.approveUser(adminEmail, userId, newStatus);
      setSuccessMsg(
        `Usuario ${newStatus === 'active' ? 'aprobado y activado' : 'actualizado'} con éxito.`,
      );
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status === 'active');
  const rejectedUsers = users.filter((u) => u.status === 'rejected');

  return (
    <div className="overlay">
      <div className="modal modal-lg">
        {/* Header */}
        <div className="modal-head">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow">
              <Users className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="modal-title">Autorización de cuentas</h2>
              <p className="modal-sub">
                Sólo vos (<b className="font-bold text-ink-muted">{adminEmail}</b>) podés aprobar y
                autorizar el acceso.
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} aria-label="Cerrar" className="modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback */}
        {(error || successMsg) && (
          <div className="space-y-2 px-5 pt-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs font-semibold text-danger">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success-soft px-3.5 py-2.5 text-xs font-semibold text-success">
                <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="modal-body">
          {/* Pending approvals */}
          <section>
            <header className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-ink">
                Esperando aprobación
              </h3>
              <span className="badge badge-warning">{pendingUsers.length}</span>
            </header>

            {pendingUsers.length > 0 ? (
              <div className="space-y-2.5">
                {pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.email}`}
                        alt=""
                        className="avatar h-10 w-10 border-warning/40 bg-card p-0.5"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-bold text-ink">
                            {u.name || u.email}
                          </span>
                          <span className="badge badge-warning">Pendiente</span>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                          {u.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(u.id, 'active')}
                        disabled={actionLoading === u.id}
                        className="btn btn-success btn-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Aprobar y habilitar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(u.id, 'rejected')}
                        disabled={actionLoading === u.id}
                        className="btn btn-danger-soft btn-sm"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-muted/50 px-4 py-5 text-center text-xs text-ink-subtle">
                No hay solicitudes pendientes en este momento.
              </div>
            )}
          </section>

          {/* Active users */}
          <section>
            <header className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-ink">
                Usuarios autorizados
              </h3>
              <span className="badge badge-success">{activeUsers.length}</span>
            </header>

            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {activeUsers.map((u) => {
                const isSuperAdmin = u.email === adminEmail;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 bg-card p-3.5 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.email}`}
                        alt=""
                        className="avatar h-8 w-8 bg-muted"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-bold text-ink">
                            {u.name || u.email}
                          </span>
                          {isSuperAdmin ? (
                            <span className="badge badge-brand">SuperAdmin (vos)</span>
                          ) : (
                            <span className="badge badge-success">Activo</span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-ink-subtle">{u.email}</p>
                      </div>
                    </div>

                    {!isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(u.id, 'rejected')}
                        disabled={actionLoading === u.id}
                        className="btn btn-ghost btn-xs shrink-0 hover:text-danger"
                      >
                        Suspender
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="modal-foot">
          <button type="button" onClick={loadUsers} className="btn btn-outline btn-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar lista</span>
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
