# Use Microsoft's Playwright Python image with Python 3.12 (noble variant)
FROM mcr.microsoft.com/playwright/python:v1.48.0-noble

# Set working directory
WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# The noble image already has a user with UID 1000 (pwuser)
# We'll use that user instead of creating a new one
RUN chown -R 1000:1000 /app
USER 1000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start application
CMD ["python", "main.py"]
