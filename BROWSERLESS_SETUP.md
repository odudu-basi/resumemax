# Browserless.io Integration Guide 🚀

This document explains how to integrate Browserless.io with your ResumeMax application for scalable browser automation.

## Table of Contents
- [What is Browserless.io?](#what-is-browserlessio)
- [Why Use It?](#why-use-it)
- [Setup Instructions](#setup-instructions)
- [Pricing & Plans](#pricing--plans)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## What is Browserless.io?

Browserless.io is a managed browser automation service that runs Playwright/Puppeteer browsers in the cloud. Instead of managing your own browser infrastructure, you connect to their browsers via WebSocket.

**Think of it as:** "AWS for browsers"

---

## Why Use It?

### ❌ Without Browserless (Current Setup)
```
User clicks "Auto Apply"
    ↓
Vercel tries to run Playwright
    ↓
❌ FAILS - Vercel serverless doesn't support browsers!
```

### ✅ With Browserless
```
User clicks "Auto Apply"
    ↓
Your API connects to Browserless.io
    ↓
Browser runs on Browserless servers
    ↓
✅ SUCCESS - Application submitted!
```

### Benefits:
- ✅ **No infrastructure management** - Browserless handles all browser instances
- ✅ **Works on Vercel** - Serverless-compatible
- ✅ **Auto-scaling** - Handles 1-100 concurrent users automatically
- ✅ **Fast setup** - Just add API key
- ✅ **Built-in proxies** - Avoid IP bans
- ✅ **Better reliability** - Professionally managed

---

## Setup Instructions

### Step 1: Sign Up for Browserless.io

1. Go to [browserless.io](https://www.browserless.io)
2. Click **"Sign Up"**
3. Choose a plan (see pricing below)
4. Copy your API key from the dashboard

### Step 2: Add API Key to Environment Variables

Add these to your `.env.local` file:

```bash
# Browserless.io Configuration
BROWSERLESS_API_KEY=your_api_key_here
BROWSERLESS_ENDPOINT=wss://production-sfo.browserless.io
```

### Step 3: Deploy to Vercel

Add the environment variables to Vercel:

```bash
# Via Vercel CLI
vercel env add BROWSERLESS_API_KEY
vercel env add BROWSERLESS_ENDPOINT

# Or via Vercel Dashboard:
# Settings → Environment Variables → Add
```

### Step 4: Test It!

```typescript
// Your code automatically uses Browserless in production!
// No changes needed - it's already integrated
```

---

## Pricing & Plans

### What is a "Unit"?
- **1 Unit** = 30 seconds of browser time
- Average job application = 2-3 minutes = **4-6 units**

### Pricing Tiers

| Plan | Price | Units/Month | Concurrent Browsers | Best For |
|------|-------|-------------|---------------------|----------|
| **Free** | $0 | 1,000 | 1 | Testing (≈200 applications) |
| **Prototyping** | $25 | 20,000 | 3 | Early launch (≈4,000 apps) |
| **Starter** | $140 | 180,000 | 20 | Growth (≈36,000 apps) |
| **Scale** | $350 | 500,000 | 50 | Scale (≈100,000 apps) |
| **Enterprise** | Custom | Custom | 100+ | Large scale |

### Cost Calculator for Your App

**Assumptions:**
- Average application = 2.5 minutes = 5 units
- 1,000 users × 10 applications = 10,000 applications/month

**Required units:** 10,000 apps × 5 units = **50,000 units/month**

**Recommended plan:** **Prototyping ($25/month)**
- Covers 20,000 units base + 30,000 overage
- Overage cost: 30,000 × $0.002 = $60
- **Total: ~$85/month for 1,000 users**

---

## Usage Examples

### Example 1: Auto-Apply (Already Integrated!)

```typescript
// app/api/intelligent-apply/route.ts
import { launchBrowser } from '@/src/lib/browserless';

export async function POST(request: NextRequest) {
  // This automatically uses Browserless.io in production!
  const browser = await launchBrowser();

  const page = await browser.newPage();
  await page.goto(jobUrl);

  // Fill application...

  await browser.close();
}
```

### Example 2: Manual Usage

```typescript
import { connectToBrowserless, createBrowserlessPage } from '@/src/lib/browserless';

// Connect to Browserless
const browser = await connectToBrowserless();

// Create page with recommended settings
const page = await createBrowserlessPage(browser);

// Use it like normal Playwright
await page.goto('https://example.com');
const title = await page.title();

await browser.close();
```

### Example 3: Wrapper Function (Recommended)

```typescript
import { withBrowserless } from '@/src/lib/browserless';

// Automatic cleanup!
const result = await withBrowserless(async (page) => {
  await page.goto('https://example.com');
  await page.screenshot({ path: 'screenshot.png' });
  return await page.title();
});

console.log(result); // Page title
// Browser automatically closed!
```

---

## How It Works

### Architecture Flow

```
┌─────────────────────────────────────────────────┐
│  USER                                           │
│  Clicks "Auto Apply" on your website          │
└────────────────┬────────────────────────────────┘
                 │
                 ↓ HTTP Request
┌─────────────────────────────────────────────────┐
│  VERCEL (Your API)                             │
│  - Receives request                            │
│  - Validates data                              │
│  - Calls launchBrowser()                       │
└────────────────┬────────────────────────────────┘
                 │
                 ↓ WebSocket Connection
┌─────────────────────────────────────────────────┐
│  BROWSERLESS.IO (Their Servers)                │
│  - Launches Chrome browser                     │
│  - Navigates to job site                       │
│  - Fills application form                      │
│  - Takes screenshots                           │
│  - Submits application                         │
└────────────────┬────────────────────────────────┘
                 │
                 ↓ Results
┌─────────────────────────────────────────────────┐
│  YOUR API                                       │
│  - Receives success/failure                    │
│  - Saves to database                           │
│  - Returns to user                             │
└─────────────────────────────────────────────────┘
```

### Local vs Production

| Environment | Behavior |
|-------------|----------|
| **Local Development** | Uses your local Chrome (normal Playwright) |
| **Production (Vercel)** | Uses Browserless.io (if API key is set) |

This is controlled automatically by the `launchBrowser()` function!

---

## Troubleshooting

### Issue 1: "Browserless API key not found"

**Solution:**
```bash
# Check if environment variable is set
echo $BROWSERLESS_API_KEY

# If empty, add it to .env.local
echo "BROWSERLESS_API_KEY=your_key_here" >> .env.local
```

### Issue 2: "Connection timeout"

**Possible causes:**
- Wrong API key
- Exceeded plan limits (too many concurrent browsers)
- Browserless.io is down (check status.browserless.io)

**Solution:**
```typescript
// Increase timeout
const browser = await connectToBrowserless({
  timeout: 60000 // 60 seconds
});
```

### Issue 3: "Still using local browser in production"

**Check:**
1. Is `BROWSERLESS_API_KEY` set in Vercel environment variables?
2. Is `NODE_ENV` set to `"production"`?

**Debug:**
```typescript
// Add this to see which browser is being used
console.log('Using Browserless?', shouldUseBrowserless());
```

### Issue 4: "Running out of units too fast"

**Optimize usage:**
- Close browsers promptly (use `withBrowserless()` wrapper)
- Don't keep browsers idle
- Set shorter timeouts
- Use API-based submissions when possible (Greenhouse, Lever, etc.)

---

## Best Practices

### 1. Always Close Browsers

```typescript
// ❌ BAD - Browser stays open, wastes units
const browser = await launchBrowser();
const page = await browser.newPage();
// ... forgot to close!

// ✅ GOOD - Guaranteed cleanup
await withBrowserless(async (page) => {
  // Do work...
}); // Automatically closes
```

### 2. Use API Submissions When Possible

```typescript
// ✅ BEST - No browser needed (free & instant!)
if (isGreenhouseJob(url)) {
  return await submitViaGreenhouseAPI(data);
}

// Only use browser for unknown platforms
return await withBrowserless(async (page) => {
  // Fill custom form...
});
```

### 3. Set Appropriate Timeouts

```typescript
// For long applications (10+ minutes)
const browser = await connectToBrowserless({
  timeout: 600000 // 10 minutes
});
```

### 4. Handle Errors Gracefully

```typescript
try {
  await withBrowserless(async (page) => {
    await page.goto(url, { timeout: 30000 });
    // ...
  });
} catch (error) {
  if (error.message.includes('timeout')) {
    // Retry with longer timeout
  } else if (error.message.includes('Browserless')) {
    // Fallback to queue or notify user
  }
}
```

---

## Monitoring & Analytics

### Check Usage in Browserless Dashboard

1. Log in to [browserless.io](https://www.browserless.io)
2. Go to **Dashboard**
3. See:
   - Units used this month
   - Concurrent browsers
   - Success/failure rates
   - Average session duration

### Add Logging to Your Code

```typescript
// Track Browserless usage
console.log('📊 Browserless Stats:', {
  unitsUsed: '...', // From dashboard
  applicationsToday: count,
  successRate: (successes / total) * 100
});
```

---

## Migration Guide

### Current Setup (Local Playwright)
```typescript
// Old code
const browser = await chromium.launch({ headless: true });
```

### New Setup (Browserless)
```typescript
// New code - automatically uses Browserless in production!
const browser = await launchBrowser();
```

**That's it!** The integration is complete. Your code now works everywhere:
- ✅ Local development (uses your Chrome)
- ✅ Vercel production (uses Browserless.io)

---

## FAQ

### Q: Do I need Browserless for local development?
**A:** No! It automatically uses your local Chrome in development.

### Q: What happens if I exceed my plan limits?
**A:** Free plan rejects new requests. Paid plans charge overage fees ($0.002/unit).

### Q: Can I use my own servers instead?
**A:** Yes! See `SELF_HOSTED_WORKER_GUIDE.md` for setting up your own browser infrastructure.

### Q: How do I switch back to local Playwright?
**A:** Just remove `BROWSERLESS_API_KEY` from your environment variables.

### Q: Does Browserless support headful browsers?
**A:** Yes, but you can't see them (they run on their servers). Use screenshots/videos to debug.

---

## Next Steps

1. **Sign up** for Browserless.io
2. **Add API key** to `.env.local`
3. **Test locally** to make sure it works
4. **Deploy to Vercel** with environment variables
5. **Monitor usage** in Browserless dashboard
6. **Scale** as needed (upgrade plan when you hit limits)

---

## Support

- **Browserless Docs:** https://docs.browserless.io
- **Browserless Support:** support@browserless.io
- **Status Page:** https://status.browserless.io

---

**You're all set!** 🎉 Your application now automatically uses Browserless.io in production for scalable browser automation.
