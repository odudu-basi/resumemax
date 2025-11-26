# Intelligent Auto-Apply System

An AI-powered job application automation system using Playwright and OpenAI GPT-4.

## Features

- 🤖 **AI-Powered Field Mapping**: Uses GPT-4 to intelligently understand and fill form fields
- 🎯 **Smart Locator Strategies**: Multiple fallback strategies for reliable field detection
- 🔄 **Robust Error Handling**: Comprehensive error recovery and logging
- 📊 **Detailed Reporting**: Complete summary of filled, skipped, and failed fields
- 🌐 **Headless Browser**: Full Playwright automation support
- 🛡️ **Privacy-Focused**: Optional fields (diversity, demographics) are handled respectfully

## Prerequisites

```bash
# Install dependencies
npm install playwright openai dotenv

# Install Playwright browsers
npx playwright install chromium
```

## Environment Variables

Create a `.env` file in your project root:

```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional
SUBMIT_AUTOMATICALLY=false  # Set to 'true' to auto-submit forms
```

## Usage

### Basic Usage

```javascript
const { autoApply } = require('./scripts/auto-apply-intelligent');

const userProfile = {
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane.smith@example.com',
  phone: '+1 (555) 987-6543',
  location: 'New York, NY',
  // ... more profile data
};

const jobUrl = 'https://jobs.lever.co/company/position';

autoApply(jobUrl, userProfile)
  .then(results => {
    console.log('Application completed:', results);
  })
  .catch(error => {
    console.error('Application failed:', error);
  });
```

### Command Line Usage

```bash
# Basic usage (uses example profile)
node scripts/auto-apply-intelligent.js "https://job-url.com/apply"

# Or just run with default URL
node scripts/auto-apply-intelligent.js
```

## User Profile Structure

The system expects a comprehensive user profile object:

```javascript
{
  // Basic Information
  first_name: string,
  last_name: string,
  email: string,
  phone: string,
  location: string,

  // Links
  linkedin: string (optional),
  website: string (optional),
  github: string (optional),
  portfolio: string (optional),

  // Work Authorization
  work_authorization: string,
  require_sponsorship: boolean,

  // Professional Info
  current_title: string,
  years_of_experience: number,

  // Education
  education: {
    degree: string,
    field: string,
    school: string,
    graduation_year: number
  },

  // Skills & Experience
  skills: string[],
  experience: [{
    company: string,
    title: string,
    duration: string,
    description: string
  }],

  // Documents
  resume_url: string (optional),
  cover_letter: string (optional),

  // Diversity (optional - all fields can be empty)
  diversity: {
    gender: string,
    ethnicity: string,
    veteran_status: string,
    disability_status: string
  }
}
```

## How It Works

### 1. DOM Extraction

The script scans the page for all form fields and extracts:
- Field type (input, textarea, select)
- ID, name, placeholder attributes
- Associated label text
- Required/optional status
- Available options (for select fields)

```javascript
const fields = await extractFormFields(page);
// Returns array of field metadata
```

### 2. AI Field Mapping

Sends extracted fields and user profile to GPT-4 with specific instructions:

```javascript
const mappings = await getAIFieldMapping(fields, userProfile);
// Returns array of {question, locatorStrategy, locatorValue, answer}
```

### 3. Intelligent Form Filling

For each field, the script:
1. Tries the AI-suggested locator strategy
2. Falls back through multiple strategies if needed:
   - `getByLabel()` - Preferred method
   - `getByPlaceholder()`
   - CSS selector by name
   - CSS selector by ID
   - XPath (last resort)
3. Fills the field with the AI-generated answer
4. Logs success/failure for each field

### 4. Form Submission

- Automatically detects submit buttons
- Can auto-submit or pause for review (based on ENV variable)
- Provides detailed summary of results

## GPT-4 Prompt Structure

The system uses a carefully crafted prompt that instructs GPT-4 to:

1. **Understand Field Intent**: Analyze labels, placeholders, and names to determine what's being asked
2. **Select Best Locator**: Choose the most reliable Playwright locator strategy
3. **Generate Appropriate Answers**: Match answers to field types and user profile
4. **Handle Special Cases**:
   - Email/phone formatting
   - Select dropdown matching
   - Textarea responses (2-4 sentences)
   - Optional vs required fields
   - Diversity questions (respectful handling)

### Output Format

GPT-4 returns structured JSON:

```json
[
  {
    "question": "What is your email address?",
    "locatorStrategy": "getByLabel",
    "locatorValue": "Email",
    "answer": "jane.smith@example.com",
    "fieldType": "input",
    "inputType": "email",
    "reasoning": "Using email from user profile"
  },
  {
    "question": "Tell us about your experience",
    "locatorStrategy": "getByLabel",
    "locatorValue": "Experience",
    "answer": "I have 5 years of experience as a Senior Software Engineer...",
    "fieldType": "textarea",
    "reasoning": "Generated from user's experience and current role"
  }
]
```

## Locator Strategy Priority

The system uses this fallback hierarchy:

1. **getByLabel()** ✅ Most reliable, Playwright's recommended approach
2. **getByPlaceholder()** - Good for fields without labels
3. **getByRole()** - For semantic elements (checkboxes, radios)
4. **CSS Selector (name)** - Fallback for named fields
5. **CSS Selector (ID)** - When ID is available
6. **XPath** - Last resort for complex cases

This ensures maximum reliability even with dynamic IDs or changing DOM structure.

## Advanced Features

### Handling Dynamic Content

The script waits for:
- Page network idle before extraction
- Element visibility before filling
- Dynamic content loading (configurable delays)

### Error Recovery

- Tries multiple locator strategies before failing
- Continues filling other fields even if one fails
- Comprehensive error logging and reporting

### Debugging Mode

Set `headless: false` in the script to watch the automation in action:

```javascript
browser = await chromium.launch({
  headless: false,  // Watch the browser
  slowMo: 100       // Slow down actions for visibility
});
```

## Example Integration with Your App

```javascript
// In your Next.js API route
import { autoApply } from '@/scripts/auto-apply-intelligent';

export async function POST(req) {
  const { jobUrl, userId } = await req.json();

  // Fetch user profile from database
  const userProfile = await getUserProfile(userId);

  // Run auto-apply
  const results = await autoApply(jobUrl, userProfile);

  // Save results to database
  await saveApplicationResults(userId, jobUrl, results);

  return Response.json(results);
}
```

## Best Practices

1. **Test First**: Run with `headless: false` to verify the automation works
2. **User Profile Completeness**: More complete profiles = better results
3. **API Rate Limits**: Be mindful of OpenAI API usage for batch applications
4. **Review Before Submit**: Set `SUBMIT_AUTOMATICALLY=false` for safety
5. **Error Monitoring**: Log failed applications for improvement

## Troubleshooting

### "No form fields found"
- Check if the page has loaded completely
- Verify the URL is correct
- Increase wait time: `await page.waitForTimeout(5000)`

### "All locator strategies failed"
- The field might be in an iframe
- Check browser console for the actual field structure
- Manually inspect the page and adjust selectors

### "AI returned invalid JSON"
- Check your OpenAI API key is valid
- Verify you have API credits
- Try increasing temperature for more flexible responses

### Fields not filling correctly
- Check if fields have input validation
- Verify the field is actually visible (not hidden)
- Try increasing `slowMo` delay to see what's happening

## Performance

- Average time per application: 30-60 seconds
- OpenAI API call: ~5-10 seconds
- DOM extraction: <1 second
- Form filling: 0.5 seconds per field
- Costs: ~$0.01-0.05 per application (GPT-4 API)

## Security Considerations

- Never commit `.env` files with API keys
- Store user profiles securely
- Respect website terms of service
- Don't use for spam or fraudulent applications
- Rate limit your automation to avoid triggering anti-bot measures

## Future Enhancements

- [ ] Support for multi-page applications
- [ ] File upload handling (resume, cover letter)
- [ ] CAPTCHA detection and handling
- [ ] Session persistence across applications
- [ ] Retry failed applications
- [ ] A/B testing different answer strategies
- [ ] Integration with job boards (LinkedIn, Indeed)

## Support

For issues or questions:
1. Check the debug logs
2. Run with `headless: false` to see the browser
3. Verify your user profile structure matches expectations
4. Check OpenAI API status

## License

MIT
