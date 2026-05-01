# 🔧 DevOps — Sentinel Tour

This folder contains all infrastructure-as-code, CI/CD pipeline definitions, Kubernetes manifests, and deployment automation for the Sentinel Tour platform.

---

## 📁 Folder Structure

```bash
devops/
├── ci/
│   └── github-actions/
│       ├── backend.yml          # CI pipeline for backend (lint, test, build)
│       ├── ai-engine.yml        # CI pipeline for AI engine
│       ├── frontend.yml         # CI pipeline for web dashboard
│       └── mqtt-ingestion.yml   # CI pipeline for Go ingestion service
├── k8s/
│   ├── namespace.yaml
│   ├── configmaps/
│   │   ├── backend-config.yaml
│   │   └── ai-engine-config.yaml
│   ├── secrets/                 # Secret templates (values NOT committed)
│   │   ├── backend-secrets.yaml.example
│   │   └── postgres-secret.yaml.example
│   ├── deployments/
│   │   ├── backend.yaml
│   │   ├── ai-engine.yaml
│   │   ├── celery.yaml
│   │   ├── celery-beat.yaml
│   │   ├── mqtt-ingestion.yaml
│   │   └── web-dashboard.yaml
│   ├── services/
│   │   ├── backend-svc.yaml
│   │   ├── ai-engine-svc.yaml
│   │   └── web-dashboard-svc.yaml
│   └── ingress/
│       └── ingress.yaml
├── helm/
│   └── sentinel-tour/          # Helm chart for full-stack deployment
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
└── README.md
```

---

## 🔁 CI/CD Pipeline

### GitHub Actions

Each service has its own CI workflow triggered on pushes to `main` and pull requests:

```text
Push to main / PR
      │
      ▼
Lint + Static Analysis (ruff / eslint / golangci-lint)
      │
      ▼
Unit Tests (pytest / jest / go test)
      │
      ▼
Docker Build & Push → ghcr.io/VinayBR03/
      │
      ▼
Deploy to staging (on main merge only)
```

### Workflow Files

| File | Trigger | Steps |
| ------ | --------- | ------- |
| `backend.yml` | `push: backend/**` | ruff lint → pytest → docker build/push |
| `ai-engine.yml` | `push: ai_engine/**` | ruff → pytest → docker build/push |
| `frontend.yml` | `push: frontend/**` | eslint → jest → docker build/push |
| `mqtt-ingestion.yml` | `push: mqtt_ingestion/**` | golangci-lint → go test → docker build/push |

---

## ☸️ Kubernetes Deployment

### Prerequisites

- `kubectl` configured against your cluster
- Docker images pushed to registry

### Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Apply config and secrets
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/       # Fill in actual values first!

# Deploy all services
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress/
```

### Check Status

```bash
kubectl get pods -n sentinel-tour
kubectl logs -n sentinel-tour deployment/backend -f
```

---

## 🪖 Helm Chart

For simplified deployment with environment-specific overrides:

```bash
# Install
helm install sentinel-tour ./helm/sentinel-tour \
  --namespace sentinel-tour \
  --create-namespace \
  -f helm/sentinel-tour/values-prod.yaml

# Upgrade
helm upgrade sentinel-tour ./helm/sentinel-tour \
  --namespace sentinel-tour \
  -f helm/sentinel-tour/values-prod.yaml
```

---

## 🐳 Docker Compose (Local Dev)

For local development without Kubernetes overhead, use the root `docker-compose.yml`:

```bash
# Start everything
docker compose up --build

# Start specific service
docker compose up backend ai-engine

# View logs
docker compose logs -f backend

# Tear down (preserve volumes)
docker compose down

# Tear down + wipe volumes
docker compose down -v
```

---

## 🌐 Infrastructure Overview

```text
Internet
   │
   ▼
Ingress Controller (NGINX)
   ├── /          → web-dashboard (port 3000)
   ├── /api/      → backend (port 8000)
   └── /ai/       → ai-engine (port 8001)

Internal Services:
   backend ──► postgres (5432)
   backend ──► redis (6379)
   backend ──► kafka (29092)
   backend ──► ai-engine (8001)
   mqtt-ingestion ──► mosquitto (1883)
   mqtt-ingestion ──► kafka (29092)
```

---

## 🔐 Secrets Management

Secrets are **never committed** to the repository. In production:

- Use **Kubernetes Secrets** (encrypted at rest with KMS)
- Or **HashiCorp Vault** for dynamic secret injection
- Firebase service account JSON is mounted as a Kubernetes Secret volume

---

## 📊 Monitoring (Recommended)

Consider adding the following to the stack:

| Tool | Purpose |
| ------ | --------- |
| Prometheus + Grafana | Metrics and dashboards |
| Loki | Log aggregation |
| Jaeger / OpenTelemetry | Distributed tracing |
| Uptime Robot | External uptime monitoring |
