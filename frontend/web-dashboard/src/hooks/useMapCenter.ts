// src/hooks/useMapCenter.ts
//
// Resolves the best initial map center for the current user:
//   1. Browser geolocation (if permission granted)
//   2. Last known position stored in localStorage
//   3. Hard fallback: center of India at country zoom
//
// Also persists every resolved position so the next session
// starts at the right place without waiting for GPS.

import { useState, useEffect } from 'react';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '../constants/config';

const STORAGE_KEY = 'map_last_center';

interface MapCenter {
  center: [number, number];
  zoom:   number;
}

function loadStored(): MapCenter | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MapCenter;
  } catch {
    return null;
  }
}

function saveStored(center: [number, number], zoom: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ center, zoom }));
  } catch {
    // storage full or private mode — silently ignore
  }
}

export function useMapCenter() {
  const stored = loadStored();

  // Start with stored → fallback to India center
  const [center, setCenter] = useState<[number, number]>(
    stored?.center ?? MAP_DEFAULT_CENTER
  );
  const [zoom, setZoom] = useState<number>(
    stored?.zoom ?? MAP_DEFAULT_ZOOM
  );
  const [isLocating, setIsLocating] = useState(false);
  const [source, setSource]         = useState<'geo' | 'stored' | 'default'>(
    stored ? 'stored' : 'default'
  );

  useEffect(() => {
    if (!navigator.geolocation) return;

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];
        const nextZoom = 13; // city-level zoom for a real GPS fix
        setCenter(next);
        setZoom(nextZoom);
        setSource('geo');
        saveStored(next, nextZoom);
        setIsLocating(false);
      },
      () => {
        // Permission denied or timeout — stay on stored/default
        setIsLocating(false);
      },
      {
        timeout: 6000,
        maximumAge: 5 * 60 * 1000, // accept a 5-min-old cached fix
        enableHighAccuracy: false,
      }
    );
  }, []);

  // Call this when the user manually pans/zooms to persist their preference
  const persist = (newCenter: [number, number], newZoom: number) => {
    setCenter(newCenter);
    setZoom(newZoom);
    saveStored(newCenter, newZoom);
  };

  return { center, zoom, isLocating, source, persist };
}