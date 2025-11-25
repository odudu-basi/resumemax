# ResumeMax Browser Automation Service - AWS ECS Deployment Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [AWS Deployment](#aws-deployment)
5. [Configuration](#configuration)
6. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
7. [Cost Optimization](#cost-optimization)

## Architecture Overview

### High-Level Architecture
```
┌─────────────────┐      HTTPS       ┌──────────────────┐
│   Next.js App   │ ◄───────────────► │  Application     │
│   (Vercel)      │                   │  Load Balancer   │
└─────────────────┘                   └────────┬─────────┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           │                                       │
                     ┌─────▼──────┐                     ┌─────────▼────────┐
                     │ ECS Fargate│                     │  ECS Fargate     │
                     │ Browser API│                     │  Workers (2-20)  │
                     │ (2-10 tasks│                     │                  │
                     └─────┬──────┘                     └─────────┬────────┘
                           │                                      │
                           └──────────┬───────────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │ ElastiCache    │
                              │ Redis          │
                              │ (Job Queue)    │
                              └────────────────┘
```

### Components

1. **Browser Service API** (Fargate)
   - Receives job submissions from Next.js
   - Validates requests and enqueues jobs
   - Provides job status endpoints
   - Auto-scales based on CPU (2-10 tasks)

2. **Worker Pool** (Fargate)
   - Processes browser automation jobs
   - Runs headless Chromium with Playwright
   - Auto-scales based on queue depth (2-20 tasks)

3. **Redis** (ElastiCache)
   - Job queue management
   - Result caching
   - Session state storage

4. **Application Load Balancer**
   - Routes traffic to browser service
   - Health checks
   - SSL termination (if configured)

## Prerequisites

### Required Tools
- AWS CLI v2+ ([Install](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html))
- Docker Desktop ([Install](https://www.docker.com/products/docker-desktop))
- Git
- Node.js 18+ (for local testing)
- Python 3.11+ (for local testing)

### AWS Requirements
- AWS Account with appropriate permissions
- VPC with:
  - At least 2 private subnets (for ECS tasks)
  - At least 2 public subnets (for load balancer)
  - NAT Gateway or NAT Instance (for internet access from private subnets)
- IAM permissions to create:
  - ECS clusters, services, tasks
  - ElastiCache clusters
  - Application Load Balancers
  - CloudWatch log groups
  - Secrets Manager secrets
  - ECR repositories

### API Keys Needed
- OpenAI API key
- Anthropic API key (optional)
- Sentry DSN (optional, for error tracking)

## Local Development Setup

### 1. Set Up Browser Service Locally

```bash
# Navigate to browser service directory
cd browser-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

### 2. Start Services with Docker Compose

```bash
# In browser-service directory
docker-compose up -d

# View logs
docker-compose logs -f

# Services will be available at:
# - Browser API: http://localhost:8000
# - RQ Dashboard: http://localhost:9181
# - Redis: localhost:6379
```

### 3. Test Locally

```bash
# Health check
curl http://localhost:8000/health

# Browser health check
curl http://localhost:8000/health/browser

# Queue health check
curl http://localhost:8000/health/queue

# Submit test job (requires API key)
curl -X POST http://localhost:8000/jobs/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "user_id": "test-user",
    "job_url": "https://example.com/job",
    "user_profile": {},
    "resume_data": {},
    "session_id": "test-session-1"
  }'
```

### 4. Update Next.js API Route

Replace your current `app/api/browser-apply/route.ts` with `route.NEW.ts`:

```bash
# Backup current route
mv app/api/browser-apply/route.ts app/api/browser-apply/route.OLD.ts

# Use new queue-based route
mv app/api/browser-apply/route.NEW.ts app/api/browser-apply/route.ts

# Update .env.local
echo "BROWSER_SERVICE_URL=http://localhost:8000" >> .env.local
echo "BROWSER_SERVICE_API_KEY=your-api-key-here" >> .env.local
```

## AWS Deployment

### Step 1: Prepare AWS Environment

```bash
# Configure AWS CLI
aws configure

# Set environment variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ENVIRONMENT=production
```

### Step 2: Create Secrets

Store sensitive credentials in AWS Secrets Manager:

```bash
# Browser service API key (generate a secure random key)
aws secretsmanager create-secret \
    --name resumemax/browser-service/api-key \
    --description "Internal API key for browser service" \
    --secret-string "$(openssl rand -base64 32)" \
    --region $AWS_REGION

# OpenAI API key
aws secretsmanager create-secret \
    --name resumemax/openai-api-key \
    --description "OpenAI API key" \
    --secret-string "sk-your-openai-key-here" \
    --region $AWS_REGION

# Anthropic API key
aws secretsmanager create-secret \
    --name resumemax/anthropic-api-key \
    --description "Anthropic API key" \
    --secret-string "sk-ant-your-anthropic-key-here" \
    --region $AWS_REGION

# Sentry DSN (optional)
aws secretsmanager create-secret \
    --name resumemax/sentry-dsn \
    --description "Sentry DSN for error tracking" \
    --secret-string "https://your-sentry-dsn" \
    --region $AWS_REGION
```

### Step 3: Run Deployment Script

```bash
cd infrastructure

# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will:
1. Create ECR repository
2. Build and push Docker image
3. Create/verify secrets
4. Deploy CloudFormation stack
5. Output the service URL

### Step 4: Update Next.js Environment

After deployment completes, update your production environment variables:

```bash
# Get the load balancer DNS from deployment output
BROWSER_SERVICE_URL="http://your-load-balancer-dns"

# Get API key from Secrets Manager
API_KEY=$(aws secretsmanager get-secret-value \
    --secret-id resumemax/browser-service/api-key \
    --query SecretString \
    --output text)

# Update Vercel environment variables
vercel env add BROWSER_SERVICE_URL production
# Paste the URL when prompted

vercel env add BROWSER_SERVICE_API_KEY production
# Paste the API key when prompted
```

## Configuration

### Environment Variables

#### Browser Service
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENVIRONMENT` | Environment name | `development` | No |
| `LOG_LEVEL` | Logging level | `INFO` | No |
| `API_KEY` | Internal API key | - | Yes |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` | Yes |
| `QUEUE_NAME` | RQ queue name | `browser-automation` | No |
| `HEADLESS` | Run browser headless | `true` | No |
| `MAX_BROWSER_SESSIONS` | Max concurrent sessions | `3` | No |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | No |
| `SENTRY_DSN` | Sentry error tracking | - | No |

#### Next.js API
| Variable | Description | Required |
|----------|-------------|----------|
| `BROWSER_SERVICE_URL` | Browser service endpoint | Yes |
| `BROWSER_SERVICE_API_KEY` | API key for authentication | Yes |

### Auto-Scaling Configuration

The deployment includes auto-scaling for both services:

**Browser API Service:**
- Min: 2 tasks
- Max: 10 tasks
- Scale up: CPU > 70% for 1 minute
- Scale down: CPU < 70% for 5 minutes

**Worker Service:**
- Min: 3 tasks
- Max: 20 tasks
- Scale up: CPU > 70% for 1 minute
- Scale down: CPU < 70% for 5 minutes

To adjust scaling parameters, edit `infrastructure/cloudformation-template.yml`.

## Monitoring & Troubleshooting

### View Logs

```bash
# Browser service logs
aws logs tail /ecs/resumemax-browser-service --follow --region $AWS_REGION

# Worker logs
aws logs tail /ecs/resumemax-browser-worker --follow --region $AWS_REGION

# Filter for errors
aws logs tail /ecs/resumemax-browser-service \
    --filter-pattern "ERROR" \
    --follow \
    --region $AWS_REGION
```

### Check Service Health

```bash
# Get load balancer DNS
LB_DNS=$(aws cloudformation describe-stacks \
    --stack-name resumemax-browser-service \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
    --output text \
    --region $AWS_REGION)

# Health check
curl http://$LB_DNS/health

# Browser health
curl http://$LB_DNS/health/browser

# Queue health
curl http://$LB_DNS/health/queue

# Metrics
curl http://$LB_DNS/metrics
```

### Common Issues

#### 1. Jobs stuck in queue
**Symptoms:** Jobs remain in `queued` status
**Solution:**
```bash
# Check worker count
aws ecs describe-services \
    --cluster resumemax-browser-service-cluster \
    --services browser-worker \
    --query 'services[0].runningCount'

# Check worker logs for errors
aws logs tail /ecs/resumemax-browser-worker --follow
```

#### 2. High memory usage
**Symptoms:** Tasks being killed, OOM errors
**Solution:** Increase task memory in CloudFormation template (currently 4096 MB)

#### 3. Redis connection errors
**Symptoms:** "Connection refused" errors
**Solution:**
```bash
# Verify Redis is running
aws elasticache describe-cache-clusters \
    --cache-cluster-id resumemax-redis

# Check security group rules
aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=*Redis*"
```

### Debugging

Enable debug logging:

```bash
# Update service with debug logging
aws ecs update-service \
    --cluster resumemax-browser-service-cluster \
    --service browser-service \
    --force-new-deployment \
    --task-definition resumemax-browser-service:LATEST \
    --region $AWS_REGION
```

## Cost Optimization

### Estimated Monthly Costs (us-east-1)

| Resource | Configuration | Est. Cost/Month |
|----------|--------------|-----------------|
| ECS Fargate (Browser API) | 2 tasks × 2 vCPU × 4GB | ~$120 |
| ECS Fargate (Workers) | 3 tasks × 2 vCPU × 4GB | ~$180 |
| ElastiCache Redis | cache.t3.medium | ~$50 |
| ALB | 1 load balancer | ~$20 |
| Data Transfer | Variable | ~$20-100 |
| **Total** | | **~$390-470/month** |

### Cost Reduction Strategies

1. **Use Fargate Spot for workers**
   - Already configured in CloudFormation (80% Spot, 20% On-Demand)
   - Saves ~70% on worker costs

2. **Right-size resources**
   ```bash
   # Monitor CPU/memory usage
   aws cloudwatch get-metric-statistics \
       --namespace AWS/ECS \
       --metric-name CPUUtilization \
       --dimensions Name=ServiceName,Value=browser-service \
       --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
       --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
       --period 3600 \
       --statistics Average
   ```

3. **Adjust auto-scaling**
   - Lower min task count during off-peak hours
   - Use scheduled scaling actions

4. **Use Reserved Capacity**
   - For predictable baseline load
   - Savings Plans can reduce costs by 30-50%

## Next Steps

1. **Set up SSL/TLS**
   - Add ACM certificate to load balancer
   - Update Next.js to use HTTPS endpoint

2. **Configure monitoring**
   - Set up CloudWatch dashboards
   - Configure alarms for errors, latency, queue depth

3. **Implement CI/CD**
   - GitHub Actions workflow for automated deployments
   - Blue/green deployments

4. **Add observability**
   - Integrate with Datadog/New Relic
   - Set up distributed tracing

## Support

For issues or questions:
- Check logs in CloudWatch
- Review Sentry error reports
- Open GitHub issue with relevant logs
