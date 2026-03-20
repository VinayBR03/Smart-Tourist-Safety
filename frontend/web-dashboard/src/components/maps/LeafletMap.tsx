// src/components/maps/LeafletMap.tsx

import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMapInstance } from 'leaflet';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '../../constants/config';
import { useIsDark } from '../../theme/useTheme';

// ─────────────────────────────────────────────
// Tile URLs
// ─────────────────────────────────────────────

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const DARK_TILES  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>';

// ─────────────────────────────────────────────
// MapRecenter
// Flies to a new center whenever the prop changes.
// Must be rendered inside <MapContainer>.
// ─────────────────────────────────────────────

export function MapRecenter({
  center,
  zoom,
}: {
  center: [number, number];
  zoom:   number;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ─────────────────────────────────────────────
// MoveEndPersist
// Calls onMoveEnd after the user finishes panning/zooming
// so the parent can persist the new position.
// ─────────────────────────────────────────────

function MoveEndPersist({
  onMoveEnd,
}: {
  onMoveEnd?: (center: [number, number], zoom: number) => void;
}) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      const z = e.target.getZoom();
      onMoveEnd?.([c.lat, c.lng], z);
    },
  });
  return null;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface LeafletMapProps {
  center?:      [number, number];
  zoom?:        number;
  height?:      string | number;
  className?:   string;
  onMapReady?:  (map: LeafletMapInstance) => void;
  onMoveEnd?:   (center: [number, number], zoom: number) => void;
  children?:    React.ReactNode;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function LeafletMap({
  center    = MAP_DEFAULT_CENTER,
  zoom      = MAP_DEFAULT_ZOOM,
  height    = 480,
  className = '',
  onMapReady,
  onMoveEnd,
  children,
}: LeafletMapProps) {
  const isDark      = useIsDark();
  const mapRef      = useRef<LeafletMapInstance | null>(null);
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 ${className}`}
      style={{ height: heightStyle }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        whenReady={() => {
          if (mapRef.current && onMapReady) onMapReady(mapRef.current);
        }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'}
          attribution={ATTRIBUTION}
          url={isDark ? DARK_TILES : LIGHT_TILES}
          maxZoom={19}
        />

        {/* Fly to new center whenever prop changes */}
        <MapRecenter center={center} zoom={zoom} />

        {/* Persist position after user pans/zooms */}
        {onMoveEnd && <MoveEndPersist onMoveEnd={onMoveEnd} />}

        {children}
      </MapContainer>
    </div>
  );
}