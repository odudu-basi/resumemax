/**
 * USAGE EXAMPLE FOR GPT PATTERN RECOGNITION APPLY
 *
 * This file shows how to use the new intelligent job application system
 */

const { Stagehand } = require('@browserbasehq/stagehand');
const { intelligentJobApplication } = require('./GPT_pattern_recognition_apply');

// =============================================================================
// EXAMPLE 1: Basic Usage
// =============================================================================

async function example1_basicUsage() {
  console.log('Example 1: Basic intelligent job application\n');

  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    enableCaching: true
  });

  await stagehand.init();

  // User profile
  const userProfile = {
    fullName: 'John Smith',
    workEmail: 'john.smith@email.com',
    phone: '+1-555-0123',
    location: 'San Francisco, CA',
    workAuthorized: true,
    requiresSponsorship: false,
    yearsOfExperience: 5,
    linkedinUrl: 'https://linkedin.com/in/johnsmith',
    workExperience: [
      { position: 'Senior Software Engineer', company: 'Tech Corp' },
      { position: 'Software Engineer', company: 'Startup Inc' }
    ],
    education: [
      { degree: 'BS Computer Science', school: 'Stanford University' }
    ],
    skills: {
      technical: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker']
    }
  };

  // Job info
  const jobInfo = {
    title: 'Senior Software Engineer',
    company: 'Tesla',
    url: 'https://www.tesla.com/careers/...'
  };

  // Navigate to job application
  await stagehand.page.goto(jobInfo.url);

  // Run intelligent application - it handles everything!
  const result = await intelligentJobApplication(stagehand, userProfile, jobInfo);

  console.log('\n=== RESULT ===');
  console.log('Success:', result.success);
  console.log('Message:', result.message || result.error);
  console.log('Iterations:', result.iterations);
  console.log('Final URL:', result.finalUrl);
  console.log('Total Cost:', result.totalCost);

  await stagehand.close();
}

// =============================================================================
// EXAMPLE 2: With Options
// =============================================================================

async function example2_withOptions() {
  console.log('Example 2: Intelligent application with custom options\n');

  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    enableCaching: true
  });

  await stagehand.init();

  const userProfile = { /* ... same as above ... */ };
  const jobInfo = { /* ... same as above ... */ };

  await stagehand.page.goto(jobInfo.url);

  // Run with custom options
  const result = await intelligentJobApplication(
    stagehand,
    userProfile,
    jobInfo,
    {
      maxIterations: 30, // Allow more iterations for complex applications
    }
  );

  console.log('Result:', result);

  await stagehand.close();
}

// =============================================================================
// EXAMPLE 3: Integration with your API route
// =============================================================================

// This is how you'd integrate it into your existing cloud-apply route:

/*
// In your app/api/cloud-apply/route.ts:

import { intelligentJobApplication } from '@/stagehand-service/GPT_pattern_recognition_apply';

export async function POST(request: Request) {
  const { userId, resumeId, jobUrl, jobTitle, jobCompany } = await request.json();

  // Get user profile from database
  const userProfile = await getUserProfile(userId, resumeId);

  // Create stagehand instance
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID
  });

  await stagehand.init();
  await stagehand.page.goto(jobUrl);

  // Run intelligent application
  const result = await intelligentJobApplication(
    stagehand,
    userProfile,
    { title: jobTitle, company: jobCompany, url: jobUrl }
  );

  await stagehand.close();

  return Response.json({
    success: result.success,
    message: result.message || result.error,
    details: result
  });
}
*/

// =============================================================================
// EXAMPLE 4: Understanding the Flow
// =============================================================================

/*
WHAT HAPPENS WHEN YOU CALL intelligentJobApplication():

1. ITERATION 1:
   ┌─────────────────────────────────────┐
   │ Analyze page → "initial_job_posting"│
   │ Plan actions → "Click Apply button" │
   │ Execute → Click Apply               │
   └─────────────────────────────────────┘

2. ITERATION 2:
   ┌──────────────────────────────────────────┐
   │ Analyze page → "authentication"          │
   │ Plan actions → "Fill email & password,   │
   │                click Sign In"            │
   │ Execute → Fill credentials, submit       │
   └──────────────────────────────────────────┘

3. ITERATION 3:
   ┌──────────────────────────────────────────┐
   │ Analyze page → "multi_step_form"         │
   │               Step 1 of 3                │
   │ Plan actions → "Fill personal info,      │
   │                click Next"               │
   │ Execute → Fill fields, click Next        │
   └──────────────────────────────────────────┘

4. ITERATION 4:
   ┌──────────────────────────────────────────┐
   │ Analyze page → "multi_step_form"         │
   │               Step 2 of 3                │
   │ Plan actions → "Fill work experience,    │
   │                click Next"               │
   │ Execute → Fill fields, click Next        │
   └──────────────────────────────────────────┘

5. ITERATION 5:
   ┌──────────────────────────────────────────┐
   │ Analyze page → "review_page"             │
   │ Plan actions → "Verify data, click       │
   │                Submit Application"       │
   │ Execute → Submit                         │
   └──────────────────────────────────────────┘

6. ITERATION 6:
   ┌──────────────────────────────────────────┐
   │ Analyze page → "confirmation_success"    │
   │ Result: ✅ APPLICATION COMPLETE!         │
   └──────────────────────────────────────────┘

TOTAL: 6 iterations to complete entire application flow
       Adapts to whatever the website presents!
*/

// =============================================================================
// Run examples
// =============================================================================

if (require.main === module) {
  // Uncomment to run examples:
  // example1_basicUsage().catch(console.error);
  // example2_withOptions().catch(console.error);

  console.log('📚 Usage examples loaded. Uncomment to run.');
  console.log('\nKey Features:');
  console.log('✅ Automatically detects page types (login, form, review, etc.)');
  console.log('✅ Adapts to multi-step flows');
  console.log('✅ Handles authentication automatically');
  console.log('✅ Makes intelligent decisions based on page context');
  console.log('✅ No rigid step-by-step instructions needed');
  console.log('✅ Self-correcting and flexible');
}

module.exports = {
  example1_basicUsage,
  example2_withOptions
};
