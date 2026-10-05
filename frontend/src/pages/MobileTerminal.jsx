import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  MapPin, 
  Search, 
  History, 
  Layers, 
  Check, 
  Database, 
  Undo2, 
  Mic, 
  MicOff, 
  Clock, 
  Zap, 
  Calendar, 
  CalendarCheck, 
  Flame, 
  PackageOpen, 
  CheckCircle, 
  Send, 
  Tag,
  AlertOctagon,
  Navigation
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playWarningBeep, playErrorBeep, speakSpanish } from '../utils/audio';
import { api } from '../services/api';

// Helper: classify shipment by logistic urgency & exact date (Hoy, Mañana, Días Anteriores, En Camino)
const getShipmentMeta = (s) => {
  const isFlex = s.logistic_type === 'self_service';
  const isColecta = s.logistic_type === 'cross_docking';
  const isCorreo = s.logistic_type === 'drop_off' || s.logistic_type === 'xd_drop_off' || s.logistic_type === 'default';

  const isPacked = Boolean(s.packing?.packed);
  const isShipped = s.status === 'shipped';
  const isDelivered = s.status === 'delivered';

  let dateCategory = 'today'; // 'today', 'tomorrow', 'past', 'future'
  let formattedDateStr = '';
  let formattedTimeStr = '';
  let dayDifferenceDays = 0;

  if (s.order_date) {
    try {
      const orderDate = new Date(s.order_date);
      const now = new Date();
      
      // Calculate exact midnight in Argentina timezone (UTC-3)
      const getMidnightTs = (d) => {
        const str = d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); // YYYY-MM-DD
        return new Date(str + 'T00:00:00-03:00').getTime();
      };

      const orderMidnight = getMidnightTs(orderDate);
      const todayMidnight = getMidnightTs(now);
      const msPerDay = 24 * 60 * 60 * 1000;
      dayDifferenceDays = Math.round((orderMidnight - todayMidnight) / msPerDay);

      formattedDateStr = orderDate.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      });
      formattedTimeStr = orderDate.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      });

      if (dayDifferenceDays === 0) {
        dateCategory = 'today';
      } else if (dayDifferenceDays === 1) {
        dateCategory = 'tomorrow';
      } else if (dayDifferenceDays < 0) {
        dateCategory = 'past';
      } else {
        dateCategory = 'future';
      }
    } catch {
      dateCategory = isFlex ? 'today' : 'today';
    }
  }

  // Priority score for warehouse sorting:
  // 1: Flex Hoy (Pending) - Highest urgent courier cutoff
  // 2: Días Anteriores / Atrasados (Pending) - Priority backlog
  // 3: Colecta/Correo Hoy (Pending) - Same-day dispatch
  // 4: Mañana (Pending) - Next-day cutoff
  // 5: Empaquetados listos
  // 6: En camino / Despachados
  let priority = 3;
  if (isShipped || isDelivered) {
    priority = 6;
  } else if (isPacked) {
    priority = 5;
  } else if (isFlex && dateCategory === 'today') {
    priority = 1;
  } else if (dateCategory === 'past') {
    priority = 2;
  } else if (dateCategory === 'today') {
    priority = 3;
  } else {
    priority = 4;
  }

  // Visual date label
  let dateBadgeText = '📅 Despachar Hoy';
  let dateBadgeClass = 'bg-brand/20 border-brand/40 text-brand-ink dark:text-brand';

  if (isShipped) {
    dateBadgeText = '🚚 En Camino';
    dateBadgeClass = 'bg-blue-500/20 border-blue-400/40 text-blue-700 dark:text-blue-300 font-bold';
  } else if (isDelivered) {
    dateBadgeText = '✅ Entregado';
    dateBadgeClass = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-700 dark:text-emerald-300 font-bold';
  } else if (dateCategory === 'past') {
    dateBadgeText = `⚠️ Día Anterior (${formattedDateStr || 'Previo'})`;
    dateBadgeClass = 'bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-300 font-black';
  } else if (dateCategory === 'tomorrow') {
    dateBadgeText = '📦 Despacho Mañana';
    dateBadgeClass = 'bg-purple-500/20 border-purple-400/40 text-purple-700 dark:text-purple-300 font-bold';
  } else if (dateCategory === 'today') {
    dateBadgeText = isFlex ? '⚡ Flex Hoy' : '📅 Despachar Hoy';
    dateBadgeClass = isFlex 
      ? 'bg-amber-400 text-slate-950 font-black border-amber-500 shadow-xs' 
      : 'bg-brand/20 border-brand/40 text-brand-ink dark:text-brand font-bold';
  }

  return {
    isFlex,
    isColecta,
    isCorreo,
    isShipped,
    isDelivered,
    dateCategory,
    dayDifferenceDays,
    formattedDateStr,
    formattedTimeStr,
    fullDateTime: formattedDateStr ? `${formattedDateStr} ${formattedTimeStr} hs` : '',
    isPacked,
    priority,
    dateBadgeText,
    dateBadgeClass,
    logisticLabel: isFlex ? 'FLEX EN EL DÍA' : isColecta ? 'COLECTA' : isCorreo ? 'CORREO / PUNTO' : 'ESTÁNDAR',
  };
};

export default function MobileTerminal({ connection }) {
  const [activeTab, setActiveTab] = useState('shipments'); // 'shipments', 'scanner', 'history'
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
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // Filter States: 'all_active', 'today', 'flex', 'past', 'tomorrow', 'shipped', 'all'
  const [dateFilter, setDateFilter] = useState('all_active');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'packed', 'all'

  const html5QrCodeRef = useRef(null);
  const lastScannedCodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Live ticking clock in Argentina time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        } else {
          if (soundEnabled) playSuccessBeep();
          if (voiceEnabled) speakSpanish(`Paquete verificado con éxito`);
          if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
          confetti({ particleCount: 50, spread: 75, origin: { y: 0.65 } });

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
      } else {
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

  // Enriched & Grouped Metrics Computation
  const {
    enrichedShipments,
    totalCount,
    packedCount,
    pendingCount,
    progressPercent,
    flexTotal,
    flexPending,
    todayTotal,
    todayPending,
    pastTotal,
    pastPending,
    tomorrowTotal,
    tomorrowPending,
    shippedTotal,
  } = useMemo(() => {
    let flexTot = 0;
    let flexPend = 0;
    let todTot = 0;
    let todPend = 0;
    let pastTot = 0;
    let pastPend = 0;
    let tomTot = 0;
    let tomPend = 0;
    let shipTot = 0;
    let packedTot = 0;

    const enriched = shipments.map(s => {
      const meta = getShipmentMeta(s);
      if (meta.isPacked) packedTot++;
      if (meta.isShipped) shipTot++;

      if (meta.isFlex) {
        flexTot++;
        if (!meta.isPacked && !meta.isShipped) flexPend++;
      }

      if (meta.dateCategory === 'today') {
        todTot++;
        if (!meta.isPacked && !meta.isShipped) todPend++;
      } else if (meta.dateCategory === 'past') {
        pastTot++;
        if (!meta.isPacked && !meta.isShipped) pastPend++;
      } else if (meta.dateCategory === 'tomorrow') {
        tomTot++;
        if (!meta.isPacked && !meta.isShipped) tomPend++;
      }

      return { ...s, meta };
    });

    // Sort: Flex pending first, then past pending, then today pending, then tomorrow pending, then packed
    enriched.sort((a, b) => a.meta.priority - b.meta.priority);

    const total = shipments.length;
    const progress = total > 0 ? Math.round((packedTot / total) * 100) : 0;

    return {
      enrichedShipments: enriched,
      totalCount: total,
      packedCount: packedTot,
      pendingCount: total - packedTot,
      progressPercent: progress,
      flexTotal: flexTot,
      flexPending: flexPend,
      todayTotal: todTot,
      todayPending: todPend,
      pastTotal: pastTot,
      pastPending: pastPend,
      tomorrowTotal: tomTot,
      tomorrowPending: tomPend,
      shippedTotal: shipTot,
    };
  }, [shipments]);

  // Filtered List calculation
  const displayedShipments = useMemo(() => {
    return enrichedShipments.filter(s => {
      // 1. Status Filter
      if (statusFilter === 'pending' && (s.meta.isPacked || s.meta.isShipped)) return false;
      if (statusFilter === 'packed' && !s.meta.isPacked) return false;

      // 2. Date / Urgency Filter
      if (dateFilter === 'flex') {
        if (!s.meta.isFlex) return false;
      } else if (dateFilter === 'today') {
        if (s.meta.dateCategory !== 'today') return false;
      } else if (dateFilter === 'past') {
        if (s.meta.dateCategory !== 'past') return false;
      } else if (dateFilter === 'tomorrow') {
        if (s.meta.dateCategory !== 'tomorrow') return false;
      } else if (dateFilter === 'shipped') {
        if (!s.meta.isShipped) return false;
      } else if (dateFilter === 'all_active') {
        // Active dispatch queue (Today + Past backlog + Tomorrow)
        if (s.meta.isShipped) return false;
      }

      // 3. Search text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = String(s.id).includes(q) || String(s.order_id).includes(q);
        const matchesTracking = s.tracking_number && String(s.tracking_number).toLowerCase().includes(q);
        const matchesBuyer = (s.buyer?.first_name && s.buyer.first_name.toLowerCase().includes(q)) ||
                             (s.buyer?.last_name && s.buyer.last_name.toLowerCase().includes(q)) ||
                             (s.buyer?.nickname && s.buyer.nickname.toLowerCase().includes(q));
        const matchesItems = s.items && s.items.some(it => 
          (it.item?.title && it.item.title.toLowerCase().includes(q)) ||
          (it.item?.seller_sku && it.item.seller_sku.toLowerCase().includes(q))
        );
        return matchesId || matchesTracking || matchesBuyer || matchesItems;
      }

      return true;
    });
  }, [enrichedShipments, statusFilter, dateFilter, searchQuery]);

  return (
    <div className="page pb-24">
      <div className="mx-auto w-full max-w-xl select-none space-y-4">

        {/* 1. TOP HEADER & AUDIO CONTROLS */}
        <div className="page-head flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink shadow-glow">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="page-title text-lg font-black tracking-tight">Terminal de Empaque</h1>
                <span className="badge badge-brand text-[10px] uppercase font-extrabold">Depósito</span>
              </div>
              <p className="page-sub flex items-center gap-2 mt-0.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success animate-pulse-ring" aria-hidden="true" />
                <span className="font-semibold text-ink-muted">@GRANA3DOK</span>
                <span className="text-ink-subtle">•</span>
                <span className="tabular font-mono text-[11px] font-bold text-ink-muted">{currentTime}</span>
              </p>
            </div>
          </div>

          {/* Controls toolbar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={loadData}
              className="btn btn-icon btn-outline h-9 w-9"
              title="Recargar despachos"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand' : ''}`} />
            </button>

            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`btn btn-icon h-9 w-9 ${voiceEnabled ? 'btn-soft text-brand-ink bg-brand' : 'btn-outline'}`}
              title={voiceEnabled ? 'Voz en español activada' : 'Voz silenciada'}
            >
              {voiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`btn btn-icon h-9 w-9 ${soundEnabled ? 'btn-soft text-brand-ink bg-brand' : 'btn-outline'}`}
              title={soundEnabled ? 'Silenciar beeps' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 2. LOGISTICS DASHBOARD & PROGRESS HERO CARD */}
        <div className="card card-pad bg-gradient-to-br from-card to-muted/40 border border-line-strong shadow-sm space-y-4">
          
          {/* Progress Bar & Big KPI */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-ink-subtle">
                  Progreso de Despacho
                </p>
                {flexPending > 0 && (
                  <span className="badge badge-warning text-[10px] font-black animate-pulse">
                    ⚡ {flexPending} FLEX PENDIENTE
                  </span>
                )}
                {pastPending > 0 && (
                  <span className="badge badge-danger text-[10px] font-black">
                    ⚠️ {pastPending} DÍAS ANTERIORES
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-ink tabular">
                  {packedCount}
                </span>
                <span className="text-sm font-bold text-ink-muted">
                  / <span className="tabular">{totalCount}</span> paquetes listos
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand/20 border border-brand/40 text-brand-ink dark:text-brand font-black text-sm">
                <span className="tabular">{progressPercent}%</span>
              </div>
              <p className="text-[10px] font-bold text-ink-subtle mt-1">
                {pendingCount === 0 ? '🎉 Todo empaquetado' : `Faltan ${pendingCount} paquetes`}
              </p>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted border border-line">
            <div 
              className="h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-emerald-500 transition-all duration-500 ease-spring"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Urgent Dispatch Breakdown Pills */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            
            {/* Flex Hoy */}
            <button
              onClick={() => {
                setDateFilter('flex');
                setActiveTab('shipments');
              }}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                dateFilter === 'flex' 
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs ring-2 ring-emerald-500/30' 
                  : 'border-line bg-card hover:bg-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                  Flex Hoy
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${flexPending > 0 ? 'bg-amber-400 text-slate-950' : 'bg-emerald-200 text-emerald-900'}`}>
                  {flexPending} pend.
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-black text-ink tabular">
                {flexTotal} <span className="text-[11px] font-normal text-ink-muted">total</span>
              </p>
            </button>

            {/* Hoy (General) */}
            <button
              onClick={() => {
                setDateFilter('today');
                setActiveTab('shipments');
              }}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                dateFilter === 'today' 
                  ? 'border-brand bg-brand-soft shadow-xs ring-2 ring-brand/30' 
                  : 'border-line bg-card hover:bg-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-ink uppercase tracking-wider flex items-center gap-1">
                  <CalendarCheck className="h-3 w-3 text-ink-subtle" />
                  Hoy
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-muted text-ink-muted">
                  {todayPending} pend.
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-black text-ink tabular">
                {todayTotal} <span className="text-[11px] font-normal text-ink-muted">total</span>
              </p>
            </button>

            {/* Días Anteriores / Atrasados */}
            <button
              onClick={() => {
                setDateFilter('past');
                setActiveTab('shipments');
              }}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                dateFilter === 'past' 
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 shadow-xs ring-2 ring-amber-500/30' 
                  : 'border-line bg-card hover:bg-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Previos
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${pastPending > 0 ? 'bg-amber-500 text-white' : 'bg-muted text-ink-muted'}`}>
                  {pastPending} pend.
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-black text-ink tabular">
                {pastTotal} <span className="text-[11px] font-normal text-ink-muted">total</span>
              </p>
            </button>

          </div>

        </div>

        {/* 3. MAIN NAVIGATION TABS */}
        <div className="segmented grid w-full grid-cols-3 gap-1 p-1 bg-muted rounded-2xl border border-line">
          <button
            onClick={() => setActiveTab('shipments')}
            className={`segmented-btn flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold ${activeTab === 'shipments' ? 'segmented-btn-active bg-card text-ink shadow-xs' : 'text-ink-muted'}`}
          >
            <Layers className="h-4 w-4 text-brand" />
            <span>Lista Envíos <span className="tabular font-black">({pendingCount})</span></span>
          </button>

          <button
            onClick={() => {
              setActiveTab('scanner');
              if (!scanning) startCamera();
            }}
            className={`segmented-btn flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold ${activeTab === 'scanner' ? 'segmented-btn-active bg-card text-ink shadow-xs' : 'text-ink-muted'}`}
          >
            <QrCode className="h-4 w-4 text-emerald-500" />
            <span>Escanear Lector</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`segmented-btn flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold ${activeTab === 'history' ? 'segmented-btn-active bg-card text-ink shadow-xs' : 'text-ink-muted'}`}
          >
            <History className="h-4 w-4 text-purple-500" />
            <span>Historial ({scanLogs.length})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: LISTA DE ENVÍOS (HOY / MAÑANA / PREVIOS / EN CAMINO) */}
        {/* ========================================================================= */}
        {activeTab === 'shipments' && (
          <div className="space-y-3 animate-in fade-in-50 duration-200">

            {/* A. DATE & LOGISTICS CHIP SELECTOR */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              
              <button
                onClick={() => setDateFilter('all_active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 ${
                  dateFilter === 'all_active'
                    ? 'bg-ink text-bg shadow-xs'
                    : 'bg-card border border-line text-ink-muted hover:bg-muted'
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span>Despacho Activo</span>
                <span className="badge badge-neutral text-[10px] tabular">
                  {todayTotal + pastTotal + tomorrowTotal}
                </span>
              </button>

              <button
                onClick={() => setDateFilter('flex')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 ${
                  dateFilter === 'flex'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-card border border-line text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Flex ({flexTotal})</span>
              </button>

              <button
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 ${
                  dateFilter === 'today'
                    ? 'bg-brand text-brand-ink shadow-xs'
                    : 'bg-card border border-line text-ink-muted hover:bg-muted'
                }`}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                <span>Hoy ({todayTotal})</span>
              </button>

              <button
                onClick={() => setDateFilter('past')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 ${
                  dateFilter === 'past'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-card border border-line text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Días Anteriores ({pastTotal})</span>
              </button>

              <button
                onClick={() => setDateFilter('tomorrow')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 ${
                  dateFilter === 'tomorrow'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-card border border-line text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Mañana ({tomorrowTotal})</span>
              </button>

              <button
                onClick={() => setDateFilter('shipped')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 ${
                  dateFilter === 'shipped'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-card border border-line text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                <span>En Camino ({shippedTotal})</span>
              </button>

              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all flex items-center gap-1.5 ${
                  dateFilter === 'all'
                    ? 'bg-ink text-bg shadow-xs'
                    : 'bg-card border border-line text-ink-muted hover:bg-muted'
                }`}
              >
                <span>Todos ({totalCount})</span>
              </button>
            </div>

            {/* B. STATUS FILTER PILLS & SEARCH */}
            <div className="card card-pad p-3 space-y-2.5">
              
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                      statusFilter === 'pending'
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-muted text-ink-muted hover:bg-muted/80'
                    }`}
                  >
                    ⏳ Pendientes ({pendingCount})
                  </button>

                  <button
                    onClick={() => setStatusFilter('packed')}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                      statusFilter === 'packed'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-muted text-ink-muted hover:bg-muted/80'
                    }`}
                  >
                    ✅ Empaquetados ({packedCount})
                  </button>

                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black transition ${
                      statusFilter === 'all'
                        ? 'bg-ink text-bg'
                        : 'bg-muted text-ink-muted hover:bg-muted/80'
                    }`}
                  >
                    Todos
                  </button>
                </div>

                <span className="text-[11px] font-bold text-ink-subtle">
                  Mostrando <b className="text-ink">{displayedShipments.length}</b>
                </span>
              </div>

              {/* Live Search */}
              <div className="relative">
                <Search className="h-4 w-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por orden, tracking, cliente o SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9 text-xs py-2 h-9 bg-muted/60"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-subtle hover:text-ink"
                  >
                    ✕
                  </button>
                )}
              </div>

            </div>

            {/* C. SHIPMENT CARDS STREAM */}
            <div className="space-y-3 pt-1">
              {loading ? (
                <div className="card p-10 text-center text-ink-muted space-y-3">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-brand" />
                  <p className="text-xs font-bold">Cargando despachos en tiempo real...</p>
                </div>
              ) : displayedShipments.length > 0 ? (
                displayedShipments.map((s) => {
                  const meta = s.meta;
                  const isPacked = meta.isPacked;
                  const itemsList = s.items || [];
                  const totalUnits = itemsList.reduce((acc, it) => acc + (it.quantity || 1), 0);

                  return (
                    <div
                      key={s.id}
                      className={`card card-pad p-4 transition-all duration-200 border-2 ${
                        meta.isShipped
                          ? 'border-blue-300 dark:border-blue-800/60 bg-blue-50/10 dark:bg-blue-950/20'
                          : isPacked
                          ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20 opacity-80 hover:opacity-100'
                          : meta.isFlex && meta.dateCategory === 'today'
                          ? 'border-amber-400 bg-amber-500/5 dark:bg-amber-950/20 shadow-md ring-1 ring-amber-400/30'
                          : meta.dateCategory === 'past'
                          ? 'border-amber-500/80 bg-amber-50/30 dark:bg-amber-950/30 shadow-xs'
                          : 'border-line hover:border-line-strong'
                      }`}
                    >
                      {/* Top Badges Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Logistic Priority Tag */}
                          {meta.isFlex ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black shadow-xs">
                              <Zap className="h-3 w-3 fill-slate-950" />
                              FLEX EN EL DÍA
                            </span>
                          ) : meta.isColecta ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold shadow-xs">
                              <Truck className="h-3 w-3" />
                              COLECTA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-600 text-white text-[11px] font-bold shadow-xs">
                              <Send className="h-3 w-3" />
                              CORREO
                            </span>
                          )}

                          {/* ACCURATE Real Date delivery context */}
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] border ${meta.dateBadgeClass}`}>
                            {meta.dateBadgeText}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center gap-1.5">
                          {meta.isShipped ? (
                            <span className="badge badge-info text-[10px] font-black gap-1">
                              <Truck className="h-3 w-3" />
                              En camino
                            </span>
                          ) : isPacked ? (
                            <span className="badge badge-success text-[10px] font-black gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Empaquetado
                            </span>
                          ) : (
                            <span className="badge badge-warning text-[10px] font-black gap-1">
                              <Clock className="h-3 w-3" />
                              Pendiente
                            </span>
                          )}
                        </div>

                      </div>

                      {/* Shipment & Order Identification with EXACT PURCHASE TIMESTAMP */}
                      <div className="pt-2.5 flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-extrabold text-sm text-ink">
                              Orden #{s.order_id}
                            </span>
                            <span className="text-[11px] font-mono text-ink-subtle">
                              (Envío #{s.id})
                            </span>
                          </div>
                          
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                            <span>Comprador: <b className="font-bold text-ink">{s.buyer?.first_name ? `${s.buyer.first_name} ${s.buyer.last_name || ''}` : s.buyer?.nickname || 'Cliente'}</b></span>
                            {meta.fullDateTime && (
                              <span className="text-[11px] font-semibold text-ink-subtle">
                                • Creada: <b className="text-ink">{meta.fullDateTime}</b>
                              </span>
                            )}
                            {s.receiver_address?.city?.name && (
                              <span className="text-[11px] text-ink-subtle flex items-center gap-0.5">
                                • <MapPin className="h-3 w-3 text-ink-subtle inline" />
                                {s.receiver_address.city.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-ink-subtle block">Unidades</span>
                          <span className="font-display text-base font-extrabold text-ink tabular">
                            {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
                          </span>
                        </div>
                      </div>

                      {/* Ordered Items with BIG VISUAL QUANTITY PILL */}
                      <div className="space-y-2 pt-2.5">
                        {itemsList.map((it, idx) => (
                          <div 
                            key={idx} 
                            className="p-3 rounded-2xl bg-muted/60 border border-line flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-ink line-clamp-2 leading-tight">
                                {it.item?.title || 'Producto Mercado Libre'}
                              </p>
                              {it.item?.seller_sku ? (
                                <p className="text-[11px] font-mono font-bold text-brand-ink dark:text-brand mt-1 flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  SKU: {it.item.seller_sku}
                                </p>
                              ) : (
                                <p className="text-[10px] font-mono text-ink-subtle mt-0.5">
                                  Item #{it.item?.id || ''}
                                </p>
                              )}
                            </div>

                            {/* HUGE HIGH-CONTRAST QUANTITY BADGE */}
                            <div className="flex flex-col items-center justify-center px-3.5 py-2 rounded-xl bg-yellow-400 text-slate-950 font-display font-black text-base shadow-xs text-center shrink-0 border border-yellow-500">
                              <span>x{it.quantity || 1}</span>
                              <span className="text-[8px] uppercase tracking-wider font-extrabold leading-none">CANTIDAD</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons Toolbar */}
                      <div className="mt-3.5 pt-3 border-t border-line flex items-center justify-between gap-2">
                        <a
                          href={api.downloadLabelUrl(s.id, 'pdf')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm font-bold flex items-center gap-1.5 px-3 py-2 text-xs"
                          title="Descargar o imprimir etiqueta de Mercado Envíos"
                        >
                          <Printer className="h-3.5 w-3.5 text-ink-subtle" />
                          <span>Etiqueta PDF</span>
                        </a>

                        {meta.isShipped ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
                            <Navigation className="h-3.5 w-3.5" />
                            <span>En reparto / Colecta</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleTogglePacking(s.id, isPacked)}
                            className={`btn btn-sm flex-1 font-extrabold py-2 text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                              isPacked
                                ? 'btn-outline text-danger hover:bg-danger-soft'
                                : meta.isFlex && meta.dateCategory === 'today'
                                ? 'btn-primary bg-amber-400 text-slate-950 hover:bg-amber-500 border-amber-500 ring-2 ring-amber-400/40'
                                : 'btn-primary'
                            }`}
                          >
                            {isPacked ? (
                              <>
                                <Undo2 className="h-3.5 w-3.5" />
                                <span>Desmarcar Empaque</span>
                              </>
                            ) : (
                              <>
                                <PackageCheck className="h-4 w-4" />
                                <span>Listo para Despacho</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="card p-10 text-center text-ink-muted space-y-3">
                  <PackageOpen className="h-10 w-10 mx-auto text-brand opacity-60" />
                  <h3 className="font-display font-bold text-sm text-ink">No hay paquetes con este filtro</h3>
                  <p className="text-xs text-ink-subtle max-w-xs mx-auto">
                    Probá cambiando la pestaña de fechas o el estado a "Todos".
                  </p>
                  <button
                    onClick={() => {
                      setDateFilter('all_active');
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className="btn btn-outline btn-sm mx-auto mt-2"
                  >
                    Restablecer filtros
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ESCÁNER CON CÁMARA O PISTOLA */}
        {/* ========================================================================= */}
        {activeTab === 'scanner' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            
            {/* Lector de cámara */}
            <div className="card card-pad p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
                  <Camera className="h-4 w-4 text-brand" />
                  <span>Lector de Etiquetas y QR</span>
                </span>

                <span className={`badge ${scanning ? 'badge-success' : 'badge-neutral'}`}>
                  <span className={`h-2 w-2 rounded-full ${scanning ? 'bg-success animate-pulse-ring' : 'bg-ink-subtle'}`} aria-hidden="true" />
                  {scanning ? 'Escaneando en vivo' : 'Cámara en pausa'}
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
                    <span className="badge badge-solid gap-1.5 backdrop-blur bg-black/70 text-white border-0">
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse-ring" aria-hidden="true" />
                      Lector Óptico Activo
                    </span>
                  </div>
                )}
              </div>

              {/* Botón principal de control de cámara */}
              <button
                onClick={scanning ? stopCamera : startCamera}
                className={`btn btn-lg btn-block py-4 text-base font-extrabold ${scanning ? 'btn-danger-soft text-danger' : 'btn-primary'}`}
              >
                <Camera className="h-5 w-5" />
                <span>{scanning ? 'Pausar Cámara' : 'Iniciar Escaneo de Cámara'}</span>
              </button>

              {/* Toggle de empaque automático */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={autoPackOnScan}
                    onChange={(e) => setAutoPackOnScan(e.target.checked)}
                    className="check h-4 w-4"
                  />
                  <span className="font-bold text-ink-muted">
                    Marcar como "Empaquetado" al detectar código
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

            {/* Input Manual o Pistola Láser USB / Bluetooth */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="O ingresá el código de barras / orden..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="input flex-1 text-xs py-2.5 font-mono"
              />
              <button
                type="submit"
                disabled={!manualCode.trim() || isProcessingScan}
                className="btn btn-primary px-5 text-xs font-black disabled:opacity-50"
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
                      <h3 className="font-extrabold text-sm text-ink">
                        {lastScanned.status === 'NEWLY_PACKED' && '✅ ¡Nuevo Paquete Empaquetado!'}
                        {lastScanned.status === 'ALREADY_PACKED' && '⚠️ ¡ATENCIÓN: PAQUETE YA LEÍDO!'}
                        {lastScanned.status === 'NOT_FOUND' && '❌ Código No Encontrado'}
                        {lastScanned.status === 'UNPACKED' && '↩️ Paquete Desmarcado'}
                      </h3>
                      <p className="text-[11px] text-ink-muted flex items-center space-x-1 mt-0.5">
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

                <p className="text-xs font-bold text-ink">
                  {lastScanned.message}
                </p>

                {lastScanned.shipment && (
                  <div className="bg-card p-3.5 rounded-2xl border border-line space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink-muted">Envío #{lastScanned.shipment.id}</span>
                      <span className="font-black text-ink">Orden #{lastScanned.shipment.order_id}</span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {(lastScanned.shipment.items || []).map((it, idx) => (
                        <div key={idx} className="p-2.5 rounded-2xl bg-muted border border-line flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-ink line-clamp-1">
                              {it.item?.title || 'Producto'}
                            </p>
                            {it.item?.seller_sku && (
                              <p className="text-[10px] font-mono text-ink-muted">
                                SKU: <b>{it.item.seller_sku}</b>
                              </p>
                            )}
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-yellow-400 text-slate-950 font-black text-sm shrink-0 shadow-xs text-center">
                            x{it.quantity}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex gap-2">
                      <a
                        href={api.downloadLabelUrl(lastScanned.shipment.id, 'pdf')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary flex-1 text-xs font-black py-2.5 flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir Etiqueta PDF</span>
                      </a>

                      <button
                        onClick={() => handleUnpackShipment(lastScanned.shipment.id)}
                        className="btn btn-outline text-danger text-xs font-bold px-3 py-2.5"
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

        {/* ========================================================================= */}
        {/* TAB 3: AUDITORÍA DE ESCANEOS */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-ink uppercase tracking-wider flex items-center space-x-1.5">
                <History className="w-4 h-4 text-purple-500" />
                <span>Auditoría de Escaneos Hoy</span>
              </span>
              <button
                onClick={loadData}
                className="btn btn-icon btn-outline h-7 w-7"
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
                    className="card p-3 border border-line shadow-xs flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className={`p-1.5 rounded-xl shrink-0 ${
                        log.action === 'FIRST_PACK_VERIFIED' || log.action === 'PACK_VERIFIED'
                          ? 'bg-emerald-500 text-white'
                          : log.action === 'DUPLICATE_SCAN'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-muted text-ink-muted'
                      }`}>
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-extrabold text-ink truncate">
                            {log.barcode}
                          </span>
                          {(log.action === 'FIRST_PACK_VERIFIED' || log.action === 'PACK_VERIFIED') && (
                            <span className="badge badge-success text-[9px] font-black">
                              EMPACADO
                            </span>
                          )}
                          {log.action === 'DUPLICATE_SCAN' && (
                            <span className="badge badge-warning text-[9px] font-black">
                              DUPLICADO (#{log.details?.scanCount || 2})
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-ink-subtle truncate">
                          {log.details?.title || log.details?.buyer || log.action}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] text-ink-subtle font-semibold shrink-0 ml-2">
                      {new Date(log.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="card p-8 text-center text-ink-muted text-xs">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-ink-subtle" />
                  <p>Aún no hay escaneos registrados hoy.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Database connection footer badge */}
        <div className="pt-2 text-center">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-muted border border-line text-[10px] font-bold text-ink-muted">
            <Database className="w-3 h-3 text-emerald-500" />
            <span>Base de datos: {dbStatus?.provider || 'Neon PostgreSQL'}</span>
          </span>
        </div>

      </div>
    </div>
  );
}
