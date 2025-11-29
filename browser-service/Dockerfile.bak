# Use Microsoft's Playwright Python image (browsers pre-installed)
FROM mcr.microsoft.com/playwright/python:v1.56.0-noble

# Set working directory
WORKDIR /app

# Environment variables for Playwright
ENV PYTHONUNBUFFERED=1
# Tell Playwright to skip browser download (browsers already in base image)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start application (run as root since Playwright image is designed for it)
CMD ["python", "main.py"]
