const OpenAI = require('openai');
const { z } = require('zod');

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
      description: z.string().describe("Full job description text"),
      responsibilities: z.string().describe("Key responsibilities"),
      requirements: z.string().describe("Required qualifications and skills"),
      company: z.string().describe("Company name")
    });

    const jobDesc = await stagehand.extract(
      "Extract the job title, full description, responsibilities, requirements, and company name from this job posting",
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

  const jobContext = jobDescription ? `
JOB CONTEXT:
Title: ${jobDescription.title}
Company: ${jobDescription.company}
Responsibilities: ${jobDescription.responsibilities}
Requirements: ${jobDescription.requirements}
` : '';

  const prompt = `You are a job application assistant. Given a user's profile, job context, and form fields, provide the best answer for each field.

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

${jobContext}

FORM FIELDS TO FILL:
${fieldDescriptions.map((field, i) => `${i + 1}. ${field.description}`).join('\n')}

INSTRUCTIONS:
- For each field, provide a concise, accurate answer based on the user profile
- For essay questions (like "Why do you want to work here?"), write professional 2-3 sentence responses tailored to the job description
- For yes/no questions, answer based on the profile data
- For dropdowns, choose the most appropriate option
- If you don't have information for a field, return "SKIP"

Return JSON mapping each field description to its answer.`;

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
    console.log(`  ✅ Got answers for fields`);
    console.log(`  💰 Tokens used: ${response.usage.total_tokens}`);
    return {
      answers: answers,
      tokens: response.usage.total_tokens
    };
  } catch (error) {
    console.error('  ❌ ChatGPT error:', error.message);
    return { answers: {}, tokens: 0 };
  }
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
 * Agent review with work experience included
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

WORK EXPERIENCE:
${userProfile.workExperience.map((exp, i) => `
${i + 1}. ${exp.title} at ${exp.company}
   Duration: ${exp.duration}
   Description: ${exp.description}
`).join('\n')}

EDUCATION:
${userProfile.education.map((edu, i) => `
${i + 1}. ${edu.degree} in ${edu.field}, ${edu.school} (${edu.year})
`).join('\n')}

WORK AUTHORIZATION:
- Authorized to work: ${userProfile.workAuthorized ? 'Yes' : 'No'}
- Requires sponsorship: ${userProfile.requiresSponsorship ? 'Yes' : 'No'}

YOUR TASK:
1. Look at the form
2. Identify any empty or incomplete fields
3. Fill them with appropriate information from above
4. Use work experience details for any career-related questions
5. DO NOT SUBMIT the form
6. Stop after filling all missing fields`;

  try {
    const result = await agent.execute({
      instruction,
      maxSteps: 20,
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

async function hybridFormFill(stagehand, userProfile, sessionId, sessionUrl, res) {
  console.log('🔄 Starting HYBRID form filling approach...\n');

  const startTime = Date.now();
  let phase1Cost = 0;
  let phase2Cost = 0;
  let phase1Tokens = { input: 0, output: 0 };
  let phase2Tokens = { input: 0, output: 0 };
  let chatGPTTokens = 0;

  try {
    console.log('═══════════════════════════════════════');
    console.log('  PHASE 1: Traditional Stagehand');
    console.log('═══════════════════════════════════════');

    // Extract job description first
    const jobDescription = await extractJobDescription(stagehand);

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
    console.log(`\n💰 Phase 1 estimated cost: $${phase1Cost.toFixed(2)}`);

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 2: Agent Review & Completion');
    console.log('═══════════════════════════════════════');

    const agentResult = await agentReviewAndComplete(stagehand, userProfile);

    if (agentResult.usage) {
      const inputTokens = agentResult.usage.input_tokens || 0;
      const outputTokens = agentResult.usage.output_tokens || 0;
      phase2Tokens.input = inputTokens;
      phase2Tokens.output = outputTokens;
      const inputCost = (inputTokens / 1000000) * 1.25;
      const outputCost = (outputTokens / 1000000) * 10;
      phase2Cost = inputCost + outputCost;
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

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('\n🔒 Closing Stagehand session...');
    await stagehand.close();

    res.json({
      success: true,
      approach: 'hybrid',
      sessionId,
      sessionUrl,
      message: `Form filled using hybrid approach in ${executionTime}s. Form NOT submitted.`,
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
        phase1: {
          cost: phase1Cost.toFixed(4),
          fieldsFilled: fillResults.filledCount,
          fieldsSkipped: fillResults.skippedCount,
          errors: fillResults.errorCount,
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
