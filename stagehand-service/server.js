require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Stagehand } = require('@browserbasehq/stagehand');

const app = express();
const PORT = process.env.PORT || 3001;
// Debug: Log environment variables on startup
console.log("🔍 Environment variables loaded:");
console.log("BROWSERBASE_API_KEY:", process.env.BROWSERBASE_API_KEY || "❌ NOT SET");
console.log("BROWSERBASE_PROJECT_ID:", process.env.BROWSERBASE_PROJECT_ID || "❌ NOT SET");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ Set (length: " + process.env.OPENAI_API_KEY.length + ")" : "❌ NOT SET");
console.log("PORT:", PORT);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stagehand-api', timestamp: new Date().toISOString() });
});

app.post('/apply', async (req, res) => {
  let stagehand = null;

  try {
    const { jobUrl, userProfile } = req.body;

    if (!jobUrl || !userProfile) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    console.log('🚀 Starting application for:', jobUrl);

    stagehand = new Stagehand({
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      modelApiKey: process.env.OPENAI_API_KEY,
      env: 'BROWSERBASE',
      verbose: 0,
      enableCaching: true,
      headless: false,
    });

    await stagehand.init();
    const sessionUrl = stagehand.browserbaseSessionURL || null;
    const sessionId = stagehand.browserbaseSessionID || null;
    console.log('Session URL:', sessionUrl);
    console.log("✅ Stagehand init complete");
    console.log("Page:", stagehand.page ? "✅ exists" : "❌ undefined");

    const page = stagehand.page;
    if (!page) throw new Error('Failed to get page from Stagehand');

    await page.goto(jobUrl, { waitUntil: 'networkidle' });

    const firstName = userProfile.fullName.split(' ')[0];
    const lastName = userProfile.fullName.split(' ').slice(1).join(' ');
    const workExp = userProfile.workExperience.map((e, i) => `${i+1}. ${e.title} at ${e.company}`).join('\
');
    const edu = userProfile.education.map((e, i) => `${i+1}. ${e.degree} - ${e.school}`).join('\
');

    const instructions = `Fill out job application.

CANDIDATE:
- Name: ${firstName} ${lastName}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}
${userProfile.linkedinUrl ? '- LinkedIn: ' + userProfile.linkedinUrl : ''}

WORK: ${workExp}
EDUCATION: ${edu}
SKILLS: ${userProfile.skills.technical.join(', ')}

Fill all fields, click Apply/Next buttons, and submit.`;

    await stagehand.act({ action: instructions });
    await stagehand.close();

    res.json({ success: true, sessionId, sessionUrl, message: 'Application submitted' });

  } catch (error) {
    console.error('Error:', error);
    if (stagehand) {
      try { await stagehand.close(); } catch (e) {}
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/session/:sessionId', (req, res) => {
  const sessionUrl = `https://www.browserbase.com/sessions/${req.params.sessionId}`;
  res.json({ success: true, sessionId: req.params.sessionId, sessionUrl });
});

app.listen(PORT, () => {
  console.log(`Stagehand API on port ${PORT}`);
});
