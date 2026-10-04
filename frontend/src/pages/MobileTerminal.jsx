import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Camera, 
  PackageCheck, 
  CheckCircle2, 
  Truck, 
  AlertCircle, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Smartphone,
  Printer,
  Sparkles,
  MapPin,
  Search
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playErrorBeep } from '../utils/audio';
import { api } from '../services/api';

export default function MobileTerminal({ connection }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScanned, setLastScanned] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const html5QrCodeRef = useRef(null);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const res = await api.getShipments({ status: 'ready_to_ship' });
      setShipments(res.results || []);
    } catch (err) {
      console.error('Error al cargar envíos para móvil:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (html5QrCodeRef.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode("mobile-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.warn("Camera start failed:", err);
      setCameraError("No se pudo iniciar la cámara trasera del dispositivo.");
      setScanning(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn(e);
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  const handleCodeDetected = async (rawCode) => {
    if (!rawCode || !rawCode.trim()) return;
    const clean = rawCode.trim();

    const matched = shipments.find(s => 
      String(s.id).includes(clean) ||
      String(s.order_id).includes(clean) ||
      (s.tracking_number && s.tracking_number.toLowerCase() === clean.toLowerCase()) ||
      clean.includes(String(s.id)) ||
      clean.includes(String(s.order_id))
    );

    if (matched) {
      if (soundEnabled) playSuccessBeep();
      if (navigator.vibrate) navigator.vibrate([60, 40, 80]); // Haptic pulse
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });

      try {
        await api.updateShipmentPacking(matched.id, {
          packed: true,
          printed: true,
          qualityChecked: true,
        });

        setShipments(prev =>
          prev.map(s =>
            s.id === matched.id
              ? { ...s, packing: { ...(s.packing || {}), packed: true, printed: true, qualityChecked: true } }
              : s
          )
        );

        setLastScanned({
          success: true,
          shipment: matched,
          message: `¡Orden #${matched.order_id} verificada con éxito!`,
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      if (soundEnabled) playErrorBeep();
      if (navigator.vibrate) navigator.vibrate([150, 100, 150]);
      setLastScanned({
        success: false,
        message: `Código "${clean}" no encontrado en envíos pendientes de hoy.`,
      });
    }
  };

  const packedCount = shipments.filter(s => s.packing?.packed).length;
  const pendingCount = shipments.length - packedCount;

  const filteredShipments = shipments.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(s.order_id).includes(q) ||
      String(s.id).includes(q) ||
      s.buyer?.first_name?.toLowerCase().includes(q) ||
      s.buyer?.nickname?.toLowerCase().includes(q) ||
      s.items?.some(it => it.item?.title?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 pb-20 max-w-lg mx-auto animate-in fade-in">
      
      {/* Top Header Card */}
      <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-yellow-400 text-slate-950 rounded-2xl shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">Terminal Móvil de Empaque</h2>
              <p className="text-[11px] text-slate-300">Modo optimizado para celular y depósito</p>
            </div>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300"
            title={soundEnabled ? 'Silenciar beeps' : 'Activar sonido'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-yellow-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Packing Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-700/80">
          <div className="flex justify-between text-xs font-bold mb-1.5">
            <span className="text-yellow-400">{packedCount} de {shipments.length} empaquetados</span>
            <span className="text-slate-300">{pendingCount} pendientes</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300 rounded-full"
              style={{ width: `${shipments.length > 0 ? (packedCount / shipments.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live Camera Scanner Box */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
            <QrCode className="w-4 h-4 text-yellow-500" />
            <span>Escáner de Cámara Trasera</span>
          </span>

          <button
            onClick={scanning ? stopCamera : startCamera}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 ${
              scanning 
                ? 'bg-rose-500 text-white shadow-sm' 
                : 'bg-yellow-400 hover:bg-yellow-500 text-slate-950 shadow-sm'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{scanning ? 'Detener Cámara' : 'Abrir Cámara'}</span>
          </button>
        </div>

        {scanning && (
          <div className="relative rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center min-h-[220px] border-2 border-yellow-400">
            <div id="mobile-reader" className="w-full h-full max-w-xs"></div>
          </div>
        )}

        {cameraError && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-900 dark:text-amber-200 text-xs rounded-2xl flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Last scanned feedback banner */}
        {lastScanned && (
          <div 
            className={`p-3.5 rounded-2xl border text-xs animate-in zoom-in-95 ${
              lastScanned.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-950 dark:text-emerald-100 font-bold'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-950 dark:text-rose-100 font-bold'
            }`}
          >
            <div className="flex items-center space-x-2">
              {lastScanned.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              <span>{lastScanned.message}</span>
            </div>
            {lastScanned.shipment && (
              <p className="mt-1 pl-7 text-[11px] font-normal text-emerald-800 dark:text-emerald-300">
                Comprador: {lastScanned.shipment.buyer?.first_name ? `${lastScanned.shipment.buyer.first_name} ${lastScanned.shipment.buyer.last_name || ''}` : lastScanned.shipment.buyer?.nickname}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar paquete por orden, nombre o artículo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Shipments List (Mobile Cards) */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />
            <span>Cargando envíos...</span>
          </div>
        ) : filteredShipments.length > 0 ? (
          filteredShipments.map((s) => {
            const isPacked = s.packing?.packed;
            const itemsList = s.items || [];

            return (
              <div
                key={s.id}
                className={`p-4 rounded-3xl border shadow-xs transition ${
                  isPacked
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                        Orden #{s.order_id}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {s.logistic_type === 'self_service' ? 'FLEX' : s.logistic_type === 'cross_docking' ? 'COLECTA' : 'CORREO'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                      {itemsList.map(it => `${it.quantity}x ${it.item?.title || 'Producto'}`).join(', ')}
                    </p>

                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Comprador: <b>{s.buyer?.first_name ? `${s.buyer.first_name} ${s.buyer.last_name || ''}` : s.buyer?.nickname}</b>
                    </p>
                  </div>

                  {/* Packed check badge */}
                  {isPacked && (
                    <span className="p-1.5 rounded-full bg-emerald-500 text-white shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                </div>

                {/* Mobile action buttons */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <a
                    href={api.downloadLabelUrl(s.id, 'pdf')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center space-x-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Etiqueta</span>
                  </a>

                  <button
                    onClick={async () => {
                      const nextVal = !isPacked;
                      await api.updateShipmentPacking(s.id, { packed: nextVal, qualityChecked: nextVal });
                      setShipments(prev =>
                        prev.map(item =>
                          item.id === s.id
                            ? { ...item, packing: { ...(item.packing || {}), packed: nextVal, qualityChecked: nextVal } }
                            : item
                        )
                      );
                      if (nextVal) {
                        if (soundEnabled) playSuccessBeep();
                        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-1 ${
                      isPacked
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs'
                    }`}
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>{isPacked ? 'Desmarcar' : 'Marcar Listo'}</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
            <p>No hay paquetes pendientes de despacho.</p>
          </div>
        )}
      </div>

    </div>
  );
}
