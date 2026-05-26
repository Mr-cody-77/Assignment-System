import axios from 'axios';
import { store } from '../store/store';
import { logout } from '../store/authSlice';
import { endpoints } from '../config/endpointResolver';
import {
  clearAuthStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  normalizeAuthTokens,
  storeAuthTokens,
} from '../services/api';

const TIMEOUT = 30000;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Legacy API client kept for older pages. Current routes use src/services/*.
const api = axios.create({
  baseURL: '/api',
  timeout: TIMEOUT,
  headers: JSON_HEADERS,
});

const resolveEndpoint = (resolver) => resolver();

const authFreeEndpoints = [
  '/users/login/',
  '/users/register/',
  '/auth/login/',
  '/auth/register/',
  '/token/',
  '/token/refresh/',
];

const isAuthFreeEndpoint = (url = '') =>
  authFreeEndpoints.some((endpoint) => url.includes(endpoint));

api.interceptors.request.use((config) => {
  if (isAuthFreeEndpoint(config.url || '') || config.skipAuth === true) {
    if (config.headers) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
    return config;
  }

  const token = getStoredAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise = null;
let refreshFailureUntil = 0;
const REFRESH_FAILURE_COOLDOWN_MS = 30000;

const refreshLegacyAccessToken = async () => {
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
        resolveEndpoint(endpoints.refresh),
        { refresh },
        { timeout: TIMEOUT, headers: JSON_HEADERS }
      )
      .then(({ data }) => {
        const tokens = normalizeAuthTokens(data);

        if (!tokens.access) {
          throw new Error('Refresh response did not include an access token.');
        }

        return storeAuthTokens(tokens, {
          requireAccess: true,
          preserveRefresh: true,
        }).access;
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

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (
      !original ||
      err.response?.status !== 401 ||
      original._retry ||
      isAuthFreeEndpoint(original.url || '')
    ) {
      return Promise.reject(err);
    }

    original._retry = true;

    try {
      const newToken = await refreshLegacyAccessToken();
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      clearAuthStorage();
      store.dispatch(logout());
      return Promise.reject(refreshErr);
    }
  }
);

export const authApi = {
  login: (data) => {
    clearAuthStorage();
    return axios.post(resolveEndpoint(endpoints.login), data, {
      timeout: TIMEOUT,
      headers: JSON_HEADERS,
    });
  },
  register: (data) => api.post('/auth/register/', data, { skipAuth: true }),
  refresh: (refresh) =>
    axios.post(
      resolveEndpoint(endpoints.refresh),
      { refresh },
      { timeout: TIMEOUT, headers: JSON_HEADERS }
    ),
  me: () => api.get('/auth/me/'),
};

export const assignmentApi = {
  list: (params) => api.get('/assignments/', { params }),
  get: (id) => api.get(`/assignments/${id}/`),
  create: (data) => api.post('/assignments/', data),
  update: (id, data) => api.put(`/assignments/${id}/`, data),
  patch: (id, data) => api.patch(`/assignments/${id}/`, data),
  delete: (id) => api.delete(`/assignments/${id}/`),
  publish: (id) => api.post(`/assignments/${id}/publish/`),
  close: (id) => api.post(`/assignments/${id}/close/`),
};

export const problemApi = {
  list: (params) => api.get('/problems/', { params }),
  get: (id) => api.get(`/problems/${id}/`),
  create: (data) => api.post('/problems/', data),
  update: (id, data) => api.put(`/problems/${id}/`, data),
  patch: (id, data) => api.patch(`/problems/${id}/`, data),
  delete: (id) => api.delete(`/problems/${id}/`),
  run: (id, data) => api.post(`/problems/${id}/run/`, data),
};

export const testCaseApi = {
  list: (params) => api.get('/test-cases/', { params }),
  create: (data) => api.post('/test-cases/', data),
  update: (id, data) => api.put(`/test-cases/${id}/`, data),
  patch: (id, data) => api.patch(`/test-cases/${id}/`, data),
  delete: (id) => api.delete(`/test-cases/${id}/`),
};

export const submissionApi = {
  submit: (data) => api.post('/submissions/', data),
  get: (id) => api.get(`/submissions/${id}/`),
  list: (params) => api.get('/submissions/', { params }),
  history: () => api.get('/submissions/my-history/'),
  analytics: (params) => api.get('/submissions/analytics/', { params }),
};

export const draftApi = {
  get: (problemId) => api.get(`/draft/?problem=${problemId}`),
  save: (problemId, data) => api.put(`/draft/?problem=${problemId}`, data),
};

export const nodeApi = {
  list: () => api.get('/nodes/'),
  live: () => api.get('/nodes/live/'),
  load: () => axios.get('/load', { timeout: 2000 }),
};

export default api;
