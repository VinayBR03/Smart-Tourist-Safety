# 🖥️ Web Dashboard — Sentinel Tour

Admin and police operations dashboard for the Sentinel Tour platform. Built with **React 19**, **TypeScript**, and **Vite**, served via **Nginx** on port `3000`.

---

## 📁 Folder Structure

```text
web-dashboard/
├── public/
│   └── config.js               # Runtime API URL injection (not baked into build)
├── src/
│   ├── api/                    # Axios API clients (one file per domain)
│   │   ├── apiClient.ts        # Base axios instance, JWT interceptor, token refresh
│   │   ├── analyticsApi.ts
│   │   ├── authApi.ts
│   │   ├── deviceApi.ts
│   │   ├── healthApi.ts
│   │   ├── incidentApi.ts
│   │   ├── locationApi.ts
│   │   ├── mediaApi.ts
│   │   ├── notificationApi.ts
│   │   ├── userApi.ts
│   │   └── zoneApi.ts
│   ├── app/
│   │   ├── router.tsx          # React Router v7 route config
│   │   ├── guards.tsx          # AuthGuard + PublicGuard + role enforcement
│   │   └── providers.tsx       # QueryClient, ThemeProvider, RouterProvider
│   ├── components/
│   │   ├── admin/              # CreateAuthorityModal, UserTable
│   │   ├── charts/             # CrowdDensity, DeviceHealth, IncidentStatus/Trend, ZoneRisk
│   │   ├── common/             # Badge, Button, Input, Modal, Table, Tabs, Loader, Skeleton…
│   │   ├── devices/            # DeviceCard, DeviceForm, DeviceTable
│   │   ├── health/             # HealthAlertCard, HealthVitalCard
│   │   ├── incidents/          # IncidentCard, IncidentForm, IncidentTable, IncidentTimeline
│   │   ├── layout/             # DashboardLayout, LoginLayout, Navbar, Sidebar, Footer
│   │   ├── maps/               # LeafletMap, ZoneDrawMap, TouristMarkerLayer, ZoneOverlay
│   │   ├── media/              # MediaThumb, MediaUploader
│   │   ├── notifications/      # NotificationItem, NotificationList
│   │   ├── ui/                 # Card, StatCard, SectionHeader, MapLegend
│   │   └── zones/              # ZoneCard, ZoneForm, ZoneTable
│   ├── constants/
│   │   ├── config.ts           # API_BASE_URL, WS_BASE_URL, map defaults, intervals
│   │   └── storage.ts          # localStorage key constants
│   ├── hooks/                  # useAuth, useDevices, useHealthTelemetry, useIncidents…
│   ├── pages/
│   │   ├── admin/              # UsersPage, AuthoritiesPage, SystemAnalyticsPage
│   │   ├── analytics/          # OperationsAnalyticsPage
│   │   ├── auth/               # LoginPage
│   │   ├── dashboard/          # DashboardPage
│   │   ├── devices/            # DevicesPage
│   │   ├── health/             # HealthMonitoringPage
│   │   ├── incidents/          # IncidentListPage, IncidentDetailPage
│   │   ├── map/                # OperationsMapPage
│   │   ├── notifications/      # NotificationsPage
│   │   ├── settings/           # SettingsPage
│   │   └── zones/              # ZonesPage
│   ├── services/
│   │   ├── websocketService.ts # Multi-connection WS manager (reconnect, heartbeat)
│   │   └── notificationSoundService.ts
│   ├── store/                  # Zustand stores
│   ├── theme/                  # ThemeProvider, themes.ts, theme.css, useTheme.ts
│   ├── types/                  # TypeScript interfaces (device, incident, zone, health…)
│   └── utils/                  # formatDate, mapHelpers, permissions, websocketEvents
├── Dockerfile
├── nginx.conf
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## ⚙️ Runtime Configuration

API and WebSocket URLs are resolved at runtime from `window.location` — no environment variables are baked into the build. This means the same Docker image works across dev, staging, and production with zero rebuild.

```ts
// src/constants/config.ts
export const API_BASE_URL = `${protocol}//${host}/api`;
export const WS_BASE_URL  = `${wsProtocol}//${host}/ws`;
```

For local dev without a reverse proxy, override `public/config.js`:

```js
// public/config.js  (only needed for local dev)
window.API_OVERRIDE  = 'http://localhost:8000';
window.WS_OVERRIDE   = 'ws://localhost:8000';
```

---

## 🚀 Running Locally

### With Docker Compose (recommended)

```bash
# From repo root
docker compose up web-dashboard
# Visit http://localhost:3000
```

### Standalone Dev Server

```bash
cd frontend/web-dashboard
npm install
npm run dev
# Visit http://localhost:5173
```

### Production Build

```bash
npm run build      # Output → dist/
npm run preview    # Preview the built app locally
```

---

## 📄 Pages & Routes

| Route | Page | Access |
| ------- | ------ | -------- |
| `/login` | LoginPage | Public |
| `/dashboard` | DashboardPage | All authenticated |
| `/map` | OperationsMapPage | All authenticated |
| `/zones` | ZonesPage | All authenticated |
| `/incidents` | IncidentListPage | All authenticated |
| `/incidents/:id` | IncidentDetailPage | All authenticated |
| `/devices` | DevicesPage | All authenticated |
| `/health` | HealthMonitoringPage | All authenticated |
| `/notifications` | NotificationsPage | All authenticated |
| `/analytics` | OperationsAnalyticsPage | All authenticated |
| `/settings` | SettingsPage | All authenticated |
| `/admin/users` | UsersPage | `ADMIN` role only |
| `/admin/authorities` | AuthoritiesPage | `ADMIN` role only |
| `/admin/system` | SystemAnalyticsPage | `ADMIN` role only |

---

## 🌐 WebSocket

The `WebSocketService` manages two persistent connections with auto-reconnect (up to 10 attempts, 3s delay) and heartbeat:

| Endpoint | Events | Used by |
| ---------- | -------- | --------- |
| `ws://.../ws/notifications` | All push notifications | NotificationsPage, bell badge |
| `ws://.../ws/authority/live` | Live tourist locations, SOS, zone breaches | OperationsMapPage |

---

## 🗺️ Map Features

- **Leaflet.js** with `react-leaflet` and `react-leaflet-cluster`
- Default center: India (`[20.5937, 78.9629]`), zoom 5
- `TouristMarkerLayer` — live tourist GPS pins updated via WebSocket
- `ZoneOverlay` — renders geo-fence boundaries with alert-level colour coding
- `ZoneDrawMap` — admin tool to draw new geo-fence polygons (`leaflet-draw`)
- `leaflet.heat` — incident heatmap layer on OperationsMapPage

---

## 📊 Charts (Recharts)

| Component | Data |
| ----------- | ------ |
| `CrowdDensityChart` | Real-time crowd density per zone |
| `DeviceHealthChart` | IoT band battery and connectivity over time |
| `IncidentStatusChart` | Open / Under Investigation / Resolved breakdown |
| `IncidentTrendChart` | Daily incident count trend |
| `ZoneRiskChart` | Risk score per active zone |

---

## 🔒 Auth & Role Guards

- JWT stored in `localStorage` via `STORAGE_KEYS`
- `apiClient.ts` — Axios interceptor auto-attaches `Authorization: Bearer <token>` and refreshes every 4 minutes
- `AuthGuard` — redirects unauthenticated users to `/login`
- `PublicGuard` — redirects already-authenticated users away from `/login`
- Role-based: admin-only routes wrapped with `<AuthGuard roles={[UserRole.ADMIN]}>`

---

## 🎨 Theming

Multi-theme support via `ThemeProvider`. Themes defined in `src/theme/themes.ts` and applied via CSS variables in `src/theme/theme.css`. Toggle via `ThemeSwitcher` in the navbar.

---

## 🧪 Linting

```bash
npm run lint        # ESLint with TypeScript rules
```

---

## 🔗 Key Dependencies

| Package | Purpose |
| --------- | --------- |
| `react@19` + `react-router-dom@7` | UI + routing |
| `@tanstack/react-query@5` | Server state, caching |
| `zustand@5` | Client state management |
| `axios` | HTTP client |
| `leaflet` + `react-leaflet@5` | Interactive maps |
| `leaflet-draw` | Zone polygon drawing |
| `leaflet.heat` | Incident heatmap |
| `recharts@3` | Analytics charts |
| `tailwindcss@3` | Utility-first styling |
| `lucide-react` | Icon set |
| `date-fns` | Date formatting |
