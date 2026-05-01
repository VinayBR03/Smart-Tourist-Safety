# 📡 API Reference — Sentinel Tour

Base URL: `http://localhost:8000` (local dev)

Interactive docs (Swagger UI): `http://localhost:8000/docs`  
ReDoc: `http://localhost:8000/redoc`

---

## Authentication

All endpoints except `/health`, `/api/v1/auth/register`, and `/api/v1/auth/login` require a JWT Bearer token:

```bash
Authorization: Bearer <token>
```

Admin-only endpoints additionally require the `admin` or `police` role encoded in the JWT claims.

---

## Endpoints

### 🔐 Auth

#### `POST /api/v1/auth/register`

Register a new tourist account.

**Request:**

```json
{
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "password": "SecurePass123!",
  "phone": "+919876543210",
  "nationality": "Indian",
  "passport_number": "A1234567"
}
```

**Response `201`:**

```json
{
  "tourist_id": "TID-7823651",
  "token": "<jwt_token>",
  "expires_in": 3600
}
```

---

#### `POST /api/v1/auth/login`

Authenticate and receive a JWT token.

**Request:**

```json
{ "email": "ravi@example.com", "password": "SecurePass123!" }
```

**Response `200`:**

```json
{ "token": "<jwt_token>", "expires_in": 3600, "role": "tourist" }
```

---

### 👤 Tourists

#### `GET /api/v1/tourists/me`

Retrieve the authenticated tourist's profile.

**Response `200`:**

```json
{
  "id": "TID-7823651",
  "name": "Ravi Kumar",
  "safety_score": 87,
  "blockchain_token_id": "1042",
  "trip_start": "2025-11-10",
  "trip_end": "2025-11-20",
  "current_zone": "Agra Heritage Zone"
}
```

---

#### `PUT /api/v1/tourists/me/location`

Update tourist's current GPS location (called by mobile app).

**Request:**

```json
{ "lat": 27.1751, "lng": 78.0421, "accuracy": 5.2 }
```

**Response `200`:** `{ "status": "ok" }`

---

#### `GET /api/v1/tourists/{tourist_id}` *(Admin/Police only)*

Retrieve any tourist's profile.

---

#### `GET /api/v1/tourists` *(Admin/Police only)*

List all active tourists with optional filters.

**Query params:** `zone_id`, `safety_score_max`, `nationality`, `page`, `page_size`

---

### 🆘 SOS

#### `POST /api/v1/sos/trigger`

Trigger an SOS emergency alert.

**Request:**

```json
{
  "lat": 27.1751,
  "lng": 78.0421,
  "message": "Fell in cave, injured leg",
  "battery_pct": 42
}
```

**Response `202`:**

```json
{
  "incident_id": "INC-0042",
  "status": "DISPATCHING",
  "eta_response_minutes": 8,
  "nearest_station": "Agra Fort Police Station"
}
```

---

### 📋 Incidents

#### `POST /api/v1/incidents/report`

Submit an incident report (non-SOS).

**Request:**

```json
{
  "type": "THEFT",
  "description": "Bag snatched near Taj Mahal East Gate",
  "lat": 27.1751,
  "lng": 78.0421,
  "evidence_urls": ["https://cdn.example.com/photo1.jpg"]
}
```

**Response `201`:**

```json
{
  "incident_id": "INC-0043",
  "blockchain_tx": "0xabc123...",
  "status": "OPEN"
}
```

---

#### `GET /api/v1/incidents`

List incidents (filtered by role: tourist sees own; admin/police see all).

**Query params:** `status`, `type`, `from_date`, `to_date`, `page`, `page_size`

---

#### `GET /api/v1/incidents/{incident_id}`

Get a single incident with full details.

---

#### `PATCH /api/v1/incidents/{incident_id}/status` *(Police only)*

Update incident status.

**Request:** `{ "status": "UNDER_INVESTIGATION", "notes": "Officer dispatched" }`

---

### 📍 Geo-Fences

#### `GET /api/v1/geofences`

List all active geo-fences.

**Response `200`:**

```json
[
  {
    "id": "zone-001",
    "name": "Agra Restricted Forest",
    "alert_level": "HIGH",
    "polygon": { "type": "Polygon", "coordinates": [[...]] }
  }
]
```

---

#### `POST /api/v1/geofences` *(Admin only)*

Create a new geo-fence zone.

**Request:**

```json
{
  "name": "Cave System Alpha",
  "alert_level": "HIGH",
  "polygon": { "type": "Polygon", "coordinates": [[...]] },
  "description": "Dangerous cave system — tourists require guide"
}
```

---

#### `DELETE /api/v1/geofences/{zone_id}` *(Admin only)*

Deactivate a geo-fence zone.

---

### 📊 Dashboard *(Admin/Police only)*

#### `GET /api/v1/dashboard/stats`

Get summary statistics.

**Response `200`:**

```json
{
  "active_tourists": 142,
  "open_incidents": 3,
  "sos_today": 1,
  "geofence_breaches_today": 7,
  "avg_safety_score": 81.4
}
```

---

#### `GET /api/v1/dashboard/heatmap`

Get incident location data for heatmap rendering.

**Query params:** `from_date`, `to_date`, `incident_type`

**Response:** Array of `{ lat, lng, weight }` objects.

---

#### `GET /api/v1/dashboard/live`

WebSocket upgrade endpoint for real-time dashboard events.

Events emitted: `sos.triggered`, `geofence.breach`, `incident.update`, `tourist.location`

---

### 🤖 AI Engine Proxy *(Internal)*

#### `POST /api/v1/ai/risk-score`

Request risk score for a tourist (proxied to AI Engine).

#### `POST /api/v1/ai/geofence-evaluate`

Evaluate GPS coordinates against all active zones.

---

### ❤️ Health

#### `GET /health`

Service health and dependency status.

**Response `200`:**

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "kafka": "connected",
  "ai_engine": "reachable"
}
```

---

## Error Responses

All errors follow this schema:

```json
{
  "detail": "Human-readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-11-15T10:30:00Z"
}
```

| HTTP Status | Meaning |
| ------------- | --------- |
| `400` | Bad request / validation error |
| `401` | Missing or invalid JWT |
| `403` | Insufficient role/permissions |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate registration) |
| `422` | Unprocessable entity (Pydantic validation failure) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Rate Limits

| Endpoint Group | Limit |
| ---------------- | ------- |
| Auth endpoints | 10 requests / minute |
| SOS trigger | 3 requests / minute |
| General API | 120 requests / minute |
| Dashboard (admin) | 300 requests / minute |
