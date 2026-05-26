import { useEffect, useRef } from 'react';

/**
 * usePolling — calls `callback` immediately and then every `interval` ms.
 *
 * @param {Function} callback  — async-safe function to call on each tick
 * @param {number}   interval  — polling interval in milliseconds (default 5000)
 * @param {boolean}  enabled   — set false to pause polling (default true)
 */
const usePolling = (callback, interval = 5000, enabled = true) => {
  const savedCallback = useRef(callback);

  // Always call the latest version of callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    // Call immediately on mount / when enabled becomes true
    savedCallback.current();

    const id = setInterval(() => {
      savedCallback.current();
    }, interval);

    return () => clearInterval(id);
  }, [enabled, interval]);
};

export default usePolling;
