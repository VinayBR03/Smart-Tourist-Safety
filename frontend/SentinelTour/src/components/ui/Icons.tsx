import Svg, {
  Path, Circle, Rect, Line, Polyline, Polygon,
  G, Defs, LinearGradient, Stop, ClipPath,
} from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const D = (size = 24, color = 'currentColor', sw = 2) => ({
  size,
  color,
  strokeWidth: sw,
  fill: 'none',
  stroke: color,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const Icon = {
  Home: ({ size = 24, color = '#fff', strokeWidth = 2 }: IconProps) => {
    const p = D(size, color, strokeWidth);
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Polyline points="9 22 9 12 15 12 15 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
  },

  Map: ({ size = 24, color = '#fff', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1="8" y1="2" x2="8" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="16" y1="6" x2="16" y2="22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Heart: ({ size = 24, color = '#ef4444', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  HeartPulse: ({ size = 24, color = '#ef4444', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M3.22 12H9.5l1.5-3 3 6 1.5-3h5.27" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  AlertTriangle: ({ size = 24, color = '#f59e0b', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Bell: ({ size = 24, color = '#fff', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Shield: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  ShieldAlert: ({ size = 24, color = '#ef4444', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="12" y1="16" x2="12.01" y2="16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  MapPin: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={strokeWidth}/>
    </Svg>
  ),

  Navigation: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="3 11 22 2 13 21 11 13 3 11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Search: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth}/>
      <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  X: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  ChevronRight: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  ChevronLeft: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 18 9 12 15 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  ChevronDown: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="6 9 12 15 18 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Settings: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth}/>
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  User: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={strokeWidth}/>
    </Svg>
  ),

  Activity: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Thermometer: ({ size = 24, color = '#f59e0b', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Droplet: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Battery: ({ size = 24, color = '#10b981', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="1" y="6" width="18" height="12" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth}/>
      <Line x1="23" y1="13" x2="23" y2="11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Bluetooth: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Wifi: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.55a11 11 0 0114.08 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M1.42 9a16 16 0 0121.16 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M8.53 16.11a6 6 0 016.95 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1="12" y1="20" x2="12.01" y2="20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  WifiOff: ({ size = 24, color = '#6b7280', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Path d="M16.72 11.06A10.94 10.94 0 0119 12.55" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M5 12.55a11 11 0 0114.08 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
      <Path d="M10.71 5.05A16 16 0 0122.56 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M1.42 9a15.91 15.91 0 014.7-2.88" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M8.53 16.11a6 6 0 016.95 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1="12" y1="20" x2="12.01" y2="20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Camera: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth={strokeWidth}/>
    </Svg>
  ),

  Video: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="23 7 16 12 23 17 23 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth}/>
    </Svg>
  ),

  Upload: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Polyline points="17 8 12 3 7 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1="12" y1="3" x2="12" y2="15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Trash: ({ size = 24, color = '#ef4444', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="3 6 5 6 21 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M10 11v6M14 11v6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  CheckCircle: ({ size = 24, color = '#10b981', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Polyline points="22 4 12 14.01 9 11.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Clock: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
      <Polyline points="12 6 12 12 16 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Lock: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth}/>
      <Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  LogOut: ({ size = 24, color = '#ef4444', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Edit: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Globe: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
      <Line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Phone: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Info: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
      <Line x1="12" y1="16" x2="12" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="12" y1="8" x2="12.01" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Layers: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="12 2 2 7 12 12 22 7 12 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Polyline points="2 17 12 22 22 17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Polyline points="2 12 12 17 22 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  RefreshCw: ({ size = 24, color = '#3b82f6', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="23 4 23 10 17 10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Polyline points="1 20 1 14 7 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Zap: ({ size = 24, color = '#f59e0b', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Wind: ({ size = 24, color = '#06b6d4', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  List: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="8" y1="6" x2="21" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="8" y1="12" x2="21" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="8" y1="18" x2="21" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="3" y1="6" x2="3.01" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="3" y1="12" x2="3.01" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="3" y1="18" x2="3.01" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  Plus: ({ size = 24, color = '#fff', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),

  ArrowLeft: ({ size = 24, color = '#fff', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="19" y1="12" x2="5" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Polyline points="12 19 5 12 12 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Eye: ({ size = 24, color = '#9ca3af', strokeWidth = 2, showPw = false }: IconProps & { showPw?: boolean }) => (
    showPw ? (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ) : (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    )
  ),

  Moon: ({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  ),

  Sun: ({ size = 24, color = '#f59e0b', strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={strokeWidth}/>
      <Line x1="12" y1="1"  x2="12" y2="3"  stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="12" y1="21" x2="12" y2="23" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="1" y1="12"  x2="3" y2="12"  stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="21" y1="12" x2="23" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </Svg>
  ),
};