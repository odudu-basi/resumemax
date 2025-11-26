# Option A Implementation Plan: Keep Browser Open for User Review

## Overview
After filling the form, keep the browser open (headless) for up to 30 minutes while user reviews.

## Architecture

### Current Flow (What we're changing FROM):
```
Fill form → Submit automatically → Close browser → Done
```

### New Flow (Option A):
```
Fill form → Save state → Notify user → Keep browser open (headless) →
User clicks notification → Make browser visible → User reviews → User submits manually
```

##Requirements

### 1. Stop Video Recording After 5 Minutes
- Currently: Video records until browser closes
- New: Stop recording after 5 minutes to save resources
- Browser stays open, just no more video

### 2. Keep Browser Open for 30 Minutes
- Browser stays in headless mode
- Page remains on filled form
- No auto-close until 30 min timeout OR user action

### 3. Notification System
- Send notification to user: "Form filled! Review and submit"
- Notification has action: "Review & Submit"
- Click notification → triggers browser to become visible

### 4. Make Browser Visible on Demand
- Start: headless=true
- User clicks notification → headless=false (show browser window)
- User can see filled form and click submit manually

### 5. 30-Minute Timeout
- If no action in 30 min → Auto-close browser
- Send second notification: "Form session expired, please try again"

---

## Technical Implementation

### Phase 1: Modify Route to Pause Instead of Submit

**File:** `app/api/intelligent-apply/route.ts`

**Changes:**
1. After form filling completes, DON'T call submit logic
2. Instead, return response with `status: 'awaiting_review'`
3. Keep `browser` and `context` objects ALIVE (don't close)

**Problem:** API routes can't keep connections open for 30 minutes
**Solution:** Need to move browser management out of API route

### Phase 2: Browser Session Management System

**New Architecture Needed:**

```
┌─────────────────────────────────────────┐
│  API Route (intelligent-apply)          │
│  - Fills form                           │
│  - Returns immediately                  │
│  - Hands off browser to Session Manager │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Browser Session Manager (New Service)  │
│  - Stores active browser instances      │
│  - Manages 30-min timeouts              │
│  - Handles video stop after 5 min       │
│  - Exposes endpoints for user actions   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  User Actions API (New Endpoints)       │
│  - POST /api/browser/make-visible       │
│  - POST /api/browser/close              │
│  - GET  /api/browser/status             │
└─────────────────────────────────────────┘
```

### Phase 3: File Structure

**New Files Needed:**

```
/src/lib/browser-session-manager.ts
  - Manages active browser sessions
  - Stores browser/context/page objects
  - Handles timeouts
  - Stops video recording after 5 min

/app/api/browser-session/route.ts
  - GET: Check session status
  - POST: Control session (make visible, close, etc.)

/src/lib/notification-service.ts
  - Send notifications to user
  - Handle notification clicks
```

---

## Detailed Implementation

### Step 1: Browser Session Manager

```typescript
// /src/lib/browser-session-manager.ts

import { Browser, BrowserContext, Page } from 'playwright';

interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  userId: string;
  jobUrl: string;
  createdAt: Date;
  videoStopTimeout?: NodeJS.Timeout;
  closeTimeout?: NodeJS.Timeout;
  status: 'filling' | 'awaiting_review' | 'reviewing' | 'closed';
}

class BrowserSessionManager {
  private sessions: Map<string, BrowserSession> = new Map();

  // Create new session
  async createSession(
    browser: Browser,
    context: BrowserContext,
    page: Page,
    userId: string,
    jobUrl: string
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const session: BrowserSession = {
      id: sessionId,
      browser,
      context,
      page,
      userId,
      jobUrl,
      createdAt: new Date(),
      status: 'awaiting_review'
    };

    // Set 5-min timeout to stop video
    session.videoStopTimeout = setTimeout(async () => {
      console.log(`📹 Stopping video for session ${sessionId}`);
      // Stop video recording
      await page.video()?.stop();
      console.log('✅ Video recording stopped after 5 minutes');
    }, 5 * 60 * 1000);

    // Set 30-min timeout to close browser
    session.closeTimeout = setTimeout(async () => {
      console.log(`⏰ Session ${sessionId} timed out after 30 minutes`);
      await this.closeSession(sessionId, 'timeout');
    }, 30 * 60 * 1000);

    this.sessions.set(sessionId, session);
    console.log(`✅ Created browser session: ${sessionId}`);

    return sessionId;
  }

  // Make browser visible (headless → headed)
  async makeVisible(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    console.log(`🖥️  Making browser visible for session ${sessionId}`);

    // Unfortunately, Playwright can't change headless mode on running browser
    // Workaround: The browser was started in headed mode but minimized
    // Or: Use VNC/remote desktop to show headless browser

    // For now: Log that we'd show it
    console.log('💡 Browser would become visible here (requires headed mode from start)');

    session.status = 'reviewing';
  }

  // Close session
  async closeSession(sessionId: string, reason: 'user' | 'timeout' | 'error'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Already closed
    }

    console.log(`🔒 Closing session ${sessionId} (reason: ${reason})`);

    // Clear timeouts
    if (session.videoStopTimeout) {
      clearTimeout(session.videoStopTimeout);
    }
    if (session.closeTimeout) {
      clearTimeout(session.closeTimeout);
    }

    // Close browser
    try {
      await session.browser.close();
      console.log('✅ Browser closed');
    } catch (error) {
      console.error('Error closing browser:', error);
    }

    // Remove from map
    this.sessions.delete(sessionId);

    // Send notification based on reason
    if (reason === 'timeout') {
      // TODO: Send timeout notification
      console.log('📬 Would send timeout notification');
    }
  }

  // Get session status
  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  // List all sessions for a user
  getUserSessions(userId: string): BrowserSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }
}

// Singleton instance
export const browserSessionManager = new BrowserSessionManager();
```

### Step 2: Modify intelligent-apply Route

```typescript
// In /app/api/intelligent-apply/route.ts

// After form filling completes:

// OLD CODE (remove):
// await submitButton.click();
// await browser.close();

// NEW CODE:
import { browserSessionManager } from '@/lib/browser-session-manager';

// Create session (keep browser open)
const sessionId = await browserSessionManager.createSession(
  browser,
  context,
  page,
  userId, // from application.userProfile
  application.url
);

// Send notification
await sendNotification(userId, {
  type: 'form_ready_for_review',
  title: 'Application Form Filled!',
  message: 'Review and submit your application',
  action: {
    label: 'Review & Submit',
    url: `/review-form?session=${sessionId}`
  }
});

// Return immediately (don't wait)
return NextResponse.json({
  success: true,
  status: 'awaiting_review',
  sessionId,
  message: 'Form filled. Please review and submit.',
  data: {
    ...results,
    screenshotPath,
    reviewUrl: `/review-form?session=${sessionId}`
  }
});

// Browser stays open in background!
```

### Step 3: Browser Control API

```typescript
// /app/api/browser-session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { browserSessionManager } from '@/lib/browser-session-manager';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const session = browserSessionManager.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: session.status,
    createdAt: session.createdAt,
    jobUrl: session.jobUrl
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, sessionId } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  switch (action) {
    case 'make_visible':
      await browserSessionManager.makeVisible(sessionId);
      return NextResponse.json({ success: true, message: 'Browser is now visible' });

    case 'close':
      await browserSessionManager.closeSession(sessionId, 'user');
      return NextResponse.json({ success: true, message: 'Session closed' });

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
```

### Step 4: Review Page

```typescript
// /app/review-form/page.tsx

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ReviewFormPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (sessionId) {
      // Make browser visible
      fetch('/api/browser-session', {
        method: 'POST',
        body: JSON.stringify({ action: 'make_visible', sessionId }),
        headers: { 'Content-Type': 'application/json' }
      });

      // Check status
      fetch(`/api/browser-session?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => setStatus(data.status));
    }
  }, [sessionId]);

  return (
    <div>
      <h1>Review Your Application</h1>
      <p>Session: {sessionId}</p>
      <p>Status: {status}</p>
      <p>The browser window should now be visible. Review the form and click Submit.</p>
      <button onClick={() => {
        fetch('/api/browser-session', {
          method: 'POST',
          body: JSON.stringify({ action: 'close', sessionId }),
          headers: { 'Content-Type': 'application/json' }
        });
      }}>
        Done / Close Browser
      </button>
    </div>
  );
}
```

---

## Challenges & Solutions

### Challenge 1: Can't Change headless Mode on Running Browser

**Problem:** Playwright can't change `headless: true` to `headless: false` after browser starts.

**Solutions:**
1. **Option A:** Start browser in headed mode but minimized
   - `headless: false`, but hide window initially
   - Show window when user clicks notification

2. **Option B:** Use remote desktop/VNC
   - Browser runs headless on server
   - Stream video to user's browser
   - User sees form in web interface

3. **Option C:** Just tell user to submit
   - Keep headless
   - User clicks "Submit" button in notification
   - API submits form for them

**Recommended:** Option C (simplest) or Option A

### Challenge 2: API Routes Have Timeout Limits

**Problem:** Vercel/Next.js API routes timeout after 10-60 seconds.

**Solution:**
- Hand off browser to long-running service
- Use singleton session manager
- API route returns immediately
- Session manager handles 30-min lifecycle

### Challenge 3: Server Resources

**Problem:** Keeping browsers open for 30min uses RAM.

**Solution:**
- Limit concurrent sessions per user (max 3)
- Close oldest session if limit exceeded
- Show resource usage in admin panel

---

## Implementation Priority

### Must Have (MVP):
1. ✅ Keep browser open after filling
2. ✅ Return session ID to client
3. ✅ 30-minute auto-close timeout
4. ✅ Stop video after 5 minutes
5. ✅ Basic notification to user

### Nice to Have (Later):
1. Make browser visible (headed mode)
2. Streaming video to user's browser
3. Multiple session management
4. Resource usage monitoring
5. Resume from timeout

---

## Timeline Estimate

- **Browser Session Manager:** 2-3 hours
- **API Route Modifications:** 1-2 hours
- **Control API:** 1 hour
- **Review Page:** 1 hour
- **Testing:** 2 hours

**Total:** 7-9 hours

---

This is a complete plan. Should we proceed with implementation?
