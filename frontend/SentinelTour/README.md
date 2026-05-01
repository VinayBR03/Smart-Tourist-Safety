# 📱 Sentinel Tour — Tourist Mobile App

The tourist-facing mobile app for the Sentinel Tour platform. Built with **Expo (SDK 54)** and **React Native 0.81**, using **Expo Router** for file-based navigation. Available on **iOS** and **Android**.

---

## 📁 Folder Structure

```bash
sentineltour-app/
├── app/                            # Expo Router file-based routes
│   ├── _layout.tsx                 # Root layout (auth state, splash, fonts)
│   ├── index.tsx                   # Entry redirect → (auth) or (tabs)
│   ├── (auth)/                     # Unauthenticated screens
│   │   ├── language-select.tsx     # Language picker (first launch)
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                     # Bottom tab navigator
│   │   ├── index.tsx               # Home — safety score, quick actions
│   │   ├── map.tsx                 # Live map with geo-fence overlays
│   │   ├── sos.tsx                 # SOS emergency trigger screen
│   │   ├── health.tsx              # Live health vitals from wristband
│   │   └── notifications.tsx       # Push notification centre
│   ├── devices/                    # Wristband Bluetooth pairing
│   ├── incidents/                  # Incident list + detail ([id].tsx)
│   ├── profile/                    # Tourist profile & digital ID
│   └── settings/                   # App settings
├── src/
│   ├── api/                        # Axios API clients per domain
│   │   ├── client.ts               # Base axios instance + JWT interceptor
│   │   ├── auth.ts
│   │   ├── devices.ts
│   │   ├── health.ts
│   │   ├── incidents.ts
│   │   ├── location.ts
│   │   ├── media.ts
│   │   ├── notifications.ts
│   │   └── zones.ts
│   ├── components/
│   │   ├── layout/                 # Header, ScreenWrapper, ThemedView
│   │   ├── map/                    # MapSearchBar, ZoneOverlay
│   │   └── ui/                     # Avatar, Badge, Button, Card, HealthMetricCard, Icons
│   ├── constants/
│   │   ├── config.ts               # API_BASE_URL, WS_BASE_URL, BLE UUIDs, intervals
│   │   └── theme.ts                # Design tokens (colours, spacing, typography)
│   ├── context/
│   │   └── ThemeContext.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useBluetooth.ts         # BLE scan, connect, characteristic subscriptions
│   │   ├── useHealth.ts            # Polls health data from backend
│   │   ├── useIncidents.ts
│   │   ├── useLocation.ts          # expo-location background tracking
│   │   ├── useNotifications.ts
│   │   └── useZones.ts
│   ├── services/
│   │   ├── bluetoothService.ts     # BleManager singleton — scan, connect, notify
│   │   ├── healthGatewayService.ts # BLE → backend bridge (health + SOS forwarding)
│   │   ├── locationService.ts      # Background GPS updates → backend
│   │   └── websocket.ts            # Reconnecting WebSocket (WS + notifications)
│   ├── store/                      # Zustand stores
│   │   ├── authStore.ts            # JWT tokens, user profile
│   │   ├── deviceStore.ts          # Connected BLE device state
│   │   ├── notificationStore.ts
│   │   └── themeStore.ts
│   ├── types/                      # TypeScript interfaces
│   └── utils/
│       ├── i18n.ts                 # Translation strings — en, hi, kn, te, ta, ml
│       ├── queryClientSingleton.ts
│       ├── storage.ts              # expo-secure-store wrapper
│       ├── themedStyles.ts
│       └── websocket.ts
├── assets/                         # App icons, splash, logos
├── app.config.js                   # Expo config (bundle ID, permissions, plugins)
├── eas.json                        # EAS Build profiles
├── package.json
└── yarn.lock
```

---

## ⚙️ Environment Variables

Create a `.env` file at the repo root:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

For EAS Cloud builds, `google-services.json` is decoded from a base64 secret:

```bash
# Set in EAS Secrets dashboard
GOOGLE_SERVICES_BASE64=<base64-encoded google-services.json>
```

For local dev, place `google-services.json` directly in the project root.

---

## 🚀 Running Locally

### Prerequisites

| Tool | Version |
| ------ | --------- |
| Node.js | 18+ |
| Yarn | 4.x (corepack) |
| Expo CLI | Latest |
| Android Studio / Xcode | For native builds |

```bash
# Install dependencies
cd sentineltour-app
corepack enable
yarn install

# Start Expo dev server
yarn start

# Run on Android emulator
yarn android

# Run on iOS simulator
yarn ios
```

API connects to `http://<your-machine-ip>:8000` automatically via `expo-constants` host detection. Ensure the backend is running locally.

---

## 🏗️ Building for Distribution

### EAS Build (recommended)

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Preview build (APK / IPA for testing)
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Production build
eas build --platform all --profile production
```

### Local Build

```bash
# Generate native projects
yarn prebuild

# Android
yarn android --variant release

# iOS
cd ios && pod install && cd ..
yarn ios --configuration Release
```

---

## 📲 App Screens

| Screen | Route | Description |
| -------- | ------- | ------------- |
| Language Select | `/(auth)/language-select` | First-launch language picker |
| Login | `/(auth)/login` | JWT login |
| Register | `/(auth)/register` | Tourist registration |
| Home | `/(tabs)/` | Safety score, quick-action tiles |
| Live Map | `/(tabs)/map` | GPS map with geo-fence overlays |
| SOS | `/(tabs)/sos` | One-tap emergency SOS trigger |
| Health | `/(tabs)/health` | Live HR, SpO₂, Temp from wristband |
| Notifications | `/(tabs)/notifications` | Push notification centre |
| Devices | `/devices` | Bluetooth wristband pairing |
| Incidents | `/incidents` | Incident list |
| Incident Detail | `/incidents/[id]` | Full incident view + media |
| Profile | `/profile` | Tourist profile & digital ID QR |
| Settings | `/settings` | Language, notifications, logout |

---

## 📡 Bluetooth (BLE) Integration

The app connects to the IoT wristband via **BLE** using `react-native-ble-plx`. The phone acts as a **BLE-to-internet gateway** — the wristband has no WiFi, so the app forwards data to the backend.

### BLE Service & Characteristics

All on Service UUID `12345678-1234-1234-1234-123456789abc`:

| Characteristic | UUID suffix | Mode | Data |
| ---------------- | ------------ | ------ | ------ |
| Device ID | `...ab0` | READ | Band's backend device ID |
| Health | `...abd` | NOTIFY | `{"hr":72,"spo2":98,"temp":36.5,"bat":80}` |
| Battery | `...abe` | NOTIFY | Battery percentage |
| SOS | `...abf` | NOTIFY | SOS trigger event |
| Network Status | `...ac0` | WRITE | Phone writes internet connectivity to band |

### Health Gateway Flow

```text
Wristband sends health NOTIFY over BLE
    → bluetoothService.ts receives characteristic update
    → healthGatewayService.ts parses payload
    → POST /iot/gateway/health (tourist JWT)
    → If N consecutive alerts exceed threshold → POST /iot/gateway/sos
```

The phone also writes internet connectivity status to the band every 10 seconds (`NET_STATUS_WRITE_INTERVAL`) so the wristband UI can show network state.

---

## 📍 Location Tracking

- `expo-location` with `BACKGROUND_FETCH` permission
- GPS sent to `POST /location/update` every `30,000 ms` (configurable via `Config.LOCATION_UPDATE_INTERVAL`)
- Used for live map display in the web dashboard and geo-fence breach detection

---

## 🔔 Push Notifications

- **Firebase Cloud Messaging (FCM)** via `expo-notifications`
- `google-services.json` required for Android builds
- Receives alerts for: SOS confirmation, geo-fence breach, incident updates, health anomalies

---

## 🌐 Multilingual Support

6 languages supported via `src/utils/i18n.ts` (Zustand-backed store):

| Code | Language |
| ------ | --------- |
| `en` | English |
| `hi` | Hindi |
| `kn` | Kannada |
| `te` | Telugu |
| `ta` | Tamil |
| `ml` | Malayalam |

Language selection persists via `expo-secure-store`. Users select language on first launch (`/(auth)/language-select`) and can change it in Settings.

---

## 🔐 Auth & Storage

- JWT access + refresh tokens stored in `expo-secure-store` (hardware-backed on device)
- Store keys: `sentinel_access_token`, `sentinel_refresh_token`
- `authStore.ts` (Zustand) holds in-memory user state
- `apiClient.ts` auto-attaches tokens and handles silent refresh

---

## 🔗 Key Dependencies

| Package | Purpose |
| --------- | --------- |
| `expo ~54` | Managed native runtime |
| `expo-router ~6` | File-based navigation |
| `react-native 0.81` | Core framework |
| `react-native-ble-plx` | Bluetooth LE wristband comms |
| `expo-location` | Foreground + background GPS |
| `expo-notifications` | FCM push notifications |
| `expo-secure-store` | Encrypted token storage |
| `react-native-maps` | Google/Apple Maps |
| `@tanstack/react-query@5` | Server state, caching |
| `zustand@5` | Client state |
| `expo-localization` | Device locale detection |
| `react-hook-form` + `zod` | Form validation |
| `react-native-ble-plx` | BLE wristband connection |
| `@react-native-community/netinfo` | Network status (written to wristband) |
