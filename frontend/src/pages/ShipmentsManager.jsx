import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  RefreshCw, 
  FileText, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Printer, 
  ExternalLink,
  PackageCheck,
  ShieldCheck,
  CheckSquare,
  Square,
  ClipboardList,
  Sparkles,
  Tag,
  Check,
  X,
  FileCheck2,
  Calendar,
  QrCode,
  Archive,
  Layers,
  Send,
  Boxes
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

export default function ShipmentsManager({ connection }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('ready_to_ship'); // ready_to_ship, shipped, delivered, all
  const [logisticFilter, setLogisticFilter] = useState('all');
  const [packingFilter, setPackingFilter] = useState('all'); // all, unprinted, printed, packed
  const [selectedShipmentIds, setSelectedShipmentIds] = useState([]);
  const [labelFormat, setLabelFormat] = useState('pdf'); // pdf, zpl
  const [activeNoteModal, setActiveNoteModal] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState(null);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);

  const loadShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusTab !== 'all') {
        params.status = statusTab;
      }
      if (logisticFilter !== 'all') {
        params.logistic_type = logisticFilter;
      }
      if (packingFilter === 'unprinted') {
        params.printed = 'false';
      } else if (packingFilter === 'printed') {
        params.printed = 'true';
      } else if (packingFilter === 'packed') {
        params.packed = 'true';
      }
      if (search) {
        params.q = search;
      }

      const res = await api.getShipments(params);
      setShipments(res.results || []);
    } catch (err) {
      console.error('Error al cargar envíos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, [statusTab, logisticFilter, packingFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadShipments();
  };

  // Toggle checklist items
  const handleToggleChecklist = async (shipment, field) => {
    const currentVal = shipment.packing?.[field];
    const nextVal = !currentVal;

    try {
      await api.updateShipmentPacking(shipment.id, {
        [field]: nextVal,
      });

      setShipments((prev) =>
        prev.map((s) =>
          s.id === shipment.id
            ? { ...s, packing: { ...(s.packing || {}), [field]: nextVal } }
            : s
        )
      );

      if (nextVal && field === 'packed') {
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
      }
    } catch (err) {
      console.error('Error updating checklist:', err);
    }
  };

  const handleSaveNote = async () => {
    if (!activeNoteModal) return;
    try {
      await api.updateShipmentPacking(activeNoteModal.id, {
        note: noteDraft,
      });
      setShipments((prev) =>
        prev.map((s) =>
          s.id === activeNoteModal.id
            ? { ...s, packing: { ...(s.packing || {}), note: noteDraft } }
            : s
        )
      );
      setActiveNoteModal(null);
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedShipmentIds.length === shipments.length) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(shipments.map((s) => s.id));
    }
  };

  const handleToggleSelectItem = (id) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleBulkMarkPacked = async () => {
    if (selectedShipmentIds.length === 0) return;
    try {
      await api.batchShipmentPacking(selectedShipmentIds, {
        packed: true,
        qualityChecked: true,
      });
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
      loadShipments();
    } catch (err) {
      console.error('Error in bulk packing:', err);
    }
  };

  const handleBulkPrintLabels = () => {
    if (selectedShipmentIds.length === 0) return;
    // Open labels for all selected shipments
    selectedShipmentIds.forEach((id) => {
      window.open(api.downloadLabelUrl(id, labelFormat), '_blank');
      api.updateShipmentPacking(id, { printed: true });
    });
    setShipments((prev) =>
      prev.map((s) =>
        selectedShipmentIds.includes(s.id)
          ? { ...s, packing: { ...(s.packing || {}), printed: true } }
          : s
      )
    );
  };

  const handleShipmentPackedByScanner = (shipmentId) => {
    setShipments((prev) =>
      prev.map((s) =>
        String(s.id) === String(shipmentId)
          ? { ...s, packing: { ...(s.packing || {}), packed: true, printed: true, qualityChecked: true } }
          : s
      )
    );
  };

  const getLogisticBadge = (type) => {
    switch (type) {
      case 'self_service':
        return { label: '⚡ FLEX (En el día)', bg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' };
      case 'cross_docking':
        return { label: '🚚 Colecta ML', bg: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800' };
      case 'fulfillment':
        return { label: '⚡ FULL (Depósito)', bg: 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800' };
      case 'drop_off':
        return { label: '📮 Correo / Sucursal', bg: 'bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800' };
      default:
        return { label: 'Mercado Envíos', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = shipments.filter(s => s.status === 'ready_to_ship' && !s.packing?.packed).length;
  const packedCount = shipments.filter(s => s.packing?.packed).length;

  return (
    <div className="space-y-6">
      
      {/* Barcode & QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        shipments={shipments}
        onShipmentPacked={handleShipmentPackedByScanner}
      />

      {/* Header and Print Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Mesa de Empaque & Logística</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950 text-xs font-black shadow-xs">
              {shipments.length} paquetes
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Pendientes por empaquetar: <strong className="text-amber-600 dark:text-amber-400 font-black">{pendingCount}</strong></span>
            <span>•</span>
            <span>Listos / Empaquetados: <strong className="text-emerald-600 dark:text-emerald-400 font-black">{packedCount}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          
          {/* QR Scanner Trigger Button */}
          <button
            onClick={() => setScannerOpen(true)}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-2 shadow-md transition"
          >
            <QrCode className="w-4 h-4" />
            <span>Escanear QR / Barra</span>
          </button>

          {/* Format selector */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs font-bold shadow-xs">
            <button
              onClick={() => setLabelFormat('pdf')}
              className={`px-2.5 py-1 rounded-lg transition ${
                labelFormat === 'pdf' ? 'bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950' : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Etiqueta PDF para hojas A4 o estándar"
            >
              PDF
            </button>
            <button
              onClick={() => setLabelFormat('zpl')}
              className={`px-2.5 py-1 rounded-lg transition ${
                labelFormat === 'zpl' ? 'bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950' : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Formato Térmico ZPL para impresoras Zebra de 10x15cm"
            >
              ZPL Térmica
            </button>
          </div>

          {/* Manifiesto / Hoja de ruta */}
          <button
            onClick={() => setManifestModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
            title="Generar manifiesto de entrega para chofer"
          >
            <FileCheck2 className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Manifiesto de Despacho</span>
          </button>

          <button
            onClick={loadShipments}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-500' : ''}`} />
            <span>Recargar</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Bulk Toolbar for Packing & Labels */}
      {selectedShipmentIds.length > 0 && (
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center space-x-2 text-xs">
            <CheckSquare className="w-4 h-4 text-yellow-400" />
            <span className="font-bold">{selectedShipmentIds.length} envíos seleccionados</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkPrintLabels}
              className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir {selectedShipmentIds.length} Etiquetas</span>
            </button>

            <button
              onClick={handleBulkMarkPacked}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Marcar Empaquetados</span>
            </button>

            <button
              onClick={() => setSelectedShipmentIds([])}
              className="p-1.5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Status Tabs (Separación clara de Operativos vs Entregados/Archivados) */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-4 sm:space-x-8 overflow-x-auto">
        <button
          onClick={() => setStatusTab('ready_to_ship')}
          className={`pb-3 text-xs md:text-sm font-bold whitespace-nowrap transition flex items-center space-x-2 ${
            statusTab === 'ready_to_ship'
              ? 'text-slate-900 dark:text-yellow-400 border-b-2 border-yellow-400 -mb-[2px] font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Por Despachar (Mesa de Empaque)</span>
        </button>

        <button
          onClick={() => setStatusTab('shipped')}
          className={`pb-3 text-xs md:text-sm font-bold whitespace-nowrap transition flex items-center space-x-2 ${
            statusTab === 'shipped'
              ? 'text-slate-900 dark:text-yellow-400 border-b-2 border-yellow-400 -mb-[2px] font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>En Camino / Despachados</span>
        </button>

        <button
          onClick={() => setStatusTab('delivered')}
          className={`pb-3 text-xs md:text-sm font-bold whitespace-nowrap transition flex items-center space-x-2 ${
            statusTab === 'delivered'
              ? 'text-slate-900 dark:text-yellow-400 border-b-2 border-yellow-400 -mb-[2px] font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Archive className="w-4 h-4 text-emerald-500" />
          <span>Entregados & Archivados</span>
        </button>

        <button
          onClick={() => setStatusTab('all')}
          className={`pb-3 text-xs md:text-sm font-bold whitespace-nowrap transition flex items-center space-x-2 ${
            statusTab === 'all'
              ? 'text-slate-900 dark:text-yellow-400 border-b-2 border-yellow-400 -mb-[2px] font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Historial Completo</span>
        </button>
      </div>

      {/* Secondary Packing & Logistics Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por N° Tracking, Orden #, Comprador o Producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        </form>

        {/* Filter by Packing State (Only relevant for ready_to_ship) */}
        {statusTab === 'ready_to_ship' && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'unprinted', label: 'Sin Imprimir' },
              { id: 'printed', label: 'Impresos' },
              { id: 'packed', label: 'Empaquetados' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPackingFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  packingFilter === tab.id
                    ? 'bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950 font-extrabold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Logistic Type Selector */}
        <select
          value={logisticFilter}
          onChange={(e) => setLogisticFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-yellow-400"
        >
          <option value="all">Todas las Modalidades</option>
          <option value="self_service">FLEX (En el día)</option>
          <option value="cross_docking">Colecta</option>
          <option value="fulfillment">FULL</option>
          <option value="drop_off">Correo Tradicional</option>
        </select>

      </div>

      {/* Select All Checkbox Header */}
      {shipments.length > 0 && statusTab === 'ready_to_ship' && (
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 px-2">
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center space-x-1.5 font-bold hover:text-slate-900 dark:hover:text-white"
          >
            {selectedShipmentIds.length === shipments.length && shipments.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-yellow-500" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>Seleccionar todos ({shipments.length})</span>
          </button>
        </div>
      )}

      {/* Shipments Cards with Packing Checklist */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 shadow-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />
            <p className="text-xs">Consultando envíos y logística de Mercado Libre...</p>
          </div>
        ) : shipments.length > 0 ? (
          shipments.map((shipment) => {
            const logistic = getLogisticBadge(shipment.logistic_type);
            const packing = shipment.packing || {};
            const itemsList = shipment.items || [];
            const isSelected = selectedShipmentIds.includes(shipment.id);
            const isDelivered = shipment.status === 'delivered';

            return (
              <div
                key={shipment.id}
                className={`group bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-4 sm:p-5 transition-all duration-200 hover:shadow-md ${
                  isDelivered
                    ? 'border-slate-200 dark:border-slate-800 opacity-85'
                    : packing.packed
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/25 dark:bg-emerald-950/15'
                    : packing.printed
                    ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50/15 dark:bg-blue-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                } ${isSelected ? 'ring-2 ring-yellow-400 border-transparent' : ''}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Checkbox + Package Details */}
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    {!isDelivered && (
                      <button
                        onClick={() => handleToggleSelectItem(shipment.id)}
                        className="mt-1 p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                        title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    <div className="min-w-0 flex-1 space-y-2">
                      
                      {/* Top Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          Orden #{shipment.order_id}
                        </span>
                        
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${logistic.bg}`}>
                          {logistic.label}
                        </span>

                        {isDelivered ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ENTREGADO AL COMPRADOR</span>
                          </span>
                        ) : (
                          <>
                            {/* Scanning Confirmation */}
                            {packing.packed ? (
                              <span className="text-[11px] font-black px-3 py-1 rounded-xl bg-emerald-500 text-white shadow-xs flex items-center space-x-1.5 animate-in zoom-in-95">
                                <QrCode className="w-3.5 h-3.5" />
                                <span>LEÍDO POR LECTOR QR • LISTO</span>
                                {packing.packedAt && (
                                  <span className="opacity-90 font-mono text-[10px] pl-1 border-l border-emerald-400">
                                    {new Date(packing.packedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Pendiente Escaneo</span>
                              </span>
                            )}

                            {/* Printed Status Tag */}
                            {packing.printed ? (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center space-x-1">
                                <Printer className="w-3 h-3 inline" />
                                <span>Etiqueta Impresa</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                Sin Imprimir
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Products list with enhanced quantity emphasis */}
                      <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        {itemsList.map((it, idx) => (
                          <div key={idx} className="flex items-start space-x-2 text-xs">
                            <span className="px-2 py-0.5 rounded-md bg-yellow-400 text-slate-950 font-black text-[11px] shrink-0">
                              {it.quantity}x
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-slate-900 dark:text-white font-bold">
                                {it.item?.title || 'Producto'}
                              </span>
                              {it.item?.seller_sku && (
                                <span className="ml-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                  SKU: {it.item.seller_sku}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Recipient, Tracking & Address */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="flex items-center space-x-1">
                          <span>Comprador:</span>
                          <strong className="text-slate-800 dark:text-slate-200">
                            {shipment.buyer?.first_name ? `${shipment.buyer.first_name} ${shipment.buyer.last_name || ''}` : shipment.buyer?.nickname}
                          </strong>
                        </span>

                        {shipment.tracking_number && (
                          <>
                            <span>•</span>
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 font-semibold">
                              Guía: {shipment.tracking_number}
                            </span>
                          </>
                        )}

                        <span>•</span>
                        <span>Venta: {formatDate(shipment.order_date)}</span>

                        {shipment.receiver_address?.street_name && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-400 truncate">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {shipment.receiver_address.street_name} {shipment.receiver_address.street_number || ''} ({shipment.receiver_address.city?.name || ''})
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Packing Internal Note */}
                      {packing.note && (
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-semibold">
                          <Tag className="w-3 h-3 text-amber-600" />
                          <span>Nota: {packing.note}</span>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Right: Operational Actions & Print Button */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                    
                    {!isDelivered ? (
                      <>
                        {/* Control Quality & Packing Buttons */}
                        <div className="flex items-center space-x-1.5">
                          
                          {/* Quality check toggle */}
                          <button
                            onClick={() => handleToggleChecklist(shipment, 'qualityChecked')}
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center space-x-1.5 transition ${
                              packing.qualityChecked
                                ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                            title="Verificación visual del producto y embalaje"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{packing.qualityChecked ? 'Calidad OK' : 'Control Calidad'}</span>
                          </button>

                          {/* Packed toggle */}
                          <button
                            onClick={() => handleToggleChecklist(shipment, 'packed')}
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center space-x-1.5 transition ${
                              packing.packed
                                ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                            title="Marcar paquete como sellado y empaquetado"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>{packing.packed ? 'Empaquetado' : 'Marcar Empaque'}</span>
                          </button>

                          {/* Add note */}
                          <button
                            onClick={() => {
                              setActiveNoteModal(shipment);
                              setNoteDraft(packing.note || '');
                            }}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                            title="Agregar nota interna al paquete"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Print Label Action Button */}
                        <a
                          href={api.downloadLabelUrl(shipment.id, labelFormat)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            api.updateShipmentPacking(shipment.id, { printed: true });
                            setShipments((prev) =>
                              prev.map((s) =>
                                s.id === shipment.id
                                  ? { ...s, packing: { ...(s.packing || {}), printed: true } }
                                  : s
                              )
                            );
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs transition flex items-center justify-center space-x-2 shadow-xs"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Imprimir Etiqueta ({labelFormat.toUpperCase()})</span>
                        </a>
                      </>
                    ) : (
                      <div className="text-right py-2">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                          Envío entregado y archivado
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 shadow-sm">
            <PackageCheck className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-500" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No hay envíos en esta sección</h3>
            <p className="text-xs mt-1">Todos los paquetes están al día con los filtros seleccionados.</p>
          </div>
        )}
      </div>

      {/* Manifest Modal */}
      {manifestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-yellow-500" />
                <span>Manifiesto de Despacho & Hoja de Ruta</span>
              </h3>
              <button onClick={() => setManifestModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white">Vendedor: @GRANA3DOK</p>
                  <p className="text-slate-500 text-[11px]">Fecha: {new Date().toLocaleDateString('es-AR')}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-yellow-400 text-slate-950 font-black text-xs">
                    {shipments.length} Bultos
                  </span>
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-400">
                    <th className="py-2">Orden #</th>
                    <th className="py-2">Destinatario</th>
                    <th className="py-2">Tipo</th>
                    <th className="py-2">Productos</th>
                    <th className="py-2 text-right">Firma Chofer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {shipments.map((s) => (
                    <tr key={s.id} className="py-2">
                      <td className="py-2 font-mono font-bold">#{s.order_id}</td>
                      <td className="py-2">{s.buyer?.first_name || s.buyer?.nickname}</td>
                      <td className="py-2 uppercase font-bold text-[10px]">{s.logistic_type}</td>
                      <td className="py-2 truncate max-w-[160px]">
                        {s.items?.map(it => `${it.quantity}x ${it.item?.title}`).join(', ')}
                      </td>
                      <td className="py-2 text-right text-slate-300">__________</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
              <button
                onClick={() => setManifestModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Manifiesto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {activeNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                <Tag className="w-4 h-4 text-yellow-500" />
                <span>Nota de Empaque - Orden #{activeNoteModal.order_id}</span>
              </h3>
              <button onClick={() => setActiveNoteModal(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-500 dark:text-slate-400">
                Agrega una observación interna para este paquete (ej: "Frágil", "Incluye factura A", "Talle verificado"):
              </p>
              <textarea
                rows={3}
                placeholder="Escribe tu nota aquí..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setActiveNoteModal(null)}
                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-xs shadow-xs"
              >
                Guardar Nota
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
