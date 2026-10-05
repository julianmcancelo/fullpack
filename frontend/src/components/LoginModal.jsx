import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Lock,
  UserCheck,
  Building2
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
  const [pendingUser, setPendingUser] = useState(null);
  const googleBtnRef = React.useRef(null);

  // Helper to parse JWT from Google Identity Services without external libs
  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    try {
      setLoading(true);
      setError(null);
      const payload = parseJwt(response.credential);
      if (!payload || !payload.email) {
        throw new Error('No se pudo verificar la cuenta de Google.');
      }

      const res = await loginWithGoogle({
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatar: payload.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${payload.email}`,
        googleId: payload.sub,
      });

      if (res.success) {
        onClose();
      }
    } catch (err) {
      if (err.message?.includes('pending_approval') || err.message?.includes('pendiente')) {
        setAuthMode('pending_approval');
        setPendingUser({ email: err.user?.email || 'Tu correo' });
      } else {
        setError(err.message || 'Error al validar credencial de Google');
      }
    } finally {
      setLoading(false);
    }
  };

  // Mount Google One-Tap & Render Button if available
  React.useEffect(() => {
    if (!isOpen) return;

    const initGoogleGis = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: '841022012035-7196.apps.googleusercontent.com', // Standard OAuth client format
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleBtnRef.current) {
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'continue_with',
              shape: 'pill',
            });
          }
        } catch (e) {
          console.warn('GIS Init note:', e.message);
        }
      }
    };

    const timer = setTimeout(initGoogleGis, 300);
    return () => clearTimeout(timer);
  }, [isOpen, authMode]);

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
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${targetEmail}`,
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
      setSuccessMsg(res.message);
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp);
        setOtpCode(res.debugOtp); // Auto-fill for ultra-convenience
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 sm:p-8 relative overflow-hidden">
        
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500"></div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-yellow-400/20 text-yellow-950 dark:text-yellow-300 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-yellow-400/30">
            <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Acceso SaaS Multicuenta
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Plataforma Profesional de Gestión de Mercado Libre
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* VIEW 1: Main Auth Options */}
        {authMode === 'options' && (
          <div className="space-y-4">
            
            {/* SuperAdmin Quick Access Card */}
            <button
              onClick={() => handleGoogleSignIn(adminEmail, 'Julián Cancelo (Admin)')}
              disabled={loading}
              className="w-full p-4 rounded-2xl border-2 border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20 hover:bg-yellow-100/50 dark:hover:bg-yellow-950/40 text-left transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center text-slate-950 font-black shrink-0 shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white">Cuenta Administrador Principal</span>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-yellow-400 text-slate-950 uppercase">SuperAdmin</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-0.5">{adminEmail}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition" />
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">o ingresar con tu cuenta</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            {/* Official Firebase Google Auth Button */}
            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  setError(null);
                  await loginWithGoogle();
                  onClose();
                } catch (err) {
                  if (err.message?.includes('pending_approval') || err.message?.includes('pendiente')) {
                    setAuthMode('pending_approval');
                  } else if (err.code !== 'auth/popup-closed-by-user') {
                    setError(err.message || 'Error al autenticar con Google');
                  }
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-extrabold text-xs flex items-center justify-center space-x-3 transition shadow-sm cursor-pointer active:scale-[0.99]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continuar con Google</span>
            </button>

            {/* Email OTP Magic Token */}
            <button
              onClick={() => setAuthMode('otp_request')}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 dark:bg-yellow-400 hover:bg-slate-800 dark:hover:bg-yellow-500 text-white dark:text-slate-950 font-black text-xs flex items-center justify-center space-x-2 transition shadow-sm"
            >
              <KeyRound className="w-4 h-4" />
              <span>Ingresar con Correo y Token Único</span>
            </button>

          </div>
        )}

        {/* VIEW 2: Request OTP */}
        {authMode === 'otp_request' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tu Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@tuempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-yellow-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nombre o Empresa (Opcional)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nombre de depósito o usuario"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-yellow-400 outline-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              * Las cuentas nuevas requieren aprobación de seguridad de <b>{adminEmail}</b> antes de acceder.
            </p>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('options')}
                className="w-1/3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Enviar Código</span>}
              </button>
            </div>
          </form>
        )}

        {/* VIEW 3: Verify OTP Code */}
        {authMode === 'otp_verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            
            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ingresa el Código de 6 Dígitos
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full text-center tracking-[0.5em] text-2xl font-black py-3 bg-slate-50 dark:bg-slate-800 border-2 border-yellow-400 text-slate-900 dark:text-white rounded-xl focus:outline-none"
              />
            </div>

            {debugOtp && (
              <div className="p-2.5 bg-yellow-100/70 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800 rounded-xl text-center">
                <span className="text-[11px] font-bold text-yellow-900 dark:text-yellow-300">
                  Código de demostración generado: <b className="font-mono text-sm">{debugOtp}</b>
                </span>
              </div>
            )}

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('otp_request')}
                className="w-1/3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Reenviar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Validar e Ingresar</span>}
              </button>
            </div>
          </form>
        )}

        {/* VIEW 4: Pending Approval Notice */}
        {authMode === 'pending_approval' && (
          <div className="text-center py-2 space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 text-amber-800 dark:text-amber-300 flex items-center justify-center mx-auto shadow-sm">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Cuenta Pendiente de Aprobación</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Tu solicitud para <b className="text-slate-900 dark:text-white">{pendingUser?.email}</b> ha sido registrada con éxito. Por motivos de seguridad del sistema SaaS, el administrador principal (<b>{adminEmail}</b>) debe autorizar tu acceso.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-left text-xs space-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-200">Estado:</span>
              <span className="text-amber-600 dark:text-amber-400 font-extrabold ml-1">EN REVISIÓN DE ADMINISTRACIÓN</span>
            </div>

            <button
              onClick={() => setAuthMode('options')}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition"
            >
              Entendido / Cambiar de cuenta
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
