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
        return { label: '⚡ FLEX (En el día)', bg: 'badge-brand' };
      case 'cross_docking':
        return { label: '🚚 Colecta ML', bg: 'badge-warning' };
      case 'fulfillment':
        return { label: '⚡ FULL (Depósito)', bg: 'badge-info' };
      case 'drop_off':
        return { label: '📮 Correo / Sucursal', bg: 'badge-neutral' };
      default:
        return { label: 'Mercado Envíos', bg: 'badge-neutral' };
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
    <div className="page">

      {/* Barcode & QR Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        shipments={shipments}
        onShipmentPacked={handleShipmentPackedByScanner}
      />

      {/* Header and Print Actions */}
      <div className="page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title">Mesa de Empaque & Logística</h1>
            <span className="badge badge-neutral tabular">{shipments.length} paquetes</span>
          </div>
          <p className="page-sub">
            Pendientes por empaquetar:{' '}
            <strong className="tabular font-extrabold text-warning">{pendingCount}</strong>
            <span className="mx-2 text-ink-subtle">·</span>
            Listos / Empaquetados:{' '}
            <strong className="tabular font-extrabold text-success">{packedCount}</strong>
          </p>
        </div>

        <div className="toolbar">
          {/* QR Scanner Trigger Button */}
          <button
            onClick={() => setScannerOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <QrCode className="h-4 w-4" />
            <span>Escanear QR / Barra</span>
          </button>

          {/* Format selector */}
          <div className="segmented">
            <button
              onClick={() => setLabelFormat('pdf')}
              className={`segmented-btn ${labelFormat === 'pdf' ? 'segmented-btn-active' : ''}`}
              title="Etiqueta PDF para hojas A4 o estándar"
            >
              PDF
            </button>
            <button
              onClick={() => setLabelFormat('zpl')}
              className={`segmented-btn ${labelFormat === 'zpl' ? 'segmented-btn-active' : ''}`}
              title="Formato Térmico ZPL para impresoras Zebra de 10x15cm"
            >
              ZPL Térmica
            </button>
          </div>

          {/* Manifiesto / Hoja de ruta */}
          <button
            onClick={() => setManifestModalOpen(true)}
            className="btn btn-outline btn-sm"
            title="Generar manifiesto de entrega para chofer"
          >
            <FileCheck2 className="h-4 w-4" />
            <span className="hidden sm:inline">Manifiesto de Despacho</span>
          </button>

          <button
            onClick={loadShipments}
            className="btn btn-outline btn-sm"
            title="Recargar el listado de envíos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Recargar</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs font-semibold text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bulk Toolbar for Packing & Labels */}
      {selectedShipmentIds.length > 0 && (
        <div className="card animate-fade-in">
          <div className="card-head">
            <div className="card-title">
              <CheckSquare className="h-4 w-4 text-accent" />
              <span className="tabular">{selectedShipmentIds.length} envíos seleccionados</span>
            </div>
            <button
              onClick={() => setSelectedShipmentIds([])}
              className="btn btn-icon-sm btn-ghost"
              title="Limpiar selección"
              aria-label="Limpiar selección"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="card-body flex flex-col gap-2 py-3.5 sm:flex-row sm:justify-end">
            <button
              onClick={handleBulkPrintLabels}
              className="btn btn-outline btn-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir {selectedShipmentIds.length} Etiquetas</span>
            </button>

            <button
              onClick={handleBulkMarkPacked}
              className="btn btn-success btn-sm"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              <span>Marcar Empaquetados</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Status Tabs (Separación clara de Operativos vs Entregados/Archivados) */}
      <div className="card p-1.5">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setStatusTab('ready_to_ship')}
            className={`btn btn-sm whitespace-nowrap ${
              statusTab === 'ready_to_ship' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Por Despachar (Mesa de Empaque)</span>
          </button>

          <button
            onClick={() => setStatusTab('shipped')}
            className={`btn btn-sm whitespace-nowrap ${
              statusTab === 'shipped' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>En Camino / Despachados</span>
          </button>

          <button
            onClick={() => setStatusTab('delivered')}
            className={`btn btn-sm whitespace-nowrap ${
              statusTab === 'delivered' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            <Archive className="h-4 w-4" />
            <span>Entregados & Archivados</span>
          </button>

          <button
            onClick={() => setStatusTab('all')}
            className={`btn btn-sm whitespace-nowrap ${
              statusTab === 'all' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Historial Completo</span>
          </button>
        </div>
      </div>

      {/* Secondary Packing & Logistics Filters */}
      <div className="card">
        <div className="card-body flex flex-col gap-3 md:flex-row md:items-center">

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              placeholder="Buscar por N° Tracking, Orden #, Comprador o Producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-search"
            />
          </form>

          {/* Filter by Packing State (Only relevant for ready_to_ship) */}
          {statusTab === 'ready_to_ship' && (
            <div className="segmented no-scrollbar shrink-0 overflow-x-auto">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'unprinted', label: 'Sin Imprimir' },
                { id: 'printed', label: 'Impresos' },
                { id: 'packed', label: 'Empaquetados' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPackingFilter(tab.id)}
                  className={`segmented-btn whitespace-nowrap ${
                    packingFilter === tab.id ? 'segmented-btn-active' : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Logistic Type Selector */}
          <div className="shrink-0 md:w-56">
            <select
              value={logisticFilter}
              onChange={(e) => setLogisticFilter(e.target.value)}
              className="select w-full"
              title="Filtrar por modalidad logística"
            >
              <option value="all">Todas las Modalidades</option>
              <option value="self_service">FLEX (En el día)</option>
              <option value="cross_docking">Colecta</option>
              <option value="fulfillment">FULL</option>
              <option value="drop_off">Correo Tradicional</option>
            </select>
          </div>

        </div>
      </div>

      {/* Select All Checkbox Header */}
      {shipments.length > 0 && statusTab === 'ready_to_ship' && (
        <div className="flex items-center gap-2 px-1">
          <button
            onClick={handleToggleSelectAll}
            className="chip transition hover:border-line-strong hover:text-ink"
          >
            {selectedShipmentIds.length === shipments.length && shipments.length > 0 ? (
              <CheckSquare className="h-4 w-4 text-accent" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span className="tabular">Seleccionar todos ({shipments.length})</span>
          </button>
        </div>
      )}

      {/* Shipments Cards with Packing Checklist */}
      <div className="space-y-3">
        {loading ? (
          <div className="card">
            <div className="card-body space-y-4">
              <p className="help">Consultando envíos y logística de Mercado Libre…</p>
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-start gap-3">
                  <div className="skeleton h-8 w-8 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-4 w-40" />
                    <div className="skeleton h-3 w-full max-w-md" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                  <div className="skeleton hidden h-9 w-44 rounded-xl sm:block" />
                </div>
              ))}
            </div>
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
                className={`card card-hover overflow-hidden p-4 sm:p-5 ${
                  isDelivered ? 'opacity-90' : ''
                } ${isSelected ? 'ring-2 ring-brand' : ''}`}
              >
                {/* Status rail */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${
                    isDelivered
                      ? 'bg-line'
                      : packing.packed
                      ? 'bg-success'
                      : packing.printed
                      ? 'bg-accent'
                      : 'bg-warning/60'
                  }`}
                />

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                  {/* Left: Checkbox + Package Details */}
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    {!isDelivered && (
                      <button
                        onClick={() => handleToggleSelectItem(shipment.id)}
                        className={`btn btn-icon-sm mt-0.5 shrink-0 ${
                          isSelected ? 'btn-soft text-ink' : 'btn-ghost'
                        }`}
                        title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                        aria-label={isSelected ? 'Deseleccionar envío' : 'Seleccionar envío'}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    )}

                    <div className="min-w-0 flex-1 space-y-2.5">

                      {/* Top Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-extrabold tracking-tight text-ink sm:text-base">
                          Orden #{shipment.order_id}
                        </span>

                        <span className={`badge ${logistic.bg}`}>
                          {logistic.label}
                        </span>

                        {isDelivered ? (
                          <span className="badge badge-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Entregado al comprador</span>
                          </span>
                        ) : (
                          <>
                            {/* Scanning Confirmation */}
                            {packing.packed ? (
                              <span className="inline-flex animate-pop items-center gap-1.5 rounded-xl border border-success/30 bg-success-soft px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-success">
                                <QrCode className="h-3.5 w-3.5" />
                                <span>Leído por lector QR • Listo</span>
                                {packing.packedAt && (
                                  <span className="tabular border-l border-success/30 pl-1.5 font-mono text-[10px] opacity-90">
                                    {new Date(packing.packedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="badge badge-warning">
                                <Clock className="h-3 w-3" />
                                <span>Pendiente Escaneo</span>
                              </span>
                            )}

                            {/* Printed Status Tag */}
                            {packing.printed ? (
                              <span className="badge badge-info">
                                <Printer className="h-3 w-3" />
                                <span>Etiqueta Impresa</span>
                              </span>
                            ) : (
                              <span className="badge badge-danger">
                                Sin Imprimir
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Products list with enhanced quantity emphasis */}
                      <div className="space-y-1.5 rounded-xl border border-line bg-muted/60 p-2.5 sm:p-3">
                        {itemsList.map((it, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <span className="badge badge-solid tabular shrink-0">
                              {it.quantity}x
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold break-words text-ink">
                                {it.item?.title || 'Producto'}
                              </span>
                              {it.item?.seller_sku && (
                                <span className="kbd ml-2">
                                  SKU: {it.item.seller_sku}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Recipient, Tracking & Address */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                        <span className="flex items-center gap-1">
                          <span>Comprador:</span>
                          <strong className="text-ink">
                            {shipment.buyer?.first_name ? `${shipment.buyer.first_name} ${shipment.buyer.last_name || ''}` : shipment.buyer?.nickname}
                          </strong>
                        </span>

                        {shipment.tracking_number && (
                          <>
                            <span className="text-ink-subtle">•</span>
                            <span className="chip font-mono tabular">
                              Guía: {shipment.tracking_number}
                            </span>
                          </>
                        )}

                        <span className="text-ink-subtle">•</span>
                        <span className="tabular">Venta: {formatDate(shipment.order_date)}</span>

                        {shipment.receiver_address?.street_name && (
                          <>
                            <span className="text-ink-subtle">•</span>
                            <span className="flex min-w-0 items-center gap-1 text-ink-muted">
                              <MapPin className="h-3 w-3 shrink-0 text-ink-subtle" />
                              <span className="truncate">
                                {shipment.receiver_address.street_name} {shipment.receiver_address.street_number || ''} ({shipment.receiver_address.city?.name || ''})
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Packing Internal Note */}
                      {packing.note && (
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                          <Tag className="h-3 w-3" />
                          <span>Nota: {packing.note}</span>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Right: Operational Actions & Print Button */}
                  <div className="flex shrink-0 flex-col gap-2.5 border-t border-line pt-3 lg:items-end lg:border-t-0 lg:pt-0">

                    {!isDelivered ? (
                      <>
                        {/* Control Quality & Packing Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">

                          {/* Quality check toggle */}
                          <button
                            onClick={() => handleToggleChecklist(shipment, 'qualityChecked')}
                            className={`btn btn-sm ${
                              packing.qualityChecked
                                ? 'border border-success/30 bg-success-soft text-success hover:border-success/60'
                                : 'btn-outline'
                            }`}
                            title="Verificación visual del producto y embalaje"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>{packing.qualityChecked ? 'Calidad OK' : 'Control Calidad'}</span>
                          </button>

                          {/* Packed toggle */}
                          <button
                            onClick={() => handleToggleChecklist(shipment, 'packed')}
                            className={`btn btn-sm ${packing.packed ? 'btn-success' : 'btn-outline'}`}
                            title="Marcar paquete como sellado y empaquetado"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            <span>{packing.packed ? 'Empaquetado' : 'Marcar Empaque'}</span>
                          </button>

                          {/* Add note */}
                          <button
                            onClick={() => {
                              setActiveNoteModal(shipment);
                              setNoteDraft(packing.note || '');
                            }}
                            className="btn btn-icon-sm btn-outline"
                            title="Agregar nota interna al paquete"
                            aria-label="Agregar nota interna al paquete"
                          >
                            <Tag className="h-3.5 w-3.5" />
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
                          className="btn btn-primary btn-sm w-full lg:w-auto"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Imprimir Etiqueta ({labelFormat.toUpperCase()})</span>
                        </a>
                      </>
                    ) : (
                      <div className="py-2 lg:text-right">
                        <span className="help font-bold">
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
          <div className="card">
            <div className="empty">
              <div className="empty-icon">
                <PackageCheck className="h-6 w-6" />
              </div>
              <h3 className="empty-title">No hay envíos en esta sección</h3>
              <p className="empty-text">Todos los paquetes están al día con los filtros seleccionados.</p>
            </div>
          </div>
        )}
      </div>

      {/* Manifest Modal */}
      {manifestModalOpen && (
        <div className="overlay">
          <div className="modal modal-lg">
            <div className="modal-head">
              <div>
                <h3 className="modal-title flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-accent" />
                  <span>Manifiesto de Despacho & Hoja de Ruta</span>
                </h3>
                <p className="modal-sub">Documento de entrega para el chofer</p>
              </div>
              <button
                onClick={() => setManifestModalOpen(false)}
                className="modal-close"
                title="Cerrar manifiesto"
                aria-label="Cerrar manifiesto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="modal-body text-xs">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-muted/60 p-3.5">
                <div>
                  <p className="text-xs font-extrabold text-ink">Vendedor: @GRANA3DOK</p>
                  <p className="tabular text-[11px] text-ink-muted">Fecha: {new Date().toLocaleDateString('es-AR')}</p>
                </div>
                <div className="text-right">
                  <span className="badge badge-brand tabular">
                    {shipments.length} Bultos
                  </span>
                </div>
              </div>

              <div className="table-wrap">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr>
                      <th className="th">Orden #</th>
                      <th className="th">Destinatario</th>
                      <th className="th">Tipo</th>
                      <th className="th">Productos</th>
                      <th className="th text-right">Firma Chofer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s) => (
                      <tr key={s.id}>
                        <td className="td td-strong font-mono tabular">#{s.order_id}</td>
                        <td className="td">{s.buyer?.first_name || s.buyer?.nickname}</td>
                        <td className="td text-[10px] font-bold uppercase">{s.logistic_type}</td>
                        <td className="td max-w-[160px] truncate">
                          {s.items?.map(it => `${it.quantity}x ${it.item?.title}`).join(', ')}
                        </td>
                        <td className="td text-right text-ink-subtle">__________</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-foot">
              <button
                onClick={() => setManifestModalOpen(false)}
                className="btn btn-outline btn-sm"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-primary btn-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Manifiesto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {activeNoteModal && (
        <div className="overlay">
          <div className="modal modal-sm">
            <div className="modal-head">
              <div>
                <h3 className="modal-title flex items-center gap-2">
                  <Tag className="h-4 w-4 text-accent" />
                  <span>Nota de Empaque - Orden #{activeNoteModal.order_id}</span>
                </h3>
              </div>
              <button
                onClick={() => setActiveNoteModal(null)}
                className="modal-close"
                title="Cerrar nota de empaque"
                aria-label="Cerrar nota de empaque"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="modal-body">
              <p className="help">
                Agrega una observación interna para este paquete (ej: "Frágil", "Incluye factura A", "Talle verificado"):
              </p>
              <textarea
                rows={3}
                placeholder="Escribe tu nota aquí..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                className="textarea"
              />
            </div>

            <div className="modal-foot">
              <button
                onClick={() => setActiveNoteModal(null)}
                className="btn btn-outline btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNote}
                className="btn btn-primary btn-sm"
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
