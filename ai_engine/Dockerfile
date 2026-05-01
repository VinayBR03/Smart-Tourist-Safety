FROM python:3.10-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.lock.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install \
        torch==2.2.2 \
        --index-url https://download.pytorch.org/whl/cpu

# Strip torch, nvidia-*, and triton from lock file before Phase B.
# Without this, pip downloads 2GB+ of CUDA packages even though
# torch CPU-only is already installed from Phase A above.
RUN grep -vE "^(torch|nvidia|triton)" requirements.lock.txt \
        > requirements_no_torch.txt && \
    pip install --no-cache-dir --prefix=/install \
        -r requirements_no_torch.txt


FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PATH="/usr/local/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

RUN groupadd --gid 1001 aigroup && \
    useradd  --uid 1001 --gid aigroup --no-create-home aiuser

WORKDIR /app

COPY --chown=aiuser:aigroup . .

USER aiuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# main:app is correct — main.py sits at /app/main.py and PYTHONPATH=/app
CMD ["gunicorn", "main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "2", \
     "-b", "0.0.0.0:8001", \
     "--preload", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--max-requests", "500", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
