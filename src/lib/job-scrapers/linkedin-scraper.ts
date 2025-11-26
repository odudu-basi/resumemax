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
 * Scrapes job listings from LinkedIn using Puppeteer
 * Note: LinkedIn has strong anti-bot measures, so this may be rate-limited
 */
export async function scrapeLinkedInJobs(
  keywords: string,
  location: string = '',
  limit: number = 10
): Promise<JobListing[]> {
  let browser;

  try {
    console.log(`Scraping LinkedIn for: ${keywords} in ${location}`);

    // Launch headless browser with stealth mode
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
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();

    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Hide webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Construct LinkedIn jobs search URL (public jobs, no login required)
    const encodedKeywords = encodeURIComponent(keywords);
    const encodedLocation = encodeURIComponent(location || 'Worldwide');
    const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodedKeywords}&location=${encodedLocation}&sortBy=DD`;

    console.log(`Navigating to: ${searchUrl}`);

    // Navigate to LinkedIn with timeout
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for job cards to load
    await page.waitForSelector('.jobs-search__results-list, .base-search-card, .job-search-card', {
      timeout: 10000
    }).catch(() => console.log('Job cards selector not found, continuing...'));

    // Small delay to ensure content is loaded
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract job listings
    const jobs = await page.evaluate((limitJobs) => {
      const jobCards = document.querySelectorAll('.base-card, .base-search-card, .job-search-card, .jobs-search-results__list-item');
      const extractedJobs: any[] = [];

      jobCards.forEach((card, index) => {
        if (index >= limitJobs) return;

        try {
          // Extract job title
          const titleElement = card.querySelector('.base-search-card__title, h3.base-search-card__title, .job-search-card__title');
          const title = titleElement?.textContent?.trim() || '';

          // Extract company name
          const companyElement = card.querySelector('.base-search-card__subtitle, h4.base-search-card__subtitle, .job-search-card__company-name');
          const company = companyElement?.textContent?.trim() || '';

          // Extract job URL
          const linkElement = card.querySelector('a.base-card__full-link, a');
          let jobUrl = linkElement?.getAttribute('href') || '';

          // Clean up LinkedIn tracking parameters
          if (jobUrl) {
            jobUrl = jobUrl.split('?')[0];
            if (!jobUrl.startsWith('http')) {
              jobUrl = `https://www.linkedin.com${jobUrl}`;
            }
          }

          // Extract location
          const locationElement = card.querySelector('.job-search-card__location, .base-search-card__metadata span');
          const location = locationElement?.textContent?.trim() || '';

          // Extract posted date
          const dateElement = card.querySelector('.job-search-card__listdate, time');
          const postedDate = dateElement?.textContent?.trim() || dateElement?.getAttribute('datetime') || '';

          // Extract any available snippet/description
          const snippetElement = card.querySelector('.job-search-card__snippet, .base-search-card__snippet');
          const description = snippetElement?.textContent?.trim() || '';

          if (title && company && title.length > 3) {
            extractedJobs.push({
              title,
              company,
              url: jobUrl,
              description: description || `${title} role at ${company}. Check LinkedIn for full details.`,
              location: location || 'Not specified',
              salary: undefined, // LinkedIn rarely shows salary in search results
              postedDate: postedDate || undefined,
              source: 'LinkedIn'
            });
          }
        } catch (error) {
          console.error('Error extracting job card:', error);
        }
      });

      return extractedJobs;
    }, limit);

    console.log(`Extracted ${jobs.length} jobs from LinkedIn`);
    return jobs;

  } catch (error) {
    console.error('Error scraping LinkedIn:', error);

    // LinkedIn is very protective, so failure is expected without proper authentication
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('navigation'))) {
      console.log('LinkedIn requires more sophisticated scraping or API access');
    }

    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
