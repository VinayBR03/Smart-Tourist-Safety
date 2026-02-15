// src/constants/config.js - FIXED VERSION

// API Configuration
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000', // Change to your backend URL
  TIMEOUT: 30000,
};

// Application Configuration
export const APP_CONFIG = {
  NAME: 'Authority Dashboard',
  VERSION: '1.0.0',
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_CENTER: [12.9992, 77.4764], // Bangalore
  DEFAULT_ZOOM: 13,
  MAX_ZOOM: 18,
  MIN_ZOOM: 10,
};

// ✅ FIXED: Incident Status - Mapped to Backend Values
export const INCIDENT_STATUS = {
  OPEN: 'open',                    // Backend: open
  IN_PROGRESS: 'in_progress',      // Backend: in_progress
  RESOLVED: 'resolved',            // Backend: resolved
};

// Status Display Names
export const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

// Zone Risk Levels
export const ZONE_RISK = {
  GREEN: 'green',
  YELLOW: 'yellow',
  ORANGE: 'orange',
  RED: 'red',
};

// Refresh Intervals (milliseconds)
export const REFRESH_INTERVALS = {
  INCIDENTS: 30000,      // 30 seconds
  TOURISTS: 60000,       // 1 minute
  IOT_DEVICES: 45000,    // 45 seconds
  ZONES: 120000,         // 2 minutes
};

// Chart Colors
export const CHART_COLORS = {
  primary: '#2563EB',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  gray: '#6B7280',
};

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'authority_token',
  USER_DATA: 'authority_user',
};