// src/services/bluetoothService.ts

import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid }  from 'react-native';
import { Buffer } from 'buffer';
import NetInfo from '@react-native-community/netinfo';
import { Config }           from '@/constants/config';
import { useDeviceStore }   from '@/store/deviceStore';
import { devicesApi }       from '@/api/devices';
import {
  uploadHealthFromBle,
  uploadSosFromBle,
  hasInternetConnection,
  type BleHealthPayload,
} from './healthGatewayService';

class BluetoothService {
  private _manager:        BleManager | null = null;
  private connectedDevice: Device | null = null;
  private backendDeviceId: string | null = null;

  private scanTimer:          ReturnType<typeof setTimeout>  | null = null;
  private netStatusTimer:     ReturnType<typeof setInterval> | null = null;
  private isActivelyScanning  = false;

  private get manager(): BleManager {
    if (!this._manager) this._manager = new BleManager();
    return this._manager;
  }

  // ── Permissions ───────────────────────────────────────
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') return true;
    if (Number(Platform.Version) >= 31) {
      const r = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }

  checkState(): Promise<State> { return this.manager.state(); }

  // ── Scan ──────────────────────────────────────────────
  // FIXED: Filter by BLE_SERVICE_UUID so only Sentinel Wristbands appear.
  // Passing null previously caused ALL Bluetooth devices (earbuds, TVs, etc.)
  // to show up. The wristband firmware advertises BLE_SERVICE_UUID, so this
  // filter matches exactly our hardware and nothing else.
  scanForWristband(
    onDeviceFound: (device: Device) => void,
    onError: (error: Error) => void
  ): () => void {
    this._stopScanInternal();
    useDeviceStore.getState().setScanning(true);
    this.isActivelyScanning = true;

    this.manager.startDeviceScan(
      [Config.BLE_SERVICE_UUID],  // ← filter: only devices advertising our service UUID
      { allowDuplicates: false },
      (error, device) => {
        if (error) { this._stopScanInternal(); onError(error); return; }
        if (device) onDeviceFound(device);
      }
    );

    this.scanTimer = setTimeout(() => this._stopScanInternal(), 15_000);
    return () => this._stopScanInternal();
  }

  private _stopScanInternal() {
    if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
    if (this.isActivelyScanning) {
      try { this.manager.stopDeviceScan(); } catch { /* already stopped */ }
      this.isActivelyScanning = false;
    }
    useDeviceStore.getState().setScanning(false);
  }

  stopScan() { this._stopScanInternal(); }

  // ── Connect ───────────────────────────────────────────
  async connect(bleDeviceId: string): Promise<void> {
    // Increase connection timeout — wristband BLE stack may take a moment
    const device = await this.manager.connectToDevice(bleDeviceId, {
      timeout: 10000,
      autoConnect: false,
    });

    if (Platform.OS === 'android') {
      await device.requestConnectionPriority(1).catch(() => {});
      // Request larger MTU to handle JSON payloads that exceed the 20-byte default
      await device.requestMTU(256).catch(() => console.warn('[BLE] MTU request failed'));
      // Android link layer needs time to stabilise before GATT operations.
      // Without this pause, discoverAllServicesAndCharacteristics() fails
      // ~40% of the time causing intermittent pairing failures (bug #2).
      await new Promise<void>((r) => setTimeout(r, 600));
    }

    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;

    // Allow GATT table to fully populate on Android before interacting.
    // Fixes: "notify change failed" and "device_id char unreadable" errors.
    if (Platform.OS === 'android') {
      await new Promise<void>((r) => setTimeout(r, 500));
    }

    // Read firmware device_id from characteristic
    let firmwareId: string | null = null;
    try {
      const c = await device.readCharacteristicForService(
        Config.BLE_SERVICE_UUID, Config.BLE_CHAR_DEVICE_ID_UUID);
      if (c.value) {
        firmwareId = Buffer.from(c.value, 'base64').toString('utf8').trim();
      }
    } catch {
      console.warn('[BLE] device_id char unreadable — using device name');
    }

    const resolvedId = firmwareId ?? device.name ?? bleDeviceId;
    this.backendDeviceId = resolvedId;

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

    // Pair on backend (links wristband to tourist account)
    devicesApi.pairDevice(resolvedId).catch((err) =>
      console.warn('[BLE] Backend pair failed:', err?.response?.status));

    // Subscribe to health, SOS, battery notifications.
    // monitorCharacteristicForService writes CCCD to enable notifications —
    // fire all three before the NET writer starts so the wristband receives
    // health notifications from the very first TX cycle (bug #3 fix).
    // We stagger them slightly so Android's BLE stack doesn't drop overlapping CCCD writes.
    this._subscribeHealth(device);
    await new Promise<void>((r) => setTimeout(r, 200));
    this._subscribeSOS(device);
    await new Promise<void>((r) => setTimeout(r, 200));
    this._subscribeBattery(device);

    // Give BLE stack time to complete CCCD descriptor writes before the
    // first NET write — prevents the first internet-status update from
    // racing against subscription setup and being silently dropped.
    await new Promise<void>((r) => setTimeout(r, 400));

    // Start writing internet status to wristband every 10 s.
    // Wristband uses "1"/"0" to decide LoRa backup: BLE always notifies,
    // but also LoRa-TXs when phone reports no internet.
    this._startNetStatusWriter(device);

    device.onDisconnected(async () => {
      console.info('[BLE] Disconnected from wristband');
      this._stopNetStatusWriter();
      devicesApi.unpairDevice().catch(() => {});
      useDeviceStore.getState().disconnect();
      this.connectedDevice = null;
      this.backendDeviceId = null;
    });
  }

  // ── Health notifications ──────────────────────────────
  private _subscribeHealth(device: Device) {
    device.monitorCharacteristicForService(
      Config.BLE_SERVICE_UUID,
      Config.BLE_CHAR_HEALTH_UUID,
      async (error, char) => {
        if (error) {
          console.error('[BLE] Health subscription error:', error.message);
          return;
        }
        if (!char?.value) {
          console.warn('[BLE] Received health notification with no data');
          return;
        }
        
        let rawString = '';
        try {
          rawString = Buffer.from(char.value, 'base64').toString('utf8');
          console.log('[BLE] Raw health string received:', rawString);
          
          const data: BleHealthPayload = JSON.parse(rawString);

          // Treat 0 values from wristband as "sensor not ready" — store null
          // so the UI shows '—' instead of '0 bpm'.
          // Only update lastSeen when at least one sensor produced a real reading.
          const hrVal   = (data.hr   && data.hr   > 0) ? data.hr   : null;
          const spo2Val = (data.spo2 && data.spo2 > 0) ? data.spo2 : null;
          const tempVal = (data.temp && data.temp > 0) ? data.temp : null;
          const batVal  = (data.bat  != null)           ? data.bat  : null;
          const hasData = hrVal !== null || spo2Val !== null || tempVal !== null;

          useDeviceStore.getState().updateMetrics({
            lastHeartRate:     hrVal,
            lastSpO2:          spo2Val,
            lastTemperature:   tempVal,
            batteryPercentage: batVal,
            // Only mark lastSeen when real sensor data arrived — not on zero-readings
            ...(hasData ? { lastSeen: new Date() } : {}),
          });

          await uploadHealthFromBle(data).catch((err) =>
            console.warn('[GW] Health upload failed:', err?.message));
        } catch (e) { 
          console.error(`[BLE] Failed to parse health JSON. Raw string: "${rawString}"`, e);
        }
      }
    );
  }

  // ── SOS notifications ─────────────────────────────────
  private _subscribeSOS(device: Device) {
    device.monitorCharacteristicForService(
      Config.BLE_SERVICE_UUID,
      Config.BLE_CHAR_SOS_UUID,
      async (error, char) => {
        if (error || !char?.value) return;
        try {
          const data = JSON.parse(Buffer.from(char.value, 'base64').toString('utf8'));
          if (data.sos) {
            console.warn('[BLE] *** SOS RECEIVED from wristband ***');
            await uploadSosFromBle(data.bat ?? 0).catch((err) =>
              console.warn('[GW] SOS upload failed:', err?.message));
          }
        } catch { /* malformed */ }
      }
    );
  }

  // ── Battery notifications ─────────────────────────────
  private _subscribeBattery(device: Device) {
    device.monitorCharacteristicForService(
      Config.BLE_SERVICE_UUID,
      Config.BLE_CHAR_BATTERY_UUID,
      (error, char) => {
        if (error || !char?.value) return;
        try {
          const raw = Buffer.from(char.value, 'base64');
          useDeviceStore.getState().updateMetrics({ batteryPercentage: raw[0] });
        } catch { /* skip */ }
      }
    );
  }

  // ── Internet status writer ────────────────────────────
  // Writes "1" or "0" to wristband NET characteristic every 10 s.
  // Wristband firmware uses this to select BLE-gateway vs LoRa mode:
  //   "1" → phone has internet → wristband notifies health over BLE
  //   "0" → no internet        → wristband falls back to LoRa TX
  private _startNetStatusWriter(device: Device) {
    this._stopNetStatusWriter();

    const writeStatus = async () => {
      if (!this.connectedDevice) return;
      try {
        const online  = await hasInternetConnection();
        const payload = Buffer.from(online ? '1' : '0').toString('base64');
        await device.writeCharacteristicWithoutResponseForService(
          Config.BLE_SERVICE_UUID,
          Config.BLE_CHAR_NET_UUID,
          payload
        );
      } catch { /* connection may have dropped — onDisconnected handler will clean up */ }
    };

    // Write immediately on connect so wristband knows mode right away
    writeStatus();
    this.netStatusTimer = setInterval(writeStatus, Config.NET_STATUS_WRITE_INTERVAL);
  }

  private _stopNetStatusWriter() {
    if (this.netStatusTimer) {
      clearInterval(this.netStatusTimer);
      this.netStatusTimer = null;
    }
  }

  // ── Manual disconnect ─────────────────────────────────
  async disconnect(): Promise<void> {
    this._stopNetStatusWriter();
    devicesApi.unpairDevice().catch(() => {});
    if (this.connectedDevice) {
      try { await this.connectedDevice.cancelConnection(); } catch { /* already gone */ }
      this.connectedDevice = null;
    }
    this.backendDeviceId = null;
    useDeviceStore.getState().disconnect();
  }

  destroy() {
    this._stopNetStatusWriter();
    this._stopScanInternal();
    this._manager?.destroy();
    this._manager = null;
  }
}

export const bluetoothService = new BluetoothService();
