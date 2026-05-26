import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import submissionReducer from './submissionSlice';
import nodeReducer from './nodeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    submissions: submissionReducer,
    nodes: nodeReducer,
  },
});
