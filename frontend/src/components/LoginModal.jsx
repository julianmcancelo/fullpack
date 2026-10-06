import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Lock,
  Building2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithGoogle, loginWithOtp, adminEmail } = useAuth();
  
  const [authMode, setAuthMode] = useState('options'); // 'options', 'otp_request', 'otp_verify', 'pending_approval'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [debugOtp, setDebugOtp] = useState(null);
  const [otpNotice, setOtpNotice] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);

  // Nota: el login de Google se hace por Firebase (redirect), no con Google
  // Identity Services. El `client_id` de GIS estabatomado del App ID de
  // Mercado Libre, que no es un proyecto de Google: Google rechazaba el
  // credential y el botón no avanzaba. Firebase ya tiene su cliente OAuth
  // válido y es la única fuente de verdad para autenticar con Google.

  if (!isOpen) return null;

  // Handle Google Login Simulation / One-Tap
  const handleGoogleSignIn = async (customEmail = null, customName = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const targetEmail = customEmail || email || adminEmail;
      const targetName = customName || name || (targetEmail.includes('jcancelo') ? 'Julián Cancelo (Admin)' : targetEmail.split('@')[0]);

      const res = await loginWithGoogle({
        email: targetEmail,
        name: targetName,
        avatar: '',
        googleId: `google_${Date.now()}`,
      });

      if (res.success) {
        onClose();
      }
    } catch (err) {
      if (err.message?.includes('pending_approval') || err.message?.includes('pendiente')) {
        setAuthMode('pending_approval');
        setPendingUser({ email: customEmail || email });
      } else {
        setError(err.message || 'Error al iniciar sesión con Google');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request OTP Code
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      const res = await api.requestOtpCode(email, name);
      // El backend devuelve el código solo cuando el correo no pudo enviarse
      // (sin SMTP configurado). En ese caso lo mostramos y lo autocompletamos.
      const code = res.code || res.debugOtp || null;
      setOtpNotice(res.notice || null);
      setSuccessMsg(res.message);
      setDebugOtp(code);
      setOtpCode(code || '');
      setAuthMode('otp_verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP Code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode) {
      setError('Por favor ingresa el código de 6 dígitos.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await loginWithOtp(email, otpCode);
      if (res.success) {
        onClose();
      }
    } catch (err) {
      if (err.message?.includes('pending_approval') || err.message?.includes('pendiente')) {
        setAuthMode('pending_approval');
        setPendingUser({ email });
      } else {
        setError(err.message || 'Código inválido o expirado.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay">
      <div className="modal">

        {/* Acento superior de marca */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />

        {/* Encabezado */}
        <div className="modal-head">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="modal-title">Iniciar Sesión</h2>
              <p className="modal-sub">Plataforma de Gestión para Mercado Libre</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="modal-close shrink-0"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="modal-body">

          {/* Alerta de error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-xs font-semibold text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* VIEW 1: Main Auth Options */}
          {authMode === 'options' && (
            <div className="space-y-3.5">
              
              {/* Login con Google vía Firebase (redirect) */}
              <button
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError(null);
                    await loginWithGoogle();
                    // Con redirect la página se va y vuelve: no cerramos el
                    // modal ni liberamos el botón, el listener de Firebase
                    // completa el ingreso al volver.
                    setError('Te redirigimos a Google… volvé en un momento.');
                  } catch (err) {
                    if (err.message?.includes('pending_approval') || err.message?.includes('pendiente')) {
                      setAuthMode('pending_approval');
                    } else {
                      setError(err.message || 'Error al autenticar con Google');
                    }
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="btn btn-outline btn-lg btn-block py-4 shadow-sm hover:border-brand"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-bold">Continuar con Google</span>
              </button>

              <div className="flex items-center gap-3 py-1">
                <span className="divider flex-1" />
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">o con correo</span>
                <span className="divider flex-1" />
              </div>

              {/* Email OTP Magic Token */}
              <button
                onClick={() => setAuthMode('otp_request')}
                className="btn btn-primary btn-lg btn-block py-4"
              >
                <KeyRound className="h-4 w-4" />
                <span>Ingresar con Correo y Código</span>
              </button>

            </div>
          )}

          {/* VIEW 2: Request OTP */}
          {authMode === 'otp_request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="label">Tu Correo Electrónico</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@tuempresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label">Nombre o Empresa (Opcional)</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    type="text"
                    placeholder="Nombre de depósito o usuario"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>

              <p className="help">
                * Tu acceso será verificado por administración antes de habilitar la sesión.
              </p>

              <div className="modal-foot -mx-5 -mb-5 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('options')}
                  className="btn btn-outline flex-1"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex-[2]"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span>Enviar Código</span>}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: Verify OTP Code */}
          {authMode === 'otp_verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              
              {successMsg && (
                <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft p-3.5 text-xs font-semibold text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="label">Ingresa el Código de 6 Dígitos</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="input tabular border-line-strong py-3 text-center font-display text-2xl font-extrabold tracking-[0.4em] placeholder:tracking-[0.4em]"
                />
              </div>

              {debugOtp ? (
                <div className="space-y-1.5 rounded-xl border border-warning/30 bg-warning-soft p-3 text-center">
                  <span className="block text-[11px] font-semibold text-warning">
                    {otpNotice || 'El correo no está configurado en el servidor: usá este código.'}
                  </span>
                  <span className="block font-mono text-lg font-extrabold tracking-[0.35em] text-ink">
                    {debugOtp}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(String(debugOtp));
                    }}
                    className="btn btn-ghost btn-xs mt-1"
                  >
                    Copiar código
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-muted/60 p-2.5 text-center">
                  <span className="text-[11px] font-semibold text-ink-muted">
                    Revisá tu casilla de correo o pedile el código al administrador.
                  </span>
                </div>
              )}

              <div className="modal-foot -mx-5 -mb-5 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('otp_request')}
                  className="btn btn-outline flex-1"
                >
                  Reenviar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex-[2]"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span>Validar e Ingresar</span>}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 4: Pending Approval Notice */}
          {authMode === 'pending_approval' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/30 bg-warning-soft text-warning">
                <Clock className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-base font-extrabold tracking-tight text-ink">Cuenta Pendiente de Aprobación</h3>
                <p className="text-xs leading-relaxed text-ink-muted">
                  Tu solicitud ha sido registrada correctamente. Por motivos de seguridad, tu acceso debe ser autorizado por administración antes de ingresar a la plataforma.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-muted px-4 py-3 text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Estado:</span>
                <span className="badge badge-warning">En revisión de administración</span>
              </div>

              <div className="modal-foot -mx-5 -mb-5">
                <button
                  onClick={() => setAuthMode('options')}
                  className="btn btn-outline btn-block"
                >
                  Entendido / Cambiar de cuenta
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
