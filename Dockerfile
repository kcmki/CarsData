FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional MySQL dependency
RUN pip install --no-cache-dir mysql-connector-python

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/files /app/templates

EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "web_app:app", "--host", "0.0.0.0", "--port", "8000"]
