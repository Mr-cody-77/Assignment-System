import { createSlice } from '@reduxjs/toolkit';

const submissionSlice = createSlice({
  name: 'submissions',
  initialState: {
    list: [],
    current: null,
    loading: false,
    error: null,
    analytics: null,
  },
  reducers: {
    setSubmissions(state, action) { state.list = action.payload; },
    setCurrentSubmission(state, action) { state.current = action.payload; },
    addSubmission(state, action) { state.list.unshift(action.payload); },
    updateSubmission(state, action) {
      const idx = state.list.findIndex(s => s.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
      if (state.current?.id === action.payload.id) state.current = action.payload;
    },
    setLoading(state, action) { state.loading = action.payload; },
    setError(state, action) { state.error = action.payload; },
    setAnalytics(state, action) { state.analytics = action.payload; },
  },
});

export const { setSubmissions, setCurrentSubmission, addSubmission, updateSubmission, setLoading, setError, setAnalytics } = submissionSlice.actions;
export const selectSubmissions = (s) => s.submissions.list;
export const selectCurrentSubmission = (s) => s.submissions.current;
export const selectAnalytics = (s) => s.submissions.analytics;
export default submissionSlice.reducer;
