# Use Microsoft's Playwright Python image with Python 3.12 (noble variant)
FROM mcr.microsoft.com/playwright/python:v1.48.0-noble

# Set working directory
WORKDIR /app

# Copy requirements and install Python packages as root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright system dependencies as root
RUN playwright install-deps chromium

# Copy application code
COPY . .

# Create a non-root user and switch to it
RUN useradd -m -u 1001 appuser || true
RUN chown -R 1001:1001 /app
USER 1001

# Install Playwright browsers as non-root user (installs to user's home directory)
RUN playwright install chromium

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start application
CMD ["python", "main.py"]
