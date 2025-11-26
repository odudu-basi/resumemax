import { z } from 'zod';

/**
 * Comprehensive user profile for AI-powered job matching
 * Includes resume data + preferences + requirements
 */

export const UserProfileSchema = z.object({
  // === Resume Data (parsed from uploaded resume) ===
  resume: z.object({
    personalInfo: z.object({
      name: z.string(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional().or(z.literal('')),
      location: z.string().optional(),
      linkedIn: z.string().optional(),
      portfolio: z.string().optional(),
    }),

    experience: z.array(z.object({
      title: z.string(),
      company: z.string(),
      startDate: z.string(),
      endDate: z.string().optional(), // undefined if current
      location: z.string().optional(),
      description: z.string(),
      achievements: z.array(z.string()).optional(),
    })),

    education: z.array(z.object({
      degree: z.string(),
      institution: z.string(),
      field: z.string().optional(),
      graduationDate: z.string(),
      gpa: z.string().optional(),
    })),

    skills: z.object({
      technical: z.array(z.string()),
      languages: z.array(z.string()).optional(),
      frameworks: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
      soft: z.array(z.string()).optional(),
    }),

    certifications: z.array(z.object({
      name: z.string(),
      issuer: z.string(),
      date: z.string(),
      url: z.string().optional(),
    })).optional(),

    projects: z.array(z.object({
      name: z.string(),
      description: z.string(),
      technologies: z.array(z.string()),
      url: z.string().optional(),
    })).optional(),
  }),

  // === Job Search Preferences ===
  preferences: z.object({
    // Job Details
    jobTitles: z.array(z.string()).min(1), // e.g., ["Software Engineer", "Full Stack Developer"]
    seniorityLevel: z.enum(['entry', 'junior', 'mid', 'senior', 'staff', 'principal', 'lead', 'manager', 'director', 'vp', 'executive']),
    jobTypes: z.array(z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance'])).default(['full-time']),

    // Location Preferences
    locations: z.array(z.string()), // e.g., ["San Francisco, CA", "New York, NY", "Remote"]
    remotePreference: z.enum(['remote-only', 'hybrid', 'onsite', 'flexible']),
    willingToRelocate: z.boolean().default(false),

    // Company Preferences
    companySize: z.array(z.enum(['startup', 'small', 'medium', 'large', 'enterprise'])).optional(),
    industries: z.array(z.string()).optional(), // e.g., ["fintech", "healthcare", "e-commerce"]
    companyStage: z.array(z.enum(['seed', 'series-a', 'series-b', 'series-c', 'series-d+', 'public'])).optional(),

    // Work Culture
    workEnvironment: z.array(z.string()).optional(), // e.g., ["fast-paced", "collaborative", "innovative"]
    benefits: z.array(z.string()).optional(), // e.g., ["health insurance", "401k", "equity"]
  }),

  // === Requirements & Deal Breakers ===
  requirements: z.object({
    // Compensation
    salaryRange: z.object({
      min: z.number(), // Annual salary minimum
      max: z.number(), // Annual salary maximum
      currency: z.string().default('USD'),
      period: z.enum(['annually', 'hourly']).default('annually'),
    }),
    equityPreference: z.enum(['required', 'preferred', 'not-important', 'no']).optional(),

    // Legal/Visa
    visaStatus: z.enum([
      'us-citizen',
      'green-card',
      'h1b',
      'h1b-transfer',
      'opt',
      'cpt',
      'l1',
      'tn',
      'requires-sponsorship',
      'no-sponsorship-needed',
      'other'
    ]),
    requiresSponsorship: z.boolean(),

    // Availability
    availableStartDate: z.string(), // ISO date or "immediate"
    noticePeriod: z.string().optional(), // e.g., "2 weeks", "1 month"

    // Work Authorization
    authorizedToWork: z.boolean().default(true),
    securityClearance: z.enum(['none', 'confidential', 'secret', 'top-secret']).optional(),
  }),

  // === Additional Context (AI will use this) ===
  additionalInfo: z.object({
    careerGoals: z.string().optional(), // e.g., "Transition to management in 2 years"
    dealBreakers: z.array(z.string()).optional(), // e.g., ["No on-call", "No travel"]
    mustHaves: z.array(z.string()).optional(), // e.g., ["Team of 5+", "Mentorship program"]
    interests: z.array(z.string()).optional(), // e.g., ["AI/ML", "blockchain", "climate tech"]
    whyChangingJobs: z.string().optional(), // Context for AI
  }).optional(),

  // === Search Settings ===
  searchSettings: z.object({
    maxResults: z.number().default(50),
    includeRecentlyViewed: z.boolean().default(false),
    alertFrequency: z.enum(['realtime', 'daily', 'weekly', 'never']).default('never'),
    autoApply: z.boolean().default(false), // Future feature
  }).optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Simplified version for quick searches
 */
export const QuickSearchSchema = z.object({
  keywords: z.string(),
  location: z.string().optional(),
  salaryMin: z.number().optional(),
  remoteOnly: z.boolean().optional(),
  visaStatus: z.string().optional(),
});

export type QuickSearch = z.infer<typeof QuickSearchSchema>;

/**
 * Match criteria for displaying how well a job fits
 */
export interface JobMatchCriteria {
  overallScore: number; // 0-100
  breakdown: {
    skillsMatch: number; // 0-100
    experienceMatch: number; // 0-100
    salaryMatch: number; // 0-100
    locationMatch: number; // 0-100
    visaMatch: number; // 0-100
    roleMatch: number; // 0-100
    cultureFit: number; // 0-100
  };
  matchReasons: string[]; // Why this is a good match
  concerns: string[]; // Potential issues
  recommendation: 'highly-recommended' | 'good-fit' | 'possible-fit' | 'not-recommended';
}

/**
 * Enhanced job listing with match data
 */
export interface EnhancedJobListing {
  // Job Details
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  applicationUrl: string; // Direct link to apply

  // Job Info
  description: string;
  requirements: string[];
  responsibilities: string[];
  qualifications: string[];

  // Location & Remote
  location: string;
  remoteType: 'remote' | 'hybrid' | 'onsite';

  // Compensation
  salary?: {
    min: number;
    max: number;
    currency: string;
    equity?: string;
  };

  // Company Info
  companyInfo: {
    size?: string;
    industry?: string;
    stage?: string;
    description?: string;
    website?: string;
    benefits?: string[];
  };

  // Legal
  visaSponsorship: boolean;

  // Metadata
  postedDate: string;
  source: string; // 'Greenhouse', 'Lever', 'Direct', etc.
  atsId?: string; // ID in the ATS system

  // Match Data
  matchCriteria: JobMatchCriteria;
}
