import React from 'react';
import { 
  ShoppingBag, 
  ShieldCheck, 
  ArrowRight, 
  QrCode, 
  Boxes, 
  Truck, 
  Zap, 
  Lock, 
  KeyRound, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingGate({ onOpenLogin, onOpenRequestAccess }) {
  const { adminEmail } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden select-none">
      
      {/* Background Glows & Ambience */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Simple Brand Bar */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-yellow-400/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-xl tracking-tight">ML Pro</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 uppercase">
                SaaS Privado
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Plataforma Logística & Despacho</p>
          </div>
        </div>

        <button
          onClick={onOpenLogin}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold transition flex items-center space-x-2 backdrop-blur-md"
        >
          <Lock className="w-3.5 h-3.5 text-yellow-400" />
          <span>Acceso Usuarios</span>
        </button>
      </header>

      {/* Hero Content */}
      <main className="relative z-10 max-w-3xl w-full mx-auto px-6 py-12 text-center flex flex-col items-center">
        
        {/* Security Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-yellow-400/30 text-yellow-300 text-xs font-bold mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span>Sistema de Acceso Restringido & Aprobación por Invitación</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-2xl">
          Control de Despacho, Stock & Empaque QR en Tiempo Real
        </h1>

        <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
          Gestión inteligente de publicaciones, impresión masiva de etiquetas térmicas, terminal móvil de lectura de paquetes y sincronización oficial con Mercado Libre.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-md">
          <button
            onClick={onOpenLogin}
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-sm flex items-center justify-center space-x-2 shadow-xl shadow-yellow-400/20 transition transform active:scale-98"
          >
            <span>Iniciar Sesión</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenRequestAccess}
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-extrabold text-sm flex items-center justify-center space-x-2 transition"
          >
            <KeyRound className="w-4 h-4 text-yellow-400" />
            <span>Solicitar Acceso</span>
          </button>
        </div>

        {/* Feature Icons Grid */}
        <div className="mt-14 grid grid-cols-3 gap-4 w-full max-w-lg border-t border-slate-800/80 pt-8 text-slate-400">
          <div className="flex flex-col items-center space-y-1.5">
            <QrCode className="w-5 h-5 text-yellow-400" />
            <span className="text-[11px] font-bold">Lector QR Móvil</span>
          </div>
          <div className="flex flex-col items-center space-y-1.5">
            <Truck className="w-5 h-5 text-emerald-400" />
            <span className="text-[11px] font-bold">Flex & Colecta</span>
          </div>
          <div className="flex flex-col items-center space-y-1.5">
            <Boxes className="w-5 h-5 text-blue-400" />
            <span className="text-[11px] font-bold">Stock Automático</span>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-900">
        <p>
          Administración centralizada y autorización por <b className="text-slate-400">{adminEmail}</b>
        </p>
      </footer>

    </div>
  );
}
