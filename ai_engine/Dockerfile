# ===============================
# Base Image
# ===============================
FROM python:3.10-slim

# ===============================
# Environment
# ===============================
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ===============================
# System Dependencies
# ===============================
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Create App Directory
# ===============================
WORKDIR /app

# ===============================
# Install Dependencies
# ===============================
COPY requirements.lock.txt .

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.lock.txt

# ===============================
# Copy Project
# ===============================
COPY . .

# ===============================
# Create Non-Root User
# ===============================
RUN useradd -m appuser
USER appuser

# ===============================
# Expose Port
# ===============================
EXPOSE 8001

# ===============================
# Run App (Production)
# ===============================
CMD ["gunicorn", "main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8001", \
     "--workers", "2", \
     "--timeout", "60"]