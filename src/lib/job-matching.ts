import OpenAI from 'openai';
import { getConfig } from './env';

const config = getConfig();
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

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
  matchReasons?: string[];
}

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    dates: string;
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    dates: string;
  }[];
  certifications: string[];
}

/**
 * Calculate detailed match scores between resume and job listings
 * Uses AI to analyze semantic fit beyond simple keyword matching
 */
export async function calculateEnhancedMatchScores(
  jobs: JobListing[],
  resume: ParsedResume,
  searchKeywords: string
): Promise<JobListing[]> {
  if (!resume || jobs.length === 0) {
    return jobs;
  }

  try {
    console.log('Calculating enhanced match scores with AI...');

    // Build a comprehensive profile from the resume
    const userProfile = {
      skills: resume.skills,
      recentExperience: resume.experience.slice(0, 3).map(exp => ({
        title: exp.title,
        company: exp.company,
        description: exp.description
      })),
      education: resume.education.map(edu => `${edu.degree} from ${edu.institution}`),
      certifications: resume.certifications,
      totalYearsExperience: estimateYearsOfExperience(resume.experience)
    };

    const prompt = `You are an expert job matching system. Analyze how well each job matches the candidate's profile.

CANDIDATE PROFILE:
- Skills: ${userProfile.skills.join(', ')}
- Years of Experience: ~${userProfile.totalYearsExperience} years
- Recent Roles: ${userProfile.recentExperience.map(exp => exp.title).join(', ')}
- Education: ${userProfile.education.join(', ')}
- Certifications: ${userProfile.certifications.join(', ')}
- Looking for: ${searchKeywords}

JOB LISTINGS TO EVALUATE:
${jobs.map((job, i) => `
${i + 1}. ${job.title} at ${job.company}
   Location: ${job.location || 'Not specified'}
   Description: ${job.description.slice(0, 200)}...
   Source: ${job.source}
`).join('\n')}

For each job, provide:
1. A match score from 0-100 based on:
   - Skills alignment (40% weight)
   - Experience level fit (30% weight)
   - Role similarity (20% weight)
   - Industry/domain fit (10% weight)
2. Top 3 specific reasons why this job matches or doesn't match

Return ONLY a JSON array with this structure:
[
  {
    "matchScore": 85,
    "matchReasons": ["Strong match for React skills", "Similar role to past experience", "Company values align with background"]
  }
]

The array must have exactly ${jobs.length} objects in the same order as the job listings.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent scoring
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const matchData = JSON.parse(cleanedResponse);

      // Merge match data with jobs
      return jobs.map((job, i) => ({
        ...job,
        matchScore: matchData[i]?.matchScore || 0,
        matchReasons: matchData[i]?.matchReasons || [],
      })).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)); // Sort by match score
    }
  } catch (error) {
    console.error('Error calculating enhanced match scores:', error);
    // Fallback to simple keyword matching
    return calculateSimpleMatchScores(jobs, resume.skills, searchKeywords);
  }

  return jobs;
}

/**
 * Fallback matching using simple keyword comparison
 */
function calculateSimpleMatchScores(
  jobs: JobListing[],
  skills: string[],
  searchKeywords: string
): JobListing[] {
  const skillsLower = skills.map(s => s.toLowerCase());
  const keywordsLower = searchKeywords.toLowerCase().split(' ');

  return jobs.map(job => {
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    let score = 0;

    // Check skills match
    const matchingSkills = skillsLower.filter(skill => jobText.includes(skill));
    score += (matchingSkills.length / Math.max(skillsLower.length, 1)) * 60; // 60% weight for skills

    // Check keywords match
    const matchingKeywords = keywordsLower.filter(keyword => jobText.includes(keyword));
    score += (matchingKeywords.length / Math.max(keywordsLower.length, 1)) * 40; // 40% weight for keywords

    const matchReasons = [];
    if (matchingSkills.length > 0) {
      matchReasons.push(`Matches ${matchingSkills.length} of your skills: ${matchingSkills.slice(0, 3).join(', ')}`);
    }
    if (matchingKeywords.length > 0) {
      matchReasons.push(`Relevant to search: ${searchKeywords}`);
    }

    return {
      ...job,
      matchScore: Math.min(Math.round(score), 100),
      matchReasons: matchReasons.length > 0 ? matchReasons : ['General match based on search criteria']
    };
  }).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}

/**
 * Estimate total years of experience from work history
 */
function estimateYearsOfExperience(experience: ParsedResume['experience']): number {
  if (!experience || experience.length === 0) return 0;

  let totalMonths = 0;

  for (const exp of experience) {
    try {
      const dates = exp.dates.toLowerCase();

      // Handle "present" or "current"
      const endDate = dates.includes('present') || dates.includes('current')
        ? new Date()
        : parseDateString(dates.split('-')[1]?.trim() || '');

      const startDate = parseDateString(dates.split('-')[0]?.trim() || '');

      if (startDate && endDate) {
        const months = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        totalMonths += Math.max(0, months);
      }
    } catch (error) {
      // If parsing fails, assume 1 year per role
      totalMonths += 12;
    }
  }

  return Math.round(totalMonths / 12);
}

/**
 * Parse various date string formats
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Try common formats
    const formats = [
      /(\w+)\s+(\d{4})/i, // "January 2020" or "Jan 2020"
      /(\d{1,2})\/(\d{4})/i, // "01/2020"
      /(\d{4})/i, // "2020"
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (match.length === 3) {
          // Month and year
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthStr = match[1].toLowerCase().slice(0, 3);
          const monthIndex = monthNames.indexOf(monthStr);
          const year = parseInt(match[2]);
          return new Date(year, monthIndex >= 0 ? monthIndex : 0, 1);
        } else if (match.length === 2) {
          // Year only
          return new Date(parseInt(match[1]), 0, 1);
        }
      }
    }

    // Fallback to Date constructor
    return new Date(dateStr);
  } catch {
    return null;
  }
}

/**
 * Filter jobs based on additional criteria
 */
export function filterJobs(
  jobs: JobListing[],
  filters: {
    minMatchScore?: number;
    locations?: string[];
    companies?: string[];
    sources?: string[];
    hasSalary?: boolean;
    postedWithinDays?: number;
  }
): JobListing[] {
  let filtered = [...jobs];

  if (filters.minMatchScore !== undefined) {
    filtered = filtered.filter(job => (job.matchScore || 0) >= filters.minMatchScore!);
  }

  if (filters.locations && filters.locations.length > 0) {
    filtered = filtered.filter(job =>
      filters.locations!.some(loc =>
        job.location?.toLowerCase().includes(loc.toLowerCase())
      )
    );
  }

  if (filters.companies && filters.companies.length > 0) {
    filtered = filtered.filter(job =>
      filters.companies!.some(comp =>
        job.company.toLowerCase().includes(comp.toLowerCase())
      )
    );
  }

  if (filters.sources && filters.sources.length > 0) {
    filtered = filtered.filter(job =>
      filters.sources!.includes(job.source)
    );
  }

  if (filters.hasSalary) {
    filtered = filtered.filter(job => !!job.salary);
  }

  if (filters.postedWithinDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.postedWithinDays);

    filtered = filtered.filter(job => {
      if (!job.postedDate) return false;

      try {
        const postedDate = parseDateString(job.postedDate);
        return postedDate && postedDate >= cutoffDate;
      } catch {
        return false;
      }
    });
  }

  return filtered;
}

/**
 * Sort jobs by various criteria
 */
export function sortJobs(
  jobs: JobListing[],
  sortBy: 'matchScore' | 'date' | 'company' | 'title' = 'matchScore',
  order: 'asc' | 'desc' = 'desc'
): JobListing[] {
  const sorted = [...jobs];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'matchScore':
        comparison = (a.matchScore || 0) - (b.matchScore || 0);
        break;
      case 'company':
        comparison = a.company.localeCompare(b.company);
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'date':
        const dateA = a.postedDate ? parseDateString(a.postedDate) : new Date(0);
        const dateB = b.postedDate ? parseDateString(b.postedDate) : new Date(0);
        comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
        break;
    }

    return order === 'desc' ? -comparison : comparison;
  });

  return sorted;
}
