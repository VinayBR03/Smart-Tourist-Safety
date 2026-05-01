# 🚀 Deployment Guide — Sentinel Tour

This guide covers deploying Sentinel Tour to production using Docker Compose (single server), Kubernetes, or a managed cloud platform.

---

## Option 1: Docker Compose (Single Server)

Best for: Small-scale deployments, demos, staging environments.

### Server Requirements

| Resource | Minimum | Recommended |
| ---------- | --------- | ------------- |
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Disk | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Steps

```bash
# 1. Install Docker on server
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Clone repo
git clone https://github.com/VinayBR03/Smart-Tourist-Safety.git
cd Smart-Tourist-Safety

# 3. Configure env files (see setup-guide.md)
cp backend/.env.example backend/.env.docker
# Edit with production values

# 4. Pull & start
docker compose pull
docker compose up -d

# 5. Run DB migrations
docker compose exec backend alembic upgrade head

# 6. Check status
docker compose ps
docker compose logs -f
```

### Nginx Reverse Proxy (recommended)

Install Nginx on the host and proxy to Docker services:

```nginx
# /etc/nginx/sites-available/sentinel-tour
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

```bash
# Obtain TLS certificate
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Option 2: Kubernetes (Production Scale)

Best for: High-availability deployments with horizontal scaling.

### Prerequisites

- A Kubernetes cluster (GKE, EKS, AKS, or self-managed)
- `kubectl` configured
- Container images published to a registry (e.g., `ghcr.io/VinayBR03/`)
- A managed PostgreSQL and Redis instance (recommended over in-cluster for prod)

### Namespace & Secrets

```bash
# Create namespace
kubectl apply -f devops/k8s/namespace.yaml

# Create secrets (fill in actual values first)
cp devops/k8s/secrets/backend-secrets.yaml.example devops/k8s/secrets/backend-secrets.yaml
# Edit backend-secrets.yaml — base64-encode all values

kubectl apply -f devops/k8s/secrets/
kubectl apply -f devops/k8s/configmaps/
```

### Deploy Services

```bash
# Infrastructure (if running in-cluster — not recommended for prod)
kubectl apply -f devops/k8s/deployments/postgres.yaml
kubectl apply -f devops/k8s/deployments/redis.yaml
kubectl apply -f devops/k8s/deployments/kafka.yaml

# Application services
kubectl apply -f devops/k8s/deployments/
kubectl apply -f devops/k8s/services/

# Ingress
kubectl apply -f devops/k8s/ingress/ingress.yaml
```

### Run Migrations in Kubernetes

```bash
kubectl run db-migrate \
  --image=ghcr.io/VinayBR03/backend:latest \
  --restart=Never \
  --env-from=secret/backend-secret \
  -- alembic upgrade head

kubectl logs db-migrate -f
kubectl delete pod db-migrate
```

### Scaling

```bash
# Scale backend horizontally
kubectl scale deployment backend --replicas=3 -n sentinel-tour

# Scale Celery workers
kubectl scale deployment celery --replicas=5 -n sentinel-tour

# Enable HPA (Horizontal Pod Autoscaler)
kubectl autoscale deployment backend \
  --min=2 --max=10 --cpu-percent=70 \
  -n sentinel-tour
```

---

## Option 3: Helm Chart

Simplifies environment-specific configuration:

```bash
# Install
helm install sentinel-tour ./devops/helm/sentinel-tour \
  --namespace sentinel-tour \
  --create-namespace \
  --set backend.image.tag=v1.0.0 \
  --set global.domain=yourdomain.com \
  -f devops/helm/sentinel-tour/values-prod.yaml

# Upgrade to new version
helm upgrade sentinel-tour ./devops/helm/sentinel-tour \
  --namespace sentinel-tour \
  --set backend.image.tag=v1.1.0 \
  -f devops/helm/sentinel-tour/values-prod.yaml

# Rollback
helm rollback sentinel-tour 1 --namespace sentinel-tour
```

---

## Environment-Specific Configuration

| Variable | Dev | Staging | Production |
| ---------- | ----- | --------- | ------------ |
| `LOG_LEVEL` | `DEBUG` | `INFO` | `WARNING` |
| `JWT_EXPIRE_MINUTES` | `1440` (24h) | `120` | `60` |
| `DATABASE_URL` | Docker internal | Managed DB | Managed DB (replicated) |
| `KAFKA_BROKERS` | `kafka:29092` | Managed Kafka | Managed Kafka (multi-broker) |
| MQTT TLS | Disabled | Enabled | Enabled |
| Blockchain Network | Hardhat local | Polygon Mumbai | Polygon Mainnet |

---

## Database Backups

### Docker Compose

```bash
# Backup
docker compose exec postgres pg_dump \
  -U tourist_user tourist_safety_db | gzip > backup-$(date +%F).sql.gz

# Restore
gunzip -c backup-2025-11-15.sql.gz | \
  docker compose exec -T postgres psql -U tourist_user tourist_safety_db
```

### Kubernetes (CronJob)

```yaml
# devops/k8s/cronjob-backup.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: sentinel-tour
spec:
  schedule: "0 2 * * *"    # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:16
            command: ["/bin/sh", "-c"]
            args:
              - pg_dump $DATABASE_URL | gzip > /backup/backup-$(date +%F).sql.gz
            envFrom:
              - secretRef:
                  name: backend-secret
          restartPolicy: OnFailure
```

---

## Rolling Updates (Zero Downtime)

With Kubernetes, rolling updates are automatic:

```bash
# Update backend image
kubectl set image deployment/backend \
  backend=ghcr.io/VinayBR03/backend:v1.1.0 \
  -n sentinel-tour

# Monitor rollout
kubectl rollout status deployment/backend -n sentinel-tour

# Rollback if needed
kubectl rollout undo deployment/backend -n sentinel-tour
```

With Docker Compose:

```bash
docker compose pull backend
docker compose up -d --no-deps backend
```

---

## Monitoring

### Recommended Stack

| Tool | Purpose | Port |
| ------ | --------- | ------ |
| Prometheus | Metrics scraping | 9090 |
| Grafana | Dashboards | 3001 |
| Loki + Promtail | Log aggregation | 3100 |
| Alertmanager | Alert routing | 9093 |

### FastAPI Metrics

The backend exposes Prometheus metrics at `GET /metrics` (if `prometheus-fastapi-instrumentator` is installed). Add a scrape config:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'sentinel-backend'
    static_configs:
      - targets: ['backend:8000']
  - job_name: 'sentinel-ai-engine'
    static_configs:
      - targets: ['ai-engine:8001']
```

### Key Alerts to Configure

- Backend response time P99 > 500ms
- SOS dispatch task lag > 30 seconds
- Kafka consumer group lag > 1000 messages
- TimescaleDB disk usage > 80%
- Any service container restart > 3 times in 10 minutes
