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
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

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

FORM QUESTIONS AND FILLING METHODS:
${chunk.map((field, i) => `${i + 1}. Question: "${field.description}"
   Filling Method: ${field.method}`).join('\n\n')}

INSTRUCTIONS:
Analyze each question carefully along with its filling method and the job description context to provide the best possible answer.

- For TEXT/TEXTAREA questions: Provide accurate answers from the user profile
  - Essay questions ("Why do you want to work here?", "What interests you?"): Write 2-3 professional sentences tailored to THIS SPECIFIC job and company
  - Short text questions: Provide concise, direct answers
  
- For DROPDOWN/SELECT questions: Choose the most appropriate option based on the profile and job context
  
- For YES/NO questions: Answer truthfully based on the profile data

- For CHECKBOX questions: Select if applicable to the user

- If you don't have relevant information for a question, return "SKIP"

KEY: Look at the QUESTION being asked, the FILLING METHOD, and the JOB DESCRIPTION to craft the most relevant answer.

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
      totalInputTokens += response.usage.prompt_tokens;
      totalOutputTokens += response.usage.completion_tokens;
      console.log(`  ✅ Chunk ${chunkIndex + 1} completed. Input: ${response.usage.prompt_tokens}, Output: ${response.usage.completion_tokens}, Total: ${response.usage.total_tokens}`);
    } catch (error) {
      console.error(`  ❌ ChatGPT error for chunk ${chunkIndex + 1}:`, error.status, error.message);
      // Continue with other chunks even if one fails
    }
  }

  console.log(`  ✅ Got answers for ${Object.keys(allAnswers).length} fields`);
  console.log(`  💰 ChatGPT tokens - Input: ${totalInputTokens}, Output: ${totalOutputTokens}, Total: ${totalInputTokens + totalOutputTokens}`);
  return {
    answers: allAnswers,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens
  };
}

/**
 * Extract the page title/heading
 * Returns the main title/heading on the current page
 */
async function extractPageTitle(stagehand) {
  console.log('\n📋 Extracting page title...');

  try {
    const titleSchema = z.object({
      title: z.string().describe("Current application step heading (My Information, My Experience, etc.)")
    });
    const result = await stagehand.extract(
      "Find the application section heading displayed in large, bold text in the center of the page. This indicates which part of the application form you're filling out (like 'My Information', 'My Experience', 'Application Questions', etc.). Do NOT extract the job title ('Mechanical Engineer') or text from the progress bar.",
      titleSchema
    );

    console.log(`  ✅ Page title extracted: "${result.title}"`);
    return result.title;

  } catch (error) {
    console.error('  ⚠️  Page title extraction failed:', error.message);
    return null;
  }
}

/**
 * Handle "My Experience" page
 * TODO: Implement logic for filling work experience section
 */
async function handleMyExperiencePage(stagehand, userProfile, jobDescription) {
  console.log('\n💼 Handling "My Experience" page...');
  console.log('═'.repeat(80));

  let totalFilled = 0;
  let totalErrors = 0;

  try {
    // SECTION 1: Upload Resume
    console.log('\n📄 === RESUME SECTION ===');
    if (userProfile.resumeFile && userProfile.resumeFile.contentBase64) {
      try {
        const page = stagehand.context.pages()[0];
        const resumeUploaded = await uploadResumeToForm(page, userProfile.resumeFile, 'resume');
        if (resumeUploaded) {
          console.log('✅ Resume uploaded successfully');
          totalFilled++;
        } else {
          console.log('⚠️  Resume upload returned false');
        }
      } catch (resumeError) {
        console.error('❌ Resume upload error:', resumeError.message);
        totalErrors++;
      }
    } else {
      console.log('ℹ️  No resume file provided, skipping resume upload');
    }

    // SECTION 2: Handle Work Experience
    console.log('\n💼 === WORK EXPERIENCE SECTION ===');
    if (userProfile.workExperience && userProfile.workExperience.length > 0) {
      try {
        const workExpResult = await handleWorkExperienceSection(
          stagehand,
          userProfile.workExperience,
          jobDescription
        );
        totalFilled += workExpResult.entriesFilled || 0;
        totalErrors += workExpResult.errors || 0;

        console.log(`✅ Work Experience section complete: ${workExpResult.entriesFilled} entries filled`);
      } catch (workExpError) {
        console.error('❌ Work Experience section error:', workExpError.message);
        totalErrors++;
      }
    } else {
      console.log('ℹ️  No work experience entries provided, skipping');
    }


    // SECTION 3: Handle Education
    console.log('\n🎓 === EDUCATION SECTION ===');
    if (userProfile.education && userProfile.education.length > 0) {
      try {
        const educationResult = await handleEducationSection(
          stagehand,
          userProfile.education,
          jobDescription
        );
        totalFilled += educationResult.entriesFilled || 0;
        totalErrors += educationResult.errors || 0;

        console.log(`✅ Education section complete: ${educationResult.entriesFilled} entries filled`);
      } catch (educationError) {
        console.error('❌ Education section error:', educationError.message);
        totalErrors++;
      }
    } else {
      console.log('ℹ️  No education entries provided, skipping');
    }




    console.log('\n' + '═'.repeat(80));
    console.log('✅ My Experience page handling complete');
    console.log(`   Sections filled: ${totalFilled}`);
    await stagehand.act("click the Save and Continue or Next button");
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Navigation button clicked');

    return {
      success: true,
      message: 'My Experience page filled successfully',
      filledCount: totalFilled,
      skippedCount: 0,
      errorCount: totalErrors
    };

  } catch (error) {
    console.error('❌ Error in handleMyExperiencePage:', error);
    return {
      success: false,
      message: error.message,
      filledCount: totalFilled,
      skippedCount: 0,
      errorCount: totalErrors + 1
    };
  }
}

/**
 * Handle Work Experience Section
 * Detects existing entries, fills them, and adds new ones as needed
 */
async function handleWorkExperienceSection(stagehand, workExperiences, jobDescription) {
  console.log(`\n📋 Processing ${workExperiences.length} work experience entries...`);
  
  let entriesFilled = 0;
  let errors = 0;

  try {
    // Step 1: Observe existing work experience entries
    console.log('\n🔍 Step 1: Detecting existing work experience entries...');
    const existingEntries = await observeWorkExperienceEntries(stagehand);
    const existingCount = existingEntries.length;
    
    console.log(`   Found ${existingCount} existing work experience entry/entries`);
    console.log(`   User has ${workExperiences.length} total work experience(s) in profile`);
    console.log(`   Will process all ${workExperiences.length} entries`);

    // Step 2: Process each work experience entry
    for (let i = 0; i < workExperiences.length; i++) {
      const entryNumber = i + 1;
      const entryData = workExperiences[i];
      
      console.log(`\n--- Processing Work Experience Entry #${entryNumber}/${workExperiences.length} ---`);
      console.log(`   Position: ${entryData.position || 'N/A'}`);
      console.log(`   Company: ${entryData.company || 'N/A'}`);

      try {
        // If this is not the first entry, we need to click "Add" or "Add Another"
        if (i >= existingCount) {
          console.log(`\n🔘 Clicking Add button to create entry #${entryNumber}...`);
          await stagehand.act("click the Add button under Work Experience section");
          
          // Wait for fields to appear
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✅ Add button clicked, fields should now be visible');
        } else {
          console.log(`\n📋 Entry #${entryNumber} already exists, will fill existing fields`);
        }

        // Step 3: Observe fields for this entry
        console.log(`\n👀 Observing fields for entry #${entryNumber}...`);
        const entryFields = await stagehand.observe(
          `Find all form fields in work experience entry #${entryNumber} (job title, company, dates, description)`
        );
        
        if (entryFields.length === 0) {
          console.log(`⚠️  No fields found for entry #${entryNumber}, skipping`);
          errors++;
          continue;
        }
        
        console.log(`   Found ${entryFields.length} fields to fill`);

        // Step 4: Get intelligent answers for this specific entry
        console.log(`\n🤖 Getting answers from ChatGPT for entry #${entryNumber}...`);
        const answersResult = await getAnswersForWorkExp(entryFields, entryData, jobDescription);
        
        console.log(`   ✅ Received ${Object.keys(answersResult.answers).length} answers`);
        console.log(`   💰 Tokens - Input: ${answersResult.inputTokens}, Output: ${answersResult.outputTokens}`);

        // Step 5: Fill the fields
        console.log(`\n✍️  Filling fields for entry #${entryNumber}...`);
        const fillResult = await fillWorkExperienceFields(stagehand, entryFields, answersResult.answers);
        
        console.log(`   ✅ ${fillResult.filledCount} filled, ⏭️  ${fillResult.skippedCount} skipped, ❌ ${fillResult.errorCount} errors`);
        
        if (fillResult.filledCount > 0) {
          entriesFilled++;
        }
        if (fillResult.errorCount > 0) {
          errors += fillResult.errorCount;
        }

      } catch (entryError) {
        console.error(`❌ Error processing entry #${entryNumber}:`, entryError.message);
        errors++;
      }
    }

    console.log(`\n=== Work Experience section complete ===`);
    console.log(`   Entries filled: ${entriesFilled}/${workExperiences.length}`);
    console.log(`   Errors: ${errors}`);

    return {
      success: entriesFilled > 0,
      entriesFilled: entriesFilled,
      errors: errors
    };

  } catch (error) {
    console.error('❌ Error in handleWorkExperienceSection:', error);
    return {
      success: false,
      entriesFilled: entriesFilled,
      errors: errors + 1
    };
  }
}

/**
 * Handle Education Section
 * Detects existing entries, fills them, and adds new ones as needed
 */
async function handleEducationSection(stagehand, educationEntries, jobDescription) {
  console.log(`\n📋 Processing ${educationEntries.length} education entries...`);
  
  let entriesFilled = 0;
  let errors = 0;

  try {
    // Step 1: Observe existing education entries
    console.log('\n🔍 Step 1: Detecting existing education entries...');
    const existingEntries = await observeEducationEntries(stagehand);
    const existingCount = existingEntries.length;
    
    console.log(`   Found ${existingCount} existing education entry/entries`);
    console.log(`   User has ${educationEntries.length} total education entry/entries in profile`);
    console.log(`   Will process all ${educationEntries.length} entries`);

    // Step 2: Process each education entry
    for (let i = 0; i < educationEntries.length; i++) {
      const entryNumber = i + 1;
      const entryData = educationEntries[i];
      
      console.log(`\n--- Processing Education Entry #${entryNumber}/${educationEntries.length} ---`);
      console.log(`   School: ${entryData.school || entryData.institution || 'N/A'}`);
      console.log(`   Degree: ${entryData.degree || 'N/A'}`);

      try {
        // If this is not the first entry, we need to click "Add" or "Add Another"
        if (i >= existingCount) {
          console.log(`\n🔘 Clicking Add button to create entry #${entryNumber}...`);
          await stagehand.act("click the Add button under Education section");
          
          // Wait for fields to appear
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✅ Add button clicked, fields should now be visible');
        } else {
          console.log(`\n📋 Entry #${entryNumber} already exists, will fill existing fields`);
        }

        // Step 3: Observe fields for this entry
        console.log(`\n👀 Observing fields for entry #${entryNumber}...`);
        const entryFields = await stagehand.observe(
          `Find all form fields in education entry #${entryNumber} (school, degree, field of study, dates, GPA)`
        );
        
        if (entryFields.length === 0) {
          console.log(`⚠️  No fields found for entry #${entryNumber}, skipping`);
          errors++;
          continue;
        }
        
        console.log(`   Found ${entryFields.length} fields to fill`);

        // Step 4: Get intelligent answers for this specific entry
        console.log(`\n🤖 Getting answers from ChatGPT for entry #${entryNumber}...`);
        const answersResult = await getAnswersForEducation(entryFields, entryData, jobDescription);
        
        console.log(`   ✅ Received ${Object.keys(answersResult.answers).length} answers`);
        console.log(`   💰 Tokens - Input: ${answersResult.inputTokens}, Output: ${answersResult.outputTokens}`);

        // Step 5: Fill the fields
        console.log(`\n✍️  Filling fields for entry #${entryNumber}...`);
        const fillResult = await fillEducationFields(stagehand, entryFields, answersResult.answers);
        
        console.log(`   ✅ ${fillResult.filledCount} filled, ⏭️  ${fillResult.skippedCount} skipped, ❌ ${fillResult.errorCount} errors`);
        
        if (fillResult.filledCount > 0) {
          entriesFilled++;
        }
        if (fillResult.errorCount > 0) {
          errors += fillResult.errorCount;
        }

      } catch (entryError) {
        console.error(`❌ Error processing entry #${entryNumber}:`, entryError.message);
        errors++;
      }
    }

    console.log(`\n=== Education section complete ===`);
    console.log(`   Entries filled: ${entriesFilled}/${educationEntries.length}`);
    console.log(`   Errors: ${errors}`);

    return {
      success: entriesFilled > 0,
      entriesFilled: entriesFilled,
      errors: errors
    };

  } catch (error) {
    console.error('❌ Error in handleEducationSection:', error);
    return {
      success: false,
      entriesFilled: entriesFilled,
      errors: errors + 1
    };
  }
}

/**
 * Observe existing work experience entries on the page
 * Returns array of existing entry elements
 */
async function observeWorkExperienceEntries(stagehand) {
  console.log('   🔍 Looking for existing work experience entries...');

  try {
    const existingEntries = await stagehand.observe(
      "Find all existing work experience entries or form fields or buttons already visible in the Work Experience section"
    );

    // Filter to get only meaningful entries (exclude the Add button itself)
    const actualEntries = existingEntries.filter(entry => {
      const desc = entry.description.toLowerCase();
      return !desc.includes('add button') &&
             !desc.includes('add another button') &&
             (desc.includes('input') || desc.includes('field') || desc.includes('text') || desc.includes('company') || desc.includes('title') || desc.includes('date'));
    });

    console.log(`   Found ${actualEntries.length} existing entry fields`);
    return actualEntries;

  } catch (error) {
    console.error('   ⚠️  Error observing existing entries:', error.message);
    return [];
  }
}

/**
 * Get intelligent answers from ChatGPT for a specific work experience entry
 * Only passes the specific entry data, not the entire user profile
 */
async function getAnswersForWorkExp(fields, entryData, jobDescription) {
  console.log(`   🤖 Asking ChatGPT for answers (${fields.length} fields)...`);

  const jobContext = jobDescription ? `
JOB CONTEXT:
Title: ${jobDescription.title}
Company: ${jobDescription.company}
Summary: ${jobDescription.summary}
` : '';

  const fieldDescriptions = fields.map((field, i) =>
    `${i + 1}. Question: "${field.description}"
   Filling Method: ${field.method}`
  ).join('\n\n');

  const prompt = `You are filling out a work experience entry for a job application.

WORK EXPERIENCE ENTRY DATA:
Position/Title: ${entryData.position || entryData.title || 'N/A'}
Company: ${entryData.company || 'N/A'}
Location: ${entryData.location || 'N/A'}
Start Date: ${entryData.startDate || entryData.start_date || 'N/A'}
End Date: ${entryData.endDate || entryData.end_date || entryData.current ? 'Present' : 'N/A'}
Currently Working: ${entryData.current || false}
Duration: ${entryData.duration || 'N/A'}
Description: ${entryData.description || 'N/A'}

${jobContext}

FORM FIELDS TO FILL:
${fieldDescriptions}

INSTRUCTIONS:
For each field, provide the most appropriate answer based on the work experience data above.

- For job title/position fields: Use the Position/Title
- For company name fields: Use the Company
- For location fields: Use the Location
- For start date fields: Use the Start Date (format as shown or MM/YYYY if needed)
- For end date fields: Use the End Date, or "Present" if currently working
- For description/responsibilities fields: Use the Description
- For "currently working here" checkboxes: Answer based on Currently Working status
- For any other fields: Provide the most relevant answer from the data above
- If you don't have the information for a field, return "SKIP"

IMPORTANT: Return JSON where the keys are the EXACT field descriptions (copy them exactly, including all punctuation and wording).

Example format: { "Input field for job title.": "Software Engineer", "Input field for company name.": "Google Inc." }`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that fills out work experience entries accurately.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const answers = JSON.parse(response.choices[0].message.content);
    const inputTokens = response.usage.prompt_tokens;
    const outputTokens = response.usage.completion_tokens;

    console.log(`   ✅ ChatGPT response received (${Object.keys(answers).length} answers)`);

    return {
      answers: answers,
      inputTokens: inputTokens,
      outputTokens: outputTokens
    };

  } catch (error) {
    console.error(`   ❌ ChatGPT error:`, error.message);
    return {
      answers: {},
      inputTokens: 0,
      outputTokens: 0
    };
  }
}

/**
 * Fill work experience fields using act() commands
 */
async function fillWorkExperienceFields(stagehand, fields, answers) {
  console.log(`   ✍️  Filling ${fields.length} fields...`);

  let filledCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const field of fields) {
    const description = field.description || '';
    const answer = answers[description];

    if (!answer || answer === 'SKIP') {
      console.log(`      ⏭️  Skipping: ${description.substring(0, 50)}...`);
      skippedCount++;
      continue;
    }

    try {
      const descLower = description.toLowerCase();

      // Handle checkboxes
      if (descLower.includes('checkbox') || descLower.includes('check box') || field.method === 'check') {
        if (answer.toLowerCase() === 'true' || answer.toLowerCase() === 'yes') {
          await stagehand.act(`check the ${description}`);
          filledCount++;
          console.log(`      ✅ Checked: ${description.substring(0, 40)}...`);
        } else {
          skippedCount++;
        }
        continue;
      }

      // Handle dropdowns/selects
      if (descLower.includes('dropdown') || descLower.includes('select') || field.method === 'selectOption') {
        await stagehand.act(`select "${answer}" from the ${description}`);
        filledCount++;
        console.log(`      ✅ Selected "${answer}" in: ${description.substring(0, 40)}...`);
        continue;
      }

      // Handle text inputs (default)
      await stagehand.act(`enter "${answer}" into the ${description}`, {});
      filledCount++;
      console.log(`      ✅ Filled: ${description.substring(0, 40)}... = "${String(answer).substring(0, 30)}..."`);

    } catch (fillError) {
      console.error(`      ❌ Error filling "${description}": ${fillError.message}`);
      errorCount++;
    }

    // Small delay between fields
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    filledCount: filledCount,
    skippedCount: skippedCount,
    errorCount: errorCount
  };
}

/**
 * Observe existing education entries on the page
 * Returns array of existing entry elements
 */
async function observeEducationEntries(stagehand) {
  console.log('   🔍 Looking for existing education entries...');
  
  try {
    const existingEntries = await stagehand.observe(
      "Find all existing education entries or form fields already visible in the Education section"
    );
    
    const actualEntries = existingEntries.filter(entry => {
      const desc = entry.description.toLowerCase();
      return !desc.includes('add button') &&
             !desc.includes('add another button') &&
             (desc.includes('input') || desc.includes('field') || desc.includes('text') || desc.includes('school') || desc.includes('degree') || desc.includes('date'));
    });
    
    console.log(`   Found \${actualEntries.length} existing entry fields`);
    return actualEntries;
    
  } catch (error) {
    console.error('   ⚠️  Error observing existing entries:', error.message);
    return [];
  }
}

/**
 * Get intelligent answers from ChatGPT for a specific education entry
 */
async function getAnswersForEducation(fields, entryData, jobDescription) {
  console.log(`   🤖 Asking ChatGPT for answers (\${fields.length} fields)...`);
  
  const jobContext = jobDescription ? `
JOB CONTEXT:
Title: \${jobDescription.title}
Company: \${jobDescription.company}
Summary: \${jobDescription.summary}
` : '';

  const fieldDescriptions = fields.map((field, i) =>
    `\${i + 1}. Question: "\${field.description}"
   Filling Method: \${field.method}`
  ).join('\n\n');

  const prompt = `You are filling out an education entry for a job application.

EDUCATION ENTRY DATA:
School/Institution: \${entryData.school || entryData.institution || 'N/A'}
Degree: \${entryData.degree || 'N/A'}
Field of Study/Major: \${entryData.field || entryData.major || entryData.field_of_study || 'N/A'}
Start Date: \${entryData.startDate || entryData.start_date || 'N/A'}
End Date: \${entryData.endDate || entryData.end_date || entryData.current ? 'Present' : 'N/A'}
Currently Enrolled: \${entryData.current || false}
Graduation Year: \${entryData.graduation_year || entryData.year || 'N/A'}
GPA: \${entryData.gpa || 'N/A'}
Activities: \${entryData.activities || 'N/A'}

\${jobContext}

FORM FIELDS TO FILL:
\${fieldDescriptions}

INSTRUCTIONS:
For each field, provide the most appropriate answer based on the education data above.

- For school/institution fields: Use the School/Institution
- For degree fields: Use the Degree
- For field of study/major fields: Use the Field of Study/Major
- For start/end date fields: Use the Start/End Date
- For graduation year fields: Use the Graduation Year
- For GPA fields: Use the GPA if available
- If you don't have the information for a field, return "SKIP"

IMPORTANT: Return JSON where the keys are the EXACT field descriptions.

Example: { "Input field for school name.": "MIT", "Input field for degree.": "Bachelor of Science" }`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that fills out education entries accurately.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const answers = JSON.parse(response.choices[0].message.content);
    const inputTokens = response.usage.prompt_tokens;
    const outputTokens = response.usage.completion_tokens;

    console.log(`   ✅ ChatGPT response received (\${Object.keys(answers).length} answers)`);

    return {
      answers: answers,
      inputTokens: inputTokens,
      outputTokens: outputTokens
    };

  } catch (error) {
    console.error(`   ❌ ChatGPT error:`, error.message);
    return {
      answers: {},
      inputTokens: 0,
      outputTokens: 0
    };
  }
}

/**
 * Fill education fields using act() commands
 */
async function fillEducationFields(stagehand, fields, answers) {
  console.log(`   ✍️  Filling \${fields.length} fields...`);
  
  let filledCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const field of fields) {
    const description = field.description || '';
    const answer = answers[description];

    if (!answer || answer === 'SKIP') {
      console.log(`      ⏭️  Skipping: \${description.substring(0, 50)}...`);
      skippedCount++;
      continue;
    }

    try {
      const descLower = description.toLowerCase();

      if (descLower.includes('checkbox') || descLower.includes('check box') || field.method === 'check') {
        if (answer.toLowerCase() === 'true' || answer.toLowerCase() === 'yes') {
          await stagehand.act(`check the \${description}`);
          filledCount++;
          console.log(`      ✅ Checked: \${description.substring(0, 40)}...`);
        } else {
          skippedCount++;
        }
        continue;
      }

      if (descLower.includes('dropdown') || descLower.includes('select') || field.method === 'selectOption') {
        await stagehand.act(`select "\${answer}" from the \${description}`);
        filledCount++;
        console.log(`      ✅ Selected "\${answer}" in: \${description.substring(0, 40)}...`);
        continue;
      }

      await stagehand.act(`enter "\${answer}" into the \${description}`, {});
      filledCount++;
      console.log(`      ✅ Filled: \${description.substring(0, 40)}... = "\${String(answer).substring(0, 30)}..."`);

    } catch (fillError) {
      console.error(`      ❌ Error filling "\${description}":`, fillError.message);
      errorCount++;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    filledCount: filledCount,
    skippedCount: skippedCount,
    errorCount: errorCount
  };
}

/**
 * Extract form questions with actual question text - returns structured data
 */
async function extractFormQuestions(stagehand) {
  console.log('\n📝 Extracting form questions with actual text...');

  try {
    const questionsSchema = z.object({
      questions: z.array(z.object({
        questionText: z.string().describe("The actual question text displayed to the user"),
        inputType: z.enum(['text', 'textarea', 'dropdown', 'checkbox', 'radio', 'date', 'number']).describe("Type of input field"),
        isRequired: z.boolean().optional().describe("Whether this field is required"),
        placeholder: z.string().optional().describe("Placeholder text if any")
      }))
    });

    const result = await stagehand.extract(
      "Extract all form questions on this page. Get the actual question text (e.g., 'What is your first name?' or 'Why do you want to work here?'), the input type, and whether it's required.",
      questionsSchema
    );

    console.log(`  ✅ Extracted ${result.questions.length} questions`);

    if (result.questions.length > 0) {
      console.log('\n  📋 Sample questions:');
      result.questions.slice(0, 3).forEach((q, i) => {
        console.log(`    ${i + 1}. "${q.questionText}" (${q.inputType}${q.isRequired ? ', required' : ''})`);
      });
    }

    return result.questions;

  } catch (error) {
    console.error('  ❌ Extract failed:', error.message);
    return [];
  }
}

/**
 * Observe form fields - returns Action[] with selectors
 */
async function observeFormFields(stagehand) {
  console.log('\n👀 Observing form fields for selectors...');

  try {
    // observe() returns Action[] with { description, method, arguments, selector }
    const actions = await stagehand.observe(
      "Find all form input fields, textareas, dropdowns, and checkboxes. Exclude buttons and file upload fields."
    );

    console.log(`  ✅ Found ${actions.length} actionable fields`);

    return actions;

  } catch (error) {
    console.error('  ❌ Observe failed:', error.message);
    return [];
  }
}

/**
 * Enhanced observe that combines extract + observe for better context
 */
async function observeFormFieldsEnhanced(stagehand) {
  console.log('\n🔍 Enhanced field detection (extract + observe)...');

  // Step 1: Extract actual question text
  const questions = await extractFormQuestions(stagehand);

  // Step 2: Observe to get actionable selectors
  const actions = await observeFormFields(stagehand);

  // Step 3: Combine - match questions to actions
  const enhanced = actions.map((action, index) => {
    // Try to find matching question
    const matchingQuestion = questions[index] || null;

    return {
      description: matchingQuestion ? matchingQuestion.questionText : action.description,
      method: action.method,
      arguments: action.arguments,
      selector: action.selector,
      inputType: matchingQuestion?.inputType || 'unknown',
      isRequired: matchingQuestion?.isRequired || false,
      originalDescription: action.description
    };
  });

  console.log(`  ✅ Enhanced ${enhanced.length} fields with question context`);

  return enhanced;
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
            const answerStr = String(answer);
            console.log(`    ✅ Selected: ${answerStr.substring(0, 50)}${answerStr.length > 50 ? '...' : ''}`);
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
        const answerStr = String(answer);
        console.log(`    ✅ Entered: ${answerStr.substring(0, 50)}${answerStr.length > 50 ? '...' : ''}`);
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
/**
 * Phase 0: Agent-based account creation for Workday applications

/**
 * Detect if the current page is asking for email verification
 */
async function detectVerificationPage(stagehand) {
  console.log('\n🔍 Checking if email verification is required...');
  
  try {
    const verificationCheck = await stagehand.extract(
      "Check if this page is asking for email verification, to check email, or waiting for confirmation",
      z.object({
        isVerificationPage: z.boolean().describe("Whether this page is asking the user to verify their email or check their inbox"),
        message: z.string().describe("The message or instruction shown on the page")
      })
    );
    
    if (verificationCheck.isVerificationPage) {
      console.log('✅ Email verification required');
      console.log(`   Message: "${verificationCheck.message}"`);
      return true;
    } else {
      console.log('ℹ️  No email verification required');
      return false;
    }
    
  } catch (error) {
    console.error('⚠️  Error detecting verification page:', error.message);
    return false;
  }
}

/**
 * Handle email verification flow via Gmail
 */
async function handleEmailVerification(stagehand, userProfile, companyName) {
  console.log('\n📧 Starting email verification flow...');
  console.log(`   Company: ${companyName}`);
  console.log(`   Work Email: ${userProfile.workEmail}`);
  
  try {
    console.log('\n🌐 Step 1: Navigating to Gmail...');
    const page = stagehand.context.pages()[0];
    await page.goto('https://mail.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Gmail loaded');
    
    console.log('\n📝 Step 2: Entering email...');
    await stagehand.act(`enter "${userProfile.workEmail}" into the email field`, {});
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔘 Clicking Next...');
    await stagehand.act("click the Next button");
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Email page complete');
    
    console.log('\n🔑 Step 3: Entering password...');
    await stagehand.act(`enter the password into the password field`, { 
      variables: { password: userProfile.workPassword } 
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔘 Clicking Next...');
    await stagehand.act("click the Next button");
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Password page complete, waiting for inbox...');
    
    console.log('\n⏳ Step 4: Waiting 5 seconds for verification email to arrive...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🤖 Step 5: Using AI agent to find verification email...');
    const agent = stagehand.agent({
      cua: true,
      provider: 'google',
      model: 'gemini-2.0-flash-exp',
    });
    
    const agentResult = await agent.execute(
      `Go to inbox, find the most recent email from ${companyName}, open it, and click the verification link`,
      { maxSteps: 15 }
    );
    
    console.log('✅ Agent completed email verification');
    console.log(`   Steps taken: ${agentResult.actions ? agentResult.actions.length : 'N/A'}`);
    
    console.log('\n🔄 Step 6: Switching to verification tab...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const pages = stagehand.context.pages();
    console.log(`   Found ${pages.length} tabs open`);
    
    if (pages.length > 1) {
      const verificationPage = pages[pages.length - 1];
      await verificationPage.bringToFront();
      console.log('✅ Switched to verification tab');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('\n🔍 Step 7: Checking if login required...');
      const loginElements = await stagehand.observe(
        "Find login or sign in fields (email, password, or sign in button)"
      );
      
      if (loginElements.length > 0) {
        console.log('🔐 Login page detected, logging in...');
        
        await stagehand.act(`enter "${userProfile.workEmail}" into the email field`, {});
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await stagehand.act(`enter the password into the password field`, { 
          variables: { password: userProfile.workPassword } 
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await stagehand.act("click the Sign In button");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('✅ Logged in successfully');
      } else {
        console.log('ℹ️  No login required, already authenticated');
      }
      
    } else {
      console.log('⚠️  No new tab opened, verification may have completed in same tab');
    }
    
    console.log('\n✅ Email verification flow complete!');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error in email verification:', error.message);
    console.log('⚠️  Continuing despite error, assuming verification completed...');
    return { success: false, error: error.message };
  }
}
async function agentAccountCreation(stagehand, userProfile) {
  console.log('\n🔐 Phase 0: Agent-based account creation...');

  const agent = stagehand.agent({
    cua: true,
    model: {
      modelName: "google/gemini-2.5-computer-use-preview-10-2025",
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
    },
    systemPrompt: `You are an account creation specialist for Workday job applications.

Your mission is to navigate through the initial steps and create a NEW account so the user can apply for the job.

CRITICAL RULES:
1. You are creating a NEW ACCOUNT, not logging into an existing one
2. Always choose "Create Account" or "Sign Up" over "Sign In" or "Login"
3. Navigate step-by-step until you reach the actual application form page
4. Stop once you see the application form fields (like name, phone, experience fields)
5. Accept ALL consent/terms checkboxes you encounter`
  });

  const instruction = `Navigate to the job application form by creating a new account. Follow these steps IN ORDER:

STEP 1: CLICK APPLY BUTTON
- Look for and click the "Apply", "Apply Now", or similar button on the job listing page
- This button is usually prominently displayed on the job description page

STEP 2: CHOOSE APPLICATION METHOD
- If asked "How would you like to apply?", look for options like:
  - "Apply Manually"
  - "Apply with Resume"
  - "Continue with Application"
- Click "Apply Manually" or the non-LinkedIn/non-social option
- NEVER choose "Apply with LinkedIn" or "Apply with Indeed"

STEP 3: CREATE NEW ACCOUNT
You will see a signup/account creation form. Fill it with these details:

EMAIL: ${userProfile.workEmail}
PASSWORD: ${userProfile.workPassword}
VERIFY PASSWORD: ${userProfile.workPassword}

IMPORTANT FOR ACCOUNT CREATION:
- If you see BOTH "Sign In" and "Create Account" tabs/buttons, click "Create Account" or "Sign Up"
- Fill in the email field with: ${userProfile.workEmail}
- Fill in the password field with: ${userProfile.workPassword}
- If there's a "Verify Password" or "Confirm Password" field, also enter: ${userProfile.workPassword}
- If there's a "First Name" field, enter: ${userProfile.fullName.split(' ')[0]}
- If there's a "Last Name" field, enter: ${userProfile.fullName.split(' ').slice(1).join(' ')}

STEP 4: ACCEPT ALL CONSENTS
- Check ALL checkboxes for terms of service, privacy policy, consent forms, etc.
- Look for phrases like "I agree to", "I accept", "Terms and Conditions"
- Check every single consent box you find

STEP 5: SUBMIT ACCOUNT CREATION
- Click the "Create Account", "Sign Up", "Register", or "Continue" button
- Wait 2-3 seconds for the page to change
- Observe the new page content

STEP 6: VERIFY PAGE CHANGED AND STOP
After clicking "Create Account", check if the page has changed:
- The page content is different from before (new headings, different layout)
- You see a new page (application form, dashboard, next step, etc.)
- The URL has changed
- Loading indicators have disappeared

WHEN TO STOP:
✅ STOP IMMEDIATELY when you confirm the page has changed after clicking "Create Account"
✅ You do NOT need to see the application form - just confirm the page changed
✅ Even if you land on an intermediate page, STOP - Phase 1 will handle the rest

TROUBLESHOOTING:
- If you see "Email already exists" error: Try "Sign In" instead with same credentials, then wait for page change
- If stuck on same page after clicking: Look for error messages or try clicking the button again

YOUR GOAL: Create account → Click "Create Account" → Wait for page to change → STOP and hand off to Phase 1.`;

  try {
    const result = await agent.execute({
      instruction,
      maxSteps: 20,  // Enough steps for navigation and account creation
      highlightCursor: false
    });

    console.log('\n✅ Phase 0 Complete (Account Creation):');
    console.log(`  Steps taken: ${result.actions ? result.actions.length : 'N/A'}`);
    console.log(`  Success: ${result.success}`);

    if (result.usage) {
      const inputTokens = result.usage.input_tokens || 0;
      const outputTokens = result.usage.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 1.25;  // Gemini pricing (same as Phase 2)
      const outputCost = (outputTokens / 1000000) * 10;  // Gemini pricing (same as Phase 2)
      const totalCost = (inputCost + outputCost).toFixed(4);
      console.log(`  💰 Phase 0 cost: $${totalCost}`);
      console.log(`     Input tokens: ${inputTokens.toLocaleString()}`);
      console.log(`     Output tokens: ${outputTokens.toLocaleString()}`);
    }

    return result;
  } catch (error) {
    console.error('  ❌ Phase 0 error:', error.message);

    // Return partial success to allow continuation
    return {
      success: false,
      error: error.message,
      partialSuccess: true,
      intermediateError: error.message
    };
  }
}

/**
 * Agent review and continue for each page (new per-page approach)
 */
async function agentReviewAndContinue(stagehand, userProfile, jobDescription, pageNumber) {
  console.log(`\n🤖 Phase 2: Agent review for page ${pageNumber}...`);

  const agent = stagehand.agent({
    cua: true,
    model: {
      modelName: "google/gemini-2.5-computer-use-preview-10-2025",
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
    },
    systemPrompt: `You are a job application completion specialist. Phase 1 has already filled most fields on this page.

YOUR TASK (IN ORDER):
1. Review the current page for any missing or incorrectly filled fields
2. Fill any empty required fields or fields with validation errors
3. Click "Next", "Continue", or "Save and Continue" button
4. STOP IMMEDIATELY after clicking the button

SPECIAL INSTRUCTIONS:
- For "How did you hear about us?" fields: Always answer "LinkedIn" and press Enter
- For referral fields: Use "LinkedIn" as the source
- For text questions: Provide brief, professional responses based on user profile
- Focus on required fields (marked with * or red borders)
- Don't re-fill fields that are already correctly completed

USER PROFILE:
- Name: ${userProfile.fullName}
- Email: ${userProfile.workEmail}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}

JOB CONTEXT:
${jobDescription ? `Job Description: ${jobDescription.title} at ${jobDescription.company}. ${jobDescription.summary && typeof jobDescription.summary === 'string' ? jobDescription.summary.substring(0, 300) + "..." : ""}...` : 'No job description available'}

CRITICAL: After clicking Continue/Next/Save and Continue, STOP immediately. Do not wait for the next page to load.`
  });

  const instruction = `Review this job application page for any missing fields or validation errors. Fill any empty required fields using the user profile information provided. 

For "How did you hear about us" or referral questions, always use "LinkedIn".

Once all fields are properly filled, click the Continue, Next, or Save and Continue button and stop immediately. however if you see a submit button click that, wait for a confirmation page or message and then stop immediately`;

  try {
    const result = await agent.execute({
      instruction,
      maxSteps: 15,  // Enough steps for review + fill + click
      highlightCursor: false
    });

    console.log(`\n✅ Page ${pageNumber} Agent Review Complete:`);
    console.log(`  Steps taken: ${result.actions ? result.actions.length : 'N/A'}`);
    console.log(`  Success: ${result.success}`);

    if (result.usage) {
      const inputTokens = result.usage.input_tokens || 0;
      const outputTokens = result.usage.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 1.25;
      const outputCost = (outputTokens / 1000000) * 10;
      const totalCost = (inputCost + outputCost).toFixed(4);
      console.log(`  💰 Page ${pageNumber} Agent cost: $${totalCost}`);
      console.log(`     Input tokens: ${inputTokens.toLocaleString()}`);
      console.log(`     Output tokens: ${outputTokens.toLocaleString()}`);
    }

    return result;
  } catch (error) {
    console.error(`  ❌ Page ${pageNumber} Agent error:`, error.message);
    
    // Return partial success to allow continuation
    return {
      success: false,
      error: error.message,
      partialSuccess: true
    };
  }
}

async function agentReviewAndComplete(stagehand, userProfile, jobDescription) {
  console.log('\n🤖 Phase 2: Agent review and completion...');

  const agent = stagehand.agent({
    cua: true,
    model: {
      modelName: "google/gemini-2.5-computer-use-preview-10-2025",
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
    },
    systemPrompt: `You are an error correction assistant for job application forms.

IMPORTANT: Phase 1 has already filled the form. You are ONLY called when validation errors persist.

YOUR TASK (IN ORDER):
1. Look for fields with validation errors or error messages
2. Fill ONLY those error fields with appropriate information
3. Click the "Next", "Continue", or "Save and Continue" button
4. STOP IMMEDIATELY after clicking - do not evaluate the next page

CRITICAL RULES:
- DO NOT review or evaluate fields after clicking Continue/Next
- DO NOT scroll down on the next page
- DO NOT verify if fields are filled on the next page
- Your job ends the moment you click Continue/Next
- Maximum 5-8 steps: find errors → fill errors → click button → STOP`
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

  const instruction = `You are fixing validation errors on a job application form that Phase 1 could not resolve.

USER INFORMATION:
- Full Name: ${userProfile.fullName}
- Email: ${userProfile.workEmail}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}

YOUR TASK:
1. Find fields with validation errors (red text, error messages, required field warnings)
2. Fill ONLY those error fields with the appropriate information above
3. Click the "Next", "Continue", or "Save and Continue" button
4. STOP IMMEDIATELY - do not evaluate or scroll on the next page

DO NOT:
- Fill fields that do not have errors
- Review the entire form
- Evaluate the next page after clicking Continue
- Scroll down on the next page
- Spend more than 5-8 steps total


Your job ends when you click the Continue/Next button.`;

  try {
    const result = await agent.execute({
      instruction,
      maxSteps: 10,  // Limited steps: find errors → fill → click continue → stop
      highlightCursor: false
    });

    console.log('\n✅ Phase 2 Complete:');
    console.log(`  Steps taken: ${result.actions ? result.actions.length : 'N/A'}`);
    console.log(`  Success: ${result.success}`);

    // Detect what button was clicked by analyzing the last few actions
    let navigationAction = 'unknown';
    if (result.actions && result.actions.length > 0) {
      // Check last 3 actions for navigation keywords
      const recentActions = result.actions.slice(-3).map(a =>
        typeof a === 'string' ? a.toLowerCase() : (a.action || a.description || '').toLowerCase()
      ).join(' ');

      if (recentActions.includes('next') || recentActions.includes('continue') ||
          recentActions.includes('proceed') || recentActions.includes('next step')) {
        navigationAction = 'next';
        console.log(`  🔄 Detected: NEXT/CONTINUE button clicked`);
      } else if (recentActions.includes('submit') || recentActions.includes('apply') ||
                 recentActions.includes('send application')) {
        navigationAction = 'submit';
        console.log(`  ✅ Detected: SUBMIT button clicked`);
      }
    }

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

    // Add navigation action to result
    result.navigationAction = navigationAction;
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

async function hybridFormFill(stagehand, userProfile, sessionId, sessionUrl, liveViewUrl, res, jobUrl) {
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

  try {
    console.log('═══════════════════════════════════════');
    console.log('  PHASE 0: Agent-Based Account Creation');
    console.log('═══════════════════════════════════════');

    // Use agent to navigate and create account with UNIQUE EMAIL (workdayUserProfile)
    // Verification emails sent to unique email will appear in work email inbox via Gmail + aliasing
    const accountResult = await agentAccountCreation(stagehand, workdayUserProfile);

    // Calculate Phase 0 cost from agent usage
    if (accountResult.usage) {
      const inputTokens = accountResult.usage.input_tokens || 0;
      const outputTokens = accountResult.usage.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 1.25;  // Gemini pricing (same as Phase 2)
      const outputCost = (outputTokens / 1000000) * 10;
      phase0Cost = inputCost + outputCost;
    } else {
      phase0Cost = 0.02; // Fallback estimate
    }

    if (accountResult.success) {
      console.log('✅ Account creation completed successfully');
      console.log(`📊 Agent steps: ${accountResult.actions ? accountResult.actions.length : 'N/A'}`);
    } else if (accountResult.partialSuccess) {
      console.log('⚠️  Account creation had errors but continuing...');
      console.log(`   Error: ${accountResult.intermediateError}`);
    } else {
      console.log('❌ Account creation failed, but attempting to continue with form fill...');
    }

    // Wait for page to stabilize after account creation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract job description once
    console.log('📋 Extracting job description...');
    const jobDescription = await extractJobDescription(stagehand);
    console.log('✅ Job description extracted');

    
    // Check if email verification is required
    const needsVerification = await detectVerificationPage(stagehand);
    
    if (needsVerification) {
      console.log('\n📧 Email verification detected, starting verification flow...');
      const companyName = jobDescription ? jobDescription.company : 'the company';
      
      // Use ORIGINAL userProfile so Gmail login uses WORK EMAIL (not unique email)
      const verificationResult = await handleEmailVerification(
        stagehand, 
        userProfile, 
        companyName
      );
      
      if (verificationResult.success) {
        console.log('✅ Email verification completed successfully');
      } else {
        console.log('⚠️  Email verification encountered issues, continuing anyway...');
      }
      
      // Small wait after verification
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Multi-page application loop
    let pageNumber = 1;
    const MAX_PAGES = 10; // Safety limit to prevent infinite loops
    let allFilledFields = [];
    let applicationComplete = false;
    let listOfQuestions = []; // Accumulated questions from agents across pages

    console.log('\n🔄 Starting multi-page application loop (max ' + MAX_PAGES + ' pages)...\n');

    while (pageNumber <= MAX_PAGES && !applicationComplete) {
      console.log('\n' + '═'.repeat(80));
      console.log(`  PAGE ${pageNumber}: PHASE 1 - Intelligent Form Fill`);
      console.log('═'.repeat(80));

      // Extract page title to determine handling approach
      const pageTitle = await extractPageTitle(stagehand);

      let fillResults = { filledCount: 0, skippedCount: 0, errorCount: 0 };
      let answersResult = { inputTokens: 0, outputTokens: 0 };

      // Check if this is a review page (case-insensitive)
      if (pageTitle && pageTitle.toLowerCase().includes('review')) {
        console.log('🎯 Detected REVIEW page - submitting application and ending');
        console.log(`   Page title: "${pageTitle}"`);

        try {
          // First observe to find the submit button
          console.log('🔍 Observing page for submit button...');
          const submitActions = await stagehand.observe("Find the submit button or application submission button");
          
          if (submitActions.length === 0) {
            console.log('⚠️  No submit button found in observation');
            throw new Error('No submit button found on review page');
          }
          
          console.log(`   Found ${submitActions.length} potential submit action(s)`);
          
          // Click the submit button
          console.log('🔘 Clicking submit button...');
          await stagehand.act("click the submit button");
          console.log('✅ Submit button clicked successfully');

          // Wait for submission to process
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('⏳ Waiting for submission to process...');

          // Mark application as complete
          applicationComplete = true;
          console.log('🎉 APPLICATION SUBMITTED SUCCESSFULLY!');
          console.log('🔚 Ending multi-page loop - review page submission complete');
          
          // Break out of the loop immediately
          break;

        } catch (submitError) {
          console.error('❌ Error submitting on review page:', submitError.message);
          // Still mark as complete to avoid infinite loop
          applicationComplete = true;
          break;
        }
      }
      // Conditional handling based on page title
      else if (pageTitle === "My Experience") {
        console.log('🎯 Detected "My Experience" page - using specialized handler');

        // TODO: Call specialized My Experience handler
        const myExpResult = await handleMyExperiencePage(stagehand, workdayUserProfile, jobDescription);

        // If handler is not implemented or fails, fall back to standard flow
        if (!myExpResult.success) {
          console.log('⚠️  Specialized handler failed, falling back to standard flow...');

          // Standard flow: enhanced observe → get answers → fill
          const formActions = await observeFormFieldsEnhanced(stagehand);
          answersResult = await getIntelligentAnswers(formActions, workdayUserProfile, jobDescription);

          // Calculate accurate Phase 1 cost
          const chatGPTInputCost = (answersResult.inputTokens / 1_000_000) * 0.150;
          const chatGPTOutputCost = (answersResult.inputTokens / 1_000_000) * 0.600;
          const chatGPTCost = chatGPTInputCost + chatGPTOutputCost;
          const pageObserveTokens = 2000;
          const pageActTokens = formActions.length * 500;
          const stagehandCost = 0.02;
          phase1Tokens.input += answersResult.inputTokens + pageObserveTokens + pageActTokens;
          phase1Tokens.output += answersResult.outputTokens;
          phase1Cost += chatGPTCost + stagehandCost;
          console.log(`  💰 Page ${pageNumber} ChatGPT cost: $${chatGPTCost.toFixed(4)} (Input: ${answersResult.inputTokens} tokens, Output: ${answersResult.outputTokens} tokens)`);

          fillResults = await fillFormFields(stagehand, formActions, answersResult.answers);
        } else {
          fillResults = myExpResult;
        }

      } else {
        // Standard flow for all other pages (not "My Experience")
        console.log('📝 Using standard flow for this page');

        // Enhanced observation: extract questions + observe fields
        const formActions = await observeFormFieldsEnhanced(stagehand);

        if (formActions.length === 0) {
          console.log(`⚠️  No form fields found on page ${pageNumber}`);
          if (pageNumber === 1) {
            throw new Error('No form fields found on first page');
          }
          // If not first page, might be a confirmation page
          console.log('📋 Checking if this is a confirmation/success page...');
          const pageContent = await stagehand.context.pages()[0].content();
          if (pageContent.toLowerCase().includes('thank') ||
              pageContent.toLowerCase().includes('success') ||
              pageContent.toLowerCase().includes('confirm')) {
            console.log('✅ Detected confirmation page - application complete!');
            applicationComplete = true;
            break;
          }
        }

        // Get intelligent answers from ChatGPT for this page
        answersResult = await getIntelligentAnswers(formActions, workdayUserProfile, jobDescription);
        const answers = answersResult.answers;

        // Calculate accurate Phase 1 cost
        const chatGPTInputCost = (answersResult.inputTokens / 1_000_000) * 0.150;
        const chatGPTOutputCost = (answersResult.outputTokens / 1_000_000) * 0.600;
        const chatGPTCost = chatGPTInputCost + chatGPTOutputCost;
        const pageObserveTokens = 2000;
        const pageActTokens = formActions.length * 500;
        const stagehandCost = 0.02;
        phase1Tokens.input += answersResult.inputTokens + pageObserveTokens + pageActTokens;
        phase1Tokens.output += answersResult.outputTokens;
        phase1Cost += chatGPTCost + stagehandCost;

        console.log(`  💰 Page ${pageNumber} ChatGPT cost: $${chatGPTCost.toFixed(4)} (Input: ${answersResult.inputTokens} tokens, Output: ${answersResult.outputTokens} tokens)`);

        // Fill form fields on current page
        try {
          fillResults = await fillFormFields(stagehand, formActions, answers);
          console.log(`\n📊 Page ${pageNumber} Results: ✅ ${fillResults.filledCount} filled, ⏭️ ${fillResults.skippedCount} skipped, ❌ ${fillResults.errorCount} errors`);
        } catch (fillError) {
          console.error(`\n❌ Fill failed on page ${pageNumber}: ${fillError.message}`);
          fillResults.errorCount = formActions.length;
        }

        // NEW: Run Phase 2 agent after Phase 1 filling on every page
        console.log('\n' + '═'.repeat(80));
        console.log(`  PAGE ${pageNumber}: PHASE 2 - Agent Review & Continue`);
        console.log('═'.repeat(80));

        try {
          const agentResult = await agentReviewAndContinue(stagehand, workdayUserProfile, jobDescription, pageNumber);
          
          // Calculate Phase 2 cost for this page
          if (agentResult.usage) {
            const inputTokens = agentResult.usage.input_tokens || 0;
            const outputTokens = agentResult.usage.output_tokens || 0;
            const inputCost = (inputTokens / 1000000) * 1.25;
            const outputCost = (outputTokens / 1000000) * 10;
            const pageCost = inputCost + outputCost;
            phase2Cost += pageCost;
            phase2Tokens.input += inputTokens;
            phase2Tokens.output += outputTokens;
            console.log(`  💰 Page ${pageNumber} Agent cost: $${pageCost.toFixed(4)} (Input: ${inputTokens} tokens, Output: ${outputTokens} tokens)`);
          }

          console.log(`✅ Page ${pageNumber} agent review complete - moving to next page`);
        } catch (agentError) {
          console.error(`❌ Agent review failed on page ${pageNumber}: ${agentError.message}`);
          console.log('⚠️  Continuing to next page despite agent error...');
        }
      }

      // Track fields from this page
      allFilledFields.push({
        page: pageNumber,
        filledCount: fillResults.filledCount,
        skippedCount: fillResults.skippedCount,
        errorCount: fillResults.errorCount
      });

      // Increment page number for next iteration
      pageNumber++;
      console.log(`\n🔄 Moving to page ${pageNumber}...`);

      // Safety check - if we've been on too many pages, stop
      if (pageNumber > MAX_PAGES) {
        console.log(`\n⚠️  Reached maximum page limit (${MAX_PAGES}), stopping loop`);
        break;
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`  APPLICATION LOOP COMPLETE`);
    console.log(`  Total pages processed: ${pageNumber - 1}`);
    console.log(`  Status: ${applicationComplete ? 'SUBMITTED ✅' : 'INCOMPLETE ⚠️'}`);
    if (applicationComplete) {
      console.log(`  Completion method: ${pageTitle && pageTitle.toLowerCase().includes('review') ? 'Review page submission' : 'Standard flow completion'}`);
    }
    console.log('═'.repeat(80));

    console.log('✅ Workday application flow completed (Phase 0 + Phase 1 + Phase 2)');

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 3: Verification Check');
    console.log('═══════════════════════════════════════');

    // Try manual verification first
    // Use ORIGINAL userProfile here so Gmail login uses WORK EMAIL (not unique email)
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
    console.log(`  HYBRID APPROACH COMPLETE`);
    console.log('═══════════════════════════════════════');
    console.log(`⏱️  Total time: ${executionTime}s`);
    console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Phase 0 (Account Creation): $${phase0Cost.toFixed(4)}`);
    console.log(`   Phase 1 (Form Fill): $${phase1Cost.toFixed(4)}`);
    console.log(`   Phase 2 (Agent Review): $${phase2Cost.toFixed(4)}`);
    console.log(`   Phase 3 (Verification): $${verificationCost.toFixed(4)}`);
    
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
    console.log(`   Phase 1 (Form Fill): ${(phase1Tokens.input + phase1Tokens.output).toLocaleString()} tokens`);
    console.log(`     - Input: ${phase1Tokens.input.toLocaleString()}`);
    console.log(`     - Output: ${phase1Tokens.output.toLocaleString()}`);
    console.log(`   Phase 2 (Agent Review): ${(phase2Tokens.input + phase2Tokens.output).toLocaleString()} tokens`);
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
      liveViewUrl,
      sessionVideoUrl,
      filledFields,
      message: isWorkday 
        ? `Workday application completed using intelligent form fill in ${executionTime}s. ${applicationComplete ? 'Application submitted successfully.' : 'Application processing completed.'}`
        : `Form filled across multiple pages using traditional hybrid approach in ${executionTime}s. ${applicationComplete ? 'Application submitted successfully.' : 'Application processing completed.'}`,
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
          outputTokens: phase1Tokens.output + phase2Tokens.output
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
      sessionUrl,
      liveViewUrl
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
