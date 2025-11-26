/**
 * Discover Real Workable Companies
 *
 * Workable is used by smaller/mid-size companies.
 * Let's test companies that are more likely to use it.
 */

import axios from 'axios';

// Test if a company has a Workable board
async function testWorkable(company: string): Promise<boolean> {
  try {
    const url = `https://${company}.workable.com/api/v3/accounts/${company}/jobs`;
    const response = await axios.get(url, { timeout: 5000 });
    return Array.isArray(response.data) && response.data.length > 0;
  } catch {
    return false;
  }
}

// Smaller companies more likely to use Workable
const POTENTIAL_WORKABLE_COMPANIES = [
  // Hosting/Infrastructure (actual users)
  'kinsta', 'wpengine', 'siteground', 'a2hosting', 'liquidweb',

  // Agencies & Services
  'toptal', 'upwork', 'fiverr', 'deel', '10up', 'automattic',

  // SaaS Tools
  'ahrefs', 'semrush', 'hotjar', 'crazy-egg', 'optimizely',
  'kissmetrics', 'mixpanel', 'heap', 'fullstory',

  // EdTech
  'skillshare', 'udemy', 'coursera', 'edx', 'teachable',

  // Real Estate Tech
  'zillow', 'redfin', 'compass', 'opendoor', 'better',

  // FinTech (smaller)
  'chime', 'current', 'varo', 'dave', 'earnin',

  // Healthcare Tech
  'ro', 'hims', 'nurx', 'curology', 'headspace',

  // E-commerce/DTC
  'shopify', 'bigcommerce', 'wix', 'squarespace', 'webflow',
  'printful', 'printify', 'spocket', 'oberlo',

  // Marketing/Sales Tools
  'hubspot', 'mailchimp', 'sendinblue', 'activecampaign',
  'convertkit', 'drip', 'klaviyo',

  // Developer Tools (smaller)
  'postman', 'insomnia', 'ngrok', 'localtunnel',

  // Gaming/Entertainment
  'roblox', 'unity', 'unreal', 'epicgames',

  // Food/Delivery
  'doordash', 'ubereats', 'grubhub', 'postmates',

  // Known Workable Users (from web research)
  'beat', 'blueground', 'workable', 'persado', 'hellas-direct',
  'taxibeat', 'softomotive', 'instacar', 'e-food',
];

async function discoverWorkable() {
  console.log('🔍 Discovering Workable companies with public boards...\n');

  const working: string[] = [];
  const failed: string[] = [];

  for (const company of POTENTIAL_WORKABLE_COMPANIES) {
    const hasBoard = await testWorkable(company);

    if (hasBoard) {
      console.log(`  ✓ ${company}`);
      working.push(company);
    } else {
      failed.push(company);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n\n=== RESULTS ===`);
  console.log(`\n✓ Working (${working.length}):`, working);
  console.log(`\n✗ Failed (${failed.length}):`, failed.length, 'companies');

  console.log(`\n\n=== COMPANY ARRAY ===`);
  console.log(`export const WORKABLE_COMPANIES = [`);
  working.forEach(c => console.log(`  '${c}',`));
  console.log(`];`);
}

discoverWorkable().catch(console.error);
