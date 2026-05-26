import { useState } from 'react';

/**
 * useLocalStorage — synced localStorage state.
 *
 * @param {string} key           — localStorage key
 * @param {*}      initialValue  — default value if key not found
 * @returns {[value, setValue]}
 */
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to read key "${key}":`, err);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to write key "${key}":`, err);
    }
  };

  return [storedValue, setValue];
};

export default useLocalStorage;
