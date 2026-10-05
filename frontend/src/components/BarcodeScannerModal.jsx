import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Barcode, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  X, 
  Zap, 
  RefreshCw,
  Volume2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playWarningBeep, playErrorBeep, speakSpanish } from '../utils/audio';
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

    try {
      const res = await api.scanShipment(cleanCode, true);

      if (res.found && res.shipment) {
        if (res.alreadyPacked) {
          playWarningBeep();
          speakSpanish('Atención, paquete ya leído previamente');

          const packedTimeStr = res.firstScannedAt 
            ? new Date(res.firstScannedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'anteriormente';

          setLastScannedResult({
            success: true,
            isDuplicate: true,
            code: cleanCode,
            shipment: res.shipment,
            scanCount: res.scanCount || 2,
            message: `⚠️ ¡ATENCIÓN! Este paquete ya fue leído y empaquetado a las ${packedTimeStr} (Lectura #${res.scanCount || 2}).`,
          });
        } else {
          playSuccessBeep();
          speakSpanish('Listo');
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });

          if (onShipmentPacked) {
            onShipmentPacked(res.shipment.id);
          }

          setLastScannedResult({
            success: true,
            isDuplicate: false,
            code: cleanCode,
            shipment: res.shipment,
            scanCount: 1,
            message: `¡Orden #${res.shipment.order_id} confirmada y marcada como empaquetada!`,
          });
        }
      } else {
        playErrorBeep();
        speakSpanish('Código no encontrado');
        setLastScannedResult({
          success: false,
          code: cleanCode,
          message: `No se encontró ningún pedido pendiente con el código: "${cleanCode}".`,
        });
      }
    } catch (err) {
      playErrorBeep();
      setLastScannedResult({
        success: false,
        code: cleanCode,
        message: `Error al procesar escaneo: ${err.message}`,
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
    <div className="overlay p-3 sm:p-4">
      <div 
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="modal-head items-center">
          <div className="flex items-center gap-3">
            <div className="kpi-icon kpi-icon-brand">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="modal-title">
                Escáner de Empaque & Verificación
              </h3>
              <p className="modal-sub">
                Lee el QR o código de barras de la etiqueta de Mercado Envíos
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            aria-label="Cerrar el escáner"
            title="Cerrar"
            className="modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selector de modo */}
        <div className="flex items-center gap-1 border-b border-line px-4 pt-3 sm:px-5">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 pb-2.5 text-xs font-bold transition ${
              activeTab === 'camera'
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>Cámara en Vivo (Móvil / Web)</span>
          </button>

          <button
            onClick={() => setActiveTab('laser')}
            className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 pb-2.5 text-xs font-bold transition ${
              activeTab === 'laser'
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Barcode className="h-4 w-4" />
            <span>Pistola Lectora / Manual</span>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="modal-body">
          
          {/* Vista de cámara */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-line bg-slate-950">
                <div id="reader" className="h-full w-full max-w-xs"></div>

                {/* Marco de escaneo con esquinas de marca */}
                <div className="pointer-events-none absolute inset-6 rounded-2xl" aria-hidden="true">
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-brand" />
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-brand" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-brand" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-brand" />
                </div>

                {!isScanningCamera && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-ink-subtle">
                    <RefreshCw className="h-6 w-6 animate-spin text-brand" />
                    <span>Iniciando cámara...</span>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs text-warning">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              <p className="text-center text-[11px] text-ink-subtle">
                Apunta la cámara al código QR o código de barras de la etiqueta impresa.
              </p>
            </div>
          )}

          {/* Vista pistola lectora / manual */}
          {activeTab === 'laser' && (
            <div className="space-y-4">
              <form onSubmit={handleLaserSubmit} className="space-y-2">
                <label className="label">
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
                    className="input pr-28 font-bold"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    Verificar
                  </button>
                </div>
              </form>

              <div className="space-y-1 rounded-2xl border border-line bg-muted p-3.5 text-xs text-ink-muted">
                <p className="flex items-center gap-1.5 font-bold text-ink">
                  <Zap className="h-3.5 w-3.5 text-brand-600" />
                  <span>Modo Pistola de Código de Barras:</span>
                </p>
                <p className="text-[11px]">
                  Cualquier lector láser USB o Bluetooth funcionará automáticamente al disparar a la etiqueta.
                </p>
              </div>
            </div>
          )}

          {/* Resultado del último escaneo */}
          {lastScannedResult && (
            <div 
              className={`card animate-pop ${
                lastScannedResult.isDuplicate
                  ? 'border-amber-400/50 bg-amber-500/10'
                  : lastScannedResult.success
                  ? 'border-success/30 bg-card'
                  : 'border-danger/30 bg-danger-soft'
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                {lastScannedResult.isDuplicate ? (
                  <span className="kpi-icon bg-amber-500 text-slate-950 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                ) : lastScannedResult.success ? (
                  <span className="kpi-icon kpi-icon-success shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                ) : (
                  <span className="kpi-icon kpi-icon-danger shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <span className={`badge ${
                    lastScannedResult.isDuplicate 
                      ? 'bg-amber-400 text-slate-950 font-black' 
                      : lastScannedResult.success 
                      ? 'badge-success' 
                      : 'badge-danger'
                  }`}>
                    {lastScannedResult.isDuplicate ? '⚠️ Ya escaneado previamente' : lastScannedResult.success ? '✅ Paquete verificado' : 'Sin coincidencias'}
                  </span>

                  <h4 className={`mt-2 font-display text-sm font-extrabold ${lastScannedResult.isDuplicate ? 'text-amber-950 dark:text-amber-200' : 'text-ink'}`}>
                    {lastScannedResult.message}
                  </h4>

                  {lastScannedResult.shipment && (
                    <div className="mt-3 text-xs">
                      <div className="flex items-start justify-between gap-3 border-b border-line py-2.5">
                        <span className="text-ink-subtle">Comprador</span>
                        <span className="text-right font-bold text-ink">
                          {lastScannedResult.shipment.buyer?.first_name ? `${lastScannedResult.shipment.buyer.first_name} ${lastScannedResult.shipment.buyer.last_name || ''}` : lastScannedResult.shipment.buyer?.nickname}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-line py-2.5">
                        <span className="shrink-0 text-ink-subtle">Artículos</span>
                        <span className="min-w-0 truncate text-right font-semibold text-ink-muted">
                          {lastScannedResult.shipment.items?.map(it => `${it.quantity}x ${it.item?.title || 'Producto'}`).join(', ')}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 py-2.5">
                        <span className="text-ink-subtle">Orden</span>
                        <span className="tabular font-bold text-ink">
                          #{lastScannedResult.shipment.order_id}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Pie */}
        <div className="modal-foot justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <Volume2 className="h-4 w-4 text-ink-muted" />
              <span>Sonido de confirmación activo</span>
            </span>
            {lastScannedResult && (
              <button
                onClick={() => setLastScannedResult(null)}
                className="btn btn-outline btn-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Escanear otro
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-primary"
          >
            Listo / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
