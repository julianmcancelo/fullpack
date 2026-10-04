import React, { useState, useEffect } from 'react';
import { 
  Key, 
  ShieldCheck, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Sliders, 
  HelpCircle,
  Copy,
  Check,
  Zap,
  Lock
} from 'lucide-react';
import { api } from '../services/api';

export default function Settings({ connection, onRefreshStatus, onRefreshAllData }) {
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
    <div className="space-y-6 max-w-4xl">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conexión con Mercado Libre & Credenciales</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configura tus claves oficiales de la API de Mercado Libre para sincronizar tu catálogo, ventas y envíos.
        </p>
      </div>

      {/* Status Feedback Message */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs font-bold hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Active Connected Account Status Card */}
      {connection?.connected ? (
        <div className="bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-md shadow-emerald-200">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-lg text-emerald-950">
                    Cuenta Conectada: @{connection.nickname}
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                    ACTIVA
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-emerald-800">
                  <span>User ID: <b>#{connection.userId}</b></span>
                  <span>•</span>
                  <span>País / Sitio: <b>{connection.siteId}</b></span>
                  {connection.permalink && (
                    <>
                      <span>•</span>
                      <a
                        href={connection.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-emerald-900 hover:underline font-semibold"
                      >
                        <span>Ver Perfil ML</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center space-x-2 self-start sm:self-auto shadow-sm"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>{disconnecting ? 'Desvinculando...' : 'Desvincular Cuenta'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-amber-950">No hay cuenta vinculada en este momento</p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Para operar con publicaciones, stock y envíos reales, completa las credenciales de tu aplicación a continuación o ingresa directamente tu Access Token.
            </p>
          </div>
        </div>
      )}

      {/* Method 1: OAuth 2.0 Official Flow */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="p-2 bg-yellow-100 rounded-xl text-yellow-900">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">
              Método 1: Conexión Automática OAuth 2.0 (Recomendado)
            </h2>
            <p className="text-xs text-slate-500">
              Permite auto-renovación de tokens sin necesidad de volver a ingresar claves manualmente.
            </p>
          </div>
        </div>

        {/* Step by step helper */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
          <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
            <HelpCircle className="w-4 h-4 text-yellow-600" />
            <span>¿Cómo obtener tus credenciales en Mercado Libre?</span>
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
            <li>
              Ingresa al{' '}
              <a
                href="https://developers.mercadolibre.com.ar/devcenter"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-semibold hover:underline inline-flex items-center space-x-0.5"
              >
                <span>DevCenter de Mercado Libre</span>
                <ExternalLink className="w-3 h-3 inline ml-0.5" />
              </a>{' '}
              con tu cuenta de vendedor.
            </li>
            <li>Haz clic en <b>Crear una aplicación</b>.</li>
            <li>
              En el campo <b>Redirect URI</b> (URL de retorno), coloca exactamente:
              <div className="flex items-center space-x-2 my-1.5 font-mono bg-white border border-slate-300 p-2 rounded-lg text-slate-900 font-semibold">
                <span className="truncate">{settings.redirectUri}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(settings.redirectUri)}
                  className="p-1 text-slate-500 hover:text-slate-900"
                  title="Copiar URI"
                >
                  {copiedRedirect ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </li>
            <li>Copia tu <b>APP ID (Client ID)</b> y <b>Client Secret</b> y pégalos a continuación:</li>
          </ol>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                APP ID (Client ID) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: 5829104820192841"
                value={settings.appId}
                onChange={(e) => setSettings({ ...settings, appId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Client Secret Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                placeholder="••••••••••••••••••••••••••••••••"
                value={settings.clientSecret}
                onChange={(e) => setSettings({ ...settings, clientSecret: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                País / Sitio de Mercado Libre
              </label>
              <select
                value={settings.siteId}
                onChange={(e) => setSettings({ ...settings, siteId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Umbral de Alerta de Stock Bajo (Unidades)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.lowStockThreshold}
                onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value, 10) || 5 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleConnectOAuth}
              className="w-full sm:w-auto px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center justify-center space-x-2"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Conectar con Mercado Libre (OAuth 2.0)</span>
            </button>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
            >
              {savingSettings ? 'Guardando...' : 'Guardar Credenciales'}
            </button>
          </div>
        </form>
      </div>

      {/* Method 2: Direct Token Input */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-900">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">
              Método 2: Ingreso Directo de Access Token
            </h2>
            <p className="text-xs text-slate-500">
              Ideal si ya tienes un Access Token generado mediante Postman o la consola de Mercado Libre.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveManualToken} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Access Token (Bearer APP_USR-...) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="APP_USR-..."
              value={directToken.accessToken}
              onChange={(e) => setDirectToken({ ...directToken, accessToken: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Refresh Token (Opcional)
            </label>
            <input
              type="text"
              placeholder="TG-..."
              value={directToken.refreshToken}
              onChange={(e) => setDirectToken({ ...directToken, refreshToken: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingToken}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-sm"
          >
            <span>{savingToken ? 'Validando Token...' : 'Vincular con Access Token'}</span>
          </button>
        </form>
      </div>

    </div>
  );
}
