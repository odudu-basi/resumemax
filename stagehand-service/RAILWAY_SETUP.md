# Railway Setup Guide for Stagehand API

## Prerequisites
- Railway account (https://railway.app)
- GitHub repository pushed with stagehand-service code
- Browserbase API Key and Project ID

## Step-by-Step Setup

### 1. Push Code to GitHub
```bash
git add stagehand-service/
git commit -m "Add Stagehand API service"
git push origin main
```

### 2. Create New Service on Railway

1. Go to https://railway.app
2. Click your existing project (or create new one)
3. Click **"+ New"** → **"GitHub Repo"**
4. Select your repository
5. Railway will auto-detect the Dockerfile

### 3. Configure Service Settings

1. Click on the new service
2. Go to **Settings** tab
3. **Root Directory**: Set to `stagehand-service`
4. **Dockerfile Path**: Should auto-detect as `stagehand-service/Dockerfile`

### 4. Add Environment Variables

Click **Variables** tab and add:

```
BROWSERBASE_API_KEY=bb_live_Jw8AftG4GF-NJ3ZUBfhsx-anzWM
BROWSERBASE_PROJECT_ID=ee866307-c9c8-467a-8ea4-3c2c623abf7f
NODE_ENV=production
PORT=3001
```

### 5. Deploy

1. Railway will automatically deploy after adding variables
2. Wait for deployment to complete (check **Deployments** tab)
3. Once deployed, go to **Settings** → **Networking**
4. Click **Generate Domain** to get public URL
5. Copy the URL (e.g., `https://stagehand-service-production-xxxx.up.railway.app`)

### 6. Update Your Next.js App

1. Go to your main Next.js app on Vercel
2. Add environment variable:
   ```
   STAGEHAND_API_URL=https://your-stagehand-service.up.railway.app
   ```
3. Redeploy Vercel app

### 7. Test the Service

Test health endpoint:
```bash
curl https://your-stagehand-service.up.railway.app/health
```

Should return:
```json
{"status":"ok","service":"stagehand-api","timestamp":"2025-11-29T..."}
```

## Troubleshooting

### Service won't start
- Check **Logs** tab for errors
- Verify environment variables are set correctly
- Ensure root directory is `stagehand-service`

### "Cannot find module" errors
- Check that package.json is in stagehand-service/ folder
- Verify Dockerfile COPY commands are correct

### Browserbase connection fails
- Verify API key and Project ID are correct
- Check Railway logs for Stagehand initialization errors

## Cost Estimate

Railway Pricing:
- Hobby Plan: $5/month (includes $5 credits)
- This service + your existing worker should fit in free credits
- Estimated usage: ~$2-3/month for light usage

## Monitoring

Check service health:
- Railway Dashboard → Your Service → Metrics
- View logs in real-time: Logs tab
- Set up alerts: Settings → Notifications

