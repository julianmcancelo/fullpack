import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  Mail, 
  Calendar,
  AlertTriangle,
  X
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
      setSuccessMsg(`Usuario ${newStatus === 'active' ? 'aprobado y activado' : 'actualizado'} con éxito.`);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'active');
  const rejectedUsers = users.filter(u => u.status === 'rejected');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Panel de Autorización de Cuentas (SaaS)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solo tú ({adminEmail}) tienes permiso para aprobar y autorizar acceso.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          
          {/* Section: Pending Approvals (High Priority) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Cuentas Esperando Aprobación ({pendingUsers.length})
                </h3>
              </div>
            </div>

            {pendingUsers.length > 0 ? (
              <div className="space-y-2.5">
                {pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.email}`}
                        alt=""
                        className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-amber-300 p-0.5 shrink-0"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">{u.name || u.email}</span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 uppercase">
                            Pendiente
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUpdateStatus(u.id, 'active')}
                        disabled={actionLoading === u.id}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center space-x-1 transition shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprobar y Habilitar</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(u.id, 'rejected')}
                        disabled={actionLoading === u.id}
                        className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 font-bold text-xs transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No hay solicitudes de cuentas pendientes en este momento.
              </div>
            )}
          </div>

          {/* Section: Active Users */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Usuarios Autorizados & Activos ({activeUsers.length})
              </h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              {activeUsers.map((u) => {
                const isSuperAdmin = u.email === adminEmail;
                return (
                  <div key={u.id} className="p-3.5 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.email}`}
                        alt=""
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{u.name || u.email}</span>
                          {isSuperAdmin ? (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-yellow-400 text-slate-950 uppercase">
                              SuperAdmin (Tú)
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 uppercase">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    {!isSuperAdmin && (
                      <button
                        onClick={() => handleUpdateStatus(u.id, 'rejected')}
                        disabled={actionLoading === u.id}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-300 text-[11px] font-bold transition"
                      >
                        Suspender
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={loadUsers}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar Lista</span>
          </button>
        </div>

      </div>
    </div>
  );
}
