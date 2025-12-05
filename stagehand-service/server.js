require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Stagehand } = require('@browserbasehq/stagehand');
const { adaptiveFormFillAgent } = require('./adaptive_apply_agent');
const { hybridFormFill } = require('./adaptive_apply_hybrid');
const { uploadResumeToForm } = require('./resume_upload_helper');
const { scrapeJobDetails } = require('./job_desc_scraper');

const app = express();
const PORT = process.env.PORT || 3001;

// Debug: Log environment variables on startup
console.log("🔍 Environment variables loaded:");
console.log("BROWSERBASE_API_KEY:", process.env.BROWSERBASE_API_KEY || "❌ NOT SET");
console.log("BROWSERBASE_PROJECT_ID:", process.env.BROWSERBASE_PROJECT_ID || "❌ NOT SET");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ Set (length: " + process.env.OPENAI_API_KEY.length + ")" : "❌ NOT SET");
console.log("GOOGLE_GENERATIVE_AI_API_KEY:", process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "✅ Set (length: " + process.env.GOOGLE_GENERATIVE_AI_API_KEY.length + ")" : "❌ NOT SET");
console.log("PORT:", PORT);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stagehand-api', timestamp: new Date().toISOString() });
});

app.post('/apply', async (req, res) => {
  let stagehand = null;

  try {
    const { jobUrl, userProfile, approach } = req.body;

    if (!jobUrl || !userProfile) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const selectedApproach = approach || 'hybrid'; // Default to hybrid mode
    console.log(`🚀 Starting ${selectedApproach} application for:`, jobUrl);

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

    // Pre-upload resume if available (before agent starts)
    if (userProfile.resumeFile && userProfile.resumeFile.contentBase64) {
      console.log('📄 Attempting to pre-upload resume...');
      const resumeUploaded = await uploadResumeToForm(page, userProfile.resumeFile);
      if (resumeUploaded) {
        console.log('✅ Resume pre-uploaded successfully');
      } else {
        console.log('⚠️  Resume pre-upload failed, agent will handle manually');
      }
    }

    // Pre-upload cover letter if available (right after resume)
    if (coverLetter && coverLetter.contentBase64) {
      console.log('📝 Attempting to pre-upload cover letter PDF...');
      const coverLetterUploaded = await uploadResumeToForm(page, coverLetter); // Use same upload method
      if (coverLetterUploaded) {
        console.log('✅ Cover letter pre-uploaded successfully');
      } else {
        console.log('⚠️  Cover letter pre-upload failed');
      }
    }

    // Route to selected approach
    if (selectedApproach === 'hybrid') {
      console.log('🔄 Using HYBRID approach (observe + ChatGPT + agent)');
      await hybridFormFill(stagehand, userProfile, sessionId, sessionUrl, res);
    } else {
      console.log('🤖 Using AGENT-ONLY approach');
      await adaptiveFormFillAgent(stagehand, userProfile, sessionId, sessionUrl, res);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    if (stagehand) {
      try { await stagehand.close(); } catch (e) {}
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/scrape-job-details', async (req, res) => {
  let stagehand = null;

  try {
    const { jobUrl } = req.body;

    if (!jobUrl) {
      return res.status(400).json({ success: false, error: 'Missing jobUrl in request body' });
    }

    console.log('🔍 Starting job details scraping for:', jobUrl);

    stagehand = new Stagehand({
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      env: 'BROWSERBASE',
      verbose: 1,
      enableCaching: true,
      headless: true,
    });

    await stagehand.init();
    console.log('✅ Stagehand initialized for scraping');

    // Scrape job details
    const jobDetails = await scrapeJobDetails(stagehand, jobUrl);

    // Close the browser
    await stagehand.close();
    console.log('✅ Job scraping completed successfully');

    res.json(jobDetails);

  } catch (error) {
    console.error('❌ Error scraping job details:', error);
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
