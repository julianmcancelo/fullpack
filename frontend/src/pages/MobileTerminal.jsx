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
    <div className="space-y-4 pb-24 max-w-lg mx-auto animate-in fade-in select-none">
      
      {/* Top Mobile Warehouse Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 rounded-3xl shadow-xl border border-slate-700/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-yellow-400 text-slate-950 rounded-2xl shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="font-extrabold text-base text-white tracking-tight">Terminal Móvil de Empaque</h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">Lector en depósito @GRANA3DOK</p>
            </div>
          </div>

          {/* Sound & Voice Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2.5 rounded-2xl border transition ${
                voiceEnabled 
                  ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300' 
                  : 'bg-slate-800/80 border-slate-700 text-slate-500'
              }`}
              title={voiceEnabled ? 'Voz en español activada' : 'Voz silenciada'}
            >
              {voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title={soundEnabled ? 'Silenciar beeps' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-yellow-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Packing Progress */}
        <div className="mt-4 pt-3.5 border-t border-slate-700/80">
          <div className="flex justify-between items-end mb-1.5">
            <div>
              <span className="text-2xl font-black text-white">{packedCount}</span>
              <span className="text-xs text-slate-300 font-bold ml-1">/ {shipments.length} paquetes</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                {progressPercent}% Completado
              </span>
            </div>
          </div>

          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 transition-all duration-500 rounded-full shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl font-bold text-xs">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`py-2 rounded-xl transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'scanner'
              ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 text-yellow-500" />
          <span>Escanear</span>
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          className={`py-2 rounded-xl transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'shipments'
              ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span>Envíos ({pendingCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 rounded-xl transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'history'
              ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5 text-emerald-500" />
          <span>Historial</span>
        </button>
      </div>

      {/* TAB 1: SCANNER */}
      {activeTab === 'scanner' && (
        <div className="space-y-3.5">
          {/* Camera Viewfinder Box */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-yellow-500" />
                <span>Cámara de Celular</span>
              </span>

              <button
                onClick={scanning ? stopCamera : startCamera}
                className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition flex items-center space-x-1.5 ${
                  scanning 
                    ? 'bg-rose-500 text-white shadow-sm' 
                    : 'bg-yellow-400 hover:bg-yellow-500 text-slate-950 shadow-md font-bold'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>{scanning ? 'Apagar Cámara' : 'Abrir Cámara'}</span>
              </button>
            </div>

            {/* Viewfinder Canvas */}
            <div className={`relative rounded-2xl overflow-hidden bg-slate-950 transition-all ${scanning ? 'min-h-[260px] border-2 border-yellow-400 shadow-inner' : 'min-h-[140px] flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-800'}`}>
              <div id="mobile-camera-viewfinder" className="w-full max-w-sm mx-auto"></div>
              
              {!scanning && (
                <div className="text-center p-4">
                  <QrCode className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-400 font-bold">Cámara en espera</p>
                  <p className="text-[11px] text-slate-500">Tocá "Abrir Cámara" para enfocar etiquetas</p>
                </div>
              )}

              {scanning && (
                <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
                  <span className="px-2 py-0.5 rounded-full bg-slate-950/80 text-[10px] font-bold text-yellow-300 border border-yellow-400/40">
                    🟢 Lector QR / Barras Activo
                  </span>
                </div>
              )}
            </div>

            {/* Auto-pack switch */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPackOnScan}
                  onChange={(e) => setAutoPackOnScan(e.target.checked)}
                  className="w-4 h-4 rounded text-yellow-500 focus:ring-yellow-400 cursor-pointer accent-yellow-500"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Marcar "Empaquetado" automáticamente al leer
                </span>
              </label>
            </div>

            {cameraError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-2xl flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>

          {/* Manual Input (Pistola láser / Teclado) */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="O ingresá el código de envío / SKU..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessingScan}
              className="px-4 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 rounded-2xl text-xs font-black hover:bg-slate-800 transition disabled:opacity-50"
            >
              Verificar
            </button>
          </form>

          {/* DYNAMIC SCANNED RESULT FEEDBACK CARD */}
          {lastScanned && (
            <div 
              className={`p-4 rounded-3xl border shadow-xl animate-in zoom-in-95 space-y-3 ${
                lastScanned.status === 'NEWLY_PACKED'
                  ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-400/40'
                  : lastScanned.status === 'ALREADY_PACKED'
                  ? 'bg-amber-500/15 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400/40'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              {/* Header result */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  {lastScanned.status === 'NEWLY_PACKED' && (
                    <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-md">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  )}
                  {lastScanned.status === 'ALREADY_PACKED' && (
                    <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-md animate-pulse">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  )}
                  {lastScanned.status === 'NOT_FOUND' && (
                    <div className="p-2.5 bg-rose-500 text-white rounded-2xl shadow-md">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {lastScanned.status === 'NEWLY_PACKED' && '✅ ¡Nuevo Paquete Empaquetado!'}
                      {lastScanned.status === 'ALREADY_PACKED' && '⚠️ ¡ATENCIÓN: PAQUETE YA LEÍDO!'}
                      {lastScanned.status === 'NOT_FOUND' && '❌ Código No Encontrado'}
                      {lastScanned.status === 'UNPACKED' && '↩️ Paquete Desmarcado'}
                    </h3>
                    <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                      <Clock className="w-3 h-3 inline" />
                      <span>{lastScanned.timestamp}</span>
                      {lastScanned.scanCount > 1 && (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          • Lectura #{lastScanned.scanCount}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shadow-xs ${
                  lastScanned.status === 'NEWLY_PACKED'
                    ? 'bg-emerald-500 text-white'
                    : lastScanned.status === 'ALREADY_PACKED'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}>
                  {lastScanned.status === 'NEWLY_PACKED' && 'LISTO OK'}
                  {lastScanned.status === 'ALREADY_PACKED' && 'DUPLICADO'}
                  {lastScanned.status === 'NOT_FOUND' && 'NO ENCONTRADO'}
                  {lastScanned.status === 'UNPACKED' && 'PENDIENTE'}
                </span>
              </div>

              {/* Message text */}
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {lastScanned.message}
              </p>

              {/* Scanned Shipment Details & Actions */}
              {lastScanned.shipment && (
                <div className="bg-white/95 dark:bg-slate-900/95 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Envío #{lastScanned.shipment.id}</span>
                    <span className="font-black text-slate-900 dark:text-white">Orden #{lastScanned.shipment.order_id}</span>
                  </div>

                  {/* Items in order with big quantity badge */}
                  <div className="space-y-2 pt-1">
                    {(lastScanned.shipment.items || []).map((it, idx) => (
                      <div key={idx} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {it.item?.title || 'Producto'}
                          </p>
                          {it.item?.seller_sku && (
                            <p className="text-[10px] font-mono text-slate-500">
                              SKU: <b>{it.item.seller_sku}</b>
                            </p>
                          )}
                        </div>

                        {/* HUGE QUANTITY BADGE TO PREVENT WAREHOUSE MISTAKES */}
                        <div className="px-3 py-1.5 rounded-xl bg-yellow-400 text-slate-950 font-black text-sm shrink-0 shadow-xs text-center">
                          x{it.quantity}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 flex justify-between">
                    <span>Comprador: <b>{lastScanned.shipment.buyer?.first_name ? `${lastScanned.shipment.buyer.first_name} ${lastScanned.shipment.buyer.last_name || ''}` : lastScanned.shipment.buyer?.nickname}</b></span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {lastScanned.shipment.receiver_address?.city?.name || 'Mercado Envíos'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex gap-2">
                    <a
                      href={api.downloadLabelUrl(lastScanned.shipment.id, 'pdf')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir Etiqueta PDF</span>
                    </a>

                    {/* Button to undo packing */}
                    <button
                      onClick={() => handleUnpackShipment(lastScanned.shipment.id)}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center space-x-1 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50"
                      title="Desmarcar este empaque y devolverlo a pendientes"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Desmarcar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SHIPMENTS LIST */}
      {activeTab === 'shipments' && (
        <div className="space-y-3">
          {/* Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                filterStatus === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600'
              }`}
            >
              Todos ({shipments.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                filterStatus === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600'
              }`}
            >
              Pendientes ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('packed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                filterStatus === 'packed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600'
              }`}
            >
              Empaquetados ({packedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por orden, cliente o producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* List items */}
          <div className="space-y-2.5">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />
                <span>Cargando despachos...</span>
              </div>
            ) : filteredShipments.length > 0 ? (
              filteredShipments.map((s) => {
                const isPacked = Boolean(s.packing?.packed);
                const itemsList = s.items || [];

                return (
                  <div
                    key={s.id}
                    className={`p-4 rounded-3xl border shadow-xs transition ${
                      isPacked
                        ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                            Orden #{s.order_id}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {s.logistic_type === 'self_service' ? 'FLEX' : s.logistic_type === 'cross_docking' ? 'COLECTA' : 'CORREO'}
                          </span>
                        </div>

                        <div className="mt-1 space-y-1">
                          {itemsList.map((it, idx) => (
                            <p key={idx} className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                              <span className="text-yellow-600 dark:text-yellow-400 font-black">[{it.quantity}x]</span> {it.item?.title || 'Artículo'}
                            </p>
                          ))}
                        </div>

                        <p className="text-[11px] text-slate-500 mt-1">
                          Comprador: <b>{s.buyer?.first_name ? `${s.buyer.first_name} ${s.buyer.last_name || ''}` : s.buyer?.nickname}</b>
                        </p>
                      </div>

                      {isPacked && (
                        <span className="p-1.5 rounded-full bg-emerald-500 text-white shrink-0 shadow-xs">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
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
                        onClick={() => handleTogglePacking(s.id, isPacked)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-1 ${
                          isPacked
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs'
                        }`}
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>{isPacked ? 'Desmarcar' : 'Listo para Despacho'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p>No se encontraron paquetes con ese filtro.</p>
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
  );
}
