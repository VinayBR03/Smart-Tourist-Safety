# =================================================================
# Stage 1: Builder
# Installs all Python packages including the heavy ML stack.
# Nothing from this stage except site-packages reaches production.
# =================================================================
FROM python:3.10-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Build-time deps
# libgomp1     — OpenMP, required by XGBoost + sklearn n_jobs=-1
# build-essential — needed to compile any C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# ── Dependency install in two phases for maximum layer caching ──
#
# Phase A: PyTorch CPU-only (~700MB vs ~2GB for the default CUDA wheel)
# Installed first so it is cached independently of other packages.
# If only non-torch requirements change, this layer never rebuilds.
COPY requirements.lock.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install \
        torch==2.2.2 \
        --index-url https://download.pytorch.org/whl/cpu

# Phase B: Everything else (sklearn, xgboost, river, fastapi, etc.)
RUN pip install --no-cache-dir --prefix=/install \
        --index-url https://pypi.org/simple \
        -r requirements.lock.txt \
        --ignore-installed torch


# =================================================================
# Stage 2: Runtime
# Lean production image — no compilers, no CUDA, no build tools.
# =================================================================
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Runtime-only system deps
# libgomp1  — OpenMP required by XGBoost / sklearn at inference time
# curl      — used by HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder stage
COPY --from=builder /install /usr/local

# Create non-root user
RUN groupadd --gid 1001 aigroup && \
    useradd  --uid 1001 --gid aigroup --no-create-home aiuser

WORKDIR /app

# Copy application source
# artifacts/ is intentionally NOT copied — it is mounted as a
# Docker volume at runtime so model files persist across deploys
# and can be updated without rebuilding the image.
COPY --chown=aiuser:aigroup . .

# Switch to non-root user
USER aiuser

EXPOSE 8001

# Health check — uses the public /health endpoint (no auth required)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# -----------------------------------------------------------------
# Gunicorn + UvicornWorker
#
# ML inference is CPU-bound and stateful (models in memory).
# Use 1-2 workers only — more workers = more model copies in RAM.
# Each model copy (sklearn + torch LSTM) can be 200-500MB.
# Scale horizontally (more containers) rather than vertically
# (more workers per container) for this type of service.
#
# --preload: loads the app (and models via lifespan) once in the
# master process, then forks workers that share the memory.
# This cuts RAM usage significantly on Linux (copy-on-write fork).
# -----------------------------------------------------------------
CMD ["gunicorn", "main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "2", \
     "-b", "0.0.0.0:8001", \
     "--preload", \
     "--timeout", "120", \
     "--keepalive", "5", \
     "--max-requests", "500", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]