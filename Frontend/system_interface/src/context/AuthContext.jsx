import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { login as loginService } from '../services/authService';
import {
  AUTH_STORAGE_EVENT,
  clearAuthStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUser,
  normalizeAuthTokens,
  normalizeAuthUser,
  storeAuthSession,
  backendRequest,
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncFromStorage = useCallback(() => {
    const storedUser = getStoredUser();
    const storedAccess = getStoredAccessToken();
    const storedRefresh = getStoredRefreshToken();

    if (storedUser && storedAccess) {
      setUser(storedUser);
      setAccessToken(storedAccess);
      setRefreshToken(storedRefresh);
    } else {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, []);

  useEffect(() => {
    try {
      syncFromStorage();
    } catch (err) {
      console.warn('[AuthContext] Failed to restore session:', err);
      clearAuthStorage();
    } finally {
      setLoading(false);
    }
  }, [syncFromStorage]);

  useEffect(() => {
    const handleStorageChange = () => syncFromStorage();

    window.addEventListener(AUTH_STORAGE_EVENT, handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(AUTH_STORAGE_EVENT, handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [syncFromStorage]);

  const login = useCallback(async (username, password) => {
    const data = await loginService(username, password);

    if (data.authenticated === false) {
      throw new Error(data.message || 'Invalid credentials');
    }

    const { access, refresh } = normalizeAuthTokens(data);

    if (!access) {
      throw new Error('Login response did not include an access token.');
    }

    const userObj = normalizeAuthUser(data);

    if (!userObj.username || !userObj.role) {
      throw new Error('Login response did not include user identity.');
    }

    storeAuthSession({ user: userObj, access, refresh });
    setUser(userObj);
    setAccessToken(access);
    setRefreshToken(refresh);

    return userObj;
  }, []);

  const logout = useCallback(async () => {
    try {
      await backendRequest.post('/api/stop_system/').catch(() => {});
    } catch (e) {
      console.warn("Failed to stop local backend:", e);
    }
    clearAuthStorage();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const value = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!user && !!accessToken,
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student',
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export default AuthContext;
