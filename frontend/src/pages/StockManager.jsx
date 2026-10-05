import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Package, 
  ExternalLink, 
  Check, 
  Play, 
  Pause, 
  Layers, 
  RefreshCw,
  Edit2,
  X,
  Download,
  Percent,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';

export default function StockManager({ connection, onRefreshData }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingStock, setEditingStock] = useState({});
  const [editingPrice, setEditingPrice] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [selectedVariationItem, setSelectedVariationItem] = useState(null);

  // Bulk Selection State
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPercentage, setBulkPercentage] = useState(10);
  const [applyingBulk, setApplyingBulk] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadItems = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (statusFilter === 'active' || statusFilter === 'paused') {
        params.status = statusFilter;
      } else if (statusFilter === 'low_stock') {
        params.lowStock = 'true';
      } else if (statusFilter === 'out_of_stock') {
        params.outOfStock = 'true';
      }
      if (search) {
        params.q = search;
      }

      const res = await api.getItems(params);
      setItems(res.results || []);
      setCurrentPage(1);
      setSelectedItemIds([]);
    } catch (err) {
      console.error('Error al cargar publicaciones:', err);
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadItems();
  };

  const handleStockChange = (itemId, value) => {
    setEditingStock((prev) => ({ ...prev, [itemId]: value }));
  };

  const handlePriceChange = (itemId, value) => {
    setEditingPrice((prev) => ({ ...prev, [itemId]: value }));
  };

  const saveItemStock = async (item, variationId = null) => {
    const targetKey = variationId || item.id;
    const newStock = editingStock[targetKey];
    if (newStock === undefined || newStock === '') return;

    try {
      setSavingId(targetKey);
      await api.updateStock(item.id, newStock, variationId);
      setActionMessage({ type: 'success', text: `Stock actualizado con éxito en Mercado Libre.` });
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });

      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id) {
            if (variationId && i.variations) {
              const updatedVars = i.variations.map((v) =>
                v.id === variationId ? { ...v, available_quantity: parseInt(newStock, 10) } : v
              );
              const totalStock = updatedVars.reduce((sum, v) => sum + v.available_quantity, 0);
              return { ...i, variations: updatedVars, available_quantity: totalStock };
            }
            return { ...i, available_quantity: parseInt(newStock, 10) };
          }
          return i;
        })
      );

      setEditingStock((prev) => {
        const copy = { ...prev };
        delete copy[targetKey];
        return copy;
      });

      if (onRefreshData) onRefreshData();
    } catch (err) {
      setActionMessage({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSavingId(null);
    }
  };

  const saveItemPrice = async (item, variationId = null) => {
    const targetKey = variationId || item.id;
    const newPrice = editingPrice[targetKey];
    if (newPrice === undefined || newPrice === '') return;

    try {
      setSavingId(targetKey);
      await api.updatePrice(item.id, newPrice, variationId);
      setActionMessage({ type: 'success', text: `Precio actualizado en Mercado Libre.` });
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });

      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id) {
            return { ...i, price: parseFloat(newPrice) };
          }
          return i;
        })
      );

      setEditingPrice((prev) => {
        const copy = { ...prev };
        delete copy[targetKey];
        return copy;
      });

      if (onRefreshData) onRefreshData();
    } catch (err) {
      setActionMessage({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'active' ? 'paused' : 'active';
    const actionName = nextStatus === 'active' ? 'activada' : 'pausada';

    try {
      setSavingId(item.id);
      await api.toggleStatus(item.id, nextStatus);
      setActionMessage({ type: 'success', text: `Publicación ${actionName} en Mercado Libre.` });

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
      );
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setActionMessage({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSavingId(null);
    }
  };

  // Bulk selection handlers
  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === paginatedItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(paginatedItems.map((i) => i.id));
    }
  };

  const handleToggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleApplyBulkPrice = async () => {
    if (selectedItemIds.length === 0) return;
    try {
      setApplyingBulk(true);
      await api.batchPricePercentage(selectedItemIds, bulkPercentage);
      setActionMessage({
        type: 'success',
        text: `Precios ajustados (${bulkPercentage > 0 ? '+' : ''}${bulkPercentage}%) en ${selectedItemIds.length} publicaciones.`,
      });
      setShowBulkPriceModal(false);
      await loadItems();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleBulkStatus = async (status) => {
    if (selectedItemIds.length === 0) return;
    try {
      setApplyingBulk(true);
      await api.batchStatus(selectedItemIds, status);
      setActionMessage({
        type: 'success',
        text: `Estado cambiado a ${status} en ${selectedItemIds.length} publicaciones.`,
      });
      await loadItems();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleExportCsv = () => {
    const exportData = items.map((i) => ({
      ID: i.id,
      Titulo: i.title,
      Precio: i.price,
      Moneda: i.currency_id,
      Stock_Disponible: i.available_quantity,
      Vendidos: i.sold_quantity,
      Estado: i.status,
      Logistica: i.shipping?.logistic_type || 'Mercado Envios',
      Link: i.permalink,
    }));
    api.exportToCsv(exportData, `inventario_mercadolibre_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Pagination Slice
  const totalPages = Math.ceil(items.length / itemsPerPage) || 1;
  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="page">

      {/* Encabezado y acciones */}
      <div className="page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">Gestión de Stock y Publicaciones</h1>
            <span className="badge badge-brand tabular">{items.length} productos</span>
          </div>
          <p className="page-sub">
            Sincronización bidireccional directa con Mercado Libre. Editá precios, stock y estados en vivo.
          </p>
        </div>

        <div className="toolbar">
          {/* Exportar a CSV */}
          <button
            onClick={handleExportCsv}
            disabled={items.length === 0}
            className="btn btn-outline btn-sm"
            title="Exportar inventario a formato Excel / CSV"
          >
            <Download className="h-4 w-4 text-ink-subtle" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          {/* Recargar publicaciones */}
          <button
            onClick={loadItems}
            className="btn btn-outline btn-sm"
            title="Recargar publicaciones desde Mercado Libre"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : 'text-ink-subtle'}`} />
            <span>Recargar</span>
          </button>
        </div>
      </div>

      {/* Aviso de resultado */}
      {actionMessage && (
        <div
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 text-xs font-semibold shadow-card ${
            actionMessage.type === 'success'
              ? 'border-success/30 bg-success-soft text-success'
              : 'border-danger/30 bg-danger-soft text-danger'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="rounded-lg p-1 transition hover:bg-card/60"
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Acciones masivas (con publicaciones seleccionadas) */}
      {selectedItemIds.length > 0 && (
        <div className="stat-strip animate-fade-in justify-between border-brand/40 bg-brand-soft">
          <div className="flex items-center gap-2 text-xs font-bold text-ink">
            <CheckSquare className="h-4 w-4 text-brand-600" />
            <span className="tabular">{selectedItemIds.length} publicaciones seleccionadas</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBulkPriceModal(true)}
              className="btn btn-primary btn-sm"
            >
              <Percent className="h-3.5 w-3.5" />
              <span>Ajustar % Precios</span>
            </button>

            <button
              onClick={() => handleBulkStatus('paused')}
              disabled={applyingBulk}
              className="btn btn-outline btn-sm"
            >
              Pausar seleccionadas
            </button>

            <button
              onClick={() => handleBulkStatus('active')}
              disabled={applyingBulk}
              className="btn btn-success btn-sm"
            >
              Activar seleccionadas
            </button>

            <button
              onClick={() => setSelectedItemIds([])}
              className="btn btn-ghost btn-icon-sm"
              title="Deseleccionar todas"
              aria-label="Deseleccionar todas"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Buscador y filtros */}
      <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        {/* Buscador */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            placeholder="Buscar por título, SKU o ID de publicación (MLA...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-search"
          />
        </form>

        {/* Filtros de estado */}
        <div className="flex min-w-0 items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
          <div className="no-scrollbar -mx-0.5 overflow-x-auto px-0.5">
            <div className="segmented">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'active', label: 'Activas' },
                { id: 'paused', label: 'Pausadas' },
                { id: 'low_stock', label: 'Stock Bajo' },
                { id: 'out_of_stock', label: 'Agotadas' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`segmented-btn whitespace-nowrap ${
                    statusFilter === tab.id ? 'segmented-btn-active' : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de publicaciones */}
      <div className="card overflow-hidden">
        <div className="table-wrap rounded-none border-0 bg-transparent shadow-none">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <button
                    onClick={handleToggleSelectAll}
                    className="btn btn-ghost btn-icon-sm"
                    title="Seleccionar todas las publicaciones de la página"
                    aria-label="Seleccionar todas las publicaciones de la página"
                  >
                    {selectedItemIds.length === paginatedItems.length && paginatedItems.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-brand-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th>Publicación</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Stock Disponible</th>
                <th>Ventas</th>
                <th>Logística</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-6">
                    <div className="space-y-3" aria-hidden="true">
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-11 w-11 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3 w-2/3" />
                          <div className="skeleton h-3 w-1/3" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-11 w-11 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3 w-1/2" />
                          <div className="skeleton h-3 w-1/4" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-11 w-11 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3 w-3/5" />
                          <div className="skeleton h-3 w-1/3" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-11 w-11 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3 w-2/5" />
                          <div className="skeleton h-3 w-1/5" />
                        </div>
                      </div>
                    </div>
                    <p className="sr-only">Consultando publicaciones en vivo con Mercado Libre...</p>
                  </td>
                </tr>
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((item) => {
                  const hasVariations = item.variations && item.variations.length > 0;
                  const currentStockVal = editingStock[item.id] !== undefined ? editingStock[item.id] : item.available_quantity;
                  const currentPriceVal = editingPrice[item.id] !== undefined ? editingPrice[item.id] : item.price;
                  const isSaving = savingId === item.id;
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? 'bg-brand-soft/70' : undefined}
                    >
                      {/* Selección */}
                      <td>
                        <button
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="btn btn-ghost btn-icon-sm"
                          title="Seleccionar publicación"
                          aria-label="Seleccionar publicación"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-brand-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      {/* Detalle del producto */}
                      <td className="td-strong max-w-sm">
                        <div className="flex items-start gap-3">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-xl border border-line bg-muted object-cover shadow-xs"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-muted text-ink-subtle">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="line-clamp-2 font-bold leading-snug text-ink">
                              {item.title}
                            </h4>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-medium tabular text-ink-subtle">{item.id}</span>
                              {hasVariations && (
                                <button
                                  onClick={() => setSelectedVariationItem(item)}
                                  className="badge badge-info transition hover:brightness-[1.03]"
                                  title="Ver y editar variantes"
                                >
                                  <Layers className="h-3 w-3" />
                                  <span className="tabular">{item.variations.length} variantes</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td>
                        <span
                          className={`badge ${
                            item.status === 'active' ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {item.status === 'active' ? 'Activa' : 'Pausada'}
                        </span>
                      </td>

                      {/* Edición de precio */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-ink-subtle">$</span>
                          <input
                            type="number"
                            value={currentPriceVal}
                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            className="input input-sm tabular w-24 font-bold"
                          />
                          {editingPrice[item.id] !== undefined && (
                            <button
                              onClick={() => saveItemPrice(item)}
                              disabled={isSaving}
                              title="Guardar precio en ML"
                              aria-label="Guardar precio en Mercado Libre"
                              className="btn btn-primary btn-icon-sm"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Edición de stock */}
                      <td>
                        {hasVariations ? (
                          <button
                            onClick={() => setSelectedVariationItem(item)}
                            className="btn btn-soft-accent btn-xs"
                            title="Editar el stock de las variantes"
                          >
                            <span className="tabular">{item.available_quantity} unidades</span>
                            <Edit2 className="h-3 w-3" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={currentStockVal}
                              onChange={(e) => handleStockChange(item.id, e.target.value)}
                              className={`input input-sm tabular w-20 text-center font-bold ${
                                currentStockVal === 0
                                  ? 'border-danger/40 bg-danger-soft text-danger'
                                  : currentStockVal <= 5
                                  ? 'border-warning/40 bg-warning-soft text-warning'
                                  : ''
                              }`}
                            />
                            {editingStock[item.id] !== undefined && (
                              <button
                                onClick={() => saveItemStock(item)}
                                disabled={isSaving}
                                title="Guardar stock en ML"
                                aria-label="Guardar stock en Mercado Libre"
                                className="btn btn-primary btn-icon-sm"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Ventas */}
                      <td>
                        <span className="tabular font-semibold text-ink-muted">
                          {item.sold_quantity || 0} u.
                        </span>
                      </td>

                      {/* Modo de envío */}
                      <td>
                        <span className="badge badge-neutral">
                          {item.shipping?.logistic_type === 'fulfillment'
                            ? '⚡ FULL'
                            : item.shipping?.logistic_type === 'self_service'
                            ? '🚀 FLEX'
                            : item.shipping?.logistic_type === 'cross_docking'
                            ? '📦 Colecta'
                            : 'Mercado Envíos'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">

                          {/* Pausar / activar */}
                          <button
                            onClick={() => handleToggleStatus(item)}
                            disabled={isSaving}
                            title={item.status === 'active' ? 'Pausar publicación en ML' : 'Activar publicación en ML'}
                            aria-label={item.status === 'active' ? 'Pausar publicación en Mercado Libre' : 'Activar publicación en Mercado Libre'}
                            className={`btn btn-outline btn-icon-sm ${
                              item.status === 'active'
                                ? 'text-warning'
                                : 'text-success'
                            }`}
                          >
                            {item.status === 'active' ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Ver publicación en Mercado Libre */}
                          {item.permalink && (
                            <a
                              href={item.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver en Mercado Libre"
                              aria-label="Ver en Mercado Libre"
                              className="btn btn-outline btn-icon-sm text-ink-muted"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <div className="empty-icon">
                        <Package className="h-6 w-6" />
                      </div>
                      <p className="empty-title">Sin publicaciones</p>
                      <p className="empty-text">No se encontraron publicaciones con los filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="card-foot text-xs text-ink-muted">
            <div>
              Mostrando página <b className="tabular text-ink">{currentPage}</b> de{' '}
              <b className="tabular text-ink">{totalPages}</b> ({items.length} publicaciones en total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-outline btn-sm"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-outline btn-sm"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: ajuste masivo de precios */}
      {showBulkPriceModal && (
        <div className="overlay">
          <div className="modal">
            <div className="modal-head">
              <h3 className="modal-title flex items-center gap-2">
                <Percent className="h-5 w-5 text-brand-600" />
                <span>Ajustar Precios Masivamente</span>
              </h3>
              <button
                onClick={() => setShowBulkPriceModal(false)}
                className="modal-close"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="modal-body text-xs">
              <p className="text-ink-muted">
                Se actualizarán los precios de <b className="text-ink">{selectedItemIds.length} publicaciones seleccionadas</b> directamente en Mercado Libre.
              </p>

              <div className="field">
                <label className="label">Porcentaje de variación (%):</label>
                <div className="input-group">
                  <input
                    type="number"
                    value={bulkPercentage}
                    onChange={(e) => setBulkPercentage(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 10 o -5"
                    className="input tabular font-bold"
                  />
                  <span className="flex items-center px-1 font-bold text-ink-muted">%</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {[5, 10, 15, 20, -5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setBulkPercentage(val)}
                      className="btn btn-outline btn-xs tabular"
                    >
                      {val > 0 ? `+${val}%` : `${val}%`}
                    </button>
                  ))}
                </div>
                <p className="help">Usá valores negativos para bajar los precios.</p>
              </div>
            </div>

            <div className="modal-foot">
              <button
                onClick={() => setShowBulkPriceModal(false)}
                className="btn btn-outline btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyBulkPrice}
                disabled={applyingBulk}
                className="btn btn-primary btn-sm"
              >
                <span>{applyingBulk ? 'Actualizando...' : 'Aplicar Cambio en Mercado Libre'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: variantes de la publicación */}
      {selectedVariationItem && (
        <div className="overlay">
          <div className="modal modal-lg">

            <div className="modal-head">
              <div className="min-w-0">
                <h3 className="modal-title">
                  Variantes de Publicación
                </h3>
                <p className="modal-sub line-clamp-1">
                  {selectedVariationItem.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedVariationItem(null)}
                className="modal-close"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="modal-body">
              {selectedVariationItem.variations?.map((v) => {
                const varLabel = v.attribute_combinations
                  ? v.attribute_combinations.map((a) => `${a.name}: ${a.value_name}`).join(' | ')
                  : `Variante #${v.id}`;
                const currentVarStock = editingStock[v.id] !== undefined ? editingStock[v.id] : v.available_quantity;
                const isSaving = savingId === v.id;

                return (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-muted/60 p-3.5"
                  >
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-ink">{varLabel}</h5>
                      <span className="font-mono text-[10px] tabular text-ink-subtle">{v.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-ink-muted">Stock:</span>
                        <input
                          type="number"
                          min="0"
                          value={currentVarStock}
                          onChange={(e) => handleStockChange(v.id, e.target.value)}
                          className="input input-sm tabular w-20 text-center font-bold"
                        />
                      </div>

                      {editingStock[v.id] !== undefined && (
                        <button
                          onClick={() => saveItemStock(selectedVariationItem, v.id)}
                          disabled={isSaving}
                          className="btn btn-primary btn-xs"
                        >
                          Guardar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-foot">
              <button
                onClick={() => setSelectedVariationItem(null)}
                className="btn btn-outline btn-sm"
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
