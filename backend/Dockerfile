# =================================================================
# Stage 1: Builder
# Install all build-time dependencies and Python packages.
# Nothing from this stage except site-packages reaches production.
# =================================================================
FROM python:3.10-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Build-time system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.lock.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.lock.txt


# =================================================================
# Stage 2: Runtime
# Lean production image — no compilers, no build tools.
# =================================================================
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Runtime system deps only
# libpq5     — PostgreSQL client (SQLAlchemy needs this at runtime)
# libgdal32  — GeoAlchemy2 / PostGIS spatial functions
# curl       — used by HEALTHCHECK below
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgdal32 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Create non-root user — never run production apps as root
RUN groupadd --gid 1001 appgroup && \
    useradd  --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

# Copy application source
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser

EXPOSE 8000

# Health check — uses the /health endpoint we defined in main.py.
# Docker marks the container unhealthy if it fails 3 times in a row,
# which triggers a restart in docker-compose / Kubernetes.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# -----------------------------------------------------------------
# Gunicorn + UvicornWorker
#
# Workers: (2 × CPU) + 1 is the standard formula for async workers.
# We read CPU count at runtime via shell arithmetic so the same
# image scales correctly on 2-core dev and 16-core prod machines.
# -----------------------------------------------------------------
CMD ["sh", "-c", \
     "gunicorn app.main:app \
      -k uvicorn.workers.UvicornWorker \
      -w $(( 2 * $(nproc) + 1 )) \
      -b 0.0.0.0:8000 \
      --timeout 120 \
      --keepalive 5 \
      --max-requests 1000 \
      --max-requests-jitter 100 \
      --access-logfile - \
      --error-logfile -"]