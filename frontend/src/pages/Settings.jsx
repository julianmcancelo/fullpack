import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
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
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const THEME_OPTIONS = [
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'dark', label: 'Oscuro', Icon: Moon },
  { id: 'system', label: 'Sistema', Icon: Monitor },
];

export default function Settings({
  connection,
  onRefreshStatus,
  onRefreshAllData,
  onOpenLogin,
  onOpenUsersAdmin,
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  return (
    <div className="page max-w-4xl">
      {/* ---------------- Header ---------------- */}
      <div>
        <h1 className="page-title">Conexión & credenciales</h1>
        <p className="page-sub">
          Configurá tus claves oficiales de la API de Mercado Libre para sincronizar catálogo,
          ventas y envíos.
        </p>
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
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
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

      {/* ---------------- SaaS account ---------------- */}
      <div className="card card-pad flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <img
            src={
              currentUser?.avatar ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.email || 'admin'}`
            }
            alt=""
            className="h-12 w-12 shrink-0 rounded-2xl border border-brand/40 bg-brand p-0.5"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-extrabold text-ink">
                {currentUser?.name || currentUser?.email || 'Usuario SaaS'}
              </h3>
              {isAdmin ? (
                <span className="badge badge-brand">SuperAdmin</span>
              ) : (
                <span className="badge badge-success">Autorizado</span>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
              {currentUser?.email || adminEmail}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-subtle">
              {isAdmin
                ? 'Tenés el control total de seguridad y autorización para nuevas cuentas.'
                : `Cuenta autorizada por el administrador (${adminEmail}).`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isAdmin && (
            <button type="button" onClick={onOpenUsersAdmin} className="btn btn-primary btn-sm">
              <Users className="h-4 w-4" />
              <span>Aprobar usuarios</span>
            </button>
          )}

          <button type="button" onClick={onOpenLogin} className="btn btn-outline btn-sm">
            <LogIn className="h-3.5 w-3.5" />
            <span>Cambiar cuenta</span>
          </button>
        </div>
      </div>

      {/* ---------------- Appearance ---------------- */}
      <section className="card">
        <div className="card-head">
          <div className="flex items-start gap-3">
            <span className="kpi-icon kpi-icon-accent">
              <Palette className="h-5 w-5" />
            </span>
            <div>
              <h2 className="card-title">Apariencia</h2>
              <p className="card-sub">Se guarda en este navegador y se aplica al instante.</p>
            </div>
          </div>
        </div>
        <div className="card-body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-ink-muted sm:max-w-sm">
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

      {/* ---------------- Mobile device ---------------- */}
      <section className="card">
        <div className="card-head">
          <div className="flex items-start gap-3">
            <span className="kpi-icon kpi-icon-brand">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <h2 className="card-title">Dispositivo móvil</h2>
              <p className="card-sub">
                Vinculá la app Android escaneando un código QR desde este panel.
              </p>
            </div>
          </div>
        </div>
        <div className="card-body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-ink-muted sm:max-w-sm">
            Escaneá el código y el celular queda habilitado para operar con tu cuenta, sin cargar
            claves a mano.
          </p>
          <button
            type="button"
            onClick={onOpenPairDevice}
            className="btn btn-primary btn-sm shrink-0"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Vincular celular</span>
          </button>
        </div>
      </section>

      {/* ---------------- ML connection state ---------------- */}
      {connection?.connected ? (
        <div className="card card-accent overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="kpi-icon kpi-icon-success h-12 w-12">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-extrabold tracking-tight text-ink">
                    Conectado como @{connection.nickname}
                  </h3>
                  <span className="badge badge-success">
                    <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-success" />
                    Activa
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>
                    User ID: <b className="tabular font-bold text-ink">#{connection.userId}</b>
                  </span>
                  <span className="text-ink-subtle">•</span>
                  <span>
                    Sitio: <b className="font-bold text-ink">{connection.siteId}</b>
                  </span>
                  {connection.permalink && (
                    <>
                      <span className="text-ink-subtle">•</span>
                      <a
                        href={connection.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link inline-flex items-center gap-1"
                      >
                        <span>Ver perfil en ML</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="btn btn-danger-soft btn-sm shrink-0 self-start sm:self-auto"
            >
              <Trash2 className="h-4 w-4" />
              <span>{disconnecting ? 'Desvinculando…' : 'Desvincular cuenta'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-bold text-ink">No hay ninguna cuenta vinculada</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Para operar con publicaciones, stock y envíos reales, completá las credenciales de tu
              aplicación o ingresá directamente tu Access Token.
            </p>
          </div>
        </div>
      )}

      {/* ---------------- Method 1: OAuth 2.0 ---------------- */}
      <section className="card">
        <div className="card-head">
          <div className="flex items-start gap-3">
            <span className="kpi-icon kpi-icon-brand">
              <Key className="h-5 w-5" />
            </span>
            <div>
              <h2 className="card-title">
                Método 1 · Conexión automática OAuth 2.0
                <span className="badge badge-success ml-1">Recomendado</span>
              </h2>
              <p className="card-sub">
                Renueva los tokens automáticamente, sin volver a cargar claves a mano.
              </p>
            </div>
          </div>
        </div>

        <div className="card-body space-y-5">
          {/* Step-by-step helper */}
          <div className="rounded-2xl border border-line bg-muted/60 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <HelpCircle className="h-4 w-4 text-brand-500" />
              <span>¿Cómo obtener tus credenciales en Mercado Libre?</span>
            </h4>
            <ol className="mt-2.5 list-inside list-decimal space-y-1.5 pl-1 text-xs leading-relaxed text-ink-muted">
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
                con tu cuenta de vendedor.
              </li>
              <li>
                Hacé clic en <b className="font-bold text-ink">Crear una aplicación</b>.
              </li>
              <li>
                En <b className="font-bold text-ink">Redirect URI</b> (URL de retorno) pegá
                exactamente:
                <div className="my-2 flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-2">
                  <span className="truncate font-mono text-[11px] font-semibold text-ink">
                    {settings.redirectUri}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(settings.redirectUri)}
                    title="Copiar URI"
                    aria-label="Copiar URI"
                    className="btn btn-ghost btn-icon-sm ml-auto shrink-0"
                  >
                    {copiedRedirect ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
              <li>
                Copiá tu <b className="font-bold text-ink">APP ID</b> y{' '}
                <b className="font-bold text-ink">Client Secret</b> y pegalos abajo.
              </li>
            </ol>
          </div>

          {/* Credentials form */}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="ml-app-id">
                  APP ID (Client ID) <span className="text-danger">*</span>
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
                  Client Secret Key <span className="text-danger">*</span>
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
                  Umbral de alerta de stock bajo
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

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleConnectOAuth}
                className="btn btn-primary btn-lg w-full sm:w-auto"
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
      </section>

      {/* ---------------- Method 2: direct token ---------------- */}
      <section className="card">
        <div className="card-head">
          <div className="flex items-start gap-3">
            <span className="kpi-icon kpi-icon-accent">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="card-title">Método 2 · Ingreso directo de Access Token</h2>
              <p className="card-sub">
                Útil si ya generaste un token desde Postman o la consola de Mercado Libre.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveManualToken} className="card-body space-y-4">
          <div className="field">
            <label className="label" htmlFor="ml-access-token">
              Access Token (Bearer APP_USR-…) <span className="text-danger">*</span>
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
              onChange={(e) => setDirectToken({ ...directToken, refreshToken: e.target.value })}
              className="input font-mono"
            />
            <p className="help">
              Guardarlo permite renovar el acceso automáticamente cuando el token expire.
            </p>
          </div>

          <button type="submit" disabled={savingToken} className="btn btn-dark">
            <span>{savingToken ? 'Validando token…' : 'Vincular con Access Token'}</span>
          </button>
        </form>
      </section>

      {/* ---------------- Database ---------------- */}
      <section className="card">
        <div className="card-head">
          <div className="flex items-start gap-3">
            <span className="kpi-icon kpi-icon-success">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="card-title">Base de datos cloud · Neon PostgreSQL</h2>
              <p className="card-sub">
                Persistencia de tokens OAuth, listas de empaque, control de calidad y logs de
                escaneo.
              </p>
            </div>
          </div>
        </div>

        <div className="card-body">
          <div className="rounded-2xl border border-line bg-muted/60 p-4 text-xs leading-relaxed text-ink-muted">
            <p>
              El sistema soporta <b className="font-bold text-ink">Neon PostgreSQL Serverless</b>.
              Si agregás la variable{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-ink ring-1 ring-line">
                DATABASE_URL
              </code>{' '}
              en el panel de Vercel (o en tu archivo{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-ink ring-1 ring-line">
                .env
              </code>
              ), se crean y sincronizan automáticamente las tablas:
            </p>
            <ul className="mt-2.5 space-y-1.5 pl-1">
              {[
                ['ml_auth', 'Tokens de acceso y credenciales @GRANA3DOK'],
                ['ml_settings', 'Preferencias y configuración de la tienda'],
                ['ml_packing_metadata', 'Control de calidad, checklist y estados de empaque'],
                ['ml_scan_logs', 'Auditoría histórica de cada escaneo QR y código de barras'],
              ].map(([table, description]) => (
                <li key={table} className="flex flex-wrap items-baseline gap-x-2">
                  <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink ring-1 ring-line">
                    {table}
                  </code>
                  <span>{description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
