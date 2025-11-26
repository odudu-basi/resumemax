# 🤖 **Captcha Handling Setup Guide**

## **Overview**
Your browser automation agent now includes captcha solving capabilities using 2captcha service. The API key is pre-configured and ready to use automatically.

## **🔧 Supported Captcha Types**

### **1. reCAPTCHA v2** ✅
- **"I'm not a robot" checkboxes**
- **Image selection grids** (traffic lights, crosswalks, etc.)
- **Invisible reCAPTCHA**

### **2. Image Captchas** ✅
- **Text-based image captchas**
- **Math problems in images**
- **Distorted text recognition**

### **3. Future Support** 🚧
- **reCAPTCHA v3** (coming soon)
- **hCaptcha** (coming soon)
- **FunCaptcha** (coming soon)

## **💰 Captcha Solving Service**

### **2captcha** ⭐ (Pre-configured)
- **Cost**: ~$0.50-2.00 per 1000 captchas
- **Speed**: 10-40 seconds average
- **Success Rate**: 95%+
- **Website**: https://2captcha.com
- **Status**: ✅ **API key already configured and ready to use**

## **🚀 Ready to Use**

### **✅ Pre-configured Setup**
Your 2captcha integration is already set up with API key: `c569a7db2c55491ff0b992a07748dbcf`

### **💰 Account Funding**
Make sure your 2captcha account has sufficient funds:
1. Visit https://2captcha.com
2. Log in to your account 
3. Add funds ($5-10 recommended for testing)
4. Monitor your balance regularly

### **🎯 No Additional Setup Required**
The captcha solver is ready to use automatically when the agent encounters captchas.

## **💡 How It Works**

### **🥷 Stealth-First Approach**
The system now uses a **two-layer strategy**:

#### **Layer 1: Captcha Avoidance (Primary)**
- **Cloud browser mode** for better stealth and fingerprint masking
- **Human-like behavior** with natural delays and mouse movements
- **Anti-detection measures** to avoid triggering captchas in the first place
- **Realistic browsing patterns** that mimic human users

#### **Layer 2: Captcha Solving (Fallback)**
If captchas still appear despite stealth measures:
- **Automatic detection** of captcha types
- **2captcha integration** for solving when needed
- **Intelligent retry logic** with human-like delays

### **Automatic Detection**
The agent automatically detects captchas by looking for:
- reCAPTCHA elements (`data-sitekey` attributes)
- Image captcha containers
- "I'm not a robot" text
- Captcha iframes

### **Solving Process**
1. **Detection**: Agent identifies captcha type and parameters
2. **Submission**: Sends captcha to solving service
3. **Waiting**: Polls service for solution (10-60 seconds)
4. **Application**: Enters solution into the form
5. **Verification**: Confirms captcha was accepted

### **Retry Strategy**
- Try 2captcha service up to 3 times
- If all attempts fail, mark application as failed with "CAPTCHA_UNSOLVED" error
- Clear logging shows captcha solving progress and any failures

## **📊 Cost Estimation**

### **Typical Job Application**
- **0-1 captchas per application** (most sites)
- **Cost per application**: $0.0005 - $0.002
- **Monthly cost (100 applications)**: $0.05 - $0.20

### **Heavy Captcha Sites**
- **2-3 captchas per application** (security-heavy sites)
- **Cost per application**: $0.001 - $0.006
- **Monthly cost (100 applications)**: $0.10 - $0.60

## **⚙️ Configuration Options**

### **Service Priority**
You can set which service to try first by configuring multiple API keys:

```python
# The agent will try services in this order:
1. 2captcha (if TWOCAPTCHA_API_KEY is set)
2. Anti-Captcha (if ANTICAPTCHA_API_KEY is set)
3. CapSolver (if CAPSOLVER_API_KEY is set)
```

### **Timeout Settings**
- **reCAPTCHA**: 5 minutes max (30 attempts × 10 seconds)
- **Image Captcha**: 3-4 minutes max (20 attempts × 10 seconds)

## **🔍 Troubleshooting**

### **Common Issues**

#### **"No API key configured"**
- **Solution**: Add the API key to your `.env.local` file
- **Check**: Restart the Python service after adding keys

#### **"Captcha timeout"**
- **Cause**: Solving service is overloaded
- **Solution**: Try a different service or wait and retry

#### **"Captcha solving failed"**
- **Cause**: Insufficient account balance or invalid API key
- **Solution**: Check your account balance and API key validity

#### **"CAPTCHA_UNSOLVED error"**
- **Cause**: All solving attempts failed
- **Solution**: Check logs for specific error, verify API keys

### **Debugging**
Enable detailed logging to see captcha solving progress:
```bash
# Check Python service logs
tail -f python-service/browser_agent.log
```

Look for these log messages:
- `🤖 Attempting to solve reCAPTCHA v2 using 2captcha`
- `✅ 2captcha captcha submitted, ID: 12345`
- `⏳ 2captcha still processing...`
- `✅ 2captcha solved successfully`

## **📈 Monitoring & Analytics**

### **Success Rates**
Monitor your captcha solving success rates:
- **95%+ success rate**: Excellent
- **90-95% success rate**: Good
- **<90% success rate**: Check service status or switch providers

### **Cost Tracking**
Most services provide detailed usage analytics:
- Daily/monthly captcha counts
- Success/failure rates
- Cost breakdowns by captcha type

## **🔐 Security Best Practices**

### **API Key Security**
- ✅ Store API keys in `.env.local` (not in code)
- ✅ Use different API keys for development/production
- ✅ Regularly rotate API keys
- ❌ Never commit API keys to version control

### **Rate Limiting**
- Services have rate limits (usually 100-1000 requests/minute)
- The agent automatically handles rate limiting with delays
- For high-volume usage, consider multiple API keys

## **🚀 Advanced Features**

### **Custom Captcha Types**
If you encounter unsupported captcha types, you can extend the `CaptchaSolver` class:

```python
async def solve_custom_captcha(self, captcha_data: dict) -> Optional[str]:
    # Add custom captcha solving logic here
    pass
```

### **Manual Intervention Mode**
For development/testing, you can disable automatic solving:

```bash
# Add to .env.local
CAPTCHA_MANUAL_MODE=true
```

This will pause the agent when captchas are detected, allowing manual solving.

## **📞 Support**

### **Service Support**
- **2captcha**: https://2captcha.com/support
- **Anti-Captcha**: https://anti-captcha.com/support  
- **CapSolver**: https://www.capsolver.com/support

### **Common Service Issues**
- **Account balance**: Check your account has sufficient funds
- **API limits**: Verify you haven't exceeded rate limits
- **Service status**: Check service status pages for outages

## **🎯 Best Practices**

### **Cost Optimization**
1. **Start with 2captcha** (best value)
2. **Monitor usage** regularly
3. **Set spending alerts** in service dashboards
4. **Use multiple services** for redundancy

### **Performance Optimization**
1. **Configure multiple API keys** for faster processing
2. **Monitor success rates** and switch services if needed
3. **Set appropriate timeouts** based on your needs

### **Reliability**
1. **Always have backup services** configured
2. **Monitor service status pages**
3. **Keep API keys updated** and funded
4. **Test regularly** with known captcha sites

---

## **✅ Quick Checklist**

- [ ] Signed up for captcha solving service
- [ ] Added API key to `.env.local`
- [ ] Added funds to account ($5-10 minimum)
- [ ] Restarted Python service
- [ ] Tested with a captcha-enabled job application
- [ ] Verified logs show successful captcha solving
- [ ] Set up monitoring/alerts for account balance

**You're now ready to handle captchas automatically! 🎉**
