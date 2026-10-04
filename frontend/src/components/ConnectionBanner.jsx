import React from 'react';
import { Key, ArrowRight, ShieldAlert } from 'lucide-react';

export default function ConnectionBanner({ onGoToSettings }) {
  return (
    <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 text-slate-900 rounded-2xl p-5 mb-6 shadow-sm border border-yellow-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-start space-x-3.5">
        <div className="p-2.5 bg-white/80 rounded-xl text-yellow-900 shadow-sm mt-0.5 md:mt-0">
          <Key className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-base md:text-lg text-slate-950 flex items-center space-x-2">
            <span>Conecta tu cuenta de Mercado Libre</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
              Paso Requerido
            </span>
          </h3>
          <p className="text-xs md:text-sm text-slate-800 mt-0.5 max-w-2xl leading-relaxed">
            Para sincronizar tus publicaciones en vivo, editar stock, gestionar ventas e imprimir etiquetas oficiales de Mercado Envíos, ingresa tus credenciales de aplicación o tu Access Token en la sección de Ajustes.
          </p>
        </div>
      </div>

      <button
        onClick={onGoToSettings}
        className="self-stretch md:self-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs md:text-sm rounded-xl transition shadow-md flex items-center justify-center space-x-2 shrink-0"
      >
        <span>Ir a Ajustes y Conectar</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
