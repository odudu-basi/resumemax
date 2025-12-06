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
    // ========== PHASE 1: Fill Basic Contact Info First ==========
    console.log('\n📝 PHASE 1: Filling basic contact information...');

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

    console.log('\n🔍 PHASE 2B: Discovering form input fields...');
    
    // Step 2: Find inputs within the form (or entire page if form not found)
    const elements = await stagehand.observe("Find all input elements that need to be filled out in this job application form: text input boxes where you type information, dropdown select menus where you choose options, large text areas for longer answers, radio button groups for single choices, and checkboxes for yes/no or multiple selections. Do NOT include: submit buttons, apply buttons, upload buttons, download buttons, or any links.");

    console.log(`  Found ${elements.length} interactive elements`);

    // Categorize elements by type with better parsing
    const textFields = [];
    const textareas = [];
    const dropdowns = [];
    const radioGroups = [];
    const checkboxes = [];
    const fileUploads = [];

    for (const elem of elements) {
      const elemStr = JSON.stringify(elem).toLowerCase();
      const elemType = elem.type || '';

      if (elemStr.includes('file') || elemType === 'file') {
        fileUploads.push(elem);
      } else if (elemStr.includes('textarea') || elemType === 'textarea') {
        textareas.push(elem);
      } else if (elemStr.includes('select') || elemStr.includes('dropdown') || elemType === 'select') {
        dropdowns.push(elem);
      } else if (elemStr.includes('radio') || elemType === 'radio') {
        radioGroups.push(elem);
      } else if (elemStr.includes('checkbox') || elemType === 'checkbox') {
        checkboxes.push(elem);
      } else if (elemStr.includes('input') || elemStr.includes('text') || elemType === 'text') {
        textFields.push(elem);
      }
    }

    // Filter out obvious non-form-fields (buttons, links, navigation)
    console.log(`  🧹 Filtering out non-form elements...`);
    const filterNonFormFields = (elements, typeName) => {
      return elements.filter(elem => {
        const elemStr = JSON.stringify(elem).toLowerCase();
        
        // Exclude if description mentions button/link actions
        if (elem.description) {
          const desc = elem.description.toLowerCase();
          if (desc.includes('button to') || desc.includes('link to') || 
              desc.includes('click') && (desc.includes('submit') || desc.includes('apply'))) {
            console.log(`    ⏭️  Excluded ${typeName}: "${elem.description}"`);
            return false;
          }
        }
        
        // Exclude if method is click and looks like navigation
        if (elem.method === 'click' && (elemStr.includes('button') || elemStr.includes('link'))) {
          return false;
        }
        
        return true;
      });
    };

    const filteredTextFields = filterNonFormFields(textFields, 'text field');
    const filteredTextareas = filterNonFormFields(textareas, 'textarea');
    const filteredDropdowns = filterNonFormFields(dropdowns, 'dropdown');
    const filteredRadioGroups = filterNonFormFields(radioGroups, 'radio');
    const filteredCheckboxes = filterNonFormFields(checkboxes, 'checkbox');
    const filteredFileUploads = filterNonFormFields(fileUploads, 'file upload');

    console.log(`  📊 After filtering: ${filteredTextFields.length} text, ${filteredTextareas.length} textarea, ${filteredDropdowns.length} dropdown, ${filteredRadioGroups.length} radio, ${filteredCheckboxes.length} checkbox, ${filteredFileUploads.length} file`);
    
    // Use filtered lists going forward
    const finalTextFields = filteredTextFields;
    const finalTextareas = filteredTextareas;
    const finalDropdowns = filteredDropdowns;
    const finalRadioGroups = filteredRadioGroups;
    const finalCheckboxes = filteredCheckboxes;
    const finalFileUploads = filteredFileUploads;

    // ========== PHASE 3: Extract Information from All Elements ==========
    console.log('\n📋 PHASE 3: Extracting information from all form elements...');

    // Build user context once for all AI calls
    const userContext = `
User Profile:
- Name: ${userProfile.fullName}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone}
- Location: ${userProfile.location}
- LinkedIn: ${userProfile.linkedinUrl || 'N/A'}
- Portfolio: ${userProfile.portfolioUrl || 'N/A'}

Work Experience:
${userProfile.workExperience?.map((exp, i) => `${i + 1}. ${exp.title} at ${exp.company} (${exp.dates || 'Current'})\n   ${exp.description || ''}`).join('\n') || 'None'}

Education:
${userProfile.education?.map((edu, i) => `${i + 1}. ${edu.degree} - ${edu.school} (${edu.dates || ''})\n   ${edu.details || ''}`).join('\n') || 'None'}

Skills:
- Technical: ${userProfile.skills?.technical?.join(', ') || 'N/A'}
- Soft: ${userProfile.skills?.soft?.join(', ') || 'N/A'}
`;

    // 3.1: Extract dropdown information
    console.log('  🎯 Extracting dropdown options...');
    const dropdownData = [];
    for (const dropdown of finalDropdowns.slice(0, 15)) { // Limit to first 15 dropdowns
      try {
        const DropdownSchema = z.object({
          label: z.string().describe("the dropdown label or question"),
          options: z.array(z.string()).describe("all available options in this dropdown")
        });

        const dropdownInfo = await stagehand.extract(`What is the label and what are all the options for this dropdown? Element: ${JSON.stringify(dropdown).slice(0, 200)}`, DropdownSchema);

        dropdownData.push({
          element: dropdown,
          label: dropdownInfo.label,
          options: dropdownInfo.options,
          index: dropdownData.length
        });

        console.log(`    📌 Dropdown ${dropdownData.length}: "${dropdownInfo.label}" - ${dropdownInfo.options.length} options`);
      } catch (error) {
        console.log(`    ⚠️ Could not extract dropdown: ${error.message}`);
      }
    }

    // 3.2: Extract textarea information
    console.log('  📄 Extracting textarea questions...');
    const textareaData = [];
    for (const textarea of finalTextareas.slice(0, 10)) { // Limit to first 10 textareas
      try {
        const textareaStr = JSON.stringify(textarea);
        const TextareaPurposeSchema = z.object({
          question: z.string().describe("What question or prompt is this textarea asking?"),
          type: z.string().describe("cover letter, why this company, work experience, project description, additional info, or other")
        });

        const textareaPurpose = await stagehand.extract(`What is this textarea asking for? Element: ${textareaStr.slice(0, 200)}`, TextareaPurposeSchema);

        textareaData.push({
          element: textarea,
          selector: textarea.selector || textarea.xpath || textareaStr.slice(0, 150),
          question: textareaPurpose.question,
          type: textareaPurpose.type,
          index: textareaData.length
        });

        console.log(`    📝 Textarea ${textareaData.length}: "${textareaPurpose.question}"`);
      } catch (error) {
        console.log(`    ⚠️ Could not extract textarea: ${error.message}`);
      }
    }

    // 3.3: Extract radio button information
    console.log('  🔘 Extracting radio button groups...');
    const radioData = [];
    for (const radio of finalRadioGroups.slice(0, 10)) { // Limit to first 10 radio groups
      try {
        const radioStr = JSON.stringify(radio);
        const RadioSchema = z.object({
          question: z.string().describe("What question is this radio group asking?"),
          options: z.array(z.string()).describe("What are the available radio button options?")
        });

        const radioInfo = await stagehand.extract(`What is this radio button group asking and what are the options? Element: ${radioStr.slice(0, 200)}`, RadioSchema);

        radioData.push({
          element: radio,
          question: radioInfo.question,
          options: radioInfo.options,
          index: radioData.length
        });

        console.log(`    ⚪ Radio ${radioData.length}: "${radioInfo.question}"`);
      } catch (error) {
        console.log(`    ⚠️ Could not extract radio: ${error.message}`);
      }
    }

    // 3.4: Extract checkbox information
    console.log('  ☑️  Extracting checkboxes...');
    const checkboxData = [];
    for (const checkbox of finalCheckboxes.slice(0, 15)) { // Limit to first 15 checkboxes
      try {
        const checkboxStr = JSON.stringify(checkbox);
        const CheckboxSchema = z.object({
          label: z.string().describe("What does this checkbox say or ask?"),
          type: z.string().describe("Is this: legal agreement, authorization, preference, or other?")
        });

        const checkboxInfo = await stagehand.extract(`What is this checkbox for? Element: ${checkboxStr.slice(0, 200)}`, CheckboxSchema);

        checkboxData.push({
          element: checkbox,
          label: checkboxInfo.label,
          type: checkboxInfo.type,
          index: checkboxData.length
        });

        console.log(`    ☐ Checkbox ${checkboxData.length}: "${checkboxInfo.label}"`);
      } catch (error) {
        console.log(`    ⚠️ Could not extract checkbox: ${error.message}`);
      }
    }

    console.log(`\n  ✅ Extracted: ${dropdownData.length} dropdowns, ${textareaData.length} textareas, ${radioData.length} radios, ${checkboxData.length} checkboxes`);

    // ========== PHASE 4: BATCHED AI CALLS - Make All Decisions at Once ==========
    console.log('\n🧠 PHASE 4: Using batched AI calls for intelligent decisions...');

    let textareaAnswers = [];
    let dropdownSelections = [];
    let radioSelections = [];
    let checkboxDecisions = [];

    // 4.1: BATCHED TEXTAREA AI CALL - Get all answers in one call
    if (textareaData.length > 0) {
      console.log(`  📄 Making batched AI call for ${textareaData.length} textareas...`);
      try {
        const textareaQuestions = textareaData.map((t, i) => `${i + 1}. ${t.question}`).join('\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are helping fill out a job application. Generate professional, concise responses for ALL questions. Keep each answer under 500 words. Respond in JSON format."
            },
            {
              role: "user",
              content: `${userContext}\n\nPlease answer ALL of the following application questions:\n\n${textareaQuestions}\n\nRespond ONLY with a JSON object in this exact format:\n{\n  "answers": [\n    "answer to question 1",\n    "answer to question 2",\n    "answer to question 3"\n  ]\n}\n\nProvide professional, compelling answers based on the user's profile. Be specific and use details from their experience.`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        textareaAnswers = response.answers || [];
        console.log(`    ✅ Generated ${textareaAnswers.length} textarea answers`);
      } catch (error) {
        console.log(`    ⚠️ Batched textarea AI call failed: ${error.message}`);
        console.log(`    ℹ️  Will use fallback for individual textareas`);
      }
    }

    // 4.2: BATCHED DROPDOWN AI CALL - Get all selections in one call
    if (dropdownData.length > 0) {
      console.log(`  🎯 Making batched AI call for ${dropdownData.length} dropdowns...`);
      try {
        const dropdownQuestions = dropdownData.map((d, i) =>
          `${i + 1}. "${d.label}"\n   Options: ${JSON.stringify(d.options)}`
        ).join('\n\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are helping fill out a job application. Select the most appropriate option for each dropdown based on the user's profile. Use logical inference when information isn't explicitly stated. For example: if user is a US citizen or green card holder, they don't need visa sponsorship (select 'No'). Respond in JSON format."
            },
            {
              role: "user",
              content: `${userContext}\n\nPlease select the best option for ALL of these dropdowns:\n\n${dropdownQuestions}\n\nIMPORTANT RULES:\n1. Each selection must be EXACTLY as written in the options list\n2. Use logical inference: If not explicitly stated, infer from context (e.g., US citizen = no visa sponsorship needed)\n3. For visa sponsorship: If user profile doesn't specify, assume they DON'T need sponsorship (select "No" or "I do not require sponsorship")\n4. For authorization questions: If location suggests they can work (e.g., US-based), select "Yes" or "Authorized"\n\nRespond ONLY with a JSON object in this exact format:\n{\n  "selections": [\n    "exact option text for dropdown 1",\n    "exact option text for dropdown 2",\n    "exact option text for dropdown 3"\n  ]\n}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        dropdownSelections = response.selections || [];
        console.log(`    ✅ Generated ${dropdownSelections.length} dropdown selections`);
      } catch (error) {
        console.log(`    ⚠️ Batched dropdown AI call failed: ${error.message}`);
        console.log(`    ℹ️  Will use fallback for individual dropdowns`);
      }
    }

    // 4.3: BATCHED RADIO AI CALL - Get all selections in one call
    if (radioData.length > 0) {
      console.log(`  🔘 Making batched AI call for ${radioData.length} radio groups...`);
      try {
        const radioQuestions = radioData.map((r, i) =>
          `${i + 1}. "${r.question}"\n   Options: ${JSON.stringify(r.options)}`
        ).join('\n\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are helping fill out a job application. Select the most appropriate radio button for each question. Respond in JSON format."
            },
            {
              role: "user",
              content: `${userContext}\n\nPlease select the best option for ALL of these radio button groups:\n\n${radioQuestions}\n\nRespond ONLY with a JSON object in this exact format:\n{\n  "selections": [\n    "exact option text for radio 1",\n    "exact option text for radio 2",\n    "exact option text for radio 3"\n  ]\n}\n\nIMPORTANT: Each selection must be EXACTLY as written in the options list.`
            }
          ],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        radioSelections = response.selections || [];
        console.log(`    ✅ Generated ${radioSelections.length} radio selections`);
      } catch (error) {
        console.log(`    ⚠️ Batched radio AI call failed: ${error.message}`);
        console.log(`    ℹ️  Will use fallback for individual radios`);
      }
    }

    // 4.4: BATCHED CHECKBOX AI CALL - Get all decisions in one call
    if (checkboxData.length > 0) {
      console.log(`  ☑️  Making batched AI call for ${checkboxData.length} checkboxes...`);
      try {
        const checkboxQuestions = checkboxData.map((c, i) =>
          `${i + 1}. "${c.label}" (type: ${c.type})`
        ).join('\n');

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are helping fill out a job application. Decide whether each checkbox should be checked. Respond in JSON format."
            },
            {
              role: "user",
              content: `${userContext}\n\nFor ALL of these checkboxes, decide if they should be checked:\n\n${checkboxQuestions}\n\nRespond ONLY with a JSON object in this exact format:\n{\n  "decisions": [\n    true,\n    false,\n    true\n  ]\n}\n\nUse true for checkboxes that should be checked, false for those that should not.`
            }
          ],
          temperature: 0.3,
          max_tokens: 300,
          response_format: { type: "json_object" }
        });

        const response = JSON.parse(completion.choices[0].message.content);
        checkboxDecisions = response.decisions || [];
        console.log(`    ✅ Generated ${checkboxDecisions.length} checkbox decisions`);
      } catch (error) {
        console.log(`    ⚠️ Batched checkbox AI call failed: ${error.message}`);
        console.log(`    ℹ️  Will use fallback for individual checkboxes`);
      }
    }

    // ========== PHASE 5: Fill All Fields with Batched AI Responses ==========
    console.log('\n✍️ PHASE 5: Filling all discovered fields with batched AI responses...');

    let filledCount = 0;
    const totalFields = finalTextFields.length + finalTextareas.length + finalDropdowns.length + finalRadioGroups.length + finalCheckboxes.length + finalFileUploads.length;

    // 5.1: Fill text fields with smart matching
    console.log('  📝 Filling text fields...');
    for (const field of finalTextFields) {
      try {
        const fieldStr = JSON.stringify(field);
        const selector = field.selector || field.xpath || fieldStr.slice(0, 150);

        const FieldPurposeSchema = z.object({
          purpose: z.string().describe("What is this field for? (e.g., firstName, lastName, email, phone, linkedin, company, title, school, degree, city, etc)"),
          confidence: z.string().describe("high, medium, or low confidence")
        });

        let fieldPurpose;
        try {
          fieldPurpose = await stagehand.extract(`Based on this form field element, what is its purpose? Field: ${fieldStr.slice(0, 200)}`, FieldPurposeSchema);
        } catch (e) {
          continue;
        }

        const getValueForPurpose = (purpose) => {
          const p = (purpose || '').toLowerCase().replace(/[_\s-]/g, '');
          const mapping = {
            'firstname': firstName,
            'first': firstName,
            'givenname': firstName,
            'lastname': lastName,
            'last': lastName,
            'surname': lastName,
            'familyname': lastName,
            'fullname': userProfile.fullName,
            'name': userProfile.fullName,
            'email': userProfile.email,
            'emailaddress': userProfile.email,
            'phone': userProfile.phone,
            'phonenumber': userProfile.phone,
            'telephone': userProfile.phone,
            'mobile': userProfile.phone,
            'location': userProfile.location,
            'city': userProfile.location?.split(',')[0],
            'state': userProfile.location?.split(',')[1]?.trim(),
            'address': userProfile.location,
            'currentlocation': userProfile.location,
            'linkedin': userProfile.linkedinUrl,
            'linkedinprofile': userProfile.linkedinUrl,
            'linkedinurl': userProfile.linkedinUrl,
            'portfolio': userProfile.portfolioUrl,
            'website': userProfile.portfolioUrl,
            'portfoliourl': userProfile.portfolioUrl,
            'github': userProfile.githubUrl,
            'company': userProfile.workExperience?.[0]?.company,
            'currentcompany': userProfile.workExperience?.[0]?.company,
            'employer': userProfile.workExperience?.[0]?.company,
            'organization': userProfile.workExperience?.[0]?.company,
            'jobtitle': userProfile.workExperience?.[0]?.title,
            'title': userProfile.workExperience?.[0]?.title,
            'currenttitle': userProfile.workExperience?.[0]?.title,
            'position': userProfile.workExperience?.[0]?.title,
            'role': userProfile.workExperience?.[0]?.title,
            'currentrole': userProfile.workExperience?.[0]?.title,
            'school': userProfile.education?.[0]?.school,
            'university': userProfile.education?.[0]?.school,
            'college': userProfile.education?.[0]?.school,
            'institution': userProfile.education?.[0]?.school,
            'degree': userProfile.education?.[0]?.degree,
            'education': userProfile.education?.[0]?.degree,
            'major': userProfile.education?.[0]?.degree,
            'fieldofstudy': userProfile.education?.[0]?.degree,
            'gpa': userProfile.education?.[0]?.gpa,
            'graduationyear': userProfile.education?.[0]?.dates?.split('-')[1]?.trim(),
            'startyear': userProfile.workExperience?.[0]?.dates?.split('-')[0]?.trim(),
            'skills': userProfile.skills?.technical?.join(', '),
            'technicalskills': userProfile.skills?.technical?.join(', '),
          };
          return mapping[p] || null;
        };

        const value = getValueForPurpose(fieldPurpose.purpose);

        if (value && value.trim()) {
          let filled = false;
          try {
            await stagehand.act(`type "${value}" into the ${fieldPurpose.purpose} field`);
            filled = true;
          } catch (e1) {
            try {
              await stagehand.act(`type "${value}" into the field: ${selector}`);
              filled = true;
            } catch (e2) {
              // Silent fail
            }
          }

          if (filled) {
            filledCount++;
            console.log(`    ✅ Filled ${fieldPurpose.purpose}: ${value.substring(0, 30)}...`);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } catch (error) {
        // Silent fail, continue to next field
      }
    }

    // 5.2: Fill textareas with batched AI answers
    console.log('  📄 Filling textarea fields with batched AI answers...');
    for (let i = 0; i < textareaData.length; i++) {
      const textarea = textareaData[i];
      const aiAnswer = textareaAnswers[i];

      try {
        let valueToFill = aiAnswer;

        // Fallback if no AI answer
        if (!valueToFill || valueToFill.trim() === '') {
          console.log(`    ⚠️ No AI answer for textarea ${i + 1}, using fallback`);
          if (textarea.type === 'cover letter') {
            valueToFill = `I am excited to apply for this position. With ${userProfile.workExperience?.[0]?.title} experience at ${userProfile.workExperience?.[0]?.company}, I have developed strong skills in ${userProfile.skills?.technical?.slice(0, 3).join(', ')}. I believe my background aligns well with the requirements of this role.`;
          } else if (textarea.type === 'work experience') {
            valueToFill = userProfile.workExperience?.map((e, idx) =>
              `${idx + 1}. ${e.title} at ${e.company} (${e.dates || 'Current'})\n${e.description || ''}`
            ).join('\n\n');
          } else {
            continue;
          }
        }

        let filled = false;
        // METHOD 1: Try selector first (most precise - we extracted from this exact element)
        try {
          await stagehand.act(`type "${valueToFill}" into the field: ${textarea.selector}`);
          filled = true;
        } catch (e1) {
          // METHOD 2: Fallback to semantic description with question context
          try {
            await stagehand.act(`type "${valueToFill}" into the textarea for "${textarea.question}"`);
            filled = true;
          } catch (e2) {
            // METHOD 3: Last resort - generic textarea
            try {
              await stagehand.act(`type "${valueToFill}" into the textarea`);
              filled = true;
            } catch (e3) {
              // Silent fail
            }
          }
        }

        if (filled) {
          filledCount++;
          console.log(`    ✅ Filled textarea ${i + 1}: "${textarea.question.substring(0, 40)}..." (${valueToFill.length} chars)`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.log(`    ⚠️ Error filling textarea ${i + 1}: ${error.message}`);
      }
    }

    // 5.3: Fill dropdowns with batched AI selections (Enhanced with custom dropdown support)
    console.log('  🎯 Filling dropdown fields with batched AI selections...');
    for (let i = 0; i < dropdownData.length; i++) {
      const dropdown = dropdownData[i];
      const aiSelection = dropdownSelections[i];

      try {
        // Verify the AI selection is in the options
        let validOption = dropdown.options.find(opt =>
          opt.toLowerCase() === (aiSelection || '').toLowerCase() ||
          opt.toLowerCase().includes((aiSelection || '').toLowerCase()) ||
          (aiSelection || '').toLowerCase().includes(opt.toLowerCase())
        );

        // Fallback if no valid AI selection
        if (!validOption) {
          console.log(`    ⚠️ AI selection "${aiSelection}" not valid for dropdown ${i + 1}, using fallback`);
          const label = dropdown.label.toLowerCase();
          if (label.includes('experience') || label.includes('years')) {
            const expOptions = dropdown.options.filter(opt => opt.match(/\d+/));
            validOption = expOptions[Math.min(2, expOptions.length - 1)];
          } else if (label.includes('education') || label.includes('degree')) {
            const degreeType = userProfile.education?.[0]?.degree?.toLowerCase() || '';
            validOption = dropdown.options.find(opt =>
              degreeType.includes(opt.toLowerCase()) ||
              opt.toLowerCase().includes('bachelor') ||
              opt.toLowerCase().includes('master')
            );
          } else if (label.includes('authorization') || label.includes('visa') || label.includes('eligible') || label.includes('sponsorship')) {
            validOption = dropdown.options.find(opt =>
              opt.toLowerCase().includes('no') ||
              opt.toLowerCase() === 'no'
            ) || dropdown.options.find(opt =>
              opt.toLowerCase().includes('yes') ||
              opt.toLowerCase().includes('authorized') ||
              opt.toLowerCase().includes('citizen')
            );
          }
        }

        if (validOption) {
          let filled = false;
          
          // METHOD 1: Try standard select approach
          try {
            await stagehand.act(`select "${validOption}" from the "${dropdown.label}" dropdown`);
            filled = true;
            filledCount++;
            console.log(`    ✅ Selected "${validOption}" in "${dropdown.label}" (Method 1: standard)`);
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (e1) {
            console.log(`    ⏭️  Method 1 failed, trying custom dropdown approach...`);
            
            // METHOD 2: Multi-step custom dropdown approach
            try {
              // Step 1: Click to open the dropdown
              await stagehand.act(`click on the "${dropdown.label}" dropdown to open it`);
              await new Promise(resolve => setTimeout(resolve, 800));
              
              // Step 2: Click the specific option
              await stagehand.act(`click on the option "${validOption}"`);
              await new Promise(resolve => setTimeout(resolve, 300));
              
              filled = true;
              filledCount++;
              console.log(`    ✅ Selected "${validOption}" in "${dropdown.label}" (Method 2: custom dropdown)`);
            } catch (e2) {
              console.log(`    ⏭️  Method 2 failed, trying direct option click...`);
              
              // METHOD 3: Direct option selection
              try {
                await stagehand.act(`select the option labeled "${validOption}"`);
                await new Promise(resolve => setTimeout(resolve, 300));
                
                filled = true;
                filledCount++;
                console.log(`    ✅ Selected "${validOption}" in "${dropdown.label}" (Method 3: direct option)`);
              } catch (e3) {
                console.log(`    ⏭️  Method 3 failed, trying alternative phrasing...`);
                
                // METHOD 4: Alternative phrasing
                try {
                  await stagehand.act(`choose "${validOption}" for the question "${dropdown.label}"`);
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  filled = true;
                  filledCount++;
                  console.log(`    ✅ Selected "${validOption}" in "${dropdown.label}" (Method 4: alternative)`);
                } catch (e4) {
                  console.log(`    ❌ All methods failed for dropdown ${i + 1}: "${dropdown.label}"`);
                }
              }
            }
          }
        } else {
          console.log(`    ⚠️ No valid option found for dropdown ${i + 1}: "${dropdown.label}"`);
        }
      } catch (error) {
        console.log(`    ⚠️ Error processing dropdown ${i + 1}: ${error.message}`);
      }
    }

    // 5.4: Fill radio buttons with batched AI selections
    console.log('  🔘 Filling radio button groups with batched AI selections...');
    for (let i = 0; i < radioData.length; i++) {
      const radio = radioData[i];
      const aiSelection = radioSelections[i];

      if (!aiSelection || aiSelection.trim() === '') {
        console.log(`    ⚠️ No AI selection for radio ${i + 1}, skipping`);
        continue;
      }

      try {
        // METHOD 1: Try with question context first (most specific)
        await stagehand.act(`select the "${aiSelection}" radio button for "${radio.question}"`);
        filledCount++;
        console.log(`    ✅ Selected radio "${aiSelection}" for "${radio.question.substring(0, 40)}..."`);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e1) {
        // METHOD 2: Fallback to generic radio button selection
        try {
          await stagehand.act(`select the "${aiSelection}" radio button`);
          filledCount++;
          console.log(`    ✅ Selected radio "${aiSelection}" (fallback method)`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.log(`    ⚠️ Failed to select radio ${i + 1}`);
        }
      }
    }

    // 5.5: Fill checkboxes with batched AI decisions
    console.log('  ☑️  Filling checkboxes with batched AI decisions...');
    for (let i = 0; i < checkboxData.length; i++) {
      const checkbox = checkboxData[i];
      let shouldCheck = checkboxDecisions[i];

      // Auto-check certain types if AI didn't provide decision
      if (shouldCheck === undefined || shouldCheck === null) {
        const labelLower = checkbox.label.toLowerCase();
        if (checkbox.type === 'legal agreement' || labelLower.includes('terms') || labelLower.includes('agree')) {
          shouldCheck = true;
        } else if (checkbox.type === 'authorization' || labelLower.includes('authorize') || labelLower.includes('consent')) {
          shouldCheck = true;
        } else if (labelLower.includes('eligible') || labelLower.includes('authorized to work')) {
          shouldCheck = true;
        } else {
          console.log(`    ⏭️  No decision for checkbox ${i + 1}, skipping`);
          continue;
        }
      }

      if (shouldCheck) {
        try {
          await stagehand.act(`check the checkbox for "${checkbox.label}"`);
          filledCount++;
          console.log(`    ✅ Checked: "${checkbox.label.substring(0, 50)}..."`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.log(`    ⚠️ Failed to check checkbox ${i + 1}`);
        }
      } else {
        console.log(`    ⏭️  Skipped checkbox ${i + 1} (should not check)`);
      }
    }

    // 5.6: Handle file uploads
    if (finalFileUploads.length > 0 && userProfile.resumeUrl) {
      console.log('  📎 File uploads detected...');
      console.log(`    ℹ️  Note: File upload requires resume file path, not URL. Skipping automated upload.`);
      console.log(`    ℹ️  Resume URL in profile: ${userProfile.resumeUrl}`);
    }

    console.log(`\n📊 Summary: Filled ${filledCount} out of ${totalFields} fields`);

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
