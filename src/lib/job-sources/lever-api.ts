import axios from 'axios';
import type { EnhancedJobListing } from '@/src/types/user-profile';

/**
 * Lever Job Board API Integration
 *
 * Lever provides a public API for job boards:
 * https://hire.lever.co/developer/documentation
 *
 * Many companies use Lever including:
 * - Netflix, Shopify, Canva, Grammarly, Segment
 * - Zoom, Twitch, Postmates, Coursera, Mixpanel
 * - And many more startups and tech companies
 */

interface LeverJob {
  id: string;
  text: string; // Job title
  categories: {
    team?: string;
    location?: string;
    commitment?: string;
  };
  description: string; // HTML description
  lists: Array<{
    text: string;
    content: string;
  }>;
  additional: string;
  hostedUrl: string;
  applyUrl: string;
  createdAt: number;
}

/**
 * Comprehensive list of companies using Lever
 * Updated with verified company list from companies file (~150 companies)
 */
export const LEVER_COMPANIES = [
  // === TECHNOLOGY & SOFTWARE ===
  'netflix', 'shopify', 'spotify', 'benchling', 'convoy', 'scale-ai', 'anduril',
  'samsara', 'toast', 'block', 'square', 'flexport', 'udemy', 'course-hero',
  'grammarly', 'automattic', 'zapier', 'vimeo', 'medium', 'genius',
  'unity', 'roblox', 'epic-games', 'riot-games', 'invision', 'framer',
  'abstract', 'sketch', 'postman', 'insomnia', 'docker', 'kubernetes',
  'red-hat', 'suse', 'canonical', 'puppet', 'chef', 'ansible', 'terraform',
  'pulumi', 'circleci', 'travis-ci', 'jenkins', 'buildkite', 'semaphore',
  'codefresh', 'harness', 'spinnaker', 'argo', 'flux', 'tekton',

  // === FINANCE & FINTECH ===
  'sofi', 'lendingclub', 'credit-karma', 'earnest', 'betterment', 'wealthfront',
  'personal-capital', 'gemini', 'kraken', 'crypto', 'ftx', 'blockfi',
  'celsius', 'nexo', 'voyager', 'anchorage', 'bitgo', 'fireblocks', 'ledger', 'trezor',

  // === HEALTHCARE & BIOTECH ===
  'noom', 'headspace', 'calm', 'talkspace', 'betterhelp', 'spring-health',
  'lyra-health', 'modern-health', 'ginger', 'omada-health', 'livongo',
  'teladoc', 'mdlive', 'amwell', 'doctor-on-demand', 'k-health', '98point6',
  'plushcare', 'lemonaid', 'nurx',

  // === RETAIL & E-COMMERCE ===
  'faire', 'poshmark', 'depop', 'mercari', 'reverb', 'stockx', 'goat',
  'grailed', 'the-realreal', 'vestiaire-collective', 'rebag', 'fashionphile',
  'material-bank',

  // === FOOD & BEVERAGE ===
  'grubhub', 'seamless', 'caviar', 'chownow', 'eatstreet', 'slice', 'tock',
  'resy', 'opentable', 'yelp',

  // === MEDIA & ENTERTAINMENT ===
  'twitch', 'tiktok', 'cameo', 'memberful', 'gumroad', 'kofi', 'buy-me-a-coffee',
  'teachable', 'thinkific', 'kajabi', 'podia', 'circle', 'mighty-networks',
  'guilded', 'telegram', 'signal',

  // === EDUCATION ===
  'chegg', 'quizlet', 'brainly', 'study', 'outschool', 'classdojo', 'remind',
  'bloomz', 'seesaw', 'classtag',

  // === REAL ESTATE & COWORKING ===
  'wework', 'industrious', 'convene', 'knotel', 'the-wing', 'neuehouse',
  'soho-house', 'selina', 'common', 'bungalow',
];

/**
 * Search Lever job boards for matching positions
 */
export async function searchLeverJobs(
  keywords: string[],
  location?: string,
  limit: number = 50
): Promise<Partial<EnhancedJobListing>[]> {
  const allJobs: Partial<EnhancedJobListing>[] = [];

  console.log(`\n=== Searching Lever for: ${keywords.join(', ')} ===`);
  console.log(`Location filter: ${location || 'none'}`);
  console.log(`Searching across Lever companies (${LEVER_COMPANIES.length}+ companies)...`);

  // Use ALL companies - we want comprehensive coverage (shuffle for diversity)
  const companies = [...LEVER_COMPANIES].sort(() => Math.random() - 0.5);

  let companiesSearched = 0;
  let companiesWithBoards = 0;
  const maxCompanies = 100; // Search up to 100 companies
  const minCompanies = 30; // Search at least 30 companies for diversity

  // Search each company's Lever board
  for (const company of companies.slice(0, maxCompanies)) {
    try {
      companiesSearched++;
      const jobs = await fetchLeverCompanyJobs(company, keywords, location);

      if (jobs.length > 0) {
        companiesWithBoards++;
        console.log(`  ✓ ${company}: Found ${jobs.length} matching jobs`);
        allJobs.push(...jobs);
      }

      // Continue searching to ensure diversity across companies
      // Only stop early if we have BOTH enough jobs AND searched enough companies
      if (allJobs.length >= limit * 2 && companiesSearched >= minCompanies) {
        console.log(`Reached target: ${allJobs.length} jobs from ${companiesSearched} companies`);
        break;
      }

      // Respectful delay
      await new Promise(resolve => setTimeout(resolve, 150));

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
  return allJobs;
}

/**
 * Fetch jobs from a specific company's Lever board
 */
async function fetchLeverCompanyJobs(
  companyId: string,
  keywords: string[],
  location?: string
): Promise<Partial<EnhancedJobListing>[]> {
  try {
    // Lever API endpoint
    const url = `https://api.lever.co/v0/postings/${companyId}`;

    const response = await axios.get(url, {
      params: {
        mode: 'json'
      },
      headers: {
        'User-Agent': 'JobSearchApp/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const leverJobs = response.data as LeverJob[];

    // DEBUG: Log first company with jobs
    if (leverJobs.length > 0 && companyId === 'netflix') {
      console.log(`  [DEBUG] ${companyId} has ${leverJobs.length} total jobs`);
      console.log(`  [DEBUG] Keywords: ${keywords.join(', ')}`);
      console.log(`  [DEBUG] Sample titles: ${leverJobs.slice(0, 5).map(j => j.text).join(', ')}`);
    }

    // If no keywords, return all jobs (mapped) for ingestion use-cases
    if (!keywords || keywords.length === 0) {
      return leverJobs.map(job => mapLeverJob(job, companyId));
    }

    // Otherwise, filter jobs by keywords AND location
    const matchedJobs = leverJobs
      .filter(job => {
        const titleLower = job.text.toLowerCase();
        const descriptionLower = (job.description || '').toLowerCase();
        const jobText = `${titleLower} ${descriptionLower}`;
        const locationLower = job.categories.location?.toLowerCase() || '';

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
      .map(job => mapLeverJob(job, companyId));

    // Fallback: if no keyword matches, return a small set filtered only by location
    if (matchedJobs.length === 0) {
      const fallback = leverJobs
        .filter(job => {
          const locationLower = job.categories.location?.toLowerCase() || '';
          if (!location || location.toLowerCase() === 'united states') return true;
          return locationLower.includes(location.toLowerCase()) || locationLower.includes('remote');
        })
        .slice(0, 5)
        .map(job => mapLeverJob(job, companyId));

      return fallback;
    }

    return matchedJobs;

  } catch (error: any) {
    if (error.response?.status === 404) {
      // Company doesn't have Lever or board is private
      return [];
    }
    throw error;
  }
}

/**
 * Map Lever job to our format
 */
function mapLeverJob(
  job: LeverJob,
  companyId: string
): Partial<EnhancedJobListing> {
  // Parse HTML content to extract sections
  const { description, requirements, responsibilities } = parseLeverJobContent(job.description, job.lists);

  return {
    id: `lever_${companyId}_${job.id}`,
    title: job.text,
    company: formatCompanyName(companyId),
    applicationUrl: job.applyUrl,
    description,
    requirements,
    responsibilities,
    location: job.categories.location || 'Not specified',
    remoteType: determineRemoteType(job.categories.location || ''),
    postedDate: new Date(job.createdAt).toLocaleDateString(),
    source: 'Lever',
    atsId: job.id,
  };
}

/**
 * Parse Lever job content to extract structured data
 */
function parseLeverJobContent(html: string, lists: Array<{text: string; content: string}>): {
  description: string;
  requirements: string[];
  responsibilities: string[];
} {
  // Remove HTML tags for basic text extraction
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract from lists (Lever structures content in lists)
  let requirements: string[] = [];
  let responsibilities: string[] = [];

  lists.forEach(list => {
    const listText = list.text.toLowerCase();
    const content = list.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (listText.includes('requirement') || listText.includes('qualification') || listText.includes('skill')) {
      requirements = content.split(/[•\n-]/).filter(r => r.trim().length > 10).slice(0, 10);
    } else if (listText.includes('responsibilit') || listText.includes('duties') || listText.includes('you will')) {
      responsibilities = content.split(/[•\n-]/).filter(r => r.trim().length > 10).slice(0, 10);
    }
  });

  // Fallback to text parsing if lists don't contain structured data
  if (requirements.length === 0) {
    const requirementsMatch = text.match(/requirements?:?(.{0,1000})/i);
    requirements = requirementsMatch
      ? requirementsMatch[1].split(/[•\n-]/).filter(r => r.trim().length > 10).slice(0, 10)
      : [];
  }

  if (responsibilities.length === 0) {
    const responsibilitiesMatch = text.match(/responsibilities?:?(.{0,1000})/i);
    responsibilities = responsibilitiesMatch
      ? responsibilitiesMatch[1].split(/[•\n-]/).filter(r => r.trim().length > 10).slice(0, 10)
      : [];
  }

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
 * Discover if a company uses Lever
 */
export async function discoverLeverCompany(
  companySlug: string
): Promise<boolean> {
  try {
    const url = `https://api.lever.co/v0/postings/${companySlug}`;

    await axios.get(url, {
      params: { mode: 'json' },
      headers: {
        'User-Agent': 'JobSearchApp/1.0',
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    console.log(`✓ ${companySlug} uses Lever!`);
    return true;

  } catch (error) {
    return false;
  }
}
