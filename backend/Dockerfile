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

FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PATH="/usr/local/bin:$PATH"

# libgdal-dev works across all Debian versions — libgdal32 was renamed in trixie
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgdal-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

RUN groupadd --gid 1001 appgroup && \
    useradd  --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["sh", "-c", \
     "gunicorn app.main:app \
      -k uvicorn.workers.UvicornWorker \
      -w $(( 2 * $(nproc) + 1 )) \
      -b 0.0.0.0:8000 \
      --timeout 120 \
      --keep-alive 5 \
      --max-requests 1000 \
      --max-requests-jitter 100 \
      --access-logfile - \
      --error-logfile -"]