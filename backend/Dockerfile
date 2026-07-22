# syntax=docker/dockerfile:1
# Build from backend/:
#   docker build -t deepcellar-backend .
# Or via Compose (context: ./backend).

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    PORT=8000

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY run_app.py .

RUN mkdir -p /data \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app /data

USER appuser
EXPOSE 8000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/docs" >/dev/null || exit 1

CMD ["sh", "-c", "uvicorn run_app:app --host 0.0.0.0 --port ${PORT}"]
