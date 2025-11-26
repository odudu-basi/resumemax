import axios from 'axios';
import type { EnhancedJobListing } from '@/src/types/user-profile';

/**
 * Greenhouse Job Board API Integration
 *
 * Greenhouse provides a public API for job boards:
 * https://developers.greenhouse.io/job-board.html
 *
 * 7,000+ companies use Greenhouse including:
 * - Airbnb, Stripe, DoorDash, Coinbase, Robinhood
 * - Notion, Figma, GitLab, Twilio, Canva
 * - And many more startups and tech companies
 */

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: {
    name: string;
  };
  metadata: any[];
  updated_at: string;
  requisition_id: string;
}

interface GreenhouseJobDetail {
  id: number;
  title: string;
  content: string; // HTML description
  updated_at: string;
  location: {
    name: string;
  };
  absolute_url: string;
  internal_job_id: number;
  requisition_id: string;
  metadata: any[];
}

/**
 * Comprehensive list of companies using Greenhouse
 * Updated with verified company list from companies file (~160 companies)
 */
export const GREENHOUSE_COMPANIES = [
  // === TECHNOLOGY & SOFTWARE ===
  'airbnb', 'hubspot', 'duolingo', 'hellofresh', 'doordash', 'robinhood', 'pinterest',
  'notion', 'figma', 'stripe', 'coinbase', 'databricks', 'canva', 'discord', 'reddit',
  'snap', 'dropbox', 'zoom', 'twilio', 'atlassian', 'asana', 'slack', 'docusign',
  'box', 'zendesk', 'okta', 'datadog', 'snowflake', 'confluent', 'mongodb',
  'elastic', 'hashicorp', 'gitlab', 'pagerduty', 'sentry', 'airtable', 'retool',
  'vercel', 'linear', 'loom', 'miro', 'calendly', 'amplitude', 'segment',
  'mixpanel', 'lattice', 'rippling', 'gusto', 'front', 'superhuman', 'coda',
  'webflow', 'deel', 'remote', 'hopin', 'mural', 'podium', 'charthop',
  'gong', 'apollo', 'clearbit', 'intercom', 'drift', 'gainsight', 'pendo',
  'heap', 'fullstory', 'looker', 'tableau', 'periscope-data', 'mode-analytics',
  'sisense', 'thoughtspot', 'domo', 'qlik', 'mulesoft', 'talend', 'informatica',
  'fivetran', 'airbyte', 'census', 'hightouch', 'rudderstack', 'mparticle',
  'tealium', 'optimizely', 'launchdarkly', 'split', 'statsig', 'posthog',

  // === FINANCE & FINTECH ===
  'brex', 'affirm', 'chime', 'plaid', 'mercury', 'ramp', 'modern-treasury',
  'marqeta', 'adyen', 'checkout',

  // === HEALTHCARE & BIOTECH ===
  '23andme', 'oscar-health', 'ro', 'hims', 'one-medical', 'carbon-health',
  'cityblock-health', 'komodo-health', 'tempus', 'flatiron-health', 'guardant-health',
  'invitae', 'natera', 'myriad-genetics', 'foundation-medicine', 'grail',
  'exact-sciences', 'illumina', 'pacific-biosciences', '10x-genomics',

  // === RETAIL & E-COMMERCE ===
  'wayfair', 'etsy', 'warby-parker', 'allbirds', 'glossier', 'away',
  'everlane', 'thredup', 'rent-the-runway', 'stitch-fix', 'casper', 'purple',
  'peloton', 'fabletics', 'outdoor-voices', 'gymshark', 'lululemon', 'vuori',
  'alo-yoga', 'sweaty-betty',

  // === FOOD & BEVERAGE ===
  'sweetgreen', 'dig-inn', 'blue-apron', 'instacart', 'postmates', 'sun-basket',
  'factor', 'freshly', 'territory-foods', 'snap-kitchen',

  // === MEDIA & ENTERTAINMENT ===
  'buzzfeed', 'vice-media', 'the-athletic', 'patreon', 'substack', 'anchor',
  'soundcloud', 'audible', 'scribd', 'blinkist',

  // === EDUCATION ===
  'coursera', 'udacity', 'khan-academy', 'codecademy', 'masterclass', 'skillshare',
  'pluralsight', 'linkedin-learning', 'guild-education', '2u',

  // === REAL ESTATE & CONSTRUCTION ===
  'zillow', 'redfin', 'compass', 'opendoor', 'offerpad', 'knock',
  'divvy-homes', 'landing', 'sonder', 'domio',
];

/**
 * Search Greenhouse job boards for matching positions
 * EXPANDED: Now searches ALL available Greenhouse companies
 */
export async function searchGreenhouseJobs(
  keywords: string[],
  location?: string,
  limit: number = 50
): Promise<Partial<EnhancedJobListing>[]> {
  const allJobs: Partial<EnhancedJobListing>[] = [];

  console.log(`\n=== Searching Greenhouse for: ${keywords.join(', ')} ===`);
  console.log(`Location filter: ${location || 'none'}`);
  console.log(`Searching across ALL Greenhouse companies (${GREENHOUSE_COMPANIES.length}+ verified)...`);

  // Use ALL companies - we want comprehensive coverage (shuffle for diversity)
  const companies = [...GREENHOUSE_COMPANIES].sort(() => Math.random() - 0.5);

  let companiesSearched = 0;
  let companiesWithBoards = 0;
  const maxCompanies = 200; // Search up to 200 companies
  const minCompanies = 50; // Search at least 50 companies for diversity

  // Search each company's Greenhouse board
  for (const company of companies.slice(0, maxCompanies)) {
    try {
      companiesSearched++;
      const jobs = await fetchCompanyJobs(company, keywords, location);

      if (jobs.length > 0) {
        companiesWithBoards++;
        console.log(`  ✓ ${company}: Found ${jobs.length} matching jobs`);
        allJobs.push(...jobs);
      }

      // Continue searching to ensure diversity across companies
      // Only stop early if we have BOTH enough jobs AND searched enough companies
      if (allJobs.length >= limit * 3 && companiesSearched >= minCompanies) {
        console.log(`Reached target: ${allJobs.length} jobs from ${companiesSearched} companies`);
        break;
      }

      // Respectful delay (reduced to search faster)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      // Log non-404 errors for debugging
      if (error.response?.status !== 404) {
        console.log(`  ✗ ${company}: ${error.message}`);
      }
      continue;
    }
  }

  console.log(`Searched ${companiesSearched} companies, ${companiesWithBoards} had accessible boards`);
  console.log(`Total jobs collected (before filtering): ${allJobs.length}`);
  return allJobs; // Return ALL jobs, we'll filter in the route
}

/**
 * Fetch jobs from a specific company's Greenhouse board
 * NOW WITH FULL JOB DESCRIPTIONS for better matching
 */
async function fetchCompanyJobs(
  companyId: string,
  keywords: string[],
  location?: string
): Promise<Partial<EnhancedJobListing>[]> {
  try {
    // Greenhouse API endpoint
    const url = `https://boards-api.greenhouse.io/v1/boards/${companyId}/jobs`;

    const response = await axios.get(url, {
      params: {
        content: 'true' // Include job descriptions
      },
      headers: {
        'User-Agent': 'JobSearchApp/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const greenhouseJobs = response.data.jobs as GreenhouseJobDetail[];

    // DEBUG: Log first company with jobs
    if (greenhouseJobs.length > 0 && companyId === 'spacex') {
      console.log(`  [DEBUG] ${companyId} has ${greenhouseJobs.length} total jobs`);
      console.log(`  [DEBUG] Keywords: ${keywords.join(', ')}`);
      console.log(`  [DEBUG] Sample titles: ${greenhouseJobs.slice(0, 5).map(j => j.title).join(', ')}`);
    }

    // If no keywords, return all jobs (mapped) for ingestion use-cases
    if (!keywords || keywords.length === 0) {
      return greenhouseJobs.map(job => mapGreenhouseJobDetail(job, companyId));
    }

    // Otherwise, filter jobs by keywords AND location
    // We do basic filtering here to reduce dataset, then AI does deeper analysis later
    const matchedJobs = greenhouseJobs
      .filter(job => {
        const titleLower = job.title.toLowerCase();
        const descriptionLower = (job.content || '').toLowerCase();
        const jobText = `${titleLower} ${descriptionLower}`;
        const locationLower = job.location.name.toLowerCase();

        // KEYWORD MATCHING: Check if job matches any of the search keywords
        const keywordMatch = keywords.some(keyword => {
          const keywordLower = keyword.toLowerCase();

          // Split keyword phrase into individual words
          const words = keywordLower.split(' ').filter(w =>
            // Filter out common qualifiers that might not be in job titles
            !['entry', 'level', 'junior', 'senior', 'graduate', 'jobs', 'trainee', 'intern', 'the', 'a', 'an'].includes(w)
          );

          // Check if the full phrase appears in title or description
          if (jobText.includes(keywordLower)) return true;

          // OR check if at least 30% (min 1) of meaningful words appear
          if (words.length > 0) {
            const matchedWords = words.filter(word =>
              word.length > 3 && (titleLower.includes(word) || descriptionLower.includes(word))
            );
            const threshold = Math.max(1, Math.ceil(words.length * 0.3));
            return matchedWords.length >= threshold;
          }

          return false;
        });

        // LOCATION MATCHING: Check location if specified
        let locationMatch = true;
        if (location && location.toLowerCase() !== 'united states') {
          // Only filter by specific location if not "United States"
          locationMatch = locationLower.includes(location.toLowerCase()) ||
                         locationLower.includes('remote');
        }

        return keywordMatch && locationMatch;
      })
      .map(job => mapGreenhouseJobDetail(job, companyId));

    // Fallback: if no keyword matches, return a small set filtered only by location
    if (matchedJobs.length === 0) {
      const fallback = greenhouseJobs
        .filter(job => {
          const locationLower = job.location.name.toLowerCase();
          if (!location || location.toLowerCase() === 'united states') return true;
          return locationLower.includes(location.toLowerCase()) || locationLower.includes('remote');
        })
        .slice(0, 10)
        .map(job => mapGreenhouseJobDetail(job, companyId));

      return fallback;
    }

    return matchedJobs;

  } catch (error: any) {
    if (error.response?.status === 404) {
      // Company doesn't have Greenhouse or board is private
      return [];
    }
    throw error;
  }
}

/**
 * Get detailed information for a specific job
 */
export async function getGreenhouseJobDetails(
  companyId: string,
  jobId: number
): Promise<Partial<EnhancedJobListing> | null> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${companyId}/jobs/${jobId}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'JobSearchApp/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const job = response.data as GreenhouseJobDetail;
    return mapGreenhouseJobDetail(job, companyId);

  } catch (error: any) {
    console.error(`Failed to fetch job details: ${error.message}`);
    return null;
  }
}

/**
 * Map Greenhouse job to our format
 */
function mapGreenhouseJob(
  job: GreenhouseJob,
  companyId: string
): Partial<EnhancedJobListing> {
  return {
    id: `greenhouse_${companyId}_${job.id}`,
    title: job.title,
    company: formatCompanyName(companyId),
    applicationUrl: job.absolute_url,
    location: job.location.name,
    remoteType: determineRemoteType(job.location.name),
    postedDate: new Date(job.updated_at).toLocaleDateString(),
    source: 'Greenhouse',
    atsId: job.id.toString(),
  };
}

/**
 * Map detailed Greenhouse job to our format
 */
function mapGreenhouseJobDetail(
  job: GreenhouseJobDetail,
  companyId: string
): Partial<EnhancedJobListing> {
  // Parse HTML content to extract sections
  const { description, requirements, responsibilities } = parseJobContent(job.content);

  return {
    id: `greenhouse_${companyId}_${job.id}`,
    title: job.title,
    company: formatCompanyName(companyId),
    applicationUrl: job.absolute_url,
    description,
    requirements,
    responsibilities,
    location: job.location.name,
    remoteType: determineRemoteType(job.location.name),
    postedDate: new Date(job.updated_at).toLocaleDateString(),
    source: 'Greenhouse',
    atsId: job.id.toString(),
  };
}

/**
 * Parse HTML job content to extract structured data
 */
function parseJobContent(html: string): {
  description: string;
  requirements: string[];
  responsibilities: string[];
} {
  // Remove HTML tags for basic text extraction
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract requirements section
  const requirementsMatch = text.match(/requirements?:?(.{0,1000})/i);
  const requirements = requirementsMatch
    ? requirementsMatch[1].split(/[•\n-]/).filter(r => r.trim().length > 10).slice(0, 10)
    : [];

  // Extract responsibilities section
  const responsibilitiesMatch = text.match(/responsibilities?:?(.{0,1000})/i);
  const responsibilities = responsibilitiesMatch
    ? responsibilitiesMatch[1].split(/[•\n-]/).filter(r => r.trim().length > 10).slice(0, 10)
    : [];

  return {
    description: text.slice(0, 500),
    requirements,
    responsibilities,
  };
}

/**
 * Determine if job is remote/hybrid/onsite
 */
function determineRemoteType(location: string): 'remote' | 'hybrid' | 'onsite' {
  const locationLower = location.toLowerCase();

  if (locationLower.includes('remote') || locationLower.includes('anywhere')) {
    return 'remote';
  } else if (locationLower.includes('hybrid')) {
    return 'hybrid';
  } else {
    return 'onsite';
  }
}

/**
 * Format company ID to display name
 */
function formatCompanyName(companyId: string): string {
  return companyId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Discover if a company uses Greenhouse
 * Useful for expanding our company list
 */
export async function discoverGreenhouseCompany(
  companySlug: string
): Promise<boolean> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs`;

    await axios.get(url, {
      headers: {
        'User-Agent': 'JobSearchApp/1.0',
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    console.log(`✓ ${companySlug} uses Greenhouse!`);
    return true;

  } catch (error) {
    return false;
  }
}
