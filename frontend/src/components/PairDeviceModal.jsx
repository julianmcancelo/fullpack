import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { celebrate } from '../utils/celebrate';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 3000;
const TICK_INTERVAL_MS = 1000;

const STEPS = [
  'Abrí la app Plataforma en tu celular Android e iniciá sesión con tu misma cuenta.',
  'Entrá a «Vincular dispositivo» y apuntá la cámara al código QR de esta pantalla.',
  'Cuando la app confirme, esta pantalla se actualiza sola y el celular aparece en la lista de abajo.',
];

/* Relative time in plain Spanish, e.g. "hace 5 min" / "ayer". */
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

/* "9:59" for the countdown next to the code. */
function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PairDeviceModal({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const email = currentUser?.email || '';

  const [pairing, setPairing] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState(null);
  const [status, setStatus] = useState('pending');
  /* `false` cuando el servidor no puede confirmar el escaneo en vivo (sin base de datos). */
  const [liveConfirm, setLiveConfirm] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [claimedDevice, setClaimedDevice] = useState(null);
  const [claimedUser, setClaimedUser] = useState(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const celebratedRef = useRef(false);

  /* ------------------------------------------------------------------ */
  /* Data                                                                */
  /* ------------------------------------------------------------------ */

  const createPairing = useCallback(async () => {
    if (!email) {
      setError('Necesitás iniciar sesión para vincular un celular.');
      return;
    }

    setCreating(true);
    setError(null);
    setQrError(null);
    setStatus('pending');
    setLiveConfirm(true);
    setSecondsLeft(0);
    setClaimedDevice(null);
    setClaimedUser(null);
    celebratedRef.current = false;

    try {
      const res = await api.createPairing(email);
      const expiresAt = res?.expiresAt || null;
      const target = expiresAt ? new Date(expiresAt).getTime() : 0;
      if (target && !Number.isNaN(target)) {
        setSecondsLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
      }
      setPairing({
        code: res?.code || '',
        secret: res?.secret || '',
        ticket: res?.ticket || '',
        expiresAt,
        qrPayload: res?.qrPayload || '',
        apiBase: res?.apiBase || '',
        email: res?.email || email,
      });
    } catch (err) {
      setPairing(null);
      setError(err?.message || 'No pudimos generar el código de vinculación.');
    } finally {
      setCreating(false);
    }
  }, [email]);

  const loadDevices = useCallback(async () => {
    if (!email) return;

    try {
      setDevicesLoading(true);
      setDevicesError(null);
      const res = await api.getPairDevices(email);
      setDevices(Array.isArray(res?.devices) ? res.devices : []);
    } catch (err) {
      setDevicesError(err?.message || 'No pudimos cargar los dispositivos vinculados.');
    } finally {
      setDevicesLoading(false);
    }
  }, [email]);

  /* Open / close: create a fresh code and refresh the device list. */
  useEffect(() => {
    if (!isOpen) return undefined;
    createPairing();
    loadDevices();
    return undefined;
  }, [isOpen, createPairing, loadDevices]);

  /* Escape closes the modal; the listener is always removed on cleanup. */
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /* Render the QR payload as SVG (no canvas: immune to blocked 2D contexts). */
  useEffect(() => {
    if (!pairing?.qrPayload) {
      setQrDataUrl('');
      return undefined;
    }

    let active = true;
    setQrError(null);
    QRCode.toString(pairing.qrPayload, {
      type: 'svg',
      margin: 1,
      /* black/white keywords: el QR necesita contraste máximo en el papel/pantalla,
         no es color de UI, así que no usa tokens del sistema. */
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((svg) => {
        if (!active) return;
        setQrDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      })
      .catch((err) => {
        if (!active) return;
        setQrDataUrl('');
        const detail = err?.message ? ` (${err.message})` : '';
        setQrError(`No pudimos dibujar el código QR${detail}. Escribí el código manual en la app.`);
      });

    return () => {
      active = false;
    };
  }, [pairing?.qrPayload]);

  /* Countdown towards expiresAt while the code is still usable. */
  useEffect(() => {
    if (!isOpen || !pairing || status !== 'pending') return undefined;

    const tick = () => {
      const target = pairing.expiresAt ? new Date(pairing.expiresAt).getTime() : 0;
      if (!target || Number.isNaN(target)) {
        setSecondsLeft(0);
        return;
      }
      const left = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setStatus('expired');
    };

    tick();
    const interval = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOpen, pairing, status]);

  /* Poll the pairing status every 3 s while it is pending. */
  useEffect(() => {
    if (!isOpen || !pairing || status !== 'pending' || !liveConfirm) return undefined;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await api.getPairingStatus(pairing.code, pairing.secret, pairing.ticket);
        if (cancelled) return;

        // Sin base de datos compartida el servidor no puede confirmar el escaneo:
        // se corta el sondeo y se avisa, en vez de dejar la rueda girando para siempre.
        if (res?.dbAvailable === false) {
          setLiveConfirm(false);
          return;
        }

        const next = res?.status;
        if (next === 'claimed') {
          setClaimedDevice(res?.device || null);
          setClaimedUser(res?.user || null);
          setStatus('claimed');
        } else if (next === 'expired' || next === 'invalid') {
          setStatus(next);
        }
      } catch {
        /* Polling is best-effort: keep the last known state on transient errors. */
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, pairing, status]);

  /* Celebrate once when the device is claimed; never break the UI if it fails. */
  useEffect(() => {
    if (status !== 'claimed') {
      celebratedRef.current = false;
      return;
    }
    if (celebratedRef.current) return;
    celebratedRef.current = true;

    try {
      celebrate({ particleCount: 120, spread: 90, startVelocity: 42, origin: { y: 0.6 } });
    } catch {
      /* Decorative only. */
    }
  }, [status]);

  /* Refresh the list as soon as a device gets linked. */
  useEffect(() => {
    if (!isOpen || status !== 'claimed') return;
    loadDevices();
  }, [isOpen, status, loadDevices]);

  const handleUnlink = async (device) => {
    const name = device?.name || 'este celular';
    if (!window.confirm(`¿Desvincular "${name}"? Vas a tener que escanear un código nuevo para volver a conectarlo.`)) {
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

  if (!isOpen) return null;

  const isExpired = status === 'expired' || status === 'invalid';
  const isClaimed = status === 'claimed';
  const linkedUser = claimedUser?.name || claimedUser?.email || email;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Vincular celular">
      <div className="modal modal-lg">
        {/* ---------------- Header ---------------- */}
        <div className="modal-head">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow">
              <Smartphone className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="modal-title">Vincular celular</h2>
              <p className="modal-sub">
                Escaneá el código con la app Android para conectar el celular a{' '}
                <b className="font-bold text-ink-muted">{email || 'tu cuenta'}</b>.
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body">
          {/* Sin base de datos compartida no hay confirmación en vivo del escaneo. */}
          {!liveConfirm && status === 'pending' && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning-soft px-3.5 py-3 text-xs font-semibold text-warning">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              <span>
                Este servidor no tiene base de datos compartida, así que no podemos confirmar el
                escaneo desde acá. Cuando el celular lea el QR, la app queda vinculada a tu cuenta.
              </span>
            </div>
          )}

          {/* ---------------- Errors ---------------- */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-xs font-semibold text-danger">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={createPairing}
                  disabled={creating}
                  className="mt-1.5 font-bold underline underline-offset-2"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* ---------------- Loading skeleton ---------------- */}
          {creating && !pairing && (
            <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
              <div className="skeleton mx-auto h-[200px] w-[200px] rounded-2xl" />
              <div className="space-y-3">
                <div className="skeleton h-[104px] w-full rounded-2xl" />
                <div className="skeleton h-4 w-36 rounded-lg" />
              </div>
            </div>
          )}

          {/* ---------------- Expired / invalid ---------------- */}
          {pairing && isExpired && (
            <div className="rounded-2xl border border-warning/30 bg-warning-soft p-5 text-center">
              <span className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/30 bg-card text-warning">
                <Clock className="h-6 w-6" />
              </span>
              <p className="text-sm font-extrabold text-ink">
                {status === 'invalid' ? 'El código ya no es válido' : 'El código venció'}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
                Los códigos duran 10 minutos por seguridad. Generá uno nuevo para seguir con la
                vinculación desde el celular.
              </p>
              <button
                type="button"
                onClick={createPairing}
                disabled={creating}
                className="btn btn-primary btn-sm mt-3.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${creating ? 'animate-spin' : ''}`} />
                <span>{creating ? 'Generando…' : 'Generar un código nuevo'}</span>
              </button>
            </div>
          )}

          {/* ---------------- QR + manual code ---------------- */}
          {pairing && !isExpired && !isClaimed && (
            <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
              <div className="mx-auto w-[200px] max-w-full shrink-0 rounded-2xl border border-line bg-white p-3 shadow-card">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR para vincular el celular"
                    width={512}
                    height={512}
                    className="h-auto w-full rounded-xl"
                  />
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-muted px-3 text-center">
                    <QrCode className="h-7 w-7 text-ink-subtle" />
                    <span className="text-[10px] font-bold leading-relaxed text-ink-subtle">
                      {qrError || 'Generando código QR…'}
                    </span>
                    {qrError && (
                      <button
                        type="button"
                        onClick={createPairing}
                        disabled={creating}
                        className="btn btn-outline btn-xs mt-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${creating ? 'animate-spin' : ''}`} />
                        <span>Reintentar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-3">
                <div className="rounded-2xl border border-line bg-muted/60 p-4 text-center">
                  <p className="label !mb-1">Código manual</p>
                  <p className="tabular pl-[0.3em] font-display text-3xl font-extrabold tracking-[0.3em] text-ink sm:text-4xl">
                    {pairing.code || '------'}
                  </p>
                  <p className="help mt-2">
                    Si la cámara del celular no llega a escanear, escribí este código en la app.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="chip border-warning/30 bg-warning-soft text-warning">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="tabular">vence en {formatCountdown(secondsLeft)}</span>
                  </span>
                  <span className="badge badge-neutral">esperando al celular</span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- Claimed ---------------- */}
          {isClaimed && (
            <div className="rounded-2xl border border-success/30 bg-success-soft p-5 text-center animate-pop">
              <span className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-success/30 bg-card text-success">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="text-sm font-extrabold text-ink">¡Celular vinculado!</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">
                <b className="font-bold text-ink">{claimedDevice?.name || 'Tu dispositivo Android'}</b>{' '}
                ya puede operar con la cuenta{' '}
                <b className="font-bold text-ink">{linkedUser || 'vinculada'}</b>.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <span className="badge badge-success">{claimedDevice?.platform || 'Android'}</span>
                {claimedDevice?.appVersion && (
                  <span className="chip">App v{claimedDevice.appVersion}</span>
                )}
                {claimedDevice?.lastSeenAt && (
                  <span className="chip tabular">Último acceso: {formatRelative(claimedDevice.lastSeenAt)}</span>
                )}
              </div>
            </div>
          )}

          {/* ---------------- Phone steps ---------------- */}
          {!isClaimed && (
            <section className="space-y-2.5">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-subtle">
                Cómo vincularlo
              </h3>
              <ol className="space-y-2.5">
                {STEPS.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-start gap-3 rounded-xl border border-line bg-muted/50 p-3"
                  >
                    <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-[11px] font-extrabold text-brand-ink">
                      {index + 1}
                    </span>
                    <span className="text-xs leading-relaxed text-ink-muted">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ---------------- Linked devices ---------------- */}
          <section className="space-y-3">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-ink">
                <Smartphone className="h-4 w-4 text-accent" />
                <span>Dispositivos vinculados</span>
                {devices.length > 0 && (
                  <span className="badge badge-neutral tabular">{devices.length}</span>
                )}
              </h3>
              <button
                type="button"
                onClick={loadDevices}
                disabled={devicesLoading}
                className="btn btn-ghost btn-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${devicesLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </header>

            {devicesError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs font-semibold text-danger">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{devicesError}</span>
                </span>
                <button
                  type="button"
                  onClick={loadDevices}
                  className="shrink-0 font-bold underline underline-offset-2"
                >
                  Reintentar
                </button>
              </div>
            )}

            {devicesLoading && devices.length === 0 ? (
              <div className="space-y-2.5">
                <div className="skeleton h-[68px] w-full rounded-2xl" />
                <div className="skeleton h-[68px] w-full rounded-2xl" />
              </div>
            ) : devices.length === 0 ? (
              <div className="empty rounded-2xl border border-dashed border-line bg-muted/50 py-9">
                <span className="empty-icon">
                  <Smartphone className="h-6 w-6" />
                </span>
                <p className="empty-title">Todavía no hay celulares vinculados</p>
                <p className="empty-text">
                  Cuando escanees el código QR, el dispositivo va a aparecer acá con su último
                  acceso.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-bold text-ink">
                            {device.name || 'Dispositivo Android'}
                          </span>
                          <span className="badge badge-info">{device.platform || 'Android'}</span>
                          {device.appVersion && <span className="chip">v{device.appVersion}</span>}
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink-subtle">
                          Último acceso:{' '}
                          <span className="tabular">{formatRelative(device.lastSeenAt)}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnlink(device)}
                      disabled={removingId === device.id}
                      className="btn btn-danger-soft btn-sm shrink-0 self-start sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{removingId === device.id ? 'Desvinculando…' : 'Desvincular'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------------- Footer ---------------- */}
        <div className="modal-foot">
          <button
            type="button"
            onClick={createPairing}
            disabled={creating}
            className="btn btn-outline btn-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${creating ? 'animate-spin' : ''}`} />
            <span>{creating ? 'Generando…' : 'Generar un código nuevo'}</span>
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
