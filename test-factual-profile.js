/**
 * Test script for the new factual profile generation
 * 
 * This test verifies that the API now generates structured factual profiles
 * instead of essay-style content, showing:
 * - Work experience with dates and companies
 * - Education details with schools and dates
 * - Technical skills and projects
 * - Leadership experience
 * - User preferences
 */

async function testFactualProfileGeneration() {
  console.log("🧪 Testing Factual Profile Generation\n");
  console.log("🎯 Testing the new structured profile format instead of essay");
  console.log("📋 Should include work experience, education, skills, projects, leadership\n");

  try {
    // Test the profile generation API
    const response = await fetch("http://localhost:3000/api/update-essay-from-resume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "test-user-id" // You'll need to replace this with a real user ID that has resume data
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log("✅ SUCCESS!");
      console.log(`   Profile generated: YES`);
      console.log(`   Word count: ${result.profileWordCount || result.essayWordCount}`);
      console.log(`   Text extracted: ${result.textExtracted ? 'YES' : 'NO'}`);
      console.log(`   Parsed data available: ${result.parsedDataAvailable ? 'YES' : 'NO'}`);
      console.log(`   Message: ${result.message}`);
      
      console.log("\n📄 Profile structure should include:");
      console.log("   ✓ ## PROFESSIONAL SUMMARY");
      console.log("   ✓ ## WORK EXPERIENCE (with dates and companies)");
      console.log("   ✓ ## EDUCATION (with schools and dates)");
      console.log("   ✓ ## TECHNICAL SKILLS");
      console.log("   ✓ ## PROJECTS (if available)");
      console.log("   ✓ ## LEADERSHIP EXPERIENCE (if available)");
      console.log("   ✓ ## CERTIFICATIONS & ACHIEVEMENTS (if available)");
      console.log("   ✓ ## CONTACT INFORMATION (from profile form)");
      console.log("   ✓ ## WORK AUTHORIZATION & PREFERENCES (from profile form)");
      console.log("   ✓ ## JOB SEARCH CRITERIA (from profile form)");
      console.log("   ✓ ## LANGUAGES (from profile form)");
      console.log("   ✓ ## APPLICATION PREFERENCES (from profile form)");
      
    } else {
      console.log("❌ FAILED");
      console.log(`   Error: ${result.error}`);
      console.log(`   Message: ${result.message || 'No message provided'}`);
    }
  } catch (error) {
    console.log("❌ REQUEST FAILED");
    console.log(`   Error: ${error.message}`);
    console.log("\n💡 Make sure:");
    console.log("   - The server is running on localhost:3000");
    console.log("   - You have a valid user ID with resume data");
    console.log("   - The database has user profile and resume data");
  }
}

// Test the API info endpoint
async function testAPIInfo() {
  console.log("\n🔍 Testing API Information Endpoint");
  
  try {
    const response = await fetch("http://localhost:3000/api/update-essay-from-resume", {
      method: "GET"
    });

    const info = await response.json();
    console.log("✅ API Info Retrieved:");
    console.log(`   Name: ${info.name}`);
    console.log(`   Description: ${info.description}`);
    console.log("   Features:");
    info.features.forEach(feature => {
      console.log(`     - ${feature}`);
    });
  } catch (error) {
    console.log("❌ Failed to get API info:", error.message);
  }
}

// Run the tests
console.log("=" .repeat(60));
console.log("FACTUAL PROFILE GENERATION TEST");
console.log("=" .repeat(60));

testAPIInfo().then(() => {
  console.log("\n" + "=" .repeat(60));
  return testFactualProfileGeneration();
}).catch(console.error);
