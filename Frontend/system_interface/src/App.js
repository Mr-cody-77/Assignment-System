import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ServerProvider } from './context/ServerContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast/ToastProvider';
import AppRoutes from './routes/AppRoutes';
import './index.css';

export default function App() {
  useEffect(() => {
    // Send a silent heartbeat ping to the backend every 5 seconds
    // to let it know the browser tab is still open.
    const interval = setInterval(() => {
      fetch('/api/heartbeat/', { method: 'POST' }).catch(() => {
        // Silently catch errors in case the backend is already shutting down
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

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
