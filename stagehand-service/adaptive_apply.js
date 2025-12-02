const { z } = require('zod');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ========== NEW: Agent-based autonomous form filling ==========
const adaptiveFormFill = async (stagehand, userProfile, sessionId, sessionUrl, res) => {
  console.log('🤖 Starting autonomous agent-based form filling...');

  try {
    // Prepare comprehensive user profile data for the agent
    const profileData = {
      personalInfo: {
        fullName: userProfile.fullName,
        firstName: userProfile.fullName.split(' ')[0] || '',
        lastName: userProfile.fullName.split(' ').slice(1).join(' ') || '',
        email: userProfile.email,
        phone: userProfile.phone,
        location: userProfile.location,
        linkedinUrl: userProfile.linkedinUrl || '',
      },
      workExperience: userProfile.workExperience,
      education: userProfile.education,
      skills: userProfile.skills,
      authorization: {
        workAuthorized: userProfile.workAuthorized,
        requiresSponsorship: userProfile.requiresSponsorship,
      },
      yearsOfExperience: userProfile.yearsOfExperience,
      resumeFile: userProfile.resumeFile || userProfile.resumePath || userProfile.resumeUrl || null
    };

    console.log('\n📋 User Profile Summary:');
    console.log(\`  Name: \${profileData.personalInfo.fullName}\`);
    console.log(\`  Email: \${profileData.personalInfo.email}\`);
    console.log(\`  Phone: \${profileData.personalInfo.phone}\`);
    console.log(\`  Location: \${profileData.personalInfo.location}\`);
    console.log(\`  Experience: \${userProfile.workExperience.length} positions\`);
    console.log(\`  Education: \${userProfile.education.length} entries\`);
    console.log(\`  Work Authorized: \${profileData.authorization.workAuthorized}\`);
    console.log(\`  Requires Sponsorship: \${profileData.authorization.requiresSponsorship}\`);

    // Create the agent with Computer Use capabilities
    console.log('\n🤖 Initializing autonomous agent...');
    const agent = stagehand.agent({
      cua: true,
      model: {
        modelName: "google/gemini-2.5-computer-use-preview-10-2025",
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
      },
      maxSteps: 60,
      systemPrompt: \`You are an expert job application assistant. Your task is to accurately and completely fill out job application forms.

CORE RESPONSIBILITIES:
1. Carefully read and understand each form field
2. Fill every field with appropriate information from the user's profile
3. For resume uploads, use the provided file path
4. For dropdowns/radios, select the most appropriate option
5. For yes/no questions, provide clear answers based on profile data
6. For essay questions, write professional 2-3 paragraph responses
7. Double-check all filled fields for accuracy
8. Submit the application when complete

IMPORTANT RULES:
- Fill ALL fields - don't skip optional fields if you have relevant data
- Use exact values from profile (email, phone, etc.) - don't modify them
- For visa/sponsorship questions: Use the requiresSponsorship value
- For work authorization: Use the workAuthorized value
- For experience questions: Calculate from work history
- Be thorough and detail-oriented
- If a field is unclear, use your best judgment based on context

AFTER FILLING:
Before submitting, review the form to ensure:
- All required fields are filled
- Contact information is correct
- No fields were accidentally skipped
- Dropdown selections are appropriate\`
    });

    console.log('  ✅ Agent initialized with Computer Use mode');

    // Build detailed instruction for the agent
    const agentInstruction = \`Please fill out this entire job application form with the following information:

PERSONAL INFORMATION:
- Full Name: \${profileData.personalInfo.fullName}
- First Name: \${profileData.personalInfo.firstName}
- Last Name: \${profileData.personalInfo.lastName}
- Email: \${profileData.personalInfo.email}
- Phone: \${profileData.personalInfo.phone}
- Location/Address: \${profileData.personalInfo.location}
- LinkedIn Profile: \${profileData.personalInfo.linkedinUrl || 'Not provided'}
\${profileData.resumeFile ? \`- Resume File Path: \${profileData.resumeFile} (upload this file if there's a resume upload field)\` : ''}

WORK EXPERIENCE (\${userProfile.workExperience.length} positions):
\${userProfile.workExperience.map((exp, i) => \`
\${i + 1}. \${exp.title} at \${exp.company}
   Duration: \${exp.duration}
   Description: \${exp.description}
\`).join('\n')}

EDUCATION (\${userProfile.education.length} entries):
\${userProfile.education.map((edu, i) => \`
\${i + 1}. \${edu.degree} in \${edu.field}
   School: \${edu.school}
   Year: \${edu.year}
\`).join('\n')}

SKILLS:
- Technical Skills: \${userProfile.skills.technical.join(', ')}
- Languages: \${userProfile.skills.languages.join(', ')}

WORK AUTHORIZATION:
- Legally authorized to work: \${profileData.authorization.workAuthorized ? 'Yes' : 'No'}
- Requires visa sponsorship: \${profileData.authorization.requiresSponsorship ? 'Yes' : 'No'}

YEARS OF EXPERIENCE: \${userProfile.yearsOfExperience} years

INSTRUCTIONS:
1. Fill out EVERY field in the application form with the appropriate information above
2. For resume upload, use the file path provided
3. For essay questions or "Why do you want to work here?" type questions, write professional responses based on the experience and skills
4. For preference questions (remote work, location, etc.), use reasonable defaults
5. Review all fields before submitting to ensure accuracy
6. Click the submit/apply button when done
7. Track which fields you filled and which you couldn't fill

Please begin filling out the form now.\`;

    console.log('\n🚀 Starting autonomous form filling...\n');

    // Execute the agent
    const startTime = Date.now();
    const agentResult = await agent.execute(agentInstruction);
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Agent execution completed!');
    console.log(\`\n⏱️  Execution time: \${executionTime} seconds\`);

    // Parse agent result for detailed reporting
    console.log('\n📊 Agent Result Summary:');
    console.log(\`  Success: \${agentResult.success}\`);
    console.log(\`  Steps taken: \${agentResult.actions ? agentResult.actions.length : 'N/A'}\`);
    console.log(\`  Completion message: \${agentResult.message || 'Form filling completed'}\`);

    // Get token usage from Stagehand metrics
    let tokenStats = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0
    };

    try {
      const metrics = stagehand.metrics || {};

      // Aggregate token usage from all operations
      if (metrics.agent) {
        tokenStats.inputTokens = metrics.agent.promptTokens || 0;
        tokenStats.outputTokens = metrics.agent.completionTokens || 0;
      }

      // Add up tokens from all operations if agent metrics not available
      if (!metrics.agent) {
        ['act', 'extract', 'observe'].forEach(op => {
          if (metrics[op]) {
            tokenStats.inputTokens += metrics[op].promptTokens || 0;
            tokenStats.outputTokens += metrics[op].completionTokens || 0;
          }
        });
      }

      tokenStats.totalTokens = tokenStats.inputTokens + tokenStats.outputTokens;

      // Calculate estimated cost (Gemini 2.5 Computer Use pricing)
      // Input: $1.25 per million tokens, Output: $10 per million tokens
      const inputCost = (tokenStats.inputTokens / 1000000) * 1.25;
      const outputCost = (tokenStats.outputTokens / 1000000) * 10;
      tokenStats.estimatedCost = (inputCost + outputCost).toFixed(4);

      console.log('\n💰 Token Usage & Cost:');
      console.log(\`  Input tokens: \${tokenStats.inputTokens.toLocaleString()}\`);
      console.log(\`  Output tokens: \${tokenStats.outputTokens.toLocaleString()}\`);
      console.log(\`  Total tokens: \${tokenStats.totalTokens.toLocaleString()}\`);
      console.log(\`  Estimated cost: $\${tokenStats.estimatedCost}\`);
    } catch (error) {
      console.log(\`  ⚠️  Could not retrieve token metrics: \${error.message}\`);
    }

    // Parse actions to identify filled fields
    const filledFields = [];
    const unfilledFields = [];
    const errors = [];

    if (agentResult.actions && Array.isArray(agentResult.actions)) {
      console.log('\n📝 Detailed Actions:');

      agentResult.actions.forEach((action, index) => {
        const actionType = action.type || action.action || 'unknown';
        const actionDescription = action.description || action.message || JSON.stringify(action).substring(0, 100);

        console.log(\`  \${index + 1}. [\${actionType}] \${actionDescription}\`);

        // Track filled fields based on action types
        if (actionType.includes('fill') || actionType.includes('type') || actionType.includes('input')) {
          filledFields.push({
            action: actionType,
            description: actionDescription,
            success: action.success !== false
          });
        }

        // Track errors
        if (action.success === false || action.error) {
          errors.push({
            action: actionType,
            error: action.error || 'Action failed',
            description: actionDescription
          });
        }
      });

      console.log(\`\n✅ Fields filled: \${filledFields.length}\`);
      console.log(\`❌ Errors encountered: \${errors.length}\`);

      if (errors.length > 0) {
        console.log('\n⚠️  Errors:');
        errors.forEach((err, i) => {
          console.log(\`  \${i + 1}. \${err.description}: \${err.error}\`);
        });
      }
    }

    // Attempt to extract final form state to see what was filled
    console.log('\n🔍 Attempting to verify filled fields...');
    try {
      const verificationSchema = z.object({
        filledFields: z.array(z.object({
          fieldName: z.string(),
          fieldValue: z.string(),
          filled: z.boolean()
        })).describe("List of all fields in the form with their fill status")
      });

      const verification = await stagehand.extract({
        instruction: "List all form fields in this application, their current values, and whether they are filled or empty",
        schema: verificationSchema
      });

      if (verification && verification.filledFields) {
        console.log(\`\n📋 Form Field Verification (\${verification.filledFields.length} fields):\`);

        const filled = verification.filledFields.filter(f => f.filled);
        const empty = verification.filledFields.filter(f => !f.filled);

        console.log(\`  ✅ Filled: \${filled.length} fields\`);
        if (filled.length > 0) {
          filled.forEach(f => {
            console.log(\`     - \${f.fieldName}: \${f.fieldValue.substring(0, 50)}\${f.fieldValue.length > 50 ? '...' : ''}\`);
          });
        }

        console.log(\`  ⚠️  Empty: \${empty.length} fields\`);
        if (empty.length > 0) {
          empty.forEach(f => {
            console.log(\`     - \${f.fieldName}\`);
          });
        }
      }
    } catch (error) {
      console.log(\`  ⚠️  Could not verify form state: \${error.message}\`);
    }

    // Wait before closing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🔒 Closing Stagehand session...');
    await stagehand.close();

    // Return comprehensive response
    res.json({
      success: agentResult.success || true,
      sessionId,
      sessionUrl,
      message: agentResult.message || \`Application completed via autonomous agent in \${executionTime}s\`,
      stats: {
        executionTimeSeconds: parseFloat(executionTime),
        stepsTaken: agentResult.actions ? agentResult.actions.length : 0,
        fieldsFilled: filledFields.length,
        errorsEncountered: errors.length,
        tokens: tokenStats,
        successRate: filledFields.length > 0
          ? \`\${Math.round((filledFields.filter(f => f.success).length / filledFields.length) * 100)}%\`
          : 'N/A'
      },
      details: {
        filledFields: filledFields.map(f => ({
          description: f.description,
          success: f.success
        })),
        errors: errors
      }
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
      stack: error.stack,
      sessionId,
      sessionUrl
    });
  }
};

module.exports = { adaptiveFormFill };
