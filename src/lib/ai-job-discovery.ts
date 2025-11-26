import OpenAI from 'openai';
import { getConfig } from './env';
import type { UserProfile, EnhancedJobListing, JobMatchCriteria } from '@/src/types/user-profile';

const config = getConfig();
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * AI-Powered Job Discovery Engine
 *
 * Uses GPT-4 to:
 * 1. Analyze user profile and extract key requirements
 * 2. Generate optimal search queries
 * 3. Match jobs to user profile with detailed scoring
 * 4. Provide personalized recommendations
 */

/**
 * Generate smart search queries based on user profile
 * AI understands the user's background and goals to create targeted searches
 */
export async function generateSearchQueries(profile: UserProfile): Promise<string[]> {
  try {
    const prompt = `Based on this candidate profile, generate 10-15 optimal job search queries that would find the best matching positions, including related and similar roles.

CANDIDATE PROFILE:
- Target Job Titles: ${profile.preferences.jobTitles.join(', ')}
- Seniority Level: ${profile.preferences.seniorityLevel}
- Top Skills: ${profile.resume.skills.technical.slice(0, 10).join(', ')}
- Recent Experience: ${profile.resume.experience[0]?.title} at ${profile.resume.experience[0]?.company}
- Years of Experience: ~${estimateYearsOfExperience(profile)} years
- Industries Interested: ${profile.preferences.industries?.join(', ') || 'Open'}
- Career Goals: ${profile.additionalInfo?.careerGoals || 'Not specified'}

ENHANCED SEARCH STRATEGY:
Generate queries that will find jobs matching:
1. EXACT target titles: ${profile.preferences.jobTitles.join(', ')}
2. RELATED roles someone with their background could do
3. SENIORITY variations (junior, senior, lead, principal, staff)
4. COMPANY naming variations (engineer vs developer vs programmer)
5. SPECIALIZATION areas within their field
6. SKILL-BASED roles using their top skills

Examples of what to include:
- If target is "Software Engineer", also search: "Software Developer", "Backend Engineer", "Full Stack Engineer", "Senior Software Engineer", "SWE", "Application Developer"
- If target is "Product Manager", also search: "Senior Product Manager", "Associate Product Manager", "Product Owner", "Technical Product Manager"
- Include skill-based searches like "React Developer", "Python Engineer" if those are top skills

IMPORTANT RULES:
- Focus ONLY on job titles and roles (we filter location/visa separately)
- Include both broad terms ("Software Engineer") and specific ones ("Senior React Developer")
- Consider career progression (if they're mid-level, include senior roles too)
- Use industry-standard abbreviations and variations
- Don't include company names or locations in queries

Return ONLY a JSON array of search query strings:
["query 1", "query 2", "query 3", ...]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7, // Higher for creativity in search terms
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const queries = JSON.parse(cleaned) as string[];
      console.log(`Generated ${queries.length} search queries`);
      return queries;
    }

    // Fallback to basic queries
    return generateBasicQueries(profile);

  } catch (error) {
    console.error('Error generating search queries:', error);
    return generateBasicQueries(profile);
  }
}

/**
 * Calculate comprehensive match criteria for a job
 * SIMPLIFIED: No AI calls, just deterministic scoring based on filters already applied
 * Since we filter strictly in the route, we just need simple scoring here
 */
export async function calculateMatchCriteria(
  job: Partial<EnhancedJobListing>,
  profile: UserProfile
): Promise<JobMatchCriteria> {
  // Use basic deterministic matching - no AI calls needed
  return calculateBasicMatch(job, profile);
}

/**
 * Batch calculate match criteria for multiple jobs (more efficient)
 */
export async function batchCalculateMatches(
  jobs: Partial<EnhancedJobListing>[],
  profile: UserProfile
): Promise<JobMatchCriteria[]> {
  // For large batches, process in chunks to avoid token limits
  const BATCH_SIZE = 5;
  const results: JobMatchCriteria[] = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(job => calculateMatchCriteria(job, profile))
    );
    results.push(...batchResults);

    // Small delay between batches
    if (i + BATCH_SIZE < jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Generate personalized job recommendations
 * AI explains why certain jobs are particularly good fits
 */
export async function generateRecommendationSummary(
  topJobs: EnhancedJobListing[],
  profile: UserProfile
): Promise<string> {
  try {
    const prompt = `As a career advisor, write a brief personalized summary (3-4 sentences) of the top job matches for this candidate.

CANDIDATE BACKGROUND:
- Looking for: ${profile.preferences.jobTitles.join(' or ')}
- Current: ${profile.resume.experience[0]?.title} at ${profile.resume.experience[0]?.company}
- Goals: ${profile.additionalInfo?.careerGoals || 'Career growth'}

TOP MATCHES:
${topJobs.slice(0, 3).map((job, i) => `${i + 1}. ${job.title} at ${job.company} (${job.matchCriteria.overallScore}% match)`).join('\n')}

Write an encouraging, personalized summary that:
1. Highlights the strongest matches
2. Mentions key skills that align well
3. Notes any exciting opportunities (company stage, growth potential, etc.)
4. Keeps it concise and action-oriented

Return plain text only, no formatting.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content?.trim() || '';

  } catch (error) {
    console.error('Error generating recommendation summary:', error);
    return '';
  }
}

// === Helper Functions ===

/**
 * Extract state abbreviation or name from location string
 */
function extractStateFromLocation(location: string): string {
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
  
  // Return original if no match found
  return location;
}

/**
 * Generate related job roles using AI
 */
async function generateRelatedRoles(targetRoles: string[]): Promise<string[]> {
  try {
    const prompt = `Given these target job roles, generate 5-8 related or similar job titles that someone with similar skills might also be qualified for.

Target Roles: ${targetRoles.join(', ')}

Consider:
- Different seniority levels (junior, senior, lead, principal)
- Different company naming conventions (engineer vs developer vs programmer)
- Specialized variations (frontend, backend, full-stack, etc.)
- Related roles in the same field

Return ONLY a JSON array of related job titles:
["related role 1", "related role 2", ...]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.5,
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as string[];
    }
  } catch (error) {
    console.error('Error generating related roles:', error);
  }
  
  // Fallback to basic related roles
  return generateBasicRelatedRoles(targetRoles);
}

/**
 * Generate basic related roles as fallback
 */
function generateBasicRelatedRoles(targetRoles: string[]): string[] {
  const relatedRoles: string[] = [];
  
  targetRoles.forEach(role => {
    const roleLower = role.toLowerCase();
    
    // Add seniority variations
    if (!roleLower.includes('senior')) relatedRoles.push(`Senior ${role}`);
    if (!roleLower.includes('junior')) relatedRoles.push(`Junior ${role}`);
    if (!roleLower.includes('lead')) relatedRoles.push(`Lead ${role}`);
    
    // Add common variations
    if (roleLower.includes('engineer')) {
      relatedRoles.push(role.replace(/engineer/i, 'Developer'));
    }
    if (roleLower.includes('developer')) {
      relatedRoles.push(role.replace(/developer/i, 'Engineer'));
    }
  });
  
  return [...new Set(relatedRoles)]; // Remove duplicates
}

function estimateYearsOfExperience(profile: UserProfile): number {
  let totalMonths = 0;

  for (const exp of profile.resume.experience) {
    const start = new Date(exp.startDate);
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    totalMonths += Math.max(0, months);
  }

  return Math.round(totalMonths / 12);
}

function generateBasicQueries(profile: UserProfile): string[] {
  const queries: string[] = [];

  // Add each job title with variations
  profile.preferences.jobTitles.forEach(title => {
    queries.push(title);

    // Add seniority variations
    const seniorities = ['Junior', 'Senior', 'Lead', 'Principal', 'Staff'];
    seniorities.forEach(seniority => {
      if (!title.toLowerCase().includes(seniority.toLowerCase())) {
        queries.push(`${seniority} ${title}`);
      }
    });

    // Add common variations
    if (title.toLowerCase().includes('engineer')) {
      queries.push(title.replace(/engineer/i, 'Developer'));
    }
    if (title.toLowerCase().includes('developer')) {
      queries.push(title.replace(/developer/i, 'Engineer'));
    }

    // Domain-specific synonyms to improve non-software coverage
    const t = title.toLowerCase();
    if (t.includes('industrial')) {
      queries.push('Manufacturing Engineer');
      queries.push('Process Engineer');
      queries.push('Production Engineer');
      queries.push('Operations Engineer');
      queries.push('Continuous Improvement Engineer');
    }
    if (t.includes('mechanical')) {
      queries.push('Mechanical Design Engineer');
      queries.push('Design Engineer');
      queries.push('R&D Engineer');
      queries.push('Manufacturing Engineer');
    }
    if (t.includes('civil')) {
      queries.push('Structural Engineer');
      queries.push('Transportation Engineer');
      queries.push('Geotechnical Engineer');
      queries.push('Water Resources Engineer');
      queries.push('Construction Engineer');
    }
    if (t.includes('electrical')) {
      queries.push('Electronics Engineer');
      queries.push('Hardware Engineer');
      queries.push('Power Systems Engineer');
      queries.push('Controls Engineer');
    }
    if (t.includes('manufacturing')) {
      queries.push('Process Engineer');
      queries.push('Production Engineer');
      queries.push('Industrial Engineer');
    }
    if (t.includes('process')) {
      queries.push('Manufacturing Engineer');
      queries.push('Industrial Engineer');
      queries.push('Production Engineer');
    }

    // Add with top skills
    profile.resume.skills.technical.slice(0, 3).forEach(skill => {
      queries.push(`${skill} ${title}`);
      queries.push(`${title} ${skill}`);
    });
  });

  // Add skill-based queries
  profile.resume.skills.technical.slice(0, 5).forEach(skill => {
    queries.push(`${skill} Developer`);
    queries.push(`${skill} Engineer`);
  });

  // Remove duplicates and limit
  return [...new Set(queries)].slice(0, 15);
}

function calculateBasicMatch(
  job: Partial<EnhancedJobListing>,
  profile: UserProfile
): JobMatchCriteria {
  // SIMPLIFIED: Since we already filtered strictly, all jobs here should pass
  // Just give them simple scoring based on basic text matching
  const jobText = `${job.title} ${job.description}`.toLowerCase();
  const jobState = extractStateFromLocation(job.location || '');
  const userStates = profile.preferences.locations.map(loc => extractStateFromLocation(loc));

  // === VISA MATCH (assume passing since filtered) ===
  let visaMatch = 100;
  if (profile.requirements.requiresSponsorship) {
    // Jobs that made it through filtering should be OK
    visaMatch = job.visaSponsorship === true ? 100 : 80; // Unknown = 80
  }

  // === LOCATION MATCH (assume passing since filtered) ===
  let locationMatch = 100;
  if (job.remoteType === 'remote') {
    locationMatch = 95; // Slightly prefer exact location
  } else if (userStates.some(state => state && jobState.toUpperCase().includes(state.toUpperCase()))) {
    locationMatch = 100;
  }

  // === ROLE MATCH (simple text matching) ===
  const targetRoles = profile.preferences.jobTitles.map(r => r.toLowerCase());
  let roleMatch = 85; // Default - assume good match since filtered

  // Boost if exact title match
  if (targetRoles.some(role => jobText.includes(role))) {
    roleMatch = 100;
  }

  // === SKILLS MATCH (simple keyword matching) ===
  const matchingSkills = profile.resume.skills.technical.filter(skill =>
    jobText.includes(skill.toLowerCase())
  ).length;
  const skillsMatch = Math.min(100, (matchingSkills / Math.max(profile.resume.skills.technical.length, 1)) * 100 + 40);

  // === SALARY MATCH ===
  let salaryMatch = 75; // Default neutral
  if (job.salary) {
    const userMin = profile.requirements.salaryRange.min;
    const jobMax = job.salary.max;

    if (jobMax >= userMin) {
      salaryMatch = 90;
    }
  }

  // === SIMPLE OVERALL SCORE ===
  // All jobs passed filtering, so score should be 70-100
  const overallScore = Math.round(
    (visaMatch * 0.2) +
    (locationMatch * 0.2) +
    (roleMatch * 0.35) +
    (skillsMatch * 0.15) +
    (salaryMatch * 0.10)
  );

  // Generate simple match reasons
  const matchReasons = [
    'Meets all search requirements',
    locationMatch >= 95 ? (job.remoteType === 'remote' ? 'Remote position' : 'Location match') : '',
    roleMatch >= 95 ? 'Strong role match' : 'Related role',
  ].filter(Boolean);

  return {
    overallScore,
    breakdown: {
      visaMatch,
      locationMatch,
      roleMatch,
      skillsMatch: Math.round(skillsMatch),
      experienceMatch: 75, // Default
      salaryMatch,
      cultureFit: 70, // Default
    },
    matchReasons,
    concerns: [],
    recommendation: overallScore >= 85 ? 'highly-recommended' :
                   overallScore >= 70 ? 'good-fit' : 'possible-fit',
  };
}
