// src/utils/mapHelpers.ts

import { RiskLevel } from '../types/enums';

export function riskLevelToColor(level: RiskLevel | null | undefined): string {
  switch (level) {
    case RiskLevel.HIGH:   return '#ef4444';
    case RiskLevel.MEDIUM: return '#f97316';
    case RiskLevel.LOW:    return '#22c55e';
    default:               return '#6b7280';
  }
}

export function riskLevelToFillOpacity(level: RiskLevel | null | undefined): number {
  switch (level) {
    case RiskLevel.HIGH:   return 0.35;
    case RiskLevel.MEDIUM: return 0.25;
    case RiskLevel.LOW:    return 0.15;
    default:               return 0.1;
  }
}

export function batteryToColor(pct: number | null | undefined): string {
  if (pct == null) return '#6b7280';
  if (pct > 60)    return '#22c55e';
  if (pct > 20)    return '#f97316';
  return '#ef4444';
}

export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}