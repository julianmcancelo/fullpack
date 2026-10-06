import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Link2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PartyPopper,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { celebrate } from '../utils/celebrate';

const SITES = [
  { id: 'MLA', label: 'Argentina (MLA)' },
  { id: 'MLB', label: 'Brasil (MLB)' },
  { id: 'MLM', label: 'México (MLM)' },
  { id: 'MLC', label: 'Chile (MLC)' },
  { id: 'MLU', label: 'Uruguay (MLU)' },
  { id: 'MCO', label: 'Colombia (MCO)' },
  { id: 'MPE', label: 'Perú (MPE)' },
];

/**
 * OnboardingWizard - Fase 3: asistente guiado de primera conexión con Mercado Libre.
 * 
 * Flujo:
 *   1) Elegir método (OAuth automático vs Token directo)
 *   2) OAuth: completar App ID / Client Secret / País
 *   3) Manual: pegar Access Token
 *   4) Verificación: backend lee datos oficiales de ML
 *   5) Done: cuenta conectada, muestra nickname, ID, reputación
 * 
 * Important: este asistente aparece solo para usuarios activos SIN cuenta ML vinculada.
 * Si el usuario ya tiene cuenta conectada, no se muestra.
 * Cada usuario tiene sus credenciales guardadas por email (Fase 2).
 */
export default function OnboardingWizard({
  connection,
  onRefreshStatus,
  onRefreshAllData,
  onClose,
  startAtVerify = false,
}) {
  const { currentUser, sessionToken } = useAuth();
  // Obtener email: preferir currentUser, si no hay usamos el email del token de sesión
  // si existe, para evitar que el onboarding use datos de otro usuario si el localStorage
  // está cruzado entre usuarios en el mismo navegador.
  const userEmail = currentUser?.email || (sessionToken ? '' : '');
  const [step, setStep] = useState(startAtVerify ? 'verify' : 'method');
  const [method, setMethod] = useState(null);
  const [appId, setAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [siteId, setSiteId] = useState('MLA');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [verified, setVerified] = useState(null);

  const stepIndex = step === 'method' ? 0 : step === 'connect' ? 1 : 2;

  // ---------------------------------------------------
  // Start OAuth flow: save settings + generate auth URL
  // ---------------------------------------------------
  const startOAuth = useCallback(async (e) => {
    e?.preventDefault();
    if (!appId.trim() || !clientSecret.trim()) {
      setError('Completá el App ID y el Client Secret de tu aplicación de Mercado Libre.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Sólo se envían los campos editables: `redirectUri` y `clientSecret`
      // guardado los resuelve el backend, y reenviarlos pisaría la
      // configuración real.
      await api.saveSettings({
        appId: appId.trim(),
        clientSecret: clientSecret.trim(),
        siteId,
      });
      const res = await api.getAuthUrl();
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      setError('No se pudo generar la URL de autorización.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [appId, clientSecret, siteId]);

  // ---------------------------------------------------
  // Save manual token: validate with ML /users/me, then verify
  // ---------------------------------------------------
  const saveManual = useCallback(async (e) => {
    e?.preventDefault();
    if (!token.trim()) {
      setError('Pegá tu Access Token (empieza con APP_USR-).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.saveManualToken(token.trim(), '', userEmail); // <-- pasa email
      setToken('');
      await verify(res?.user || null);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }, [token, userEmail]);

  // ---------------------------------------------------
  // Verify: refresh status/data and check if connected
  // ---------------------------------------------------
  const verify = useCallback(async (hintUser = null) => {
    setStep('verify');
    setBusy(true);
    setError(null);
    try {
      if (onRefreshStatus) await onRefreshStatus();
      if (onRefreshAllData) await onRefreshAllData();
      const status = await api.getStatus();
      if (status?.connected) {
        setVerified({ ...status, hintUser });
        setStep('done');
        celebrate({ particleCount: 90, spread: 75, origin: { y: 0.5 } });
      } else {
        setError(status?.message || 'Todavía no hay cuenta conectada. Probá de nuevo.');
        setStep(method === 'oauth' ? 'oauth' : 'manual');
      }
    } catch (err) {
      setError(err.message);
      setStep(method === 'oauth' ? 'oauth' : 'manual');
    } finally {
      setBusy(false);
    }
  }, [method, onRefreshStatus, onRefreshAllData]);

  // ---------------------------------------------------
  // Pick method: OAuth or Manual
  // ---------------------------------------------------
  const pickMethod = (m) => {
    setMethod(m);
    setError(null);
    setStep('connect');
  };

  // ---------------------------------------------------
  // Done info: verified or existing connection
  // ---------------------------------------------------
  const doneInfo = verified || connection;
  const nickname = doneInfo?.nickname || doneInfo?.hintUser?.nickname || '';
  const reputation = doneInfo?.sellerReputation?.power_seller_status || '';

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Conectar Mercado Libre">
      <div className="modal modal-md">
        <div className="modal-head">
          <div className="min-w-0">
            <h2 className="modal-title">Conectá tu cuenta de Mercado Libre</h2>
            <p className="modal-sub">Te guiamos paso a paso, lleva 2 minutos</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" title="Hacerlo después" aria-label="Hacerlo después">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-2 px-5 pt-4 sm:px-6" aria-hidden="true">
          {['Método', 'Conexión', 'Listo'].map((label, i) => (
            <React.Fragment key={label}>
              <span className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider ${i <= stepIndex ? 'text-brand-700' : 'text-ink-subtle'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] tabular ${i < stepIndex ? 'bg-success text-white' : i === stepIndex ? 'bg-brand text-brand-ink' : 'bg-muted text-ink-subtle'}`}>
                  {i < stepIndex ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </span>
              {i < 2 && <span className="h-px min-w-4 flex-1 bg-line" />}
            </React.Fragment>
          ))}
        </div>

        <div className="modal-body">
          {error && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs font-semibold text-danger" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'method' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => pickMethod('oauth')} className="card card-hover p-5 text-left">
                <span className="kpi-icon kpi-icon-brand"><Link2 className="h-5 w-5" /></span>
                <span className="mt-3 block text-sm font-extrabold text-ink">Conexión automática</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">
                  Recomendada. Autorizás una vez y los tokens se renuevan solos.
                </span>
                <span className="badge badge-brand mt-3">Recomendada</span>
              </button>
              <button type="button" onClick={() => pickMethod('manual')} className="card card-hover p-5 text-left">
                <span className="kpi-icon kpi-icon-accent"><KeyRound className="h-5 w-5" /></span>
                <span className="mt-3 block text-sm font-extrabold text-ink">Token directo</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">
                  Si ya tenés un Access Token generado, pegalo y listo.
                </span>
                <span className="badge badge-neutral mt-3">Avanzado</span>
              </button>
            </div>
          )}

          {step === 'connect' && method === 'oauth' && (
            <form onSubmit={startOAuth} className="space-y-3">
              <p className="help">
                Creá tu aplicación gratis en el <b>DevCenter de Mercado Libre</b> y pegá las
                credenciales. Como Redirect URI usá la URL de esta app + <b>/api/auth/callback</b>.
              </p>
              <div className="field">
                <label className="label" htmlFor="ob-appid">App ID (Client ID)</label>
                <input id="ob-appid" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="Ej: 8410220120357196" className="input font-mono" autoComplete="off" />
              </div>
              <div className="field">
                <label className="label" htmlFor="ob-secret">Client Secret</label>
                <input id="ob-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Tu clave secreta" className="input font-mono" autoComplete="off" />
              </div>
              <div className="field">
                <label className="label" htmlFor="ob-site">País de tu cuenta</label>
                <select id="ob-site" value={siteId} onChange={(e) => setSiteId(e.target.value)} className="select">
                  {SITES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </form>
          )}

          {step === 'connect' && method === 'manual' && (
            <form onSubmit={saveManual} className="space-y-3">
              <p className="help">Generá un token en el DevCenter o Postman y pegalo acá. Lo validamos al instante.</p>
              <div className="field">
                <label className="label" htmlFor="ob-token">Access Token</label>
                <input id="ob-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-..." className="input font-mono" autoComplete="off" />
              </div>
            </form>
          )}

          {step === 'verify' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm font-bold text-ink">Verificando tu cuenta…</p>
              <p className="text-xs text-ink-muted">Estamos leyendo tus datos oficiales de Mercado Libre.</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-success/30 bg-success-soft text-success">
                <PartyPopper className="h-7 w-7" />
              </span>
              <p className="font-display text-lg font-extrabold text-ink">¡Cuenta conectada!</p>
              {nickname ? (
                <p className="text-xs text-ink-muted">
                  <b className="text-ink">@{nickname}</b>
                  {doneInfo?.userId ? <span className="tabular"> · ID {doneInfo.userId}</span> : null}
                  {reputation ? <span> · MercadoLíder {String(reputation).charAt(0).toUpperCase() + String(reputation).slice(1)}</span> : null}
                </p>
              ) : null}
              <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Tus ventas, stock y envíos ya son los de tu cuenta.
              </p>
            </div>
          )}
        </div>

        <div className="modal-foot">
          {step === 'connect' && (
            <>
              <button type="button" onClick={() => setStep('method')} disabled={busy} className="btn btn-outline btn-sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Atrás</span>
              </button>
              {method === 'oauth' ? (
                <button type="button" onClick={startOAuth} disabled={busy} className="btn btn-primary btn-sm">
                  {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  <span>{busy ? 'Abriendo…' : 'Autorizar en Mercado Libre'}</span>
                </button>
              ) : (
                <button type="button" onClick={saveManual} disabled={busy} className="btn btn-primary btn-sm">
                  {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{busy ? 'Validando…' : 'Vincular cuenta'}</span>
                </button>
              )}
            </>
          )}
          {step === 'done' && (
            <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
              <span>Ir a mi panel</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {(step === 'method' || step === 'verify') && step !== 'done' && (
            <button type="button" onClick={onClose} disabled={busy && step === 'verify'} className="btn btn-ghost btn-sm">
              <span>Hacerlo después</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}