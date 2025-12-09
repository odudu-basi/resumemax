/**
 * Intelligent Form Fill - Phase 0
 *
 * Uses ChatGPT to generate Stagehand act() commands based on observed page state.
 * Falls back to agent() if commands fail.
 *
 * Architecture:
 * 1. observe() + extract() to get full page state
 * 2. Send to ChatGPT with Stagehand docs and user profile
 * 3. ChatGPT generates sequence of act() commands
 * 4. Execute commands with error handling
 * 5. If fails, fallback to agent()
 * 6. Repeat for next page
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Stagehand documentation to include in prompts
const STAGEHAND_DOCS = `
# STAGEHAND DOCUMENTATION

## act() - Execute Actions
Performs individual web actions using natural language instructions.

**Syntax:**
await stagehand.act(instruction, { variables })

**Examples:**
- act("click the submit button")
- act("enter %email% into the email field", { variables: { email: "user@example.com" } })
- act("select %option% from the dropdown", { variables: { option: "Full-time" } })
- act("click the checkbox for terms and conditions")
- act("type %password% into password field", { variables: { password: "secret123" } })

**Supported Actions:**
- Click buttons, links, checkboxes, radio buttons
- Fill text inputs, textareas
- Select dropdown options
- Type text with keyboard
- Scroll to elements
- Press keys (Enter, Tab, etc)

**Best Practices:**
1. Use %variableName% for ALL personal data (email, phone, name, etc)
2. Break complex tasks into simple steps
3. Be specific: "click the blue submit button" not "click button"
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
 * Step 1: Observe and extract current page state
 */
async function observeAndExtractPage(stagehand) {
  console.log('\n🔍 [Phase 0] Observing page state...');

  try {
    // Observe all interactive elements
    const actions = await stagehand.observe(
      "find all form fields, input boxes, text areas, dropdowns, checkboxes, radio buttons, and navigation buttons on this page"
    );

    console.log(`✅ Found ${actions.length} interactive elements`);

    // Extract page content and context
    const pageContent = await stagehand.extract(
      "extract the page title, any instructions or help text, field labels, required field indicators, error messages, and current step indicators if visible"
    );

    console.log('✅ Extracted page content');

    return {
      actions,
      pageContent,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error observing page:', error);
    throw error;
  }
}

/**
 * Summarize form fields to reduce tokens (imported from workday file concept)
 */
function summarizeFormFieldsForChatGPT(pageState) {
  console.log('🔄 Summarizing form fields to reduce tokens...');
  
  // Extract only essential field information
  const summarizedFields = pageState.actions
    .filter(action => 
      action.method === 'fill' || 
      action.method === 'selectOption' || 
      action.method === 'click'
    )
    .map(action => {
      const summarized = {
        description: action.description,
        method: action.method
      };
      
      // Add options for dropdowns/selects (limit to 10)
      if (action.method === 'selectOption' && action.options) {
        summarized.options = action.options.slice(0, 10);
      }
      
      // Add current value if exists
      if (action.arguments && action.arguments.length > 0) {
        summarized.currentValue = action.arguments[0];
      }
      
      return summarized;
    })
    .slice(0, 15); // Limit to 15 most relevant fields

  // Extract minimal page context
  const minimalContext = {
    title: pageState.pageContent.title || '',
    currentStep: pageState.pageContent.currentStep || '',
    errors: pageState.pageContent.errors || [],
    requiredFields: pageState.pageContent.requiredFields || []
  };

  console.log(`✅ Reduced form data from ${pageState.actions.length} to ${summarizedFields.length} fields`);
  
  return {
    fields: summarizedFields,
    context: minimalContext
  };
}

/**
 * Step 2: Generate act() commands using ChatGPT (Token Optimized)
 */
async function generateCommandsFromChatGPT(pageState, userProfile, jobUrl) {
  console.log('\n🧠 [Phase 0] Generating commands with ChatGPT (token optimized)...');

  // Summarize form fields to reduce tokens
  const summarizedData = summarizeFormFieldsForChatGPT(pageState);

  // Build the prompt with summarized data
  const prompt = `
You are an expert at web automation using Stagehand, a browser automation library.

${STAGEHAND_DOCS}

# YOUR TASK

You are filling out a job application form at: ${jobUrl}

Analyze the current page state and generate a sequence of Stagehand act() commands to complete this page.

# CURRENT PAGE STATE (SUMMARIZED)

**Form Fields:**
${JSON.stringify(summarizedData.fields, null, 2)}

**Page Context:**
${JSON.stringify(summarizedData.context, null, 2)}

**User Profile:**
${JSON.stringify(userProfile, null, 2)}

# REQUIREMENTS

1. **Generate act() commands** to fill all relevant fields and advance to next page
2. **Use variables** for all personal data from user profile (use %variableName% syntax)
3. **Prioritize required fields** - fill them first
4. **Handle conditionals** - if page asks questions (like "Do you need visa sponsorship?"), answer based on user profile
5. **End with navigation** - click "Next", "Continue", or "Submit" button at the end
6. **Skip irrelevant fields** - don't fill optional fields that don't apply to this user
7. **Be specific** - use descriptive element references ("the blue submit button", "email field in contact section")

# RESPONSE FORMAT

Return ONLY valid JSON (no markdown, no code blocks, no explanations outside JSON):

{
  "reasoning": "Brief strategy explanation (2-3 sentences)",
  "commands": [
    {
      "instruction": "enter %fullName% into the full name field",
      "variables": { "fullName": "John Doe" },
      "critical": true,
      "fieldType": "name"
    },
    {
      "instruction": "enter %email% into email address field",
      "variables": { "email": "john@example.com" },
      "critical": true,
      "fieldType": "email"
    }
  ],
  "nextPageExpected": true,
  "isComplete": false,
  "confidence": 0.95
}

**Field Types:** name, email, phone, location, experience, education, skills, resume, coverLetter, workAuth, custom

**Critical:** true = must succeed for application to continue, false = optional/nice-to-have

**nextPageExpected:** true if clicking a "Next" button, false if clicking final "Submit"

**isComplete:** true if this is the final submission, false if more pages expected

**confidence:** 0-1 score of how confident you are these commands will work (be honest!)
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a Stagehand automation expert. You generate precise act() commands for web form automation. Always return valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent output
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log('✅ Generated', result.commands.length, 'commands');
    console.log('📋 Strategy:', result.reasoning);
    console.log('🎯 Confidence:', result.confidence);

    return result;

  } catch (error) {
    console.error('❌ Error generating commands:', error);
    throw error;
  }
}

/**
 * Step 3: Execute generated commands
 */
async function executeCommands(stagehand, commands) {
  console.log('\n⚡ [Phase 0] Executing', commands.length, 'commands...');

  const results = [];
  let criticalFailure = false;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    console.log(`\n[${i + 1}/${commands.length}] ${cmd.instruction}`);

    try {
      const result = await stagehand.act(cmd.instruction, {
        variables: cmd.variables || {}
      });

      results.push({
        command: cmd,
        success: result.success !== false, // Default to true if not specified
        result
      });

      if (result.success !== false) {
        console.log(`  ✅ Success`);
      } else {
        console.log(`  ⚠️  Failed:`, result.message);

        if (cmd.critical) {
          console.log(`  ❌ Critical field failed, stopping execution`);
          criticalFailure = true;
          break;
        }
      }

      // Small delay between actions for stability
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  ❌ Error executing command:`, error.message);

      results.push({
        command: cmd,
        success: false,
        error: error.message
      });

      if (cmd.critical) {
        console.log(`  ❌ Critical field error, stopping execution`);
        criticalFailure = true;
        break;
      }
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\n📊 Results: ${successCount} succeeded, ${failCount} failed`);

  return {
    results,
    allSucceeded: failCount === 0 && !criticalFailure,
    criticalFailure,
    successCount,
    failCount
  };
}

/**
 * Main orchestrator - Intelligent form filling with agent fallback
 */
async function intelligentFormFill(stagehand, userProfile, jobUrl, sessionId, sessionUrl, res) {
  console.log('\n🚀 [Phase 0] Starting intelligent form fill...');
  console.log('📍 Job URL:', jobUrl);

  const maxPages = 10; // Safety limit
  let currentPage = 1;
  let totalCommandsExecuted = 0;
  let totalCommandsSucceeded = 0;

  try {
    while (currentPage <= maxPages) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Processing Page ${currentPage}/${maxPages}`);
      console.log(`${'='.repeat(60)}`);

      // Step 1: Observe and extract page state
      const pageState = await observeAndExtractPage(stagehand);

      // Check if page has any interactive elements
      if (pageState.actions.length === 0) {
        console.log('⚠️  No interactive elements found, may have reached end');
        break;
      }

      // Step 2: Generate commands from ChatGPT
      const {
        commands,
        reasoning,
        nextPageExpected,
        isComplete,
        confidence
      } = await generateCommandsFromChatGPT(pageState, userProfile, jobUrl);

      // Check confidence level
      if (confidence < 0.5) {
        console.log(`⚠️  Low confidence (${confidence}), falling back to agent...`);
        await useAgentFallback(stagehand, userProfile, currentPage);
        break;
      }

      // Step 3: Execute commands
      const execution = await executeCommands(stagehand, commands);

      totalCommandsExecuted += commands.length;
      totalCommandsSucceeded += execution.successCount;

      // Check if we had critical failures
      if (execution.criticalFailure) {
        console.log('\n❌ Critical failure detected, falling back to agent...');
        await useAgentFallback(stagehand, userProfile, currentPage);
        break;
      }

      // Check if application is complete
      if (isComplete) {
        console.log('\n✅ Application marked as complete!');
        break;
      }

      // Wait for navigation if next page expected
      if (nextPageExpected) {
        console.log('\n⏳ Waiting for page navigation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentPage++;
      } else {
        console.log('\n✅ No next page expected, form fill complete');
        break;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 [Phase 0] Intelligent form fill completed!');
    console.log(`📊 Pages processed: ${currentPage}`);
    console.log(`📊 Commands executed: ${totalCommandsExecuted}`);
    console.log(`📊 Commands succeeded: ${totalCommandsSucceeded}`);
    console.log(`📊 Success rate: ${(totalCommandsSucceeded / totalCommandsExecuted * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(60)}`);

    return {
      success: true,
      pagesProcessed: currentPage,
      commandsExecuted: totalCommandsExecuted,
      commandsSucceeded: totalCommandsSucceeded,
    };

  } catch (error) {
    console.error('\n❌ [Phase 0] Error in intelligent form fill:', error);
    console.log('⚠️  Falling back to agent...');

    // Fallback to agent
    await useAgentFallback(stagehand, userProfile, currentPage);

    return {
      success: true, // Don't fail the whole application
      usedFallback: true,
      error: error.message
    };
  }
}

/**
 * Agent fallback when Phase 0 fails
 */
async function useAgentFallback(stagehand, userProfile, pageNumber) {
  console.log(`\n🤖 [Agent Fallback] Taking over at page ${pageNumber}...`);

  const firstName = userProfile.fullName ? userProfile.fullName.split(' ')[0] : 'John';
  const lastName = userProfile.fullName ? userProfile.fullName.split(' ').slice(1).join(' ') : 'Doe';

  try {
    const agent = stagehand.agent();

    const instruction = `
You are filling out a job application form. Complete this page and any subsequent pages.

USER INFORMATION:
- Name: ${userProfile.fullName}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}
- LinkedIn: ${userProfile.linkedinUrl || 'Not provided'}
- Work Authorized: ${userProfile.workAuthorized ? 'Yes' : 'No'}
- Requires Sponsorship: ${userProfile.requiresSponsorship ? 'Yes' : 'No'}
- Years of Experience: ${userProfile.yearsOfExperience}

Fill out the application form with the information above. Be thorough and complete all required fields.
If you encounter a "Next" or "Continue" button, click it to proceed to the next page.
Continue until you reach the final submission or run out of steps.
    `.trim();

    await agent.execute({
      instruction,
      maxSteps: 30
    });

    console.log('✅ Agent completed form filling');

  } catch (error) {
    console.error('❌ Agent fallback error:', error);
    throw error;
  }
}

module.exports = {
  intelligentFormFill,
  observeAndExtractPage,
  generateCommandsFromChatGPT,
  executeCommands
};
