import React from 'react';
import {
  ShoppingBag,
  ShieldCheck,
  ArrowRight,
  QrCode,
  Boxes,
  Truck,
  Lock,
  KeyRound,
  Printer,
  Smartphone,
  BellRing,
  ClipboardCheck,
  Link2,
  PackageCheck,
  Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: Boxes, tone: 'kpi-icon-brand', title: 'Stock en vivo', text: 'Precios y cantidades directo de tus publicaciones.' },
  { icon: Printer, tone: 'kpi-icon-accent', title: 'Etiquetas PDF y ZPL', text: 'Impresión masiva térmica o en hoja, con control de impresas.' },
  { icon: QrCode, tone: 'kpi-icon-success', title: 'Terminal QR en ráfaga', text: 'Leé etiqueta tras etiqueta con linterna y conteo de sesión.' },
  { icon: Smartphone, tone: 'kpi-icon-brand', title: 'App Android', text: 'Empaque, despacho, preguntas y updates desde el depósito.' },
  { icon: BellRing, tone: 'kpi-icon-warning', title: 'Alertas de venta', text: 'Aviso con sonido ante cada venta y pregunta nueva.' },
  { icon: ClipboardCheck, tone: 'kpi-icon-accent', title: 'Manifiesto de despacho', text: 'Hoja de ruta para el chofer con verificación por transportista.' },
];

const STEPS = [
  { icon: Link2, title: 'Conectá tu cuenta', text: 'OAuth oficial de Mercado Libre o token directo. Nada queda en el celular.' },
  { icon: PackageCheck, title: 'Empacá con QR', text: 'Escaneá cada etiqueta: se marca impresa, verificada y empaquetada.' },
  { icon: Send, title: 'Despachá', text: 'Control de salida por Flex, Colecta o Correo con manifiesto firmado.' },
];

export default function LandingGate({ onOpenLogin, onOpenRequestAccess }) {
  const { adminEmail } = useAuth();

  return (
    /* `force-light` keeps this public page on the light palette even if the
       signed-in app is set to dark mode. */
    <div className="force-light relative flex min-h-screen select-none flex-col overflow-hidden bg-app text-ink">
      {/* ---------- Ambiente: rejilla + halos de marca ---------- */}
      <div
        aria-hidden="true"
        className="surface-grid pointer-events-none absolute inset-0 opacity-70"
        style={{
          maskImage: 'radial-gradient(88% 62% at 50% 0%, black 8%, transparent 74%)',
          WebkitMaskImage: 'radial-gradient(88% 62% at 50% 0%, black 8%, transparent 74%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-radial-brand"
      />
      <div
        aria-hidden="true"
        className="animate-floaty pointer-events-none absolute -top-24 left-[6%] h-72 w-72 rounded-full bg-brand/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-[-8%] h-80 w-80 rounded-full bg-accent/10 blur-3xl"
      />

      {/* ---------- Barra superior de marca ---------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow">
            <ShoppingBag className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-extrabold tracking-tight text-ink">
                ML Pro
              </span>
              <span className="badge badge-brand">Gestión Privada</span>
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-ink-subtle">
              Plataforma logística & despacho
            </p>
          </div>
        </div>

        <button type="button" onClick={onOpenLogin} className="btn btn-outline btn-sm shrink-0">
          <Lock className="h-3.5 w-3.5 text-brand-600" />
          <span>Acceso usuarios</span>
        </button>
      </header>

      {/* ---------- Hero ---------- */}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 pb-16 pt-12 text-center">
        {/* Sello de seguridad */}
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[11px] font-bold text-ink-muted shadow-card sm:text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
          <span>Sistema de acceso restringido & aprobación por invitación</span>
        </div>

        {/* Título */}
        <h1 className="mt-7 max-w-3xl text-balance font-display text-[32px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          Control de Despacho, Stock & Empaque QR{' '}
          <span className="text-gradient-brand">en Tiempo Real</span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          Gestión inteligente de publicaciones, impresión masiva de etiquetas térmicas, terminal
          móvil de lectura de paquetes y sincronización oficial con Mercado Libre.
        </p>

        {/* Acciones */}
        <div className="mt-9 flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row">
          <button type="button" onClick={onOpenLogin} className="btn btn-primary btn-lg flex-1">
            <span>Iniciar sesión</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenRequestAccess}
            className="btn btn-outline btn-lg flex-1"
          >
            <KeyRound className="h-4 w-4 text-brand-600" />
            <span>Solicitar acceso</span>
          </button>
        </div>

        {/* Garantías (capacidades reales, sin métricas inventadas) */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-ink-subtle">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            OAuth oficial de ML
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-accent" />
            El celular no guarda credenciales
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-warning" />
            Flex · Colecta · Full · Correo
          </span>
        </div>

        {/* Cómo funciona */}
        <div className="mt-16 w-full">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-subtle">
            Cómo funciona
          </p>
          <div className="mt-5 grid gap-3 text-left sm:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="card card-hover relative overflow-hidden p-5">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-2 -top-4 font-display text-7xl font-extrabold text-ink/[0.06]"
                  >
                    {i + 1}
                  </span>
                  <span className="kpi-icon kpi-icon-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-extrabold text-ink">{step.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Capacidades */}
        <div className="mt-12 w-full">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-subtle">
            Todo lo que incluye
          </p>
          <div className="mt-5 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card card-hover flex items-start gap-3 p-4">
                  <span className={`kpi-icon ${feature.tone} shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold text-ink">{feature.title}</span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">
                      {feature.text}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cierre */}
        <div className="card mt-12 flex w-full flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between sm:p-7 sm:text-left">
          <div className="min-w-0">
            <p className="text-balance font-display text-lg font-extrabold tracking-tight text-ink">
              Tu depósito, bajo control hoy mismo
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Pedí acceso y empezá a despachar con trazabilidad completa.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRequestAccess}
            className="btn btn-primary w-full shrink-0 sm:w-auto"
          >
            <span>Solicitar acceso</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>

      {/* ---------- Pie ---------- */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl border-t border-line px-6 py-6">
        <p className="text-center text-[11px] text-ink-subtle">
          Administración centralizada y autorización por{' '}
          <b className="font-semibold text-ink-muted">{adminEmail}</b>
        </p>
      </footer>
    </div>
  );
}
