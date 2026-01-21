import { useState, useEffect } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      window.dispatchEvent(
        new CustomEvent('local-storage', { detail: { key, value: valueToStore } })
      );
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== key) return;
      try {
        setStoredValue(event.newValue ? JSON.parse(event.newValue) : initialValue);
      } catch (error) {
        setStoredValue(initialValue);
      }
    };

    const handleCustom = (event) => {
      if (event.detail?.key !== key) return;
      setStoredValue(event.detail.value);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('local-storage', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('local-storage', handleCustom);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
