import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Config } from '@/constants/config';
import { useDeviceStore } from '@/store/deviceStore';
import { useAuthStore } from '@/store/authStore';
import { devicesApi } from '@/api/devices';

class BluetoothService {
  private _manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  // BLE device ID → backend device ID mapping (from BLE advertisement)
  private backendDeviceId: string | null = null;

  private get manager(): BleManager {
    if (!this._manager) this._manager = new BleManager();
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
      null,
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

  async connect(bleDeviceId: string): Promise<void> {
    const device = await this.manager.connectToDevice(bleDeviceId);
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;

    // The backend device ID is broadcast in the BLE local name or
    // a manufacturer data characteristic. Here we use the BLE device
    // name as the backend serial number lookup key.
    // Adjust this if your ESP32-C3 firmware broadcasts differently.
    const deviceName = device.name ?? device.localName ?? bleDeviceId;
    this.backendDeviceId = deviceName;

    // 1. Update local store immediately so UI is responsive
    useDeviceStore.getState().setDevice({
      id:                bleDeviceId,
      name:              deviceName,
      batteryPercentage: null,
      isConnected:       true,
      lastHeartRate:     null,
      lastSpO2:          null,
      lastTemperature:   null,
      lastSeen:          new Date(),
    });

    // 2. Assign on backend (best-effort — don't block UI)
    this.assignOnBackend(deviceName).catch((err) => {
      console.warn('[BLE] Backend assignment failed:', err?.response?.status, err?.message);
      // Device still works locally even if backend assignment fails
    });

    // 3. Subscribe to health metrics
    this.subscribeToHealth(device);

    // 4. Handle disconnect
    device.onDisconnected(async () => {
      console.info('[BLE] Device disconnected:', bleDeviceId);
      await this.unassignOnBackend().catch((err) =>
        console.warn('[BLE] Backend unassignment failed:', err?.message)
      );
      useDeviceStore.getState().disconnect();
      this.connectedDevice   = null;
      this.backendDeviceId   = null;
    });
  }

  // ── Backend assignment ────────────────────────────────
  private async assignOnBackend(deviceSerialOrId: string): Promise<void> {
    const user = useAuthStore.getState().user;
    if (!user?.id) {
      console.warn('[BLE] Cannot assign — user not logged in');
      return;
    }

    // Try to find the device in the backend by serial/name
    // The admin registers devices with a serial_number that matches
    // what the ESP32-C3 broadcasts as its BLE name.
    try {
      const devices = await devicesApi.listMine();
      const match   = devices.find(
        (d) =>
          d.serial_number === deviceSerialOrId ||
          d.id === deviceSerialOrId
      );

      if (!match) {
        console.warn(
          '[BLE] Device not found in backend registry:',
          deviceSerialOrId,
          '— assignment skipped. Ask admin to register the device first.'
        );
        return;
      }

      await devicesApi.assignToMe(match.id, user.id);
      console.info('[BLE] Device assigned on backend:', match.id, '→ tourist', user.id);
    } catch (err: any) {
      // 409 = already assigned to this tourist — that's fine
      if (err?.response?.status === 409) {
        console.info('[BLE] Device already assigned to this tourist');
        return;
      }
      throw err;
    }
  }

  private async unassignOnBackend(): Promise<void> {
    if (!this.backendDeviceId) return;

    try {
      const devices = await devicesApi.listMine();
      const match   = devices.find(
        (d) =>
          d.serial_number === this.backendDeviceId ||
          d.id === this.backendDeviceId
      );
      if (!match) return;

      await devicesApi.unassign(match.id);
      console.info('[BLE] Device unassigned on backend:', match.id);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 204) return;
      throw err;
    }
  }

  // ── Health subscriptions ──────────────────────────────
  private subscribeToHealth(device: Device) {
    const { updateMetrics } = useDeviceStore.getState();

    device.monitorCharacteristicForService(
      Config.BLE_SERVICE_UUID,
      Config.BLE_CHAR_HEALTH_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        try {
          const raw  = Buffer.from(characteristic.value, 'base64').toString('utf8');
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

  // ── Public disconnect ─────────────────────────────────
  async disconnect(): Promise<void> {
    // Unassign backend first
    await this.unassignOnBackend().catch((err) =>
      console.warn('[BLE] Unassign on manual disconnect failed:', err?.message)
    );

    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch { /* device already gone */ }
      this.connectedDevice = null;
    }

    this.backendDeviceId = null;
    useDeviceStore.getState().disconnect();
  }

  destroy() {
    this._manager?.destroy();
    this._manager = null;
  }
}

export const bluetoothService = new BluetoothService();