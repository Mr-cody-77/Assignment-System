import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ServerProvider } from './context/ServerContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast/ToastProvider';
import AppRoutes from './routes/AppRoutes';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <ServerProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ServerProvider>
    </BrowserRouter>
  );
}
