import { z } from "zod";

// Base profile information
export const ProfileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().url().optional(),
  github: z.string().url().optional(),
  website: z.string().url().optional(),
  summary: z.string().optional(),
});

// Experience entry
export const ExperienceSchema = z.object({
  company: z.string(),
  position: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  description: z.array(z.string()),
  achievements: z.array(z.string()).optional(),
});

// Education entry
export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
  honors: z.array(z.string()).optional(),
});

// Skills section
export const SkillsSchema = z.object({
  technical: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  frameworks: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  soft: z.array(z.string()).optional(),
});

// Project entry
export const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
  url: z.string().url().optional(),
  github: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Certification entry
export const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
  url: z.string().url().optional(),
});

// Complete resume structure
export const ResumeSchema = z.object({
  profile: ProfileSchema,
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: SkillsSchema,
  projects: z.array(ProjectSchema).optional(),
  certifications: z.array(CertificationSchema).optional(),
  rawText: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  uploadedAt: z.date(),
});

// Scoring system
export const SectionScoreSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  status: z.enum(["excellent", "good", "warning", "error"]),
  feedback: z.string(),
  suggestions: z.array(z.string()),
  weight: z.number().min(0).max(1),
});

export const OverallScoreSchema = z.object({
  total: z.number().min(0).max(100),
  percentile: z.number().min(0).max(100),
  grade: z.enum(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"]),
  sections: z.array(SectionScoreSchema),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  criticalIssues: z.array(z.string()),
});

// Keyword analysis
export const KeywordAnalysisSchema = z.object({
  found: z.array(z.string()),
  missing: z.array(z.string()),
  suggestions: z.array(z.string()),
  density: z.number().min(0).max(100),
  relevanceScore: z.number().min(0).max(100),
});

// ATS compatibility
export const ATSCompatibilitySchema = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(z.object({
    type: z.enum(["formatting", "structure", "content", "technical"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    description: z.string(),
    suggestion: z.string(),
  })),
  passRate: z.number().min(0).max(100),
});

// Industry-specific analysis
export const IndustryAnalysisSchema = z.object({
  industry: z.string(),
  relevanceScore: z.number().min(0).max(100),
  missingSkills: z.array(z.string()),
  recommendedSections: z.array(z.string()),
  industryKeywords: z.array(z.string()),
});

// Complete analysis result
export const ResumeAnalysisSchema = z.object({
  id: z.string(),
  resume: ResumeSchema,
  overallScore: OverallScoreSchema,
  keywordAnalysis: KeywordAnalysisSchema,
  atsCompatibility: ATSCompatibilitySchema,
  industryAnalysis: IndustryAnalysisSchema.optional(),
  analyzedAt: z.date(),
  processingTime: z.number(), // in milliseconds
  version: z.string().default("1.0"),
});

// Tailored sections for different job applications
export const TailoredSectionSchema = z.object({
  jobTitle: z.string(),
  company: z.string(),
  jobDescription: z.string(),
  tailoredSummary: z.string(),
  prioritizedSkills: z.array(z.string()),
  relevantExperience: z.array(z.string()), // IDs of most relevant experience entries
  suggestedKeywords: z.array(z.string()),
  customizations: z.array(z.object({
    section: z.string(),
    original: z.string(),
    tailored: z.string(),
    reason: z.string(),
  })),
  matchScore: z.number().min(0).max(100),
});

export const TailoredResumeSchema = z.object({
  baseResumeId: z.string(),
  tailoredSections: z.array(TailoredSectionSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// User subscription and usage tracking
export const UserUsageSchema = z.object({
  userId: z.string(),
  plan: z.enum(["free", "pro", "enterprise"]),
  analysesUsed: z.number(),
  analysesLimit: z.number(),
  resetDate: z.date(),
  features: z.array(z.string()),
});

// Export types
export type Profile = z.infer<typeof ProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skills = z.infer<typeof SkillsSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type SectionScore = z.infer<typeof SectionScoreSchema>;
export type OverallScore = z.infer<typeof OverallScoreSchema>;
export type KeywordAnalysis = z.infer<typeof KeywordAnalysisSchema>;
export type ATSCompatibility = z.infer<typeof ATSCompatibilitySchema>;
export type IndustryAnalysis = z.infer<typeof IndustryAnalysisSchema>;
export type ResumeAnalysis = z.infer<typeof ResumeAnalysisSchema>;
export type TailoredSection = z.infer<typeof TailoredSectionSchema>;
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;
export type UserUsage = z.infer<typeof UserUsageSchema>;

// Utility types
export type ScoreStatus = "excellent" | "good" | "warning" | "error";
export type Grade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";
export type Plan = "free" | "pro" | "enterprise";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type IssueType = "formatting" | "structure" | "content" | "technical";

// Constants
export const SECTION_WEIGHTS = {
  content: 0.3,
  formatting: 0.2,
  keywords: 0.25,
  ats: 0.15,
  structure: 0.1,
} as const;

export const PLAN_LIMITS = {
  free: {
    analysesPerMonth: 1,
    features: ["basic-analysis", "ats-check"],
  },
  pro: {
    analysesPerMonth: -1, // unlimited
    features: ["advanced-analysis", "keyword-optimization", "industry-specific", "tailored-sections"],
  },
  enterprise: {
    analysesPerMonth: -1, // unlimited
    features: ["all-features", "api-access", "team-management", "custom-branding"],
  },
} as const;
