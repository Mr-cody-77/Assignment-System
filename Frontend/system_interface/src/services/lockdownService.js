import { backendRequest, getStoredAccessToken } from './api';

const getAuthConfig = () => {
  const token = getStoredAccessToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const startLockdown = async () => {
  const { data } = await backendRequest.post('/api/lockdown/lock/', {}, getAuthConfig());
  return data;
};

export const stopLockdown = async () => {
  const { data } = await backendRequest.post('/api/lockdown/unlock/', {}, getAuthConfig());
  return data;
};

export const getLockdownStatus = async () => {
  const { data } = await backendRequest.get('/api/lockdown/status/', getAuthConfig());
  return data;
};
