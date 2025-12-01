require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Stagehand } = require('@browserbasehq/stagehand');
const { adaptiveFormFill } = require('./adaptive_apply');

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
      model: "openai/gpt-4o",
      env: 'BROWSERBASE',
      verbose: 1,
      enableCaching: true,
      headless: false,
    });

    await stagehand.init();
    const sessionUrl = stagehand.browserbaseSessionURL || null;
    const sessionId = stagehand.browserbaseSessionID || null;
    console.log('✅ Stagehand initialized. Session URL:', sessionUrl);

    // Get page from context and navigate
    const page = stagehand.context.pages()[0];
    console.log("📄 Page object:", page ? "exists" : "undefined");
    await page.goto(jobUrl);

    // Use adaptive form filling
    await adaptiveFormFill(stagehand, userProfile, sessionId, sessionUrl, res);

  } catch (error) {
    console.error('❌ Error:', error);
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
