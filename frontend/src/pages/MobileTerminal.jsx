import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Camera, 
  PackageCheck, 
  CheckCircle2, 
  Truck, 
  AlertCircle, 
  AlertTriangle,
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Smartphone,
  Printer,
  Sparkles,
  MapPin,
  Search,
  History,
  Layers,
  Check,
  RotateCcw,
  Database,
  ExternalLink,
  Undo2,
  Mic,
  MicOff,
  Clock,
  Boxes
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playWarningBeep, playErrorBeep, speakSpanish } from '../utils/audio';
import { api } from '../services/api';

export default function MobileTerminal({ connection }) {
  const [activeTab, setActiveTab] = useState('scanner'); // 'scanner', 'shipments', 'history'
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoPackOnScan, setAutoPackOnScan] = useState(true);
  const [lastScanned, setLastScanned] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scanLogs, setScanLogs] = useState([]);
  const [dbStatus, setDbStatus] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'packed'
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  
  const html5QrCodeRef = useRef(null);
  const lastScannedCodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shipmentsRes, logsRes, dbRes] = await Promise.all([
        api.getShipments({ limit: 50 }).catch(() => ({ results: [] })),
        api.getScanLogs().catch(() => ({ logs: [] })),
        api.getDatabaseStatus().catch(() => null),
      ]);
      setShipments(shipmentsRes.results || []);
      setScanLogs(logsRes.logs || []);
      setDbStatus(dbRes);
    } catch (err) {
      console.error('Error al cargar datos móviles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

      const formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ];

      const html5QrCode = new Html5Qrcode("mobile-camera-viewfinder", { formatsToSupport: formats });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(minEdge * 0.85),
            height: Math.floor(minEdge * 0.65),
          };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          processScannedCode(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.warn("Camera start failed:", err);
      setCameraError("No se pudo iniciar la cámara trasera. Asegurate de dar permisos de cámara en tu navegador.");
      setScanning(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error closing camera:', e);
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  const processScannedCode = async (rawCode) => {
    if (!rawCode) return;
    const clean = rawCode.trim();

    // Prevent duplicate scan spamming of the exact same code within 3 seconds
    const now = Date.now();
    if (clean === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 3000) {
      return;
    }
    lastScannedCodeRef.current = clean;
    lastScannedTimeRef.current = now;

    if (isProcessingScan) return;
    setIsProcessingScan(true);

    try {
      const res = await api.scanShipment(clean, autoPackOnScan);

      if (res.found && res.shipment) {
        const firstItem = (res.shipment.items && res.shipment.items[0]?.item) || {};
        const firstItemTitle = firstItem.title || 'Producto';

        // CASE 1: PACKAGE WAS ALREADY PACKED PREVIOUSLY!
        if (res.alreadyPacked) {
          if (soundEnabled) playWarningBeep();
          if (voiceEnabled) speakSpanish(`Atención, paquete ya leído previamente`);
          if (navigator.vibrate) navigator.vibrate([180, 100, 180]);

          const packedTimeStr = res.firstScannedAt 
            ? new Date(res.firstScannedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'anteriormente';

          setLastScanned({
            status: 'ALREADY_PACKED',
            shipment: res.shipment,
            scanCount: res.scanCount || 2,
            firstScannedAtStr: packedTimeStr,
            message: `¡ATENCIÓN! Este paquete ya había sido empaquetado a las ${packedTimeStr} (Lectura #${res.scanCount || 2}).`,
            timestamp: new Date().toLocaleTimeString('es-AR'),
          });
        } 
        // CASE 2: BRAND NEW PACKAGE PACKED!
        else {
          if (soundEnabled) playSuccessBeep();
          if (voiceEnabled) speakSpanish(`Paquete verificado con éxito`);
          if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
          confetti({ particleCount: 50, spread: 75, origin: { y: 0.65 } });

          // Update local state
          setShipments(prev =>
            prev.map(s => (s.id === res.shipment.id ? res.shipment : s))
          );

          setLastScanned({
            status: 'NEWLY_PACKED',
            shipment: res.shipment,
            scanCount: 1,
            message: `¡Paquete verificado y empaquetado con éxito!`,
            timestamp: new Date().toLocaleTimeString('es-AR'),
          });
        }
      } 
      // CASE 3: CODE NOT FOUND
      else {
        if (soundEnabled) playErrorBeep();
        if (voiceEnabled) speakSpanish(`Código no encontrado`);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

        setLastScanned({
          status: 'NOT_FOUND',
          code: res.scannedCode || clean,
          message: `Código "${clean}" no corresponde a ningún envío activo pendiente.`,
          timestamp: new Date().toLocaleTimeString('es-AR'),
        });
      }

      // Refresh scan audit logs
      api.getScanLogs().then(r => setScanLogs(r.logs || [])).catch(() => {});
    } catch (err) {
      if (soundEnabled) playErrorBeep();
      setLastScanned({
        status: 'ERROR',
        message: err.message || 'Error al procesar el escaneo.',
        timestamp: new Date().toLocaleTimeString('es-AR'),
      });
    } finally {
      setTimeout(() => {
        setIsProcessingScan(false);
      }, 1000);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processScannedCode(manualCode);
    setManualCode('');
  };

  const handleUnpackShipment = async (shipmentId) => {
    try {
      await api.updateShipmentPacking(shipmentId, {
        packed: false,
        qualityChecked: false,
      });

      setShipments(prev =>
        prev.map(s =>
          s.id === shipmentId
            ? {
                ...s,
                packing: {
                  ...(s.packing || {}),
                  packed: false,
                  qualityChecked: false,
                },
              }
            : s
        )
      );

      if (lastScanned && lastScanned.shipment?.id === shipmentId) {
        setLastScanned(prev => ({
          ...prev,
          status: 'UNPACKED',
          message: `El paquete #${shipmentId} ha sido desmarcado y devuelto a pendientes.`,
        }));
      }

      if (voiceEnabled) speakSpanish(`Paquete devuelto a pendientes`);
    } catch (err) {
      alert(`Error al desmarcar: ${err.message}`);
    }
  };

  const handleTogglePacking = async (shipmentId, currentPackedState) => {
    const nextState = !currentPackedState;
    try {
      await api.updateShipmentPacking(shipmentId, {
        packed: nextState,
        qualityChecked: nextState,
      });

      setShipments(prev =>
        prev.map(s =>
          s.id === shipmentId
            ? {
                ...s,
                packing: {
                  ...(s.packing || {}),
                  packed: nextState,
                  qualityChecked: nextState,
                },
              }
            : s
        )
      );

      if (nextState) {
        if (soundEnabled) playSuccessBeep();
        if (voiceEnabled) speakSpanish(`Listo`);
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      }
    } catch (err) {
      alert(`Error al actualizar empaque: ${err.message}`);
    }
  };

  // Metrics
  const packedCount = shipments.filter(s => s.packing?.packed).length;
  const pendingCount = shipments.length - packedCount;
  const progressPercent = shipments.length > 0 ? Math.round((packedCount / shipments.length) * 100) : 0;

  // Filtered list
  const filteredShipments = shipments.filter(s => {
    const isPacked = Boolean(s.packing?.packed);
    if (filterStatus === 'pending' && isPacked) return false;
    if (filterStatus === 'packed' && !isPacked) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(s.order_id).includes(q) ||
      String(s.id).includes(q) ||
      s.buyer?.first_name?.toLowerCase().includes(q) ||
      s.buyer?.nickname?.toLowerCase().includes(q) ||
      s.items?.some(it => 
        it.item?.title?.toLowerCase().includes(q) || 
        it.item?.seller_sku?.toLowerCase().includes(q)
      )
    );
  });

  return (
    <div className="page pb-24">
      <div className="mx-auto w-full max-w-lg select-none space-y-4">

        {/* Encabezado de la terminal */}
        <div className="page-head">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink shadow-glow">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="page-title">Terminal Móvil de Empaque</h1>
              <p className="page-sub flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success animate-pulse-ring" aria-hidden="true" />
                <span>Lector en depósito @GRANA3DOK</span>
              </p>
            </div>
          </div>

          {/* Controles de sonido y voz */}
          <div className="toolbar">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`btn btn-icon ${voiceEnabled ? 'btn-soft' : 'btn-outline'}`}
              title={voiceEnabled ? 'Voz en español activada' : 'Voz silenciada'}
            >
              {voiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`btn btn-icon ${soundEnabled ? 'btn-soft' : 'btn-outline'}`}
              title={soundEnabled ? 'Silenciar beeps' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Progreso de empaque */}
        <div className="card card-pad space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Paquetes empaquetados</p>
              <p className="mt-1.5 font-display text-3xl font-extrabold leading-none text-ink">
                <span className="tabular">{packedCount}</span>
                <span className="ml-1 text-sm font-bold text-ink-muted">
                  / <span className="tabular">{shipments.length}</span> paquetes
                </span>
              </p>
            </div>
            <span className="badge badge-brand">
              <span className="tabular">{progressPercent}%</span> Completado
            </span>
          </div>

          <div className="progress">
            <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Selector de pestañas */}
        <div className="segmented grid w-full grid-cols-3 gap-1">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`segmented-btn flex items-center justify-center gap-1.5 py-2.5 text-xs ${activeTab === 'scanner' ? 'segmented-btn-active' : ''}`}
          >
            <QrCode className="h-4 w-4" />
            <span>Escanear</span>
          </button>

          <button
            onClick={() => setActiveTab('shipments')}
            className={`segmented-btn flex items-center justify-center gap-1.5 py-2.5 text-xs ${activeTab === 'shipments' ? 'segmented-btn-active' : ''}`}
          >
            <Layers className="h-4 w-4" />
            <span>Envíos <span className="tabular">({pendingCount})</span></span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`segmented-btn flex items-center justify-center gap-1.5 py-2.5 text-xs ${activeTab === 'history' ? 'segmented-btn-active' : ''}`}
          >
            <History className="h-4 w-4" />
            <span>Historial</span>
          </button>
        </div>

        {/* TAB 1: SCANNER */}
        {activeTab === 'scanner' && (
          <div className="space-y-4">
            {/* Lector de cámara */}
            <div className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-ink">
                  <Camera className="h-4 w-4 text-ink-subtle" />
                  <span>Cámara de Celular</span>
                </span>

                <span className={`badge ${scanning ? 'badge-success' : 'badge-neutral'}`}>
                  <span className={`h-2 w-2 rounded-full ${scanning ? 'bg-success animate-pulse-ring' : 'bg-ink-subtle'}`} aria-hidden="true" />
                  {scanning ? 'Leyendo' : 'En espera'}
                </span>
              </div>

              {/* Visor de cámara */}
              <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${scanning ? 'min-h-[260px] border-line bg-ink/90' : 'flex min-h-[140px] items-center justify-center border-dashed border-line-strong bg-muted'}`}>
                <div id="mobile-camera-viewfinder" className="mx-auto w-full max-w-sm"></div>

                {!scanning && (
                  <div className="p-4 text-center">
                    <QrCode className="mx-auto mb-2 h-10 w-10 text-ink-subtle" />
                    <p className="text-sm font-bold text-ink">Cámara en espera</p>
                    <p className="text-[11px] text-ink-subtle">Tocá "Abrir Cámara" para enfocar etiquetas</p>
                  </div>
                )}

                {scanning && (
                  <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-center justify-between">
                    <span className="badge badge-solid gap-1.5 backdrop-blur">
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse-ring" aria-hidden="true" />
                      Lector QR / Barras Activo
                    </span>
                  </div>
                )}
              </div>

              {/* Acción principal: encender o apagar el lector */}
              <button
                onClick={scanning ? stopCamera : startCamera}
                className={`btn btn-lg btn-block py-5 text-base ${scanning ? 'btn-danger-soft' : 'btn-primary'}`}
              >
                <Camera className="h-6 w-6" />
                <span>{scanning ? 'Apagar Cámara' : 'Abrir Cámara'}</span>
              </button>

              {/* Empaquetado automático al leer */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={autoPackOnScan}
                    onChange={(e) => setAutoPackOnScan(e.target.checked)}
                    className="check h-5 w-5"
                  />
                  <span className="font-bold text-ink-muted">
                    Marcar "Empaquetado" automáticamente al leer
                  </span>
                </label>
              </div>

              {cameraError && (
                <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-3.5 text-xs text-warning">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span className="font-semibold leading-relaxed">{cameraError}</span>
                </div>
              )}
            </div>

            {/* Entrada manual (pistola láser / teclado) */}
            <form onSubmit={handleManualSubmit} className="card space-y-3 border-dashed border-line-strong p-4">
              <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-ink-subtle">
                <QrCode className="h-4 w-4" />
                <span>Ingreso manual del código</span>
              </p>

              <input
                type="text"
                placeholder="O ingresá el código de envío / SKU..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="input py-4 text-center font-mono text-lg tracking-widest"
              />

              <button
                type="submit"
                disabled={!manualCode.trim() || isProcessingScan}
                className="btn btn-accent btn-lg btn-block py-4"
              >
                <Check className="h-5 w-5" />
                <span>Verificar</span>
              </button>
            </form>

          {/* Tarjeta de resultado del escaneo */}
          {lastScanned && (
            <div className="card card-accent animate-pop overflow-hidden">
              {/* Cabecera de estado */}
              <div className={`flex items-start gap-3 border-b p-5 ${
                lastScanned.status === 'NEWLY_PACKED'
                  ? 'border-success/30 bg-success-soft text-success'
                  : lastScanned.status === 'ALREADY_PACKED'
                  ? 'border-warning/30 bg-warning-soft text-warning'
                  : 'border-danger/30 bg-danger-soft text-danger'
              }`}>
                {lastScanned.status === 'NEWLY_PACKED' && (
                  <CheckCircle2 className="h-8 w-8 shrink-0" />
                )}
                {lastScanned.status === 'ALREADY_PACKED' && (
                  <AlertTriangle className="h-8 w-8 shrink-0 animate-pulse" />
                )}
                {lastScanned.status === 'NOT_FOUND' && (
                  <AlertCircle className="h-8 w-8 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-extrabold leading-tight text-current">
                    {lastScanned.status === 'NEWLY_PACKED' && '¡Nuevo Paquete Empaquetado!'}
                    {lastScanned.status === 'ALREADY_PACKED' && '¡ATENCIÓN: PAQUETE YA LEÍDO!'}
                    {lastScanned.status === 'NOT_FOUND' && 'Código No Encontrado'}
                    {lastScanned.status === 'UNPACKED' && 'Paquete Desmarcado'}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold opacity-80">
                    <Clock className="inline h-3 w-3" />
                    <span className="tabular">{lastScanned.timestamp}</span>
                    {lastScanned.scanCount > 1 && (
                      <span className="font-extrabold">
                        • Lectura #<span className="tabular">{lastScanned.scanCount}</span>
                      </span>
                    )}
                  </p>
                </div>

                <span className="badge badge-solid shrink-0">
                  {lastScanned.status === 'NEWLY_PACKED' && 'LISTO OK'}
                  {lastScanned.status === 'ALREADY_PACKED' && 'DUPLICADO'}
                  {lastScanned.status === 'NOT_FOUND' && 'NO ENCONTRADO'}
                  {lastScanned.status === 'UNPACKED' && 'PENDIENTE'}
                </span>
              </div>

              <div className="space-y-4 p-5">
                {/* Mensaje del resultado */}
                <p className="text-sm font-extrabold leading-snug text-ink">
                  {lastScanned.message}
                </p>

                {/* Paquete activo */}
                {lastScanned.shipment && (
                  <div className="overflow-hidden rounded-2xl border border-line bg-muted">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Orden</span>
                        <span className="font-display text-lg font-extrabold tabular text-ink">#{lastScanned.shipment.order_id}</span>
                      </div>
                      <span className="badge badge-neutral">
                        {lastScanned.shipment.logistic_type === 'self_service' ? 'FLEX' : lastScanned.shipment.logistic_type === 'cross_docking' ? 'COLECTA' : 'CORREO'}
                      </span>
                    </div>

                    <div className="px-4">
                      <div className="flex items-center justify-between border-b border-line py-2.5">
                        <span className="text-xs font-bold text-ink-subtle">Envío</span>
                        <span className="text-xs font-extrabold tabular text-ink">#{lastScanned.shipment.id}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-line py-2.5">
                        <span className="text-xs font-bold text-ink-subtle">Comprador</span>
                        <span className="text-right text-xs font-extrabold text-ink">
                          {lastScanned.shipment.buyer?.first_name ? `${lastScanned.shipment.buyer.first_name} ${lastScanned.shipment.buyer.last_name || ''}` : lastScanned.shipment.buyer?.nickname}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-bold text-ink-subtle">Destino</span>
                        <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink">
                          <MapPin className="h-3.5 w-3.5 text-ink-subtle" />
                          {lastScanned.shipment.receiver_address?.city?.name || 'Mercado Envíos'}
                        </span>
                      </div>
                    </div>

                    {/* Artículos con la cantidad bien visible */}
                    <div className="space-y-2 border-t border-line p-3">
                      {(lastScanned.shipment.items || []).map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-bold text-ink">
                              {it.item?.title || 'Producto'}
                            </p>
                            {it.item?.seller_sku && (
                              <p className="font-mono text-[10px] text-ink-subtle">
                                SKU: <b className="text-ink-muted">{it.item.seller_sku}</b>
                              </p>
                            )}
                          </div>

                          {/* Cantidad gigante para evitar errores en el depósito */}
                          <div className="shrink-0 rounded-xl bg-brand px-3 py-1.5 text-center text-base font-extrabold tabular text-brand-ink shadow-xs">
                            x{it.quantity}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Acciones del paquete */}
                    <div className="flex flex-col gap-2 border-t border-line p-3 sm:flex-row">
                      <a
                        href={api.downloadLabelUrl(lastScanned.shipment.id, 'pdf')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-block flex-1"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Imprimir Etiqueta PDF</span>
                      </a>

                      {/* Devolver el paquete a pendientes */}
                      <button
                        onClick={() => handleUnpackShipment(lastScanned.shipment.id)}
                        className="btn btn-danger-soft btn-block sm:w-auto"
                        title="Desmarcar este empaque y devolverlo a pendientes"
                      >
                        <Undo2 className="h-4 w-4" />
                        <span>Desmarcar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

        {/* TAB 2: SHIPMENTS LIST */}
        {activeTab === 'shipments' && (
          <div className="space-y-3">
            {/* Filtros de estado */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterStatus('all')}
                className={`btn btn-sm shrink-0 tabular ${filterStatus === 'all' ? 'btn-dark' : 'btn-outline'}`}
              >
                Todos ({shipments.length})
              </button>

              <button
                onClick={() => setFilterStatus('pending')}
                className={`btn btn-sm shrink-0 tabular ${filterStatus === 'pending' ? 'border border-warning/30 bg-warning-soft text-warning' : 'btn-outline'}`}
              >
                Pendientes ({pendingCount})
              </button>

              <button
                onClick={() => setFilterStatus('packed')}
                className={`btn btn-sm shrink-0 tabular ${filterStatus === 'packed' ? 'border border-success/30 bg-success-soft text-success' : 'btn-outline'}`}
              >
                Empaquetados ({packedCount})
              </button>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Buscar por orden, cliente o producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-search py-3"
              />
            </div>

            {/* Cola de paquetes */}
            <div className="space-y-2.5">
              {loading ? (
                <div className="card card-pad space-y-3">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-12 w-full" />
                  <div className="skeleton h-4 w-24" />
                  <p className="text-center text-xs font-bold text-ink-subtle">Cargando despachos...</p>
                </div>
              ) : filteredShipments.length > 0 ? (
                filteredShipments.map((s) => {
                  const isPacked = Boolean(s.packing?.packed);
                  const itemsList = s.items || [];

                  return (
                    <div
                      key={s.id}
                      className="card card-hover p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-extrabold tabular text-ink">
                              Orden #{s.order_id}
                            </span>
                            <span className="badge badge-neutral">
                              {s.logistic_type === 'self_service' ? 'FLEX' : s.logistic_type === 'cross_docking' ? 'COLECTA' : 'CORREO'}
                            </span>
                            <span className={`badge ${isPacked ? 'badge-success' : 'badge-warning'}`}>
                              {isPacked ? 'Empaquetado' : 'Pendiente'}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1">
                            {itemsList.map((it, idx) => (
                              <p key={idx} className="line-clamp-1 text-xs font-bold text-ink-muted">
                                <span className="font-extrabold tabular text-ink">[{it.quantity}x]</span> {it.item?.title || 'Artículo'}
                              </p>
                            ))}
                          </div>

                          <p className="mt-1.5 text-[11px] text-ink-subtle">
                            Comprador: <b className="text-ink-muted">{s.buyer?.first_name ? `${s.buyer.first_name} ${s.buyer.last_name || ''}` : s.buyer?.nickname}</b>
                          </p>
                        </div>

                        {isPacked && (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success-soft text-success">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </div>

                      {/* Acciones del paquete */}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                        <a
                          href={api.downloadLabelUrl(s.id, 'pdf')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Etiqueta</span>
                        </a>

                        <button
                          onClick={() => handleTogglePacking(s.id, isPacked)}
                          className={`btn btn-lg ${isPacked ? 'btn-danger-soft' : 'btn-success'}`}
                        >
                          <PackageCheck className="h-4 w-4" />
                          <span>{isPacked ? 'Desmarcar' : 'Listo para Despacho'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="card">
                  <div className="empty">
                    <div className="empty-icon">
                      <Boxes className="h-6 w-6" />
                    </div>
                    <p className="empty-title">No se encontraron paquetes con ese filtro</p>
                    <p className="empty-text">Cambiá el estado del filtro o limpiá la búsqueda para ver todos los envíos disponibles.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* TAB 3: SCAN HISTORY (NEON DB AUDIT) */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
              <History className="w-4 h-4 text-emerald-500" />
              <span>Auditoría de Escaneos</span>
            </span>
            <button
              onClick={loadData}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Actualizar registro"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {scanLogs.length > 0 ? (
              scanLogs.map((log, idx) => (
                <div
                  key={log.id || idx}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-1.5 rounded-xl ${
                      log.action === 'FIRST_PACK_VERIFIED' || log.action === 'PACK_VERIFIED'
                        ? 'bg-emerald-500 text-white'
                        : log.action === 'DUPLICATE_SCAN'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {log.barcode}
                        </span>
                        {(log.action === 'FIRST_PACK_VERIFIED' || log.action === 'PACK_VERIFIED') && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            NUEVO EMPAQUE
                          </span>
                        )}
                        {log.action === 'DUPLICATE_SCAN' && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                            YA LEÍDO (#{log.details?.scanCount || 2})
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {log.details?.title || log.details?.buyer || log.action}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p>Aún no hay escaneos registrados hoy.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Database connection footer badge */}
      <div className="pt-2 text-center">
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[10px] font-bold text-slate-600 dark:text-slate-400">
          <Database className="w-3 h-3 text-emerald-500" />
          <span>Base de datos: {dbStatus?.provider || 'Neon PostgreSQL'}</span>
        </span>
      </div>

    </div>
  </div>
  );
}
