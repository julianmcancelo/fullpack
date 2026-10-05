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
  Navigation,
  FileCheck2,
  FileText,
  Boxes,
  UserCheck,
  ClipboardList,
  ShieldCheck,
  X,
  Play,
  Pause,
  Sliders,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playWarningBeep, playErrorBeep, speakSpanish } from '../utils/audio';
import { api } from '../services/api';

// Helper: classify shipment by logistic urgency & exact date (Hoy, Mañana, Días Anteriores, En Camino, Entregado)
const getShipmentMeta = (s) => {
  const isFlex = s.logistic_type === 'self_service';
  const isColecta = s.logistic_type === 'cross_docking';
  const isCorreo = s.logistic_type === 'drop_off' || s.logistic_type === 'xd_drop_off' || s.logistic_type === 'default';

  const isPacked = Boolean(s.packing?.packed);
  const isDispatchChecked = Boolean(s.packing?.dispatchChecked);
  const isShipped = s.status === 'shipped';
  const isDelivered = s.status === 'delivered';
  const isCancelled = s.status === 'cancelled';

  let dateCategory = 'today'; // 'today', 'tomorrow', 'past', 'future'
  let formattedDateStr = '';
  let formattedTimeStr = '';
  let dayDifferenceDays = 0;

  // Determine target date: check delivery limit or handling limit first, fallback to order_date
  const targetDateRaw = 
    s.shipping_option?.estimated_delivery_limit?.date || 
    s.shipping_option?.estimated_delivery_time?.date ||
    s.estimated_handling_limit?.date ||
    s.lead_time?.estimated_handling_limit?.date ||
    s.order_date;

  if (targetDateRaw) {
    try {
      const targetDate = new Date(targetDateRaw);
      const now = new Date();
      
      // Calculate exact midnight in Argentina timezone (UTC-3)
      const getMidnightTs = (d) => {
        const str = d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); // YYYY-MM-DD
        return new Date(str + 'T00:00:00-03:00').getTime();
      };

      const targetMidnight = getMidnightTs(targetDate);
      const todayMidnight = getMidnightTs(now);
      const msPerDay = 24 * 60 * 60 * 1000;
      dayDifferenceDays = Math.round((targetMidnight - todayMidnight) / msPerDay);

      // Order creation timestamp format
      const orderDateObj = s.order_date ? new Date(s.order_date) : targetDate;
      formattedDateStr = orderDateObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      });
      formattedTimeStr = orderDateObj.toLocaleTimeString('es-AR', {
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
  // 7: Entregados
  let priority = 3;
  if (isDelivered) {
    priority = 7;
  } else if (isShipped) {
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

  if (isDelivered) {
    dateBadgeText = '✅ Entregado';
    dateBadgeClass = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-700 dark:text-emerald-300 font-bold';
  } else if (isShipped) {
    dateBadgeText = '🚚 En Camino';
    dateBadgeClass = 'bg-blue-500/20 border-blue-400/40 text-blue-700 dark:text-blue-300 font-bold';
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
    isCancelled,
    dateCategory,
    dayDifferenceDays,
    formattedDateStr,
    formattedTimeStr,
    fullDateTime: formattedDateStr ? `${formattedDateStr} ${formattedTimeStr} hs` : '',
    isPacked,
    isDispatchChecked,
    priority,
    dateBadgeText,
    dateBadgeClass,
    logisticLabel: isFlex ? 'FLEX EN EL DÍA' : isColecta ? 'COLECTA' : isCorreo ? 'CORREO / PUNTO' : 'ESTÁNDAR',
  };
};

export default function MobileTerminal({ connection }) {
  // Navigation Tabs: 'shipments' (Etapa 1: Empaque), 'dispatch' (Etapa 2: Control de Despacho), 'scanner', 'history'
  const [activeTab, setActiveTab] = useState('shipments');
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // SCANNER BEHAVIOR & ANTI-SPAM SETTINGS
  // 'pack_direct' (Auto-marcar listo), 'pack_checklist' (Control ítem por ítem), 'query_only' (Solo consultar), 'dispatch' (Despacho chofer)
  const [scannerAction, setScannerAction] = useState('pack_direct');
  const [scannerCarrierFilter, setScannerCarrierFilter] = useState('all'); // 'all', 'self_service', 'cross_docking', 'drop_off'
  const [pauseCameraOnScan, setPauseCameraOnScan] = useState(false); // Auto-pause camera after scan
  const [scanCooldown, setScanCooldown] = useState(0); // Cooldown seconds remaining
  
  // Scanned result state
  const [lastScanned, setLastScanned] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scanLogs, setScanLogs] = useState([]);
  const [dbStatus, setDbStatus] = useState(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // Checklist Verification Modal State
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [activeChecklistShipment, setActiveChecklistShipment] = useState(null);
  const [checkedItemsMap, setCheckedItemsMap] = useState({});

  // Filter States: 'all_active', 'flex', 'today', 'past', 'tomorrow', 'shipped', 'all'
  const [dateFilter, setDateFilter] = useState('all_active');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'packed', 'all'
  
  // Dispatch Stage states
  const [dispatchCarrierFilter, setDispatchCarrierFilter] = useState('all'); // 'all', 'self_service', 'cross_docking', 'drop_off'
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [driverInfo, setDriverInfo] = useState({ name: '', plate: '', dni: '', notes: '' });

  const html5QrCodeRef = useRef(null);
  const lastScannedCodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);
  const isCooldownRef = useRef(false);

  // Live ticking clock in Argentina time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cooldown timer interval
  useEffect(() => {
    let timer = null;
    if (scanCooldown > 0) {
      isCooldownRef.current = true;
      timer = setInterval(() => {
        setScanCooldown(prev => {
          if (prev <= 1) {
            isCooldownRef.current = false;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      isCooldownRef.current = false;
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [scanCooldown]);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
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
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-sync in background every 10 seconds so mobile stays 100% updated with any changes
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);

    const onFocus = () => loadData(true);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
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

  // Process Scanned Code with ANTI-SPAM DEBOUNCE and ACTION ROUTING
  const processScannedCode = async (rawCode) => {
    if (!rawCode) return;
    const clean = rawCode.trim();

    // 1. Anti-spam Check: if cooldown is active, ignore frame entirely
    if (isCooldownRef.current || isProcessingScan) {
      return;
    }

    const now = Date.now();
    // Debounce exact duplicate code within 4 seconds
    if (clean === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 4000) {
      return;
    }
    lastScannedCodeRef.current = clean;
    lastScannedTimeRef.current = now;

    // Activate 3-second anti-spam lock
    setIsProcessingScan(true);
    setScanCooldown(3);

    try {
      // Determine what backend call to make based on scannerAction
      const isAutoPack = scannerAction === 'pack_direct';
      const scanMode = scannerAction === 'dispatch' ? 'dispatch' : 'pack';
      const targetCarrier = scannerCarrierFilter;

      const res = await api.scanShipment(clean, isAutoPack, scanMode, targetCarrier);

      if (res.found && res.shipment) {
        const shipment = res.shipment;

        // Optionally pause camera if auto-pause is enabled
        if (pauseCameraOnScan && html5QrCodeRef.current) {
          stopCamera();
        }

        // =========================================================
        // CASE A: CARRIER MISMATCH IN DISPATCH MODE
        // =========================================================
        if (res.carrierMismatch) {
          if (soundEnabled) playErrorBeep();
          if (voiceEnabled) speakSpanish(`Alerta de error. Paquete de ${res.actualCarrier}. No cargar al chofer de ${res.expectedCarrier}.`);
          if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

          setLastScanned({
            status: 'CARRIER_MISMATCH',
            shipment,
            expectedCarrier: res.expectedCarrier,
            actualCarrier: res.actualCarrier,
            message: res.message || `🚨 ¡ERROR! Este paquete es de ${res.actualCarrier}, NO pertenece al transporte ${res.expectedCarrier}.`,
            timestamp: new Date().toLocaleTimeString('es-AR'),
          });
          return;
        }

        // =========================================================
        // CASE B: DISPATCH CONTROL MODE
        // =========================================================
        if (scannerAction === 'dispatch') {
          if (res.alreadyDispatchChecked) {
            if (soundEnabled) playWarningBeep();
            if (voiceEnabled) speakSpanish(`Paquete ya verificado para este transporte`);
            if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

            setLastScanned({
              status: 'ALREADY_DISPATCHED',
              shipment,
              message: `⚠️ Este paquete ya había sido verificado para la salida del chofer.`,
              timestamp: new Date().toLocaleTimeString('es-AR'),
            });
          } else {
            if (soundEnabled) playSuccessBeep();
            if (voiceEnabled) speakSpanish(`Paquete verificado para chofer`);
            if (navigator.vibrate) navigator.vibrate([100, 50, 150]);
            confetti({ particleCount: 45, spread: 70, origin: { y: 0.65 } });

            setShipments(prev =>
              prev.map(s => (s.id === shipment.id ? shipment : s))
            );

            setLastScanned({
              status: 'DISPATCH_VERIFIED',
              shipment,
              message: `🚚 ¡Paquete verificado con éxito para salida al transporte!`,
              timestamp: new Date().toLocaleTimeString('es-AR'),
            });
          }
          return;
        }

        // =========================================================
        // CASE C: CHECKLIST VERIFICATION MODE (Item by Item)
        // =========================================================
        if (scannerAction === 'pack_checklist') {
          if (soundEnabled) playSuccessBeep();
          if (voiceEnabled) speakSpanish(`Orden ${shipment.order_id}. Verifique los artículos.`);
          
          // Initialize checkbox state for items
          const initialChecks = {};
          (shipment.items || []).forEach((it, idx) => {
            initialChecks[idx] = false;
          });
          setCheckedItemsMap(initialChecks);
          setActiveChecklistShipment(shipment);
          setChecklistModalOpen(true);

          setLastScanned({
            status: 'CHECKLIST_OPEN',
            shipment,
            message: `📋 Orden #${shipment.order_id} cargada. Verifique cada producto en el checklist antes de sellar.`,
            timestamp: new Date().toLocaleTimeString('es-AR'),
          });
          return;
        }

        // =========================================================
        // CASE D: QUERY ONLY MODE (Solo Consulta)
        // =========================================================
        if (scannerAction === 'query_only') {
          if (soundEnabled) playSuccessBeep();
          if (voiceEnabled) speakSpanish(`Orden ${shipment.order_id}`);

          setLastScanned({
            status: 'QUERY_RESULT',
            shipment,
            message: `🔍 Consulta: Orden #${shipment.order_id} de ${shipment.buyer?.first_name || 'Cliente'} (${shipment.status}).`,
            timestamp: new Date().toLocaleTimeString('es-AR'),
          });
          return;
        }

        // =========================================================
        // CASE E: DIRECT PACKING MODE (⚡ Empaque Rápido)
        // =========================================================
        if (res.alreadyPacked) {
          if (soundEnabled) playWarningBeep();
          if (voiceEnabled) speakSpanish(`Atención, paquete ya leído previamente`);
          if (navigator.vibrate) navigator.vibrate([180, 100, 180]);

          const packedTimeStr = res.firstScannedAt 
            ? new Date(res.firstScannedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'anteriormente';

          setLastScanned({
            status: 'ALREADY_PACKED',
            shipment,
            scanCount: res.scanCount || 2,
            firstScannedAtStr: packedTimeStr,
            message: `¡ATENCIÓN! Este paquete ya había sido empaquetado a las ${packedTimeStr} (Lectura #${res.scanCount || 2}).`,
            timestamp: new Date().toLocaleTimeString('es-AR'),
          });
        } else {
          if (soundEnabled) playSuccessBeep();
          if (voiceEnabled) speakSpanish(`Empaquetado y listo`);
          if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
          confetti({ particleCount: 50, spread: 75, origin: { y: 0.65 } });

          setShipments(prev =>
            prev.map(s => (s.id === shipment.id ? shipment : s))
          );

          setLastScanned({
            status: 'NEWLY_PACKED',
            shipment,
            scanCount: 1,
            message: `¡Paquete verificado y marcado como EMPAQUETADO con éxito!`,
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
      }, 500);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processScannedCode(manualCode);
    setManualCode('');
  };

  // Complete Checklist Verification & Mark as Packed
  const handleConfirmChecklist = async () => {
    if (!activeChecklistShipment) return;
    const shipmentId = activeChecklistShipment.id;

    try {
      await api.updateShipmentPacking(shipmentId, {
        packed: true,
        qualityChecked: true,
      });

      setShipments(prev =>
        prev.map(s =>
          s.id === shipmentId
            ? {
                ...s,
                packing: {
                  ...(s.packing || {}),
                  packed: true,
                  qualityChecked: true,
                  packedAt: new Date().toISOString(),
                },
              }
            : s
        )
      );

      if (soundEnabled) playSuccessBeep();
      if (voiceEnabled) speakSpanish(`Artículos verificados y caja sellada`);
      confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });

      setLastScanned({
        status: 'NEWLY_PACKED',
        shipment: { ...activeChecklistShipment, packing: { ...activeChecklistShipment.packing, packed: true } },
        message: `✅ ¡Orden #${activeChecklistShipment.order_id} verificada ítem por ítem y sellada con éxito!`,
        timestamp: new Date().toLocaleTimeString('es-AR'),
      });

      setChecklistModalOpen(false);
      setActiveChecklistShipment(null);
    } catch (err) {
      alert(`Error al confirmar empaque: ${err.message}`);
    }
  };

  const handleUnpackShipment = async (shipmentId) => {
    try {
      await api.updateShipmentPacking(shipmentId, {
        packed: false,
        qualityChecked: false,
        dispatchChecked: false,
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
                  dispatchChecked: false,
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

  const handleToggleDispatchCheck = async (shipmentId, currentCheckedState) => {
    const nextState = !currentCheckedState;
    try {
      await api.updateShipmentPacking(shipmentId, {
        dispatchChecked: nextState,
      });

      setShipments(prev =>
        prev.map(s =>
          s.id === shipmentId
            ? {
                ...s,
                packing: {
                  ...(s.packing || {}),
                  dispatchChecked: nextState,
                },
              }
            : s
        )
      );

      if (nextState) {
        if (soundEnabled) playSuccessBeep();
        if (voiceEnabled) speakSpanish(`Verificado`);
      }
    } catch (err) {
      alert(`Error al verificar despacho: ${err.message}`);
    }
  };

  const handleStatusOverride = async (shipmentId, newStatus) => {
    try {
      await api.updateShipmentPacking(shipmentId, {
        statusOverride: newStatus,
      });

      setShipments(prev =>
        prev.map(s =>
          s.id === shipmentId
            ? {
                ...s,
                status: newStatus,
                packing: {
                  ...(s.packing || {}),
                  statusOverride: newStatus,
                },
              }
            : s
        )
      );

      if (newStatus === 'delivered') {
        if (soundEnabled) playSuccessBeep();
        if (voiceEnabled) speakSpanish(`Entregado y archivado`);
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
      } else if (newStatus === 'shipped') {
        if (soundEnabled) playSuccessBeep();
        if (voiceEnabled) speakSpanish(`Marcado en camino`);
      }
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  };

  // Bulk mark all verified packages as shipped (salida a transporte)
  const handleBulkMarkShipped = async (targetShipments) => {
    if (!targetShipments || targetShipments.length === 0) return;
    const confirmMsg = `¿Confirmar la salida de ${targetShipments.length} paquetes al transporte y marcarlos como "En Camino"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const ids = targetShipments.map(s => s.id);
      await api.batchShipmentPacking(ids, {
        statusOverride: 'shipped',
        dispatchedAt: new Date().toISOString(),
      });

      setShipments(prev =>
        prev.map(s =>
          ids.includes(s.id)
            ? {
                ...s,
                status: 'shipped',
                packing: {
                  ...(s.packing || {}),
                  statusOverride: 'shipped',
                },
              }
            : s
        )
      );

      if (soundEnabled) playSuccessBeep();
      if (voiceEnabled) speakSpanish(`Despacho confirmado con éxito`);
      confetti({ particleCount: 70, spread: 90, origin: { y: 0.6 } });
    } catch (err) {
      alert(`Error al confirmar despacho masivo: ${err.message}`);
    }
  };

  // =========================================================================
  // METRICS COMPUTATION (Excludes historical delivered orders from active KPI)
  // =========================================================================
  const {
    enrichedShipments,
    activeShipments,
    totalActiveCount,
    packedCount,
    pendingPackCount,
    dispatchCheckedCount,
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
    deliveredTotal,
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
    let delivTot = 0;
    let packedTot = 0;
    let dispatchCheckedTot = 0;

    const enriched = shipments.map(s => {
      const meta = getShipmentMeta(s);
      
      if (meta.isDelivered) {
        delivTot++;
      } else if (meta.isShipped) {
        shipTot++;
      } else if (!meta.isCancelled) {
        // Active dispatch queue (Ready to ship / pending)
        if (meta.isPacked) packedTot++;
        if (meta.isDispatchChecked) dispatchCheckedTot++;

        if (meta.isFlex) {
          flexTot++;
          if (!meta.isPacked) flexPend++;
        }

        if (meta.dateCategory === 'today') {
          todTot++;
          if (!meta.isPacked) todPend++;
        } else if (meta.dateCategory === 'past') {
          pastTot++;
          if (!meta.isPacked) pastPend++;
        } else if (meta.dateCategory === 'tomorrow') {
          tomTot++;
          if (!meta.isPacked) tomPend++;
        }
      }

      return { ...s, meta };
    });

    // Sort: Flex pending first, then past pending, then today pending, then tomorrow pending, then packed, then shipped, then delivered
    enriched.sort((a, b) => a.meta.priority - b.meta.priority);

    const activeList = enriched.filter(s => !s.meta.isDelivered && !s.meta.isCancelled && !s.meta.isShipped);
    const totalActive = activeList.length;
    const progress = totalActive > 0 ? Math.round((packedTot / totalActive) * 100) : 0;

    return {
      enrichedShipments: enriched,
      activeShipments: activeList,
      totalActiveCount: totalActive,
      packedCount: packedTot,
      pendingPackCount: Math.max(0, totalActive - packedTot),
      dispatchCheckedCount: dispatchCheckedTot,
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
      deliveredTotal: delivTot,
    };
  }, [shipments]);

  // Filtered List calculation for Tab 1 (Empaque)
  const displayedShipments = useMemo(() => {
    return enrichedShipments.filter(s => {
      // 1. Status Filter
      if (statusFilter === 'pending' && (s.meta.isPacked || s.meta.isShipped || s.meta.isDelivered)) return false;
      if (statusFilter === 'packed' && (!s.meta.isPacked || s.meta.isShipped || s.meta.isDelivered)) return false;

      // 2. Date / Urgency Filter
      if (dateFilter === 'flex') {
        if (!s.meta.isFlex || s.meta.isDelivered) return false;
      } else if (dateFilter === 'today') {
        if (s.meta.dateCategory !== 'today' || s.meta.isDelivered) return false;
      } else if (dateFilter === 'past') {
        if (s.meta.dateCategory !== 'past' || s.meta.isDelivered) return false;
      } else if (dateFilter === 'tomorrow') {
        if (s.meta.dateCategory !== 'tomorrow' || s.meta.isDelivered) return false;
      } else if (dateFilter === 'shipped') {
        if (!s.meta.isShipped) return false;
      } else if (dateFilter === 'all_active') {
        // Active dispatch queue only (exclude shipped/delivered)
        if (s.meta.isShipped || s.meta.isDelivered) return false;
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

  // Filtered List calculation for Tab 2 (Control de Despacho)
  const dispatchStageShipments = useMemo(() => {
    return enrichedShipments.filter(s => {
      // Must not be already delivered or cancelled
      if (s.meta.isDelivered || s.meta.isCancelled) return false;

      // Filter by Carrier
      if (dispatchCarrierFilter === 'self_service' && !s.meta.isFlex) return false;
      if (dispatchCarrierFilter === 'cross_docking' && !s.meta.isColecta) return false;
      if (dispatchCarrierFilter === 'drop_off' && !s.meta.isCorreo) return false;

      return true;
    });
  }, [enrichedShipments, dispatchCarrierFilter]);

  const dispatchPackedCount = dispatchStageShipments.filter(s => s.meta.isPacked).length;
  const dispatchVerifiedCount = dispatchStageShipments.filter(s => s.meta.isDispatchChecked).length;

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
                <h1 className="page-title text-lg font-black tracking-tight">Centro de Depósito y Despacho</h1>
                <span className="badge badge-brand text-[10px] uppercase font-extrabold">Almacén</span>
              </div>
              <p className="page-sub flex items-center gap-2 mt-0.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success animate-pulse-ring" aria-hidden="true" />
                {connection?.nickname ? (
                  <>
                    <span className="font-semibold text-ink-muted">@{connection.nickname}</span>
                    <span className="text-ink-subtle">•</span>
                  </>
                ) : null}
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

        {/* 2. REAL PROGRESS HERO CARD */}
        <div className="card card-pad bg-gradient-to-br from-card to-muted/40 border border-line-strong shadow-sm space-y-4">
          
          {/* Progress Bar & Big KPI */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-ink-subtle">
                  Progreso de Despacho Activo
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
                  / <span className="tabular">{totalActiveCount}</span> paquetes listos
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand/20 border border-brand/40 text-brand-ink dark:text-brand font-black text-sm">
                <span className="tabular">{progressPercent}%</span>
              </div>
              <p className="text-[10px] font-bold text-ink-subtle mt-1">
                {pendingPackCount === 0 ? '🎉 Todo empaquetado' : `Faltan ${pendingPackCount} por armar`}
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
                dateFilter === 'flex' && activeTab === 'shipments'
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
                dateFilter === 'today' && activeTab === 'shipments'
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
                dateFilter === 'past' && activeTab === 'shipments'
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

        {/* 3. WORKFLOW STAGES SELECTOR (2-STAGE PROCESS) */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-2xl border border-line">
          
          <button
            onClick={() => setActiveTab('shipments')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
              activeTab === 'shipments' 
                ? 'bg-card text-ink shadow-xs font-black' 
                : 'text-ink-muted hover:text-ink font-semibold'
            }`}
          >
            <PackageCheck className="h-4 w-4 text-emerald-500 mb-0.5" />
            <span className="text-[11px] leading-none">1. Empaque</span>
            <span className="text-[9px] text-ink-subtle mt-0.5 tabular font-bold">({pendingPackCount} pend.)</span>
          </button>

          <button
            onClick={() => setActiveTab('dispatch')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
              activeTab === 'dispatch' 
                ? 'bg-card text-ink shadow-xs font-black' 
                : 'text-ink-muted hover:text-ink font-semibold'
            }`}
          >
            <Truck className="h-4 w-4 text-blue-500 mb-0.5" />
            <span className="text-[11px] leading-none">2. Despacho</span>
            <span className="text-[9px] text-ink-subtle mt-0.5 tabular font-bold">({packedCount} listos)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('scanner');
              if (!scanning) startCamera();
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
              activeTab === 'scanner' 
                ? 'bg-card text-ink shadow-xs font-black' 
                : 'text-ink-muted hover:text-ink font-semibold'
            }`}
          >
            <QrCode className="h-4 w-4 text-brand mb-0.5" />
            <span className="text-[11px] leading-none">Lector QR</span>
            <span className="text-[9px] text-ink-subtle mt-0.5 font-bold">Cámara</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all ${
              activeTab === 'history' 
                ? 'bg-card text-ink shadow-xs font-black' 
                : 'text-ink-muted hover:text-ink font-semibold'
            }`}
          >
            <History className="h-4 w-4 text-purple-500 mb-0.5" />
            <span className="text-[11px] leading-none">Auditoría</span>
            <span className="text-[9px] text-ink-subtle mt-0.5 tabular font-bold">({scanLogs.length})</span>
          </button>

        </div>

        {/* ========================================================================= */}
        {/* ETAPA 1: LISTA DE EMPAQUE (PREPARACIÓN Y ARMADO DE PAQUETES) */}
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
                  {totalActiveCount}
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
                <span>Todos ({shipments.length})</span>
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
                    ⏳ Pendientes ({pendingPackCount})
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
                          ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20 opacity-85 hover:opacity-100'
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

                      {/* Ordered Items with BIG HIGH-CONTRAST QUANTITY PILL */}
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
                      <div className="mt-3.5 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={api.downloadLabelUrl(s.id, 'pdf')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm font-bold flex items-center gap-1 px-2.5 py-1.5 text-xs"
                            title="Descargar o imprimir etiqueta de Mercado Envíos"
                          >
                            <Printer className="h-3.5 w-3.5 text-ink-subtle" />
                            <span>PDF</span>
                          </a>

                          <button
                            onClick={() => {
                              const initialChecks = {};
                              (s.items || []).forEach((_, idx) => { initialChecks[idx] = false; });
                              setCheckedItemsMap(initialChecks);
                              setActiveChecklistShipment(s);
                              setChecklistModalOpen(true);
                            }}
                            className="btn btn-outline btn-sm font-bold flex items-center gap-1 px-2.5 py-1.5 text-xs text-brand-ink dark:text-brand"
                            title="Abrir checklist de verificación de ítems"
                          >
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span>Checklist</span>
                          </button>

                          <select
                            value={s.status}
                            onChange={(e) => handleStatusOverride(s.id, e.target.value)}
                            className="select select-sm py-1 px-2 text-[11px] font-bold h-8 border-line"
                            title="Cambiar estado del envío"
                          >
                            <option value="ready_to_ship">Por Despachar</option>
                            <option value="shipped">En Camino</option>
                            <option value="delivered">Entregado</option>
                          </select>
                        </div>

                        {meta.isDelivered ? (
                          <span className="badge badge-success text-xs font-bold gap-1 py-1.5 px-3">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Entregado
                          </span>
                        ) : meta.isShipped ? (
                          <div className="flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
                            <Navigation className="h-3.5 w-3.5" />
                            <span>En camino</span>
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
                                <span>Desmarcar</span>
                              </>
                            ) : (
                              <>
                                <PackageCheck className="h-4 w-4" />
                                <span>Listo Empaque</span>
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
        {/* ETAPA 2: CONTROL DE DESPACHO / SALIDA A TRANSPORTE (HANDOVER) */}
        {/* ========================================================================= */}
        {activeTab === 'dispatch' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            
            {/* Header & Carrier Selector */}
            <div className="card card-pad p-4 space-y-3 bg-gradient-to-br from-card to-blue-50/20 dark:to-blue-950/20 border border-blue-200 dark:border-blue-900/60">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-black text-sm text-ink flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-500" />
                    <span>Control de Salida a Transporte</span>
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Verificá y escaneá cada caja antes de subirla al vehículo del chofer.
                  </p>
                </div>

                <div className="text-right">
                  <span className="badge badge-info text-xs font-black">
                    {dispatchVerifiedCount} / {dispatchStageShipments.length} verificados
                  </span>
                </div>
              </div>

              {/* Carrier Selection Pills */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                <button
                  onClick={() => setDispatchCarrierFilter('all')}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-black transition ${
                    dispatchCarrierFilter === 'all' 
                      ? 'bg-ink text-bg shadow-xs' 
                      : 'bg-muted text-ink-muted hover:bg-muted/80'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setDispatchCarrierFilter('self_service')}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-black transition ${
                    dispatchCarrierFilter === 'self_service' 
                      ? 'bg-amber-400 text-slate-950 shadow-xs' 
                      : 'bg-muted text-ink-muted hover:bg-muted/80'
                  }`}
                >
                  ⚡ Flex
                </button>
                <button
                  onClick={() => setDispatchCarrierFilter('cross_docking')}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-black transition ${
                    dispatchCarrierFilter === 'cross_docking' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-muted text-ink-muted hover:bg-muted/80'
                  }`}
                >
                  🚛 Colecta
                </button>
                <button
                  onClick={() => setDispatchCarrierFilter('drop_off')}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-black transition ${
                    dispatchCarrierFilter === 'drop_off' 
                      ? 'bg-purple-600 text-white shadow-xs' 
                      : 'bg-muted text-ink-muted hover:bg-muted/80'
                  }`}
                >
                  📮 Correo
                </button>
              </div>

              {/* Quick Actions Bar */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-line/60">
                <button
                  onClick={() => {
                    setScannerAction('dispatch');
                    setScannerCarrierFilter(dispatchCarrierFilter);
                    setActiveTab('scanner');
                    if (!scanning) startCamera();
                  }}
                  className="btn btn-primary flex-1 text-xs font-black py-2.5 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Escanear Carga ({dispatchCarrierFilter === 'self_service' ? 'FLEX' : dispatchCarrierFilter === 'cross_docking' ? 'COLECTA' : 'TRANSPORTE'})</span>
                </button>

                <button
                  onClick={() => setManifestModalOpen(true)}
                  className="btn btn-outline text-xs font-bold py-2.5 px-3 flex items-center gap-1.5"
                  title="Ver y descargar manifiesto de entrega para chofer"
                >
                  <FileText className="h-4 w-4 text-ink-subtle" />
                  <span>Manifiesto</span>
                </button>

                <button
                  onClick={() => handleBulkMarkShipped(dispatchStageShipments.filter(s => s.meta.isDispatchChecked || s.meta.isPacked))}
                  className="btn btn-success text-white text-xs font-black py-2.5 px-3 flex items-center gap-1.5 shadow-xs"
                  title="Marcar todos los paquetes verificados como 'En Camino'"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirmar Salida</span>
                </button>
              </div>
            </div>

            {/* List of Shipments in Dispatch Queue */}
            <div className="space-y-2.5">
              {dispatchStageShipments.length > 0 ? (
                dispatchStageShipments.map((s) => {
                  const meta = s.meta;
                  const isChecked = meta.isDispatchChecked;
                  const isPacked = meta.isPacked;

                  return (
                    <div
                      key={s.id}
                      className={`card p-3.5 border-2 transition-all flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
                          : isPacked
                          ? 'border-line bg-card'
                          : 'border-amber-400/50 bg-amber-50/10'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-black text-xs text-ink">
                            Orden #{s.order_id}
                          </span>
                          <span className="text-[10px] font-mono text-ink-subtle">
                            (#{s.id})
                          </span>
                          {meta.isFlex ? (
                            <span className="badge badge-warning text-[9px] font-black">FLEX</span>
                          ) : meta.isColecta ? (
                            <span className="badge badge-info text-[9px] font-black">COLECTA</span>
                          ) : (
                            <span className="badge badge-neutral text-[9px] font-black">CORREO</span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-ink-muted truncate mt-0.5">
                          {s.buyer?.first_name ? `${s.buyer.first_name} ${s.buyer.last_name || ''}` : s.buyer?.nickname || 'Cliente'}
                          {s.receiver_address?.city?.name && ` • ${s.receiver_address.city.name}`}
                        </p>

                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold ${isPacked ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {isPacked ? '✅ Empacado' : '⏳ Falta Empacar'}
                          </span>
                          {isChecked && (
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                              • 🚚 Verificado p/ Chofer
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => handleToggleDispatchCheck(s.id, isChecked)}
                          className={`btn btn-sm px-3 py-2 text-xs font-extrabold flex items-center gap-1.5 ${
                            isChecked
                              ? 'btn-success text-white shadow-xs'
                              : 'btn-outline border-line hover:border-emerald-500'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                          <span>{isChecked ? 'Verificado' : 'Chequear'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="card p-10 text-center text-ink-muted space-y-2">
                  <Truck className="h-8 w-8 mx-auto text-ink-subtle opacity-50" />
                  <p className="text-xs font-bold text-ink">No hay despachos para este transporte</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: ESCÁNER INTELIGENTE ANTI-SPAM Y SELECTOR DE ACCIÓN */}
        {/* ========================================================================= */}
        {activeTab === 'scanner' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            
            {/* Lector de cámara & Selector de Comportamiento */}
            <div className="card card-pad p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
                  <Camera className="h-4 w-4 text-brand" />
                  <span>Lector de Etiquetas y QR</span>
                </span>

                <div className="flex items-center gap-2">
                  {scanCooldown > 0 && (
                    <span className="badge badge-warning text-[10px] font-black animate-pulse">
                      ⏱️ Pausa de lectura ({scanCooldown}s)
                    </span>
                  )}
                  <span className={`badge ${scanning ? 'badge-success' : 'badge-neutral'}`}>
                    <span className={`h-2 w-2 rounded-full ${scanning ? 'bg-success animate-pulse-ring' : 'bg-ink-subtle'}`} aria-hidden="true" />
                    {scanning ? 'Escaneando' : 'En pausa'}
                  </span>
                </div>
              </div>

              {/* ACTION SELECTOR PILLS: "¿Qué hacer al escanear?" */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-subtle block">
                  ¿Qué acción realizar al escanear?
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-muted rounded-2xl border border-line text-xs font-bold">
                  
                  {/* 1. Empaque Directo */}
                  <button
                    onClick={() => setScannerAction('pack_direct')}
                    className={`py-2 px-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                      scannerAction === 'pack_direct' 
                        ? 'bg-amber-400 text-slate-950 shadow-xs font-black' 
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5 fill-current" />
                    <span>⚡ Empaque Directo</span>
                  </button>

                  {/* 2. Control de Ítems / Checklist */}
                  <button
                    onClick={() => setScannerAction('pack_checklist')}
                    className={`py-2 px-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                      scannerAction === 'pack_checklist' 
                        ? 'bg-emerald-500 text-white shadow-xs font-black' 
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>📋 Control Ítems</span>
                  </button>

                  {/* 3. Solo Consulta */}
                  <button
                    onClick={() => setScannerAction('query_only')}
                    className={`py-2 px-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                      scannerAction === 'query_only' 
                        ? 'bg-purple-600 text-white shadow-xs font-black' 
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>🔍 Solo Consulta</span>
                  </button>

                  {/* 4. Control de Despacho */}
                  <button
                    onClick={() => setScannerAction('dispatch')}
                    className={`py-2 px-1.5 rounded-xl flex items-center justify-center gap-1 transition ${
                      scannerAction === 'dispatch' 
                        ? 'bg-blue-600 text-white shadow-xs font-black' 
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>🚚 Despacho Chofer</span>
                  </button>

                </div>
              </div>

              {/* Carrier mismatch guard filter when in dispatch mode */}
              {scannerAction === 'dispatch' && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs">
                  <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-blue-500" />
                    <span>Transporte a cargar:</span>
                  </span>
                  <select
                    value={scannerCarrierFilter}
                    onChange={(e) => setScannerCarrierFilter(e.target.value)}
                    className="select select-sm py-0.5 px-2 text-xs font-extrabold border-blue-300"
                  >
                    <option value="all">🌐 Todos los transportes</option>
                    <option value="self_service">⚡ Chofer Flex</option>
                    <option value="cross_docking">🚛 Camión Colecta</option>
                    <option value="drop_off">📮 Correo / Puntos</option>
                  </select>
                </div>
              )}

              {/* Visor de cámara con Anti-Spam Overlay */}
              <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${scanning ? 'min-h-[260px] border-line bg-ink/90' : 'flex min-h-[140px] items-center justify-center border-dashed border-line-strong bg-muted'}`}>
                <div id="mobile-camera-viewfinder" className="mx-auto w-full max-w-sm"></div>

                {!scanning && (
                  <div className="p-4 text-center">
                    <QrCode className="mx-auto mb-2 h-10 w-10 text-ink-subtle" />
                    <p className="text-sm font-bold text-ink">Cámara en espera</p>
                    <p className="text-[11px] text-ink-subtle">Tocá "Iniciar Escaneo" para enfocar etiquetas</p>
                  </div>
                )}

                {scanning && (
                  <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-center justify-between">
                    <span className="badge badge-solid gap-1.5 backdrop-blur bg-black/75 text-white border-0 text-[10px] font-bold">
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse-ring" aria-hidden="true" />
                      {scannerAction === 'pack_direct' && '⚡ Empaque Directo'}
                      {scannerAction === 'pack_checklist' && '📋 Checklist de Ítems'}
                      {scannerAction === 'query_only' && '🔍 Solo Consulta'}
                      {scannerAction === 'dispatch' && '🚚 Control Despacho'}
                    </span>

                    {scanCooldown > 0 && (
                      <span className="badge badge-warning text-[10px] font-black shadow-md">
                        Enfriamiento {scanCooldown}s
                      </span>
                    )}
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

              {/* Scanner Control Options */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-line/60">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pauseCameraOnScan}
                    onChange={(e) => setPauseCameraOnScan(e.target.checked)}
                    className="check h-4 w-4"
                  />
                  <span className="font-bold text-ink-muted">
                    Pausar cámara tras cada lectura para revisar
                  </span>
                </label>

                {!scanning && lastScanned && (
                  <button
                    onClick={startCamera}
                    className="btn btn-outline btn-sm font-extrabold flex items-center gap-1 text-xs"
                  >
                    <Play className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Siguiente Paquete</span>
                  </button>
                )}
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
                  lastScanned.status === 'CARRIER_MISMATCH'
                    ? 'bg-rose-600 text-white border-rose-700 ring-4 ring-rose-500/50 animate-bounce'
                    : lastScanned.status === 'NEWLY_PACKED' || lastScanned.status === 'DISPATCH_VERIFIED'
                    ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-400/40'
                    : lastScanned.status === 'CHECKLIST_OPEN' || lastScanned.status === 'QUERY_RESULT'
                    ? 'bg-brand/10 border-brand/40 text-ink ring-2 ring-brand/30'
                    : lastScanned.status === 'ALREADY_PACKED' || lastScanned.status === 'ALREADY_DISPATCHED'
                    ? 'bg-amber-500/15 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400/40'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    {lastScanned.status === 'CARRIER_MISMATCH' && (
                      <div className="p-2.5 bg-white text-rose-600 rounded-2xl shadow-md">
                        <AlertOctagon className="w-6 h-6" />
                      </div>
                    )}
                    {(lastScanned.status === 'NEWLY_PACKED' || lastScanned.status === 'DISPATCH_VERIFIED') && (
                      <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-md">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    )}
                    {(lastScanned.status === 'CHECKLIST_OPEN' || lastScanned.status === 'QUERY_RESULT') && (
                      <div className="p-2.5 bg-brand text-brand-ink rounded-2xl shadow-md">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                    )}
                    {(lastScanned.status === 'ALREADY_PACKED' || lastScanned.status === 'ALREADY_DISPATCHED') && (
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
                      <h3 className={`font-extrabold text-sm ${lastScanned.status === 'CARRIER_MISMATCH' ? 'text-white' : 'text-ink'}`}>
                        {lastScanned.status === 'CARRIER_MISMATCH' && '🚨 ¡ERROR CRÍTICO DE TRANSPORTE!'}
                        {lastScanned.status === 'NEWLY_PACKED' && '✅ ¡Nuevo Paquete Empaquetado!'}
                        {lastScanned.status === 'DISPATCH_VERIFIED' && '🚚 ¡Paquete Verificado para Chofer!'}
                        {lastScanned.status === 'CHECKLIST_OPEN' && '📋 Checklist de Verificación Abierto'}
                        {lastScanned.status === 'QUERY_RESULT' && '🔍 Datos del Envío Consultados'}
                        {lastScanned.status === 'ALREADY_PACKED' && '⚠️ ¡ATENCIÓN: PAQUETE YA LEÍDO!'}
                        {lastScanned.status === 'ALREADY_DISPATCHED' && '⚠️ ¡PAQUETE YA VERIFICADO P/ DESPACHO!'}
                        {lastScanned.status === 'NOT_FOUND' && '❌ Código No Encontrado'}
                        {lastScanned.status === 'UNPACKED' && '↩️ Paquete Desmarcado'}
                      </h3>
                      <p className={`text-[11px] flex items-center space-x-1 mt-0.5 ${lastScanned.status === 'CARRIER_MISMATCH' ? 'text-white/90' : 'text-ink-muted'}`}>
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
                    lastScanned.status === 'CARRIER_MISMATCH'
                      ? 'bg-white text-rose-600'
                      : lastScanned.status === 'NEWLY_PACKED' || lastScanned.status === 'DISPATCH_VERIFIED'
                      ? 'bg-emerald-500 text-white'
                      : lastScanned.status === 'CHECKLIST_OPEN' || lastScanned.status === 'QUERY_RESULT'
                      ? 'bg-brand text-brand-ink'
                      : lastScanned.status === 'ALREADY_PACKED' || lastScanned.status === 'ALREADY_DISPATCHED'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}>
                    {lastScanned.status === 'CARRIER_MISMATCH' && 'MISMATCH'}
                    {lastScanned.status === 'NEWLY_PACKED' && 'LISTO OK'}
                    {lastScanned.status === 'DISPATCH_VERIFIED' && 'CARGA OK'}
                    {lastScanned.status === 'CHECKLIST_OPEN' && 'CHECKLIST'}
                    {lastScanned.status === 'QUERY_RESULT' && 'CONSULTA'}
                    {lastScanned.status === 'ALREADY_PACKED' && 'DUPLICADO'}
                    {lastScanned.status === 'ALREADY_DISPATCHED' && 'YA VERIFICADO'}
                    {lastScanned.status === 'NOT_FOUND' && 'NO ENCONTRADO'}
                    {lastScanned.status === 'UNPACKED' && 'PENDIENTE'}
                  </span>
                </div>

                <p className={`text-xs font-bold ${lastScanned.status === 'CARRIER_MISMATCH' ? 'text-white' : 'text-ink'}`}>
                  {lastScanned.message}
                </p>

                {lastScanned.shipment && (
                  <div className="bg-card p-3.5 rounded-2xl border border-line space-y-3 text-ink">
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
        {/* TAB: AUDITORÍA DE ESCANEOS */}
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
                        log.action === 'FIRST_PACK_VERIFIED' || log.action === 'PACK_VERIFIED' || log.action === 'DISPATCH_VERIFIED'
                          ? 'bg-emerald-500 text-white'
                          : log.action === 'DUPLICATE_SCAN' || log.action === 'DISPATCH_DUPLICATE'
                          ? 'bg-amber-500 text-slate-950'
                          : log.action === 'DISPATCH_CARRIER_MISMATCH'
                          ? 'bg-rose-500 text-white'
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
                          {log.action === 'DISPATCH_VERIFIED' && (
                            <span className="badge badge-info text-[9px] font-black">
                              DESPACHO OK
                            </span>
                          )}
                          {(log.action === 'DUPLICATE_SCAN' || log.action === 'DISPATCH_DUPLICATE') && (
                            <span className="badge badge-warning text-[9px] font-black">
                              DUPLICADO (#{log.details?.scanCount || 2})
                            </span>
                          )}
                          {log.action === 'DISPATCH_CARRIER_MISMATCH' && (
                            <span className="badge badge-danger text-[9px] font-black">
                              ERROR TRANSPORTE
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

      {/* ========================================================================= */}
      {/* MODAL: CHECKLIST INTERACTIVO DE EMPAQUE (CONTROL ÍTEM POR ÍTEM) */}
      {/* ========================================================================= */}
      {checklistModalOpen && activeChecklistShipment && (
        <div className="modal-backdrop z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-in fade-in-50">
          <div className="modal-box w-full max-w-lg bg-card border border-line shadow-2xl rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-md">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-ink">
                    Verificación de Contenido
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Orden #{activeChecklistShipment.order_id} • Envío #{activeChecklistShipment.id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setChecklistModalOpen(false)}
                className="btn btn-icon btn-outline h-8 w-8"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Recipient & Destination Info */}
            <div className="p-3 bg-muted/60 rounded-2xl border border-line flex items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block">Destinatario</span>
                <p className="font-extrabold text-ink mt-0.5">
                  {activeChecklistShipment.buyer?.first_name ? `${activeChecklistShipment.buyer.first_name} ${activeChecklistShipment.buyer.last_name || ''}` : activeChecklistShipment.buyer?.nickname}
                </p>
                {activeChecklistShipment.receiver_address?.city?.name && (
                  <p className="text-[11px] text-ink-muted flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-ink-subtle" />
                    {activeChecklistShipment.receiver_address.city.name}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle block">Logística</span>
                <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black mt-0.5 ${activeChecklistShipment.meta?.isFlex ? 'bg-amber-400 text-slate-950' : 'bg-brand/20 text-brand-ink'}`}>
                  {activeChecklistShipment.meta?.logisticLabel || 'MERCADO ENVÍOS'}
                </span>
              </div>
            </div>

            {/* Item checklist instructions */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-1.5">
                <PackageCheck className="h-4 w-4 text-emerald-500" />
                <span>Productos a colocar en la caja:</span>
              </span>

              <button
                onClick={() => {
                  const allChecked = {};
                  (activeChecklistShipment.items || []).forEach((_, idx) => {
                    allChecked[idx] = true;
                  });
                  setCheckedItemsMap(allChecked);
                }}
                className="text-xs font-bold text-brand hover:underline"
              >
                Marcar todos [✓]
              </button>
            </div>

            {/* Interactive Checklist Stream */}
            <div className="space-y-2">
              {(activeChecklistShipment.items || []).map((it, idx) => {
                const isChecked = Boolean(checkedItemsMap[idx]);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setCheckedItemsMap(prev => ({ ...prev, [idx]: !prev[idx] }));
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/30'
                        : 'border-line bg-card hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-1.5 rounded-xl transition ${isChecked ? 'bg-emerald-500 text-white' : 'bg-muted text-ink-muted border border-line'}`}>
                        {isChecked ? <Check className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-extrabold leading-snug line-clamp-2 ${isChecked ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink'}`}>
                          {it.item?.title || 'Producto'}
                        </p>
                        {it.item?.seller_sku ? (
                          <p className="text-[11px] font-mono font-bold text-brand-ink dark:text-brand mt-0.5">
                            SKU: {it.item.seller_sku}
                          </p>
                        ) : (
                          <p className="text-[10px] font-mono text-ink-subtle mt-0.5">
                            Item #{it.item?.id}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center px-3.5 py-2 rounded-xl bg-yellow-400 text-slate-950 font-display font-black text-base shadow-xs text-center shrink-0 border border-yellow-500">
                      <span>x{it.quantity || 1}</span>
                      <span className="text-[8px] uppercase tracking-wider font-extrabold leading-none">CANTIDAD</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Checklist Action Buttons */}
            <div className="pt-3 border-t border-line flex gap-2">
              <button
                onClick={handleConfirmChecklist}
                className="btn btn-primary flex-1 py-3 text-xs font-black flex items-center justify-center gap-2 shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirmar Empaque y Sellar Caja</span>
              </button>

              <button
                onClick={() => setChecklistModalOpen(false)}
                className="btn btn-outline text-xs font-bold px-4 py-3"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANIFIESTO DE ENTREGA Y REMITO PARA CHOFER */}
      {/* ========================================================================= */}
      {manifestModalOpen && (
        <div className="modal-backdrop z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in-50">
          <div className="modal-box w-full max-w-2xl bg-card border border-line shadow-2xl rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display font-black text-base text-ink flex items-center gap-2">
                  <FileText className="h-5 w-5 text-brand" />
                  <span>Manifiesto de Despacho y Entrega a Chofer</span>
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Remito oficial para firma del transporte y constancia de salida de depósito.
                </p>
              </div>

              <button
                onClick={() => setManifestModalOpen(false)}
                className="btn btn-icon btn-outline h-8 w-8"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Transport & Driver metadata inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-muted/60 p-3 rounded-2xl border border-line text-xs">
              <div>
                <label className="font-bold text-ink-subtle block text-[10px] uppercase">Transporte / Servicio</label>
                <p className="font-black text-ink mt-0.5">
                  {dispatchCarrierFilter === 'self_service' ? 'MERCADO ENVÍOS FLEX' : dispatchCarrierFilter === 'cross_docking' ? 'MERCADO ENVÍOS COLECTA' : 'CORREO / GENERAL'}
                </p>
              </div>
              <div>
                <label className="font-bold text-ink-subtle block text-[10px] uppercase">Fecha y Hora</label>
                <p className="font-black text-ink mt-0.5">{new Date().toLocaleDateString('es-AR')} - {currentTime}</p>
              </div>
              <div>
                <label className="font-bold text-ink-subtle block text-[10px] uppercase">Total Paquetes</label>
                <p className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5 text-sm">{dispatchStageShipments.length} bultos</p>
              </div>

              <div className="col-span-2 sm:col-span-3 grid grid-cols-2 gap-2 pt-2 border-t border-line/60">
                <input
                  type="text"
                  placeholder="Nombre y Apellido del Chofer..."
                  value={driverInfo.name}
                  onChange={(e) => setDriverInfo({ ...driverInfo, name: e.target.value })}
                  className="input text-xs py-1.5 h-8 bg-card"
                />
                <input
                  type="text"
                  placeholder="DNI / Patente del vehículo..."
                  value={driverInfo.plate}
                  onChange={(e) => setDriverInfo({ ...driverInfo, plate: e.target.value })}
                  className="input text-xs py-1.5 h-8 bg-card"
                />
              </div>
            </div>

            {/* Packages Table */}
            <div className="border border-line rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-line text-[10px] uppercase text-ink-subtle font-black">
                    <th className="p-2">#</th>
                    <th className="p-2">Orden / Envío</th>
                    <th className="p-2">Comprador y Ciudad</th>
                    <th className="p-2 text-center">Unidades</th>
                    <th className="p-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dispatchStageShipments.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-muted/40">
                      <td className="p-2 font-bold text-ink-muted">{idx + 1}</td>
                      <td className="p-2">
                        <span className="font-black text-ink block">#{s.order_id}</span>
                        <span className="text-[10px] font-mono text-ink-subtle">Envío #{s.id}</span>
                      </td>
                      <td className="p-2">
                        <span className="font-bold text-ink block">{s.buyer?.first_name ? `${s.buyer.first_name} ${s.buyer.last_name || ''}` : s.buyer?.nickname}</span>
                        <span className="text-[10px] text-ink-muted">{s.receiver_address?.city?.name || 'CABA / GBA'}</span>
                      </td>
                      <td className="p-2 text-center font-black">
                        {(s.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0)}
                      </td>
                      <td className="p-2 text-center">
                        {s.meta.isDispatchChecked ? (
                          <span className="badge badge-success text-[9px] font-black">VERIFICADO</span>
                        ) : (
                          <span className="badge badge-neutral text-[9px] font-black">PENDIENTE</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signatures Footer */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line text-center text-xs">
              <div className="p-4 rounded-2xl border border-dashed border-line space-y-6">
                <p className="text-[10px] font-black text-ink-subtle uppercase">Firma y Aclaración del Chofer</p>
                <div className="h-10 border-b border-line-strong"></div>
                <p className="text-[10px] text-ink-muted">{driverInfo.name || 'Firma chofer'} {driverInfo.plate ? `(Pat: ${driverInfo.plate})` : ''}</p>
              </div>

              <div className="p-4 rounded-2xl border border-dashed border-line space-y-6">
                <p className="text-[10px] font-black text-ink-subtle uppercase">Despachado por (Depósito)</p>
                <div className="h-10 border-b border-line-strong"></div>
                <p className="text-[10px] text-ink-muted">@{connection?.nickname || 'Mi tienda'} • Depósito Central</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="btn btn-primary text-xs font-black py-2.5 px-4 flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Manifiesto</span>
              </button>
              <button
                onClick={() => setManifestModalOpen(false)}
                className="btn btn-outline text-xs font-bold py-2.5 px-4"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
