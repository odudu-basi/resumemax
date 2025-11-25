# 🌍 Global Auto-Apply Feature Deployment Guide

This guide explains how to deploy your ResumeMax application so users worldwide can use the headless browser auto-apply feature.

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Environment Variables Review](#environment-variables-review)
3. [Deployment Options](#deployment-options)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Testing](#testing)
6. [Monitoring & Troubleshooting](#monitoring)

---

## 🏗️ Architecture Overview

### Current Flow
```
User (Browser)
    ↓
JobCard Component (clicks "Auto Apply")
    ↓
Next.js API Route: /api/browser-apply
    ↓
Python Service (browser-service/) → Headless Browser
    ↓
Supabase (session tracking & user data)
```

### Key Components
1. **Next.js Frontend + API Routes** → Deploy to **Vercel**
2. **Python Browser Service** → Deploy to **Railway/Render/Fly.io**
3. **Supabase** → Already hosted (cloud)

---

## 🔧 Environment Variables Review

### ❌ REMOVE from browser-service/.env:
- `REDIS_URL=redis://redis:6379/0` - **NOT USED** (no Redis queue implementation)
- `ANTHROPIC_API_KEY=` - Empty, not used
- `SENTRY_DSN=` - Empty (add back when configured)

### ✅ KEEP in browser-service/.env:
- `API_KEY` - For securing your Python service
- `OPENAI_API_KEY` - For browser-use agent (REQUIRED)
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` - For session tracking
- `HEADLESS` - Browser mode (true for production)
- `BROWSER_TIMEOUT` - Timeout settings
- `SERVICE_PORT` & `SERVICE_HOST` - Service configuration

### Clean .env file should look like:
```bash
# Environment
ENVIRONMENT=production

# Security
API_KEY=your-secure-api-key-here

# AI/LLM
OPENAI_API_KEY=sk-proj-...

# Browser
HEADLESS=true
BROWSER_TIMEOUT=60000

# Service
SERVICE_PORT=8000
SERVICE_HOST=0.0.0.0

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🎯 Deployment Options

### Option 1: Vercel + Railway (RECOMMENDED ⭐)
- **Next.js**: Vercel (serverless, automatic scaling)
- **Python Service**: Railway (containerized, supports headless Chrome)
- **Cost**: Free tier available, ~$5-20/month for production
- **Pros**: Easy setup, automatic scaling, good performance
- **Cons**: Cold starts on free tier

### Option 2: Vercel + Render
- **Next.js**: Vercel
- **Python Service**: Render (containerized)
- **Cost**: Free tier available, ~$7/month for paid
- **Pros**: Simple deployment, good free tier
- **Cons**: Free tier spins down after inactivity

### Option 3: Vercel + Fly.io
- **Next.js**: Vercel
- **Python Service**: Fly.io (edge computing)
- **Cost**: Pay-as-you-go, ~$5-15/month
- **Pros**: Global edge deployment, fast cold starts
- **Cons**: More complex setup

### ❌ What WON'T Work
- **Vercel Serverless Functions for Python Service**: 10-60 second timeout (applications take 2-5 minutes)
- **Running Python locally**: Users worldwide can't reach localhost

---

## 🚀 Step-by-Step Deployment (Railway Option)

### Phase 1: Prepare Browser Service Files

You need to create these files in your `browser-service/` directory:

#### 1. `Dockerfile`
```dockerfile
FROM python:3.11-slim

# Install system dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium
RUN playwright install-deps chromium

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

CMD ["python", "main.py"]
```

#### 2. `requirements.txt`
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
playwright==1.40.0
browser-use>=0.1.0
openai>=1.3.0
supabase>=2.0.0
pydantic>=2.5.0
pydantic-settings>=2.0.0
python-dotenv==1.0.0
requests==2.31.0
```

#### 3. `main.py` (FastAPI Application)
```python
import os
import asyncio
import uuid
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Browser Automation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("API_KEY", "")
session_store: Dict[str, Dict[str, Any]] = {}


class ApplyRequest(BaseModel):
    job_url: str
    user_id: str
    session_id: Optional[str] = None
    user_profile: Dict[str, Any]
    headless: bool = True
    timeout: int = 300


def verify_api_key(authorization: str = Header(None)):
    if not API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    if authorization.replace("Bearer ", "") != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "browser-automation"}


@app.post("/apply")
async def apply_to_job(request: ApplyRequest, authorization: str = Header(None)):
    verify_api_key(authorization)

    session_id = request.session_id or f"session_{uuid.uuid4()}"

    session_store[session_id] = {
        "status": "in_progress",
        "progress": 0,
        "session_id": session_id,
    }

    # Start background task
    asyncio.create_task(process_application(session_id, request))

    return {
        "success": True,
        "session_id": session_id,
        "status": "initiated",
    }


async def process_application(session_id: str, request: ApplyRequest):
    try:
        # Import your browser automation logic here
        from worker import run_browser_automation

        result = await run_browser_automation(
            user_id=request.user_id,
            job_url=request.job_url,
            user_profile=request.user_profile,
            resume_data={},
            session_id=session_id,
        )

        session_store[session_id] = {
            "status": "completed" if result.get("success") else "failed",
            "progress": 100,
            "session_id": session_id,
            "result": result,
        }
    except Exception as e:
        session_store[session_id] = {
            "status": "failed",
            "progress": 0,
            "session_id": session_id,
            "error": str(e),
        }


@app.get("/status/{session_id}")
async def get_status(session_id: str, authorization: str = Header(None)):
    verify_api_key(authorization)
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_store[session_id]


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("SERVICE_HOST", "0.0.0.0"),
        port=int(os.getenv("SERVICE_PORT", 8000)),
    )
```

---

### Phase 2: Deploy to Railway

#### Step 1: Sign Up
1. Go to https://railway.app
2. Sign up with GitHub
3. Connect your repository

#### Step 2: Create Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Railway detects Dockerfile automatically

#### Step 3: Configure
1. Settings → Root Directory: `browser-service`
2. Add environment variables:
   ```
   ENVIRONMENT=production
   API_KEY=<openssl rand -base64 32>
   OPENAI_API_KEY=<your-key>
   SUPABASE_URL=<your-url>
   SUPABASE_SERVICE_ROLE_KEY=<your-key>
   HEADLESS=true
   BROWSER_TIMEOUT=60000
   SERVICE_PORT=8000
   SERVICE_HOST=0.0.0.0
   ```

#### Step 4: Deploy
1. Click "Deploy"
2. Wait ~5-10 minutes
3. Copy your Railway URL: `https://your-service.railway.app`

#### Step 5: Test
```bash
curl https://your-service.railway.app/health
```

---

### Phase 3: Deploy to Vercel

#### Step 1: Update API Route

In `app/api/browser-apply/route.ts`, add these constants at the top:

```typescript
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const PYTHON_SERVICE_API_KEY = process.env.PYTHON_SERVICE_API_KEY || '';
```

Update the fetch call to include Authorization header:

```typescript
const response = await fetch(`${PYTHON_SERVICE_URL}/apply`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PYTHON_SERVICE_API_KEY}`,
  },
  body: JSON.stringify(pythonPayload),
});
```

#### Step 2: Add Environment Variables to Vercel

```bash
vercel env add PYTHON_SERVICE_URL
# Enter: https://your-service.railway.app

vercel env add PYTHON_SERVICE_API_KEY
# Enter: <same-api-key-from-railway>

vercel --prod
```

Or via Vercel Dashboard:
1. Project Settings → Environment Variables
2. Add both variables for Production, Preview, and Development
3. Redeploy

---

### Phase 4: Update .env Files

#### Main Project `.env.example`:
Add these lines:
```bash
# Python Browser Service
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_API_KEY=test-api-key-local-dev-12345
```

#### Browser Service `.env`:
Remove `REDIS_URL` and update to match `.env.example`

---

## ✅ Testing

### 1. Test Python Service
```bash
curl https://your-service.railway.app/health
```

### 2. Test Locally with Production Service
```bash
PYTHON_SERVICE_URL=https://your-service.railway.app npm run dev
```

### 3. Test Full Production
1. Deploy to Vercel
2. Click "Auto Apply" on job
3. Check Railway logs
4. Verify Supabase updates

---

## 🔍 Monitoring

### Railway Logs
- Build logs: Docker build process
- Deploy logs: Service startup
- Application logs: Python service logs

### Common Issues

**"Cannot reach Python service"**
- Check `PYTHON_SERVICE_URL` in Vercel
- Ensure Railway service is running
- Check Railway logs

**"Browser timeout"**
- Increase `BROWSER_TIMEOUT`
- Check for CAPTCHAs

**"Cold starts"**
- Free tier spins down
- Upgrade to Railway Pro ($5/month)
- Implement Vercel Cron warming

---

## 💰 Cost Estimate

### Free Tier (Testing)
- Vercel: Free
- Railway: Free (~$5 credit/month)
- Supabase: Free
- **Total**: $0/month

### Production
- Vercel Pro: $20/month
- Railway Pro: $5-20/month
- Supabase Pro: $25/month
- **Total**: ~$50-65/month

---

## 🚦 Quick Start Checklist

- [ ] Remove `REDIS_URL` from browser-service/.env
- [ ] Create `Dockerfile` in browser-service/
- [ ] Create `requirements.txt` in browser-service/
- [ ] Create/update `main.py` in browser-service/
- [ ] Deploy to Railway
- [ ] Add `PYTHON_SERVICE_URL` to Vercel
- [ ] Add `PYTHON_SERVICE_API_KEY` to Vercel
- [ ] Update API route with Authorization header
- [ ] Test end-to-end
- [ ] Monitor and optimize

---

## 📚 Resources

- [Railway Docs](https://docs.railway.app)
- [Vercel Docs](https://vercel.com/docs)
- [Playwright Docker](https://playwright.dev/docs/docker)
- [FastAPI Docs](https://fastapi.tiangolo.com)

---

**Ready to deploy? Start with Phase 1!** 🚀
