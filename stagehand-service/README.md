# Stagehand API Service

Express.js API service that uses Browserbase + Stagehand to automate job applications.

## Features

- 🤖 AI-powered form filling with Stagehand
- 🌐 Browserbase integration for remote browser sessions
- 📺 Live session viewing URLs
- 🚀 RESTful API for job applications
- ✅ Health check endpoint

## API Endpoints

### POST /apply
Submit a job application

**Request:**
```json
{
  "jobUrl": "https://job-board.com/job/123",
  "userProfile": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "location": "San Francisco, CA",
    "linkedinUrl": "https://linkedin.com/in/johndoe",
    "yearsOfExperience": "5",
    "workExperience": [...],
    "education": [...],
    "skills": { "technical": [...], "languages": [...] }
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "sessionUrl": "https://www.browserbase.com/sessions/abc123",
  "message": "Application submitted successfully"
}
```

### GET /session/:sessionId
Get session URL for a given session ID

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "sessionUrl": "https://www.browserbase.com/sessions/abc123"
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "service": "stagehand-api",
  "timestamp": "2025-11-29T..."
}
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
# Add your Browserbase credentials
```

3. Start server:
```bash
npm run dev
```

4. Test:
```bash
curl http://localhost:3001/health
```

## Deployment

See [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) for Railway deployment instructions.

## Environment Variables

- `BROWSERBASE_API_KEY` - Your Browserbase API key
- `BROWSERBASE_PROJECT_ID` - Your Browserbase project ID
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (production/development)

## Tech Stack

- **Node.js** - Runtime
- **Express** - Web framework
- **Stagehand** - AI browser automation
- **Browserbase** - Remote browser infrastructure
