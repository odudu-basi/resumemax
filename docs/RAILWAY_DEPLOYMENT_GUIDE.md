# 🚂 Railway Deployment Guide - ResumeMax Browser Service

Complete guide to deploy your browser automation service with Redis on Railway.

---

## 📋 Overview

**Architecture:**
```
User (Browser)
    ↓
Next.js on Vercel (/api/browser-apply)
    ↓
Railway Browser Service (FastAPI + RQ Worker)
    ↓
Railway Redis (Queue)
    ↓
Supabase (Sessions + Video Storage)
```

**Services on Railway:**
1. **Browser Service** - FastAPI server + RQ Worker
2. **Redis** - Job queue (Railway add-on)

---

## 🚀 Step-by-Step Deployment

### Phase 1: Set Up Railway Account

#### 1.1 Sign Up
1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign up with GitHub
4. Connect your repository

#### 1.2 Install Railway CLI (Optional but recommended)
```bash
npm install -g @railway/cli
railway login
```

---

### Phase 2: Deploy Browser Service

#### 2.1 Create New Project
1. In Railway dashboard, click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your `resume-scorecard` repository
4. Railway will detect your Dockerfile automatically

#### 2.2 Configure Root Directory
Since your service is in `browser-service/`:
1. Click on your service → **Settings**
2. Under **"Build"**, set **Root Directory** to: `browser-service`
3. Under **"Deploy"**, Railway will use the `Dockerfile` in that directory

#### 2.3 Add Redis
1. In your project, click **"New"** → **"Database"** → **"Add Redis"**
2. Railway will provision a Redis instance
3. It will auto-generate a `REDIS_URL` environment variable
4. Copy the `REDIS_URL` (you'll need it for local testing)

---

### Phase 3: Configure Environment Variables

Click on your browser-service → **Variables** tab and add these:

```bash
# Environment
ENVIRONMENT=production
LOG_LEVEL=INFO

# Security - Generate with: openssl rand -base64 32
API_KEY=your-super-secret-api-key-here

# Redis (automatically set by Railway Redis addon)
# REDIS_URL=redis://... (Railway sets this automatically)

# AI/LLM
OPENAI_API_KEY=sk-proj-your-openai-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key

# Browser Settings
HEADLESS=true
MAX_BROWSER_SESSIONS=3
BROWSER_TIMEOUT=60000

# Queue Settings
QUEUE_NAME=browser-automation
JOB_TIMEOUT=600
RESULT_TTL=3600

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=2

# Optional: Sentry (for error tracking)
# SENTRY_DSN=https://...@sentry.io/...
# SENTRY_ENVIRONMENT=production
```

**To generate API_KEY:**
```bash
openssl rand -base64 32
```

---

### Phase 4: Deploy

#### 4.1 Trigger Deployment
1. Railway will automatically deploy when you push to your main branch
2. Or click **"Deploy"** in the Railway dashboard
3. Wait 5-10 minutes for first build (installs Playwright + Chromium)

#### 4.2 Monitor Build
1. Click on **"Deployments"** tab
2. Watch the build logs
3. Look for:
   ```
   ✓ Installing Playwright browsers
   ✓ Starting application
   ✓ Uvicorn running on 0.0.0.0:8000
   ```

#### 4.3 Get Your Service URL
1. Click on **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Copy your URL: `https://your-service.up.railway.app`
4. Save this - you'll need it for Vercel

---

### Phase 5: Test Your Deployment

#### 5.1 Test Health Endpoint
```bash
curl https://your-service.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-25T...",
  "environment": "production",
  "version": "2.0.0"
}
```

#### 5.2 Test Queue Health
```bash
curl https://your-service.up.railway.app/health/queue
```

Expected response:
```json
{
  "status": "healthy",
  "redis_connected": true,
  "queue_name": "browser-automation",
  "queued_jobs": 0,
  "workers": 0
}
```

#### 5.3 Test Browser Health
```bash
curl https://your-service.up.railway.app/health/browser
```

Expected response:
```json
{
  "status": "healthy",
  "browser_available": true,
  "message": "Browser launched successfully"
}
```

---

### Phase 6: Set Up RQ Worker

Your Dockerfile runs both the FastAPI server AND you need to run RQ workers.

#### Option A: Add Worker as Separate Service (RECOMMENDED)

1. In Railway, click **"New"** → **"Empty Service"**
2. Link it to same GitHub repo
3. Set **Root Directory**: `browser-service`
4. Under **Settings** → **Deploy**, set custom **Start Command**:
   ```bash
   rq worker --url $REDIS_URL browser-automation
   ```
5. Add same environment variables as main service
6. Deploy

#### Option B: Run Worker in Same Container

Update your `Dockerfile` to use a process manager:

```dockerfile
# Install supervisor
RUN pip install supervisor

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Run with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

Create `browser-service/supervisord.conf`:
```ini
[supervisord]
nodaemon=true

[program:api]
command=python main.py
autostart=true
autorestart=true
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0

[program:worker]
command=rq worker --url %(ENV_REDIS_URL)s browser-automation
autostart=true
autorestart=true
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
```

**I RECOMMEND Option A** - it's simpler and you can scale workers independently.

---

### Phase 7: Configure Next.js to Use Railway

#### 7.1 Add Environment Variables to Vercel

In your Vercel project:

```bash
vercel env add PYTHON_SERVICE_URL
# Enter: https://your-service.up.railway.app

vercel env add PYTHON_SERVICE_API_KEY
# Enter: <same-api-key-from-railway>
```

Or via Vercel Dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add for **Production**, **Preview**, and **Development**:
   - `PYTHON_SERVICE_URL` = `https://your-service.up.railway.app`
   - `PYTHON_SERVICE_API_KEY` = `<your-api-key>`

#### 7.2 Update Your API Route

**File**: `app/api/browser-apply/route.ts`

Add at the top:
```typescript
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const PYTHON_SERVICE_API_KEY = process.env.PYTHON_SERVICE_API_KEY || '';
```

Update the fetch call (around line 400):
```typescript
const response = await fetch(`${PYTHON_SERVICE_URL}/jobs/submit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': PYTHON_SERVICE_API_KEY,  // Add this header
  },
  body: JSON.stringify({
    user_id: validatedData.userId,
    job_url: validatedData.jobUrl,
    user_profile: pythonPayload,
    resume_data: {},
    session_id: validatedData.sessionId || crypto.randomUUID(),
  }),
});
```

Update the status check:
```typescript
const response = await fetch(
  `${PYTHON_SERVICE_URL}/jobs/${sessionId}`,
  {
    headers: {
      'X-API-Key': PYTHON_SERVICE_API_KEY,
    },
  }
);
```

#### 7.3 Deploy to Vercel
```bash
vercel --prod
```

---

## 🔍 Monitoring & Debugging

### View Logs
1. Railway Dashboard → Your Service → **Logs** tab
2. Watch real-time logs
3. Filter by "error", "warning", etc.

### Common Issues

#### Issue: "Cannot connect to Redis"
**Solution:**
- Check that Redis service is running
- Verify `REDIS_URL` is set correctly
- Make sure both services are in the same project

#### Issue: "Browser timeout"
**Solution:**
- Increase `BROWSER_TIMEOUT` env var
- Check Railway logs for Playwright errors
- Some sites have CAPTCHA (not solvable)

#### Issue: "Out of memory"
**Solution:**
- Upgrade Railway plan (free tier: 512MB, paid: 8GB)
- Reduce `MAX_BROWSER_SESSIONS`

#### Issue: "Worker not processing jobs"
**Solution:**
- Check worker service is running
- Verify worker has access to `REDIS_URL`
- Check queue name matches (`browser-automation`)

### Metrics Dashboard

View your service metrics at:
```
https://your-service.up.railway.app/metrics
```

Response:
```json
{
  "queued_jobs": 2,
  "active_jobs": 1,
  "failed_jobs": 0,
  "cpu_percent": 45.2,
  "memory_percent": 62.1,
  "redis_connected": true
}
```

---

## 💰 Cost Estimate

### Free Tier (Testing/MVP)
- **Railway**: $5 credit/month (expires after first month)
  - ~500 execution hours
  - Perfect for testing
- **Vercel**: Free (hobby tier)
- **Supabase**: Free (500MB database)
- **Total**: $0/month (first month), then need paid plan

### Production (Real Users)
- **Railway Pro**: $5-20/month
  - Browser Service: ~$10/month (always-on)
  - Redis: $5/month
- **Vercel Pro**: $20/month (optional, better performance)
- **Supabase Pro**: $25/month (8GB database)
- **Total**: ~$40-65/month

---

## 🎯 Deployment Checklist

Browser Service Setup:
- [ ] Railway account created
- [ ] Repository connected
- [ ] Root directory set to `browser-service`
- [ ] Redis addon added
- [ ] All environment variables set
- [ ] Service deployed successfully
- [ ] Health endpoint responding
- [ ] Queue health check passing
- [ ] Browser health check passing

Worker Setup:
- [ ] RQ worker service created (Option A)
- [ ] OR supervisor configured (Option B)
- [ ] Worker processing test jobs

Vercel Integration:
- [ ] `PYTHON_SERVICE_URL` added to Vercel
- [ ] `PYTHON_SERVICE_API_KEY` added to Vercel
- [ ] API route updated with headers
- [ ] Deployed to production

Testing:
- [ ] Test job submission from Next.js
- [ ] Verify job appears in queue
- [ ] Worker picks up and processes job
- [ ] Result returned to Next.js
- [ ] Video uploaded to Supabase
- [ ] Session updated with video URL

---

## 🔧 Local Development with Railway Redis

To test locally with your Railway Redis:

1. Get Redis URL from Railway:
   ```bash
   railway variables
   ```

2. Update your local `.env`:
   ```bash
   REDIS_URL=redis://default:password@host:port
   ```

3. Run locally:
   ```bash
   # Terminal 1: Start API
   python main.py

   # Terminal 2: Start worker
   rq worker --url $REDIS_URL browser-automation
   ```

---

## 🚦 Next Steps

1. ✅ Deploy browser service to Railway
2. ✅ Add Redis addon
3. ✅ Set environment variables
4. ✅ Create worker service
5. ✅ Test all health endpoints
6. ✅ Configure Vercel with Railway URL
7. ✅ Test end-to-end flow
8. ✅ Set up video storage in Supabase
9. ✅ Monitor and optimize

---

## 📚 Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway Redis Guide](https://docs.railway.app/databases/redis)
- [RQ Documentation](https://python-rq.org/)
- [Playwright in Docker](https://playwright.dev/docs/docker)

---

**Ready to deploy? Start with Phase 1!** 🚀
