import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Config } from '@/constants/config';
import { useDeviceStore } from '@/store/deviceStore';

class BluetoothService {
  private _manager: BleManager | null = null;
  private connectedDevice: Device | null = null;

  // Lazy getter — BleManager is only created when first needed,
  // never at module evaluation time
  private get manager(): BleManager {
    if (!this._manager) {
      this._manager = new BleManager();
    }
    return this._manager;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') return true;

    if (Number(Platform.Version) >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  checkState(): Promise<State> {
    return this.manager.state();
  }

  scanForWristband(
    onDeviceFound: (device: Device) => void,
    onError: (error: Error) => void
  ): () => void {
    useDeviceStore.getState().setScanning(true);

    this.manager.startDeviceScan(
      [Config.BLE_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          useDeviceStore.getState().setScanning(false);
          onError(error);
          return;
        }
        if (device) onDeviceFound(device);
      }
    );

    const timer = setTimeout(() => {
      this.manager.stopDeviceScan();
      useDeviceStore.getState().setScanning(false);
    }, 15_000);

    return () => {
      clearTimeout(timer);
      this.manager.stopDeviceScan();
      useDeviceStore.getState().setScanning(false);
    };
  }

  stopScan() {
    this.manager.stopDeviceScan();
    useDeviceStore.getState().setScanning(false);
  }

  async connect(deviceId: string): Promise<void> {
    const device = await this.manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;

    useDeviceStore.getState().setDevice({
      id: device.id,
      name: device.name ?? 'Sentinel Wristband',
      batteryPercentage: null,
      isConnected: true,
      lastHeartRate: null,
      lastSpO2: null,
      lastTemperature: null,
      lastSeen: new Date(),
    });

    this.subscribeToHealth(device);

    device.onDisconnected(() => {
      useDeviceStore.getState().disconnect();
      this.connectedDevice = null;
    });
  }

  private subscribeToHealth(device: Device) {
    const { updateMetrics } = useDeviceStore.getState();

    device.monitorCharacteristicForService(
      Config.BLE_SERVICE_UUID,
      Config.BLE_CHAR_HEALTH_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        try {
          const raw = Buffer.from(characteristic.value, 'base64').toString('utf8');
          const data = JSON.parse(raw);
          updateMetrics({
            lastHeartRate:     data.hr   ?? null,
            lastSpO2:          data.spo2 ?? null,
            lastTemperature:   data.temp ?? null,
            batteryPercentage: data.bat  ?? null,
            lastSeen:          new Date(),
          });
        } catch { /* malformed packet */ }
      }
    );

    device.monitorCharacteristicForService(
      Config.BLE_SERVICE_UUID,
      Config.BLE_CHAR_BATTERY_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        try {
          const raw = Buffer.from(characteristic.value, 'base64');
          updateMetrics({ batteryPercentage: raw[0] });
        } catch { /* skip */ }
      }
    );
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch { /* device already gone */ }
      this.connectedDevice = null;
    }
    useDeviceStore.getState().disconnect();
  }

  destroy() {
    this._manager?.destroy();
    this._manager = null;
  }
}

// The class itself is safe to export — the BleManager is not
// created until the first method call
export const bluetoothService = new BluetoothService();