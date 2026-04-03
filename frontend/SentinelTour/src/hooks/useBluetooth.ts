import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { bluetoothService } from '@/services/bluetoothService';
import { useDeviceStore } from '@/store/deviceStore';

export function useBluetooth() {
  const [discovered, setDiscovered] = useState<Device[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [stopScanFn, setStopScanFn] = useState<(() => void) | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const { isScanning, device } = useDeviceStore();

  const startScan = useCallback(async () => {
    setError(null);
    setDiscovered([]);

    const granted = await bluetoothService.requestPermissions();
    if (!granted) {
      setError('Bluetooth permission denied.');
      return;
    }

    const stop = bluetoothService.scanForWristband(
      (dev) => {
        setDiscovered((prev) =>
          prev.find((d) => d.id === dev.id) ? prev : [...prev, dev]
        );
      },
      (err) => setError(err.message)
    );

    setStopScanFn(() => stop);
  }, []);

  const stopScan = useCallback(() => {
    stopScanFn?.();
    setStopScanFn(null);
  }, [stopScanFn]);

  const connect = useCallback(async (deviceId: string) => {
    setConnecting(deviceId);
    stopScan();

    try {
      await bluetoothService.connect(deviceId);
      setDiscovered([]);
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message ?? 'Could not connect.');
    } finally {
      setConnecting(null);
    }
  }, [stopScan]);

  const disconnect = useCallback(async () => {
    await bluetoothService.disconnect();
  }, []);

  useEffect(() => () => stopScanFn?.(), [stopScanFn]);

  return {
    discovered,
    connecting,
    isScanning,
    connectedDevice: device,
    error,
    startScan,
    stopScan,
    connect,
    disconnect,
  };
}