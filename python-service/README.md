# Browser-Use Job Application Service

AI-powered job application automation using browser-use and FastAPI.

## What is This?

This Python microservice uses **browser-use** (an AI agent framework built on Playwright) to automatically fill out and submit job applications. It receives requests from the Next.js frontend and uses GPT-4 to intelligently navigate job application forms.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│   Next.js App   │────────▶│  Python Service  │────────▶│  Browser-Use    │
│   (Frontend)    │  HTTP   │   (FastAPI)      │   AI    │   Agent         │
│                 │         │                  │         │  (Playwright)   │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     │
                                     ▼
                            ┌─────────────────┐
                            │                 │
                            │   OpenAI API    │
                            │   (GPT-4)       │
                            │                 │
                            └─────────────────┘
```

## Setup

### Prerequisites

- Python 3.11 or higher
- Node.js 18+ (for Next.js)
- OpenAI API key

### Installation

1. **Install Python dependencies:**

```bash
cd python-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Install Playwright browsers:**

```bash
playwright install chromium
```

3. **Configure environment variables:**

Create a `.env` file in the `python-service` directory:

```env
# OpenAI API Key (required)
OPENAI_API_KEY=your-openai-api-key-here

# Service Configuration
SERVICE_PORT=8000
SERVICE_HOST=0.0.0.0

# Supabase (optional - for logging)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
```

## Running the Service

### Development Mode

```bash
cd python-service
source venv/bin/activate
python main.py
```

The service will start on `http://localhost:8000` with auto-reload enabled.

### Production Mode

```bash
cd python-service
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T10:00:00",
  "service": "browser-use-job-application"
}
```

### Start Job Application

```bash
POST /apply
```

Request body:
```json
{
  "job_url": "https://jobs.lever.co/company/position",
  "user_id": "user123",
  "session_id": "optional-session-id",
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "location": "San Francisco, CA",
  "work_experience": [
    {
      "title": "Software Engineer",
      "company": "Tech Corp",
      "duration": "2020-2023",
      "description": "Built awesome things"
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "school": "University of Example",
      "year": "2020"
    }
  ],
  "resume_url": "https://example.com/resume.pdf",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "portfolio_url": "https://johndoe.com",
  "cover_letter": "I am excited to apply...",
  "headless": true,
  "timeout": 300
}
```

Response:
```json
{
  "session_id": "session_1730723456",
  "status": "started",
  "progress": "Job application initiated..."
}
```

### Check Status

```bash
GET /status/{session_id}
```

Response:
```json
{
  "session_id": "session_1730723456",
  "status": "completed",
  "progress": "Application completed",
  "result": {
    "success": true,
    "fields_filled": 15,
    "total_fields": 15,
    "submission_confirmed": true,
    "execution_time": 45.2
  }
}
```

### Delete Session

```bash
DELETE /session/{session_id}
```

## Integration with Next.js

Your Next.js app should call the `/api/browser-apply` endpoint:

```typescript
// Example usage in Next.js
const response = await fetch('/api/browser-apply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobUrl: 'https://jobs.lever.co/company/position',
    userId: currentUser.id,
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    location: 'San Francisco, CA',
    // ... other fields
  })
});

const { sessionId } = await response.json();

// Poll for status
const statusResponse = await fetch(`/api/browser-apply?sessionId=${sessionId}`);
const status = await statusResponse.json();
```

## Testing

### Test the Python service directly:

```bash
cd python-service
source venv/bin/activate
python -c "import asyncio; from browser_agent import test_agent; asyncio.run(test_agent())"
```

### Test the full integration:

1. Start the Python service:
```bash
cd python-service
source venv/bin/activate
python main.py
```

2. Start the Next.js dev server:
```bash
npm run dev
```

3. Run the test script:
```bash
node test-browser-use.js
```

## How It Works

1. **Natural Language Task**: The agent receives a natural language description of what to do (e.g., "Fill out this job application with the user's data")

2. **AI Decision Making**: GPT-4 analyzes the web page, identifies form fields, and determines how to fill them

3. **Smart Form Filling**: The agent:
   - Handles multi-step forms
   - Detects and fills dropdown menus
   - Manages dynamic fields
   - Handles file uploads (if URL provided)
   - Submits the form

4. **Result Tracking**: Returns detailed information about what was filled and whether submission succeeded

## Advantages Over Traditional Playwright

- **AI-Powered**: No need to write specific selectors or scripts for each job board
- **Adaptive**: Works with forms that change or have dynamic fields
- **Natural Language**: Describe what you want, not how to do it
- **Multi-Step Forms**: Automatically handles pagination and multi-page applications
- **Error Recovery**: AI can adapt when forms don't behave as expected

## Limitations

- Requires LLM API calls (costs ~$0.01-0.10 per application)
- Slower than direct Playwright (AI reasoning overhead)
- May struggle with complex CAPTCHAs
- Headless mode might be detected by some sites

## Deployment

### Option 1: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
cd python-service
railway login
railway init
railway up
```

### Option 2: Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `pip install -r requirements.txt && playwright install chromium`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables

### Option 3: Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

RUN playwright install chromium chromium-headless-shell
RUN apt-get update && apt-get install -y libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Troubleshooting

### Python service won't start

- Check that Python 3.11+ is installed: `python3 --version`
- Verify all dependencies are installed: `pip list`
- Check that Playwright browsers are installed: `playwright install chromium`

### "Module not found" errors

- Make sure you're in the virtual environment: `source venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt`

### Browser-use agent fails

- Check OpenAI API key is valid
- Verify you have sufficient API credits
- Check the job URL is accessible
- Try with `headless: false` to see what's happening

### Next.js can't connect to Python service

- Verify Python service is running: `curl http://localhost:8000/health`
- Check `PYTHON_SERVICE_URL` in `.env.local`
- Ensure no firewall is blocking port 8000

## Support

For issues specific to:
- **browser-use**: https://github.com/browser-use/browser-use
- **FastAPI**: https://fastapi.tiangolo.com/
- **Playwright**: https://playwright.dev/python/

## License

MIT
