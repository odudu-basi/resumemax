const { z } = require('zod');

// Agent-based autonomous form filling using Stagehand agent.execute()
const adaptiveFormFillAgent = async (stagehand, userProfile, sessionId, sessionUrl, res) => {
  console.log('🤖 Starting agent-based autonomous form filling...');

  const firstName = userProfile.fullName.split(' ')[0] || '';
  const lastName = userProfile.fullName.split(' ').slice(1).join(' ') || '';

  try {
    // Build comprehensive user profile context for the agent
    console.log('\n📋 User Profile Summary:');
    console.log(`  Name: ${userProfile.fullName}`);
    console.log(`  Email: ${userProfile.email}`);
    console.log(`  Phone: ${userProfile.phone}`);
    console.log(`  Location: ${userProfile.location}`);
    console.log(`  Experience: ${userProfile.workExperience.length} positions`);
    console.log(`  Education: ${userProfile.education.length} entries`);
    console.log(`  Work Authorized: ${userProfile.workAuthorized}`);
    console.log(`  Requires Sponsorship: ${userProfile.requiresSponsorship}`);

    // Create the agent with Computer Use capabilities
    console.log('\n🤖 Initializing autonomous agent with CUA mode...');

    const agent = stagehand.agent({
      cua: true,
      model: {
        modelName: "google/gemini-2.5-computer-use-preview-10-2025",
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
      },
      systemPrompt: `You are an expert job application form filling assistant. Your task is to accurately fill out job application forms with the provided user information.

CORE RESPONSIBILITIES:
1. Carefully read and identify all form fields on the page
2. Fill every field with the appropriate information from the user's profile
3. For resume uploads, use the exact file path provided
4. For dropdowns/select menus, choose the most appropriate option
5. For yes/no questions, provide clear answers based on the profile data
6. For text fields asking "why" or "describe", write professional 2-3 sentence responses
7. Be thorough - fill ALL fields including optional ones if you have relevant data
8. DO NOT click submit, apply, or send buttons

IMPORTANT RULES:
- Use EXACT values from the profile (email, phone numbers, etc.) - never modify them
- For visa sponsorship questions: Use the requiresSponsorship value provided
- For work authorization: Use the workAuthorized value provided
- For years of experience: Calculate from the work history provided
- Double-check that contact information matches exactly what was provided
- If a field is unclear, use your best judgment based on the profile context
- BE PRECISE with your clicks and interactions - get it right the first time
- Stop BEFORE clicking any submit/apply/send buttons

DROPDOWN/SELECT INTERACTION RULES:
- When you need to select from a dropdown, FIRST click the dropdown arrow or field to open it
- WAIT for the dropdown options to appear
- Then click DIRECTLY on the exact option text you need
- If the first click doesn't register, click the dropdown arrow again to reopen, then select
- Do NOT retry more than twice - if it still doesn't work, move on
- Be VERY precise with your click coordinates - aim for the center of the option text

EFFICIENCY RULES:
- Get each action right on the FIRST try - think carefully before clicking
- Do NOT waste steps scrolling unnecessarily
- Fill fields in the order they appear - scroll down only when needed to see new fields
- Type accurately and completely the first time - no corrections needed
- You have limited steps, so be efficient and deliberate with every action

AFTER FILLING ALL FIELDS:
IMMEDIATELY STOP. Do not scroll to review, do not verify visually, do not check your work.
Your task is complete once all visible fields are filled. DO NOT click submit.`
    });

    console.log('  ✅ Agent initialized with Computer Use mode');

    // Build detailed instruction with all user data (DETAILED FORMAT)
    const agentInstruction = `Fill out this entire job application form with the following user information. DO NOT submit the form - only fill it out.

PERSONAL INFORMATION:
- Full Name: ${userProfile.fullName}
- First Name: ${firstName}
- Last Name: ${lastName}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}
- LinkedIn: ${userProfile.linkedinUrl || 'Not provided'}
${userProfile.resumeFile ? `- Resume File: ${userProfile.resumeFile.fileName} (${(userProfile.resumeFile.fileSize / 1024).toFixed(1)} KB) - UPLOAD THIS FILE` : ''}
${userProfile.resumeUrl ? `- Resume URL: ${userProfile.resumeUrl}` : ''}

WORK EXPERIENCE (${userProfile.workExperience.length} positions):
${userProfile.workExperience.map((exp, i) => `
${i + 1}. ${exp.title} at ${exp.company}
   Duration: ${exp.duration}
   Description: ${exp.description}
`).join('\n')}

EDUCATION:
${userProfile.education.map((edu, i) => 
  `${i + 1}. ${edu.degree} in ${edu.field}, ${edu.school} (${edu.year})`
).join('\n')}

SKILLS:
- Technical: ${Array.isArray(userProfile.skills.technical) ? userProfile.skills.technical.join(', ') : userProfile.skills.technical}
- Languages: ${Array.isArray(userProfile.skills.languages) ? userProfile.skills.languages.join(', ') : userProfile.skills.languages}

WORK AUTHORIZATION:
- Authorized to work: ${userProfile.workAuthorized ? 'Yes' : 'No'}
- Requires sponsorship: ${userProfile.requiresSponsorship ? 'Yes' : 'No'}

YEARS OF EXPERIENCE: ${userProfile.yearsOfExperience} years

INSTRUCTIONS:
1. Fill EVERY field accurately using the above information
2. For essay questions, write professional 2-3 sentence responses based on experience
3. For preferences (remote, relocate), use reasonable defaults
4. For salary, say "Negotiable" if asked
5. DO NOT click submit/apply - stop after filling all fields
6. Be efficient - you have limited steps, make each one count

Begin now. Remember: DO NOT SUBMIT.`;

    console.log('\n🚀 Executing agent to fill form...\n');

    // Execute the agent with tracking
    const startTime = Date.now();

    const agentResult = await agent.execute({
      instruction: agentInstruction,
      maxSteps: 40, // Enough for complex forms with safety buffer
      highlightCursor: false
    });

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Agent execution completed!');
    console.log(`⏱️  Execution time: ${executionTime} seconds`);

    // Parse agent result
    console.log('\n📊 Agent Result Summary:');
    console.log(`  Success: ${agentResult.success}`);
    console.log(`  Completed: ${agentResult.completed}`);
    console.log(`  Message: ${agentResult.message || 'Form filling completed'}`);
    console.log(`  Steps taken: ${agentResult.actions ? agentResult.actions.length : 'N/A'}`);

    // Extract token usage and cost
    let tokenStats = {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      inferenceTimeMs: 0,
      estimatedCost: 0
    };

    if (agentResult.usage) {
      tokenStats.inputTokens = agentResult.usage.input_tokens || 0;
      tokenStats.outputTokens = agentResult.usage.output_tokens || 0;
      tokenStats.reasoningTokens = agentResult.usage.reasoning_tokens || 0;
      tokenStats.cachedTokens = agentResult.usage.cached_input_tokens || 0;
      tokenStats.inferenceTimeMs = agentResult.usage.inference_time_ms || 0;
      tokenStats.totalTokens = tokenStats.inputTokens + tokenStats.outputTokens;

      // Calculate cost (Gemini 2.5 Computer Use pricing)
      // Input: $1.25 per million, Output: $10 per million
      const inputCost = (tokenStats.inputTokens / 1000000) * 1.25;
      const outputCost = (tokenStats.outputTokens / 1000000) * 10;
      tokenStats.estimatedCost = (inputCost + outputCost).toFixed(4);

      console.log('\n💰 Token Usage & Cost:');
      console.log(`  Input tokens: ${tokenStats.inputTokens.toLocaleString()}`);
      console.log(`  Output tokens: ${tokenStats.outputTokens.toLocaleString()}`);
      console.log(`  Reasoning tokens: ${tokenStats.reasoningTokens.toLocaleString()}`);
      console.log(`  Cached tokens: ${tokenStats.cachedTokens.toLocaleString()}`);
      console.log(`  Total tokens: ${tokenStats.totalTokens.toLocaleString()}`);
      console.log(`  Inference time: ${tokenStats.inferenceTimeMs}ms`);
      console.log(`  Estimated cost: $${tokenStats.estimatedCost}`);
    }

    // Parse actions to identify what was filled
    const actionsSummary = [];
    let filledFieldsCount = 0;
    let errorCount = 0;

    if (agentResult.actions && Array.isArray(agentResult.actions)) {
      console.log('\n📝 Detailed Action Log:');

      agentResult.actions.forEach((action, index) => {
        const actionType = action.type || 'unknown';
        const reasoning = action.reasoning || '';
        const pageUrl = action.pageUrl || '';
        const taskCompleted = action.taskCompleted || false;

        console.log(`\n  Step ${index + 1}:`);
        console.log(`    Type: ${actionType}`);
        if (reasoning) console.log(`    Reasoning: ${reasoning.substring(0, 100)}...`);
        console.log(`    Task completed: ${taskCompleted}`);

        actionsSummary.push({
          step: index + 1,
          type: actionType,
          reasoning: reasoning.substring(0, 200),
          completed: taskCompleted
        });

        // Count filled fields (rough estimate based on action types)
        if (actionType.includes('fill') || actionType.includes('type') || actionType.includes('input') || actionType.includes('select')) {
          filledFieldsCount++;
        }
      });

      console.log(`\n📊 Action Summary:`);
      console.log(`  Total steps: ${agentResult.actions.length}`);
      console.log(`  Estimated fields filled: ${filledFieldsCount}`);
      console.log(`  Errors: ${errorCount}`);
    }

    // Verify form state with extract
    console.log('\n🔍 Verifying form completion...');
    let verificationResult = null;

    try {
      const verificationSchema = z.object({
        filledFields: z.array(z.object({
          fieldLabel: z.string(),
          fieldValue: z.string(),
          isFilled: z.boolean()
        })).describe("All form fields with their current status")
      });

      verificationResult = await stagehand.extract({
        instruction: "List all form fields in this job application, showing which ones are filled vs empty",
        schema: verificationSchema
      });

      if (verificationResult && verificationResult.filledFields) {
        const filled = verificationResult.filledFields.filter(f => f.isFilled);
        const empty = verificationResult.filledFields.filter(f => !f.isFilled);

        console.log(`\n📋 Form Verification Results:`);
        console.log(`  Total fields found: ${verificationResult.filledFields.length}`);
        console.log(`  ✅ Filled: ${filled.length} fields`);
        console.log(`  ⚠️  Empty: ${empty.length} fields`);

        if (filled.length > 0 && filled.length <= 10) {
          console.log('\n  Filled fields:');
          filled.forEach(f => {
            console.log(`    - ${f.fieldLabel}: ${f.fieldValue.substring(0, 50)}${f.fieldValue.length > 50 ? '...' : ''}`);
          });
        }

        if (empty.length > 0 && empty.length <= 10) {
          console.log('\n  Empty fields:');
          empty.forEach(f => {
            console.log(`    - ${f.fieldLabel}`);
          });
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Could not verify form state: ${error.message}`);
    }

    // Wait before closing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🔒 Closing Stagehand session...');
    await stagehand.close();

    // Return comprehensive response
    res.json({
      success: agentResult.success || true,
      completed: agentResult.completed || false,
      sessionId,
      sessionUrl,
      message: agentResult.message || `Form filled by autonomous agent in ${executionTime}s. Form was NOT submitted.`,
      stats: {
        executionTimeSeconds: parseFloat(executionTime),
        stepsTaken: agentResult.actions ? agentResult.actions.length : 0,
        estimatedFieldsFilled: filledFieldsCount,
        errorsEncountered: errorCount,
        tokens: tokenStats
      },
      verification: verificationResult ? {
        totalFields: verificationResult.filledFields ? verificationResult.filledFields.length : 0,
        filledCount: verificationResult.filledFields ? verificationResult.filledFields.filter(f => f.isFilled).length : 0,
        emptyCount: verificationResult.filledFields ? verificationResult.filledFields.filter(f => !f.isFilled).length : 0,
        filledFields: verificationResult.filledFields ? verificationResult.filledFields.filter(f => f.isFilled).slice(0, 20) : [],
        emptyFields: verificationResult.filledFields ? verificationResult.filledFields.filter(f => !f.isFilled).slice(0, 20) : []
      } : null,
      actions: actionsSummary
    });

  } catch (error) {
    console.error('\n❌ Fatal error in agent-based form fill:', error);

    // Attempt to close Stagehand session
    try {
      await stagehand.close();
    } catch (closeError) {
      console.error('Error closing Stagehand:', closeError.message);
    }

    // Return error response
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      sessionId,
      sessionUrl
    });
  }
};

module.exports = { adaptiveFormFillAgent };
