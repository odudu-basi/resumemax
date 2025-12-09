const { z } = require('zod');

/**
 * Scrape job details from a job posting URL using Stagehand
 * @param {Stagehand} stagehand - Initialized Stagehand instance
 * @param {string} jobUrl - URL of the job posting
 * @returns {Promise<Object>} Extracted job details
 */
const scrapeJobDetails = async (stagehand, jobUrl) => {
  console.log('🔍 Starting job details extraction for:', jobUrl);

  try {
    // Get the page from Stagehand context (v3 API)
    const page = stagehand.context.pages()[0];
    
    // Navigate to the job URL
    console.log("📄 Navigating to job URL...");
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
    console.log("✅ Page loaded successfully");

    // Wait a moment for dynamic content to load
    await page.waitForLoadState("networkidle");
    console.log("✅ Page reached networkidle state");

    // Verify page content is accessible
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`📄 Page title: ${pageTitle}`);
    console.log(`📍 Final URL: ${pageUrl}`);

    // Define schema for job details extraction - with summaries only
    const jobDetailsSchema = z.object({
      jobTitle: z.string().describe("The title or name of the job position"),
      companyName: z.string().describe("The name of the company or organization hiring"),
      location: z.string().describe("The job location - city, state, country, or if it's remote/hybrid"),
      jobType: z.string().nullish().describe("Employment type: Full-time, Part-time, Contract, Internship, etc."),
      salaryRange: z.string().nullish().describe("Salary or pay range if mentioned (e.g., '$80k-$100k', 'Competitive')"),
      datePosted: z.string().nullish().describe("When the job was posted (e.g., '2 days ago', 'Posted on Jan 15')"),

      // Summaries instead of full text
      descriptionSummary: z.string().describe("A concise 2-3 sentence summary of the main responsibilities and what the role involves"),
      requirementsSummary: z.string().nullish().describe("A brief summary (2-3 sentences) of key qualifications, skills, and experience needed"),
      benefitsSummary: z.string().nullish().describe("A short summary of benefits and perks if mentioned (1-2 sentences)"),
    });

    console.log("🤖 Extracting job details using Stagehand extract()...");

    // Use Stagehand's extract method to get structured data with summaries
    let jobDetails;
    try {
      jobDetails = await stagehand.extract(
        `Extract job posting information from this page. For the description, requirements, and benefits,
        provide BRIEF SUMMARIES only (2-3 sentences each), not the full text. Extract:
        - Job title, company name, location, job type, salary range, posting date
        - A 2-3 sentence summary of the job description and main responsibilities
        - A 2-3 sentence summary of the key requirements and qualifications
        - A 1-2 sentence summary of benefits/perks if mentioned`,
        jobDetailsSchema
      );
    } catch (extractError) {
      console.error('❌ Extract failed with detailed error:');
      console.error('   Error name:', extractError.name);
      console.error('   Error message:', extractError.message);
      console.error('   Error stack:', extractError.stack);
      console.error('   Full error object:', JSON.stringify(extractError, null, 2));
      throw extractError; // Re-throw to maintain error flow
    }

    console.log("✅ Job details extracted successfully:");
    console.log(`  Title: ${jobDetails.jobTitle}`);
    console.log(`  Company: ${jobDetails.companyName}`);
    console.log(`  Location: ${jobDetails.location}`);
    console.log(`  Type: ${jobDetails.jobType || 'N/A'}`);
    console.log(`  Salary: ${jobDetails.salaryRange || 'N/A'}`);
    console.log(`  Posted: ${jobDetails.datePosted || 'N/A'}`);
    console.log(`  Description: ${jobDetails.descriptionSummary.substring(0, 100)}...`);

    // Return the extracted details along with the original URL
    return {
      success: true,
      jobUrl,
      ...jobDetails,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error extracting job details:', error);
    throw error;
  }
};

module.exports = { scrapeJobDetails };
