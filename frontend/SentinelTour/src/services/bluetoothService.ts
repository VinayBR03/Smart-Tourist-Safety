// src/services/bluetoothService.ts
import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Config } from '@/constants/config';
import { useDeviceStore } from '@/store/deviceStore';
import { useAuthStore } from '@/store/authStore';
import { devicesApi } from '@/api/devices';

// BLE keepalive interval — read battery every 30 s to prevent the OS
// from treating the connection as idle and dropping it after ~60 s.
const KEEPALIVE_INTERVAL_MS = 25_000;

class BluetoothService {
  private _manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private backendDeviceId: string | null = null;

  // Scan-state tracking — lets us safely restart the scanner
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private isActivelySanning = false;

  // Keepalive timer for the connected device
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

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

  // ── Scan ──────────────────────────────────────────────
  // Fix: always call stopDeviceScan() BEFORE starting a new scan.
  // This ensures the BleManager internal state is clean even on repeat calls.
  // Returns a stop function that the caller can invoke to cancel early.
  scanForWristband(
    onDeviceFound: (device: Device) => void,
    onError: (error: Error) => void
  ): () => void {
    // Stop any lingering scan from a previous call (prevents "already scanning" state)
    this._stopScanInternal();

    useDeviceStore.getState().setScanning(true);
    this.isActivelySanning = true;

    this.manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          this._stopScanInternal();
          onError(error);
          return;
        }
        if (device) onDeviceFound(device);
      }
    );

    // Auto-stop after 15 s
    this.scanTimer = setTimeout(() => {
      this._stopScanInternal();
    }, 15_000);

    // Return a cancel function for the caller
    return () => { this._stopScanInternal(); };
  }

  private _stopScanInternal() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.isActivelySanning) {
      try { this.manager.stopDeviceScan(); } catch { /* already stopped */ }
      this.isActivelySanning = false;
    }
    useDeviceStore.getState().setScanning(false);
  }

  stopScan() {
    this._stopScanInternal();
  }

  // ── Connect ───────────────────────────────────────────
  async connect(bleDeviceId: string): Promise<void> {
    const device = await this.manager.connectToDevice(bleDeviceId);

    if (Platform.OS === 'android') {
      // Request a higher connection priority to prevent idle timeouts on some devices.
      // 0=Balanced, 1=High, 2=LowPower. This should be done after connecting.
      await device.requestConnectionPriority(1);
    }

    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;

    // Read firmware device_id
    let firmwareDeviceId: string | null = null;
    try {
      const char = await device.readCharacteristicForService(
        Config.BLE_SERVICE_UUID,
        Config.BLE_CHAR_DEVICE_ID_UUID
      );
      if (char.value) {
        firmwareDeviceId = Buffer.from(char.value, 'base64').toString('utf8').trim();
      }
    } catch {
      console.warn('[BLE] device_id char unreadable, using BLE name');
    }

    const resolvedId = firmwareDeviceId ?? device.name ?? device.localName ?? bleDeviceId;
    this.backendDeviceId = resolvedId;

    useDeviceStore.getState().setDevice({
      id: resolvedId,
      name: device.name ?? resolvedId,
      batteryPercentage: null,
      isConnected: true,
      lastHeartRate: null,
      lastSpO2: null,
      lastTemperature: null,
      lastSeen: new Date(),
    });

    this.pairOnBackend(resolvedId).catch((err) =>
      console.warn('[BLE] Backend pairing failed:', err?.response?.status, err?.message)
    );

    this.subscribeToHealth(device);

    // ── Keepalive: read battery every 25 s ──────────────
    // Prevents Android from auto-disconnecting the GATT link after ~60 s of
    // no characteristic traffic. A lightweight battery read is enough to
    // keep the connection alive without wasting significant bandwidth.
    this._startKeepalive(device);

    device.onDisconnected(async () => {
      console.info('[BLE] Device disconnected:', bleDeviceId);
      this._stopKeepalive();
      await this.unpairOnBackend().catch((err) =>
        console.warn('[BLE] Backend unpairing failed:', err?.message)
      );
      useDeviceStore.getState().disconnect();
      this.connectedDevice = null;
      this.backendDeviceId = null;
    });
  }

  private _startKeepalive(device: Device) {
    this._stopKeepalive();
    this.keepaliveTimer = setInterval(async () => {
      try {
        if (!this.connectedDevice) { this._stopKeepalive(); return; }
        // Try battery characteristic first (lightweight read)
        const char = await device.readCharacteristicForService(
          Config.BLE_SERVICE_UUID,
          Config.BLE_CHAR_BATTERY_UUID
        );
        if (char?.value) {
          const raw = Buffer.from(char.value, 'base64');
          useDeviceStore.getState().updateMetrics({ batteryPercentage: raw[0] });
        }
      } catch {
        // Characteristic not readable — connection likely dropped, handler fires separately
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private _stopKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  // ── Backend pair/unpair ───────────────────────────────
  private async pairOnBackend(firmwareDeviceId: string): Promise<void> {
    const user = useAuthStore.getState().user;
    if (!user?.id) { console.warn('[BLE] Cannot pair — not logged in'); return; }
    await devicesApi.pairDevice(firmwareDeviceId);
    console.info('[BLE] Paired on backend:', firmwareDeviceId);
  }

  private async unpairOnBackend(): Promise<void> {
    if (!this.backendDeviceId) return;
    await devicesApi.unpairDevice();
    console.info('[BLE] Unpaired on backend:', this.backendDeviceId);
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
          const data = JSON.parse(Buffer.from(characteristic.value, 'base64').toString('utf8'));
          updateMetrics({
            lastHeartRate:     data.hr   ?? null,
            lastSpO2:          data.spo2 ?? null,
            lastTemperature:   data.temp ?? null,
            batteryPercentage: data.bat  ?? null,
            lastSeen:          new Date(),
          });
        } catch { /* malformed */ }
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

  // ── Manual disconnect ─────────────────────────────────
  async disconnect(): Promise<void> {
    this._stopKeepalive();
    await this.unpairOnBackend().catch((err) =>
      console.warn('[BLE] Unpair on manual disconnect failed:', err?.message)
    );
    if (this.connectedDevice) {
      try { await this.connectedDevice.cancelConnection(); } catch { /* already gone */ }
      this.connectedDevice = null;
    }
    this.backendDeviceId = null;
    useDeviceStore.getState().disconnect();
  }

  destroy() {
    this._stopKeepalive();
    this._stopScanInternal();
    this._manager?.destroy();
    this._manager = null;
  }
}

export const bluetoothService = new BluetoothService();