// Adaptive form filling logic
const adaptiveFormFill = async (stagehand, userProfile, sessionId, sessionUrl, res) => {
  console.log('🤖 Starting adaptive form filling...');

  const firstName = userProfile.fullName.split(' ')[0] || '';
  const lastName = userProfile.fullName.split(' ').slice(1).join(' ') || '';

  // Step 1: Analyze the form structure
  console.log('🔍 Analyzing form structure...');
  const formAnalysis = await stagehand.extract(
    "Analyze this job application form. List all visible input fields, textareas, and buttons. For each field, identify its purpose (name, email, phone, etc.)",
    {
      fields: [{
        label: "string - the field label or placeholder text",
        type: "string - input type (text, email, tel, textarea, etc)",
        purpose: "string - what this field is for (firstName, lastName, email, phone, location, linkedin, resume, coverLetter, etc)"
      }],
      buttons: [{
        text: "string - button text",
        action: "string - what the button does (submit, next, cancel, etc)"
      }]
    }
  );

  console.log('📋 Found form structure:', JSON.stringify(formAnalysis, null, 2));

  // Step 2: Create a smart mapping function
  const getValueForField = (purpose) => {
    const mapping = {
      'firstName': firstName,
      'first_name': firstName,
      'name_first': firstName,
      'lastName': lastName,
      'last_name': lastName,
      'name_last': lastName,
      'fullName': userProfile.fullName,
      'full_name': userProfile.fullName,
      'name': userProfile.fullName,
      'email': userProfile.email,
      'email_address': userProfile.email,
      'phone': userProfile.phone,
      'phone_number': userProfile.phone,
      'telephone': userProfile.phone,
      'mobile': userProfile.phone,
      'location': userProfile.location,
      'city': userProfile.location,
      'address': userProfile.location,
      'linkedin': userProfile.linkedinUrl,
      'linkedin_url': userProfile.linkedinUrl,
      'portfolio': userProfile.portfolioUrl,
      'website': userProfile.portfolioUrl,
      'company': userProfile.workExperience?.[0]?.company,
      'current_company': userProfile.workExperience?.[0]?.company,
      'job_title': userProfile.workExperience?.[0]?.title,
      'current_title': userProfile.workExperience?.[0]?.title,
      'position': userProfile.workExperience?.[0]?.title,
      'school': userProfile.education?.[0]?.school,
      'university': userProfile.education?.[0]?.school,
      'degree': userProfile.education?.[0]?.degree,
      'education': userProfile.education?.[0]?.degree
    };

    return mapping[purpose.toLowerCase()] || null;
  };

  // Step 3: Fill fields intelligently
  console.log('📝 Filling form fields...');
  let filledCount = 0;

  for (const field of formAnalysis.fields || []) {
    const value = getValueForField(field.purpose);

    if (value && value.trim()) {
      const preview = value.length > 30 ? value.substring(0, 30) + '...' : value;
      console.log(`  ✓ Filling "${field.label}" with: ${preview}`);
      try {
        await stagehand.act(`type "${value}" into the "${field.label}" field`);
        filledCount++;
      } catch (error) {
        console.log(`  ✗ Failed to fill "${field.label}":`, error.message);
      }
    } else {
      console.log(`  ⊘ Skipping "${field.label}" - no matching data`);
    }
  }

  console.log(`✅ Filled ${filledCount} fields`);

  // Step 4: Handle navigation (Next/Continue buttons)
  const nextButton = formAnalysis.buttons?.find(btn =>
    btn.action === 'next' || btn.text.toLowerCase().includes('next') || btn.text.toLowerCase().includes('continue')
  );

  if (nextButton) {
    console.log(`➡️  Clicking "${nextButton.text}" button...`);
    try {
      await stagehand.act(`click the "${nextButton.text}" button`);

      // Wait a bit for the next page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('🔄 Checking for additional form pages...');
      // TODO: Could recursively call form analysis here for multi-page forms

    } catch (error) {
      console.log('⚠️  Could not click next button:', error.message);
    }
  }

  // Step 5: Submit the application
  const submitButton = formAnalysis.buttons?.find(btn =>
    btn.action === 'submit' || btn.text.toLowerCase().includes('submit') || btn.text.toLowerCase().includes('apply')
  );

  if (submitButton) {
    console.log(`✅ Submitting via "${submitButton.text}" button...`);
    try {
      await stagehand.act(`click the "${submitButton.text}" button`);
      console.log('🎉 Application submitted successfully!');
    } catch (error) {
      console.log('⚠️  Could not submit:', error.message);
      // Try a generic submit as fallback
      await stagehand.act('click the submit or apply button');
    }
  } else {
    console.log('⚠️  No submit button found, trying generic submit...');
    await stagehand.act('click the submit or apply button');
  }

  await stagehand.close();
  res.json({ success: true, sessionId, sessionUrl, message: 'Application submitted' });
};

module.exports = { adaptiveFormFill };
