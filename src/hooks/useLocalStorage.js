import { useState, useEffect, useRef } from 'react';

export function useLocalStorage(key, initialValue) {
  const queueRef = useRef([]);
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
      if (value instanceof Function) {
        // Queue the updater and run via setStoredValue so React passes latest prev.
        // - Fixes stale closure when multiple updates run in one tick (e.g. rapid deletes).
        // - Queue is consumed on first run; when React runs the updater again (Strict Mode
        //   in dev), the queue is empty so we return prev unchanged — avoids applying
        //   e.g. (prev) => [...prev, newTask] twice which would duplicate the new item.
        queueRef.current.push(value);
        setStoredValue((prev) => {
          const fns = queueRef.current;
          queueRef.current = [];
          let next = prev;
          for (const fn of fns) next = fn(next);
          if (fns.length > 0) {
            try {
              window.localStorage.setItem(key, JSON.stringify(next));
              window.dispatchEvent(
                new CustomEvent('local-storage', { detail: { key, value: next } })
              );
            } catch (e) {
              console.warn(`Error setting localStorage key "${key}":`, e);
            }
          }
          return next;
        });
      } else {
        queueRef.current = [];
        const valueToStore = value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(
          new CustomEvent('local-storage', { detail: { key, value: valueToStore } })
        );
      }
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
