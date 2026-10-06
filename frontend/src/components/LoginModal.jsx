import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail,
  KeyRound,
  RefreshCw,
  Lock,
  Building2,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  Send,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { diagnoseGoogleLogin, googleLoginWarning } from '../services/authCompat';

/* ---------------------------------------------------------------------------
 * Acceso a la plataforma.
 *
 * Dos caminos, en este orden de prioridad real:
 *   - Correo + código de 6 dígitos: es el que funciona en todos los
 *     navegadores y es el que el backend soporta de punta a punta.
 *   - Google: cómodo, pero depende del navegador (ver `authCompat.js`).
 *
 * Sin transporte de correo configurado el backend devuelve `mail_unavailable`
 * en vez de inventar un envío. Acá se refleja: se dice que no se pudo y se
 * ofrece Google, sin prometer un correo que no va a llegar.
 * ------------------------------------------------------------------------- */

const RESEND_COOLDOWN = 45; // segundos

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithGoogle, loginWithOtp, adminEmail } = useAuth();

  const [authMode, setAuthMode] = useState('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [googleWarning, setGoogleWarning] = useState(null);
  const [mailStatus, setMailStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const emailRef = useRef(null);
  const codeRef = useRef(null);

  // Un error de una pantalla no debe quedar pegado al cambiar de vista.
  const goTo = useCallback((mode) => {
    setAuthMode(mode);
    setError(null);
  }, []);

  // Estado del correo: define si el acceso por código es viable. Se consulta
  // al abrir porque no requiere sesión.
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    api
      .getMailStatus()
      .then((res) => {
        if (active) setMailStatus(res);
      })
      .catch(() => {
        if (active) setMailStatus(null);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // En Edge con "Tracking Prevention" el almacenamiento en iframes de Google
  // queda bloqueado y el login se cuelga en silencio: se detecta al abrir.
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    diagnoseGoogleLogin()
      .then((diag) => {
        if (active) setGoogleWarning(googleLoginWarning(diag));
      })
      .catch(() => {
        if (active) setGoogleWarning(null);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // La vuelta desde Google puede fallar: lo emite AuthContext y se refleja acá.
  useEffect(() => {
    const onFailed = (e) => {
      setLoading(false);
      setGoogleWarning({
        title: e.detail?.blocked
          ? 'Este navegador bloqueó el acceso con Google'
          : 'No pudimos completar el acceso con Google',
        body: e.detail?.message || 'Intentá de nuevo o usá el acceso con correo y código.',
      });
    };
    window.addEventListener('ml:google-login-failed', onFailed);
    return () => window.removeEventListener('ml:google-login-failed', onFailed);
  }, []);

  // Enfoca el campo correspondiente al cambiar de pantalla.
  useEffect(() => {
    if (authMode === 'email') emailRef.current?.focus();
    if (authMode === 'verify') codeRef.current?.focus();
  }, [authMode]);

  // Cuenta regresiva del reenvío.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resetFor = useCallback(
    (mode) => {
      setOtpCode('');
      setInfo(null);
      goTo(mode);
    },
    [goTo]
  );

  // Al cerrar se limpia todo: no queda el correo de otra persona en el DOM.
  useEffect(() => {
    if (isOpen) return;
    setEmail('');
    setName('');
    setOtpCode('');
    setError(null);
    setInfo(null);
    setPendingUser(null);
    setGoogleWarning(null);
    setCopied(false);
    setCooldown(0);
    setAuthMode('email');
  }, [isOpen]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Revisá el correo: no parece una dirección válida.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const res = await api.requestOtpCode(cleanEmail, name.trim());
      setInfo(res.message);
      setOtpCode('');
      setAuthMode('verify');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      if (err.message?.includes('pendiente') || err.message?.includes('pending')) {
        setPendingUser({ email: cleanEmail });
        goTo('pending');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanCode = otpCode.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setError('El código tiene 6 dígitos.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await loginWithOtp(email.trim().toLowerCase(), cleanCode);
      if (res.success) onClose();
    } catch (err) {
      if (err.message?.includes('pendiente') || err.message?.includes('pending')) {
        setPendingUser({ email });
        goTo('pending');
      } else if (err.message?.includes('expir')) {
        setError('Ese código venció. Pedí uno nuevo.');
        setOtpCode('');
      } else {
        setError(err.message || 'No pudimos validar el código.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      // El redirect se lleva la página: no se libera el botón ni se cierra el
      // modal. Al volver, Firebase completa el ingreso.
      await loginWithGoogle();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'No pudimos iniciar el acceso con Google.');
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!isOpen) return null;

  const mailOff = mailStatus ? mailStatus.configured === false : false;
  // `onboarding@resend.dev` sólo entrega a la dirección de la cuenta de
  // Resend: el correo sale, pero no llega a ningún otro usuario.
  const senderLimited = Boolean(mailStatus?.restrictedSender);
  const senderHint = mailStatus?.sender ? `Enviamos desde ${mailStatus.sender}.` : null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="modal modal-sm">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />

        {/* ---------------- Encabezado ---------------- */}
        <div className="modal-head">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow">
              <Lock className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <h2 id="login-title" className="modal-title">
                Iniciar sesión
              </h2>
              <p className="modal-sub">Plataforma de gestión para Mercado Libre</p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="modal-close shrink-0" title="Cerrar" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ---------------- Cuerpo ---------------- */}
        <div className="modal-body">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-semibold text-danger" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {info && !error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft p-3 text-xs font-semibold text-success" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          {/* --- Vista 1: pedir código por correo --- */}
          {authMode === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="label" htmlFor="login-email">
                  Tu correo
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    id="login-email"
                    ref={emailRef}
                    type="email"
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="nombre@tuempresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="login-name">
                  Nombre o empresa <span className="font-normal normal-case text-ink-subtle">(opcional)</span>
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    id="login-name"
                    type="text"
                    autoComplete="organization"
                    placeholder="Nombre de depósito"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>

              {mailOff ? (
                <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs leading-relaxed text-ink-muted">
                  <p className="flex items-start gap-2 font-extrabold text-warning">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>El acceso por correo todavía no está habilitado</span>
                  </p>
                  <p className="mt-1.5">
                    Por ahora entrá con tu cuenta de Google. Si ya pediste acceso y figura
                    aprobado, contactá al administrador de la plataforma.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-ink-subtle">
                  Te mandamos un código de 6 dígitos al correo. Vence en 15 minutos.
                  {senderHint ? ` ${senderHint}` : ''}
                </p>
              )}

              {senderLimited && !mailOff && (
                <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-[11px] leading-relaxed text-ink-muted">
                  <p className="font-extrabold text-warning">Envío en modo prueba</p>
                  <p className="mt-1">
                    El correo sale sólo a la dirección registrada en Resend. Todavía no
                    llega a otros usuarios.
                  </p>
                </div>
              )}

              <button type="submit" disabled={loading || mailOff} className="btn btn-primary btn-block py-3.5">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Enviando…</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Enviar código</span>
                  </>
                )}
              </button>

              {/* Separador + Google */}
              <div className="flex items-center gap-3">
                <span className="divider flex-1" />
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  o seguí con
                </span>
                <span className="divider flex-1" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="btn btn-outline btn-block py-3.5 transition-colors hover:border-line-strong"
              >
                <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-bold">Continuar con Google</span>
              </button>

              {googleWarning && (
                <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs leading-relaxed text-ink-muted">
                  <p className="flex items-start gap-2 font-extrabold text-warning">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{googleWarning.title}</span>
                  </p>
                  <p className="mt-1.5">{googleWarning.body}</p>
                </div>
              )}
            </form>
          )}

          {/* --- Vista 2: validar código --- */}
          {authMode === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-muted/60 p-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-ink-muted">Enviamos el código a</p>
                  <p className="truncate font-mono text-xs font-bold text-ink">{email}</p>
                </div>
                <button type="button" onClick={copyEmail} className="btn btn-ghost btn-icon-sm shrink-0" title="Copiar correo" aria-label="Copiar correo">
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div>
                <label className="label" htmlFor="login-code">
                  Código de 6 dígitos
                </label>
                <input
                  id="login-code"
                  ref={codeRef}
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input tabular py-3.5 text-center font-display text-2xl font-extrabold tracking-[0.42em]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => resetFor('email')}
                  className="btn btn-ghost btn-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Cambiar correo</span>
                </button>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={cooldown > 0 || loading}
                  className="btn btn-ghost btn-sm ml-auto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}</span>
                </button>
              </div>

              <button type="submit" disabled={loading || otpCode.length !== 6} className="btn btn-primary btn-block py-3.5">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Validando…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>Entrar</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* --- Vista 3: pendiente de aprobación --- */}
          {authMode === 'pending' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/30 bg-warning-soft text-warning">
                <Clock className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-base font-extrabold tracking-tight text-ink">
                  Solicitud registrada
                </h3>
                <p className="text-xs leading-relaxed text-ink-muted">
                  Tu acceso quedó esperando la aprobación del administrador de la
                  plataforma. Te avisamos por correo apenas te habilite.
                </p>
              </div>

              {pendingUser?.email && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-muted px-4 py-3 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    Correo
                  </span>
                  <span className="truncate font-mono text-xs font-semibold text-ink">
                    {pendingUser.email}
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-line bg-muted/60 p-3 text-left">
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                  <span>
                    Cada cuenta es privada y sólo ve su propia operación de Mercado
                    Libre. Nadie más puede entrar a tu panel.
                  </span>
                </p>
              </div>

              <button type="button" onClick={() => resetFor('email')} className="btn btn-outline btn-block">
                Usar otro correo
              </button>
            </div>
          )}
        </div>

        {/* ---------------- Pie: administrador ---------------- */}
        {authMode !== 'pending' && adminEmail && (
          <div className="modal-foot justify-center border-t border-line bg-muted/60 px-5 py-3">
            <p className="text-[11px] text-ink-subtle">
              ¿Necesitás acceso?{' '}
              <span className="font-semibold text-ink-muted">Pedilo al administrador de la plataforma.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}