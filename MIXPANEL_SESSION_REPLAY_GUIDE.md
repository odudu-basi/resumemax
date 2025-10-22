# 🎥 **Mixpanel Session Replay Setup Guide**

Session Replay is now enabled in your ResumeMax app! This allows you to watch recordings of user sessions to understand user behavior, identify issues, and improve UX.

## ✅ **What's Been Set Up**

### **1. Session Replay Configuration**
- ✅ **100% Recording Rate** - All sessions are recorded
- ✅ **30-minute max recordings** - Prevents overly long sessions
- ✅ **30-second idle timeout** - Stops recording during inactivity
- ✅ **Automatic privacy protection** for passwords and sensitive elements

### **2. Privacy Protection**
- ✅ **Password inputs** automatically blocked
- ✅ **CSS classes** for masking/blocking elements
- ✅ **Development indicators** to see what's protected

### **3. Debug Controls** (Development Mode Only)
- ✅ **Start/Stop recording** manually
- ✅ **Get session replay URLs** instantly
- ✅ **Copy/Open replay links** directly

## 🔒 **Privacy & GDPR Compliance**

### **Automatically Protected:**
- Password fields (`input[type="password"]`)
- Elements with privacy classes

### **Manual Privacy Classes:**

#### **Mask Text Content** (shows as ****)
```html
<!-- These will show masked text in replays -->
<input className="mp-mask" placeholder="Credit Card Number" />
<span data-mp-mask>{user.email}</span>
<div className="mp-mask">{personalInfo}</div>
```

#### **Block Element Completely** (not recorded at all)
```html
<!-- These won't appear in replays -->
<div className="mp-no-record">
  <img src="/user-photo.jpg" alt="Profile" />
</div>
<section data-mp-no-record>
  {sensitiveUserData}
</section>
```

### **Programmatic Control:**
```javascript
import MixpanelService from '@/src/lib/mixpanel';

// Mask an element by ID
MixpanelService.maskElement('credit-card-input');

// Block an element by ID  
MixpanelService.blockElement('user-photo-section');

// Manual recording control
MixpanelService.startRecording();
MixpanelService.stopRecording();
```

## 📊 **How to View Session Replays**

### **In Mixpanel Dashboard:**
1. **Go to Mixpanel** → Your Project
2. **Navigate to "Session Replay"** in left sidebar
3. **Browse recordings** by date/user/events
4. **Filter by events** to find specific user journeys

### **In Development Mode:**
1. **Visit any analysis page** with development mode
2. **Use the Session Replay Debug panel**
3. **Start/stop recordings** manually
4. **Copy replay URLs** to share with team

## 🎯 **Best Practices**

### **What to Record:**
- ✅ User navigation patterns
- ✅ Form interactions (non-sensitive)
- ✅ Feature usage flows
- ✅ Error scenarios
- ✅ Conversion funnels

### **What to Protect:**
- 🔒 Personal information (names, emails, phone numbers)
- 🔒 Payment information
- 🔒 Resume content (consider masking)
- 🔒 Any sensitive user data

### **Recommended Privacy Setup:**

```javascript
// In your forms, protect sensitive data
<form>
  {/* This will be masked in replays */}
  <input 
    type="email" 
    className="mp-mask" 
    placeholder="Email address" 
  />
  
  {/* This is automatically protected */}
  <input 
    type="password" 
    placeholder="Password" 
  />
  
  {/* Resume content should be masked */}
  <textarea 
    className="mp-mask"
    placeholder="Resume content"
  />
</form>
```

## 🚀 **Getting Started**

### **Step 1: Deploy the Changes**
The session replay is already configured and ready to go!

### **Step 2: Add Privacy Classes**
Go through your app and add `mp-mask` or `mp-no-record` to sensitive elements:
- User names/emails
- Resume content  
- Payment forms
- Any personal data

### **Step 3: Test in Development**
1. Visit `/analysis/[id]` page
2. Use the Session Replay Debug panel
3. Start a recording
4. Navigate around your app
5. Check the replay URL

### **Step 4: Monitor in Production**
- Check Mixpanel dashboard for recordings
- Look for user behavior patterns
- Identify UX issues and bugs
- Track conversion funnel problems

## 📋 **Mixpanel Requirements**

**Note:** Session Replay requires a **paid Mixpanel plan**. If you're on the free plan, you'll need to upgrade to see the recordings.

**Plans with Session Replay:**
- Growth Plan ($25/month)
- Enterprise Plan (Custom pricing)

## 🔧 **Configuration Options**

You can adjust these settings in `/src/lib/mixpanel.ts`:

```javascript
record_sessions_percent: 100, // Reduce to 50 or 25 to save costs
record_max_ms: 30 * 60 * 1000, // Max recording length
record_idle_timeout_ms: 30000, // Idle timeout
```

## 🎉 **You're All Set!**

Session Replay is now tracking user sessions. You'll be able to:
- 👀 **Watch real user sessions**
- 🐛 **Debug UX issues visually**  
- 📈 **Optimize conversion funnels**
- 🎯 **Understand user behavior patterns**

**Happy analyzing! 🚀**
