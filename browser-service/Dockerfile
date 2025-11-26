# Use Microsoft's Playwright Python image with Python 3.12 (noble variant)
FROM mcr.microsoft.com/playwright/python:v1.48.0-noble

# Set working directory
WORKDIR /app

# Copy requirements and install Python packages as root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers globally as root (accessible by all users)
# Use PLAYWRIGHT_BROWSERS_PATH to install to a global location
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN playwright install chromium
RUN playwright install-deps chromium

# Make browser directory readable by all users
RUN chmod -R 755 /ms-playwright

# Copy application code
COPY . .

# Set environment variable so Playwright knows where to find browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Create a non-root user and set ownership
RUN useradd -m -u 1001 appuser || true
RUN chown -R 1001:1001 /app
USER 1001

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start application
CMD ["python", "main.py"]
