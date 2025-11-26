# 🚀 Complete Testing Guide: Local → AWS Deployment

## Overview
This guide will walk you through testing your browser service in 5 phases:
1. **Local Docker Setup** (30 min)
2. **Local Integration Testing** (20 min)
3. **Pre-AWS Preparation** (15 min)
4. **AWS Deployment** (45 min)
5. **Production Testing** (20 min)

---

## 📍 PHASE 1: LOCAL DOCKER SETUP (30 minutes)

### Step 1: Verify Docker is Running

```bash
# Check if Docker is installed and running
docker --version
docker ps
```

**Expected output:** Docker version 20.x or higher
**If error:** Start Docker Desktop application

---

### Step 2: Navigate to Browser Service

```bash
cd /Users/oduduabasivictor/Desktop/Desktop\ -\ Oduduabasi\'s\ Laptop/Desktop/ResumeMax/resume-scorecard/browser-service
```

---

### Step 3: Verify Environment File

```bash
# Check .env file exists
ls -la .env

# View contents (keys will be hidden)
cat .env | grep -v "API_KEY"
```

**Expected:** You should see ENVIRONMENT, REDIS_URL, OPENAI_API_KEY, etc.

✅ **Already done!** Your `.env` file has been created with your OpenAI key.

---

### Step 4: Check Docker Compose File

```bash
# Verify docker-compose.yml exists
ls -la docker-compose.yml
```

**If missing:** We'll create it in the next step.

---

### Step 5: Build Docker Images

```bash
# Clean any old images
docker-compose down -v

# Build fresh images (this takes 5-10 minutes first time)
docker-compose build --no-cache
```

**Expected:** You'll see:
```
Building browser-service...
Building worker...
Successfully built...
```

**If errors:** Common fixes:
- Memory error: Increase Docker memory to 6GB (Docker Desktop → Settings → Resources)
- Network error: Check internet connection
- Permission error: Run `chmod +x` on any scripts

---

### Step 6: Start Services

```bash
# Start all services in background
docker-compose up -d

# Verify all containers are running
docker-compose ps
```

**Expected output:**
```
NAME                STATUS              PORTS
redis               Up                  6379/tcp
browser-service     Up                  0.0.0.0:8000->8000/tcp
worker              Up
rq-dashboard        Up                  0.0.0.0:9181->9181/tcp
```

**If not running:** Check logs:
```bash
docker-compose logs browser-service
docker-compose logs worker
```

---

### Step 7: Test Health Endpoint

```bash
# Test the API is responding
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "browser-automation",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### Step 8: Check RQ Dashboard (Job Queue Monitor)

Open in browser:
```
http://localhost:9181
```

**Expected:** You should see:
- 🟢 Workers: 1 active
- 📊 Queues: `default` queue with 0 jobs
- 📈 Dashboard showing stats

**Bookmark this page** - you'll use it to monitor jobs!

---

### Step 9: View Real-Time Logs

```bash
# Watch all service logs
docker-compose logs -f

# Or watch specific service
docker-compose logs -f worker
```

**Keep this terminal open** to see job processing in real-time.

---

## ✅ PHASE 1 CHECKPOINT

Before moving to Phase 2, verify:
- [ ] Docker containers all show "Up" status
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] RQ Dashboard opens at http://localhost:9181
- [ ] Logs show no errors

**If all green, continue to Phase 2!**

---

## 📍 PHASE 2: LOCAL INTEGRATION TESTING (20 minutes)

### Step 10: Update Next.js Environment

```bash
# Go back to project root
cd /Users/oduduabasivictor/Desktop/Desktop\ -\ Oduduabasi\'s\ Laptop/Desktop/ResumeMax/resume-scorecard
```

Add to your `.env.local` file:

```bash
# Add these lines at the end
BROWSER_SERVICE_URL=http://localhost:8000
BROWSER_SERVICE_API_KEY=test-api-key-local-dev-12345
```

**Or run this command:**
```bash
cat >> .env.local << 'EOF'

# Browser Service (Local Testing)
BROWSER_SERVICE_URL=http://localhost:8000
BROWSER_SERVICE_API_KEY=test-api-key-local-dev-12345
EOF
```

---

### Step 11: Check Current API Route

```bash
# See what's in your current browser-apply route
ls -la app/api/browser-apply/
```

We need to check if you're using the old synchronous version or new queue-based version.

```bash
# Check if it mentions "queue" or "redis"
grep -i "queue\|redis" app/api/browser-apply/route.ts | head -5
```

---

### Step 12: Create Test Script

Let's create a simple test to verify the integration:

```bash
# Create test file
cat > test-browser-service.ts << 'EOF'
/**
 * Test script for browser service
 * Run with: npx tsx test-browser-service.ts
 */

async function testBrowserService() {
  console.log('🧪 Testing Browser Service...\n');

  // Test 1: Health check
  console.log('1️⃣  Testing health endpoint...');
  try {
    const healthResponse = await fetch('http://localhost:8000/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData.status);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Submit a job
  console.log('\n2️⃣  Submitting test job...');
  try {
    const jobResponse = await fetch('http://localhost:8000/submit-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key-local-dev-12345'
      },
      body: JSON.stringify({
        url: 'https://boards.greenhouse.io/embed/job_app?token=test',
        userProfile: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          phone: '+1-555-0123'
        },
        options: {
          submitForm: false,  // Don't actually submit for test
          recordVideo: true
        }
      })
    });

    const jobData = await jobResponse.json();
    console.log('✅ Job submitted! Job ID:', jobData.job_id);

    // Test 3: Check job status
    console.log('\n3️⃣  Checking job status...');
    const jobId = jobData.job_id;

    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(
        `http://localhost:8000/job-status/${jobId}`,
        {
          headers: {
            'X-API-Key': 'test-api-key-local-dev-12345'
          }
        }
      );

      const statusData = await statusResponse.json();
      console.log(`   Status: ${statusData.status} (attempt ${attempts + 1}/${maxAttempts})`);

      if (statusData.status === 'completed') {
        console.log('✅ Job completed successfully!');
        console.log('   Result:', JSON.stringify(statusData.result, null, 2));
        break;
      } else if (statusData.status === 'failed') {
        console.log('❌ Job failed:', statusData.error);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.log('⏱️  Timeout: Job still processing after 30s');
      console.log('   Check RQ Dashboard: http://localhost:9181');
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }

  console.log('\n🎯 Test complete! Check logs above for results.');
  console.log('📊 View job queue: http://localhost:9181');
}

// Run the test
testBrowserService();
EOF
```

---

### Step 13: Run the Test

```bash
# Install tsx if not already installed
npm install -g tsx

# Run the test
npx tsx test-browser-service.ts
```

**Expected output:**
```
🧪 Testing Browser Service...

1️⃣  Testing health endpoint...
✅ Health check passed: healthy

2️⃣  Submitting test job...
✅ Job submitted! Job ID: abc-123-def

3️⃣  Checking job status...
   Status: queued (attempt 1/30)
   Status: started (attempt 2/30)
   Status: completed (attempt 5/30)
✅ Job completed successfully!
```

---

### Step 14: Monitor in RQ Dashboard

While the test runs:
1. Open http://localhost:9181
2. Watch the job appear in the queue
3. See it move from "Queued" → "Started" → "Finished"
4. Click on job to see details

---

### Step 15: Check Worker Logs

```bash
# In another terminal
docker-compose logs -f worker
```

You should see:
- Job received
- Browser launching
- Form filling steps
- Job completed

---

## ✅ PHASE 2 CHECKPOINT

Before moving to Phase 3, verify:
- [ ] Test script completes without errors
- [ ] Job shows in RQ Dashboard
- [ ] Worker logs show processing
- [ ] Job status changes from queued → completed
- [ ] No errors in logs

**If all green, continue to Phase 3!**

---

## 📍 PHASE 3: PRE-AWS PREPARATION (15 minutes)

### Step 16: Install AWS CLI

```bash
# Check if AWS CLI is installed
aws --version
```

**If not installed:**
```bash
# macOS
brew install awscli

# Verify installation
aws --version
```

**Expected:** aws-cli/2.x or higher

---

### Step 17: Configure AWS Credentials

```bash
# Configure AWS
aws configure
```

**You'll need:**
- AWS Access Key ID: (from AWS Console → IAM)
- AWS Secret Access Key: (from AWS Console → IAM)
- Default region: `us-east-1` (recommended for lowest cost)
- Default output format: `json`

**Where to get credentials:**
1. Go to AWS Console
2. Click your name (top right) → Security credentials
3. Create access key → CLI
4. Copy Access Key ID and Secret

---

### Step 18: Verify AWS Access

```bash
# Test AWS connection
aws sts get-caller-identity
```

**Expected output:**
```json
{
  "UserId": "AIDAI...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::..."
}
```

---

### Step 19: Check Infrastructure Files

```bash
# Navigate to infrastructure directory
cd infrastructure

# List files
ls -la
```

**Expected files:**
- `cloudformation-template.yml`
- `ecs-task-definition.json`
- `deploy.sh`

---

### Step 20: Make Deploy Script Executable

```bash
chmod +x deploy.sh
```

---

## ✅ PHASE 3 CHECKPOINT

Before moving to Phase 4, verify:
- [ ] AWS CLI installed and version 2.x+
- [ ] AWS credentials configured
- [ ] `aws sts get-caller-identity` returns your account info
- [ ] Infrastructure files exist
- [ ] deploy.sh is executable

**If all green, continue to Phase 4!**

---

## 📍 PHASE 4: AWS DEPLOYMENT (45 minutes)

### Step 21: Review What Will Be Created

The deployment will create:
- **VPC** with public/private subnets
- **ECS Cluster** for containers
- **ElastiCache Redis** for job queue
- **Application Load Balancer** for traffic
- **Auto-scaling** for browser service and workers
- **CloudWatch** for logs and monitoring

**Estimated cost:** $300-400/month (can optimize later)

---

### Step 22: Set Environment Variables for Deploy

```bash
# Still in infrastructure directory
export STACK_NAME="resumemax-browser-service"
export AWS_REGION="us-east-1"
export OPENAI_API_KEY="sk-proj-YOUR_OPENAI_API_KEY_HERE"
```

Generate secure API key:
```bash
export API_KEY=$(openssl rand -base64 32)
echo "Your production API key: $API_KEY"
# ⚠️ SAVE THIS KEY! You'll need it for Vercel
```

---

### Step 23: Start Deployment

```bash
# Run the deployment script
./deploy.sh
```

**This will take 15-20 minutes.** You'll see:
1. Creating ECR repository
2. Building Docker image
3. Pushing to ECR
4. Creating CloudFormation stack
5. Waiting for resources...

**Go grab coffee! ☕**

---

### Step 24: Monitor Deployment Progress

In another terminal:
```bash
# Watch CloudFormation stack creation
aws cloudformation describe-stacks \
  --stack-name resumemax-browser-service \
  --query 'Stacks[0].StackStatus' \
  --output text
```

**Status progression:**
- `CREATE_IN_PROGRESS` → Creating resources
- `CREATE_COMPLETE` → Done! ✅

**If fails:**
```bash
# Check what failed
aws cloudformation describe-stack-events \
  --stack-name resumemax-browser-service \
  --max-items 20
```

---

### Step 25: Get Load Balancer URL

```bash
# Once deployment completes
aws cloudformation describe-stacks \
  --stack-name resumemax-browser-service \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' \
  --output text
```

**Expected output:**
```
http://resumemax-alb-1234567890.us-east-1.elb.amazonaws.com
```

**⚠️ SAVE THIS URL!** You'll need it for Vercel.

---

### Step 26: Test AWS Health Endpoint

```bash
# Replace with your actual ALB URL
ALB_URL="http://your-alb-url-here.elb.amazonaws.com"
curl $ALB_URL/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "browser-automation"
}
```

**If timeout or 503:**
- Wait 2-3 more minutes for tasks to start
- Check ECS service is running: AWS Console → ECS → Clusters → resumemax-browser-service

---

## ✅ PHASE 4 CHECKPOINT

Before moving to Phase 5, verify:
- [ ] CloudFormation stack status: `CREATE_COMPLETE`
- [ ] Load Balancer URL obtained
- [ ] Health endpoint returns 200 OK
- [ ] ECS tasks are running (check AWS Console)

**If all green, continue to Phase 5!**

---

## 📍 PHASE 5: PRODUCTION TESTING (20 minutes)

### Step 27: Update Vercel Environment Variables

```bash
# Go back to project root
cd /Users/oduduabasivictor/Desktop/Desktop\ -\ Oduduabasi\'s\ Laptop/Desktop/ResumeMax/resume-scorecard

# Add production environment variables
vercel env add BROWSER_SERVICE_URL production
# Paste your ALB URL when prompted

vercel env add BROWSER_SERVICE_API_KEY production
# Paste your API key from Step 22
```

**Or manually:**
1. Go to Vercel Dashboard
2. Your project → Settings → Environment Variables
3. Add:
   - `BROWSER_SERVICE_URL` = `http://your-alb-url.elb.amazonaws.com`
   - `BROWSER_SERVICE_API_KEY` = `your-api-key-from-step-22`
4. Check "Production" environment

---

### Step 28: Deploy to Vercel

```bash
# Trigger production deployment
vercel --prod
```

**Wait for deployment** (2-3 minutes)

---

### Step 29: Test Production Endpoint

Create a test script for production:

```bash
cat > test-production.ts << 'EOF'
async function testProduction() {
  console.log('🌐 Testing Production Browser Service...\n');

  // Use your actual production URL
  const PROD_URL = 'https://your-app.vercel.app';
  const API_KEY = 'your-production-api-key-here';

  try {
    const response = await fetch(`${PROD_URL}/api/browser-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://boards.greenhouse.io/embed/job_app?token=test',
        userId: 'test-user-id',
        jobId: 'test-job-id'
      })
    });

    const data = await response.json();
    console.log('Response:', data);

    if (data.jobId) {
      console.log('✅ Production test successful!');
      console.log('📊 Monitor job at: http://your-alb-url.elb.amazonaws.com/job-status/' + data.jobId);
    }
  } catch (error) {
    console.log('❌ Production test failed:', error);
  }
}

testProduction();
EOF
```

**Update the URLs in the script** and run:
```bash
npx tsx test-production.ts
```

---

### Step 30: Monitor Production Jobs

**AWS CloudWatch:**
```bash
# View browser service logs
aws logs tail /ecs/browser-service --follow

# View worker logs
aws logs tail /ecs/browser-worker --follow
```

**Or use AWS Console:**
1. CloudWatch → Log groups
2. Find `/ecs/browser-service` and `/ecs/browser-worker`
3. View real-time logs

---

### Step 31: Check Auto-Scaling

```bash
# Check how many tasks are running
aws ecs describe-services \
  --cluster resumemax-browser-service \
  --services browser-service worker-service \
  --query 'services[*].[serviceName,runningCount,desiredCount]' \
  --output table
```

**Expected:**
```
|--------------------------|
| browser-service | 2 | 2 |
| worker-service  | 3 | 3 |
|--------------------------|
```

---

### Step 32: Load Test (Optional)

Submit multiple jobs to test auto-scaling:

```bash
# Submit 20 jobs quickly
for i in {1..20}; do
  curl -X POST http://your-alb-url.elb.amazonaws.com/submit-job \
    -H "Content-Type: application/json" \
    -H "X-API-Key: your-api-key" \
    -d '{"url":"https://test.com","userProfile":{"firstName":"Test"}}'
  echo "Job $i submitted"
  sleep 0.5
done
```

**Watch auto-scaling:**
- Workers should scale from 3 → up to 20
- Check in AWS Console → ECS → Services → worker-service

---

## ✅ FINAL CHECKPOINT

Congratulations! 🎉 Verify everything:

### Local Testing:
- [ ] Docker containers running
- [ ] Health endpoint responding
- [ ] Jobs processing successfully
- [ ] RQ Dashboard working

### AWS Production:
- [ ] CloudFormation stack deployed
- [ ] Load Balancer healthy
- [ ] ECS tasks running
- [ ] CloudWatch logs visible
- [ ] Jobs processing in production

### Integration:
- [ ] Vercel environment variables set
- [ ] Production deployment successful
- [ ] End-to-end test from app works
- [ ] Auto-scaling tested

---

## 🔧 TROUBLESHOOTING

### Problem: Docker build fails
```bash
# Solution
docker system prune -a
cd browser-service
docker-compose build --no-cache
```

### Problem: Container won't start
```bash
# Check logs
docker-compose logs browser-service
docker-compose logs worker

# Common fix: restart
docker-compose down
docker-compose up -d
```

### Problem: AWS deployment fails
```bash
# Check events
aws cloudformation describe-stack-events \
  --stack-name resumemax-browser-service \
  --max-items 50

# Delete and retry
aws cloudformation delete-stack --stack-name resumemax-browser-service
# Wait 10 minutes, then re-run deploy.sh
```

### Problem: Jobs stuck in queue
```bash
# Check worker logs
aws logs tail /ecs/browser-worker --follow

# Restart workers
aws ecs update-service \
  --cluster resumemax-browser-service \
  --service worker-service \
  --force-new-deployment
```

### Problem: Load balancer 503 errors
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# Usually means tasks aren't healthy - wait or restart
```

---

## 📊 MONITORING CHECKLIST

Daily monitoring tasks:

### Check Queue Health:
```bash
# Local: http://localhost:9181
# AWS: Check CloudWatch metrics
```

### Check Costs:
```bash
# View costs
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics UnblendedCost
```

### Check Errors:
```bash
# CloudWatch logs
aws logs filter-log-events \
  --log-group-name /ecs/browser-service \
  --filter-pattern "ERROR" \
  --max-items 20
```

---

## 🎯 SUCCESS METRICS

Your system is working if:

1. **Latency:** Jobs complete in < 60 seconds
2. **Success Rate:** > 90% of jobs succeed
3. **Availability:** Health checks return 200
4. **Scaling:** Workers auto-scale based on queue depth
5. **Costs:** Stay within $400/month budget

---

## 📚 NEXT STEPS

Now that everything works:

1. **Optimize Costs:**
   - Use Fargate Spot for workers (70% cheaper)
   - Schedule scale-down during off-hours
   - Right-size task resources

2. **Enhance Monitoring:**
   - Set up CloudWatch alarms
   - Configure Sentry for error tracking
   - Create custom dashboard

3. **Improve Reliability:**
   - Add retry logic in application
   - Implement circuit breakers
   - Set up multi-region failover

4. **Performance Tuning:**
   - Adjust worker count based on usage
   - Optimize browser automation
   - Cache common form patterns

---

## 🆘 GET HELP

If you get stuck:

1. Check logs: `docker-compose logs` or CloudWatch
2. Review troubleshooting section above
3. Check RQ Dashboard for job status
4. Verify environment variables are set correctly

---

**You're all set! Happy automating! 🚀**
