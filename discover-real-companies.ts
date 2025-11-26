/**
 * Company Discovery Script
 *
 * This script tests which companies actually have public job boards
 * on Greenhouse, Lever, and Workable.
 *
 * Usage: npx tsx discover-real-companies.ts
 */

import axios from 'axios';

// Test if a company has a Greenhouse board
async function testGreenhouse(company: string): Promise<boolean> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`;
    const response = await axios.get(url, { timeout: 5000 });
    return response.data.jobs && response.data.jobs.length > 0;
  } catch {
    return false;
  }
}

// Test if a company has a Lever board
async function testLever(company: string): Promise<boolean> {
  try {
    const url = `https://api.lever.co/v0/postings/${company}`;
    const response = await axios.get(url, { params: { mode: 'json' }, timeout: 5000 });
    return Array.isArray(response.data) && response.data.length > 0;
  } catch {
    return false;
  }
}

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

// Major tech companies to test
const TEST_COMPANIES = [
  // Big tech
  'google', 'meta', 'apple', 'amazon', 'microsoft', 'netflix', 'spotify',

  // Startups/Scaleups
  'stripe', 'airbnb', 'uber', 'lyft', 'doordash', 'instacart', 'coinbase',
  'robinhood', 'plaid', 'brex', 'ramp', 'notion', 'figma', 'canva',

  // Enterprise
  'salesforce', 'oracle', 'sap', 'workday', 'servicenow', 'snowflake',
  'databricks', 'confluent', 'mongodb', 'elastic',

  // More companies
  'shopify', 'square', 'twilio', 'zoom', 'slack', 'dropbox', 'atlassian',
  'gitlab', 'github', 'docker', 'hashicorp', 'datadog', 'okta',
];

async function discoverCompanies() {
  console.log('🔍 Discovering companies with public job boards...\n');

  const results = {
    greenhouse: [] as string[],
    lever: [] as string[],
    workable: [] as string[],
  };

  for (const company of TEST_COMPANIES) {
    console.log(`Testing ${company}...`);

    const [hasGreenhouse, hasLever, hasWorkable] = await Promise.all([
      testGreenhouse(company),
      testLever(company),
      testWorkable(company),
    ]);

    if (hasGreenhouse) {
      console.log(`  ✓ Greenhouse: ${company}`);
      results.greenhouse.push(company);
    }
    if (hasLever) {
      console.log(`  ✓ Lever: ${company}`);
      results.lever.push(company);
    }
    if (hasWorkable) {
      console.log(`  ✓ Workable: ${company}`);
      results.workable.push(company);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n\n=== RESULTS ===\n');
  console.log(`Greenhouse (${results.greenhouse.length}):`, results.greenhouse);
  console.log(`\nLever (${results.lever.length}):`, results.lever);
  console.log(`\nWorkable (${results.workable.length}):`, results.workable);
}

discoverCompanies().catch(console.error);
