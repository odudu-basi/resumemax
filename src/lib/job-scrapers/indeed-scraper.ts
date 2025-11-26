import puppeteer from 'puppeteer';

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
 * Scrapes job listings from Indeed using Puppeteer
 * Indeed requires JavaScript rendering, so we use headless browser
 */
export async function scrapeIndeedJobs(
  keywords: string,
  location: string = '',
  limit: number = 10
): Promise<JobListing[]> {
  let browser;

  try {
    console.log(`Scraping Indeed for: ${keywords} in ${location}`);

    // Launch headless browser
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

    // Construct Indeed search URL
    const encodedKeywords = encodeURIComponent(keywords);
    const encodedLocation = encodeURIComponent(location || 'Remote');
    const searchUrl = `https://www.indeed.com/jobs?q=${encodedKeywords}&l=${encodedLocation}&sort=date`;

    console.log(`Navigating to: ${searchUrl}`);

    // Navigate to Indeed with timeout
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for job cards to load
    await page.waitForSelector('.job_seen_beacon, .jobsearch-ResultsList, .slider_container', {
      timeout: 10000
    }).catch(() => console.log('Job cards selector not found, continuing...'));

    // Extract job listings
    const jobs = await page.evaluate((limitJobs) => {
      const jobCards = document.querySelectorAll('.job_seen_beacon, .slider_item, .result');
      const extractedJobs: any[] = [];

      jobCards.forEach((card, index) => {
        if (index >= limitJobs) return;

        try {
          // Extract job title
          const titleElement = card.querySelector('.jobTitle span[title], .jobTitle a, h2.jobTitle span');
          const title = titleElement?.textContent?.trim() || '';

          // Extract company name
          const companyElement = card.querySelector('[data-testid="company-name"], .companyName, .company');
          const company = companyElement?.textContent?.trim() || '';

          // Extract job URL
          const linkElement = card.querySelector('a[data-jk], .jcs-JobTitle, h2.jobTitle a');
          let jobUrl = linkElement?.getAttribute('href') || '';
          if (jobUrl && !jobUrl.startsWith('http')) {
            jobUrl = `https://www.indeed.com${jobUrl}`;
          }

          // Extract location
          const locationElement = card.querySelector('[data-testid="text-location"], .companyLocation, .location');
          const location = locationElement?.textContent?.trim() || '';

          // Extract salary
          const salaryElement = card.querySelector('.salary-snippet, .metadata.salary-snippet-container, [data-testid="attribute_snippet_testid"]');
          const salary = salaryElement?.textContent?.trim() || '';

          // Extract description
          const descElement = card.querySelector('.job-snippet, .summary, [data-testid="job-snippet"]');
          const description = descElement?.textContent?.trim() || '';

          // Extract posted date
          const dateElement = card.querySelector('.date, [data-testid="myJobsStateDate"]');
          const postedDate = dateElement?.textContent?.trim() || '';

          if (title && company && title.length > 3) {
            extractedJobs.push({
              title,
              company,
              url: jobUrl,
              description: description || `${title} position at ${company}.`,
              location: location || 'Not specified',
              salary: salary || undefined,
              postedDate: postedDate || undefined,
              source: 'Indeed'
            });
          }
        } catch (error) {
          console.error('Error extracting job card:', error);
        }
      });

      return extractedJobs;
    }, limit);

    console.log(`Extracted ${jobs.length} jobs from Indeed`);
    return jobs;

  } catch (error) {
    console.error('Error scraping Indeed:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
