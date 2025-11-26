/**
 * Test script for browser-use integration
 *
 * This tests the full flow:
 * 1. Next.js API route receives request
 * 2. Next.js calls Python service
 * 3. Python service uses browser-use to apply to job
 * 4. Result is returned
 */

async function testBrowserUse() {
  console.log('🧪 Testing Browser-Use Integration\n');

  // Test data
  const testPayload = {
    jobUrl: 'https://jobs.lever.co/example/test', // Replace with a real job URL for testing
    userId: 'test_user_123',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    location: 'San Francisco, CA',
    workExperience: [
      {
        title: 'Software Engineer',
        company: 'Tech Corp',
        duration: '2020-2023',
        description: 'Built amazing applications'
      }
    ],
    education: [
      {
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        school: 'University of Example',
        year: '2020'
      }
    ],
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    portfolioUrl: 'https://johndoe.com',
    coverLetter: 'I am excited to apply for this position...',
    headless: false, // Set to false to see the browser in action
    timeout: 300
  };

  try {
    // Step 1: Start the application
    console.log('📤 Step 1: Sending application request to Next.js API...');
    console.log('   URL:', 'http://localhost:3000/api/browser-apply');
    console.log('   Job:', testPayload.jobUrl);

    const startResponse = await fetch('http://localhost:3000/api/browser-apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Failed to start application: ${errorText}`);
    }

    const startResult = await startResponse.json();
    console.log('✅ Step 1 Complete:', startResult);
    console.log('   Session ID:', startResult.sessionId);
    console.log('   Status:', startResult.status);
    console.log('');

    // Step 2: Check status
    const sessionId = startResult.sessionId;

    console.log('📊 Step 2: Checking application status...');
    console.log('   Waiting 5 seconds for processing...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await fetch(
      `http://localhost:3000/api/browser-apply?sessionId=${sessionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to get status: ${errorText}`);
    }

    const statusResult = await statusResponse.json();
    console.log('✅ Step 2 Complete:', statusResult);
    console.log('   Status:', statusResult.status);
    console.log('   Progress:', statusResult.progress);

    if (statusResult.error) {
      console.log('   Error:', statusResult.error);
    }

    if (statusResult.result) {
      console.log('   Result:', JSON.stringify(statusResult.result, null, 2));
    }
    console.log('');

    // Step 3: Poll for completion (in a real app, you'd do this with websockets or polling)
    console.log('🔄 Step 3: Polling for completion...');

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const pollResponse = await fetch(
        `http://localhost:3000/api/browser-apply?sessionId=${sessionId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const pollResult = await pollResponse.json();

      console.log(`   [${attempts + 1}/${maxAttempts}] Status: ${pollResult.status} - ${pollResult.progress || 'Processing...'}`);

      if (pollResult.status === 'completed' || pollResult.status === 'failed') {
        console.log('\n✅ Final Status:', pollResult.status);

        if (pollResult.result) {
          console.log('📋 Application Result:');
          console.log('   Success:', pollResult.result.success);
          console.log('   Fields Filled:', pollResult.result.fields_filled);
          console.log('   Total Fields:', pollResult.result.total_fields);
          console.log('   Submission Confirmed:', pollResult.result.submission_confirmed);
          console.log('   Execution Time:', pollResult.result.execution_time, 'seconds');

          if (pollResult.result.error_message) {
            console.log('   Error:', pollResult.result.error_message);
          }
        }

        break;
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.log('⚠️ Timeout: Application did not complete within 5 minutes');
    }

    console.log('\n🎉 Test Complete!');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testBrowserUse();
