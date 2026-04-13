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

    // ── Step 1: Read the firmware device_id from the dedicated BLE characteristic.
    // This is the backend device_id (e.g. "WB001"), NOT the BLE MAC address.
    // Fallback to BLE name if the characteristic isn't readable (older firmware).
    let firmwareDeviceId: string | null = null;
    try {
      const characteristic = await device.readCharacteristicForService(
        Config.BLE_SERVICE_UUID,
        Config.BLE_CHAR_DEVICE_ID_UUID,
      );
      if (characteristic.value) {
        firmwareDeviceId = Buffer.from(characteristic.value, 'base64')
          .toString('utf8')
          .trim();
      }
    } catch (err) {
      console.warn('[BLE] Could not read device_id characteristic — falling back to BLE name:', err);
    }

    // Final fallback: use BLE advertisement name
    const resolvedId = firmwareDeviceId ?? device.name ?? device.localName ?? bleDeviceId;
    this.backendDeviceId = resolvedId;

    // ── Step 2: Update local store immediately so UI is responsive
    useDeviceStore.getState().setDevice({
      id:                resolvedId,
      name:              device.name ?? resolvedId,
      batteryPercentage: null,
      isConnected:       true,
      lastHeartRate:     null,
      lastSpO2:          null,
      lastTemperature:   null,
      lastSeen:          new Date(),
    });

    // ── Step 3: Pair on backend (best-effort — don't block UI)
    // Uses POST /devices/{firmware_id}/pair (TOURIST JWT)
    this.pairOnBackend(resolvedId).catch((err) => {
      console.warn('[BLE] Backend pairing failed:', err?.response?.status, err?.message);
      // Device still works locally for health reading even if pairing fails
    });

    // ── Step 4: Subscribe to health metrics
    this.subscribeToHealth(device);

    // ── Step 5: Handle disconnect — auto-unpair on backend
    device.onDisconnected(async () => {
      console.info('[BLE] Device disconnected:', bleDeviceId);
      await this.unpairOnBackend().catch((err) =>
        console.warn('[BLE] Backend unpairing failed:', err?.message)
      );
      useDeviceStore.getState().disconnect();
      this.connectedDevice = null;
      this.backendDeviceId = null;
    });
  }

  // ── Backend pairing (BLE connect → assign to self) ──────────
  private async pairOnBackend(firmwareDeviceId: string): Promise<void> {
    const user = useAuthStore.getState().user;
    if (!user?.id) {
      console.warn('[BLE] Cannot pair — user not logged in');
      return;
    }
    // 409 = already assigned to this tourist — idempotent, not an error
    await devicesApi.pairDevice(firmwareDeviceId);
    console.info('[BLE] Device paired on backend:', firmwareDeviceId, '→ tourist', user.id);
  }

  // ── Backend unpairing (BLE disconnect → unassign self) ───────
  private async unpairOnBackend(): Promise<void> {
    if (!this.backendDeviceId) return;
    await devicesApi.unpairDevice();
    console.info('[BLE] Device unpaired on backend:', this.backendDeviceId);
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
    // Unpair on backend before dropping the BLE connection
    await this.unpairOnBackend().catch((err) =>
      console.warn('[BLE] Unpair on manual disconnect failed:', err?.message)
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