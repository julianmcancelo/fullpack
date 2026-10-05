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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
          maskImage: 'radial-gradient(88% 62% at 50% 0%, #000 8%, transparent 74%)',
          WebkitMaskImage: 'radial-gradient(88% 62% at 50% 0%, #000 8%, transparent 74%)',
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
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        {/* Sello de seguridad */}
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[11px] font-bold text-ink-muted shadow-card sm:text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
          <span>Sistema de acceso restringido & aprobación por invitación</span>
        </div>

        {/* Título */}
        <h1 className="mt-7 max-w-3xl font-display text-[32px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          Control de Despacho, Stock & Empaque QR{' '}
          <span className="text-gradient-brand">en Tiempo Real</span>
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base">
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

        {/* Capacidades clave */}
        <div className="mt-14 w-full border-t border-line pt-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card card-hover flex items-center gap-3 p-4 sm:flex-col sm:gap-2.5 sm:text-center">
              <span className="kpi-icon kpi-icon-brand">
                <QrCode className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-ink">Lector QR móvil</span>
            </div>

            <div className="card card-hover flex items-center gap-3 p-4 sm:flex-col sm:gap-2.5 sm:text-center">
              <span className="kpi-icon kpi-icon-success">
                <Truck className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-ink">Flex & Colecta</span>
            </div>

            <div className="card card-hover flex items-center gap-3 p-4 sm:flex-col sm:gap-2.5 sm:text-center">
              <span className="kpi-icon kpi-icon-accent">
                <Boxes className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-ink">Stock automático</span>
            </div>
          </div>
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
