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
  QrCode
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

  const handleShipmentPackedByScanner = (shipmentId) => {
    setShipments((prev) =>
      prev.map((s) =>
        String(s.id) === String(shipmentId)
          ? { ...s, packing: { ...(s.packing || {}), packed: true, printed: true, qualityChecked: true } }
          : s
      )
    );
  };

  const handlePrintManifest = () => {
    window.print();
  };

  const getLogisticBadge = (type) => {
    switch (type) {
      case 'self_service':
        return { label: '🚀 FLEX (En el día)', bg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' };
      case 'cross_docking':
        return { label: '📦 Colecta ML', bg: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800' };
      case 'fulfillment':
        return { label: '⚡ FULL (Depósito)', bg: 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800' };
      case 'drop_off':
        return { label: '🏢 Correo / Sucursal', bg: 'bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800' };
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Mesa de Empaque & Logística</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-bold">
              {shipments.length} paquetes
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Escáner QR, control de calidad, etiquetas impresas y checklist de embalaje.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          
          {/* QR Scanner Trigger Button */}
          <button
            onClick={() => setScannerOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-2 shadow-md transition"
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
              title="Etiqueta PDF para hojas A4 o 10x15"
            >
              PDF
            </button>
            <button
              onClick={() => setLabelFormat('zpl')}
              className={`px-2.5 py-1 rounded-lg transition ${
                labelFormat === 'zpl' ? 'bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950' : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Formato Térmico ZPL para Zebra / Xprinter"
            >
              ZPL Térmico
            </button>
          </div>

          {/* Manifiesto / Hoja de ruta */}
          <button
            onClick={handlePrintManifest}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
            title="Imprimir hoja de ruta para chofer de Flex/Colecta"
          >
            <FileCheck2 className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Hoja de Ruta</span>
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

      {/* Bulk Toolbar for Packing */}
      {selectedShipmentIds.length > 0 && (
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-3 sm:p-4 rounded-2xl shadow-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center space-x-2 text-xs">
            <CheckSquare className="w-4 h-4 text-yellow-400" />
            <span className="font-bold">{selectedShipmentIds.length} envíos seleccionados</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkMarkPacked}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Marcar Empaquetados & Listos</span>
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

      {/* Primary Status Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-6 overflow-x-auto">
        {[
          { id: 'ready_to_ship', label: 'Por Despachar (En Mesa de Empaque)' },
          { id: 'shipped', label: 'En Camino / En Tránsito' },
          { id: 'delivered', label: 'Entregados con Éxito' },
          { id: 'all', label: 'Todos los Envíos' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={`pb-3 text-xs md:text-sm font-bold whitespace-nowrap transition relative ${
              statusTab === tab.id
                ? 'text-slate-900 dark:text-yellow-400 border-b-2 border-yellow-400 -mb-[2px]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
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

        {/* Filter by Packing State */}
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
      {shipments.length > 0 && (
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

            return (
              <div
                key={shipment.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-5 hover:border-slate-300 dark:hover:border-slate-700 transition ${
                  packing.packed
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : packing.printed
                    ? 'border-blue-200 dark:border-blue-900/60 bg-blue-50/10 dark:bg-blue-950/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                } ${isSelected ? 'ring-2 ring-yellow-400' : ''}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Checkbox + Package Details */}
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    <button
                      onClick={() => handleToggleSelectItem(shipment.id)}
                      className="mt-1 p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Orden #{shipment.order_id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${logistic.bg}`}>
                          {logistic.label}
                        </span>

                        {/* Printed Status Tag */}
                        {packing.printed ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center space-x-1">
                            <Printer className="w-3 h-3 inline" />
                            <span>Etiqueta Impresa</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Pendiente Imprimir
                          </span>
                        )}

                        {/* Packed Status Tag */}
                        {packing.packed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 inline" />
                            <span>Empaquetado & Listo</span>
                          </span>
                        )}
                      </div>

                      {/* Items title */}
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-1.5 line-clamp-1">
                        {itemsList.map((it) => `${it.quantity}x ${it.item?.title || 'Producto'}`).join(' + ')}
                      </p>

                      {/* Recipient & Tracking */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Comprador: <b className="text-slate-800 dark:text-slate-200">{shipment.buyer?.first_name ? `${shipment.buyer.first_name} ${shipment.buyer.last_name || ''}` : shipment.buyer?.nickname}</b></span>
                        {shipment.tracking_number && (
                          <>
                            <span>•</span>
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200 font-bold">
                              Tracking: {shipment.tracking_number}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>Fecha: {formatDate(shipment.order_date)}</span>
                      </div>

                      {/* Address */}
                      {shipment.receiver_address && (
                        <div className="mt-1.5 flex items-center space-x-1 text-[11px] text-slate-600 dark:text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {shipment.receiver_address.street_name} {shipment.receiver_address.street_number},{' '}
                            {shipment.receiver_address.city?.name || ''}, {shipment.receiver_address.state?.name || ''}
                          </span>
                        </div>
                      )}

                      {/* Packing Internal Note */}
                      {packing.note && (
                        <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-semibold">
                          <Tag className="w-3 h-3 text-amber-600" />
                          <span>Nota: {packing.note}</span>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Right: Operational Checklist & Label Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                    
                    {/* Checklist buttons */}
                    <div className="flex items-center space-x-2 text-xs">
                      
                      {/* Quality check toggle */}
                      <button
                        onClick={() => handleToggleChecklist(shipment, 'qualityChecked')}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center space-x-1 transition ${
                          packing.qualityChecked
                            ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                        title="Control de calidad del producto"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{packing.qualityChecked ? 'Calidad OK' : 'Control Calidad'}</span>
                      </button>

                      {/* Packed toggle */}
                      <button
                        onClick={() => handleToggleChecklist(shipment, 'packed')}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center space-x-1 transition ${
                          packing.packed
                            ? 'bg-emerald-500 border-emerald-600 text-white'
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
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Agregar nota de empaque"
                      >
                        <Tag className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Print Label Action */}
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
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
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs transition flex items-center justify-center space-x-2 shadow-xs"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir Etiqueta ({labelFormat.toUpperCase()})</span>
                      </a>
                    </div>

                  </div>

                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 shadow-sm">
            <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
            <p className="text-xs">No hay envíos que coincidan con los filtros de empaque seleccionados.</p>
          </div>
        )}
      </div>

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
