const { z } = require('zod');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Comprehensive adaptive form filling with BATCHED AI calls for efficiency
const adaptiveFormFill = async (stagehand, userProfile, sessionId, sessionUrl, res) => {
  console.log('🤖 Starting multi-phase adaptive form filling with batched AI...');

  const firstName = userProfile.fullName.split(' ')[0] || '';
  const lastName = userProfile.fullName.split(' ').slice(1).join(' ') || '';

  try {
    // ========== PHASE 1: Handle Resume Upload & Fill Basic Contact Info ==========
    console.log('\n📝 PHASE 1: Handling resume upload and basic contact information...');

    // 1.1: Handle resume upload if resume file is provided
    if (userProfile.resumeFile || userProfile.resumePath || userProfile.resumeUrl) {
      console.log('  📎 Looking for resume upload field...');
      try {
        const resumeFilePath = userProfile.resumeFile || userProfile.resumePath;
        
        if (resumeFilePath) {
          // Upload from local file path - Try multiple methods
          let uploaded = false;
          
          // METHOD 1: Standard upload with "resume" field
          try {
            await stagehand.act(`upload the file "${resumeFilePath}" to the resume upload field`);
            console.log(`  ✅ Uploaded resume from: ${resumeFilePath}`);
            uploaded = true;
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for upload to process
          } catch (e1) {
            // METHOD 2: Try "attach file"
            try {
              await stagehand.act(`attach the file "${resumeFilePath}" to the resume field`);
              console.log(`  ✅ Uploaded resume from: ${resumeFilePath} (Method 2)`);
              uploaded = true;
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (e2) {
              // METHOD 3: Try generic file upload
              try {
                await stagehand.act(`select and upload the file "${resumeFilePath}"`);
                console.log(`  ✅ Uploaded resume from: ${resumeFilePath} (Method 3)`);
                uploaded = true;
                await new Promise(resolve => setTimeout(resolve, 1500));
              } catch (e3) {
                // METHOD 4: Try CV upload
                try {
                  await stagehand.act(`upload the file "${resumeFilePath}" to the CV upload field`);
                  console.log(`  ✅ Uploaded resume from: ${resumeFilePath} (Method 4)`);
                  uploaded = true;
                  await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (e4) {
                  console.log(`  ⚠️ Could not upload resume file: ${e4.message}`);
                }
              }
            }
          }
        } else if (userProfile.resumeUrl) {
          console.log(`  ℹ️  Resume URL provided: ${userProfile.resumeUrl}`);
        }
      } catch (error) {
        console.log(`  ⚠️ Resume upload error: ${error.message}`);
      }
    }

    // 1.2: Fill basic contact information

    const basicFields = [
      { value: firstName, labels: ['First Name', 'first name', 'First', 'Given Name'] },
      { value: lastName, labels: ['Last Name', 'last name', 'Last', 'Surname', 'Family Name'] },
      { value: userProfile.email, labels: ['Email', 'email', 'Email Address', 'E-mail'] },
      { value: userProfile.phone, labels: ['Phone', 'phone', 'Phone Number', 'Mobile', 'Telephone'] },
    ];

    for (const field of basicFields) {
      for (const label of field.labels) {
        try {
          await stagehand.act(`type "${field.value}" into the "${label}" field`);
          console.log(`  ✅ Filled ${label}: ${field.value}`);
          await new Promise(resolve => setTimeout(resolve, 300));
          break; // Success, move to next field
        } catch (error) {
          // Try next label variation
          continue;
        }
      }
    }

    // ========== PHASE 2: Discover All Form Elements (Two-Step Approach) ==========
    console.log('\n🔍 PHASE 2A: Locating application form container...');
    
    // Step 1: Find the form first
    let formContainer = null;
    try {
      formContainer = await stagehand.observe("Find the main job application form on this page where candidates enter their information");
      console.log(`  ✅ Found form container`);
    } catch (error) {
      console.log(`  ⚠️ Could not locate specific form container, will search entire page`);
    }

    console.log('\n🔍 PHASE 2B: Discovering ALL form fields (no classification)...');
    
    const elements = await stagehand.observe("Find all form fields that need to be filled in this job application: text input boxes, dropdowns, textareas, radio buttons, and checkboxes. Do NOT include submit buttons, apply buttons, or navigation links.");

    console.log(`  Found ${elements.length} form elements`);

    // ========== PHASE 3: Extract Labels & Deduplicate ==========
    console.log('\n📋 PHASE 3: Extracting labels and deduplicating...');
    
    const fieldData = [];
    const seenLabels = new Set();
    
    for (const element of elements) {
      try {
        const elemStr = JSON.stringify(element);
        
        // Extract label and method
        const FieldSchema = z.object({
          label: z.string().describe("the label, question, or placeholder text for this field"),
          method: z.string().describe("the interaction method: 'type' for text inputs/textareas, 'click' for dropdowns/radios/checkboxes")
        });

        const fieldInfo = await stagehand.extract(`What is the label and interaction method for this form field? Element: ${elemStr.slice(0, 200)}`, FieldSchema);

        // Deduplicate by normalized label
        const normalizedLabel = fieldInfo.label.toLowerCase().trim();
        if (seenLabels.has(normalizedLabel)) {
          console.log(`    ⏭️  Skipping duplicate: "${fieldInfo.label}"`);
          continue;
        }
        seenLabels.add(normalizedLabel);

        fieldData.push({
          element: element,
          label: fieldInfo.label,
          method: fieldInfo.method.toLowerCase(),
          index: fieldData.length
        });

        console.log(`    📌 Field ${fieldData.length}: "${fieldInfo.label}" (${fieldInfo.method})`);
      } catch (error) {
        console.log(`    ⚠️ Could not extract field: ${error.message}`);
      }
    }

    console.log(`\n  ✅ Extracted ${fieldData.length} unique fields`);

    // ========== PHASE 4: BATCHED AI CALL - Get All Answers at Once ==========
    console.log('\n🧠 PHASE 4: Using batched AI call to generate all answers...');

    let fieldAnswers = [];

    if (fieldData.length > 0) {
      try {
        const fieldQuestions = fieldData.map((f, i) => 
          `${i + 1}. "${f.label}"`
        ).join('\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are helping fill out a job application. Provide the BEST ANSWER for each field based on the user's profile. Answer naturally and concisely. Use logical inference when information isn't explicitly stated. Respond in JSON format."
            },
            {
              role: "user",
              content: `${userContext}\n\nPlease provide the best answer for ALL of these form fields:\n\n${fieldQuestions}\n\nIMPORTANT RULES:\n1. Answer naturally and accurately based on the user's profile\n2. Use logical inference: If not explicitly stated, infer from context\n3. For visa sponsorship: Assume NO if not specified\n4. For work authorization: Answer YES if US-based location\n5. For location/country: Use user's location from profile\n6. For yes/no questions: Answer "Yes" or "No"\n7. For experience/education: Use exact values from profile\n8. Keep answers SHORT and DIRECT\n9. For textareas asking for descriptions: Provide 2-3 sentences\n\nRespond ONLY with a JSON object in this exact format:\n{\n  "answers": [\n    "answer for field 1",\n    "answer for field 2",\n    "answer for field 3"\n  ]\n}`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        fieldAnswers = response.answers || [];
        console.log(`  ✅ Generated ${fieldAnswers.length} answers via batched AI call`);
      } catch (error) {
        console.log(`  ⚠️ Batched AI call failed: ${error.message}`);
      }
    }

    // Also handle textareas separately for longer content
    const textareaFields = fieldData.filter((f, i) => {
      const answer = fieldAnswers[i] || '';
      const label = f.label.toLowerCase();
      return (label.includes('why') || label.includes('describe') || label.includes('tell us') || 
              label.includes('experience') || label.includes('cover letter')) && answer.length < 100;
    });

    if (textareaFields.length > 0) {
      console.log(`\n  📄 Generating detailed answers for ${textareaFields.length} textarea fields...`);
      try {
        const textareaQuestions = textareaFields.map((f) => 
          `"${f.label}"`
        ).join('\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are helping fill out a job application. Generate professional, detailed responses for essay questions. Keep each answer under 500 words."
            },
            {
              role: "user",
              content: `${userContext}\n\nPlease provide detailed answers for these questions:\n\n${textareaQuestions}\n\nRespond with a JSON object: {"answers": ["answer1", "answer2"]}`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        const detailedAnswers = response.answers || [];
        
        // Update fieldAnswers with detailed answers
        let detailedIdx = 0;
        for (let i = 0; i < fieldData.length; i++) {
          if (textareaFields.includes(fieldData[i]) && detailedIdx < detailedAnswers.length) {
            fieldAnswers[i] = detailedAnswers[detailedIdx];
            detailedIdx++;
          }
        }
        console.log(`  ✅ Generated ${detailedAnswers.length} detailed textarea answers`);
      } catch (error) {
        console.log(`  ⚠️ Detailed textarea AI call failed: ${error.message}`);
      }
    }

    // ========== PHASE 5: Fill All Fields Using Conditional Logic ==========
    console.log('\n✍️ PHASE 5: Filling all fields with conditional logic...');

    let filledCount = 0;

    for (let i = 0; i < fieldData.length; i++) {
      const field = fieldData[i];
      const answer = fieldAnswers[i];

      if (!answer || answer.trim() === '' || answer === 'N/A') {
        console.log(`  ⏭️  Skipping "${field.label}" - no answer`);
        continue;
      }

      try {
        let filled = false;

        // CONDITIONAL: Use method to determine how to fill
        if (field.method === 'type' || field.method.includes('type') || field.method.includes('fill')) {
          // TEXT INPUT / TEXTAREA - Use type/fill
          try {
            await stagehand.act(`fill the "${field.label}" field with "${answer}"`);
            filled = true;
            filledCount++;
            console.log(`  ✅ Filled "${field.label}": ${answer.substring(0, 50)}...`);
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (e1) {
            try {
              await stagehand.act(`type "${answer}" into the "${field.label}" field`);
              filled = true;
              filledCount++;
              console.log(`  ✅ Filled "${field.label}" (Method 2)`);
              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e2) {
              console.log(`  ❌ Failed to fill "${field.label}"`);
            }
          }
        } else if (field.method === 'click' || field.method.includes('click') || field.method.includes('select')) {
          // DROPDOWN / RADIO / CHECKBOX - Use select/click
          try {
            await stagehand.act(`For the field "${field.label}", select the option that best matches: "${answer}"`);
            filled = true;
            filledCount++;
            console.log(`  ✅ Selected "${field.label}": ${answer}`);
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e1) {
            try {
              await stagehand.act(`Select "${answer}" for "${field.label}"`);
              filled = true;
              filledCount++;
              console.log(`  ✅ Selected "${field.label}" (Method 2)`);
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e2) {
              console.log(`  ❌ Failed to select "${field.label}"`);
            }
          }
        }
      } catch (error) {
        console.log(`  ⚠️ Error with field ${i + 1}: ${error.message}`);
      }
    }

    // ========== PHASE 6: Submit Application ==========
    console.log('\n🚀 PHASE 6: Submitting application...');

    try {
      const submitVariations = [
        'click the "Submit Application" button',
        'click the "Submit" button',
        'click the submit button',
        'click the "Apply" button',
        'click the apply button',
        'click the "Continue" button',
        'click the "Next" button',
        'click the button to submit',
        'click the button to continue'
      ];

      let submitted = false;
      for (const action of submitVariations) {
        try {
          await stagehand.act(action);
          console.log(`  ✅ Application submitted successfully with: ${action}`);
          submitted = true;
          break;
        } catch (error) {
          continue;
        }
      }

      if (!submitted) {
        console.log('  ⚠️ Could not find submit button - application may need manual submission');
      }
    } catch (error) {
      console.log('  ⚠️ Error during submission:', error.message);
    }

    // Wait before closing
    await new Promise(resolve => setTimeout(resolve, 2000));
    await stagehand.close();

    res.json({
      success: true,
      sessionId,
      sessionUrl,
      message: `Application completed. Filled ${filledCount} out of ${totalFields} fields.`,
      fieldsFilled: filledCount,
      totalFields: totalFields,
      breakdown: {
        textareas: textareaAnswers.length,
        dropdowns: dropdownSelections.length,
        radios: radioSelections.length,
        checkboxes: checkboxDecisions.length
      }
    });

  } catch (error) {
    console.error('❌ Error in adaptive form fill:', error);
    try {
      await stagehand.close();
    } catch (e) {
      // Ignore close errors
    }
    throw error;
  }
};

module.exports = { adaptiveFormFill };
