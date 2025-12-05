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
    await page.waitForTimeout(2000);

    // Define schema for job details extraction
    const jobDetailsSchema = z.object({
      jobTitle: z.string().describe("The title or name of the job position"),
      companyName: z.string().describe("The name of the company or organization hiring"),
      location: z.string().describe("The job location - city, state, country, or if it's remote/hybrid"),
      jobType: z.string().optional().describe("Employment type: Full-time, Part-time, Contract, Internship, etc."),
      salaryRange: z.string().optional().describe("Salary, pay range, or compensation mentioned (e.g., '$80k-$100k', 'Competitive')"),
      datePosted: z.string().optional().describe("When the job was posted (e.g., '2 days ago', 'Posted on January 15, 2025')"),
      jobDescription: z.string().describe("The complete job description including responsibilities and what the role entails"),
      requirements: z.string().optional().describe("Required qualifications, skills, experience, or education needed"),
      benefits: z.string().optional().describe("Benefits, perks, or additional compensation mentioned"),
    });

    console.log("🤖 Extracting job details using Stagehand extract()...");

    // Use Stagehand's extract method to get structured data
    const jobDetails = await stagehand.extract(
      `Extract all job posting information from this page including the job title, company name,
      location, job type, salary range if mentioned, when it was posted, the full job description,
      required qualifications and skills, and any benefits or perks mentioned.`,
      jobDetailsSchema
    );

    console.log("✅ Job details extracted successfully:");
    console.log(`  Title: ${jobDetails.jobTitle}`);
    console.log(`  Company: ${jobDetails.companyName}`);
    console.log(`  Location: ${jobDetails.location}`);
    console.log(`  Type: ${jobDetails.jobType || 'N/A'}`);
    console.log(`  Salary: ${jobDetails.salaryRange || 'N/A'}`);
    console.log(`  Posted: ${jobDetails.datePosted || 'N/A'}`);

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
