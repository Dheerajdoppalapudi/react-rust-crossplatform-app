FROM python:3.11-slim

# System deps: ffmpeg + build tools for psycopg2 + playwright deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        gcc \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first so this layer is cached separately from app code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium (needed for SVG animation screenshots)
RUN playwright install chromium --with-deps

# Copy application code
COPY . .

# Create directories that the app writes to at runtime
RUN mkdir -p outputs logs chromadb

EXPOSE 8000

# Gunicorn + uvicorn workers: 1 worker per vCPU is the standard starting point.
# Set WEB_CONCURRENCY in the container env to override (e.g. WEB_CONCURRENCY=4).
CMD ["sh", "-c", \
     "gunicorn main:app \
      --worker-class uvicorn.workers.UvicornWorker \
      --workers ${WEB_CONCURRENCY:-2} \
      --bind 0.0.0.0:8000 \
      --timeout 600 \
      --keep-alive 5 \
      --access-logfile - \
      --error-logfile -"]
