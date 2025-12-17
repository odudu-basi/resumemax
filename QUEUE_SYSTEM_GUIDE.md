# 🚀 ResumeMax Queue System Guide

## Overview

This guide covers the complete implementation of a Redis-based job queuing and rate limiting system for ResumeMax, designed to scale from Developer to Startup Browserbase plans.

## 📊 Plan Capacity Analysis

### Developer Plan (Current)
- **Concurrent Sessions**: 5
- **Monthly Sessions**: ~1000
- **Recommended Users**: 10-25
- **Jobs per User**: 10 active, 5/hour, 20/day
- **Estimated Monthly Revenue**: $250-625 ($25/user)

### Startup Plan (Target)
- **Concurrent Sessions**: 25
- **Monthly Sessions**: ~5000+
- **Recommended Users**: 100-250
- **Jobs per User**: 50 active, 15/hour, 100/day
- **Estimated Monthly Revenue**: $2,500-6,250 ($25/user)

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Request  │───▶│   Rate Limiter  │───▶│   Job Queue     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Notification  │◀───│  Job Processor  │◀───│   Redis Store   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Installation & Setup

### 1. Install Dependencies

```bash
npm install ioredis uuid
npm install --save-dev @types/uuid
```

### 2. Environment Variables

```bash
# .env
REDIS_URL=redis://localhost:6379
BROWSERBASE_PLAN=developer  # or 'startup'
BROWSERBASE_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

### 3. Start Redis (Local Development)

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or using Docker Compose
docker-compose -f docker-compose.queue.yml up -d redis
```

### 4. Start Job Processor

```bash
# Development
node scripts/start-job-processor.js

# Production with PM2
pm2 start scripts/start-job-processor.js --name "resumemax-processor"

# Docker
docker-compose -f docker-compose.queue.yml up -d
```

## 📝 Usage Examples

### Submit a Job

```typescript
// Frontend
const response = await fetch('/api/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    jobUrl: 'https://company.com/job/123',
    userProfile: {
      fullName: 'John Doe',
      email: 'john@example.com',
      // ... other profile data
    },
    priority: 'normal' // 'normal', 'high', 'urgent'
  })
});

const result = await response.json();
console.log('Job ID:', result.jobId);
console.log('Queue Position:', result.queuePosition);
console.log('Estimated Wait:', result.estimatedWaitTime, 'seconds');
```

### Check Job Status

```typescript
const response = await fetch(`/api/jobs?userId=${userId}`);
const data = await response.json();

console.log('Your Jobs:', data.jobs);
console.log('Queue Stats:', data.queueStats);
console.log('Your Limits:', data.userLimits);
```

### Cancel a Job

```typescript
await fetch('/api/jobs', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobId: 'job123',
    userId: 'user123'
  })
});
```

## 🎛️ Rate Limiting Configuration

### Per-User Limits

```javascript
// Developer Plan
{
  maxJobsPerUser: 10,    // Active jobs
  maxJobsPerHour: 5,     // Hourly submission limit
  maxJobsPerDay: 20,     // Daily submission limit
}

// Startup Plan
{
  maxJobsPerUser: 50,    // Active jobs
  maxJobsPerHour: 15,    // Hourly submission limit
  maxJobsPerDay: 100,    // Daily submission limit
}
```

### System-Wide Limits

```javascript
// Developer Plan
{
  maxConcurrentSessions: 5,
  maxUsers: 25
}

// Startup Plan
{
  maxConcurrentSessions: 25,
  maxUsers: 250
}
```

## 📈 Monitoring & Analytics

### Queue Dashboard

Access the queue monitor at `http://localhost:8080` when using Docker Compose.

### Key Metrics to Track

1. **Queue Length**: Number of jobs waiting
2. **Processing Time**: Average job duration
3. **Success Rate**: Completed vs failed jobs
4. **User Activity**: Jobs per user, peak hours
5. **System Load**: CPU, memory, Redis usage

### Admin API Endpoints

```bash
# Get comprehensive stats
GET /api/admin/queue

# Pause/resume queue
POST /api/admin/queue
{
  "action": "pause_queue" | "resume_queue"
}

# Retry failed job
POST /api/admin/queue
{
  "action": "retry_job",
  "jobId": "job123"
}

# User management
POST /api/admin/queue
{
  "action": "ban_user" | "unban_user",
  "userId": "user123"
}
```

## 🔄 Job Lifecycle

```
Submit → Queue → Rate Check → Processing → Complete/Fail → Notify
   ↓        ↓         ↓           ↓            ↓         ↓
 API    Redis    Limits    Stagehand    Update    User
```

### Job States

- **queued**: Waiting in queue
- **processing**: Currently being executed
- **completed**: Successfully finished
- **failed**: Error occurred (will retry)
- **cancelled**: User cancelled

## 🚨 Error Handling & Retries

### Automatic Retries

- **Max Attempts**: 3
- **Backoff Strategy**: Exponential (1min, 2min, 4min)
- **Retry Conditions**: Network errors, temporary failures
- **No Retry**: Invalid user data, permanent errors

### Failure Recovery

```javascript
// Manual retry via admin
await fetch('/api/admin/queue', {
  method: 'POST',
  body: JSON.stringify({
    action: 'retry_job',
    jobId: 'failed_job_id'
  })
});
```

## 💰 Cost Optimization

### Browserbase Session Management

```javascript
// Efficient session usage
const sessionConfig = {
  keepAlive: false,           // Don't keep sessions idle
  timeout: 300000,           // 5 minute timeout
  concurrent: plan === 'startup' ? 25 : 5
};
```

### Redis Memory Optimization

```redis
# Redis configuration
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
```

## 🔧 Scaling Strategies

### Horizontal Scaling (Multiple Processors)

```bash
# Run multiple processors
pm2 start scripts/start-job-processor.js -i 2 --name "processor"
```

### Vertical Scaling (Resource Allocation)

```yaml
# docker-compose.yml
job-processor:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '1.0'
        memory: 1G
```

### Database Optimization

```sql
-- Index for faster job lookups
CREATE INDEX idx_user_jobs ON job_history(user_id, created_at DESC);
CREATE INDEX idx_job_status ON job_history(status, created_at);
```

## 📊 Performance Benchmarks

### Developer Plan Capacity

- **Peak Throughput**: ~60 jobs/hour
- **Average Job Duration**: 5 minutes
- **Concurrent Users**: 10-15 active
- **Queue Wait Time**: 0-10 minutes

### Startup Plan Capacity

- **Peak Throughput**: ~300 jobs/hour
- **Average Job Duration**: 5 minutes
- **Concurrent Users**: 50-100 active
- **Queue Wait Time**: 0-5 minutes

## 🛡️ Security Considerations

### Rate Limiting Protection

```javascript
// IP-based rate limiting
const ipLimits = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // requests per window
};

// User-based rate limiting
const userLimits = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: plan === 'startup' ? 15 : 5
};
```

### Input Validation

```javascript
// Job submission validation
const jobSchema = {
  userId: { type: 'string', required: true },
  jobUrl: { type: 'url', required: true },
  userProfile: { type: 'object', required: true }
};
```

## 🚀 Deployment Guide

### Production Deployment

```bash
# 1. Build and deploy
npm run build
docker-compose -f docker-compose.queue.yml up -d

# 2. Monitor logs
docker-compose logs -f job-processor

# 3. Health checks
curl http://localhost:3000/api/jobs/health
```

### Environment-Specific Configs

```javascript
// config/production.js
module.exports = {
  redis: {
    url: process.env.REDIS_URL,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  },
  queue: {
    concurrency: process.env.BROWSERBASE_PLAN === 'startup' ? 25 : 5,
    removeOnComplete: 100,
    removeOnFail: 50
  }
};
```

## 📞 Support & Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis status
   redis-cli ping
   # Should return PONG
   ```

2. **Jobs Stuck in Queue**
   ```bash
   # Check processor status
   pm2 status
   # Restart if needed
   pm2 restart resumemax-processor
   ```

3. **Rate Limit Errors**
   ```javascript
   // Check user limits
   const limits = await queueManager.checkUserLimits(userId);
   console.log(limits);
   ```

### Monitoring Commands

```bash
# Queue stats
redis-cli ZCARD job_queue
redis-cli SCARD active_sessions

# Memory usage
redis-cli INFO memory

# Processor health
curl http://localhost:3000/api/admin/queue
```

## 🎯 Next Steps

1. **Implement WebSocket notifications** for real-time updates
2. **Add email notifications** for job completion
3. **Create mobile app integration** with push notifications
4. **Implement job scheduling** for delayed execution
5. **Add analytics dashboard** for business insights

---

## 📋 Quick Start Checklist

- [ ] Install Redis and dependencies
- [ ] Configure environment variables
- [ ] Start job processor
- [ ] Test job submission
- [ ] Monitor queue dashboard
- [ ] Set up production deployment
- [ ] Configure monitoring alerts

**Need help?** Check the troubleshooting section or contact support.
