FROM python:3.11-slim

# System deps: ffmpeg for video assembly + gcc for packages with C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        gcc \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user — running as root in a container is a security risk
RUN groupadd --gid 1001 zenith \
 && useradd --uid 1001 --gid zenith --shell /bin/bash --create-home zenith

WORKDIR /app

# Install Python deps first so this layer is cached separately from app code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium (needed for SVG animation screenshots + PPTX export)
RUN playwright install chromium --with-deps

# Copy application code
COPY . .

# Create runtime-writable directories and hand them to the app user
RUN mkdir -p outputs logs chromadb \
 && chown -R zenith:zenith /app

USER zenith

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Gunicorn + UvicornWorker. Override WEB_CONCURRENCY in the container env.
CMD ["sh", "-c", \
     "gunicorn main:app \
      --worker-class uvicorn.workers.UvicornWorker \
      --workers ${WEB_CONCURRENCY:-2} \
      --bind 0.0.0.0:8000 \
      --timeout 600 \
      --keep-alive 5 \
      --access-logfile - \
      --error-logfile -"]
