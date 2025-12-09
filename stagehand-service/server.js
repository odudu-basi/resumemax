require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Stagehand } = require('@browserbasehq/stagehand');
const { adaptiveFormFillAgent } = require('./adaptive_apply_agent');
const { hybridFormFill } = require('./adaptive_apply_hybrid');
const { intelligentFormFill } = require('./intelligent_form_fill');
const { intelligentJobApplication } = require('./GPT_pattern_recognition_apply');
const { uploadResumeToForm } = require('./resume_upload_helper');
const { scrapeJobDetails } = require('./job_desc_scraper');

const app = express();
const PORT = process.env.PORT || 3001;

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
    const { jobUrl, userProfile, approach, coverLetter } = req.body;

    if (!jobUrl || !userProfile) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const selectedApproach = approach || 'pattern_recognition';
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

    // Get page using official Stagehand method
    const page = stagehand.context.pages()[0];
    console.log("📄 Page object:", page ? "ready" : "undefined");
    
    // Navigate to job URL
    console.log(`🔗 Navigating to: ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('✅ Navigation complete');

    // Pre-upload resume if available
    if (userProfile.resumeFile && userProfile.resumeFile.contentBase64) {
      console.log('📄 Attempting to pre-upload resume...');
      try {
        const resumeUploaded = await uploadResumeToForm(page, userProfile.resumeFile, 'resume');
        if (resumeUploaded) {
          console.log('✅ Resume pre-uploaded successfully');
        } else {
          console.log('⚠️  Resume pre-upload failed, agent will handle manually');
        }
      } catch (uploadError) {
        console.log('⚠️  Resume upload error:', uploadError.message);
      }
    }

    // Upload cover letter if provided
    if (coverLetter) {
      console.log('📝 Checking for cover letter field...');
      try {
        const coverLetterUploaded = await uploadResumeToForm(page, coverLetter, 'cover letter');
        if (coverLetterUploaded) {
          console.log('✅ Cover letter uploaded');
        } else {
          console.log('ℹ️  No cover letter field in form');
        }
      } catch (uploadError) {
        console.log('⚠️  Cover letter upload error:', uploadError.message);
      }
    }

    // Extract job info for context
    const jobInfo = {
      title: 'Position',
      company: 'Company',
      url: jobUrl
    };

    // Route to selected approach
    if (selectedApproach === 'pattern_recognition') {
      console.log('🧠 Using GPT PATTERN RECOGNITION approach');

      const result = await intelligentJobApplication(stagehand, userProfile, jobInfo, {
        maxIterations: 20
      });

      await stagehand.close();

      return res.json({
        success: result.success,
        message: result.message || result.error,
        sessionId,
        sessionUrl,
        iterations: result.iterations,
        finalUrl: result.finalUrl,
        totalCost: result.totalCost
      });

    } else if (selectedApproach === 'intelligent') {
      console.log('🧠 Using INTELLIGENT approach');
      await intelligentFormFill(stagehand, userProfile, jobUrl, sessionId, sessionUrl, res);

    } else if (selectedApproach === 'hybrid') {
      console.log('🔄 Using HYBRID approach');
      await hybridFormFill(stagehand, userProfile, sessionId, sessionUrl, res, jobUrl);

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
      return res.status(400).json({ success: false, error: 'Missing jobUrl' });
    }

    console.log('🔍 Starting job scraping:', jobUrl);

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

    const jobDetails = await scrapeJobDetails(stagehand, jobUrl);

    await stagehand.close();
    console.log('✅ Job scraping completed');

    res.json(jobDetails);

  } catch (error) {
    console.error('❌ Error scraping job:', error);
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
  console.log(`🚀 Stagehand API running on port ${PORT}`);
  console.log(`📋 Available approaches:`);
  console.log(`   - pattern_recognition (default, GPT-based adaptive)`);
  console.log(`   - intelligent (Phase 0 ChatGPT)`);
  console.log(`   - hybrid (observe + ChatGPT + agent)`);
  console.log(`   - agent (agent-only)`);
});
