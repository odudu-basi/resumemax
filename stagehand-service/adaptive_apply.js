const { z } = require('zod');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Comprehensive adaptive form filling with Stagehand best practices
const adaptiveFormFill = async (stagehand, userProfile, sessionId, sessionUrl, res) => {
  console.log('🤖 Starting optimized adaptive form filling with Stagehand v3...');

  const firstName = userProfile.fullName.split(' ')[0] || '';
  const lastName = userProfile.fullName.split(' ').slice(1).join(' ') || '';

  try {
    // ========== PHASE 1: Handle Resume Upload ONLY ==========
    console.log('\n📎 PHASE 1: Handling resume upload...');

    if (userProfile.resumeFile || userProfile.resumePath || userProfile.resumeUrl) {
      try {
        const resumeFilePath = userProfile.resumeFile || userProfile.resumePath;

        if (resumeFilePath) {
          console.log(`  📄 Attempting to upload resume: ${resumeFilePath}`);

          // Try multiple upload methods with Stagehand's self-healing act()
          const uploadActions = [
            `upload the file "${resumeFilePath}" to the resume upload field`,
            `attach the file "${resumeFilePath}" to the resume field`,
            `select and upload the file "${resumeFilePath}"`,
            `upload the file "${resumeFilePath}" to the CV upload field`,
            `upload the file "${resumeFilePath}" to the file upload field`
          ];

          let uploaded = false;
          for (const action of uploadActions) {
            try {
              await stagehand.act(action);
              console.log(`  ✅ Resume uploaded successfully`);
              uploaded = true;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for upload to process
              break;
            } catch (error) {
              continue; // Try next method
            }
          }

          if (!uploaded) {
            console.log(`  ⚠️ Could not upload resume - field may not exist on this page`);
          }
        } else if (userProfile.resumeUrl) {
          console.log(`  ℹ️  Resume URL provided: ${userProfile.resumeUrl}`);
        }
      } catch (error) {
        console.log(`  ⚠️ Resume upload error: ${error.message}`);
      }
    } else {
      console.log('  ℹ️  No resume file provided, skipping upload');
    }

    // ========== PHASE 2: Scoped Observe for Form Discovery ==========
    console.log('\n🔍 PHASE 2: Discovering form structure with scoped observe...');

    // Step 2A: Find the form container
    let formSelector = null;
    try {
      const [formContainer] = await stagehand.observe(
        "Find the main job application form container where candidates enter their information"
      );

      if (formContainer && formContainer.selector) {
        formSelector = formContainer.selector;
        console.log(`  ✅ Found form container`);
      } else {
        console.log(`  ⚠️ Could not find specific form container, will search entire page`);
      }
    } catch (error) {
      console.log(`  ⚠️ Form container discovery failed: ${error.message}`);
    }

    // Step 2B: Discover all form fields (scoped to form if found)
    console.log('\n  🔍 Discovering all form fields...');
    const observeOptions = formSelector ? { selector: formSelector } : {};

    let formFields = [];
    try {
      formFields = await stagehand.observe(
        "Find all form fields that need to be filled: text inputs, email inputs, phone inputs, dropdowns, textareas, radio buttons, checkboxes, and date fields. Do NOT include submit buttons, apply buttons, or navigation links.",
        observeOptions
      );
      console.log(`  ✅ Discovered ${formFields.length} form elements`);
    } catch (error) {
      console.log(`  ⚠️ Field discovery failed: ${error.message}`);
      throw new Error('Could not discover form fields');
    }

    if (formFields.length === 0) {
      console.log('  ⚠️ No form fields found - form may be on another page');
      throw new Error('No form fields discovered');
    }

    // ========== PHASE 3: Convert Observed Fields to Structured Format ==========
    console.log('\n📋 PHASE 3: Converting observed fields to structured format...');

    // Map observed elements to our field structure
    const formData = { fields: [] };
    const seenLabels = new Set();

    for (const element of formFields) {
      try {
        // Extract description which contains the label/question
        const description = element.description || '';
        const method = element.method || 'fill';

        // Parse field type from description and method
        let fieldType = 'text';
        const descLower = description.toLowerCase();

        if (descLower.includes('dropdown') || method === 'selectOption') {
          fieldType = 'dropdown';
        } else if (descLower.includes('textarea')) {
          fieldType = 'textarea';
        } else if (descLower.includes('checkbox')) {
          fieldType = 'checkbox';
        } else if (descLower.includes('radio')) {
          fieldType = 'radio';
        } else if (descLower.includes('email')) {
          fieldType = 'email';
        } else if (descLower.includes('phone')) {
          fieldType = 'phone';
        } else if (descLower.includes('date')) {
          fieldType = 'date';
        } else if (descLower.includes('number')) {
          fieldType = 'number';
        }

        // Extract label from description (remove "Text input for", "Dropdown for", etc.)
        let label = description
          .replace(/^(Text input for|Dropdown for|Textarea for|Checkbox for|Radio for)\s*/i, '')
          .trim();

        if (!label) {
          console.log(`  ⚠️ Skipping element with no label`);
          continue;
        }

        // Deduplicate by normalized label
        const normalizedLabel = label.toLowerCase().trim();
        if (seenLabels.has(normalizedLabel)) {
          console.log(`  ⏭️  Skipping duplicate: "${label}"`);
          continue;
        }
        seenLabels.add(normalizedLabel);

        // Determine category from label
        let category = 'other';
        const labelLower = label.toLowerCase();
        if (labelLower.includes('name') || labelLower.includes('email') || labelLower.includes('phone') || labelLower.includes('address') || labelLower.includes('linkedin') || labelLower.includes('website') || labelLower.includes('portfolio')) {
          category = 'contact';
        } else if (labelLower.includes('experience') || labelLower.includes('years') || labelLower.includes('title') || labelLower.includes('company')) {
          category = 'experience';
        } else if (labelLower.includes('education') || labelLower.includes('degree') || labelLower.includes('school') || labelLower.includes('university')) {
          category = 'education';
        } else if (labelLower.includes('visa') || labelLower.includes('sponsor') || labelLower.includes('authorization') || labelLower.includes('eligible')) {
          category = 'authorization';
        } else if (labelLower.includes('skill') || labelLower.includes('language') || labelLower.includes('proficiency')) {
          category = 'skills';
        } else if (labelLower.includes('location') || labelLower.includes('remote') || labelLower.includes('relocation') || labelLower.includes('where')) {
          category = 'preferences';
        } else if (labelLower.includes('why') || labelLower.includes('describe') || labelLower.includes('tell us') || labelLower.includes('cover letter') || labelLower.includes('additional information')) {
          category = 'essay';
        }

        formData.fields.push({
          label: label,
          fieldType: fieldType,
          method: method,
          selector: element.selector,
          required: descLower.includes('required') || descLower.includes('*'),
          category: category
        });

        console.log(`  📌 Field ${formData.fields.length}: "${label}" (${fieldType}, ${category})`);

      } catch (error) {
        console.log(`  ⚠️ Could not process field: ${error.message}`);
      }
    }

    console.log(`\n  ✅ Processed ${formData.fields.length} unique fields`);

    if (formData.fields.length === 0) {
      throw new Error('No fields extracted from form');
    }

    // ========== PHASE 4: Batched AI Answer Generation ==========
    console.log('\n🧠 PHASE 4: Generating answers with batched AI call...');

    // Build comprehensive user context
    const userContext = `
USER PROFILE:
Name: ${userProfile.fullName}
Email: ${userProfile.email}
Phone: ${userProfile.phone}
Location: ${userProfile.location}
LinkedIn: ${userProfile.linkedinUrl || 'N/A'}

WORK EXPERIENCE:
${userProfile.workExperience.map((exp, i) => `${i + 1}. ${exp.title} at ${exp.company} (${exp.duration})
   ${exp.description}`).join('\n')}

EDUCATION:
${userProfile.education.map((edu, i) => `${i + 1}. ${edu.degree} in ${edu.field} from ${edu.school} (${edu.year})`).join('\n')}

SKILLS:
Technical: ${userProfile.skills.technical.join(', ')}
Languages: ${userProfile.skills.languages.join(', ')}

WORK AUTHORIZATION:
Work Authorized: ${userProfile.workAuthorized ? 'Yes' : 'No'}
Requires Sponsorship: ${userProfile.requiresSponsorship ? 'Yes' : 'No'}

Years of Experience: ${userProfile.yearsOfExperience}
`;

    let fieldAnswers = [];

    // Generate answers for all fields in one batched call
    if (formData.fields.length > 0) {
      try {
        const fieldQuestions = formData.fields.map((f, i) => {
          return `${i + 1}. "${f.label}" [${f.fieldType}]`;
        }).join('\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are helping fill out a job application form. Provide the BEST ANSWER for each field based on the user's profile.

RULES:
1. Answer naturally and accurately based on the user's profile
2. Use logical inference when information isn't explicitly stated
3. For dropdowns/radios: Provide the most appropriate option
4. For yes/no questions: Answer "Yes" or "No"
5. For visa sponsorship: Use the user's requiresSponsorship value
6. For work authorization: Use the user's workAuthorized value
7. For location/country: Use user's location from profile
8. For experience: Use exact values from profile
9. For email/phone: Use exact values provided
10. Keep text input answers SHORT and DIRECT (under 50 words)
11. For textarea/essay fields: Provide 2-3 sentences
12. If the field asks for information not in the profile, make a reasonable inference or say "N/A"

Respond in JSON format.`
            },
            {
              role: "user",
              content: `${userContext}

Please provide the best answer for ALL of these form fields:

${fieldQuestions}

Respond ONLY with a JSON object in this exact format:
{
  "answers": [
    "answer for field 1",
    "answer for field 2",
    "answer for field 3"
  ]
}`
            }
          ],
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        fieldAnswers = response.answers || [];
        console.log(`  ✅ Generated ${fieldAnswers.length} answers via batched AI call`);
      } catch (error) {
        console.log(`  ⚠️ Batched AI call failed: ${error.message}`);
        throw new Error('Failed to generate form answers');
      }
    }

    // Handle essay/textarea fields separately for longer, more detailed content
    const essayFields = formData.fields
      .map((f, i) => ({ field: f, index: i, answer: fieldAnswers[i] }))
      .filter(({ field, answer }) => {
        const label = field.label.toLowerCase();
        const isEssayType = field.fieldType === 'textarea' ||
                           field.category === 'essay' ||
                           label.includes('why') ||
                           label.includes('describe') ||
                           label.includes('tell us') ||
                           label.includes('cover letter') ||
                           label.includes('additional information');
        const needsMoreDetail = !answer || answer.length < 100;
        return isEssayType && needsMoreDetail;
      });

    if (essayFields.length > 0) {
      console.log(`\n  📄 Generating detailed responses for ${essayFields.length} essay fields...`);
      try {
        const essayQuestions = essayFields.map(({ field }, i) =>
          `${i + 1}. "${field.label}"`
        ).join('\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are helping write thoughtful, professional responses for job application essay questions.

GUIDELINES:
- Write in first person
- Be specific and use concrete examples from the user's experience
- Show enthusiasm and cultural fit
- Keep each answer between 100-300 words
- Use professional but conversational tone
- Highlight relevant skills and achievements`
            },
            {
              role: "user",
              content: `${userContext}

Please provide detailed, compelling answers for these essay questions:

${essayQuestions}

Respond with a JSON object: {"answers": ["answer1", "answer2", ...]}`
            }
          ],
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        const detailedAnswers = response.answers || [];

        // Update fieldAnswers with detailed essay responses
        essayFields.forEach(({ index }, i) => {
          if (i < detailedAnswers.length) {
            fieldAnswers[index] = detailedAnswers[i];
          }
        });

        console.log(`  ✅ Generated ${detailedAnswers.length} detailed essay responses`);
      } catch (error) {
        console.log(`  ⚠️ Essay generation failed: ${error.message}`);
      }
    }

    // ========== PHASE 5: Fill Fields with Secure Variables ==========
    console.log('\n✍️ PHASE 5: Filling form fields with secure act() calls...');

    let filledCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < formData.fields.length; i++) {
      const field = formData.fields[i];
      const answer = fieldAnswers[i];

      // Skip empty or N/A answers
      if (!answer || answer.trim() === '' || answer.trim() === 'N/A') {
        console.log(`  ⏭️  Skipping "${field.label}" - no answer available`);
        skippedCount++;
        continue;
      }

      try {
        // Check if field contains sensitive data
        const sensitiveKeywords = ['email', 'phone', 'ssn', 'social security', 'password', 'salary'];
        const isSensitive = sensitiveKeywords.some(keyword =>
          field.label.toLowerCase().includes(keyword)
        );

        let filled = false;

        if (isSensitive) {
          // Use Stagehand's secure variable syntax for sensitive data
          console.log(`  🔒 Filling sensitive field "${field.label}" with secure variables...`);
          try {
            await stagehand.act(`fill the "${field.label}" field with %secureValue%`, {
              variables: { secureValue: answer }
            });
            filled = true;
          } catch (error) {
            // Fallback without variable syntax
            await stagehand.act(`type %secureValue% into the "${field.label}" field`, {
              variables: { secureValue: answer }
            });
            filled = true;
          }
        } else {
          // Regular fill for non-sensitive fields
          if (field.fieldType === 'dropdown' || field.fieldType === 'radio') {
            // For dropdowns and radios, use selection language
            await stagehand.act(`For the field "${field.label}", select the option that best matches: "${answer}"`);
            filled = true;
          } else if (field.fieldType === 'checkbox') {
            // For checkboxes, use check/uncheck language
            const shouldCheck = ['yes', 'true', '1', 'checked'].includes(answer.toLowerCase());
            if (shouldCheck) {
              await stagehand.act(`check the "${field.label}" checkbox`);
              filled = true;
            } else {
              console.log(`  ⏭️  Skipping checkbox "${field.label}" - answer is No/False`);
              skippedCount++;
              continue;
            }
          } else if (field.fieldType === 'textarea') {
            // For textareas, use fill language
            await stagehand.act(`fill the "${field.label}" textarea with "${answer}"`);
            filled = true;
          } else {
            // For text inputs (text, email, phone, number, url, date)
            await stagehand.act(`fill the "${field.label}" field with "${answer}"`);
            filled = true;
          }
        }

        if (filled) {
          filledCount++;
          const displayAnswer = answer.length > 50 ? answer.substring(0, 50) + '...' : answer;
          console.log(`  ✅ [${filledCount}/${formData.fields.length}] Filled "${field.label}": ${displayAnswer}`);

          // Small delay to allow DOM updates
          await new Promise(resolve => setTimeout(resolve, 400));
        }

      } catch (error) {
        errorCount++;
        console.log(`  ❌ Failed to fill "${field.label}": ${error.message}`);
        // Continue to next field instead of failing entire process
      }
    }

    console.log(`\n  📊 Fill Summary: ${filledCount} filled, ${skippedCount} skipped, ${errorCount} errors`);

    // ========== PHASE 6: Submit Application ==========
    console.log('\n🚀 PHASE 6: Submitting application...');

    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for any final validation

    try {
      const submitActions = [
        'click the "Submit Application" button',
        'click the "Submit" button',
        'click the submit button',
        'click the "Apply" button',
        'click the apply button',
        'click the "Continue" button',
        'click the "Next" button',
        'click the primary submit button at the bottom of the form'
      ];

      let submitted = false;
      for (const action of submitActions) {
        try {
          await stagehand.act(action);
          console.log(`  ✅ Application submitted successfully: ${action}`);
          submitted = true;
          break;
        } catch (error) {
          continue; // Try next action
        }
      }

      if (!submitted) {
        console.log('  ⚠️ Could not find submit button - application may require manual submission');
      }
    } catch (error) {
      console.log('  ⚠️ Error during submission:', error.message);
    }

    // Wait for submission to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n✅ Form filling process completed!');

    // Close Stagehand session
    await stagehand.close();

    // Return success response
    res.json({
      success: true,
      sessionId,
      sessionUrl,
      message: `Application completed successfully. Filled ${filledCount} out of ${formData.fields.length} fields.`,
      stats: {
        totalFields: formData.fields.length,
        fieldsFilled: filledCount,
        fieldsSkipped: skippedCount,
        fieldsErrored: errorCount,
        successRate: `${Math.round((filledCount / formData.fields.length) * 100)}%`
      }
    });

  } catch (error) {
    console.error('\n❌ Fatal error in adaptive form fill:', error);

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
      sessionId,
      sessionUrl
    });
  }
};

module.exports = { adaptiveFormFill };
