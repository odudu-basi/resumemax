const OpenAI = require('openai');

/**
 * Hybrid Form Filling Approach
 *
 * Phase 1: Traditional Stagehand (observe + extract + ChatGPT + act)
 *   - Observe all form fields (exclude resume)
 *   - Extract field descriptions and labels
 *   - Use ChatGPT to generate intelligent answers
 *   - Fill form using act() with smart dropdown/text logic
 *
 * Phase 2: Agent Review & Completion
 *   - Use agent to review filled form
 *   - Fill any missing fields
 *   - Verify everything is complete (DO NOT SUBMIT)
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Phase 1: Get intelligent answers from ChatGPT for all form fields
 */
async function getIntelligentAnswers(fieldDescriptions, userProfile) {
  console.log('\n🤖 Asking ChatGPT for intelligent field answers...');

  const prompt = `You are a job application assistant. Given a user's profile and a list of form fields, provide the best answer for each field.

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

FORM FIELDS TO FILL:
${fieldDescriptions.map((field, i) => `${i + 1}. ${field.description}`).join('\n')}

INSTRUCTIONS:
- For each field, provide a concise, accurate answer based on the user profile
- For essay questions (like "Why do you want to work here?"), write professional 2-3 sentence responses
- For yes/no questions, answer based on the profile data
- For dropdowns, choose the most appropriate option
- If you don't have information for a field, return "SKIP"

Return a JSON object mapping each field description to its answer:
{
  "Text input for First Name": "Oduduabasi",
  "Dropdown for Country": "United States",
  "Textarea for Why do you want to work here?": "I am passionate about..."
}`;

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

    const answers = JSON.parse(response.choices[0].message.content);

    const answerCount = Object.keys(answers).length;
    console.log(`  ✅ Got answers for ${answerCount} fields`);
    console.log(`  💰 Tokens used: ${response.usage.total_tokens}`);

    return answers;

  } catch (error) {
    console.error('  ❌ ChatGPT error:', error.message);
    return {};
  }
}

/**
 * Phase 1: Observe and extract all form fields
 */
async function observeFormFields(stagehand) {
  console.log('\n👀 Phase 1: Observing form fields...');

  try {
    // Observe all form elements EXCEPT resume upload
    const formFields = await stagehand.observe({
      instruction: `Find all form input fields, textareas, and dropdowns.
      EXCLUDE file upload inputs.
      For each field, describe what it's for (e.g., "Text input for First Name", "Dropdown for Country", etc.)`
    });

    console.log(`  ✅ Found ${formFields.length} form fields`);

    // Log some examples
    if (formFields.length > 0) {
      console.log('\n  📋 Sample fields:');
      formFields.slice(0, 5).forEach(field => {
        console.log(`    - ${field.description}`);
      });
    }

    return formFields;

  } catch (error) {
    console.error('  ❌ Observe failed:', error.message);
    return [];
  }
}

/**
 * Phase 1: Fill form fields using act() with smart logic
 */
async function fillFormFields(stagehand, fields, answers) {
  console.log('\n✍️  Phase 1: Filling form fields...');

  let filledCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const field of fields) {
    const description = field.description || '';
    const answer = answers[description];

    // Skip if no answer provided
    if (!answer || answer === 'SKIP') {
      console.log(`  ⏭️  Skipping: ${description}`);
      skippedCount++;
      continue;
    }

    try {
      const descLower = description.toLowerCase();

      // DROPDOWN LOGIC: 2-step click
      if (descLower.includes('dropdown') || descLower.includes('select')) {
        console.log(`  🔽 Filling dropdown: ${description.substring(0, 50)}...`);

        try {
          // Step 1: Click to open dropdown
          await stagehand.act({
            action: `click the dropdown for ${description}`,
            modelName: 'gpt-4o'
          });

          // Small delay for dropdown to open
          await new Promise(resolve => setTimeout(resolve, 500));

          // Step 2: Select the option
          await stagehand.act({
            action: `select "${answer}" from the dropdown`,
            modelName: 'gpt-4o'
          });

          filledCount++;
          console.log(`    ✅ Selected: ${answer}`);

        } catch (dropdownError) {
          console.log(`    ⚠️  Dropdown failed, leaving empty`);
          skippedCount++;
        }

      }
      // TEXT/TEXTAREA LOGIC: Direct entry
      else {
        console.log(`  📝 Filling text field: ${description.substring(0, 50)}...`);

        await stagehand.act({
          action: `enter "${answer}" in the ${description} field`,
          modelName: 'gpt-4o'
        });

        filledCount++;
        console.log(`    ✅ Entered: ${answer.substring(0, 50)}${answer.length > 50 ? '...' : ''}`);
      }

      // Small delay between fields
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
 * Phase 2: Agent review and completion (NO SUBMIT)
 */
async function agentReviewAndComplete(stagehand, userProfile) {
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
2. Fill any empty/missing fields using the user profile provided
3. Ensure all required fields have appropriate values
4. DO NOT CLICK SUBMIT - your job is only to verify and complete the form

IMPORTANT:
- Only fill fields that are empty or incomplete
- Do not modify fields that are already filled correctly
- Be efficient - focus only on completing the form
- STOP before clicking any submit/apply buttons`
  });

  const firstName = userProfile.fullName.split(' ')[0] || '';
  const lastName = userProfile.fullName.split(' ').slice(1).join(' ') || '';

  const instruction = `Review this job application form and fill any missing or empty fields with the following user information:

PERSONAL INFO:
- Full Name: ${userProfile.fullName}
- First Name: ${firstName}
- Last Name: ${lastName}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}

WORK AUTHORIZATION:
- Authorized to work: ${userProfile.workAuthorized ? 'Yes' : 'No'}
- Requires sponsorship: ${userProfile.requiresSponsorship ? 'Yes' : 'No'}

YOUR TASK:
1. Look at the form
2. Identify any empty or incomplete fields
3. Fill them with appropriate information from above
4. DO NOT SUBMIT the form
5. Stop after filling all missing fields`;

  try {
    const result = await agent.execute({
      instruction,
      maxSteps: 20, // Limited steps since most work is done
      highlightCursor: false
    });

    console.log('\n✅ Phase 2 Complete:');
    console.log(`  Steps taken: ${result.actions ? result.actions.length : 'N/A'}`);
    console.log(`  Success: ${result.success}`);

    // Token usage
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

/**
 * Main hybrid form fill function
 */
async function hybridFormFill(stagehand, userProfile, sessionId, sessionUrl, res) {
  console.log('🔄 Starting HYBRID form filling approach...\n');

  const startTime = Date.now();
  let phase1Cost = 0;
  let phase2Cost = 0;

  try {
    // ===== PHASE 1: Traditional Stagehand =====
    console.log('═══════════════════════════════════════');
    console.log('  PHASE 1: Traditional Stagehand');
    console.log('═══════════════════════════════════════');

    // Step 1: Observe form fields
    const formFields = await observeFormFields(stagehand);

    if (formFields.length === 0) {
      throw new Error('No form fields found');
    }

    // Step 2: Get intelligent answers from ChatGPT
    const answers = await getIntelligentAnswers(formFields, userProfile);

    // Estimate Phase 1 cost (observe + extract + ChatGPT + act)
    // This is rough - actual costs will vary
    phase1Cost = 0.08; // Approximate based on previous multi-phase approach

    // Step 3: Fill form with smart logic
    const fillResults = await fillFormFields(stagehand, formFields, answers);

    console.log(`\n💰 Phase 1 estimated cost: $${phase1Cost.toFixed(2)}`);

    // ===== PHASE 2: Agent Review =====
    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 2: Agent Review & Completion');
    console.log('═══════════════════════════════════════');

    const agentResult = await agentReviewAndComplete(stagehand, userProfile);

    // Calculate Phase 2 cost
    if (agentResult.usage) {
      const inputTokens = agentResult.usage.input_tokens || 0;
      const outputTokens = agentResult.usage.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 1.25;
      const outputCost = (outputTokens / 1000000) * 10;
      phase2Cost = inputCost + outputCost;
    }

    const totalCost = phase1Cost + phase2Cost;
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n═══════════════════════════════════════');
    console.log('  HYBRID APPROACH COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`⏱️  Total time: ${executionTime}s`);
    console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Phase 1: $${phase1Cost.toFixed(4)}`);
    console.log(`   Phase 2: $${phase2Cost.toFixed(4)}`);
    console.log(`📊 Fields filled (Phase 1): ${fillResults.filledCount}`);
    console.log(`📊 Agent steps (Phase 2): ${agentResult.actions ? agentResult.actions.length : 'N/A'}`);

    // Wait before closing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🔒 Closing Stagehand session...');
    await stagehand.close();

    // Return response
    res.json({
      success: true,
      approach: 'hybrid',
      sessionId,
      sessionUrl,
      message: `Form filled using hybrid approach in ${executionTime}s. Form NOT submitted.`,
      stats: {
        executionTimeSeconds: parseFloat(executionTime),
        totalCost: totalCost.toFixed(4),
        phase1: {
          cost: phase1Cost.toFixed(4),
          fieldsFilled: fillResults.filledCount,
          fieldsSkipped: fillResults.skippedCount,
          errors: fillResults.errorCount
        },
        phase2: {
          cost: phase2Cost.toFixed(4),
          stepsTaken: agentResult.actions ? agentResult.actions.length : 0,
          success: agentResult.success
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
