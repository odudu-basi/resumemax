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
 * Scrapes job listings from Dice (tech-focused job board)
 * Dice is excellent for software engineering and IT roles
 */
export async function scrapeDiceJobs(
  keywords: string,
  location: string = '',
  limit: number = 10
): Promise<JobListing[]> {
  let browser;

  try {
    console.log(`Scraping Dice for: ${keywords} in ${location}`);

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

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Construct Dice search URL
    const encodedKeywords = encodeURIComponent(keywords);
    const encodedLocation = encodeURIComponent(location || 'Remote');
    const searchUrl = `https://www.dice.com/jobs?q=${encodedKeywords}&location=${encodedLocation}&pageSize=${limit}`;

    console.log(`Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for job cards
    await page.waitForSelector('[data-cy="card-list"] [data-cy="card"], .card', {
      timeout: 10000
    }).catch(() => console.log('Job cards selector not found, continuing...'));

    // Extract job listings
    const jobs = await page.evaluate((limitJobs) => {
      const jobCards = document.querySelectorAll('[data-cy="card"], .card, [data-testid="job-card"]');
      const extractedJobs: any[] = [];

      jobCards.forEach((card, index) => {
        if (index >= limitJobs) return;

        try {
          // Extract job title
          const titleElement = card.querySelector('[data-cy="card-title"] a, h5 a, .card-title a');
          const title = titleElement?.textContent?.trim() || '';

          // Extract company name
          const companyElement = card.querySelector('[data-cy="search-result-company-name"], .card-company, [data-testid="company-name"]');
          const company = companyElement?.textContent?.trim() || '';

          // Extract job URL
          const linkElement = card.querySelector('[data-cy="card-title"] a, a.card-title-link');
          let jobUrl = linkElement?.getAttribute('href') || '';
          if (jobUrl && !jobUrl.startsWith('http')) {
            jobUrl = `https://www.dice.com${jobUrl}`;
          }

          // Extract location
          const locationElement = card.querySelector('[data-cy="search-result-location"], .card-location, [data-testid="job-location"]');
          const location = locationElement?.textContent?.trim() || '';

          // Extract salary
          const salaryElement = card.querySelector('.card-salary, [data-testid="salary"]');
          const salary = salaryElement?.textContent?.trim() || '';

          // Extract description
          const descElement = card.querySelector('.card-description, [data-cy="card-summary"]');
          const description = descElement?.textContent?.trim() || '';

          // Extract posted date
          const dateElement = card.querySelector('.posted-date, [data-testid="posted-date"]');
          const postedDate = dateElement?.textContent?.trim() || '';

          // Extract employment type
          const employmentType = card.querySelector('[data-testid="employment-type"]')?.textContent?.trim() || '';

          if (title && company && title.length > 3) {
            extractedJobs.push({
              title,
              company,
              url: jobUrl,
              description: description || `${title} position at ${company}. ${employmentType}`,
              location: location || 'Not specified',
              salary: salary || undefined,
              postedDate: postedDate || undefined,
              source: 'Dice'
            });
          }
        } catch (error) {
          console.error('Error extracting job card:', error);
        }
      });

      return extractedJobs;
    }, limit);

    console.log(`Extracted ${jobs.length} jobs from Dice`);
    return jobs;

  } catch (error) {
    console.error('Error scraping Dice:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
