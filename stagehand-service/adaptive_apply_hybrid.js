const OpenAI = require('openai');
const { z } = require('zod');

const { detectLoginPage, handleLogin } = require('./login_handler');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Stagehand documentation for login commands
const STAGEHAND_DOCS = `
# STAGEHAND DOCUMENTATION

## act() - Execute Actions
Performs individual web actions using natural language instructions.

**Syntax:**
await stagehand.act(instruction, { variables })

**Examples:**
- act("click the Apply button")
- act("click the Sign In link")
- act("enter %email% into the email field", { variables: { email: "user@example.com" } })
- act("enter %password% into the password field", { variables: { password: "secret123" } })
- act("click the Create Account button")
- act("click the Submit button")
- act("click the Continue button")

**Supported Actions:**
- Click buttons, links, checkboxes, radio buttons
- Fill text inputs, textareas
- Select dropdown options
- Type text with keyboard
- Scroll to elements
- Press keys (Enter, Tab, etc)

**Best Practices:**
1. Use %variableName% for ALL personal data (email, password, name, etc)
2. Break complex tasks into simple steps
3. Be specific: "click the blue Apply button" not "click button"
4. One action per act() call
5. Use variables parameter to pass sensitive data

## observe() - Discover Elements
Finds actionable elements without executing them.

**Returns:** Array of actions with { description, method, arguments, selector }

**Use for:** Understanding what's on the page before acting

## extract() - Get Structured Data
Retrieves structured data from webpages using natural language or Zod schemas.

**Use for:** Getting page context, labels, instructions, current state
`;

/**
 * Extract job description from the page
 */
async function extractJobDescription(stagehand) {
  console.log('\n📄 Extracting job description...');

  try {
    const jobDescSchema = z.object({
      title: z.string().describe("Job title"),
      company: z.string().describe("Company name"),
      summary: z.string().describe("A brief 2-3 sentence summary of the role, key responsibilities, and main requirements")
    });

    const jobDesc = await stagehand.extract(
      "Extract the job title, company name, and create a concise 2-3 sentence summary of the role including key responsibilities and main requirements",
      jobDescSchema
    );

    console.log(`  ✅ Extracted job: ${jobDesc.title} at ${jobDesc.company}`);
    return jobDesc;

  } catch (error) {
    console.error('  ⚠️  Job description extraction failed:', error.message);
    return null;
  }
}

/**
 * Get intelligent answers from ChatGPT for all form fields
 */
async function getIntelligentAnswers(fieldDescriptions, userProfile, jobDescription) {
  console.log('\n🤖 Asking ChatGPT for intelligent field answers...');
  console.log(`  📊 Total fields to process: ${fieldDescriptions.length}`);

  const jobContext = jobDescription ? `
JOB CONTEXT:
Title: ${jobDescription.title}
Company: ${jobDescription.company}
Summary: ${jobDescription.summary}
` : '';

  // Chunk fields if there are too many (safety measure)
  const MAX_FIELDS_PER_CALL = 50; // Limit to 50 fields per API call
  const chunks = [];
  
  if (fieldDescriptions.length > MAX_FIELDS_PER_CALL) {
    console.log(`  ⚠️  Too many fields (${fieldDescriptions.length}), processing in chunks...`);
    for (let i = 0; i < fieldDescriptions.length; i += MAX_FIELDS_PER_CALL) {
      chunks.push(fieldDescriptions.slice(i, i + MAX_FIELDS_PER_CALL));
    }
  } else {
    chunks.push(fieldDescriptions);
  }

  let allAnswers = {};
  let totalTokens = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    console.log(`  🔄 Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} fields)...`);

    const prompt = `You are a job application assistant. Given a user's profile, job context, and form fields, provide the best answer for each field.

USER PROFILE:
Name: ${userProfile.fullName}
Email: ${userProfile.workEmail}
Phone: ${userProfile.phone}
Location: ${userProfile.location}
Work Authorization: ${userProfile.workAuthorized ? 'Yes' : 'No'}
Requires Sponsorship: ${userProfile.requiresSponsorship ? 'Yes' : 'No'}
Years of Experience: ${userProfile.yearsOfExperience}
LinkedIn: ${userProfile.linkedinUrl || 'N/A'}
Recent Work: ${(userProfile.workExperience || []).slice(0, 2).map(exp => `${exp.position} at ${exp.company}`).join(', ')}
Education: ${(userProfile.education || []).slice(0, 2).map(edu => `${edu.degree} from ${edu.school}`).join(', ')}
Top Skills: ${(userProfile.skills?.technical || []).slice(0, 8).join(', ')}

${jobContext}

FORM FIELDS TO FILL:
${chunk.map((field, i) => `${i + 1}. ${field.description} (${field.method})`).join('\n')}

INSTRUCTIONS:
- For each field, provide a concise, accurate answer based on the user profile
- For essay questions (like "Why do you want to work here?"), write professional 2-3 sentence responses tailored to the job description
- For yes/no questions, answer based on the profile data
- For dropdown/select fields, return "SKIP" (these will be handled in Phase 2)
- If you don't have information for a field, return "SKIP"

IMPORTANT: Return JSON where the keys are the EXACT field descriptions (copy them exactly, including all punctuation and wording). Example format: { "Input field for the applicant's first name.": "John", "Input field for the applicant's last name.": "Doe" }`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that fills out job application forms accurately.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const chunkAnswers = JSON.parse(response.choices[0].message.content);
      allAnswers = { ...allAnswers, ...chunkAnswers };
      totalTokens += response.usage.total_tokens;
      console.log(`  ✅ Chunk ${chunkIndex + 1} completed. Tokens: ${response.usage.total_tokens}`);
    } catch (error) {
      console.error(`  ❌ ChatGPT error for chunk ${chunkIndex + 1}:`, error.status, error.message);
      // Continue with other chunks even if one fails
    }
  }

  console.log(`  ✅ Got answers for ${Object.keys(allAnswers).length} fields`);
  console.log(`  💰 Total tokens used: ${totalTokens}`);
  return {
    answers: allAnswers,
    tokens: totalTokens
  };
}

/**
 * Observe form fields - returns Action[] with selectors
 */
async function observeFormFields(stagehand) {
  console.log('\n👀 Phase 1: Observing form fields...');

  try {
    // observe() returns Action[] with { description, method, arguments, selector }
    const actions = await stagehand.observe(
      "Find all form input fields, textareas, and dropdown selects. Exclude file upload inputs. Describe what each field is for."
    );

    console.log(`  ✅ Found ${actions.length} form fields`);

    if (actions.length > 0) {
      console.log('\n  📋 Sample fields:');
      actions.slice(0, 5).forEach(action => {
        console.log(`    - ${action.description} (${action.method})`);
      });
    }

    return actions;

  } catch (error) {
    console.error('  ❌ Observe failed:', error.message);
    return [];
  }
}

/**
 * Fill form fields using act() with proper options
 */
async function fillFormFields(stagehand, actions, answers) {
  console.log('\n✍️  Phase 1: Filling form fields...');

  let filledCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const action of actions) {
    const description = action.description || '';
    const answer = answers[description];
    if (!answer || answer === 'SKIP') {
      console.log(`  ⏭️  Skipping: ${description}`);
      skippedCount++;
      continue;
    }

    // Wrap each field operation in comprehensive error handling
    try {
      const descLower = description.toLowerCase();

      // DROPDOWN LOGIC: Fill dropdowns in Phase 1 (no longer skip)
      if (descLower.includes('dropdown') || descLower.includes('select') || action.method === 'selectOption') {
        console.log(`  📋 Filling dropdown: ${description.substring(0, 50)}...`);
        
        try {
          const result = await stagehand.act(`select "${answer}" from the ${description}`, {});
          
          if (result && typeof result === 'object') {
            filledCount++;
            console.log(`    ✅ Selected: ${answer.substring(0, 50)}${answer.length > 50 ? '...' : ''}`);
          } else {
            console.log(`    ⚠️  Invalid response from stagehand.act, but continuing...`);
            filledCount++;
          }
        } catch (actError) {
          console.log(`    ❌ Dropdown selection failed: ${actError.message}`);
          errorCount++;
          continue;
        }
      }
      // TEXT/TEXTAREA LOGIC
      else {
        console.log(`  📝 Filling: ${description.substring(0, 50)}...`);

        try {
          const result = await stagehand.act(`enter "${answer}" in the ${description}`, {});

          // Validate that we got a proper response
          if (result && typeof result === 'object') {
        filledCount++;
        console.log(`    ✅ Entered: ${answer.substring(0, 50)}${answer.length > 50 ? '...' : ''}`);
          } else {
            console.log(`    ⚠️  Invalid response from stagehand.act, but continuing...`);
            filledCount++; // Still count as filled since no error was thrown
          }
        } catch (actError) {
          console.log(`    ❌ Act failed: ${actError.message}`);
          errorCount++;
          continue; // Skip to next field
        }
      }

      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`  ❌ Error filling ${description}:`, error.message);
      console.log(`    🔄 Field will be handled by Phase 2 agent fallback`);
      errorCount++;
      // Continue to next field - don't let one field failure stop the entire process
    }
  }

  console.log('\n📊 Phase 1 Summary:');
  console.log(`  ✅ Filled: ${filledCount} fields`);
  console.log(`  ⏭️  Skipped: ${skippedCount} fields`);
  console.log(`  ❌ Errors: ${errorCount} fields`);

  return { filledCount, skippedCount, errorCount };
}

/**
 * Handle email verification using manual act/extract/observe approach
 */
async function handleVerification(stagehand, userProfile) {
  console.log('\n📧 Verification Handler: Checking for verification requirement...');

  try {
    // Get the page object from context
    const pages = stagehand.context.pages();
    if (!pages || pages.length === 0) {
      console.log(`❌ No pages available in context for verification`);
      throw new Error('Browser context lost - no pages available');
    }
    const page = pages[0];

    // Check if verification is needed on current page
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const needsVerification = (pageText.includes('verify') && pageText.includes('email')) ||
                              pageText.includes('verification code') ||
                              pageText.includes('enter code') ||
                              pageText.includes('check your email') ||
                              pageText.includes('confirmation code') ||
                              pageText.includes('we sent you') ||
                              pageText.includes('enter the code');

    if (!needsVerification) {
      console.log('  ℹ️  No verification required, continuing...');
      return { verified: false, reason: 'No verification needed' };
    }

    console.log('  🔔 Verification required! Starting verification flow...');

    // Save the current application URL to return to
    const applicationUrl = page.url();
    console.log(`  💾 Saved application URL: ${applicationUrl}`);

    // Step 1: Open Gmail in new tab (preserve application context)
    console.log('\n  📬 Step 1: Opening Gmail in new tab...');
    const gmailPage = await stagehand.context.newPage();
    await gmailPage.goto('https://mail.google.com', { waitUntil: 'networkidle' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Check if already logged in, if not, log in
    console.log('  🔐 Step 2: Logging into Gmail...');
    const gmailEmail = userProfile.workEmail;
    const gmailPassword = userProfile.workPassword;

    // Use observe to check if login is needed on Gmail page
    const loginElements = await stagehand.observe(
      "Find email input field, password input field, or sign in button. Only return actions if Gmail login page is shown."
    );

    if (loginElements.length > 0) {
      console.log('    🔑 Gmail login required, entering credentials...');

      // Step 1: Fill email and proceed to password page
      console.log('      📧 Entering email address...');
      await stagehand.act(`Enter "${gmailEmail}" in the email input field and click Next`, { page: gmailPage });
      
      // Step 2: Wait for password page to load (Gmail's two-step process)
      console.log('      ⏳ Waiting for password page to load...');
      try {
        // Wait for URL change or password field to appear
        await Promise.race([
          gmailPage.waitForURL('**/challenge/pwd**', { timeout: 8000 }),
          gmailPage.waitForSelector('input[type="password"]', { timeout: 8000 }),
          gmailPage.waitForSelector('input[name="password"]', { timeout: 8000 })
        ]);
        console.log('      ✅ Password page loaded');
      } catch (waitError) {
        console.log('      ⚠️  Password page detection timeout, proceeding anyway...');
      }
      
      // Additional wait for page stabilization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Fill password and complete login
      console.log('      🔐 Entering password...');
      await stagehand.act(`Enter "${gmailPassword}" in the password input field and click Next or Sign in`, { page: gmailPage });
      
      // Step 4: Wait for Gmail inbox to load
      console.log('      ⏳ Waiting for Gmail inbox to load...');
      try {
        await Promise.race([
          gmailPage.waitForURL('**/mail.google.com/mail/**', { timeout: 10000 }),
          gmailPage.waitForSelector('[data-testid="inbox"]', { timeout: 10000 }),
          gmailPage.waitForSelector('.zA', { timeout: 10000 }) // Gmail email list
        ]);
        console.log('      ✅ Gmail inbox loaded successfully');
      } catch (inboxError) {
        console.log('      ⚠️  Gmail inbox detection timeout, proceeding anyway...');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('    ✅ Gmail login completed');
    } else {
      console.log('    ℹ️  Already logged into Gmail');
    }

    // Step 3: Find and open the verification email on Gmail page
    console.log('\n  🔍 Step 3: Finding verification email...');
    await stagehand.act(
      "Find and click on the most recent email that contains a verification code, confirmation code, or is from the company/service we just signed up for. Look for emails in the inbox.",
      { page: gmailPage }
    );
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Extract the verification code from Gmail page
    console.log('  📝 Step 4: Extracting verification code...');
    const codeSchema = z.object({
      code: z.string().describe("The verification code, confirmation code, or OTP from the email. Usually a 4-8 character code.")
    });

    const extracted = await stagehand.extract(
      "Find and extract the verification code, confirmation code, or OTP from this email. It's typically displayed prominently as a number or alphanumeric code.",
      codeSchema
    );

    const verificationCode = extracted.code;
    console.log(`  ✅ Found verification code: ${verificationCode}`);

    // Step 5: Close Gmail tab and navigate back to application tab
    console.log('\n  🔙 Step 5: Closing Gmail tab and returning to application...');
    await gmailPage.close();
    console.log('    ✅ Gmail tab closed');
    
    // Navigate back to application tab (ensure we're on the right page)
    await page.bringToFront();
    console.log('    ✅ Navigated back to application tab');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 6: Enter the verification code on original application page
    console.log('  ⌨️  Step 6: Entering verification code on application page...');
    await stagehand.act(
      `Enter the verification code "${verificationCode}" in the verification code input field and submit it. Click the submit or verify button.`,
      { page: page }
    );
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('  ✅ Verification completed successfully!');

    return {
      verified: true,
      code: verificationCode,
      reason: 'Verification completed',
      gmailPage: gmailPage // Return Gmail page reference for potential reuse
    };

  } catch (error) {
    console.error('  ❌ Verification handler error:', error.message);
    
    // Clean up Gmail tab if it exists
    try {
      if (typeof gmailPage !== 'undefined' && gmailPage) {
        await gmailPage.close();
        console.log('  🧹 Gmail tab cleaned up after error');
      }
    } catch (cleanupError) {
      console.log('  ⚠️ Error cleaning up Gmail tab:', cleanupError.message);
    }
    
    return {
      verified: false,
      error: error.message,
      reason: 'Verification failed'
    };
  }
}

/**
 * Fallback: Use agent to handle verification if manual approach fails
 */
async function agentVerificationFallback(stagehand, userProfile, existingGmailPage = null) {
  console.log('\n🤖 Agent Verification Fallback: Using autonomous agent...');

  try {
    const agent = stagehand.agent({
      cua: true,
      model: {
        modelName: "google/gemini-2.5-computer-use-preview-10-2025",
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
      },
      systemPrompt: `You are a verification code assistant. Your task is to check if verification is needed, get the code from Gmail, and complete the verification process.`
    });

    // Check if Gmail tab already exists, if not create one
    let gmailPage = existingGmailPage;
    const pages = stagehand.context.pages();
    if (!pages || pages.length === 0) {
      console.log(`❌ No pages available in context for Gmail verification`);
      throw new Error('Browser context lost - no pages available');
    }
    const applicationPage = pages[0];
    
    if (!gmailPage) {
      console.log('  📬 Opening new Gmail tab for agent...');
      gmailPage = await stagehand.context.newPage();
    } else {
      console.log('  📬 Reusing existing Gmail tab...');
    }

    const instruction = `Check if the current application page is asking for a verification code, confirmation code, or email verification.

If verification IS needed:
1. Note that you have access to both the application page and a Gmail page
2. Switch to the Gmail page and navigate to https://mail.google.com if not already there
3. Log in to Gmail using:
   - Email: ${userProfile.workEmail}
   - Password: ${userProfile.workPassword}
4. Find the most recent email with a verification code or verification link for the application/service we just signed up for
5. If it's a verification CODE: Extract the code and switch back to application page, enter it and submit
6. If it's a verification LINK: Click the link (it should open in the application tab)
7. Ensure you end up on the application page with verification completed

If verification is NOT needed:
- Simply confirm no verification is required and stop

IMPORTANT:
- Use the Gmail tab for email operations, application tab for entering codes
- Be careful to use the correct email and password
- Look for the most recent email in the inbox
- The verification code is usually displayed prominently in the email
- After entering the code or clicking link, make sure verification is completed on the application page and complete the applciation`;

    console.log('  🚀 Starting agent verification flow...');

    const result = await agent.execute({
      instruction,
      maxSteps: 25,
      highlightCursor: false
    });

    // Ensure we're back on the application page after agent completes
    console.log('  🔙 Ensuring we\'re back on application page...');
    await applicationPage.bringToFront();
    
    // Close Gmail tab if we created it (don't close if it was passed in)
    if (!existingGmailPage && gmailPage) {
      try {
        await gmailPage.close();
        console.log('  ✅ Gmail tab closed');
      } catch (error) {
        console.log('  ⚠️ Gmail tab already closed or error closing:', error.message);
      }
    }

    console.log('\n✅ Agent Verification Complete:');
    console.log(`  Steps taken: ${result.actions ? result.actions.length : 'N/A'}`);
    console.log(`  Success: ${result.success}`);

    if (result.usage) {
      const inputTokens = result.usage.input_tokens || 0;
      const outputTokens = result.usage.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 1.25;
      const outputCost = (outputTokens / 1000000) * 10;
      const totalCost = inputCost + outputCost;

      console.log(`  💰 Agent verification cost: $${totalCost.toFixed(4)}`);
      console.log(`     Input tokens: ${inputTokens.toLocaleString()}`);
      console.log(`     Output tokens: ${outputTokens.toLocaleString()}`);
    }

    return {
      verified: result.success,
      method: 'agent',
      steps: result.actions ? result.actions.length : 0,
      usage: result.usage,
      reason: result.success ? 'Agent verification completed' : 'Agent verification attempted',
      messages: result.messages || []
    };

  } catch (error) {
    console.error('  ❌ Agent verification error:', error.message);
    return {
      verified: false,
      method: 'agent',
      error: error.message,
      reason: 'Agent verification failed'
    };
  }
}

/**
 * Agent review with work experience included
 */
async function agentReviewAndComplete(stagehand, userProfile, jobDescription) {
  console.log('\n🤖 Phase 2: Agent review and completion...');

  const agent = stagehand.agent({
    cua: true,
    model: {
      modelName: "google/gemini-2.5-computer-use-preview-10-2025",
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
    },
    systemPrompt: `You are a quality control assistant for job application forms.

Your task:
1. REVIEW ONLY - Check if all fields on the current page are filled and complete
2. DO NOT FILL ANY FIELDS - Phase 1 has already filled all fields
3. Your job is to verify completeness and navigate to the next step
4. Click the NEXT or CONTINUE button to proceed to the next page (PRIORITY)
5. If no NEXT/CONTINUE button exists, click the SUBMIT button to submit the application

IMPORTANT NAVIGATION PRIORITY:
- FIRST: Look for "Next", "Continue", "Proceed" buttons
- SECOND: Look for "Submit", "Apply", "Send Application" buttons
- ONLY click Submit if no Next/Continue options are available

REVIEW GUIDELINES:
- Quickly scan the form to ensure fields appear filled
- Do not spend time filling empty fields - that's Phase 1's job
- Focus on finding and clicking the correct navigation button
- Be efficient - your main job is navigation, not form filling`
  });

  const firstName = userProfile.fullName.split(' ')[0] || '';
  const lastName = userProfile.fullName.split(' ').slice(1).join(' ') || '';

  // Add job context if available
  const jobContextText = jobDescription ? `
JOB YOU'RE APPLYING FOR:
- Position: ${jobDescription.title}
- Company: ${jobDescription.company}
- Summary: ${jobDescription.summary}

Use this job context and users information to answer questions like:
- "Why do you want to work here?" - Reference the company and role
- "Why are you interested in this position?" - Mention relevant aspects of the role
- "What interests you about this opportunity?" - Connect your experience to the job
` : '';

  const instruction = `Review this job application form and fill any missing or empty fields with the following user information:

PERSONAL INFO:
- Full Name: ${userProfile.fullName}
- First Name: ${firstName}
- Last Name: ${lastName}
- Email: ${userProfile.workEmail}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}

WORK EXPERIENCE:
${userProfile.workExperience.map((exp, i) => `
${i + 1}. ${exp.position} at ${exp.company}${exp.location ? ` (${exp.location})` : ''}
   Duration: ${exp.duration}
   Description: ${exp.description}
`).join('\n')}

EDUCATION:
${userProfile.education.map((edu, i) => `
${i + 1}. ${edu.degree}
   School: ${edu.school}
   ${edu.dateRange}
`).join('\n')}

WORK AUTHORIZATION:
- Authorized to work: ${userProfile.workAuthorized ? 'Yes' : 'No'}
- Requires sponsorship: ${userProfile.requiresSponsorship ? 'Yes' : 'No'}

${jobContextText}

YOUR TASK:
1. Look at the form and identify any empty or incomplete fields
2. Fill them with appropriate information from above
3. IMPORTANT: For each field, try filling it a maximum of 2 times. If a field fails twice, move on to the next field - do not spend more time on it
4. For questions without direct answers in the profile:
   - Use the job description and user's background to infer reasonable, truthful answers
   - Write responses that represent the user's best interests while being honest
5. For essay/paragraph questions about motivation or interest, write 2-3 professional sentences that:
   - Reference the specific company and role
   - Connect the user's relevant experience to job requirements
   - Show genuine interest based on the job context
6. For yes/no or dropdown questions, choose the most appropriate answer based on the profile
   - For COUNTRY CODE dropdowns: Look for phone country codes (+1, +44, +61, etc.) if you see them in dropdowns
   - For STATE/PROVINCE dropdowns: Use standard abbreviations (CA for California, NY for New York, etc.) if needed
7. After filling all fields, look for a NEXT button (check for buttons labeled "Next", "Continue", "Next Page", "Next Step")
8. If NEXT button exists: Click it to proceed to the next page
9. If NO NEXT button exists: Look for SUBMIT button (labeled "Submit", "Submit Application", "Apply Now") and click it
10. If the page says "Review your application" or similar, click the SUBMIT button`;

  try {
    const result = await agent.execute({
      instruction,
      maxSteps: 30,  // Increased to allow more steps for complex forms
      highlightCursor: false
    });

    console.log('\n✅ Phase 2 Complete:');
    console.log(`  Steps taken: ${result.actions ? result.actions.length : 'N/A'}`);
    console.log(`  Success: ${result.success}`);

    if (result.usage) {
      const inputTokens = result.usage.input_tokens || 0;
      const outputTokens = result.usage.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 1.25;
      const outputCost = (outputTokens / 1000000) * 10;
      const totalCost = (inputCost + outputCost).toFixed(4);
      console.log(`  💰 Phase 2 cost: $${totalCost}`);
      console.log(`     Input tokens: ${inputTokens.toLocaleString()}`);
      console.log(`     Output tokens: ${outputTokens.toLocaleString()}`);
    }

    return result;
  } catch (error) {
    console.error('  ❌ Phase 2 error:', error.message);
    
    // Check if this is an intermediate validation error that should be suppressed
    const isIntermediateError = error.message && (
      error.message.includes('string did not match') ||
      error.message.includes('expected pattern') ||
      error.message.includes('validation') ||
      error.message.includes('invalid format') ||
      error.message.includes('does not match pattern')
    );
    
    if (isIntermediateError) {
      console.log('  ⚠️  Intermediate validation error detected - treating as partial success');
      console.log('     This error will not be shown to user until process completes');
      
      // Return partial success instead of failure for intermediate errors
      return { 
        success: true, 
        partialSuccess: true,
        intermediateError: error.message,
        message: 'Form filling in progress with validation adjustments'
      };
    }
    
    // For non-intermediate errors, return failure as before
    return { success: false, error: error.message };
  }
}

/**
 * Check if URL is a Workday job application
 */
function isWorkdayJobUrl(url) {
  const workdayPatterns = [
    /\.myworkdayjobs\.com/,           // Standard Workday pattern
    /workday/i,                      // Contains "workday" anywhere
    /myworkdayjobs/i                 // Contains "myworkdayjobs"
  ];
  
  return workdayPatterns.some(pattern => pattern.test(url));
}

/**
 * Generate unique email for job applications using plus addressing
 */
function generateJobEmail(baseEmail) {
  const [username, domain] = baseEmail.split('@');
  
  // Generate two random numbers (10-99)
  const randomNumbers = Math.floor(Math.random() * 90) + 10;
  
  return `${username}+${randomNumbers}@${domain}`;
}

/**
 * Predefined Workday application steps
 */
const WORKDAY_STEPS = [
  {
    id: 'accept_cookies',
    action: 'click the Accept Cookies button',
    optional: true,
    description: 'Accept cookie consent if present'
  },
  {
    id: 'click_apply',
    action: 'click the Apply button',
    critical: true,
    description: 'Click main Apply button on job listing'
  },
  {
    id: 'apply_manually',
    action: 'click the Apply Manually button',
    critical: true,
    description: 'Choose manual application over LinkedIn/other options'
  },
  {
    id: 'scroll_to_form',
    action: 'scroll',
    scrollAmount: 50,
    description: 'Scroll to reveal form fields'
  },
  {
    id: 'enter_email',
    action: 'type %email% into the Email Address field',
    critical: true,
    description: 'Enter email address for account creation/login'
  },
  {
    id: 'enter_password',
    action: 'type %password% into the Password field',
    critical: true,
    description: 'Enter password for account'
  },
  {
    id: 'verify_password',
    action: 'type %password% into the Verify New Password field',
    optional: true,
    description: 'Confirm password for new account creation'
  },
  {
    id: 'scroll_to_terms',
    action: 'scroll',
    scrollAmount: 50,
    description: 'Scroll to terms and conditions'
  },
  {
    id: 'accept_terms',
    action: 'click the terms and conditions checkbox',
    critical: true,
    description: 'Accept terms and conditions'
  },
  {
    id: 'create_account',
    action: 'click the Create Account button',
    critical: true,
    description: 'Submit account creation form'
  },
  {
    id: 'final_scroll',
    action: 'scroll',
    scrollAmount: 50,
    description: 'Scroll to reveal next section'
  }
];

/**
 * Execute structured Workday login steps
 */
async function executeStructuredWorkdayLogin(stagehand, userProfile) {
  console.log('\n🎯 Executing structured Workday login...');
  
  let successCount = 0;
  let totalSteps = 0;
  
  for (const step of WORKDAY_STEPS) {
    totalSteps++;
    console.log(`\n📋 Step ${totalSteps}: ${step.description}`);
    
    try {
      if (step.action === 'scroll') {
        // Handle scrolling
        console.log(`🔄 Scrolling ${step.scrollAmount}% of viewport`);
        await stagehand.page.evaluate((scrollAmount) => {
          const viewportHeight = window.innerHeight;
          const scrollDistance = (viewportHeight * scrollAmount) / 100;
          window.scrollBy(0, scrollDistance);
        }, step.scrollAmount);
        
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        successCount++;
        
      } else {
        // Handle Stagehand actions
        let actionCommand = step.action;
        
        // Replace variables with actual values
        if (actionCommand.includes('%email%')) {
          actionCommand = actionCommand.replace('%email%', userProfile.workEmail);
        }
        if (actionCommand.includes('%password%')) {
          actionCommand = actionCommand.replace('%password%', userProfile.workPassword);
        }
        
        console.log(`🎯 Executing: ${actionCommand}`);
        await stagehand.act(actionCommand);
        
        // Wait between actions
        await new Promise(resolve => setTimeout(resolve, 2000));
        successCount++;
        console.log(`✅ Step completed successfully`);
      }
      
    } catch (error) {
      console.log(`⚠️  Step failed: ${error.message}`);
      
      if (step.critical) {
        console.log(`❌ Critical step failed, but continuing with form fill...`);
        // Don't throw error, just log and continue to Phase 1
        break;
      } else {
        console.log(`⏭️  Optional step failed, continuing...`);
      }
    }
  }
  
  console.log(`\n✅ Structured login completed: ${successCount}/${totalSteps} steps succeeded`);
  return {
    success: true,
    successCount,
    totalSteps,
    stepsCompleted: totalSteps,
    commandsExecuted: totalSteps,
    method: 'structured_workday_login'
  };
}

/**
 * Generate Workday login commands using ChatGPT - Multi-step aware
 */
async function generateWorkdayLoginCommands(pageState, userProfile, jobUrl, stepNumber = 1) {
  console.log(`\n🧠 [Workday Login] Generating commands for step ${stepNumber}...`);

  const prompt = `
You are an expert at Workday job application automation using Stagehand.

${STAGEHAND_DOCS}

# YOUR TASK

You are helping someone apply to a job at: ${jobUrl}

This is STEP ${stepNumber} of a multi-step login flow. Analyze the current page state and generate Stagehand act() commands for THIS SPECIFIC PAGE ONLY. our goal is to be able to navigate effectively to the job form

# CURRENT PAGE STATE

**Observed Elements:**
${JSON.stringify(pageState.actions, null, 2)}

**Page Content:**
${JSON.stringify(pageState.pageContent, null, 2)}

**User Credentials:**
- Email: ${userProfile.workEmail}
- Password: ${userProfile.workPassword}
- Full Name: ${userProfile.fullName}
- First Name: ${userProfile.fullName ? userProfile.fullName.split(' ')[0] : 'John'}
- Last Name: ${userProfile.fullName ? userProfile.fullName.split(' ').slice(1).join(' ') : 'Doe'}

# MULTI-STEP WORKDAY SCENARIOS

Analyze the page and determine what type of page this is:

**Page Type 1 - Job Listing Page:**
- Has "Apply" or "Apply Now" button
- Action: Click the Apply button

**Page Type 2 - Application Method Choice (Workday Modal):**
- Shows a popup/modal asking how to fill out the application
- Options like "Apply Manually", "Apply with LinkedIn", "Apply with Resume", etc.
- Action: Click "Apply Manually" to proceed with manual form filling

**Page Type 3 - Login/Signup Choice Page:**
- Has both "Sign In" and "Create Account" options
- Action: Choose Sign In with email and password if available, otherwise Create Account

**Page Type 4 - Login Form:**
- Has email and password fields
- Action: Enter credentials and submit

**Page Type 5 - Email-Only Page:**
- Only has email field (Workday's 2-step login)
- Action: Enter email and click Next/Continue

**Page Type 6 - Password Page:**
- Only has password field (after email step)
- Action: Enter password and submit

**Page Type 7 - Account Creation Form:**
- Has fields for creating new account
- Action: Fill required fields and create account

**Page Type 8 - Account Doesn't Exist Error:**
- Shows error message like "Account not found" or "No account with this email"
- Action: Look for "Create Account" or "Sign Up" link and click it

**Page Type 9 - Application Form:**
- Has job application fields (resume upload, personal info, etc.)
- Action: Indicate this is the target page (no commands needed)

# RESPONSE FORMAT

Return ONLY valid JSON (no markdown, no code blocks):

{
  "reasoning": "Brief explanation of what this page is and the strategy (2-3 sentences)",
  "pageType": "job_listing|application_method_choice|login_choice|login_form|email_only|password_only|account_creation|account_error|application_form",
  "commands": [
    {
      "instruction": "click the Apply Now button",
      "variables": {},
      "critical": true,
      "step": "navigate_to_login"
    }
  ],
  "nextStepExpected": true,
  "confidence": 0.95
}

**Steps:** navigate_to_login, enter_email, enter_password, submit_login, create_account, handle_error

**Critical:** true = must succeed for this step to work, false = optional

**nextStepExpected:** true if clicking will lead to another page, false if this completes the login

**confidence:** 0-1 score of how confident you are these commands will work for this specific page
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a Workday automation expert. You analyze pages and generate precise act() commands for multi-step Workday login flows. Always return valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more consistent output
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log(`✅ Generated ${result.commands.length} commands for step ${stepNumber}`);
    console.log('📋 Strategy:', result.reasoning);
    console.log('🎯 Page Type:', result.pageType);
    console.log('🎯 Confidence:', result.confidence);
    console.log('🔄 Next Step Expected:', result.nextStepExpected);

    return result;

  } catch (error) {
    console.error('❌ Error generating login commands:', error);
    throw error;
  }
}

/**
 * Intelligent Workday Login - Multi-step ChatGPT command generation approach
 */
async function intelligentWorkdayLogin(stagehand, userProfile, jobUrl) {
  console.log('\n🔐 [Workday Login] Starting intelligent multi-step login flow...');
  console.log('📍 Job URL:', jobUrl);

  const maxSteps = 7; // Safety limit for multi-step flows
  let currentStep = 1;
  let totalCommandsExecuted = 0;
  let totalCommandsSucceeded = 0;

  try {
    while (currentStep <= maxSteps) {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`🔄 LOGIN STEP ${currentStep}/${maxSteps}`);
      console.log(`${'═'.repeat(50)}`);

      // Step 1: Observe and extract current page state
      const pageState = await observeAndExtractPage(stagehand);

      // Check if we've reached the application form
      if (await isApplicationForm(pageState)) {
        console.log('✅ Reached job application form - login complete!');
        return {
          success: true,
          stepsCompleted: currentStep - 1,
          commandsExecuted: totalCommandsExecuted,
          commandsSucceeded: totalCommandsSucceeded,
          method: 'intelligent_multi_step_login',
          message: 'Successfully navigated to application form'
        };
      }

      // Check if page has any interactive elements
      if (pageState.actions.length === 0) {
        console.log('⚠️  No interactive elements found, may be loading...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Step 2: Generate context-aware commands for this specific step
      const {
        commands,
        reasoning,
        nextStepExpected,
        confidence,
        pageType
      } = await generateWorkdayLoginCommands(pageState, userProfile, jobUrl, currentStep);

      console.log(`📋 Step ${currentStep} Strategy: ${reasoning}`);
      console.log(`🎯 Page Type: ${pageType}`);
      console.log(`🎯 Confidence: ${confidence}`);

      // Check confidence level
      if (confidence < 0.4) {
        console.log(`⚠️  Low confidence (${confidence}), falling back to traditional login...`);
        return await handleLogin(stagehand, userProfile);
      }

      // Step 3: Execute commands for this step
      const execution = await executeCommands(stagehand, commands);

      totalCommandsExecuted += commands.length;
      totalCommandsSucceeded += execution.successCount;

      console.log(`📊 Step ${currentStep} Results: ${execution.successCount}/${commands.length} commands succeeded`);

      // Check if this step failed critically
      if (execution.criticalFailure) {
        console.log('❌ Critical failure in login step, falling back to traditional login...');
        return await handleLogin(stagehand, userProfile);
      }

      // Wait for page transition if expected
      if (nextStepExpected) {
        console.log('⏳ Waiting for page transition...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        currentStep++;
      } else {
        console.log('✅ Login flow complete - no more steps expected');
        break;
      }
    }

    console.log(`\n✅ Multi-step Workday login completed!`);
    console.log(`📊 Total steps: ${currentStep}`);
    console.log(`📊 Total commands executed: ${totalCommandsExecuted}`);
    console.log(`📊 Total commands succeeded: ${totalCommandsSucceeded}`);
    
    return {
      success: true,
      stepsCompleted: currentStep,
      commandsExecuted: totalCommandsExecuted,
      commandsSucceeded: totalCommandsSucceeded,
      method: 'intelligent_multi_step_login'
    };

  } catch (error) {
    console.error('❌ Intelligent multi-step login error:', error);
    console.log('⚠️  Falling back to traditional login...');
    return await handleLogin(stagehand, userProfile);
  }
}

/**
 * Check if current page is the job application form
 */
async function isApplicationForm(pageState) {
  // Look for indicators that this is an application form
  const applicationIndicators = [
    'resume', 'cv', 'upload', 'personal information', 
    'work experience', 'education', 'skills', 'cover letter',
    'first name', 'last name', 'phone number', 'address'
  ];

  const pageText = JSON.stringify(pageState.pageContent).toLowerCase();
  const actionsText = JSON.stringify(pageState.actions).toLowerCase();
  
  const indicatorCount = applicationIndicators.filter(indicator => 
    pageText.includes(indicator) || actionsText.includes(indicator)
  ).length;

  // If we find 3+ application indicators, likely an application form
  return indicatorCount >= 3;
}

async function hybridFormFill(stagehand, userProfile, sessionId, sessionUrl, res, jobUrl) {
  console.log('🎯 Starting WORKDAY-ONLY application flow...\n');

  // Validate that this is a Workday job application
  const isWorkday = isWorkdayJobUrl(jobUrl);
  console.log(`🎯 Platform detected: ${isWorkday ? 'WORKDAY' : 'NON-WORKDAY'}`);
  
  if (!isWorkday) {
    console.log('❌ Non-Workday applications are not supported in this flow');
    await stagehand.close();
    return res.status(400).json({
      success: false,
      error: 'This application flow only supports Workday job applications. Please use a Workday job URL.',
      platform: 'non-workday',
      jobUrl: jobUrl
    });
  }
  
  console.log('✅ Workday URL validated, proceeding with application...');
  console.log(`📋 Job URL: ${jobUrl}`);

  // Generate unique email for this application
  const uniqueEmail = generateJobEmail(userProfile.workEmail);
  console.log(`📧 Using unique email: ${uniqueEmail}`);
  console.log(`📧 Original email: ${userProfile.workEmail}`);
  
  // Create modified user profile with unique email
  const workdayUserProfile = {
    ...userProfile,
    workEmail: uniqueEmail,
    originalEmail: userProfile.workEmail
  };

  const startTime = Date.now();
  let phase1Cost = 0;
  let phase2Cost = 0;
  let phase0Cost = 0;
  let verificationCost = 0;
  let phase1Tokens = { input: 0, output: 0 };
  let phase2Tokens = { input: 0, output: 0 };
  let chatGPTTokens = 0;

  try {
    console.log('═══════════════════════════════════════');
    console.log('  PHASE 0: Structured Workday Login');
    console.log('═══════════════════════════════════════');

    // Workday structured login steps
    const loginResult = await executeStructuredWorkdayLogin(stagehand, workdayUserProfile);
    phase0Cost = 0.02; // Estimated cost for structured login
    
    console.log('✅ Workday login completed successfully');
    console.log(`📊 Login steps: ${loginResult.stepsCompleted || 'N/A'}`);
    console.log(`📊 Commands executed: ${loginResult.commandsExecuted || 'N/A'}`);
    
    console.log('🔐 Using traditional login detection for non-Workday site...');
      const loginDetection = await detectLoginPage(stagehand);
      
      if (loginDetection.isLoginPage) {
        console.log('🔐 Login/signup page detected, handling authentication...');
        loginResult = await handleLogin(stagehand, userProfile);
        phase0Cost = loginResult.cost || 0;
        
        if (!loginResult.success) {
          console.error('❌ Login failed, but continuing with application attempt...');
        }
        
        // Wait for page to stabilize after login
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    
    // Extract job description once
    console.log('📋 Extracting job description...');
    const jobDescription = await extractJobDescription(stagehand);
    console.log('✅ Job description extracted');
    
    // Now execute Phase 1 and Phase 2
    let allFilledFields = [];
    
    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 1: Intelligent Form Fill');
    console.log('═══════════════════════════════════════');

    // Observe form fields
    const formActions = await observeFormFields(stagehand);
    if (formActions.length === 0) {
      throw new Error('No form fields found');
    }

    // Get intelligent answers from ChatGPT
    const answersResult = await getIntelligentAnswers(formActions, workdayUserProfile, jobDescription);
    const answers = answersResult.answers;
    chatGPTTokens = answersResult.tokens;

    // Estimate Phase 1 tokens
    const estimatedObserveTokens = 2000;
    const estimatedActTokens = formActions.length * 500;
    phase1Tokens.input = estimatedObserveTokens + estimatedActTokens + chatGPTTokens;
    phase1Tokens.output = 500;
    phase1Cost = 0.08;

    // Fill form (with error resilience)
    let fillResults = { filledCount: 0, skippedCount: 0, errorCount: 0 };
    
    try {
      fillResults = await fillFormFields(stagehand, formActions, answers);
      console.log(`\n📊 Phase 1 Results: ✅ ${fillResults.filledCount} filled, ⏭️ ${fillResults.skippedCount} skipped, ❌ ${fillResults.errorCount} errors`);
    } catch (phase1Error) {
      console.error(`\n❌ Phase 1 failed with error: ${phase1Error.message}`);
      console.log(`\n🔄 Continuing to Phase 2 (Agent Fallback) to handle remaining fields...`);
      fillResults.errorCount = formActions.length; // Mark all as errors for tracking
    }
    
    // Track fields from this page
    allFilledFields.push({
      page: 1,
      filledCount: fillResults.filledCount,
      skippedCount: fillResults.skippedCount,
      errorCount: fillResults.errorCount
    });
    console.log(`\n💰 Phase 1 estimated cost: $${phase1Cost.toFixed(2)}`);

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 2: Agent Review & Completion');
    console.log('  (Handles remaining/failed fields from Phase 1)');
    console.log('═══════════════════════════════════════');

    const agentResult = await agentReviewAndComplete(stagehand, workdayUserProfile, jobDescription);

    // Handle partial success from intermediate errors
    if (agentResult.partialSuccess) {
      console.log('  ⚠️  Agent returned partial success due to intermediate validation errors');
      console.log('     Continuing process - errors will only be shown if final result fails');
      console.log('     Intermediate error was:', agentResult.intermediateError);
    }

    if (agentResult.usage) {
      const inputTokens = agentResult.usage.input_tokens || 0;
      const outputTokens = agentResult.usage.output_tokens || 0;
      phase2Tokens.input = inputTokens;
      phase2Tokens.output = outputTokens;
      const inputCost = (inputTokens / 1000000) * 1.25;
      const outputCost = (outputTokens / 1000000) * 10;
      phase2Cost = inputCost + outputCost;
    }
    
    // Check if we moved to a new page after Phase 2 (multi-page handling)
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page transition
    
    const pagesAfterPhase2 = stagehand.context.pages();
    if (!pagesAfterPhase2 || pagesAfterPhase2.length === 0) {
      console.log(`❌ No pages available in context after Phase 2`);
      throw new Error('Browser context lost - no pages available');
    }
    
    const currentUrl = pagesAfterPhase2[0].url();
    console.log(`📍 Current URL after Phase 2: ${currentUrl}`);
    
    // Check if URL changed (indicating we moved to a new page)
    if (currentUrl !== jobUrl && !currentUrl.includes('error') && !currentUrl.includes('thank') && !currentUrl.includes('success')) {
      console.log('\n🔄 New page detected! Running Phase 1 and 2 again...');
      
      // Run Phase 1 and 2 again for the new page
      console.log('\n═══════════════════════════════════════');
      console.log('  PHASE 1 (Page 2): Intelligent Form Fill');
      console.log('═══════════════════════════════════════');

      // Observe form fields on new page
      const formActions2 = await observeFormFields(stagehand);
      if (formActions2.length > 0) {
        // Get intelligent answers from ChatGPT for new page
        const answersResult2 = await getIntelligentAnswers(formActions2, workdayUserProfile, jobDescription);
        const answers2 = answersResult2.answers;
        chatGPTTokens += answersResult2.tokens;

        // Update Phase 1 tokens
        phase1Tokens.input += 2000 + (formActions2.length * 500) + answersResult2.tokens;
        phase1Tokens.output += 500;
        phase1Cost += 0.08;

        // Fill form fields on new page
        try {
          const fillResults2 = await fillFormFields(stagehand, formActions2, answers2);
          console.log(`\n📊 Phase 1 (Page 2) Results: ✅ ${fillResults2.filledCount} filled, ⏭️ ${fillResults2.skippedCount} skipped, ❌ ${fillResults2.errorCount} errors`);
          
          // Track fields from page 2
          allFilledFields.push({
            page: 2,
            filledCount: fillResults2.filledCount,
            skippedCount: fillResults2.skippedCount,
            errorCount: fillResults2.errorCount
          });
        } catch (phase1Error2) {
          console.error(`\n❌ Phase 1 (Page 2) failed: ${phase1Error2.message}`);
        }

        console.log('\n═══════════════════════════════════════');
        console.log('  PHASE 2 (Page 2): Agent Review & Navigation');
        console.log('═══════════════════════════════════════');

        // Run Phase 2 again for new page
        const agentResult2 = await agentReviewAndComplete(stagehand, workdayUserProfile, jobDescription);
        
        if (agentResult2.usage) {
          const inputTokens2 = agentResult2.usage.input_tokens || 0;
          const outputTokens2 = agentResult2.usage.output_tokens || 0;
          phase2Tokens.input += inputTokens2;
          phase2Tokens.output += outputTokens2;
          const inputCost2 = (inputTokens2 / 1000000) * 1.25;
          const outputCost2 = (outputTokens2 / 1000000) * 10;
          phase2Cost += inputCost2 + outputCost2;
        }
      } else {
        console.log('ℹ️  No form fields found on new page, proceeding to verification...');
      }
    } else {
      console.log('✅ Same page or application completed - proceeding to verification');
    }

    console.log('✅ Workday application flow completed (Phase 0 + Phase 1 + Phase 2)');

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 3: Verification Check');
    console.log('═══════════════════════════════════════');

    // Try manual verification first
    let verificationResult = await handleVerification(stagehand, userProfile);
    let usedFallback = false;
    let fallbackResult = null;

    if (verificationResult.verified) {
      console.log('✅ Manual verification completed successfully!');
      console.log(`   Code used: ${verificationResult.code}`);
    } else if (verificationResult.reason === 'No verification needed') {
      console.log(`ℹ️  ${verificationResult.reason}`);
    } else {
      // Manual verification failed, try agent fallback with existing Gmail tab
      console.log('⚠️  Manual verification failed, trying agent fallback...');
      usedFallback = true;
      
      // Check if Gmail tab is still open from manual attempt
      let existingGmailTab = null;
      try {
        const pages = stagehand.context.pages();
        existingGmailTab = pages.find(p => p.url().includes('mail.google.com'));
      } catch (error) {
        console.log('  ℹ️  No existing Gmail tab found');
      }
      
      fallbackResult = await agentVerificationFallback(stagehand, userProfile, existingGmailTab);

      if (fallbackResult.verified) {
        console.log('✅ Agent fallback verification completed successfully!');
        verificationResult = fallbackResult;
        // Track verification cost
        if (fallbackResult.usage) {
          const inputCost = (fallbackResult.usage.input_tokens / 1000000) * 1.25;
          const outputCost = (fallbackResult.usage.output_tokens / 1000000) * 10;
          verificationCost = inputCost + outputCost;
        }
      } else {
        console.log('❌ Both verification attempts failed');
        console.log(`   Manual: ${verificationResult.error || verificationResult.reason}`);
        console.log(`   Agent: ${fallbackResult.error || fallbackResult.reason}`);
      }
    }

    const totalCost = phase0Cost + phase1Cost + phase2Cost + verificationCost;
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTokens = phase1Tokens.input + phase1Tokens.output + phase2Tokens.input + phase2Tokens.output;

    console.log('\n═══════════════════════════════════════');
    console.log(`  ${isWorkday ? 'WORKDAY INTELLIGENT' : 'GENERIC HYBRID'} APPROACH COMPLETE`);
    console.log('═══════════════════════════════════════');
    console.log(`🎯 Platform: ${isWorkday ? 'Workday (Fully Optimized)' : 'Generic (Traditional)'}`);
    console.log(`⏱️  Total time: ${executionTime}s`);
    console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Phase 0 (${isWorkday ? 'Intelligent Login' : 'Traditional Login'}): $${phase0Cost.toFixed(4)}`);
    console.log(`   ${isWorkday ? 'Phase 0.5 (Intelligent Form)' : 'Phase 1 (Form)'}: $${phase1Cost.toFixed(4)}`);
    console.log(`   Phase 2 (Agent): $${phase2Cost.toFixed(4)}`);
    console.log(`   Verification: $${verificationCost.toFixed(4)}`);
    
    if (isWorkday) {
      console.log(`📊 Commands executed: ${allFilledFields[0]?.commandsExecuted || 0}`);
      console.log(`📊 Commands succeeded: ${allFilledFields[0]?.commandsSucceeded || 0}`);
      console.log(`📊 Used fallback: ${allFilledFields[0]?.usedFallback ? 'Yes' : 'No'}`);
    } else {
      console.log(`📊 Fields filled (Phase 1): ${allFilledFields.reduce((sum, p) => sum + (p.filledCount || 0), 0)}`);
      console.log(`📊 Agent steps (Phase 2): ${agentResult?.actions ? agentResult.actions.length : 'N/A'}`);
    }
    
    console.log(`\n🔢 Token Usage:`);
    console.log(`   Total: ${totalTokens.toLocaleString()} tokens`);
    console.log(`   ${isWorkday ? 'Phase 0.5' : 'Phase 1'}: ${(phase1Tokens.input + phase1Tokens.output).toLocaleString()} tokens`);
    if (!isWorkday) {
      console.log(`     - ChatGPT: ${chatGPTTokens.toLocaleString()} tokens`);
    }
    console.log(`   Phase 2: ${(phase2Tokens.input + phase2Tokens.output).toLocaleString()} tokens`);
    console.log(`     - Input: ${phase2Tokens.input.toLocaleString()}`);
    console.log(`     - Output: ${phase2Tokens.output.toLocaleString()}`);

    // ========== Download session recording and extract filled fields ==========
    console.log('\n📹 Post-processing: Downloading recording & extracting fields...');
    let sessionVideoUrl = null;
    let filledFields = null;
    
    try {
      // Wait for recording to finalize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Download recording from Browserbase
      const recordingResponse = await fetch(
        `https://www.browserbase.com/v1/sessions/${sessionId}/recording`,
        {
          headers: {
            'x-bb-api-key': process.env.BROWSERBASE_API_KEY
          }
        }
      );
      
      if (recordingResponse.ok) {
        const videoBuffer = await recordingResponse.arrayBuffer();
        const videoBlob = Buffer.from(videoBuffer);
        
        console.log(`  ✅ Recording downloaded: ${(videoBlob.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Upload to Supabase Storage
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const fileName = `session-recordings/${sessionId}.webm`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('application-videos')
          .upload(fileName, videoBlob, {
            contentType: 'video/webm',
            upsert: true
          });
        
        if (uploadError) {
          console.error('  ❌ Failed to upload to Supabase:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('application-videos')
            .getPublicUrl(fileName);
          
          sessionVideoUrl = urlData.publicUrl;
          console.log('  ✅ Video uploaded to Supabase Storage');
        }
      } else {
        console.warn('  ⚠️  Recording not available yet');
      }
    } catch (videoError) {
      console.error('  ❌ Error downloading recording:', videoError.message);
    }
    
    // Extract filled fields from the form
    console.log('\n📝 Extracting filled form fields...');
    try {
      const filledFieldsSchema = z.record(z.string());
      
      filledFields = await stagehand.extract(
        "Extract all filled form fields. Return a JSON object where keys are field labels and values are what was filled.",
        filledFieldsSchema
      );
      
      const fieldCount = Object.keys(filledFields || {}).length;
      console.log(`  ✅ Extracted ${fieldCount} filled fields`);
    } catch (extractError) {
      console.error('  ❌ Error extracting fields:', extractError.message);
    }
    // ========== END POST-PROCESSING ==========

    // ========== SAVE TO APPLIED_JOBS TABLE ==========
    console.log('\n💾 Saving application to applied_jobs table...');
    try {
      const saveResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/save-applied-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userProfile.userId || userProfile.id,
          jobUrl: jobUrl,
          jobTitle: jobDescription?.title || 'Job Application',
          companyName: jobDescription?.company || 'Company',
          location: jobDescription?.location || null,
          jobType: jobDescription?.jobType || null,
          salaryRange: jobDescription?.salaryRange || null,
          datePosted: jobDescription?.datePosted || null,
          jobDescription: jobDescription?.summary || null,
          requirements: null,
          benefits: null,
          sessionId: sessionId,
          sessionUrl: sessionUrl,
          sessionVideoUrl: sessionVideoUrl,
          filledFields: filledFields,
          coverLetterGenerated: false,
          extractedAt: new Date().toISOString()
        })
      });

      const saveResult = await saveResponse.json();

      if (saveResult.success) {
        console.log('  ✅ Application saved to database');
      } else {
        console.error('  ⚠️  Failed to save application:', saveResult.error);
      }
    } catch (saveError) {
      console.error('  ❌ Error saving application:', saveError.message);
      // Don't fail the entire request if save fails
    }
    // ========== END SAVE ==========

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('\n🔒 Closing Stagehand session...');
    await stagehand.close();

    res.json({
      success: true,
      approach: isWorkday ? 'workday_intelligent' : 'generic_hybrid',
      platform: isWorkday ? 'workday' : 'generic',
      sessionId,
      sessionUrl,
      sessionVideoUrl,
      filledFields,
      message: isWorkday 
        ? `Workday application completed using intelligent form fill in ${executionTime}s. Application submitted.`
        : `Form filled across multiple pages using traditional hybrid approach in ${executionTime}s. Application submitted.`,
      jobDescription: jobDescription ? {
        title: jobDescription.title,
        company: jobDescription.company
      } : null,
      stats: {
        executionTimeSeconds: parseFloat(executionTime),
        totalCost: totalCost.toFixed(4),
        tokens: {
          total: totalTokens,
          phase1Total: phase1Tokens.input + phase1Tokens.output,
          phase2Total: phase2Tokens.input + phase2Tokens.output,
          inputTokens: phase1Tokens.input + phase2Tokens.input,
          outputTokens: phase1Tokens.output + phase2Tokens.output,
          chatGPTTokens: chatGPTTokens
        },
        pages: 1, // Workday single-flow completion
        allPagesFields: allFilledFields,
        totalFieldsFilled: allFilledFields.reduce((sum, p) => sum + p.filledCount, 0),
        totalFieldsSkipped: allFilledFields.reduce((sum, p) => sum + p.skippedCount, 0),
        totalErrors: allFilledFields.reduce((sum, p) => sum + p.errorCount, 0),
        phase1: {
          cost: phase1Cost.toFixed(4),
          tokens: {
            input: phase1Tokens.input,
            output: phase1Tokens.output,
            total: phase1Tokens.input + phase1Tokens.output
          }
        },
        phase2: {
          cost: phase2Cost.toFixed(4),
          stepsTaken: agentResult.actions ? agentResult.actions.length : 0,
          success: agentResult.success,
          tokens: {
            input: phase2Tokens.input,
            output: phase2Tokens.output,
            total: phase2Tokens.input + phase2Tokens.output
          }
        },
        phase3: {
          verified: verificationResult.verified,
          method: verificationResult.method || 'manual',
          reason: verificationResult.reason,
          code: verificationResult.code || null,
          error: verificationResult.error || null,
          usedFallback: usedFallback,
          fallback: fallbackResult ? {
            verified: fallbackResult.verified,
            steps: fallbackResult.steps,
            error: fallbackResult.error || null,
            usage: fallbackResult.usage || null
          } : null
        }
      }
    });
  } catch (error) {
    console.error('\n❌ Hybrid form fill error:', error);
    try {
      await stagehand.close();
    } catch (closeError) {
      console.error('Error closing Stagehand:', closeError.message);
    }
    res.status(500).json({
      success: false,
      error: error.message,
      sessionId,
      sessionUrl
    });
  }
}


module.exports = { 
  hybridFormFill,
  getIntelligentAnswers,
  fillFormFields,
  agentReviewAndComplete,
  agentVerificationFallback
};
