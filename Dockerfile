FROM python:3.11-slim

# Install compilation dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY backend /app/backend
COPY frontend /app/frontend

# Set working directory to the backend so uvicorn can resolve import paths
WORKDIR /app/backend

# Default port assigned by cloud providers
ENV PORT=8000

# Start command
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
