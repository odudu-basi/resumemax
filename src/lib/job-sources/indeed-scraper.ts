import { withBrowserless } from '../browserless';
import type { EnhancedJobListing } from '@/src/types/user-profile';

/**
 * Indeed Job Scraper using Browserless
 *
 * Indeed has millions of jobs across all industries.
 * This is WAY better than relying on company-specific APIs.
 */

export async function searchIndeedJobs(
  keywords: string[],
  location?: string,
  limit: number = 50
): Promise<Partial<EnhancedJobListing>[]> {
  console.log(`\n=== Searching Indeed for: ${keywords.join(', ')} ===`);
  console.log(`Location: ${location || 'Remote'}`);

  return await withBrowserless(async (page) => {
    const jobs: Partial<EnhancedJobListing>[] = [];

    // Build Indeed search URL
    const searchQuery = keywords.join(' OR ');
    const searchLocation = location || 'Remote';
    const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(searchQuery)}&l=${encodeURIComponent(searchLocation)}`;

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for job cards to load
    await page.waitForSelector('.job_seen_beacon', { timeout: 10000 });

    // Extract job listings
    const jobElements = await page.$$('.job_seen_beacon');

    console.log(`Found ${jobElements.length} job listings`);

    for (const jobEl of jobElements.slice(0, limit)) {
      try {
        // Extract job data
        const title = await jobEl.$eval('h2.jobTitle', el => el.textContent?.trim() || '');
        const company = await jobEl.$eval('.companyName', el => el.textContent?.trim() || '').catch(() => 'Unknown');
        const location = await jobEl.$eval('.companyLocation', el => el.textContent?.trim() || '').catch(() => 'Remote');
        const link = await jobEl.$eval('a.jcs-JobTitle', el => el.getAttribute('href') || '').catch(() => '');
        const snippet = await jobEl.$eval('.job-snippet', el => el.textContent?.trim() || '').catch(() => '');

        if (title && link) {
          jobs.push({
            id: `indeed_${link.split('jk=')[1]?.split('&')[0]}`,
            title,
            company,
            location,
            applicationUrl: `https://www.indeed.com${link}`,
            description: snippet,
            source: 'Indeed',
            remote: location.toLowerCase().includes('remote'),
          });
        }
      } catch (error) {
        console.error('Error extracting job:', error);
        continue;
      }
    }

    console.log(`Extracted ${jobs.length} jobs from Indeed`);
    return jobs;
  });
}
