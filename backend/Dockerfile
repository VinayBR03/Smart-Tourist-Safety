# -------------------------------------------------
# Base Image
# -------------------------------------------------
FROM python:3.10-slim

# -------------------------------------------------
# Environment Variables
# -------------------------------------------------
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# -------------------------------------------------
# System Dependencies
# -------------------------------------------------
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# -------------------------------------------------
# Set Work Directory
# -------------------------------------------------
WORKDIR /app

# -------------------------------------------------
# Install Dependencies
# -------------------------------------------------
COPY requirements.lock.txt .

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.lock.txt

# -------------------------------------------------
# Copy Application
# -------------------------------------------------
COPY . .

# -------------------------------------------------
# Expose Port
# -------------------------------------------------
EXPOSE 8000

# -------------------------------------------------
# Run with Gunicorn (Production)
# -------------------------------------------------
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "4", \
     "-b", "0.0.0.0:8000"]