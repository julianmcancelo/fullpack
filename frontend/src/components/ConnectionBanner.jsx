import React from 'react';
import { Key, ArrowRight, ShieldAlert } from 'lucide-react';

export default function ConnectionBanner({ onGoToSettings }) {
  return (
    <div className="card mb-6 border-warning/30 bg-warning-soft">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
            <Key className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-extrabold tracking-tight text-ink md:text-lg">
                Conecta tu cuenta de Mercado Libre
              </h3>
              <span className="badge badge-warning">
                <ShieldAlert className="h-3 w-3" />
                Paso requerido
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted md:text-sm">
              Para sincronizar tus publicaciones en vivo, editar stock, gestionar ventas e imprimir etiquetas oficiales de Mercado Envíos, ingresa tus credenciales de aplicación o tu Access Token en la sección de Ajustes y Credenciales.
            </p>
          </div>
        </div>

        <button
          onClick={onGoToSettings}
          className="btn btn-primary btn-sm shrink-0 self-stretch md:self-auto"
        >
          <span>Ir a Credenciales</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
