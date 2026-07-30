import axios from 'axios';
import { endpoints } from '../config/endpointResolver';
import runtimeConfig from '../config/runtimeConfig';

const TIMEOUT = 30000;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const AUTH_STORAGE_EVENT = 'assignment-auth-storage-change';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const AUTH_USER_KEY = 'auth_user';
const LEGACY_USER_KEY = 'user';

const hasStorage = () =>
  typeof window !== 'undefined' && Boolean(window.localStorage);

const readStorage = (key) => {
  if (!hasStorage()) return null;
  return window.localStorage.getItem(key);
};

const writeStorage = (key, value) => {
  if (!hasStorage()) return;
  window.localStorage.setItem(key, value);
};

const removeStorage = (key) => {
  if (!hasStorage()) return;
  window.localStorage.removeItem(key);
};

const dispatchAuthStorageEvent = (detail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_STORAGE_EVENT, { detail }));
};

const coerceToken = (value) => {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (!token || token === 'undefined' || token === 'null') return null;
  return token;
};

export const normalizeAuthTokens = (payload = {}) => {
  const tokens = payload?.tokens && typeof payload.tokens === 'object'
    ? payload.tokens
    : {};

  return {
    access: coerceToken(
      payload.access ??
        payload.access_token ??
        payload.token ??
        tokens.access ??
        tokens.access_token
    ),
    refresh: coerceToken(
      payload.refresh ??
        payload.refresh_token ??
        tokens.refresh ??
        tokens.refresh_token
    ),
  };
};

export const normalizeAuthUser = (payload = {}) => {
  const rawUser = payload?.user && typeof payload.user === 'object'
    ? payload.user
    : {};
  const role = rawUser.role ?? payload.role ?? null;
  const username =
    rawUser.username ??
    payload.username ??
    rawUser.roll_number ??
    payload.roll_number ??
    null;

  return {
    ...rawUser,
    username,
    role,
    roll_number:
      rawUser.roll_number ??
      payload.roll_number ??
      (role === 'student' ? username : null),
  };
};

export const getStoredAccessToken = () =>
  coerceToken(readStorage(ACCESS_TOKEN_KEY));

export const getStoredRefreshToken = () =>
  coerceToken(readStorage(REFRESH_TOKEN_KEY));

export const getStoredUser = () => {
  const stored = readStorage(AUTH_USER_KEY) || readStorage(LEGACY_USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    removeStorage(AUTH_USER_KEY);
    removeStorage(LEGACY_USER_KEY);
    return null;
  }
};

export const storeAuthTokens = (
  { access, refresh },
  { requireAccess = false, preserveRefresh = true } = {}
) => {
  const normalizedAccess = coerceToken(access);
  const normalizedRefresh = coerceToken(refresh);

  if (requireAccess && !normalizedAccess) {
    throw new Error('Authentication response did not include an access token.');
  }

  if (normalizedAccess) {
    refreshFailureUntil = 0;
    writeStorage(ACCESS_TOKEN_KEY, normalizedAccess);
  }

  if (normalizedRefresh) {
    writeStorage(REFRESH_TOKEN_KEY, normalizedRefresh);
  } else if (!preserveRefresh) {
    removeStorage(REFRESH_TOKEN_KEY);
  }

  const storedTokens = {
    access: normalizedAccess || getStoredAccessToken(),
    refresh: normalizedRefresh || getStoredRefreshToken(),
  };

  dispatchAuthStorageEvent({ type: 'tokens', ...storedTokens });
  return storedTokens;
};

export const storeAuthSession = ({ user, access, refresh }) => {
  const storedTokens = storeAuthTokens(
    { access, refresh },
    { requireAccess: true, preserveRefresh: false }
  );
  const storedUser = user || null;

  if (storedUser) {
    const serialized = JSON.stringify(storedUser);
    writeStorage(AUTH_USER_KEY, serialized);
    writeStorage(LEGACY_USER_KEY, serialized);
  }

  dispatchAuthStorageEvent({
    type: 'session',
    user: storedUser,
    ...storedTokens,
  });

  return { user: storedUser, ...storedTokens };
};

export const clearAuthStorage = () => {
  removeStorage(AUTH_USER_KEY);
  removeStorage(LEGACY_USER_KEY);
  removeStorage(ACCESS_TOKEN_KEY);
  removeStorage(REFRESH_TOKEN_KEY);
  dispatchAuthStorageEvent({ type: 'logout' });
};

const isRefreshUrl = (url = '') =>
  url.includes('/token/refresh/') || url.includes('/auth/refresh/');

const isAuthFreeUrl = (url = '') =>
  [
    '/api/users/login/',
    '/users/login/',
    '/api/users/register/',
    '/users/register/',
    '/api/auth/login/',
    '/auth/login/',
    '/api/auth/register/',
    '/auth/register/',
    '/api/token/',
    '/token/',
    '/api/token/refresh/',
    '/token/refresh/',
  ].some((endpoint) => url.includes(endpoint));

const shouldSkipAuth = (config = {}) =>
  config.skipAuth === true || isAuthFreeUrl(config.url || '');

const attachAuthorizationHeader = (config) => {
  if (shouldSkipAuth(config)) {
    if (config.headers) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
    return config;
  }

  const token = getStoredAccessToken();
  if (!token) return config;

  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
};

let refreshPromise = null;
let refreshFailureUntil = 0;
const REFRESH_FAILURE_COOLDOWN_MS = 30000;

export const refreshAccessToken = async () => {
  if (Date.now() < refreshFailureUntil) {
    throw new Error('Token refresh is temporarily disabled after a failed attempt.');
  }

  const refresh = getStoredRefreshToken();

  if (!refresh) {
    throw new Error('No refresh token is stored.');
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        endpoints.refresh(),
        { refresh },
        {
          timeout: TIMEOUT,
          headers: JSON_HEADERS,
        }
      )
      .then(({ data }) => {
        const tokens = normalizeAuthTokens(data);

        if (!tokens.access) {
          throw new Error('Refresh response did not include an access token.');
        }

        const storedTokens = storeAuthTokens(tokens, {
          requireAccess: true,
          preserveRefresh: true,
        });

        return storedTokens.access;
      })
      .catch((error) => {
        refreshFailureUntil = Date.now() + REFRESH_FAILURE_COOLDOWN_MS;
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const installAuthInterceptors = (client) => {
  client.interceptors.request.use(attachAuthorizationHeader);

  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;

      if (
        !original ||
        error.response?.status !== 401 ||
        original._retry ||
        shouldSkipAuth(original) ||
        isRefreshUrl(original.url || '')
      ) {
        return Promise.reject(error);
      }

      original._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(original);
      } catch (refreshError) {
        clearAuthStorage();
        return Promise.reject(refreshError);
      }
    }
  );

  return client;
};

const CENTRAL_URL = process.env.REACT_APP_CENTRAL_URL || 'http://localhost:8000';
const NODE_URL = process.env.REACT_APP_NODE_URL || 'http://localhost:8001';

const createClient = () =>
  installAuthInterceptors(
    axios.create({
      baseURL: CENTRAL_URL,
      timeout: TIMEOUT,
      headers: JSON_HEADERS,
    })
  );

const centralClient = createClient();
const backendClient = axios.create({
  baseURL: NODE_URL,
  timeout: TIMEOUT,
  headers: JSON_HEADERS,
});

// Dynamically route backendRequest to the dynamically discovered local node port
backendClient.interceptors.request.use((config) => {
  try {
    const dynamicBackendURL = runtimeConfig.getBackendURL();
    if (dynamicBackendURL) {
      config.baseURL = dynamicBackendURL;
    }
  } catch (err) {
    // Fallback to static baseURL if not yet initialized
  }
  return config;
});

const requestConfig = (config = {}) => ({
  timeout: TIMEOUT,
  ...config,
  headers: { ...JSON_HEADERS, ...config.headers },
});

/**
 * backendRequest is used for Backend Node Server calls.
 * These endpoints are public in the current backend contract, so auth is not
 * injected here.
 */
export const backendRequest = {
  get: (path, config = {}) => backendClient.get(path, requestConfig(config)),
  post: (path, data, config = {}) =>
    backendClient.post(path, data, requestConfig(config)),
  put: (path, data, config = {}) =>
    backendClient.put(path, data, requestConfig(config)),
  patch: (path, data, config = {}) =>
    backendClient.patch(path, data, requestConfig(config)),
  delete: (path, config = {}) => backendClient.delete(path, requestConfig(config)),
};

/**
 * centralRequest is used for Centralized Database Server calls.
 * It injects Authorization: Bearer <access_token> unless skipAuth is true.
 */
export const centralRequest = {
  get: (url, config = {}) => centralClient.get(url, requestConfig(config)),
  post: (url, data, config = {}) =>
    centralClient.post(url, data, requestConfig(config)),
  put: (url, data, config = {}) =>
    centralClient.put(url, data, requestConfig(config)),
  patch: (url, data, config = {}) =>
    centralClient.patch(url, data, requestConfig(config)),
  delete: (url, config = {}) => centralClient.delete(url, requestConfig(config)),
};
