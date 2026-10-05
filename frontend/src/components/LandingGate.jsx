import React from 'react';
import { 
  ShoppingBag, 
  ShieldCheck, 
  ArrowRight, 
  QrCode, 
  Boxes, 
  Truck, 
  Lock, 
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingGate({ onOpenLogin, onOpenRequestAccess }) {
  const { adminEmail } = useAuth();

  return (
    <div className="relative flex min-h-screen select-none flex-col overflow-hidden bg-ink-gradient text-white">

      {/* ---------- Ambiente: rejilla + glows de marca ---------- */}
      <div
        aria-hidden="true"
        className="surface-grid-light pointer-events-none absolute inset-0"
        style={{
          maskImage: 'radial-gradient(80% 62% at 50% 0%, #000 6%, transparent 76%)',
          WebkitMaskImage: 'radial-gradient(80% 62% at 50% 0%, #000 6%, transparent 76%)',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-radial-brand" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-radial-accent" />
      <div aria-hidden="true" className="animate-floaty pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />

      {/* ---------- Barra superior de marca ---------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-brand-ink shadow-glow">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-extrabold tracking-tight text-white">ML Pro</span>
              <span className="badge border-brand/40 bg-brand/15 text-brand-300">SaaS Privado</span>
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-white/55">Plataforma Logística & Despacho</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLogin}
          className="btn btn-sm shrink-0 border border-white/10 bg-white/5 text-white backdrop-blur-md hover:border-white/20 hover:bg-white/10"
        >
          <Lock className="h-3.5 w-3.5 text-brand-400" />
          <span>Acceso Usuarios</span>
        </button>
      </header>

      {/* ---------- Hero ---------- */}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">

        {/* Badge de seguridad en tarjeta de vidrio */}
        <div className="glass inline-flex items-center gap-2 rounded-full border-white/15 bg-white/[0.06] px-4 py-2 text-[11px] font-bold text-white/85 shadow-card sm:text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-400" />
          <span>Sistema de Acceso Restringido & Aprobación por Invitación</span>
        </div>

        {/* Título */}
        <h1 className="mt-7 max-w-3xl font-display text-[32px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
          Control de Despacho, Stock & Empaque QR{' '}
          <span className="text-gradient-brand">en Tiempo Real</span>
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
          Gestión inteligente de publicaciones, impresión masiva de etiquetas térmicas, terminal móvil de lectura de paquetes y sincronización oficial con Mercado Libre.
        </p>

        {/* Acciones */}
        <div className="mt-9 flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onOpenLogin}
            className="btn btn-primary btn-lg flex-1"
          >
            <span>Iniciar Sesión</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenRequestAccess}
            className="btn btn-outline btn-lg flex-1 border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10"
          >
            <KeyRound className="h-4 w-4 text-brand-400" />
            <span>Solicitar Acceso</span>
          </button>
        </div>

        {/* Capacidades clave */}
        <div className="mt-14 w-full max-w-3xl border-t border-white/10 pt-8">
          <div className="grid gap-3 sm:grid-cols-3">

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] sm:flex-col sm:gap-2.5 sm:text-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/15 text-brand-300">
                <QrCode className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-white/85">Lector QR Móvil</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] sm:flex-col sm:gap-2.5 sm:text-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/15 text-emerald-300">
                <Truck className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-white/85">Flex & Colecta</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] sm:flex-col sm:gap-2.5 sm:text-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/15 text-sky-300">
                <Boxes className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-white/85">Stock Automático</span>
            </div>

          </div>
        </div>

      </main>

      {/* ---------- Pie ---------- */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl border-t border-white/10 px-6 py-6">
        <p className="text-center text-[11px] text-white/45">
          Administración centralizada y autorización por <b className="font-semibold text-white/75">{adminEmail}</b>
        </p>
      </footer>

    </div>
  );
}
