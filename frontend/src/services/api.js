import Papa from 'papaparse';

const API_BASE = import.meta.env.VITE_API_BASE || 
  (typeof window !== 'undefined' && window.location.origin.includes('localhost:5173') 
    ? 'http://localhost:3001/api' 
    : '/api');

export async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  // `options.token` envía una sesión explícita sin tocar el almacenamiento.
  // Se usa para validar la sesión recién emitida: en ese momento el token
  // todavía no está persistido, y leerlo de localStorage provocaba un 401
  // espurio que terminaba cerrando la sesión que acababa de abrirse.
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  } else {
    // Sesión SaaS real: el backend sabe quién llama (Fase 1 multi-usuario).
    try {
      const token = localStorage.getItem('ml_saas_token');
      if (token && !headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
  }
  // Cuenta de Mercado Libre que el supervisor está mirando. `null` significa
  // "la propia". El backend lo valida (`middleware/actingUser.js`): un usuario
  // común que lo intente recibe 403, así que no alcanza para ver datos ajenos.
  try {
    const actingUser = localStorage.getItem('ml_acting_user');
    if (actingUser) headers['X-Acting-User'] = actingUser;
  } catch {}

  // `token` es una opción propia de este cliente: no se envía a fetch.
  const { headers: _ignored, token: _token, ...rest } = options;
  const response = await fetch(url, {
    headers,
    ...rest,
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Una sesión vencida o revocada no puede volver a servir: se descarta la
    // credencial local para que ningún otro request la reintente.
    //
    // Sólo se descarta si el token rechazado sigue siendo el guardado en el
    // navegador. Si meanwhile se emitió otra sesión (p. ej. el usuario se
    // acaba de loguear mientras volaba un pedido viejo), ese 401 es obsoleto
    // y cerrar la sesión nueva sería un error. Tampoco aplica a las
    // validaciones con token explícito, donde el 401 sólo dice "esta sesión
    // no es válida".
    if (response.status === 401 && !options.token) {
      const rejected = String(headers.Authorization || '').replace(/^Bearer\s+/i, '');
      const stored = (() => {
        try {
          return localStorage.getItem('ml_saas_token') || '';
        } catch {
          return '';
        }
      })();
      if (rejected && stored && rejected === stored) {
        try {
          localStorage.removeItem('ml_saas_token');
          localStorage.removeItem('ml_saas_user');
          window.dispatchEvent(new CustomEvent('ml:session-expired'));
        } catch {}
      }
    }

    let errorMsg = data.error || data.message || `Error en la solicitud: ${response.statusText}`;
    if (typeof errorMsg === 'object') {
      errorMsg = errorMsg.message || errorMsg.error || JSON.stringify(errorMsg);
    }
    throw new Error(errorMsg);
  }
  return data;
}

// Auth & Settings API
export const api = {
  // SaaS Multi-tenant Users & Google/Token Auth
  googleLogin: (payload) =>
    fetchApi('/users/google-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  requestOtpCode: (email, name = '') =>
    fetchApi('/users/request-code', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    }),
  verifyOtpCode: (email, code) =>
    fetchApi('/users/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  // --- Gestión de la plataforma (exclusiva del SuperAdmin) ---
  getUsersList: () => fetchApi('/users/list'),
  getPlatformOverview: () => fetchApi('/users/overview'),
  updateUserStatus: (userId, status) =>
    fetchApi(`/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  updateUserRole: (userId, role) =>
    fetchApi(`/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  revokeUserSessions: (userId) =>
    fetchApi(`/users/${encodeURIComponent(userId)}/revoke-sessions`, { method: 'POST' }),
  approveUser: (userId, status) =>
    fetchApi('/users/approve', {
      method: 'POST',
      body: JSON.stringify({ userId, status }),
    }),
  // DESTRUCTIVO: borra todas las cuentas de ML, sesiones y packing.
  // Solo SuperAdmin (el backend lo exige).
  resetPlatform: () =>
    fetchApi('/users/reset-platform', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  // --- Supervisión (Admin y SuperAdmin) ---
  // Lista de cuentas activas que el supervisor puede operar. No expone
  // controles de plataforma: eso es exclusivo del SuperAdmin.
  getSupervisableAccounts: () => fetchApi('/users/supervisable'),
  /** Fija (o limpia) la cuenta de ML que se está supervisando. */
  setActingUser: (email) => {
    try {
      if (email) localStorage.setItem('ml_acting_user', email);
      else localStorage.removeItem('ml_acting_user');
    } catch {}
  },
  getActingUser: () => {
    try {
      return localStorage.getItem('ml_acting_user') || null;
    } catch {
      return null;
    }
  },

  getMe: (token) => fetchApi('/users/me', token ? { token } : {}),
  logoutSession: () => fetchApi('/users/logout', { method: 'POST' }),

  // Mercado Libre Connection status & Auth
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

  // Mobile app pairing (Android QR link)
  createPairing: (email) =>
    fetchApi('/pair/create', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  getPairingStatus: (code, secret, ticket) =>
    fetchApi(
      `/pair/status?code=${encodeURIComponent(code)}&secret=${encodeURIComponent(secret)}` +
        (ticket ? `&ticket=${encodeURIComponent(ticket)}` : ''),
    ),
  getPairDevices: (email) => fetchApi(`/pair/devices?email=${encodeURIComponent(email)}`),
  unlinkDevice: (id) =>
    fetchApi(`/pair/devices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

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
  getShipmentStatus: (id) => fetchApi(`/shipments/${id}/status`),
  scanShipment: (rawCode, autoPack = true, scanMode = 'pack', carrierFilter = 'all') =>
    fetchApi('/shipments/scan', {
      method: 'POST',
      body: JSON.stringify({ rawCode, autoPack, scanMode, carrierFilter }),
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
