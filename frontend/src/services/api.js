import Papa from 'papaparse';

const API_BASE = import.meta.env.VITE_API_BASE || 
  (typeof window !== 'undefined' && window.location.origin.includes('localhost:5173') 
    ? 'http://localhost:3001/api' 
    : '/api');

export async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.error || data.message || `Error en la solicitud: ${response.statusText}`;
    throw new Error(errorMsg);
  }
  return data;
}

// Auth & Settings API
export const api = {
  // Connection status & Auth
  getStatus: () => fetchApi('/auth/status'),
  getAuthUrl: () => fetchApi('/auth/url'),
  exchangeCode: (code) =>
    fetchApi('/auth/exchange-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  saveManualToken: (accessToken, refreshToken = '', userId = '') =>
    fetchApi('/auth/manual-token', {
      method: 'POST',
      body: JSON.stringify({ accessToken, refreshToken, userId }),
    }),
  refreshToken: () => fetchApi('/auth/refresh', { method: 'POST' }),
  disconnect: () => fetchApi('/auth/disconnect', { method: 'POST' }),

  // Settings
  getSettings: () => fetchApi('/settings'),
  saveSettings: (settings) =>
    fetchApi('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // Dashboard stats
  getDashboardStats: () => fetchApi('/stats/dashboard'),

  // Items & Stock
  getItems: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/items${query ? `?${query}` : ''}`);
  },
  getItemById: (id) => fetchApi(`/items/${id}`),
  updateStock: (id, quantity, variationId = null) =>
    fetchApi(`/items/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify({ quantity, variationId }),
    }),
  updatePrice: (id, price, variationId = null) =>
    fetchApi(`/items/${id}/price`, {
      method: 'PUT',
      body: JSON.stringify({ price, variationId }),
    }),
  toggleStatus: (id, status) =>
    fetchApi(`/items/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  batchUpdateStock: (updates) =>
    fetchApi('/items/batch-stock', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),
  batchPricePercentage: (itemIds, percentage) =>
    fetchApi('/items/batch-price-percentage', {
      method: 'POST',
      body: JSON.stringify({ itemIds, percentage }),
    }),
  batchStatus: (itemIds, status) =>
    fetchApi('/items/batch-status', {
      method: 'POST',
      body: JSON.stringify({ itemIds, status }),
    }),

  // Orders & Sales
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/orders${query ? `?${query}` : ''}`);
  },
  getOrderById: (id) => fetchApi(`/orders/${id}`),

  // Shipments & Labels
  getShipments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/shipments${query ? `?${query}` : ''}`);
  },
  scanShipment: (rawCode, autoPack = true) =>
    fetchApi('/shipments/scan', {
      method: 'POST',
      body: JSON.stringify({ rawCode, autoPack }),
    }),
  getScanLogs: () => fetchApi('/shipments/scan-logs'),
  getDatabaseStatus: () => fetchApi('/settings/database'),
  downloadLabelUrl: (shipmentId, format = 'pdf') =>
    `${API_BASE}/shipments/${shipmentId}/label?format=${format}`,
  updateShipmentPacking: (shipmentId, data) =>
    fetchApi(`/shipments/${shipmentId}/packing`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  batchShipmentPacking: (shipmentIds, updates) =>
    fetchApi('/shipments/batch-packing', {
      method: 'POST',
      body: JSON.stringify({ shipmentIds, updates }),
    }),

  // Questions & Pre-sales
  getQuestions: (status = 'UNANSWERED') =>
    fetchApi(`/questions?status=${status}`),
  answerQuestion: (questionId, text) =>
    fetchApi(`/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // Export to CSV helper
  exportToCsv: (data, filename = 'export.csv') => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
