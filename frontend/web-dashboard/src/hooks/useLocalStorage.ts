// src/hooks/useLocalStorage.ts

import { useState, useCallback, useEffect } from 'react';

// ─────────────────────────────────────────────
// Core hook
// ─────────────────────────────────────────────

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const readValue = useCallback((): T => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return initialValue;
      return JSON.parse(item) as T;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const newValue =
          value instanceof Function ? value(storedValue) : value;
        localStorage.setItem(key, JSON.stringify(newValue));
        setStoredValue(newValue);
        // Notify other tabs
        window.dispatchEvent(new StorageEvent('storage', { key }));
      } catch (err) {
        console.error(`[useLocalStorage] Failed to set key "${key}":`, err);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (err) {
      console.error(`[useLocalStorage] Failed to remove key "${key}":`, err);
    }
  }, [key, initialValue]);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) setStoredValue(readValue());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key, readValue]);

  return [storedValue, setValue, removeValue];
}