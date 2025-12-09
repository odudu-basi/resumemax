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
 * Create minimal field list like Phase 1 (text only, no JSON)
 */
function createMinimalFieldList(pageState) {
  console.log('🔄 Creating minimal field list like Phase 1...');
  
  // Filter to form fields only and create simple text list
  const formFields = pageState.actions
    .filter(action => 
      action.method === 'fill' || 
      action.method === 'selectOption' || 
      action.method === 'click'
    )
    .slice(0, 50) // Limit to 50 fields max (like Phase 1)
    .map((action, index) => `${index + 1}. ${action.description} (${action.method})`)
    .join('\n');

  console.log(`✅ Created minimal field list: ${pageState.actions.length} → 50 max fields`);
  
  return formFields;
}

/**
 * Create minimal user profile like Phase 1 (structured text, not JSON)
 */
function createMinimalUserProfile(userProfile) {
  console.log('🔄 Creating minimal user profile like Phase 1...');
  
  // Extract only essential fields that Phase 1 uses
  return {
    fullName: userProfile.fullName || '',
    workEmail: userProfile.workEmail || userProfile.email || '',
    phone: userProfile.phone || '',
    location: userProfile.location || '',
    workAuthorized: userProfile.workAuthorized || true,
    requiresSponsorship: userProfile.requiresSponsorship || false,
    yearsOfExperience: userProfile.yearsOfExperience || '3-5',
    linkedinUrl: userProfile.linkedinUrl || 'N/A',
    // Recent work (max 2)
    recentWork: (userProfile.workExperience || [])
      .slice(0, 2)
      .map(exp => `${exp.position} at ${exp.company}`)
      .join(', ') || 'N/A',
    // Education (max 2)  
    education: (userProfile.education || [])
      .slice(0, 2)
      .map(edu => `${edu.degree} from ${edu.school}`)
      .join(', ') || 'N/A',
    // Top skills (max 8)
    topSkills: (userProfile.skills?.technical || userProfile.skills || [])
      .slice(0, 8)
      .join(', ') || 'N/A'
  };
}

/**
 * Step 2: Generate act() commands using ChatGPT (Token Optimized)
 */
async function generateCommandsFromChatGPT(pageState, userProfile, jobUrl) {
  console.log('\n🧠 [Phase 0] Generating commands with ChatGPT (token optimized)...');

  // Create minimal data like Phase 1 (no JSON, just text)
  const minimalFields = createMinimalFieldList(pageState);
  const minimalProfile = createMinimalUserProfile(userProfile);

  // Build the prompt using Phase 1's minimal approach
  const prompt = `You are a job application assistant. Given a user's profile and form fields, generate Stagehand act() commands to complete this page.

USER PROFILE:
Name: ${minimalProfile.fullName}
Email: ${minimalProfile.workEmail}
Phone: ${minimalProfile.phone}
Location: ${minimalProfile.location}
Work Authorization: ${minimalProfile.workAuthorized ? 'Yes' : 'No'}
Requires Sponsorship: ${minimalProfile.requiresSponsorship ? 'Yes' : 'No'}
Years of Experience: ${minimalProfile.yearsOfExperience}
LinkedIn: ${minimalProfile.linkedinUrl}
Recent Work: ${minimalProfile.recentWork}
Education: ${minimalProfile.education}
Top Skills: ${minimalProfile.topSkills}

FORM FIELDS TO FILL:
${minimalFields}

TASK: Generate Stagehand act() commands to fill these fields and advance to the next page.

INSTRUCTIONS:
- Generate act() commands using format: act("enter %fullName% into the name field", { variables: { fullName: "John Doe" } })
- Use variables for all personal data from user profile
- Skip fields you cannot fill accurately
- End with clicking "Next", "Continue", or "Submit" button
- For dropdowns, use act("select %option% from the dropdown", { variables: { option: "value" } })

Return ONLY valid JSON (no markdown, no explanations):
{
  "reasoning": "Brief strategy (1-2 sentences)",
  "commands": [
    {
      "instruction": "enter %fullName% into the full name field",
      "variables": { "fullName": "John Doe" },
      "critical": true
    }
  ],
  "nextPageExpected": true,
  "confidence": 0.95
}
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
