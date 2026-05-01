FROM python:3.10-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.lock.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.lock.txt && \
    if [ -d /install/local ]; then \
        cp -r /install/local/* /install/ && \
        rm -rf /install/local; \
    fi

# ─────────────────────────────────────────────
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PATH="/usr/local/bin:$PATH"

# FIX #5: libgdal-dev → libgdal32 (runtime shared lib only, headers not needed at runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgdal32 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

RUN groupadd --gid 1001 appgroup && \
    useradd  --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

# Create secrets dir so the volume mount has a target owned by appuser
RUN mkdir -p /app/app/secrets && chown -R appuser:appgroup /app/app/secrets

COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Cap workers at 4 — nproc inside Docker sees ALL host CPUs
CMD ["sh", "-c", \
     "WORKERS=$(( 2 * $(nproc) + 1 )); \
      [ $WORKERS -gt 4 ] && WORKERS=4; \
      gunicorn app.main:app \
      -k uvicorn.workers.UvicornWorker \
      -w $WORKERS \
      -b 0.0.0.0:8000 \
      --timeout 120 \
      --keep-alive 5 \
      --max-requests 1000 \
      --max-requests-jitter 100 \
      --access-logfile - \
      --error-logfile -"]
