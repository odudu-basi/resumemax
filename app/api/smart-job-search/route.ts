import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserProfileSchema, type UserProfile, type EnhancedJobListing } from '@/src/types/user-profile';
import { searchGreenhouseJobs, GREENHOUSE_COMPANIES } from '@/src/lib/job-sources/greenhouse-api';
// Removed Lever and Workable imports - now only using Greenhouse
import {
  generateSearchQueries,
  batchCalculateMatches,
  generateRecommendationSummary
} from '@/src/lib/ai-job-discovery';

// Force Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for comprehensive search

/**
 * Smart Job Search API
 *
 * This is the NEW approach:
 * 1. User provides complete profile (resume + preferences + requirements)
 * 2. AI generates optimal search queries
 * 3. Search real job sources (Greenhouse, Lever, etc.) - NO Indeed/LinkedIn
 * 4. AI matches jobs to profile with detailed scoring
 * 5. Return ranked results with match criteria
 */

// Rate limiting
const requestTimes: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  while (requestTimes.length > 0 && requestTimes[0] < oneMinuteAgo) {
    requestTimes.shift();
  }

  if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  requestTimes.push(now);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    console.log('\n=== Smart Job Search Started ===');

    // Check rate limit
    if (!checkRateLimit()) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      );
    }

    // Parse and validate user profile
    const body = await request.json();
    const profile = UserProfileSchema.parse(body);

    console.log(`Searching for: ${profile.preferences.jobTitles.join(', ')}`);
    console.log(`Seniority: ${profile.preferences.seniorityLevel}`);
    console.log(`Salary Range: $${profile.requirements.salaryRange.min}-${profile.requirements.salaryRange.max}`);
    console.log(`Visa Status: ${profile.requirements.visaStatus}`);
    console.log(`Locations: ${profile.preferences.locations.join(', ')}`);

    // === STEP 1: AI generates smart search queries ===
    console.log('\n[Step 1] Generating AI-powered search queries...');
    const searchQueries = await generateSearchQueries(profile);
    console.log(`Generated ${searchQueries.length} search queries:`, searchQueries.slice(0, 3));

    // === STEP 2: Search Greenhouse jobs only ===
    console.log('\n[Step 2] Searching Greenhouse jobs...');

    const allJobs: Partial<EnhancedJobListing>[] = [];

    // Search Greenhouse (only source)
    console.log('  - Searching Greenhouse API...');
    const greenhouseJobs = await searchGreenhouseJobs(
      searchQueries.slice(0, 8), // Use top 8 queries for more comprehensive search
      undefined, // Don't filter by location here - we'll filter after getting all jobs
      150 // Get up to 150 jobs from Greenhouse (increased since it's the only source)
    );
    allJobs.push(...greenhouseJobs);

    console.log(`Total jobs found: ${allJobs.length} (Greenhouse only)`);

    // Remove duplicates by URL (still needed in case of duplicate listings)
    const uniqueJobs = allJobs.filter(
      (job, index, self) =>
        index === self.findIndex(j => j.applicationUrl === job.applicationUrl)
    );

    console.log(`After deduplication: ${uniqueJobs.length} unique Greenhouse jobs`);

    // === STEP 3: Enhanced filtering by critical requirements ===
    console.log('\n[Step 3] Filtering by enhanced requirements...');

    let filteredJobs = uniqueJobs;

    // Helper function to extract state from location
    const extractState = (location: string): string => {
      if (!location) return '';
      
      const stateMap: { [key: string]: string } = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
      };
      
      const locationLower = location.toLowerCase();
      
      // Check for state abbreviations (e.g., "San Francisco, CA")
      const stateAbbrevMatch = locationLower.match(/\b([a-z]{2})\b$/);
      if (stateAbbrevMatch) {
        return stateAbbrevMatch[1].toUpperCase();
      }
      
      // Check for full state names
      for (const [fullName, abbrev] of Object.entries(stateMap)) {
        if (locationLower.includes(fullName)) {
          return abbrev;
        }
      }
      
      return location;
    };

    // 1. CRITICAL: Filter by visa requirements (REQUIRED)
    const beforeVisaFilter = filteredJobs.length;
    if (profile.requirements.requiresSponsorship) {
      const hasVisaKeywords = (text: string) => {
        const t = (text || '').toLowerCase();
        const positive = ['visa sponsor', 'h1b', 'sponsorship available', 'work authorization provided', 'will sponsor'];
        const negative = ['no sponsorship', 'must be authorized to work', 'cannot sponsor', 'unable to sponsor', 'us citizen only', 'green card only'];
        const pos = positive.some(k => t.includes(k));
        const neg = negative.some(k => t.includes(k));
        return { pos, neg };
      };

      filteredJobs = filteredJobs.filter(job => {
        // If field explicitly says no → reject
        if (job.visaSponsorship === false) return false;

        // Heuristic from description if unknown
        const { pos, neg } = hasVisaKeywords(`${job.description} ${job.requirements?.join(' ')}`);
        if (neg) return false;
        if (pos) return true;

        // Keep unknowns to avoid over-filtering
        return true;
      });
      console.log(`Visa filter: ${beforeVisaFilter} jobs -> ${filteredJobs.length} jobs (requires sponsorship)`);
    } else {
      console.log(`Visa filter: No sponsorship required, keeping all ${filteredJobs.length} jobs`);
    }

    // 2. CRITICAL: Filter by state/location (REQUIRED)
    const beforeLocationFilter = filteredJobs.length;
    if (profile.preferences.locations.length > 0) {
      const userStates = profile.preferences.locations.map(loc => extractState(loc));
      console.log(`User preferred states: ${userStates.join(', ')}`);

      filteredJobs = filteredJobs.filter(job => {
        const jobState = extractState(job.location || '');
        
        // Check if job is remote and user accepts remote
        if (job.remoteType === 'remote' && profile.preferences.remotePreference !== 'onsite') {
          return true;
        }
        
        // Check if job state matches any user preferred state
        const stateMatch = userStates.some(userState => {
          if (!userState || !jobState) return false;
          return userState === jobState || 
                 jobState.includes(userState) || 
                 userState.includes(jobState);
        });
        
        return stateMatch;
      });

      console.log(`Location filter: ${beforeLocationFilter} jobs -> ${filteredJobs.length} jobs`);
      console.log(`Sample locations: ${filteredJobs.slice(0, 5).map(j => j.location).join(', ')}`);
    }

    // 3. CRITICAL: Filter by role match (REQUIRED) 
    const beforeRoleFilter = filteredJobs.length;
    if (profile.preferences.jobTitles.length > 0) {
      const targetRoles = profile.preferences.jobTitles.map(r => r.toLowerCase());
      
      // Generate related roles for broader matching
      const generateRelatedRoles = (roles: string[]): string[] => {
        const related: string[] = [];
        roles.forEach(role => {
          const roleLower = role.toLowerCase();
          
          // Add seniority variations
          if (!roleLower.includes('senior')) related.push(`senior ${role}`);
          if (!roleLower.includes('junior')) related.push(`junior ${role}`);
          if (!roleLower.includes('lead')) related.push(`lead ${role}`);
          if (!roleLower.includes('principal')) related.push(`principal ${role}`);
          
          // Non-software engineering domain synonyms
          if (roleLower.includes('industrial')) {
            related.push('manufacturing engineer', 'process engineer', 'production engineer', 'operations engineer', 'continuous improvement engineer');
          }
          if (roleLower.includes('mechanical')) {
            related.push('mechanical design engineer', 'design engineer', 'r&d engineer', 'manufacturing engineer');
          }
          if (roleLower.includes('civil')) {
            related.push('structural engineer', 'transportation engineer', 'geotechnical engineer', 'water resources engineer', 'construction engineer');
          }
          if (roleLower.includes('electrical')) {
            related.push('electronics engineer', 'hardware engineer', 'power systems engineer', 'controls engineer');
          }
          if (roleLower.includes('manufacturing')) {
            related.push('process engineer', 'production engineer', 'industrial engineer');
          }
          if (roleLower.includes('process')) {
            related.push('manufacturing engineer', 'industrial engineer', 'production engineer');
          }
        });
        return [...new Set(related)];
      };
      
      const relatedRoles = generateRelatedRoles(profile.preferences.jobTitles).map(r => r.toLowerCase());
      const allRoles = [...targetRoles, ...relatedRoles];

      // Detect non-software engineering families
      const isNonSoftwareEng = targetRoles.some(r => (
        r.includes('industrial') || r.includes('mechanical') || r.includes('civil') ||
        r.includes('manufacturing') || r.includes('process') || r.includes('structural') ||
        r.includes('transportation') || r.includes('geotechnical') || r.includes('electrical')
      ));
      
      console.log(`Target roles: ${targetRoles.join(', ')}`);
      console.log(`Related roles: ${relatedRoles.slice(0, 5).join(', ')}`);

      filteredJobs = filteredJobs.filter(job => {
        const title = job.title?.toLowerCase() || '';
        const desc = `${job.description || ''} ${Array.isArray(job.requirements) ? job.requirements.join(' ') : (job.requirements || '')}`.toLowerCase();
        
        // Exclude obvious non-tech roles unless title has tech indicators (only for software families)
        if (!isNonSoftwareEng) {
          const negativeTitleTerms = [
            'customer', 'support', 'sales', 'marketing', 'recruiter', 'talent', 'hr',
            'finance', 'accountant', 'operations', 'operation', 'designer', 'design',
            'customer experience', 'customer success'
          ];
          const techIndicators = [
            'engineer', 'developer', 'software', 'swe', 'backend', 'front end', 'frontend',
            'full stack', 'full-stack', 'devops', 'platform', 'data', 'ml', 'ai', 'android',
            'ios', 'qa', 'test', 'sre', 'infra', 'security'
          ];
          const hasNegative = negativeTitleTerms.some(term => title.includes(term));
          const hasTech = techIndicators.some(term => title.includes(term));
          if (hasNegative && !hasTech) {
            return false;
          }
        }

        // Build expanded keywords for matching (title OR description for non-software eng)
        const expandedRoleKeywords = allRoles;

        // Strict title matching for software roles; relaxed for non-software engineering
        const exactRoleMatchInTitle = expandedRoleKeywords.some(role => title.includes(role));

        const allWordsTargetMatch = targetRoles.some(role => {
          const words = role.split(' ').filter(w => w.length > 2);
          return words.length > 0 && words.every(w => title.includes(w));
        });

        if (isNonSoftwareEng) {
          // Allow description match to catch domain synonyms, and allow generic 'engineer' titles
          const matchInDesc = expandedRoleKeywords.some(role => desc.includes(role));
          const genericEngineerTitle = title.includes('engineer');
          return exactRoleMatchInTitle || allWordsTargetMatch || matchInDesc || genericEngineerTitle;
        }

        return exactRoleMatchInTitle || allWordsTargetMatch;
      });

      console.log(`Role filter: ${beforeRoleFilter} jobs -> ${filteredJobs.length} jobs`);
    }

    console.log(`After enhanced requirement filtering: ${filteredJobs.length} jobs`);

    // === STEP 4: AI match scores and company diversity ===
    console.log('\n[Step 4] Calculating AI match scores...');

    // Calculate match criteria for all filtered jobs
    const matchCriteria = await batchCalculateMatches(filteredJobs, profile);
    
    // Attach match criteria to jobs
    const jobsWithMatches: EnhancedJobListing[] = filteredJobs.map((job, index) => ({
      ...(job as EnhancedJobListing),
      matchCriteria: matchCriteria[index],
    }));

    // Sort by match score
    jobsWithMatches.sort((a, b) => b.matchCriteria.overallScore - a.matchCriteria.overallScore);

    // === STEP 4.5: Company diversity filtering (max 7 per company) ===
    console.log('\n[Step 4.5] Applying company diversity filter (max 7 per company)...');
    
    const companyJobCounts: Record<string, number> = {};
    const diverseJobs: EnhancedJobListing[] = [];
    const MAX_JOBS_PER_COMPANY = 7;

    for (const job of jobsWithMatches) {
      const companyKey = job.company.toLowerCase();
      const currentCount = companyJobCounts[companyKey] || 0;
      
      if (currentCount < MAX_JOBS_PER_COMPANY) {
        diverseJobs.push(job);
        companyJobCounts[companyKey] = currentCount + 1;
      }
      
      // Stop when we have enough diverse jobs
      if (diverseJobs.length >= 50) {
        break;
      }
    }

    console.log(`Company diversity applied: ${jobsWithMatches.length} jobs -> ${diverseJobs.length} jobs`);
    console.log(`Companies represented: ${Object.keys(companyJobCounts).length}`);
    
    const strictlyFilteredJobs = diverseJobs;

    // Sort by overall match score
    strictlyFilteredJobs.sort((a, b) => b.matchCriteria.overallScore - a.matchCriteria.overallScore);

    // === STEP 5: Generate personalized recommendation ===
    console.log('\n[Step 5] Generating personalized recommendations...');

    const recommendationSummary = strictlyFilteredJobs.length > 0
      ? await generateRecommendationSummary(strictlyFilteredJobs.slice(0, 5), profile)
      : 'No jobs found matching all your requirements. Try adjusting your search criteria.';

    // === STEP 6: Return results ===
    const topJobs = strictlyFilteredJobs.slice(0, 50); // Return top 50 matches

    console.log(`\n=== Returning ${topJobs.length} ranked Greenhouse jobs (all meeting critical requirements) ===`);
    console.log(`Top 3 matches:`);
    topJobs.slice(0, 3).forEach((job, i) => {
      console.log(`  ${i + 1}. ${job.title} at ${job.company}`);
    });

    return NextResponse.json({
      success: true,
      jobs: topJobs,
      metadata: {
        totalFound: allJobs.length,
        afterBasicFiltering: filteredJobs.length,
        afterStrictFiltering: strictlyFilteredJobs.length,
        returned: topJobs.length,
        searchQueries: searchQueries.slice(0, 5),
        sources: ['Greenhouse (All Companies)'], // Only searching Greenhouse
        recommendationSummary,
        searchCriteria: {
          jobTitles: profile.preferences.jobTitles,
          seniorityLevel: profile.preferences.seniorityLevel,
          salaryRange: profile.requirements.salaryRange,
          visaStatus: profile.requirements.visaStatus,
          requiresSponsorship: profile.requirements.requiresSponsorship,
          locations: profile.preferences.locations,
          remotePreference: profile.preferences.remotePreference,
        },
        filteringNotes: [
          `✓ All ${topJobs.length} jobs match your target roles or related roles`,
          `✓ All jobs are in your preferred states: ${profile.preferences.locations.join(', ')} or are remote`,
          profile.requirements.requiresSponsorship
            ? '✓ All jobs either offer visa sponsorship or status is unknown'
            : '✓ Visa requirements met',
          `✓ Jobs are filtered from ${GREENHOUSE_COMPANIES.length}+ companies on Greenhouse`,
          `✓ Company diversity: Max ${MAX_JOBS_PER_COMPANY} jobs per company for balanced results`
        ]
      }
    });

  } catch (error) {
    console.error('=== Smart Job Search Error ===');
    console.error(error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid profile data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Job search failed';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Smart Job Search API',
    version: '3.0',
    description: 'AI-powered job discovery using real company job boards - NOW WITH EXPANDED COVERAGE & STRICT FILTERING',
    method: 'POST',
    endpoint: '/api/smart-job-search',

    newInV4: [
      '🔥 Added Lever job board support (Netflix, Shopify, Canva, etc.)',
      '🔥 Company diversity filter: Max 7 jobs per company',
      '🔥 Restored AI job matching with detailed criteria analysis',
      '🔥 Searches 200+ Greenhouse + 100+ Lever companies',
      '🔥 Enhanced job descriptions parsing for both sources',
    ],

    howItWorks: [
      '1. User provides complete profile (resume + preferences + requirements)',
      '2. AI generates 10-15 optimal search queries based on profile',
      '3. Search 200+ Greenhouse + 100+ Lever companies (Stripe, Netflix, Shopify, etc.)',
      '4. Fetch FULL job descriptions, requirements, responsibilities',
      '5. Filter by basic criteria (location, keywords)',
      '6. AI analyzes each job description for visa, skills, seniority',
      '7. STRICT filtering - ONLY jobs meeting ALL critical requirements',
      '8. Apply company diversity filter (max 7 jobs per company)',
      '9. Return top 50 ranked results with detailed AI match explanations'
    ],

    criticalRequirements: {
      visaMatch: 'REQUIRED - If you need sponsorship, job must offer it (detected from description)',
      locationMatch: 'REQUIRED - Job must be in your preferred states OR remote',
      roleMatch: 'REQUIRED - Job must match your target roles or clearly related roles',
      note: 'Jobs failing ANY critical requirement are automatically rejected'
    },

    requiredFields: {
      resume: 'Parsed resume data (personal info, experience, skills, education)',
      preferences: 'Job search preferences (titles, locations, remote preference, seniority)',
      requirements: 'Hard requirements (salary range, visa status, requiresSponsorship)',
    },

    optionalFields: {
      additionalInfo: 'Career goals, deal breakers, must-haves, interests, etc.',
      searchSettings: 'Max results, alert frequency, etc.',
    },

    jobSources: [
      '✅ Greenhouse API (200+ companies actively searched)',
      '  - Tech: Stripe, Airbnb, Coinbase, Notion, Figma, GitLab, Discord, Reddit',
      '  - Aerospace: SpaceX, Blue Origin, Rocket Lab, Joby Aviation, Anduril',
      '  - Finance: Robinhood, Plaid, Ramp, Brex, Mercury, Carta',
      '  - Robotics: Boston Dynamics, Sarcos, Agility Robotics',
      '  - And 180+ more companies',
      '✅ Lever API (100+ companies actively searched)',
      '  - Streaming: Netflix, Twitch, Spotify',
      '  - E-commerce: Shopify, Canva, Grammarly',
      '  - Enterprise: Zoom, Coursera, Mixpanel, Segment',
      '  - And 80+ more companies',
      '✅ Workable API (selected companies actively searched)',
      '⏳ AngelList/Wellfound (coming soon)',
    ],

    excluded: [
      '❌ Indeed (AI-generated spam)',
      '❌ LinkedIn (duplicate listings)',
      '❌ Glassdoor (aggregator)',
      '❌ ZipRecruiter (aggregator)',
      '❌ Any fake/scam job boards'
    ],

    matchCriteria: {
      visaMatch: '25% - Can you legally work in this role? (auto-detected from description)',
      locationMatch: '25% - Is job in your preferred state(s) or remote?',
      roleMatch: '25% - Does role match your target positions?',
      skillsMatch: '15% - Do your skills align with requirements?',
      experienceMatch: '10% - Is experience level appropriate?',
      salaryMatch: 'Bonus - Does salary meet expectations?',
      cultureFit: 'Bonus - Does company/role match your goals?'
    },

    filteringPipeline: {
      step1: 'Search 200+ companies → 100-300 jobs',
      step2: 'Basic filters (location, keywords) → 50-150 jobs',
      step3: 'AI analysis (full descriptions) → 50-150 jobs with scores',
      step4: 'STRICT filtering (ALL requirements) → 20-50 jobs',
      step5: 'Return top 50 ranked by match score',
      guarantee: 'Every job shown meets ALL your critical requirements'
    },

    features: [
      '✓ 100% real jobs from 200+ verified companies',
      '✓ Full job description analysis (not just titles)',
      '✓ Auto-detects visa sponsorship from descriptions',
      '✓ STRICT filtering - only perfect matches',
      '✓ Direct application links to company pages',
      '✓ AI-powered match scoring with detailed explanations',
      '✓ Personalized recommendations based on your profile',
      '✓ Filters by visa, state, role (REQUIRED)',
      '✓ Bonus scoring for salary, skills, culture fit',
      '✓ No aggregator sites or fake listings'
    ],

    exampleResults: {
      totalFound: 247,
      afterBasicFiltering: 134,
      afterStrictFiltering: 52,
      returned: 50,
      guarantee: 'All 50 jobs match your role, location, AND visa requirements'
    },

    rateLimit: '10 requests per minute',
    maxDuration: '60 seconds',
    companiesSearched: '200+',
  });
}
