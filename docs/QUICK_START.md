# Browser Service - Quick Start Guide

## 🚀 What Changed?

Your browser automation service has been restructured for **production deployment with AWS ECS/Fargate**:

### New Architecture
- ✅ **Queue-based processing** with Redis + RQ workers
- ✅ **Docker containerization** for consistent deployments
- ✅ **Auto-scaling** workers based on load
- ✅ **Health checks** and monitoring endpoints
- ✅ **Production logging** with JSON format and Sentry
- ✅ **API key authentication** for internal services

### Directory Structure
```
resume-scorecard/
├── browser-service/          # Renamed from python-service
│   ├── main_new.py          # Production FastAPI app with queue
│   ├── worker.py            # RQ worker for background jobs
│   ├── config.py            # Centralized configuration
│   ├── logger.py            # Structured logging
│   ├── Dockerfile           # Docker image definition
│   ├── docker-compose.yml   # Local development setup
│   └── requirements.txt     # Updated dependencies
├── infrastructure/          # NEW: AWS deployment files
│   ├── cloudformation-template.yml
│   ├── ecs-task-definition.json
│   └── deploy.sh
├── docs/                    # NEW: Documentation
│   ├── DEPLOYMENT_GUIDE.md
│   └── QUICK_START.md
└── app/api/browser-apply/
    └── route.NEW.ts         # Updated API route for queue
```

## 🏃 Quick Commands

### Local Development

```bash
# Start all services (Redis + Browser Service + Workers)
cd browser-service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Test Endpoints

```bash
# Health check
curl http://localhost:8000/health

# Submit a job
curl -X POST http://localhost:8000/jobs/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "user_id": "test",
    "job_url": "https://example.com/job",
    "user_profile": {},
    "resume_data": {},
    "session_id": "test-1"
  }'

# Check job status
curl http://localhost:8000/jobs/{job_id} \
  -H "X-API-Key: your-api-key"
```

### AWS Deployment

```bash
# One-command deployment
cd infrastructure
./deploy.sh

# The script will:
# 1. Build Docker image
# 2. Push to ECR
# 3. Create secrets
# 4. Deploy ECS cluster
# 5. Output service URL
```

## 📝 Configuration Changes Needed

### 1. Update `.env` files

**browser-service/.env**
```bash
ENVIRONMENT=development
LOG_LEVEL=INFO
REDIS_URL=redis://localhost:6379/0
API_KEY=your-secure-api-key-here
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
HEADLESS=true
MAX_BROWSER_SESSIONS=3
```

### 2. Update Next.js Environment

**For Local Development (.env.local)**
```bash
BROWSER_SERVICE_URL=http://localhost:8000
BROWSER_SERVICE_API_KEY=your-secure-api-key-here
```

**For Production (Vercel)**
```bash
BROWSER_SERVICE_URL=http://your-load-balancer-dns
BROWSER_SERVICE_API_KEY=your-secure-api-key-here
```

### 3. Replace API Route

```bash
# Backup old route
mv app/api/browser-apply/route.ts app/api/browser-apply/route.OLD.ts

# Use new queue-based route
mv app/api/browser-apply/route.NEW.ts app/api/browser-apply/route.ts
```

## 🔑 Key Differences

### Old Flow (Direct Processing)
```
Next.js API → Python Service → Browser Automation (synchronous)
                                ↓
                          Wait for completion
```
**Problems:**
- Blocks during long-running jobs
- No retry mechanism
- Difficult to scale
- Timeouts on slow jobs

### New Flow (Queue-based)
```
Next.js API → Browser Service API → Redis Queue
                                         ↓
                                    Worker Pool (async)
                                         ↓
                                   Browser Automation
```
**Benefits:**
- Immediate response (202 Accepted)
- Background processing
- Auto-scaling workers
- Built-in retries
- Better error handling

## 📊 Monitoring

### RQ Dashboard (Local)
Access at http://localhost:9181 to see:
- Queued jobs
- Active workers
- Failed jobs
- Job history

### CloudWatch Logs (Production)
```bash
# Browser service logs
aws logs tail /ecs/resumemax-browser-service --follow

# Worker logs
aws logs tail /ecs/resumemax-browser-worker --follow
```

### Health Checks
```bash
# Basic health
GET /health

# Browser availability
GET /health/browser

# Queue status
GET /health/queue

# Metrics
GET /metrics
```

## 🐛 Troubleshooting

### Issue: Jobs not processing
```bash
# Check Redis connection
docker-compose logs redis

# Check worker logs
docker-compose logs worker

# Restart workers
docker-compose restart worker
```

### Issue: Docker build fails
```bash
# Clear Docker cache
docker system prune -a

# Rebuild
docker-compose build --no-cache
```

### Issue: Browser fails to launch
```bash
# Check Playwright installation
docker-compose exec browser-service playwright install chromium

# Check logs for specific error
docker-compose logs browser-service | grep ERROR
```

## 📚 Next Steps

1. **Test locally** with docker-compose
2. **Update API routes** in Next.js
3. **Deploy to AWS** using deployment script
4. **Monitor** with CloudWatch and Sentry
5. **Optimize** based on metrics

## 💡 Pro Tips

1. **Use environment-specific configs**
   ```python
   # Different settings per environment
   if settings.environment == "production":
       settings.headless = True
       settings.max_browser_sessions = 3
   ```

2. **Monitor queue depth**
   ```bash
   # Check queue length
   redis-cli -h localhost llen browser-automation
   ```

3. **Graceful scaling**
   - Scale workers during peak hours
   - Use Fargate Spot for cost savings
   - Set appropriate auto-scaling thresholds

4. **Debug mode**
   ```bash
   # Run with debug logging
   LOG_LEVEL=DEBUG docker-compose up
   ```

## 🆘 Need Help?

- 📖 Full guide: `docs/DEPLOYMENT_GUIDE.md`
- 🐛 Issues: Check CloudWatch logs
- 📧 Support: Open GitHub issue

---

**Migration Checklist:**
- [ ] Copy environment variables to browser-service/.env
- [ ] Test locally with docker-compose
- [ ] Replace API route in Next.js
- [ ] Deploy to AWS
- [ ] Update Vercel environment variables
- [ ] Monitor first production jobs
- [ ] Set up alerts in CloudWatch
