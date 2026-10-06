import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  HelpCircle,
  Copy,
  Check,
  Zap,
  Lock,
  Users,
  LogIn,
  Sun,
  Moon,
  Monitor,
  Palette,
  Smartphone,
  PlugZap,
  RefreshCw,
  QrCode,
  Award,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import UserAvatar from '../components/UserAvatar';

const THEME_OPTIONS = [
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'dark', label: 'Oscuro', Icon: Moon },
  { id: 'system', label: 'Sistema', Icon: Monitor },
];

/* Cuenta regresiva legible para el vencimiento del token (ms epoch o ISO). */
function describeTokenExpiry(expiresAt, now) {
  if (expiresAt == null || expiresAt === '') return null;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - now;
  if (diff <= 0) return 'Token vencido: se renueva solo al sincronizar';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'El token vence en menos de 1 minuto';
  if (minutes < 60) return `El token vence en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest ? `El token vence en ${hours} h ${rest} min` : `El token vence en ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return `El token vence en ${days} ${days === 1 ? 'día' : 'días'}`;
}

/* Tiempo relativo en español para "último acceso" de dispositivos. */
function formatRelative(value) {
  if (!value) return 'sin registros';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'sin registros';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return 'hace instantes';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
  const years = Math.round(months / 12);
  return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}

export default function Settings({
  connection,
  onRefreshStatus,
  onRefreshAllData,
  onOpenLogin,
  onOpenPairDevice,
}) {
  const { currentUser, isAdmin, adminEmail } = useAuth();
  const { mode, setMode } = useTheme();
  const [settings, setSettings] = useState({
    appId: '',
    clientSecret: '',
    redirectUri: 'http://localhost:3001/api/auth/callback',
    siteId: 'MLA',
    lowStockThreshold: 5,
  });

  const [directToken, setDirectToken] = useState({
    accessToken: '',
    refreshToken: '',
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Reloj para la cuenta regresiva del token (se actualiza cada 30 s)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Dispositivos vinculados (datos reales de la API de pareo)
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  // Load saved settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await api.getSettings();
        if (res) {
          setSettings((prev) => ({
            ...prev,
            appId: res.appId || '',
            clientSecret: res.clientSecret || '',
            redirectUri: res.redirectUri || 'http://localhost:3001/api/auth/callback',
            siteId: res.siteId || 'MLA',
            lowStockThreshold: res.lowStockThreshold || 5,
          }));
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Carga los celulares vinculados con la cuenta actual
  useEffect(() => {
    const email = currentUser?.email;
    if (!email) return;
    let active = true;
    const loadDevices = async () => {
      try {
        setDevicesLoading(true);
        setDevicesError(null);
        const res = await api.getPairDevices(email);
        if (active) setDevices(Array.isArray(res?.devices) ? res.devices : []);
      } catch (err) {
        if (active) setDevicesError(err?.message || 'No pudimos cargar los dispositivos.');
      } finally {
        if (active) setDevicesLoading(false);
      }
    };
    loadDevices();
    return () => {
      active = false;
    };
  }, [currentUser?.email]);

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    try {
      setSavingSettings(true);
      setStatusMsg(null);
      await api.saveSettings(settings);
      setStatusMsg({ type: 'success', text: 'Configuración guardada correctamente.' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error al guardar: ${err.message}` });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConnectOAuth = async () => {
    try {
      await handleSaveSettings();
      const res = await api.getAuthUrl();
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error al iniciar autorización: ${err.message}` });
    }
  };

  const handleSaveManualToken = async (e) => {
    e.preventDefault();
    if (!directToken.accessToken) {
      setStatusMsg({ type: 'error', text: 'Debes ingresar un Access Token válido.' });
      return;
    }

    try {
      setSavingToken(true);
      setStatusMsg(null);
      const res = await api.saveManualToken(directToken.accessToken, directToken.refreshToken);
      setStatusMsg({ type: 'success', text: `¡Cuenta @${res.user.nickname} conectada con éxito!` });
      setDirectToken({ accessToken: '', refreshToken: '' });
      if (onRefreshStatus) await onRefreshStatus();
      if (onRefreshAllData) await onRefreshAllData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSavingToken(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Seguro que deseas desvincular la cuenta actual de Mercado Libre?')) {
      return;
    }

    try {
      setDisconnecting(true);
      await api.disconnect();
      setStatusMsg({ type: 'success', text: 'Cuenta desvinculada exitosamente.' });
      if (onRefreshStatus) await onRefreshStatus();
      if (onRefreshAllData) await onRefreshAllData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error al desvincular: ${err.message}` });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUnlinkDevice = async (device) => {
    const name = device?.name || 'este celular';
    if (
      !window.confirm(
        `¿Desvincular "${name}"? Vas a tener que escanear un código nuevo para volver a conectarlo.`
      )
    ) {
      return;
    }
    try {
      setRemovingId(device.id);
      setDevicesError(null);
      await api.unlinkDevice(device.id);
      setDevices((prev) => prev.filter((item) => item.id !== device.id));
    } catch (err) {
      setDevicesError(err?.message || 'No pudimos desvincular el dispositivo.');
    } finally {
      setRemovingId(null);
    }
  };

  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

  const handleFactoryReset = async () => {
    if (
      !window.confirm(
        'Esto borra TODAS las cuentas de Mercado Libre, las sesiones abiertas y el historial de empaque de todos los usuarios.\n\n' +
          'Solo puede deshacerse volviendo a vincular cada cuenta.\n\n' +
          '¿Continuar?'
      )
    ) {
      return;
    }
    if (!window.confirm('Última confirmación: se borra todo. ¿Seguís?')) return;

    try {
      setResetting(true);
      setResetMsg(null);
      const res = await api.resetPlatform();
      setResetMsg({
        type: 'success',
        text: res?.message || 'Plataforma reseteada. Cada usuario debe vincular su cuenta de nuevo.',
      });
      if (onRefreshStatus) await onRefreshStatus();
      if (onRefreshAllData) await onRefreshAllData();
    } catch (err) {
      setResetMsg({ type: 'error', text: `Error al resetear: ${err.message}` });
    } finally {
      setResetting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  // Datos reales de reputación (solo se renderizan si existen)
  const reputation = connection?.sellerReputation || null;
  const powerRaw =
    typeof reputation?.power_seller_status === 'string' &&
    reputation.power_seller_status.trim() !== ''
      ? reputation.power_seller_status.trim()
      : null;
  const powerLabel = powerRaw
    ? powerRaw.charAt(0).toUpperCase() + powerRaw.slice(1).toLowerCase()
    : null;
  const levelId =
    typeof reputation?.level_id === 'string' && reputation.level_id.trim() !== ''
      ? reputation.level_id.trim()
      : null;
  const completedSales =
    reputation?.transactions?.completed != null &&
    Number.isFinite(Number(reputation.transactions.completed))
      ? Number(reputation.transactions.completed)
      : null;

  const tokenExpiryText = connection?.connected ? describeTokenExpiry(connection.expiresAt, now) : null;

  return (
    <div className="page max-w-4xl">
      {/* ---------------- Header ---------------- */}
      <div className="page-head">
        <div className="min-w-0">
          <h1 className="page-title text-balance">Ajustes</h1>
          <p className="page-sub text-pretty">
            Conexión con Mercado Libre, celular vinculado, cuenta y apariencia. Todo en un solo
            lugar.
          </p>
        </div>
      </div>

      {/* ---------------- Feedback ---------------- */}
      {statusMsg && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-xs font-semibold ${
            statusMsg.type === 'success'
              ? 'border-success/30 bg-success-soft text-success'
              : 'border-danger/30 bg-danger-soft text-danger'
          }`}
          role="status"
        >
          <div className="flex min-w-0 items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="shrink-0 text-[11px] font-bold underline-offset-2 hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ---------------- (a) Estado de conexión ---------------- */}
      <section className="card card-accent overflow-hidden" aria-label="Estado de conexión">
        <div className="card-head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="kpi-icon kpi-icon-success shrink-0">
              <PlugZap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">
                <span className="min-w-0">Estado de conexión</span>
              </h2>
              <p className="card-sub">Tu vínculo en vivo con Mercado Libre.</p>
            </div>
          </div>
          {connection?.connected && (
            <span className="badge badge-success shrink-0">
              <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-success" />
              Activa
            </span>
          )}
        </div>

        <div className="card-body space-y-4">
          {connection?.connected ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-success/25 bg-success-soft font-display text-lg font-extrabold text-success">
                    {(connection.nickname || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-extrabold tracking-tight text-ink">
                      @{connection.nickname || 'Cuenta vinculada'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                      {connection.userId != null && (
                        <span>
                          ID: <b className="tabular font-bold text-ink">#{connection.userId}</b>
                        </span>
                      )}
                      {connection.siteId && (
                        <span>
                          Sitio: <b className="font-bold text-ink">{connection.siteId}</b>
                        </span>
                      )}
                      {connection.permalink && (
                        <a
                          href={connection.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link inline-flex min-w-0 items-center gap-1"
                        >
                          <span className="truncate">Ver perfil en ML</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConnectOAuth}
                    className="btn btn-primary btn-sm"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Reconectar</span>
                  </button>
                  {onRefreshStatus && (
                    <button
                      type="button"
                      onClick={() => onRefreshStatus()}
                      className="btn btn-outline btn-sm"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Actualizar estado</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Reputación real + vencimiento del token */}
              {(powerLabel || levelId || completedSales != null || tokenExpiryText) && (
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {powerLabel && (
                    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-muted/60 px-3.5 py-2.5">
                      <Award className="h-4 w-4 shrink-0 text-brand-500" />
                      <div className="min-w-0">
                        <dt className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                          Reputación
                        </dt>
                        <dd className="truncate text-xs font-bold text-ink">
                          MercadoLíder {powerLabel}
                        </dd>
                      </div>
                    </div>
                  )}
                  {levelId && (
                    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-muted/60 px-3.5 py-2.5">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                      <div className="min-w-0">
                        <dt className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                          Nivel de vendedor
                        </dt>
                        <dd className="truncate text-xs font-bold text-ink">{levelId}</dd>
                      </div>
                    </div>
                  )}
                  {completedSales != null && (
                    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-muted/60 px-3.5 py-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <dt className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                          Ventas concretadas
                        </dt>
                        <dd className="tabular text-xs font-bold text-ink">
                          {completedSales.toLocaleString('es-AR')}
                        </dd>
                      </div>
                    </div>
                  )}
                  {tokenExpiryText && (
                    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-muted/60 px-3.5 py-2.5">
                      <Clock className="h-4 w-4 shrink-0 text-warning" />
                      <div className="min-w-0">
                        <dt className="text-[10px] font-extrabold uppercase tracking-wider text-ink-subtle">
                          Sesión de Mercado Libre
                        </dt>
                        <dd className="truncate text-xs font-bold text-ink">{tokenExpiryText}</dd>
                      </div>
                    </div>
                  )}
                </dl>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">No hay ninguna cuenta vinculada</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Conectá tu cuenta para operar con publicaciones, stock y envíos reales.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectOAuth}
                className="btn btn-primary btn-sm w-full shrink-0 sm:w-auto"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Conectar con Mercado Libre</span>
              </button>
            </div>
          )}

          {/* Credenciales (plegables para no abrumar) */}
          <details className="rounded-2xl border border-line bg-muted/50">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-xs font-extrabold text-ink">
              <Key className="h-4 w-4 shrink-0 text-brand-500" />
              <span className="min-w-0 flex-1">Conexión automática OAuth 2.0 · Recomendada</span>
              <span className="badge badge-success shrink-0">Renueva sola</span>
            </summary>
            <div className="space-y-4 border-t border-line px-4 py-4">
              <div className="rounded-xl border border-line bg-card p-3.5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <HelpCircle className="h-4 w-4 shrink-0 text-brand-500" />
                  <span>¿Cómo obtener tus credenciales?</span>
                </h4>
                <ol className="mt-2 list-inside list-decimal space-y-1.5 pl-1 text-xs leading-relaxed text-ink-muted">
                  <li>
                    Ingresá al{' '}
                    <a
                      href="https://developers.mercadolibre.com.ar/devcenter"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link inline-flex items-center gap-0.5"
                    >
                      <span>DevCenter de Mercado Libre</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    con tu cuenta de vendedor y creá una aplicación.
                  </li>
                  <li>
                    En <b className="font-bold text-ink">Redirect URI</b> pegá exactamente:
                    <span className="my-2 flex items-center gap-2 rounded-lg border border-line bg-muted px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold text-ink">
                        {settings.redirectUri}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(settings.redirectUri)}
                        title="Copiar URI"
                        aria-label="Copiar URI"
                        className="btn btn-ghost btn-icon-sm shrink-0"
                      >
                        {copiedRedirect ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </span>
                  </li>
                  <li>
                    Copiá tu <b className="font-bold text-ink">APP ID</b> y{' '}
                    <b className="font-bold text-ink">Client Secret</b> y pegalos abajo.
                  </li>
                </ol>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="field">
                    <label className="label" htmlFor="ml-app-id">
                      APP ID <span className="text-danger">*</span>
                    </label>
                    <input
                      id="ml-app-id"
                      type="text"
                      placeholder="Ej: 5829104820192841"
                      value={settings.appId}
                      onChange={(e) => setSettings({ ...settings, appId: e.target.value })}
                      className="input font-mono"
                    />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="ml-client-secret">
                      Client Secret <span className="text-danger">*</span>
                    </label>
                    <input
                      id="ml-client-secret"
                      type="password"
                      placeholder="••••••••••••••••••••••••"
                      value={settings.clientSecret}
                      onChange={(e) => setSettings({ ...settings, clientSecret: e.target.value })}
                      className="input font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="field">
                    <label className="label" htmlFor="ml-site">
                      País / sitio de Mercado Libre
                    </label>
                    <select
                      id="ml-site"
                      value={settings.siteId}
                      onChange={(e) => setSettings({ ...settings, siteId: e.target.value })}
                      className="select"
                    >
                      <option value="MLA">Argentina (MLA)</option>
                      <option value="MLB">Brasil (MLB)</option>
                      <option value="MLM">México (MLM)</option>
                      <option value="MLC">Chile (MLC)</option>
                      <option value="MLU">Uruguay (MLU)</option>
                      <option value="MCO">Colombia (MCO)</option>
                      <option value="MPE">Perú (MPE)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="ml-threshold">
                      Alerta de stock bajo
                    </label>
                    <input
                      id="ml-threshold"
                      type="number"
                      min="1"
                      max="100"
                      value={settings.lowStockThreshold}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          lowStockThreshold: parseInt(e.target.value, 10) || 5,
                        })
                      }
                      className="input tabular"
                    />
                    <p className="help">Se avisa cuando una publicación baja de estas unidades.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={handleConnectOAuth}
                    className="btn btn-primary w-full sm:w-auto"
                  >
                    <Zap className="h-4 w-4 fill-current" />
                    <span>Conectar con Mercado Libre</span>
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="btn btn-outline w-full sm:w-auto"
                  >
                    {savingSettings ? 'Guardando…' : 'Guardar credenciales'}
                  </button>
                </div>
              </form>
            </div>
          </details>

          <details className="rounded-2xl border border-line bg-muted/50">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-xs font-extrabold text-ink">
              <Lock className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">Ingreso directo de Access Token</span>
              <span className="badge badge-neutral shrink-0">Alternativo</span>
            </summary>
            <form onSubmit={handleSaveManualToken} className="space-y-4 border-t border-line px-4 py-4">
              <div className="field">
                <label className="label" htmlFor="ml-access-token">
                  Access Token (APP_USR-…) <span className="text-danger">*</span>
                </label>
                <textarea
                  id="ml-access-token"
                  rows={2}
                  placeholder="APP_USR-…"
                  value={directToken.accessToken}
                  onChange={(e) => setDirectToken({ ...directToken, accessToken: e.target.value })}
                  className="textarea font-mono"
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="ml-refresh-token">
                  Refresh Token (opcional)
                </label>
                <input
                  id="ml-refresh-token"
                  type="text"
                  placeholder="TG-…"
                  value={directToken.refreshToken}
                  onChange={(e) =>
                    setDirectToken({ ...directToken, refreshToken: e.target.value })
                  }
                  className="input font-mono"
                />
                <p className="help">
                  Guardarlo permite renovar el acceso automáticamente cuando el token expire.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingToken}
                className="btn btn-dark w-full sm:w-auto"
              >
                <span>{savingToken ? 'Validando token…' : 'Vincular con Access Token'}</span>
              </button>
            </form>
          </details>
        </div>
      </section>

      {/* ---------------- (b) Vincular celular ---------------- */}
      <section className="card" aria-label="Vincular celular">
        <div className="card-head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="kpi-icon kpi-icon-brand shrink-0">
              <Smartphone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">
                <span className="min-w-0">Vincular celular</span>
              </h2>
              <p className="card-sub">
                Escaneá el QR con la app Android y operá desde el depósito.
              </p>
            </div>
          </div>
          {devices.length > 0 && (
            <span className="badge badge-neutral tabular shrink-0">{devices.length}</span>
          )}
        </div>

        <div className="card-body space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow">
                <QrCode className="h-5 w-5" />
              </span>
              <p className="min-w-0 text-xs leading-relaxed text-ink-muted">
                <b className="font-bold text-ink">Mostrá el código QR</b> en esta pantalla y
                apuntalo con la cámara del celular. El código dura 10 minutos y el celular queda
                vinculado a tu cuenta.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPairDevice}
              className="btn btn-primary w-full shrink-0 sm:w-auto"
            >
              <QrCode className="h-4 w-4" />
              <span>Mostrar QR de vinculación</span>
            </button>
          </div>

          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-subtle">
              Dispositivos vinculados
            </h3>
            {devicesError ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs font-semibold text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 break-words">{devicesError}</span>
              </p>
            ) : devicesLoading && devices.length === 0 ? (
              <div className="mt-2 space-y-2">
                <div className="skeleton h-[64px] w-full rounded-2xl" />
              </div>
            ) : devices.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-line bg-muted/50 px-3.5 py-3 text-xs text-ink-muted">
                Todavía no hay celulares vinculados. Cuando escanees el QR, el dispositivo aparece
                acá.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {devices.map((device) => (
                  <li
                    key={device.id}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-muted text-ink-muted">
                        <Smartphone className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-ink">
                          {device.name || 'Dispositivo Android'}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
                          Último acceso:{' '}
                          <span className="tabular">{formatRelative(device.lastSeenAt)}</span>
                          {device.appVersion ? ` · App v${device.appVersion}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlinkDevice(device)}
                      disabled={removingId === device.id}
                      className="btn btn-danger-soft btn-sm shrink-0 self-start sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{removingId === device.id ? 'Desvinculando…' : 'Revocar'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- (c) Cuenta y usuarios ---------------- */}
      <section className="card" aria-label="Cuenta y usuarios">
        <div className="card-head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="kpi-icon kpi-icon-accent shrink-0">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">
                <span className="min-w-0">Cuenta y usuarios</span>
              </h2>
              <p className="card-sub">Quién puede entrar al panel.</p>
            </div>
          </div>
        </div>

        <div className="card-body space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar
                avatar={currentUser?.avatar}
                name={currentUser?.name}
                email={currentUser?.email}
                size={44}
                className="h-11 w-11 shrink-0 rounded-2xl border border-brand/40 bg-brand p-0.5"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-extrabold text-ink">
                    {currentUser?.name || currentUser?.email || 'Usuario'}
                  </p>
                  {isAdmin ? (
                    <span className="badge badge-brand shrink-0">SuperAdmin</span>
                  ) : (
                    <span className="badge badge-success shrink-0">Autorizado</span>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
                  {currentUser?.email || adminEmail}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* La gestión de cuentas se hizo en "Administración" del menú
                  lateral; acá sólo se informa el estado de tu cuenta. */}
              {isAdmin ? (
                <p className="text-xs text-ink-muted">
                  Gestionás las cuentas de la plataforma desde{' '}
                  <b className="font-bold text-ink">Administración</b>, en el menú lateral.
                </p>
              ) : (
                <p className="text-xs text-ink-muted">
                  Tu cuenta fue autorizada por el administrador ({adminEmail}).
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onOpenLogin} className="btn btn-outline btn-sm">
                <LogIn className="h-3.5 w-3.5" />
                <span>Cambiar cuenta</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Apariencia ---------------- */}
      <section className="card" aria-label="Apariencia">
        <div className="card-head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="kpi-icon kpi-icon-accent shrink-0">
              <Palette className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">
                <span className="min-w-0">Apariencia</span>
              </h2>
              <p className="card-sub">Se guarda en este navegador y se aplica al instante.</p>
            </div>
          </div>
        </div>
        <div className="card-body flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs leading-relaxed text-ink-muted sm:max-w-sm">
            Con <b className="font-bold text-ink">Sistema</b> el panel sigue automáticamente la
            preferencia de tu sistema operativo.
          </p>
          <div className="segmented shrink-0" role="group" aria-label="Tema de la interfaz">
            {THEME_OPTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={`segmented-btn flex items-center gap-1.5 ${
                  mode === id ? 'segmented-btn-active' : ''
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- (d) Zona de peligro ---------------- */}
      <section
        className="card overflow-hidden border-danger/40"
        aria-label="Zona de peligro"
      >
        <div className="card-head border-danger/20">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger-soft text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">
                <span className="min-w-0">Zona de peligro</span>
              </h2>
              <p className="card-sub">Acciones que cortan la operatoria del panel.</p>
            </div>
          </div>
        </div>
        <div className="card-body flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs leading-relaxed text-ink-muted sm:max-w-md">
            {connection?.connected ? (
              <>
                Desvincula la cuenta <b className="font-bold text-ink">@{connection.nickname}</b>:
                se borran los tokens y el panel deja de sincronizar ventas, stock y envíos hasta
                que vuelvas a conectar.
              </>
            ) : (
              'No hay ninguna cuenta de Mercado Libre vinculada en este momento.'
            )}
          </p>
          {connection?.connected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="btn btn-danger-soft w-full shrink-0 sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              <span>{disconnecting ? 'Desvinculando…' : 'Desconectar Mercado Libre'}</span>
            </button>
          )}
        </div>

        {/* Reset total de la plataforma: solo SuperAdmin */}
        {isAdmin && (
          <div className="border-t border-danger/20 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-ink">
                    Resetear toda la plataforma
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                    Borra <b className="text-ink">todas</b> las cuentas de Mercado Libre, las
                    sesiones abiertas y el historial de empaque. Cada usuario vuelve a estado
                    inicial y debe vincular su cuenta desde cero. Acción irreversible.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFactoryReset}
                disabled={resetting}
                className="btn btn-danger-soft w-full shrink-0 sm:w-auto"
              >
                {resetting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>{resetting ? 'Reseteando…' : 'Resetear plataforma'}</span>
              </button>
            </div>

            {resetMsg && (
              <p
                role="status"
                className={`mt-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                  resetMsg.type === 'success'
                    ? 'border-success/30 bg-success-soft text-success'
                    : 'border-danger/30 bg-danger-soft text-danger'
                }`}
              >
                {resetMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0 break-words">{resetMsg.text}</span>
              </p>
            )}
          </div>
        )}
      </section>

      {loading && <p className="sr-only">Cargando configuración guardada…</p>}
    </div>
  );
}
