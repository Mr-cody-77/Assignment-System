import { useContext } from 'react';
import { ToastContext } from '../components/Toast/ToastProvider';

/**
 * useToast — returns the toast context value.
 * Exposes: addToast(message, type, duration)
 * Types: 'success' | 'error' | 'info' | 'warning'
 */
const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

export { useToast };
export default useToast;
