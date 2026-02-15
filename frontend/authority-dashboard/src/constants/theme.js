// src/constants/theme.js - FIXED VERSION

export const COLORS = {
  // Status Colors
  status: {
    green: '#10B981',
    yellow: '#F59E0B',
    orange: '#F97316',
    red: '#EF4444',
  },
  
  // ✅ FIXED: Incident Status - Mapped to Backend
  incident: {
    open: '#F59E0B',           // Yellow - Open/Pending
    in_progress: '#2563EB',    // Blue - In Progress
    resolved: '#10B981',       // Green - Resolved
  },
  
  // UI Colors
  primary: '#2563EB',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
};

export const getRiskColor = (level) => {
  const colors = {
    green: COLORS.status.green,
    yellow: COLORS.status.yellow,
    orange: COLORS.status.orange,
    red: COLORS.status.red,
  };
  return colors[level] || COLORS.gray[400];
};

// ✅ FIXED: Status color mapping for backend statuses
export const getStatusColor = (status) => {
  const colors = {
    open: COLORS.incident.open,
    in_progress: COLORS.incident.in_progress,
    resolved: COLORS.incident.resolved,
  };
  return colors[status] || COLORS.gray[400];
};

// ✅ NEW: Get status badge classes
export const getStatusBadgeClass = (status) => {
  const classes = {
    open: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};