const OpenAI = require('openai');
const { z } = require('zod');

const { detectLoginPage, handleLogin } = require('./login_handler');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
Email: ${userProfile.email}
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
- For dropdowns, choose the most appropriate option
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

    try {
      const descLower = description.toLowerCase();

      // DROPDOWN LOGIC: 2-step approach
      if (descLower.includes('dropdown') || descLower.includes('select') || action.method === 'selectOption') {
        console.log(`  🔽 Filling dropdown: ${description.substring(0, 50)}...`);

        try {
          // Step 1: Click to open dropdown
          await stagehand.act(`click the ${description}`, {
            model: "openai/gpt-4o"
          });

          await new Promise(resolve => setTimeout(resolve, 500));

          // Step 2: Select the option
          await stagehand.act(`select "${answer}"`, {
            model: "openai/gpt-4o"
          });

          filledCount++;
          console.log(`    ✅ Selected: ${answer}`);

        } catch (dropdownError) {
          console.log(`    ⚠️  Dropdown failed, leaving empty`);
          skippedCount++;
        }

      }
      // TEXT/TEXTAREA LOGIC
      else {
        console.log(`  📝 Filling: ${description.substring(0, 50)}...`);

        await stagehand.act(`enter "${answer}" in the ${description}`, {
          model: "openai/gpt-4o"
        });

        filledCount++;
        console.log(`    ✅ Entered: ${answer.substring(0, 50)}${answer.length > 50 ? '...' : ''}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`  ❌ Error filling ${description}:`, error.message);
      errorCount++;
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
    // Check if verification is needed on current page
    const pageText = await stagehand.page.evaluate(() => document.body.innerText.toLowerCase());
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
    const applicationUrl = stagehand.page.url();
    console.log(`  💾 Saved application URL: ${applicationUrl}`);

    // Step 1: Navigate to Gmail
    console.log('\n  📬 Step 1: Navigating to Gmail...');
    await stagehand.page.goto('https://mail.google.com', { waitUntil: 'networkidle' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Check if already logged in, if not, log in
    console.log('  🔐 Step 2: Logging into Gmail...');
    const gmailEmail = userProfile.workspaceEmail;
    const gmailPassword = userProfile.workspacePassword;

    // Use observe to check if login is needed
    const loginElements = await stagehand.observe(
      "Find email input field, password input field, or sign in button. Only return actions if Gmail login page is shown."
    );

    if (loginElements.length > 0) {
      console.log('    🔑 Gmail login required, entering credentials...');

      // Fill email
      await stagehand.act(`Enter "${gmailEmail}" in the email input field and press Enter or click Next`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fill password
      await stagehand.act(`Enter "${gmailPassword}" in the password input field and press Enter or click Next`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('    ✅ Gmail login completed');
    } else {
      console.log('    ℹ️  Already logged into Gmail');
    }

    // Step 3: Find and open the verification email
    console.log('\n  🔍 Step 3: Finding verification email...');
    await stagehand.act(
      "Find and click on the most recent email that contains a verification code, confirmation code, or is from the company/service we just signed up for. Look for emails in the inbox."
    );
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Extract the verification code
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

    // Step 5: Return to application
    console.log('\n  🔙 Step 5: Returning to application...');
    await stagehand.page.goto(applicationUrl, { waitUntil: 'networkidle' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Enter the verification code
    console.log('  ⌨️  Step 6: Entering verification code...');
    await stagehand.act(
      `Enter the verification code "${verificationCode}" in the verification code input field and submit it. Click the submit or verify button.`
    );
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('  ✅ Verification completed successfully!');

    return {
      verified: true,
      code: verificationCode,
      reason: 'Verification completed'
    };

  } catch (error) {
    console.error('  ❌ Verification handler error:', error.message);
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
async function agentVerificationFallback(stagehand, userProfile) {
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

    const instruction = `Check if this page is asking for a verification code, confirmation code, or email verification.

If verification IS needed:
1. Note the current page URL (you'll need to return here)
2. Navigate to https://mail.google.com
3. Log in to Gmail using:
   - Email: ${userProfile.workspaceEmail}
   - Password: ${userProfile.workspacePassword}
4. Find the most recent email with a verification code or verification link for the application/service we just signed up for
5. Extract the verification code from the email (it's usually a 4-8 digit or alphanumeric code)
6. Navigate back to the application page
7. Enter the verification code in the input field
8. Click submit/verify button

If verification is NOT needed:
- Simply confirm no verification is required and stop

IMPORTANT:
- Be careful to use the correct email and password
- Look for the most recent email in the inbox
- The verification code is usually displayed prominently in the email
- After entering the code, make sure to submit/verify it`;

    console.log('  🚀 Starting agent verification flow...');

    const result = await agent.execute({
      instruction,
      maxSteps: 25,
      highlightCursor: false
    });

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
1. Review the form to see which fields are filled vs empty
2. Fill any empty/missing fields using the user profile and job description provided
3. Ensure all required fields have appropriate values
4. Click the NEXT button to proceed to the next page (if available)
5. If no NEXT button exists, click the SUBMIT button to submit the application

IMPORTANT:
- Only fill fields that are empty or incomplete
- Do not modify fields that are already filled correctly
- For fields without direct information in the user profile, INFER reasonable answers based on:
  * The user's work experience, education, and skills
  * The job description and requirements
  * The user's best interests while remaining truthful
- Be efficient - focus on completing the form accurately
- ALWAYS click NEXT (priority) or SUBMIT (if no Next button) when done filling`
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
- Email: ${userProfile.email}
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
3. For questions without direct answers in the profile:
   - Use the job description and user's background to infer reasonable, truthful answers
   - Write responses that represent the user's best interests while being honest
4. For essay/paragraph questions about motivation or interest, write 2-3 professional sentences that:
   - Reference the specific company and role
   - Connect the user's relevant experience to job requirements
   - Show genuine interest based on the job context
5. For yes/no or dropdown questions, choose the most appropriate answer based on the profile
6. After filling all fields, look for a NEXT button (check for buttons labeled "Next", "Continue", "Next Page", "Next Step")
7. If NEXT button exists: Click it to proceed to the next page
8. If NO NEXT button exists: Look for SUBMIT button (labeled "Submit", "Submit Application", "Apply Now") and click it
9. If the page says "Review your application" or similar, click the SUBMIT button`;

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
    return { success: false, error: error.message };
  }
}

async function hybridFormFill(stagehand, userProfile, sessionId, sessionUrl, res, jobUrl) {
  console.log('🔄 Starting HYBRID form filling approach...\n');

  const startTime = Date.now();
  let phase1Cost = 0;
  let phase2Cost = 0;
  let phase1Tokens = { input: 0, output: 0 };
  let phase2Tokens = { input: 0, output: 0 };
  let chatGPTTokens = 0;

  try {
    console.log('═══════════════════════════════════════');
    console.log('  PHASE 0: Login Detection & Handling');
    console.log('═══════════════════════════════════════');

    // Check if login/signup is required
    const loginDetection = await detectLoginPage(stagehand);
    
    if (loginDetection.isLoginPage) {
      console.log('🔐 Login/signup page detected, handling authentication...');
      const loginResult = await handleLogin(stagehand, userProfile);
      
      if (!loginResult.success) {
        console.error('❌ Login failed, but continuing with application attempt...');
      }
      
      // Wait for page to stabilize after login
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    // Extract job description once (same for all pages)
    console.log('📋 Extracting job description...');
    const jobDescription = await extractJobDescription(stagehand);
    console.log('✅ Job description extracted');
    
        // Multi-page form handling: Loop through pages
    let allFilledFields = [];
    let pageNumber = 1;
    let continueToNextPage = true;
    
    while (continueToNextPage) {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`  PAGE ${pageNumber}: Form Filling`);
      console.log(`${'═'.repeat(50)}`);
      
      const page = stagehand.context.pages()[0];
      const urlBeforePhase2 = page.url();
      

      console.log('═══════════════════════════════════════');
      console.log('  PHASE 1: Traditional Stagehand');
      console.log('═══════════════════════════════════════');

      // Observe form fields
      const formActions = await observeFormFields(stagehand);
      if (formActions.length === 0) {
        throw new Error('No form fields found');
      }

      // Get intelligent answers from ChatGPT
      const answersResult = await getIntelligentAnswers(formActions, userProfile, jobDescription);
      const answers = answersResult.answers;
      chatGPTTokens = answersResult.tokens;

      // Estimate Phase 1 tokens
      const estimatedObserveTokens = 2000;
      const estimatedActTokens = formActions.length * 500;
      phase1Tokens.input = estimatedObserveTokens + estimatedActTokens + chatGPTTokens;
      phase1Tokens.output = 500;
      phase1Cost = 0.08;

      // Fill form
      const fillResults = await fillFormFields(stagehand, formActions, answers);
      
      // Track fields from this page
      allFilledFields.push({
        page: pageNumber,
        filledCount: fillResults.filledCount,
        skippedCount: fillResults.skippedCount,
        errorCount: fillResults.errorCount
      });
      console.log(`\n💰 Phase 1 estimated cost: $${phase1Cost.toFixed(2)}`);

      console.log('\n═══════════════════════════════════════');
      console.log('  PHASE 2: Agent Review & Completion');
      console.log('═══════════════════════════════════════');

      const agentResult = await agentReviewAndComplete(stagehand, userProfile, jobDescription);

      if (agentResult.usage) {
        const inputTokens = agentResult.usage.input_tokens || 0;
        const outputTokens = agentResult.usage.output_tokens || 0;
        phase2Tokens.input = inputTokens;
        phase2Tokens.output = outputTokens;
        const inputCost = (inputTokens / 1000000) * 1.25;
        const outputCost = (outputTokens / 1000000) * 10;
        phase2Cost = inputCost + outputCost;
      }
      
      // Check if we moved to a new page (Next clicked) or stayed (Submit clicked)
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page transition
      
      const page2 = stagehand.context.pages()[0];
      const urlAfterPhase2 = page2.url();
      
      // Check if URL changed or if we can find new form fields
      const urlChanged = urlBeforePhase2 !== urlAfterPhase2;
      
      if (urlChanged) {
        console.log(`\n✅ Moved to next page (URL changed)`);
        console.log(`   Previous URL: ${urlBeforePhase2}`);
        console.log(`   New URL: ${urlAfterPhase2}`);
        console.log(`   Waiting 5 seconds for page to load...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        pageNumber++;
        continueToNextPage = true; // Continue to next page
      } else {
        console.log(`\n✅ Submit clicked or no more pages (URL unchanged)`);
        console.log(`   Final URL: ${urlAfterPhase2}`);
        continueToNextPage = false; // Exit loop
      }
    }
    
    console.log(`\n📊 Completed ${pageNumber} page(s)`);
    

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
      // Manual verification failed, try agent fallback
      console.log('⚠️  Manual verification failed, trying agent fallback...');
      usedFallback = true;
      fallbackResult = await agentVerificationFallback(stagehand, userProfile);

      if (fallbackResult.verified) {
        console.log('✅ Agent fallback verification completed successfully!');
        verificationResult = fallbackResult; // Use fallback result as main result
      } else {
        console.log('❌ Both verification attempts failed');
        console.log(`   Manual: ${verificationResult.error || verificationResult.reason}`);
        console.log(`   Agent: ${fallbackResult.error || fallbackResult.reason}`);
      }
    }

    const totalCost = phase1Cost + phase2Cost;
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTokens = phase1Tokens.input + phase1Tokens.output + phase2Tokens.input + phase2Tokens.output;

    console.log('\n═══════════════════════════════════════');
    console.log('  HYBRID APPROACH COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`⏱️  Total time: ${executionTime}s`);
    console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Phase 1: $${phase1Cost.toFixed(4)}`);
    console.log(`   Phase 2: $${phase2Cost.toFixed(4)}`);
    console.log(`📊 Fields filled (Phase 1): ${fillResults.filledCount}`);
    console.log(`📊 Agent steps (Phase 2): ${agentResult.actions ? agentResult.actions.length : 'N/A'}`);
    console.log(`\n🔢 Token Usage:`);
    console.log(`   Total: ${totalTokens.toLocaleString()} tokens`);
    console.log(`   Phase 1: ${(phase1Tokens.input + phase1Tokens.output).toLocaleString()} tokens`);
    console.log(`     - ChatGPT: ${chatGPTTokens.toLocaleString()} tokens`);
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
      approach: 'hybrid',
      sessionId,
      sessionUrl,
      sessionVideoUrl,
      filledFields,
      message: `Form filled across ${pageNumber} page(s) using hybrid approach in ${executionTime}s. Application submitted.`,
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
        pages: pageNumber,
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

module.exports = { hybridFormFill };
