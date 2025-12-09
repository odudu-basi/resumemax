const OpenAI = require('openai');
const { z } = require('zod');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * GPT-Based Pattern Recognition Job Application System
 *
 * This system uses GPT to intelligently navigate job applications by:
 * 1. Assessing the current page context
 * 2. Recognizing common patterns (auth, multi-step forms, review pages)
 * 3. Making intelligent decisions about next steps
 * 4. Adapting to different job application flows
 */

// =============================================================================
// SCHEMAS FOR STRUCTURED EXTRACTION
// =============================================================================

const PageContextSchema = z.object({
  pageType: z.enum([
    'initial_job_posting',
    'authentication',
    'application_form',
    'multi_step_form',
    'review_page',
    'verification_required',
    'confirmation_success',
    'error_blocked',
    'unknown'
  ]).describe("Type of page currently displayed"),

  currentStep: z.number().optional().describe("Current step number if multi-step form"),
  totalSteps: z.number().optional().describe("Total steps if multi-step form"),

  requiresAuth: z.boolean().describe("Does this page require login/signup?"),
  authType: z.enum(['login', 'signup', 'none']).optional().describe("Type of authentication needed"),

  visibleFields: z.array(z.object({
    label: z.string(),
    type: z.enum(['text', 'email', 'phone', 'textarea', 'dropdown', 'checkbox', 'radio', 'date', 'file', 'unknown']),
    required: z.boolean()
  })).describe("List of visible form fields"),

  buttons: z.array(z.object({
    text: z.string(),
    purpose: z.enum(['submit', 'next', 'continue', 'back', 'cancel', 'save_draft', 'unknown'])
  })).describe("Visible buttons and their purposes"),

  hasErrors: z.boolean().describe("Are there validation errors visible?"),
  errorMessages: z.array(z.string()).optional().describe("Any error messages shown"),

  needsVerification: z.boolean().describe("Does page indicate verification is needed (email/phone)?"),
  verificationMethod: z.enum(['email', 'phone', 'none']).optional(),

  isComplete: z.boolean().describe("Is this a confirmation/success page indicating completion?"),

  specialInstructions: z.string().optional().describe("Any special instructions or notices on the page")
});

const ActionPlanSchema = z.object({
  reasoning: z.string().describe("Explanation of why this action plan was chosen"),

  actions: z.array(z.object({
    type: z.enum(['extract', 'observe', 'act', 'wait', 'verify', 'stop']),
    command: z.string().describe("The exact command to execute"),
    variables: z.record(z.string()).optional().describe("Variables for act() commands"),
    reason: z.string().describe("Why this action is needed")
  })).describe("Sequential list of actions to take"),

  expectedOutcome: z.string().describe("What should happen after executing these actions"),

  fallbackPlan: z.string().optional().describe("What to do if actions fail")
});

// =============================================================================
// CORE INTELLIGENT PROMPT BUILDER
// =============================================================================

function buildIntelligentPrompt(userProfile, jobInfo, currentUrl, previousContext = null) {
  return `# INTELLIGENT JOB APPLICATION AGENT

## YOUR ROLE
You are an expert web automation agent specializing in job applications. You have deep understanding of:
- Common job application flows (Workday, Greenhouse, Lever, custom ATS systems)
- Authentication patterns (login, signup, SSO, social auth)
- Multi-step form navigation
- Field filling strategies
- Error recovery

## CURRENT CONTEXT

**Job Information:**
- Title: ${jobInfo.title || 'N/A'}
- Company: ${jobInfo.company || 'N/A'}
- URL: ${currentUrl}

**User Profile:**
\`\`\`json
{
  "fullName": "${userProfile.fullName}",
  "email": "${userProfile.workEmail}",
  "phone": "${userProfile.phone}",
  "location": "${userProfile.location}",
  "workAuthorized": ${userProfile.workAuthorized},
  "requiresSponsorship": ${userProfile.requiresSponsorship},
  "yearsOfExperience": ${userProfile.yearsOfExperience},
  "linkedinUrl": "${userProfile.linkedinUrl || 'N/A'}",
  "recentExperience": ${JSON.stringify((userProfile.workExperience || []).slice(0, 2).map(exp => `${exp.position} at ${exp.company}`))},
  "education": ${JSON.stringify((userProfile.education || []).slice(0, 2).map(edu => `${edu.degree} from ${edu.school}`))},
  "topSkills": ${JSON.stringify((userProfile.skills?.technical || []).slice(0, 8))}
}
\`\`\`

${previousContext ? `**Previous Context:**\n${previousContext}\n` : ''}

## YOUR CAPABILITIES (Stagehand Commands)

1. **extract(prompt, schema)** - Get structured data from page
2. **observe(prompt)** - Find actionable elements without executing
3. **act(instruction, {variables})** - Perform actions (click, type, select)

## DECISION-MAKING FRAMEWORK

### Pattern Recognition

**Authentication Pages:**
- Indicators: "Sign In", "Log In", "Create Account", email/password fields
- Action: Use credentials from user profile with %variable% syntax
- After auth: Continue to application

**Application Forms (Single Page):**
- Indicators: Multiple form fields, one "Submit" button, no step indicators
- Action: Fill all fields, then submit

**Multi-Step Forms:**
- Indicators: "Step X of Y", "Next"/"Continue" buttons, progress bars
- Action: Fill current page fields, click Next, repeat until final step

**Review Pages:**
- Indicators: "Review", "Confirm", summary of entered data, "Submit Application"
- Action: Verify data looks correct, click final Submit

**Verification Pages:**
- Indicators: "Check your email", "Enter verification code", "Verify your account"
- Action: Note verification needed, handle email verification if applicable

**Success/Confirmation:**
- Indicators: "Application submitted", "Thank you", "We'll be in touch", confirmation message
- Action: STOP - Job complete

### Field Filling Strategy

**For each field type:**
- **Name fields**: Use exact name from profile
- **Email**: Use \`%email%\` variable, value: \`${userProfile.workEmail}\`
- **Phone**: Use \`%phone%\` variable, value: \`${userProfile.phone}\`
- **Location/Address**: Use profile location
- **Work Authorization**: Answer based on profile.workAuthorized
- **Visa Sponsorship**: Answer based on profile.requiresSponsorship
- **Years of Experience**: Use profile.yearsOfExperience
- **LinkedIn**: Use profile.linkedinUrl if available
- **Resume/CV**: Skip file uploads (handled separately)
- **Cover Letter/Motivation**: Write 2-3 professional sentences connecting user's experience to the job
- **Start Date**: Use "Immediate" or "2 weeks notice" (reasonable default)
- **Salary**: Use "Competitive" or "Open" (unless profile specifies)
- **Dropdowns**: Choose most appropriate option based on profile context

### Critical Rules

✅ **ALWAYS:**
- Use %variableName% syntax for sensitive data (email, password, phone, name)
- Assess page type before taking action
- Fill ALL required fields before clicking Next/Submit
- Wait for page loads after navigation
- Verify you're making progress (not stuck in loop)

❌ **NEVER:**
- Click Submit unless certain it's the final submission
- Make up information not in user profile
- Skip required fields
- Fill file upload fields (these are handled separately)
- Click randomly without understanding purpose

## YOUR TASK

Analyze the current page and create an intelligent action plan to progress through the job application.

**Response Format:**
Return a JSON object with your analysis and action plan following the ActionPlanSchema.

Think through:
1. What type of page is this?
2. What is the goal on this specific page?
3. What actions will accomplish that goal?
4. What variables need to be used for sensitive data?
5. What's the expected outcome?

Be thorough but efficient. Quality over speed.`;
}

// =============================================================================
// PAGE CONTEXT ANALYZER
// =============================================================================

async function analyzePageContext(stagehand) {
  console.log('\n🔍 Analyzing page context...');

  try {
    const context = await stagehand.extract(
      `Analyze this page thoroughly and determine:
      1. What type of page is this? (job posting, login, signup, application form, multi-step form, review, verification, confirmation, error, or unknown)
      2. If it's a multi-step form, what step are we on and how many total steps?
      3. Does it require authentication? If so, is it login or signup?
      4. What form fields are visible? Describe each field's label, type, and if it's required
      5. What buttons are visible? What is each button's purpose?
      6. Are there any validation errors shown?
      7. Does it need email/phone verification?
      8. Is this a success/confirmation page?
      9. Are there any special instructions or notices?`,
      PageContextSchema
    );

    console.log('  ✅ Page context extracted:');
    console.log(`     Type: ${context.pageType}`);
    if (context.currentStep && context.totalSteps) {
      console.log(`     Progress: Step ${context.currentStep} of ${context.totalSteps}`);
    }
    console.log(`     Requires Auth: ${context.requiresAuth}`);
    console.log(`     Visible Fields: ${context.visibleFields.length}`);
    console.log(`     Buttons: ${context.buttons.map(b => b.text).join(', ')}`);
    console.log(`     Complete: ${context.isComplete}`);

    return context;

  } catch (error) {
    console.error('  ❌ Context extraction failed:', error.message);

    // Fallback: try simpler extraction
    try {
      const simpleContext = await stagehand.extract(
        "Describe what type of page this is and what's visible on it"
      );
      console.log('  ℹ️  Fallback description:', simpleContext);

      return {
        pageType: 'unknown',
        requiresAuth: false,
        visibleFields: [],
        buttons: [],
        hasErrors: false,
        needsVerification: false,
        isComplete: false,
        specialInstructions: simpleContext
      };
    } catch (fallbackError) {
      console.error('  ❌ Fallback extraction also failed');
      throw new Error('Unable to analyze page context');
    }
  }
}

// =============================================================================
// GPT ACTION PLANNER
// =============================================================================

async function planNextActions(pageContext, userProfile, jobInfo, currentUrl, previousActions = []) {
  console.log('\n🧠 Planning next actions with GPT...');

  const prompt = buildIntelligentPrompt(userProfile, jobInfo, currentUrl);

  const contextSummary = `
**Current Page Analysis:**
- Type: ${pageContext.pageType}
${pageContext.currentStep ? `- Step: ${pageContext.currentStep}/${pageContext.totalSteps}` : ''}
- Requires Auth: ${pageContext.requiresAuth} ${pageContext.authType ? `(${pageContext.authType})` : ''}
- Visible Fields: ${pageContext.visibleFields.length}
${pageContext.visibleFields.slice(0, 5).map(f => `  • ${f.label} (${f.type})${f.required ? ' *required' : ''}`).join('\n')}
${pageContext.visibleFields.length > 5 ? `  ... and ${pageContext.visibleFields.length - 5} more fields` : ''}
- Buttons: ${pageContext.buttons.map(b => `"${b.text}" (${b.purpose})`).join(', ')}
- Has Errors: ${pageContext.hasErrors}
${pageContext.errorMessages?.length ? `- Errors: ${pageContext.errorMessages.join(', ')}` : ''}
- Needs Verification: ${pageContext.needsVerification}
- Is Complete: ${pageContext.isComplete}
${pageContext.specialInstructions ? `- Special Instructions: ${pageContext.specialInstructions}` : ''}

**Previous Actions Taken (last 3):**
${previousActions.slice(-3).map((a, i) => `${i + 1}. ${a}`).join('\n') || 'None yet'}

**Based on this context, create a detailed action plan to progress through this page.**
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert job application automation agent. Analyze the page context and create precise action plans using Stagehand commands.'
        },
        { role: 'user', content: prompt },
        { role: 'user', content: contextSummary }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3 // Lower temperature for consistent, reliable decisions
    });

    const plan = JSON.parse(response.choices[0].message.content);

    console.log('  ✅ Action plan created:');
    console.log(`     Reasoning: ${plan.reasoning}`);
    console.log(`     Actions: ${plan.actions?.length || 0} steps planned`);
    if (plan.actions) {
      plan.actions.forEach((action, i) => {
        console.log(`       ${i + 1}. ${action.type}: ${action.command}`);
      });
    }
    console.log(`     Expected: ${plan.expectedOutcome}`);

    return plan;

  } catch (error) {
    console.error('  ❌ GPT planning failed:', error.message);
    throw new Error('Unable to create action plan');
  }
}

// =============================================================================
// ACTION EXECUTOR
// =============================================================================

async function executeActionPlan(stagehand, actionPlan, userProfile) {
  console.log('\n⚡ Executing action plan...');

  const results = [];

  for (let i = 0; i < actionPlan.actions.length; i++) {
    const action = actionPlan.actions[i];
    console.log(`\n  [${i + 1}/${actionPlan.actions.length}] ${action.type.toUpperCase()}: ${action.reason}`);

    try {
      let result;

      switch (action.type) {
        case 'extract':
          result = await stagehand.extract(action.command);
          console.log(`    ✅ Extracted:`, typeof result === 'string' ? result.substring(0, 100) : result);
          results.push({ action: action.command, result, success: true });
          break;

        case 'observe':
          result = await stagehand.observe(action.command);
          console.log(`    ✅ Observed: ${result.length} elements`);
          results.push({ action: action.command, result, success: true });
          break;

        case 'act':
          // Prepare variables - replace with actual values
          const variables = {};
          if (action.variables) {
            for (const [key, value] of Object.entries(action.variables)) {
              // If value is a reference to profile field, get it
              if (value.startsWith('profile.')) {
                const field = value.replace('profile.', '');
                variables[key] = userProfile[field] || value;
              } else {
                variables[key] = value;
              }
            }
          }

          console.log(`    🎬 Acting: ${action.command}`);
          if (Object.keys(variables).length > 0) {
            console.log(`    📝 Variables:`, Object.keys(variables).join(', '));
          }

          await stagehand.act(action.command, { variables });
          console.log(`    ✅ Action completed`);
          results.push({ action: action.command, success: true });

          // Brief wait after actions to let page update
          await new Promise(r => setTimeout(r, 1500));
          break;

        case 'wait':
          const waitTime = parseInt(action.command.match(/\d+/)?.[0] || '2000');
          console.log(`    ⏳ Waiting ${waitTime}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
          results.push({ action: 'wait', success: true });
          break;

        case 'verify':
          console.log(`    🔍 Verification check: ${action.command}`);
          result = await stagehand.extract(action.command);
          console.log(`    ℹ️  Verification result:`, result);
          results.push({ action: action.command, result, success: true });
          break;

        case 'stop':
          console.log(`    🛑 Stopping: ${action.reason}`);
          results.push({ action: 'stop', reason: action.reason, success: true });
          return { success: true, results, stopped: true, reason: action.reason };

        default:
          console.log(`    ⚠️  Unknown action type: ${action.type}`);
          results.push({ action: action.command, success: false, error: 'Unknown action type' });
      }

    } catch (error) {
      console.error(`    ❌ Action failed:`, error.message);
      results.push({ action: action.command, success: false, error: error.message });

      // If action fails, try to continue with remaining actions unless it's critical
      if (action.type === 'act' && action.command.toLowerCase().includes('submit')) {
        console.error(`    🚨 Critical action failed (submit), stopping execution`);
        return { success: false, results, error: 'Critical action failed' };
      }
    }
  }

  console.log('\n  ✅ Action plan execution complete');
  return { success: true, results };
}

// =============================================================================
// MAIN INTELLIGENT APPLICATION FUNCTION
// =============================================================================

async function intelligentJobApplication(stagehand, userProfile, jobInfo, options = {}) {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 STARTING INTELLIGENT JOB APPLICATION');
  console.log('='.repeat(80));
  console.log(`📋 Job: ${jobInfo.title} at ${jobInfo.company}`);
  console.log(`👤 Applicant: ${userProfile.fullName}`);
  console.log('='.repeat(80));

  const maxIterations = options.maxIterations || 20; // Safety limit
  const previousActions = [];
  let currentIteration = 0;
  let totalCost = 0;

  try {
    while (currentIteration < maxIterations) {
      currentIteration++;
      const currentUrl = await stagehand.context.pages()[0].url();

      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📍 ITERATION ${currentIteration}/${maxIterations}`);
      console.log(`🔗 URL: ${currentUrl}`);
      console.log('─'.repeat(80));

      // Step 1: Analyze current page
      const pageContext = await analyzePageContext(stagehand);

      // Step 2: Check if we're done
      if (pageContext.isComplete) {
        console.log('\n' + '='.repeat(80));
        console.log('✅ APPLICATION COMPLETE - Success page detected!');
        console.log('='.repeat(80));
        return {
          success: true,
          message: 'Application submitted successfully',
          iterations: currentIteration,
          finalUrl: currentUrl,
          totalCost: totalCost.toFixed(4)
        };
      }

      // Step 3: Plan next actions
      const actionPlan = await planNextActions(
        pageContext,
        userProfile,
        jobInfo,
        currentUrl,
        previousActions
      );

      // Step 4: Execute the plan
      const executionResult = await executeActionPlan(stagehand, actionPlan, userProfile);

      // Track actions
      previousActions.push(`Iteration ${currentIteration}: ${actionPlan.reasoning}`);

      // Check if execution indicated stop
      if (executionResult.stopped) {
        console.log('\n' + '='.repeat(80));
        console.log(`✅ APPLICATION COMPLETE - ${executionResult.reason}`);
        console.log('='.repeat(80));
        return {
          success: true,
          message: executionResult.reason,
          iterations: currentIteration,
          finalUrl: currentUrl,
          totalCost: totalCost.toFixed(4)
        };
      }

      // Check if execution failed critically
      if (!executionResult.success && executionResult.error) {
        console.error('\n' + '='.repeat(80));
        console.error(`❌ CRITICAL ERROR: ${executionResult.error}`);
        console.error('='.repeat(80));
        return {
          success: false,
          error: executionResult.error,
          iterations: currentIteration,
          finalUrl: currentUrl,
          totalCost: totalCost.toFixed(4)
        };
      }

      // Brief pause between iterations
      await new Promise(r => setTimeout(r, 2000));
    }

    // Max iterations reached
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  MAX ITERATIONS REACHED - Application may be incomplete');
    console.log('='.repeat(80));
    return {
      success: false,
      error: 'Maximum iterations reached without completion',
      iterations: currentIteration,
      finalUrl: await stagehand.context.pages()[0].url(),
      totalCost: totalCost.toFixed(4)
    };

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ FATAL ERROR:', error.message);
    console.error('='.repeat(80));
    console.error(error.stack);

    return {
      success: false,
      error: error.message,
      iterations: currentIteration,
      finalUrl: await stagehand.context.pages()[0].url().catch(() => 'unknown'),
      totalCost: totalCost.toFixed(4)
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  intelligentJobApplication,
  analyzePageContext,
  planNextActions,
  executeActionPlan
};
