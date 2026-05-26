import React, { createContext, useState, useCallback, useRef } from 'react';
import { generateId } from '../../utils/helpers';

export const ToastContext = createContext(null);

const TYPE_STYLES = {
  success: { border: '#10b981', icon: '✓', bg: 'rgba(16,185,129,0.1)', color: '#6ee7b7' },
  error:   { border: '#ef4444', icon: '✕', bg: 'rgba(239,68,68,0.1)',  color: '#fca5a5' },
  info:    { border: '#3b82f6', icon: 'ℹ', bg: 'rgba(59,130,246,0.1)', color: '#93c5fd' },
  warning: { border: '#f59e0b', icon: '⚠', bg: 'rgba(245,158,11,0.1)', color: '#fcd34d' },
};

function Toast({ id, message, type = 'info', onRemove }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.info;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: '#1a2340',
        border: `1px solid rgba(99,120,200,0.2)`,
        borderLeft: `4px solid ${s.border}`,
        borderRadius: 10,
        padding: '14px 16px',
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'toastSlideIn 0.25s ease',
        position: 'relative',
      }}
    >
      {/* Icon */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: s.bg,
          color: s.color,
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {s.icon}
      </span>

      {/* Message */}
      <span
        style={{
          flex: 1,
          fontSize: 14,
          color: '#e2e8f0',
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}
      >
        {message}
      </span>

      {/* Close button */}
      <button
        onClick={() => onRemove(id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#64748b',
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = generateId();
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast {...t} onRemove={removeToast} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
