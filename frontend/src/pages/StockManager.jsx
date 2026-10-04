import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Package, 
  ExternalLink, 
  Save, 
  Check, 
  AlertTriangle, 
  Play, 
  Pause, 
  Layers, 
  RefreshCw,
  Edit2,
  X,
  Plus,
  Minus,
  Download,
  Percent,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles
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
    <div className="space-y-6">
      
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestión de Stock y Publicaciones</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-bold">
              {items.length} productos
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Sincronización bidireccional directa con Mercado Libre. Edita precios, stock y estados en vivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          
          {/* Export to CSV */}
          <button
            onClick={handleExportCsv}
            disabled={items.length === 0}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
            title="Exportar inventario a formato Excel / CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={loadItems}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-600' : ''}`} />
            <span>Recargar</span>
          </button>
        </div>
      </div>

      {/* Action / Alert Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Operations Toolbar (When items are selected) */}
      {selectedItemIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center space-x-2 text-xs">
            <CheckSquare className="w-4 h-4 text-yellow-400" />
            <span className="font-bold">{selectedItemIds.length} publicaciones seleccionadas</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBulkPriceModal(true)}
              className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1 transition"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Ajustar % Precios</span>
            </button>

            <button
              onClick={() => handleBulkStatus('paused')}
              disabled={applyingBulk}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition"
            >
              Pausar Seleccionadas
            </button>

            <button
              onClick={() => handleBulkStatus('active')}
              disabled={applyingBulk}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition"
            >
              Activar Seleccionadas
            </button>

            <button
              onClick={() => setSelectedItemIds([])}
              className="p-1.5 text-slate-400 hover:text-white"
              title="Deseleccionar todas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, SKU o ID de publicación (MLA...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        </form>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? 'bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-950 shadow-xs font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* Listings Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4 w-10">
                  <button
                    onClick={handleToggleSelectAll}
                    className="p-1 hover:text-slate-900 text-slate-400"
                  >
                    {selectedItemIds.length === paginatedItems.length && paginatedItems.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-3">Publicación</th>
                <th className="py-3.5 px-3">Estado</th>
                <th className="py-3.5 px-3">Precio</th>
                <th className="py-3.5 px-3">Stock Disponible</th>
                <th className="py-3.5 px-3">Ventas</th>
                <th className="py-3.5 px-3">Logística</th>
                <th className="py-3.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />
                    <p className="text-xs">Consultando publicaciones en vivo con Mercado Libre...</p>
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
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-yellow-50/50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="p-1 text-slate-400 hover:text-slate-900"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-yellow-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Product details */}
                      <td className="py-3 px-3 max-w-sm">
                        <div className="flex items-start space-x-3">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0 bg-white shadow-xs"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                              <Package className="w-6 h-6 text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 line-clamp-2 leading-snug">
                              {item.title}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-[11px] font-mono text-slate-400">{item.id}</span>
                              {hasVariations && (
                                <button
                                  onClick={() => setSelectedVariationItem(item)}
                                  className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                >
                                  <Layers className="w-3 h-3" />
                                  <span>{item.variations.length} variantes</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.status === 'active' ? 'Activa' : 'Pausada'}
                        </span>
                      </td>

                      {/* Price Edit */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-400 font-semibold">$</span>
                          <input
                            type="number"
                            value={currentPriceVal}
                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none"
                          />
                          {editingPrice[item.id] !== undefined && (
                            <button
                              onClick={() => saveItemPrice(item)}
                              disabled={isSaving}
                              title="Guardar precio en ML"
                              className="p-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 transition shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Stock Edit */}
                      <td className="py-3 px-3">
                        {hasVariations ? (
                          <button
                            onClick={() => setSelectedVariationItem(item)}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200"
                          >
                            <span>{item.available_quantity} unidades</span>
                            <Edit2 className="w-3 h-3 text-blue-500" />
                          </button>
                        ) : (
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              min="0"
                              value={currentStockVal}
                              onChange={(e) => handleStockChange(item.id, e.target.value)}
                              className={`w-20 px-2 py-1 border rounded-lg text-xs font-extrabold outline-none focus:ring-2 focus:ring-yellow-400 ${
                                currentStockVal === 0
                                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                                  : currentStockVal <= 5
                                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                              }`}
                            />
                            {editingStock[item.id] !== undefined && (
                              <button
                                onClick={() => saveItemStock(item)}
                                disabled={isSaving}
                                title="Guardar stock en ML"
                                className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Sold quantity */}
                      <td className="py-3 px-3">
                        <span className="text-xs font-semibold text-slate-700">
                          {item.sold_quantity || 0} u.
                        </span>
                      </td>

                      {/* Shipping Mode */}
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-bold text-slate-700">
                          {item.shipping?.logistic_type === 'fulfillment'
                            ? '⚡ FULL'
                            : item.shipping?.logistic_type === 'self_service'
                            ? '🚀 FLEX'
                            : item.shipping?.logistic_type === 'cross_docking'
                            ? '📦 Colecta'
                            : 'Mercado Envíos'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          
                          {/* Toggle pause / unpause */}
                          <button
                            onClick={() => handleToggleStatus(item)}
                            disabled={isSaving}
                            title={item.status === 'active' ? 'Pausar publicación en ML' : 'Activar publicación en ML'}
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition ${
                              item.status === 'active'
                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {item.status === 'active' ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Link to live ML listing */}
                          {item.permalink && (
                            <a
                              href={item.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver en Mercado Libre"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No se encontraron publicaciones con los filtros seleccionados.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Mostrando página <b>{currentPage}</b> de <b>{totalPages}</b> ({items.length} publicaciones en total)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 font-semibold hover:bg-slate-100 flex items-center space-x-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 font-semibold hover:bg-slate-100 flex items-center space-x-1"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Price Percentage Modal */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Percent className="w-5 h-5 text-yellow-600" />
                <span>Ajustar Precios Masivamente</span>
              </h3>
              <button onClick={() => setShowBulkPriceModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <p className="text-slate-600">
                Se actualizarán los precios de <b>{selectedItemIds.length} publicaciones seleccionadas</b> directamente en Mercado Libre.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Porcentaje de variación (%):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={bulkPercentage}
                    onChange={(e) => setBulkPercentage(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 10 o -5"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <span className="font-bold text-slate-600">%</span>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  {[5, 10, 15, 20, -5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setBulkPercentage(val)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700"
                    >
                      {val > 0 ? `+${val}%` : `${val}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setShowBulkPriceModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyBulkPrice}
                disabled={applyingBulk}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <span>{applyingBulk ? 'Actualizando...' : 'Aplicar Cambio en Mercado Libre'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variations Modal */}
      {selectedVariationItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Variantes de Publicación
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {selectedVariationItem.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedVariationItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-3 flex-1">
              {selectedVariationItem.variations?.map((v) => {
                const varLabel = v.attribute_combinations
                  ? v.attribute_combinations.map((a) => `${a.name}: ${a.value_name}`).join(' | ')
                  : `Variante #${v.id}`;
                const currentVarStock = editingStock[v.id] !== undefined ? editingStock[v.id] : v.available_quantity;
                const isSaving = savingId === v.id;

                return (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h5 className="font-bold text-xs text-slate-900">{varLabel}</h5>
                      <span className="text-[10px] font-mono text-slate-400">{v.id}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-[11px] text-slate-500 font-medium">Stock:</span>
                        <input
                          type="number"
                          min="0"
                          value={currentVarStock}
                          onChange={(e) => handleStockChange(v.id, e.target.value)}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      {editingStock[v.id] !== undefined && (
                        <button
                          onClick={() => saveItemStock(selectedVariationItem, v.id)}
                          disabled={isSaving}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                        >
                          Guardar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedVariationItem(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
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
