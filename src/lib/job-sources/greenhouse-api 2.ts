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
 * List of major tech companies using Greenhouse
 * We can query these directly
 */
export const GREENHOUSE_COMPANIES = [
  'airbnb',
  'stripe',
  'doordash',
  'coinbase',
  'robinhood',
  'notion',
  'figma',
  'gitlab',
  'twilio',
  'canva',
  'instacart',
  'databricks',
  'rippling',
  'scale',
  'ramp',
  'plaid',
  'checkr',
  'airtable',
  'gusto',
  'chime',
  'affirm',
  'brex',
  'lattice',
  'faire',
  'verkada',
  'webflow',
  'benchling',
  'flexport',
  'amplitude',
  'samsara',
  'squarespace',
  // Add more as needed
];

/**
 * Search Greenhouse job boards for matching positions
 */
export async function searchGreenhouseJobs(
  keywords: string[],
  location?: string,
  limit: number = 50
): Promise<Partial<EnhancedJobListing>[]> {
  const allJobs: Partial<EnhancedJobListing>[] = [];

  console.log(`\n=== Searching Greenhouse for: ${keywords.join(', ')} ===`);

  // Search each company's Greenhouse board
  for (const company of GREENHOUSE_COMPANIES.slice(0, 20)) {
    try {
      const jobs = await fetchCompanyJobs(company, keywords, location);
      allJobs.push(...jobs);

      // Stop if we have enough jobs
      if (allJobs.length >= limit) break;

      // Respectful delay
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`Failed to fetch ${company}:`, error);
      continue;
    }
  }

  console.log(`Found ${allJobs.length} jobs from Greenhouse`);
  return allJobs.slice(0, limit);
}

/**
 * Fetch jobs from a specific company's Greenhouse board
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

    const greenhouseJobs = response.data.jobs as GreenhouseJob[];

    // Filter and map jobs
    const matchedJobs = greenhouseJobs
      .filter(job => {
        const titleLower = job.title.toLowerCase();
        const locationLower = job.location.name.toLowerCase();

        // Check if any keyword matches the title
        const keywordMatch = keywords.some(keyword =>
          titleLower.includes(keyword.toLowerCase())
        );

        // Check location if specified
        const locationMatch = !location ||
          locationLower.includes(location.toLowerCase()) ||
          locationLower.includes('remote');

        return keywordMatch && locationMatch;
      })
      .map(job => mapGreenhouseJob(job, companyId));

    console.log(`  ${companyId}: Found ${matchedJobs.length} matching jobs`);
    return matchedJobs;

  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error && (error as any).response?.status === 404) {
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

  } catch (error) {
    console.error(`Failed to fetch job details:`, error);
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
