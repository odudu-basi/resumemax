/**
 * Test script for the optimized intelligent auto-apply
 *
 * Before optimization: ~131K tokens (error!)
 * After optimization: ~5-10K tokens (within 128K limit)
 * 
 * This test specifically tests the "Apply & Review" mode where:
 * - Browser starts in headed mode but minimized/off-screen
 * - Form is filled automatically in the background
 * - Browser is brought to front when filling is complete
 * - User can review and manually submit
 */

const testUserProfile = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "+1-555-123-4567",
  location: {
    city: "San Francisco",
    state: "CA",
    country: "USA",
  },
  linkedinUrl: "https://linkedin.com/in/johndoe",
  portfolioUrl: "https://johndoe.dev",
  parsedResume: {
    skills: [
      "JavaScript", "TypeScript", "React", "Node.js", "Python",
      "AWS", "Docker", "PostgreSQL", "GraphQL", "Next.js"
    ],
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Tech Corp",
        duration: "2020 - Present",
        description: "Led development of microservices architecture serving 1M+ users"
      }
    ],
    education: [
      {
        degree: "Bachelor of Science in Computer Science",
        school: "Stanford University",
        year: "2016"
      }
    ]
  }
};

const testUrl = "https://jobs.lever.co/company/apply"; // Example job application URL

async function testIntelligentApply() {
  console.log("🧪 Testing Intelligent Apply & Review Mode\n");
  console.log("🎯 Mode: Apply & Review (autoApply: false)");
  console.log("🌐 Browser: Headed mode, starts minimized, brought to front when complete\n");

  const response = await fetch("http://localhost:3000/api/intelligent-apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: testUrl,
      userProfile: testUserProfile,
      options: {
        submitForm: false, // Don't actually submit during testing
        recordVideo: true,
        autoApply: false, // Test Apply & Review mode (headed browser, minimized then brought to front)
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log("✅ SUCCESS!");
    console.log(`   Mode: ${result.mode || 'apply_and_review'}`);
    console.log(`   Browser opened: ${result.browserOpened ? 'YES' : 'NO'}`);
    console.log(`   Fields filled: ${result.fieldsFilled}/${result.fieldsAttempted}`);
    console.log(`   Success rate: ${result.successRate}%`);
    if (result.videoPath) {
      console.log(`   Video: ${result.videoPath}`);
    }
    if (result.mode === 'apply_and_review') {
      console.log(`   🌐 Browser window should now be visible for user review`);
      console.log(`   📝 Form is pre-filled and ready for manual submission`);
    }
  } else {
    console.log("❌ FAILED");
    console.log(`   Error: ${result.error}`);
    console.log(`   Message: ${result.message}`);
    if (result.errors) {
      console.log(`   Errors: ${result.errors.join(", ")}`);
    }
  }
}

// Run the test
testIntelligentApply().catch(console.error);
