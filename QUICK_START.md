# Universal Form Filler - Quick Start Guide

Get up and running in 5 minutes!

## ⚡ Quick Setup

### 1. Install Dependencies
```bash
# Already installed in your project:
# - openai
# - playwright
# - zod
```

### 2. Set API Key
```bash
# Add to your .env.local file
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Test the API

Create a test file `test-form-filler.ts`:

```typescript
async function testFormFiller() {
  const response = await fetch('http://localhost:3000/api/universal-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://company.greenhouse.io/jobs/12345',  // Replace with actual URL
      userProfile: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1-234-567-8900',
        resume: {
          fileName: 'resume.pdf',
          fileBase64: 'JVBERi0xLjQK...',  // Your base64 PDF
          mimeType: 'application/pdf'
        }
      }
    })
  });

  const result = await response.json();
  console.log('Result:', result);
}

testFormFiller();
```

### 4. Run Test
```bash
npm run dev
node test-form-filler.ts
```

## 📋 Basic Usage Template

```typescript
const response = await fetch('/api/universal-apply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // ✅ REQUIRED: The URL of the application form
    url: 'https://company.com/apply',

    // ✅ REQUIRED: User profile data
    userProfile: {
      // Minimum required fields
      firstName: 'YOUR_FIRST_NAME',
      lastName: 'YOUR_LAST_NAME',
      email: 'YOUR_EMAIL',
      phone: 'YOUR_PHONE',

      // Resume (highly recommended)
      resume: {
        fileName: 'resume.pdf',
        fileBase64: 'BASE64_ENCODED_PDF',
        mimeType: 'application/pdf'
      },

      // Optional but recommended
      location: {
        city: 'YOUR_CITY',
        state: 'YOUR_STATE',
        country: 'YOUR_COUNTRY'
      },

      // Add more fields as needed (see documentation)
    },

    // ⚙️ OPTIONAL: Configuration
    options: {
      submitForm: true,        // Auto-submit? (default: true)
      handleMultiStep: true,   // Navigate multi-step forms? (default: true)
      recordVideo: true        // Record session? (default: true)
    }
  })
});

const result = await response.json();

if (result.success) {
  console.log('✅ Success!');
  console.log(`Fields filled: ${result.fieldsFilled}/${result.fieldsAttempted}`);
} else {
  console.log('❌ Failed');
  console.log('Errors:', result.errors);
}
```

## 🎯 Common Use Cases

### Use Case 1: Single Job Application
```typescript
const result = await fetch('/api/universal-apply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://company.com/jobs/apply/123',
    userProfile: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+1-555-1234',
      resume: { fileName: 'resume.pdf', fileBase64: '...' }
    }
  })
});
```

### Use Case 2: Apply to Multiple Companies
```typescript
const companies = [
  'https://company1.com/apply',
  'https://company2.com/apply',
  'https://company3.com/apply'
];

const results = await Promise.all(
  companies.map(url =>
    fetch('/api/universal-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        userProfile: { /* your profile */ }
      })
    })
  )
);
```

### Use Case 3: Test Form Filling (No Submit)
```typescript
const result = await fetch('/api/universal-apply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://company.com/apply',
    userProfile: { /* your profile */ },
    options: {
      submitForm: false,  // Don't submit - just fill
      recordVideo: true   // Record for review
    }
  })
});

// Watch the video to verify it filled correctly
console.log('Video:', result.videoPath);
```

## 🔍 Understanding Results

### Success Response
```json
{
  "success": true,
  "message": "Form filled and submitted successfully!",
  "fieldsFilled": 15,
  "fieldsAttempted": 17,
  "successRate": 88,
  "fieldResults": [
    { "fieldLabel": "First Name", "success": true, "value": "John" },
    { "fieldLabel": "Email", "success": true, "value": "john@example.com" }
  ],
  "videoPath": "/recordings/universal-apply-1234567890.webm",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Failure Response
```json
{
  "success": false,
  "message": "Form filling completed with errors",
  "fieldsFilled": 10,
  "fieldsAttempted": 15,
  "successRate": 67,
  "errors": [
    "Failed to fill field: Cover Letter",
    "Field not found: LinkedIn URL"
  ],
  "fieldResults": [
    { "fieldLabel": "First Name", "success": true },
    { "fieldLabel": "Cover Letter", "success": false, "reason": "No matching user data" }
  ],
  "screenshotPath": "error-1234567890.png"
}
```

## 📝 Converting Resume to Base64

### Node.js
```typescript
import fs from 'fs';

const resumeBuffer = fs.readFileSync('path/to/resume.pdf');
const resumeBase64 = resumeBuffer.toString('base64');

// Use in API call
userProfile.resume = {
  fileName: 'resume.pdf',
  fileBase64: resumeBase64,
  mimeType: 'application/pdf'
};
```

### Browser (React/Next.js)
```typescript
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result?.toString().split(',')[1]; // Remove data:... prefix
    setResumeBase64(base64);
  };
  reader.readAsDataURL(file);
};
```

## 🎨 User Profile Fields

### Minimum Required
```typescript
{
  firstName: string,
  lastName: string,
  email: string,
  phone: string
}
```

### Recommended (for best results)
```typescript
{
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  location: {
    city: string,
    state: string,
    country: string
  },
  resume: {
    fileName: string,
    fileBase64: string,
    mimeType: string
  },
  linkedinUrl?: string,
  coverLetter?: string
}
```

### Complete (all supported fields)
See `UNIVERSAL_FORM_FILLER_GUIDE.md` for the complete list of 100+ supported fields.

## ⚠️ Common Issues

### Issue 1: "OpenAI API key not configured"
**Solution:** Add `OPENAI_API_KEY=sk-...` to your `.env.local` file

### Issue 2: Low success rate (< 70%)
**Solution:**
- Add more user profile data
- Check `fieldResults` to see which fields failed
- Add missing data or use `customFields`

### Issue 3: Navigation timeout
**Solution:**
- Verify the URL is accessible
- Check your network connection
- Make sure the website doesn't require login

### Issue 4: CAPTCHA detected
**Solution:**
- CAPTCHAs require manual intervention
- The system will detect and report them
- Consider applying manually for these cases

## 📚 Next Steps

1. ✅ **Test on a real form** - Try with a simple application form
2. ✅ **Review the video** - Watch the recording to see how it works
3. ✅ **Check field results** - See which fields were filled successfully
4. ✅ **Add more data** - Fill in more user profile fields for better results
5. ✅ **Read full docs** - Check `UNIVERSAL_FORM_FILLER_GUIDE.md` for advanced features

## 🚀 Advanced Features

Once you're comfortable with basics:

- **Custom Fields** - Handle unique form questions
- **Multi-step Forms** - Automatically navigate through steps
- **Batch Processing** - Apply to multiple companies at once
- **Error Handling** - Retry logic and graceful degradation
- **Test Mode** - Fill without submitting

See `examples/universal-form-filler-example.ts` for code examples.

## 📞 Help

- **Documentation:** `UNIVERSAL_FORM_FILLER_GUIDE.md`
- **Examples:** `examples/universal-form-filler-example.ts`
- **Summary:** `FORM_FILLER_SUMMARY.md`
- **This Guide:** `QUICK_START.md`

## 🎯 Success Checklist

- [ ] OpenAI API key configured in `.env.local`
- [ ] Test URL selected
- [ ] User profile data prepared
- [ ] Resume converted to base64
- [ ] First test API call made
- [ ] Results reviewed
- [ ] Video recording watched
- [ ] Field results analyzed
- [ ] Ready for production use!

---

**That's it! You're ready to start filling forms automatically! 🎉**
