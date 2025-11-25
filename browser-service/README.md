# ResumeMax Browser Automation Service

Production-ready browser automation service with job queue, auto-scaling, and comprehensive monitoring.

## Features

- 🚀 **Queue-based Processing**: Redis + RQ for reliable background job processing
- 🐳 **Docker Support**: Containerized for consistent deployments
- 📈 **Auto-Scaling**: Automatically scales workers based on load
- 🔐 **API Key Authentication**: Secure internal service communication
- 📊 **Health Checks**: Comprehensive health and readiness probes
- 📝 **Structured Logging**: JSON logging with Sentry integration
- ⚡ **High Performance**: Handles concurrent browser automation tasks

## Architecture

```
┌─────────────┐
│  FastAPI    │ ◄── HTTP requests
│  Server     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Redis     │ ◄── Job queue
│   Queue     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ RQ Workers  │ ◄── Process jobs
│   Pool      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Browser    │ ◄── Playwright automation
│  Automation │
└─────────────┘
```

## Quick Start

### Local Development

```bash
# 1. Install dependencies
pip install -r requirements.txt
playwright install chromium

# 2. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start with Docker Compose
docker-compose up -d

# 4. Verify services
curl http://localhost:8000/health
```

### Using the API

**Submit a Job**
```bash
POST /jobs/submit
Content-Type: application/json
X-API-Key: your-api-key

{
  "user_id": "user123",
  "job_url": "https://company.com/job/12345",
  "user_profile": {...},
  "resume_data": {...},
  "session_id": "session-abc"
}

# Response
{
  "job_id": "f8d3c7a2-...",
  "status": "queued",
  "message": "Job submitted successfully",
  "queue_position": 3
}
```

**Check Job Status**
```bash
GET /jobs/{job_id}
X-API-Key: your-api-key

# Response
{
  "job_id": "f8d3c7a2-...",
  "status": "finished",  # queued | started | finished | failed
  "result": {...},
  "created_at": "2024-01-01T12:00:00Z",
  "started_at": "2024-01-01T12:00:05Z",
  "ended_at": "2024-01-01T12:05:30Z"
}
```

## API Endpoints

### Health & Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/browser` | GET | Check browser availability |
| `/health/queue` | GET | Check Redis and queue status |
| `/metrics` | GET | Service metrics (queue depth, CPU, memory) |

### Job Management

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/jobs/submit` | POST | Submit new job | Yes |
| `/jobs/{job_id}` | GET | Get job status | Yes |
| `/jobs/{job_id}` | DELETE | Cancel queued job | Yes |

### Admin

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/admin/clear-failed-jobs` | POST | Clear failed jobs | Yes |

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENVIRONMENT` | Environment (development/production) | `development` | No |
| `LOG_LEVEL` | Logging level | `INFO` | No |
| `API_KEY` | Internal API key | - | Yes |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` | Yes |
| `QUEUE_NAME` | Job queue name | `browser-automation` | No |
| `JOB_TIMEOUT` | Max job duration (seconds) | `600` | No |
| `HEADLESS` | Run browser in headless mode | `true` | No |
| `MAX_BROWSER_SESSIONS` | Max concurrent browser sessions | `3` | No |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | No |
| `SENTRY_DSN` | Sentry error tracking DSN | - | No |

### Example .env

```bash
ENVIRONMENT=development
LOG_LEVEL=INFO
API_KEY=your-secure-random-key-here
REDIS_URL=redis://localhost:6379/0
QUEUE_NAME=browser-automation
HEADLESS=true
MAX_BROWSER_SESSIONS=3
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
SENTRY_DSN=https://...@sentry.io/...
```

## Docker Deployment

### Build Image

```bash
docker build -t resumemax-browser-service .
```

### Run Container

```bash
docker run -d \
  --name browser-service \
  -p 8000:8000 \
  -e REDIS_URL=redis://redis:6379/0 \
  -e API_KEY=your-api-key \
  -e OPENAI_API_KEY=sk-... \
  resumemax-browser-service
```

### Docker Compose

```bash
# Start all services (Redis + API + Workers)
docker-compose up -d

# Scale workers
docker-compose up -d --scale worker=5

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## AWS Deployment

See [deployment guide](../docs/DEPLOYMENT_GUIDE.md) for complete instructions.

**Quick Deploy:**
```bash
cd ../infrastructure
./deploy.sh
```

## Monitoring

### Logs

```bash
# Local (Docker Compose)
docker-compose logs -f browser-service
docker-compose logs -f worker

# Production (AWS)
aws logs tail /ecs/resumemax-browser-service --follow
aws logs tail /ecs/resumemax-browser-worker --follow
```

### RQ Dashboard

Access the RQ dashboard at `http://localhost:9181` (local) to monitor:
- Queue depth
- Active workers
- Failed jobs
- Job history

### Metrics

```bash
# Get current metrics
curl http://localhost:8000/metrics

# Response
{
  "queued_jobs": 5,
  "active_jobs": 2,
  "failed_jobs": 1,
  "cpu_percent": 45.2,
  "memory_percent": 62.1,
  "redis_connected": true
}
```

## Development

### Project Structure

```
browser-service/
├── main_new.py          # FastAPI application
├── worker.py            # RQ worker functions
├── config.py            # Configuration management
├── logger.py            # Logging setup
├── browser_agent.py     # Browser automation logic
├── gmail_handler.py     # Gmail integration
├── requirements.txt     # Python dependencies
├── Dockerfile           # Docker image
├── docker-compose.yml   # Local dev environment
└── .dockerignore        # Docker build exclusions
```

### Adding New Features

1. **Add new endpoint** in `main_new.py`
2. **Add worker function** in `worker.py`
3. **Update configuration** in `config.py`
4. **Add tests** (create `tests/` directory)
5. **Update docs**

### Running Tests

```bash
# Install dev dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/

# With coverage
pytest --cov=. tests/
```

## Troubleshooting

### Common Issues

**Jobs stuck in queue**
```bash
# Check worker status
docker-compose logs worker

# Restart workers
docker-compose restart worker
```

**Redis connection errors**
```bash
# Test Redis connection
redis-cli -h localhost ping

# Check Redis logs
docker-compose logs redis
```

**Browser launch failures**
```bash
# Reinstall Playwright browsers
docker-compose exec browser-service playwright install chromium --with-deps

# Check system dependencies
docker-compose exec browser-service apt-get update && apt-get install -y libgbm1
```

**Memory issues**
```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Docker Desktop → Preferences → Resources → Memory
```

## Performance Tuning

### Optimize Worker Count

```bash
# Based on CPU cores
WORKERS = (CPU_CORES * 2) + 1

# Based on job duration
# If jobs take 5min avg, and you get 100 jobs/hour:
# WORKERS = (100 jobs/hr) / (60min/hr / 5min/job) = 8-10 workers
```

### Optimize Browser Sessions

```yaml
# docker-compose.yml
services:
  browser-service:
    environment:
      - MAX_BROWSER_SESSIONS=3  # Adjust based on memory
```

### Redis Optimization

```yaml
services:
  redis:
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

## Security

- 🔐 **API Key Authentication**: All endpoints require `X-API-Key` header
- 🔒 **Secrets Management**: Use AWS Secrets Manager in production
- 🛡️ **Network Isolation**: Deploy in private subnets with NAT gateway
- 📝 **Audit Logging**: All job submissions are logged

## License

Proprietary - ResumeMax

## Support

- 📖 Documentation: [../docs/](../docs/)
- 🐛 Issues: Report via GitHub
- 📧 Contact: support@resumemax.ai
