import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Barcode, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Zap, 
  Package, 
  Sparkles, 
  RefreshCw,
  Volume2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playErrorBeep } from '../utils/audio';
import { api } from '../services/api';

export default function BarcodeScannerModal({ isOpen, onClose, shipments, onShipmentPacked }) {
  const [activeTab, setActiveTab] = useState('camera'); // camera, laser
  const [manualInput, setManualInput] = useState('');
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const html5QrCodeRef = useRef(null);
  const laserInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastScannedResult(null);
      return;
    }

    if (activeTab === 'camera') {
      startCamera();
    } else if (activeTab === 'laser' && laserInputRef.current) {
      laserInputRef.current.focus();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (html5QrCodeRef.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      const config = { 
        fps: 15, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: "environment" }, // Prefer back camera on mobile
        config,
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        (errorMessage) => {
          // ignore scan frame errors
        }
      );
      setIsScanningCamera(true);
    } catch (err) {
      console.warn("Camera init error:", err);
      setCameraError("No se pudo acceder a la cámara. Puedes usar el modo de pistola lectora o ingresar el código manualmente.");
      setIsScanningCamera(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Error stopping camera:", e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanningCamera(false);
  };

  const handleCodeDetected = async (rawCode) => {
    if (!rawCode || !rawCode.trim()) return;
    const cleanCode = rawCode.trim();

    // Look for matching shipment by ID, Order ID, Tracking Number, or embedded text
    const matched = shipments.find(s => 
      String(s.id).includes(cleanCode) ||
      String(s.order_id).includes(cleanCode) ||
      (s.tracking_number && s.tracking_number.toLowerCase() === cleanCode.toLowerCase()) ||
      cleanCode.includes(String(s.id)) ||
      cleanCode.includes(String(s.order_id))
    );

    if (matched) {
      playSuccessBeep();
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });

      try {
        await api.updateShipmentPacking(matched.id, {
          packed: true,
          printed: true,
          qualityChecked: true,
        });

        if (onShipmentPacked) {
          onShipmentPacked(matched.id);
        }

        setLastScannedResult({
          success: true,
          code: cleanCode,
          shipment: matched,
          message: `¡Orden #${matched.order_id} confirmada y empaquetada!`,
        });
      } catch (err) {
        setLastScannedResult({
          success: false,
          code: cleanCode,
          message: `Error al actualizar: ${err.message}`,
        });
      }
    } else {
      playErrorBeep();
      setLastScannedResult({
        success: false,
        code: cleanCode,
        message: `No se encontró ningún pedido pendiente con el código: "${cleanCode}".`,
      });
    }

    setManualInput('');
  };

  const handleLaserSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleCodeDetected(manualInput.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Escáner de Empaque & Verificación
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lee el QR o código de barras de la etiqueta de Mercado Envíos
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-4 sm:px-5 pt-3 flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('camera')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-1.5 transition border-b-2 ${
              activeTab === 'camera'
                ? 'border-yellow-400 text-slate-950 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Cámara en Vivo (Móvil / Web)</span>
          </button>

          <button
            onClick={() => setActiveTab('laser')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center space-x-1.5 transition border-b-2 ${
              activeTab === 'laser'
                ? 'border-yellow-400 text-slate-950 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Pistola Lectora / Manual</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Camera View */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-yellow-400/60 bg-slate-950 flex flex-col items-center justify-center min-h-[260px]">
                <div id="reader" className="w-full h-full max-w-xs"></div>
                {!isScanningCamera && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin text-yellow-400 mb-2" />
                    <span>Iniciando cámara...</span>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-xl flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}

              <p className="text-center text-[11px] text-slate-400">
                Apunta la cámara al código QR o código de barras de la etiqueta impresa.
              </p>
            </div>
          )}

          {/* Laser Gun / Manual View */}
          {activeTab === 'laser' && (
            <div className="space-y-4">
              <form onSubmit={handleLaserSubmit} className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Escanea con la pistola lectora o escribe el código:
                </label>
                <div className="relative">
                  <input
                    ref={laserInputRef}
                    type="text"
                    placeholder="Escanea aquí con la pistola..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-yellow-400 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl hover:opacity-90"
                  >
                    Verificar
                  </button>
                </div>
              </form>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Modo Pistola de Código de Barras:</span>
                </p>
                <p className="text-[11px]">
                  Cualquier lector láser USB o Bluetooth funcionará automáticamente al disparar a la etiqueta.
                </p>
              </div>
            </div>
          )}

          {/* Last Scanned Live Result Feedback Card */}
          {lastScannedResult && (
            <div 
              className={`p-4 rounded-2xl border transition-all animate-in zoom-in-95 ${
                lastScannedResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start space-x-3">
                {lastScannedResult.success ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}

                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-sm">
                    {lastScannedResult.message}
                  </h4>

                  {lastScannedResult.shipment && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/80 text-xs space-y-1">
                      <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                        Comprador: <b>{lastScannedResult.shipment.buyer?.first_name ? `${lastScannedResult.shipment.buyer.first_name} ${lastScannedResult.shipment.buyer.last_name || ''}` : lastScannedResult.shipment.buyer?.nickname}</b>
                      </p>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 truncate">
                        Artículos: {lastScannedResult.shipment.items?.map(it => `${it.quantity}x ${it.item?.title || 'Producto'}`).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Volume2 className="w-4 h-4 text-slate-500" />
            <span className="text-[11px]">Sonido de confirmación activo</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold"
          >
            Listo / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
