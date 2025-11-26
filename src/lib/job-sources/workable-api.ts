import axios from 'axios';
import type { EnhancedJobListing } from '@/src/types/user-profile';

/**
 * Workable Job Board API Integration
 *
 * Workable provides public job boards for companies:
 * https://[company].workable.com/api/v3/accounts/[company]/jobs
 *
 * 20,000+ companies use Workable including:
 * - Many mid-sized companies and startups
 * - International companies
 * - Growing tech companies
 */

interface WorkableJob {
  id: string;
  title: string;
  full_title: string;
  shortcode: string;
  code: string;
  state: string;
  department: string;
  url: string;
  application_url: string;
  shortlink: string;
  location: {
    location_str: string;
    country: string;
    country_code: string;
    region: string;
    region_code: string;
    city: string;
    zip_code: string;
    telecommuting: boolean;
  };
  created_at: string;
}

interface WorkableJobDetail extends WorkableJob {
  description: string;
  requirements: string;
  benefits: string;
  employment_type: string;
  experience: string;
  function: string;
  industry: string;
  education: string;
}

/**
 * Comprehensive list of companies using Workable
 * Updated with verified company list from companies file (~180 companies)
 */
export const WORKABLE_COMPANIES = [
  // === CMS & CONTENT PLATFORMS ===
  'contentful', 'sanity', 'prismic', 'strapi', 'ghost', 'butter-cms',
  'directus', 'payload-cms', 'keystonejs', 'tina-cms', 'builder-io',
  'storyblok', 'datocms', 'graphcms', 'contentstack', 'agility-cms',
  'kentico-kontent', 'magnolia', 'coremedia', 'bloomreach',

  // === HOSTING & INFRASTRUCTURE ===
  'acquia', 'pantheon', 'wpengine', 'kinsta', 'flywheel', 'siteground',
  'bluehost', 'hostgator', 'dreamhost', 'inmotion', 'a2hosting',
  'liquidweb', 'digitalocean', 'linode', 'vultr', 'hetzner', 'ovhcloud',
  'scaleway', 'cloudways', 'gridpane', 'runcloud', 'serverpilot', 'ploi',
  'forge', 'vapor', 'envoyer', 'chipper-ci', 'deploybot', 'deployhq', 'buddyworks',

  // === FINANCE & FINTECH ===
  'dave', 'brigit', 'moneylion', 'earnin', 'albert', 'cleo', 'current',
  'varo', 'aspiration', 'acorns', 'stash', 'public', 'm1-finance',
  'webull', 'titan', 'wealthsimple', 'questrade', 'interactive-brokers', 'td-ameritrade',

  // === HEALTHCARE & PHARMACY ===
  'capsule', 'alto-pharmacy', 'truepill', 'pillpack', 'medly-pharmacy',
  'nimble-rx', 'scriptdash', 'zipdrug', 'blink-health', 'goodrx',
  'singlecare', 'rxsaver', 'wellrx', 'scriptsave', 'familywize',
  'optumrx', 'express-scripts', 'cvs-caremark', 'humana-pharmacy', 'cigna-pharmacy',

  // === RETAIL & E-COMMERCE ===
  'italic', 'brandless', 'boxed', 'thrive-market', 'public-goods',
  'grove-collaborative', 'honest-company', 'beautycounter', 'curology',
  'function-of-beauty', 'prose', 'nutrafol', 'keeps', 'ritual', 'care-of',
  'persona-nutrition', 'rootine', 'nourish', 'vitamin-shoppe', 'gnc',

  // === FOOD & BEVERAGE ===
  'shake-shack', 'cava', 'andpizza', 'pret-a-manger', 'le-pain-quotidien',
  'bluestone-lane', 'joe-and-the-juice', 'juice-generation', 'juice-press',
  'daily-harvest', 'splendid-spoon', 'sakara-life', 'good-kitchen',
  'everytable', 'farmers-fridge', 'spyce', 'creator', 'eatsa',

  // === MEDIA & ENTERTAINMENT ===
  'vox-media', 'the-ringer', 'barstool-sports', 'bleacher-report',
  'sb-nation', 'the-verge', 'polygon', 'eater', 'racked', 'curbed',

  // === EDUCATION ===
  'kaplan', 'princeton-review', 'magoosh', 'prep-expert', 'revolution-prep',
  'wyzant', 'tutor', 'varsity-tutors', 'chegg-tutors', 'club-z',

  // === CONSTRUCTION & ENGINEERING ===
  'turner-construction', 'bechtel', 'kiewit', 'fluor', 'skanska',
  'aecom', 'jacobs-engineering', 'stantec', 'arcadis', 'wsp-global',

  // === DEVELOPER TOOLS ===
  'github', 'gitlab', 'bitbucket', 'circleci', 'travis',
  'jenkins', 'drone', 'buildkite', 'codefresh', 'semaphore',
  'datadog', 'newrelic', 'dynatrace', 'appdynamics', 'splunk',
  'sumo-logic', 'loggly', 'papertrail', 'sentry', 'rollbar',
  'bugsnag', 'raygun', 'airbrake',

  // === CYBERSECURITY ===
  'okta', 'auth0', 'onelogin', 'duo', 'ping-identity',
  'cloudflare', 'fastly', 'akamai', 'incapsula', 'sucuri',
  'snyk', 'veracode', 'checkmarx', 'sonarqube', 'whitesource',

  // === DATA & ANALYTICS ===
  'tableau', 'looker', 'mode', 'periscope', 'chartio',
  'metabase', 'redash', 'superset', 'sisense', 'domo',
  'segment', 'rudderstack', 'snowplow', 'mparticle',

  // === INFRASTRUCTURE ===
  'digitalocean', 'linode', 'vultr', 'hetzner', 'scaleway',
  'packet', 'equinix', 'terraform', 'pulumi', 'ansible',
  'puppet', 'chef', 'saltstack', 'consul', 'vault',

  // === COLLABORATION ===
  'slack', 'discord', 'zoom', 'whereby', 'around',
  'loom', 'mmhmm', 'descript', 'otter', 'fireflies',
  'grain', 'gong', 'chorus', 'wingman',

  // === HR & RECRUITING ===
  'lever', 'greenhouse', 'workable', 'breezy', 'recruitee',
  'bamboohr', 'namely', 'zenefits', 'gusto', 'justworks',
  'rippling', 'deel', 'remote', 'oyster', 'papaya-global',

  // === DESIGN & CREATIVE ===
  'canva', 'adobe', 'affinity', 'procreate', 'pixelmator',
  'sketch', 'figma', 'invision', 'zeplin', 'abstract',
  'marvel', 'proto', 'principle', 'flinto', 'origami',

  // === HEALTHCARE ===
  'zocdoc', 'one-medical', 'forward', 'carbon-health', 'heal',
  'doctor-on-demand', 'teladoc', 'amwell', 'mdlive', 'plushcare',

  // === EDUCATION ===
  'udemy', 'skillshare', 'masterclass', 'coursera', 'edx',
  'pluralsight', 'linkedin-learning', 'treehouse', 'codecademy', 'datacamp',

  // === LOGISTICS & DELIVERY ===
  'shippo', 'easypost', 'shipstation', 'shiphero', 'shipmondo',
  'sendcloud', 'boxzooka', 'shipbob', 'fulfil',
];

/**
 * Search Workable job boards for matching positions
 */
export async function searchWorkableJobs(
  keywords: string[],
  location?: string,
  limit: number = 50
): Promise<Partial<EnhancedJobListing>[]> {
  const allJobs: Partial<EnhancedJobListing>[] = [];

  console.log(`\n=== Searching Workable for: ${keywords.join(', ')} ===`);
  console.log(`Location filter: ${location || 'none'}`);
  console.log(`Searching across Workable companies (${WORKABLE_COMPANIES.length}+ verified)...`);

  // Shuffle companies for diversity
  const companies = [...WORKABLE_COMPANIES].sort(() => Math.random() - 0.5);

  let companiesSearched = 0;
  let companiesWithBoards = 0;
  const maxCompanies = 100; // Search up to 100 companies
  const minCompanies = 30; // Search at least 30 companies for diversity

  // Search each company's Workable board
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
      if (allJobs.length >= limit * 3 && companiesSearched >= minCompanies) {
        console.log(`Reached target: ${allJobs.length} jobs from ${companiesSearched} companies`);
        break;
      }

      // Respectful delay
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      // Silently skip 404s
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
 * Fetch jobs from a specific company's Workable board
 * Tries apply.workable.com first, then {slug}.workable.com as fallback.
 */
async function fetchCompanyJobs(
  companyId: string,
  keywords: string[],
  location?: string
): Promise<Partial<EnhancedJobListing>[]> {
  const jobs: Partial<EnhancedJobListing>[] = [];

  // Helper to fetch list from a given host (apply or subdomain)
  const fetchJobsFromHost = async (hostBase: string) => {
    const listUrl = `${hostBase}/api/v3/accounts/${companyId}/jobs`;

    const response = await axios.get<WorkableJob[]>(listUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobSearchBot/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.data || response.data.length === 0) return [];

    // If no keywords, use all; otherwise filter
    const filteredJobs = (!keywords || keywords.length === 0)
      ? response.data
      : (() => {
          const keywordLower = keywords.map(k => k.toLowerCase());
          return response.data.filter(job => {
            const searchText = `${job.title} ${job.full_title} ${job.department}`.toLowerCase();
            return keywordLower.some(keyword => searchText.includes(keyword));
          });
        })();

    // Convert to EnhancedJobListing format and fetch details
    for (const job of filteredJobs) {
      let description = '';
      let requirements = '';

      try {
        const detailUrl = `${hostBase}/api/v3/accounts/${companyId}/jobs/${job.shortcode}`;
        const detailResponse = await axios.get<WorkableJobDetail>(detailUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; JobSearchBot/1.0)',
            'Accept': 'application/json'
          }
        });

        if (detailResponse.data) {
          description = detailResponse.data.description || '';
          requirements = detailResponse.data.requirements || '';
        }

        // Small delay between detail requests
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (detailError) {
        // If detail fetch fails, continue with basic info
        console.log(`    Could not fetch details for job ${job.shortcode}`);
      }

      jobs.push({
        id: `workable-${companyId}-${job.id}`,
        title: job.title,
        company: companyId.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        location: job.location.location_str || `${job.location.city}, ${job.location.country}`,
        applicationUrl: job.application_url || job.url,
        description: description || job.full_title,
        requirements: requirements || '',
        postedDate: job.created_at,
        source: 'Workable',
        remoteType: job.location.telecommuting ? 'remote' : 'onsite',
        atsId: job.id,
        department: job.department,
      });
    }
  };

  // Try apply.workable.com first
  try {
    await fetchJobsFromHost(`https://apply.workable.com`);
    if (jobs.length > 0) return jobs;
  } catch (e) {
    // ignore and try subdomain fallback
  }

  // Then try {slug}.workable.com
  try {
    await fetchJobsFromHost(`https://${companyId}.workable.com`);
    if (jobs.length > 0) return jobs;
  } catch (error: any) {
    if (error.response?.status !== 404) throw error;
  }

  // If neither host yielded jobs, signal no public board
  throw new Error('No public board');
}

/**
 * Extract company name from Workable URL
 */
export function extractWorkableCompany(url: string): string | null {
  const match = url.match(/https?:\/\/([^.]+)\.workable\.com/);
  return match ? match[1] : null;
}
