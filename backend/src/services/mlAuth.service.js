const axios = require('axios');
const { getSettings, getAuth, updateAuth, clearAuth } = require('../db/store');

const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const ML_USERS_ME_URL = 'https://api.mercadolibre.com/users/me';

// Country to Auth domain mapping
const AUTH_DOMAINS = {
  MLA: 'https://auth.mercadolibre.com.ar/authorization',
  MLB: 'https://auth.mercadolivre.com.br/authorization',
  MLM: 'https://auth.mercadolibre.com.mx/authorization',
  MLC: 'https://auth.mercadolibre.cl/authorization',
  MLU: 'https://auth.mercadolibre.com.uy/authorization',
  MCO: 'https://auth.mercadolibre.co/authorization',
  MPE: 'https://auth.mercadolibre.com.pe/authorization',
};

function getAuthUrl() {
  const settings = getSettings();
  if (!settings.appId) {
    throw new Error('Debes configurar tu APP_ID en la sección de Ajustes primero.');
  }
  const domain = AUTH_DOMAINS[settings.siteId] || 'https://auth.mercadolibre.com.ar/authorization';
  const redirectUri = encodeURIComponent(settings.redirectUri);
  return `${domain}?response_type=code&client_id=${settings.appId}&redirect_uri=${redirectUri}`;
}

async function exchangeCodeForToken(code) {
  const settings = getSettings();
  if (!settings.appId || !settings.clientSecret) {
    throw new Error('Faltan APP_ID o CLIENT_SECRET en los ajustes.');
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: String(settings.appId).trim(),
    client_secret: String(settings.clientSecret).trim(),
    code: String(code).trim(),
    redirect_uri: String(settings.redirectUri).trim(),
  });

  const response = await axios.post(ML_TOKEN_URL, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  });

  const data = response.data;
  const expiresAt = Date.now() + (data.expires_in || 21600) * 1000;

  let userDetails = {};
  try {
    const userRes = await axios.get(ML_USERS_ME_URL, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    userDetails = userRes.data;
  } catch (uErr) {
    console.warn('Advertencia al consultar /users/me:', uErr.message);
  }

  const updated = updateAuth({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    userId: data.user_id || userDetails.id || '',
    nickname: userDetails.nickname || `Usuario #${data.user_id}`,
    permalink: userDetails.permalink || '',
    siteId: userDetails.site_id || settings.siteId,
  });

  return updated;
}

async function saveManualToken(accessToken, refreshToken = '', userId = '') {
  // Validate token directly with Mercado Libre /users/me
  const userRes = await axios.get(ML_USERS_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
  });

  const userData = userRes.data;
  const updated = updateAuth({
    accessToken: accessToken.trim(),
    refreshToken: refreshToken.trim(),
    expiresAt: Date.now() + 6 * 3600 * 1000,
    userId: userData.id,
    nickname: userData.nickname,
    permalink: userData.permalink,
    siteId: userData.site_id,
  });

  return {
    success: true,
    user: userData,
    auth: updated,
  };
}

async function refreshAccessToken() {
  const settings = getSettings();
  const auth = getAuth();

  if (!auth.refreshToken) {
    throw new Error('No hay Refresh Token disponible para renovar la sesión.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: String(settings.appId).trim(),
    client_secret: String(settings.clientSecret).trim(),
    refresh_token: String(auth.refreshToken).trim(),
  });

  const response = await axios.post(ML_TOKEN_URL, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  });

  const data = response.data;
  const expiresAt = Date.now() + (data.expires_in || 21600) * 1000;

  return updateAuth({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    userId: data.user_id || auth.userId,
  });
}

async function getValidAccessToken() {
  const auth = getAuth();
  if (!auth.accessToken) {
    return null;
  }

  // If token expires in less than 10 minutes and we have a refresh token, auto-refresh
  if (auth.expiresAt && Date.now() > auth.expiresAt - 10 * 60 * 1000 && auth.refreshToken) {
    try {
      const refreshed = await refreshAccessToken();
      return refreshed.accessToken;
    } catch (err) {
      console.error('Error al autorenovar token:', err.response?.data || err.message);
      return auth.accessToken;
    }
  }

  return auth.accessToken;
}

async function checkConnectionStatus() {
  const auth = getAuth();
  if (!auth.accessToken) {
    return {
      connected: false,
      message: 'No hay ninguna cuenta de Mercado Libre vinculada.',
    };
  }

  try {
    const token = await getValidAccessToken();
    const res = await axios.get(ML_USERS_ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      connected: true,
      nickname: res.data.nickname,
      userId: res.data.id,
      siteId: res.data.site_id,
      permalink: res.data.permalink,
      points: res.data.points,
      sellerReputation: res.data.seller_reputation,
      expiresAt: auth.expiresAt,
    };
  } catch (err) {
    return {
      connected: false,
      message: 'El Access Token es inválido o expiró. Por favor vuelve a conectar tu cuenta.',
      error: err.response?.data || err.message,
    };
  }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  saveManualToken,
  refreshAccessToken,
  getValidAccessToken,
  checkConnectionStatus,
  clearAuth,
};
