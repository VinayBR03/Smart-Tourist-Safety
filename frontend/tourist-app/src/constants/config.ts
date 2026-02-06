// src/constants/config.ts
// Professional configuration and constants

import { Dimensions, Platform } from 'react-native';

// ==================== API CONFIGURATION ====================
export const API_CONFIG = {
  // IMPORTANT: Replace with your actual backend URL
  BASE_URL: __DEV__ 
    ? Platform.OS === 'android' 
      ? 'http://192.168.1.7:8000' // Android Emulator (using local network IP)
      : 'http://localhost:8000' // iOS Simulator
    : 'https://your-production-api.com', // Production URL
  
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// ==================== APP CONFIGURATION ====================
export const APP_CONFIG = {
  NAME: 'Tourist Safety',
  VERSION: '1.0.0',
  ENVIRONMENT: __DEV__ ? 'development' : 'production',
} as const;

// ==================== STORAGE KEYS ====================
export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@tourist_app/access_token',
  REFRESH_TOKEN: '@tourist_app/refresh_token',
  USER_DATA: '@tourist_app/user_data',
  LOCATION_PERMISSION: '@tourist_app/location_permission',
  THEME_PREFERENCE: '@tourist_app/theme',
} as const;

// ==================== COLOR PALETTE ====================
export const COLORS = {
  // Primary Colors
  primary: '#2563EB',      // Blue
  primaryDark: '#1E40AF',
  primaryLight: '#3B82F6',
  
  // Secondary Colors
  secondary: '#10B981',    // Green
  secondaryDark: '#059669',
  secondaryLight: '#34D399',
  
  // Status Colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  danger: '#DC2626',
  info: '#3B82F6',
  
  // SOS/Emergency
  sos: '#DC2626',
  sosHover: '#B91C1C',
  
  // Neutral Colors
  background: '#F9FAFB',
  backgroundDark: '#111827',
  surface: '#FFFFFF',
  surfaceDark: '#1F2937',
  
  // Text Colors
  text: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  textInverse: '#FFFFFF',
  
  // Border Colors
  border: '#E5E7EB',
  borderDark: '#374151',
  
  // Semantic Colors
  disabled: '#D1D5DB',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadowColor: '#000000',
  
  // Incident Status Colors
  statusPending: '#F59E0B',
  statusInvestigating: '#3B82F6',
  statusResolved: '#10B981',
} as const;

// ==================== TYPOGRAPHY ====================
export const TYPOGRAPHY = {
  // Font Families
  fontFamily: {
    regular: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    medium: Platform.select({
      ios: 'System',
      android: 'Roboto-Medium',
      default: 'System',
    }),
    bold: Platform.select({
      ios: 'System',
      android: 'Roboto-Bold',
      default: 'System',
    }),
  },
  
  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  // Font Weights
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ==================== SPACING ====================
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
} as const;

// ==================== BORDER RADIUS ====================
export const RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

// ==================== DIMENSIONS ====================
const { width, height } = Dimensions.get('window');

export const SCREEN = {
  width,
  height,
  isSmallDevice: width < 375,
  isMediumDevice: width >= 375 && width < 768,
  isLargeDevice: width >= 768,
} as const;

// ==================== ANIMATION ====================
export const ANIMATION = {
  duration: {
    instant: 0,
    fast: 200,
    normal: 300,
    slow: 500,
  },
  easing: {
    ease: 'ease' as const,
    easeIn: 'ease-in' as const,
    easeOut: 'ease-out' as const,
    easeInOut: 'ease-in-out' as const,
  },
} as const;

// ==================== LOCATION CONFIGURATION ====================
export const LOCATION_CONFIG = {
  UPDATE_INTERVAL: 30000, // 30 seconds
  DISTANCE_FILTER: 10, // 10 meters
  ACCURACY: {
    HIGH: 'high',
    MEDIUM: 'balanced',
    LOW: 'low',
  },
  GEOFENCE_RADIUS: 100, // meters
} as const;

// ==================== INCIDENT CONFIGURATION ====================
export const INCIDENT_CONFIG = {
  STATUS: {
    PENDING: 'pending',
    INVESTIGATING: 'investigating',
    RESOLVED: 'resolved',
  },
  AUTO_REFRESH_INTERVAL: 60000, // 1 minute
} as const;

// ==================== VALIDATION RULES ====================
export const VALIDATION = {
  EMAIL: {
    REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MIN_LENGTH: 5,
    MAX_LENGTH: 255,
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128,
    REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/,
  },
  PHONE: {
    REGEX: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
    MIN_LENGTH: 10,
    MAX_LENGTH: 15,
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
  },
} as const;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  UNAUTHORIZED: 'Email or password is incorrect.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  LOCATION_PERMISSION_DENIED: 'Location permission is required for this feature.',
  LOCATION_UNAVAILABLE: 'Unable to retrieve your location. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// ==================== SUCCESS MESSAGES ====================
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  REGISTER_SUCCESS: 'Account created successfully!',
  PROFILE_UPDATE_SUCCESS: 'Profile updated successfully!',
  SOS_SENT_SUCCESS: 'Emergency alert sent! Help is on the way.',
  INCIDENT_CREATED_SUCCESS: 'Incident reported successfully.',
  LOCATION_UPDATED_SUCCESS: 'Location updated successfully.',
} as const;

// ==================== PERMISSIONS ====================
export const PERMISSIONS = {
  LOCATION: 'location',
  NOTIFICATIONS: 'notifications',
  CAMERA: 'camera',
} as const;

// ==================== HTTP STATUS CODES ====================
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500,
} as const;