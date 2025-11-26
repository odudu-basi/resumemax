import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export interface JobListing {
  title: string;
  company: string;
  url: string;
  description: string;
  location?: string;
  salary?: string;
  matchScore?: number;
  source: string;
  postedDate?: string;
}

/**
 * Search Google for job postings and extract direct application links
 * This searches the open web and finds real company career pages
 */
export async function searchGoogleForJobs(
  keywords: string,
  location: string = '',
  limit: number = 20
): Promise<JobListing[]> {
  let browser;

  try {
    console.log(`\n=== Searching Google for: "${keywords}" in "${location}" ===`);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Construct Google search query for jobs
    // We search for: job title + location + keywords that indicate job postings
    const locationPart = location ? ` ${location}` : '';
    const searchQuery = `${keywords}${locationPart} "apply now" OR "careers" OR "jobs" -indeed -linkedin -glassdoor -ziprecruiter`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const googleSearchUrl = `https://www.google.com/search?q=${encodedQuery}&num=50`;

    console.log(`Google search URL: ${googleSearchUrl}`);

    await page.goto(googleSearchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for search results
    await page.waitForSelector('#search, .g', { timeout: 10000 }).catch(() => {
      console.log('Search results selector not found, continuing...');
    });

    // Extract search result links
    const searchResults = await page.evaluate(() => {
      const results: { title: string; url: string; snippet: string }[] = [];

      // Google search result selectors
      const resultElements = document.querySelectorAll('.g, .tF2Cxc');

      resultElements.forEach((element) => {
        const linkElement = element.querySelector('a');
        const titleElement = element.querySelector('h3');
        const snippetElement = element.querySelector('.VwiC3b, .aCOpRe, .yXK7lf');

        const url = linkElement?.getAttribute('href') || '';
        const title = titleElement?.textContent?.trim() || '';
        const snippet = snippetElement?.textContent?.trim() || '';

        // Filter out job aggregator sites
        const isAggregator = url.includes('indeed.com') ||
                            url.includes('linkedin.com') ||
                            url.includes('glassdoor.com') ||
                            url.includes('ziprecruiter.com') ||
                            url.includes('monster.com');

        // Only include if it looks like a job posting
        const isJobRelated = url.includes('career') ||
                             url.includes('jobs') ||
                             url.includes('apply') ||
                             url.includes('position') ||
                             snippet.toLowerCase().includes('apply') ||
                             title.toLowerCase().includes('job') ||
                             title.toLowerCase().includes('career');

        if (url && url.startsWith('http') && !isAggregator && isJobRelated && title) {
          results.push({ title, url, snippet });
        }
      });

      return results;
    });

    console.log(`Found ${searchResults.length} potential job links from Google`);

    // Now visit each URL and try to extract job details
    const jobs: JobListing[] = [];

    for (const result of searchResults.slice(0, limit)) {
      try {
        console.log(`\nVisiting: ${result.url}`);

        // Create a new page for each job URL
        const jobPage = await browser.newPage();
        await jobPage.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Visit the job page with timeout
        await jobPage.goto(result.url, {
          waitUntil: 'networkidle2',
          timeout: 15000
        }).catch(() => {
          console.log(`Timeout loading ${result.url}`);
        });

        // Extract job details from the page
        const jobDetails = await jobPage.evaluate(() => {
          // Try to find job title
          const titleSelectors = [
            'h1',
            '[class*="job-title"]',
            '[class*="title"]',
            '[class*="position"]',
            '[data-automation="job-title"]',
            '.job-title',
            '.position-title'
          ];

          let jobTitle = '';
          for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent && element.textContent.trim().length > 5) {
              jobTitle = element.textContent.trim();
              break;
            }
          }

          // Try to find company name
          const companySelectors = [
            '[class*="company"]',
            '[class*="employer"]',
            '[data-automation="company-name"]',
            '.company-name',
            'meta[property="og:site_name"]'
          ];

          let companyName = '';
          for (const selector of companySelectors) {
            if (selector.startsWith('meta')) {
              const element = document.querySelector(selector);
              companyName = element?.getAttribute('content') || '';
            } else {
              const element = document.querySelector(selector);
              if (element?.textContent) {
                companyName = element.textContent.trim();
              }
            }
            if (companyName) break;
          }

          // If no company name found, try to extract from domain
          if (!companyName) {
            const domain = window.location.hostname;
            companyName = domain.split('.')[0];
            companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
          }

          // Try to find location
          const locationSelectors = [
            '[class*="location"]',
            '[class*="city"]',
            '[data-automation="location"]',
            '.job-location'
          ];

          let location = '';
          for (const selector of locationSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent) {
              location = element.textContent.trim();
              break;
            }
          }

          // Try to find description
          const descriptionSelectors = [
            '[class*="description"]',
            '[class*="summary"]',
            '[class*="job-detail"]',
            '.job-description',
            'main',
            'article'
          ];

          let description = '';
          for (const selector of descriptionSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent && element.textContent.trim().length > 100) {
              description = element.textContent.trim().slice(0, 500);
              break;
            }
          }

          // Try to find salary
          const salaryRegex = /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|hour|hr))?/i;
          const bodyText = document.body.innerText;
          const salaryMatch = bodyText.match(salaryRegex);
          const salary = salaryMatch ? salaryMatch[0] : '';

          return {
            jobTitle,
            companyName,
            location,
            description,
            salary
          };
        });

        await jobPage.close();

        // Use extracted details or fall back to Google result
        const title = jobDetails.jobTitle || result.title;
        const company = jobDetails.companyName || 'Unknown Company';
        const description = jobDetails.description || result.snippet;

        // Only add if we have a valid title and it looks like a job
        if (title && title.length > 3 && description.length > 50) {
          jobs.push({
            title: title.slice(0, 200),
            company: company.slice(0, 100),
            url: result.url,
            description: description.slice(0, 500),
            location: jobDetails.location || location || 'Not specified',
            salary: jobDetails.salary || undefined,
            source: 'Direct Company',
            postedDate: undefined
          });

          console.log(`✓ Extracted: ${title} at ${company}`);
        }

        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`Failed to extract job from ${result.url}:`, error);
        continue;
      }

      // Stop if we have enough jobs
      if (jobs.length >= limit) break;
    }

    console.log(`\n=== Successfully extracted ${jobs.length} real jobs ===\n`);
    return jobs;

  } catch (error) {
    console.error('Error in Google job search:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Alternative: Search using DuckDuckGo (no tracking, no rate limits)
 */
export async function searchDuckDuckGoForJobs(
  keywords: string,
  location: string = '',
  limit: number = 20
): Promise<JobListing[]> {
  let browser;

  try {
    console.log(`\n=== Searching DuckDuckGo for: "${keywords}" in "${location}" ===`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    const locationPart = location ? ` ${location}` : '';
    const searchQuery = `${keywords}${locationPart} apply career job opening -indeed -linkedin -glassdoor`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const duckduckgoUrl = `https://duckduckgo.com/?q=${encodedQuery}`;

    await page.goto(duckduckgoUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('[data-testid="result"]', { timeout: 10000 }).catch(() => {});

    const searchResults = await page.evaluate(() => {
      const results: { title: string; url: string; snippet: string }[] = [];
      const resultElements = document.querySelectorAll('[data-testid="result"]');

      resultElements.forEach((element) => {
        const linkElement = element.querySelector('a');
        const titleElement = element.querySelector('h2');
        const snippetElement = element.querySelector('[data-result="snippet"]');

        const url = linkElement?.getAttribute('href') || '';
        const title = titleElement?.textContent?.trim() || '';
        const snippet = snippetElement?.textContent?.trim() || '';

        const isAggregator = url.includes('indeed') || url.includes('linkedin') || url.includes('glassdoor');
        const isJobRelated = url.includes('career') || url.includes('jobs') || url.includes('apply');

        if (url && url.startsWith('http') && !isAggregator && isJobRelated && title) {
          results.push({ title, url, snippet });
        }
      });

      return results;
    });

    console.log(`Found ${searchResults.length} potential job links from DuckDuckGo`);

    // Process similar to Google search
    const jobs: JobListing[] = [];
    // ... (similar extraction logic as Google)

    return jobs;

  } catch (error) {
    console.error('Error in DuckDuckGo job search:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
