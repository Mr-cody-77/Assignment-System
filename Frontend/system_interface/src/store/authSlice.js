import { createSlice } from '@reduxjs/toolkit';

const stored = (() => {
  try {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('auth_user') || localStorage.getItem('user');
    return { token: t, user: u ? JSON.parse(u) : null };
  } catch { return { token: null, user: null }; }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: stored.user,
    accessToken: stored.token,
    loading: false,
    error: null,
  },
  reducers: {
    loginStart(state) { state.loading = true; state.error = null; },
    loginSuccess(state, action) {
      state.loading = false;
      state.user = action.payload.user;
      state.accessToken = action.payload.access;
      localStorage.setItem('access_token', action.payload.access);
      localStorage.setItem('refresh_token', action.payload.refresh || '');
      localStorage.setItem('auth_user', JSON.stringify(action.payload.user));
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    loginFailure(state, action) { state.loading = false; state.error = action.payload; },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('user');
    },
    clearError(state) { state.error = null; },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, clearError } = authSlice.actions;
export const selectUser = (s) => s.auth.user;
export const selectToken = (s) => s.auth.accessToken;
export const selectIsTeacher = (s) => s.auth.user?.role === 'teacher';
export const selectIsStudent = (s) => s.auth.user?.role === 'student';
export default authSlice.reducer;
