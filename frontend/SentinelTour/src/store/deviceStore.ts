import { create } from 'zustand';

export interface ConnectedDevice {
  id: string;
  name: string;
  batteryPercentage: number | null;
  isConnected: boolean;
  lastHeartRate: number | null;
  lastSpO2: number | null;
  lastTemperature: number | null;
  lastSeen: Date | null;
}

interface DeviceState {
  device: ConnectedDevice | null;
  isScanning: boolean;

  setDevice: (device: ConnectedDevice | null) => void;
  updateMetrics: (metrics: Partial<ConnectedDevice>) => void;
  setScanning: (v: boolean) => void;
  disconnect: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  device: null,
  isScanning: false,

  setDevice: (device) => set({ device }),

  updateMetrics: (metrics) =>
    set((s) => ({
      device: s.device ? { ...s.device, ...metrics } : null,
    })),

  setScanning: (isScanning) => set({ isScanning }),

  disconnect: () => set({ device: null }),
}));