import { Grade } from "@/src/types/resume";

/**
 * Piecewise mapping for score to percentile conversion
 * Based on statistical distribution of resume scores
 */
interface PercentileMapping {
  score: number;
  percentile: number;
}

/**
 * Piecewise percentile mapping based on resume analysis data
 * This mapping reflects the distribution of resume scores in our database
 */
const PERCENTILE_MAPPING: PercentileMapping[] = [
  { score: 0, percentile: 0 },
  { score: 20, percentile: 5 },
  { score: 30, percentile: 10 },
  { score: 40, percentile: 20 },
  { score: 50, percentile: 35 },
  { score: 60, percentile: 50 },
  { score: 65, percentile: 60 },
  { score: 70, percentile: 70 },
  { score: 75, percentile: 80 },
  { score: 80, percentile: 85 },
  { score: 85, percentile: 90 },
  { score: 90, percentile: 95 },
  { score: 95, percentile: 98 },
  { score: 100, percentile: 99 },
];

/**
 * Grade boundaries based on percentile ranges
 */
const GRADE_MAPPING: { min: number; max: number; grade: Grade }[] = [
  { min: 97, max: 100, grade: "A+" },
  { min: 93, max: 96, grade: "A" },
  { min: 90, max: 92, grade: "A-" },
  { min: 87, max: 89, grade: "B+" },
  { min: 83, max: 86, grade: "B" },
  { min: 80, max: 82, grade: "B-" },
  { min: 77, max: 79, grade: "C+" },
  { min: 73, max: 76, grade: "C" },
  { min: 70, max: 72, grade: "C-" },
  { min: 60, max: 69, grade: "D" },
  { min: 0, max: 59, grade: "F" },
];

/**
 * Linear interpolation between two points
 */
function linearInterpolate(
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  if (x1 === x2) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

/**
 * Convert a score (0-100) to percentile using piecewise linear interpolation
 * @param score - The resume score (0-100)
 * @returns The percentile (0-100)
 */
export function scoreToPercentile(score: number): number {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));

  // Find the appropriate segment in the mapping
  for (let i = 0; i < PERCENTILE_MAPPING.length - 1; i++) {
    const current = PERCENTILE_MAPPING[i];
    const next = PERCENTILE_MAPPING[i + 1];

    if (clampedScore >= current.score && clampedScore <= next.score) {
      return Math.round(
        linearInterpolate(
          clampedScore,
          current.score,
          current.percentile,
          next.score,
          next.percentile
        )
      );
    }
  }

  // If score is exactly 100 or above
  return PERCENTILE_MAPPING[PERCENTILE_MAPPING.length - 1].percentile;
}

/**
 * Convert a percentile to letter grade
 * @param percentile - The percentile (0-100)
 * @returns The letter grade
 */
export function percentileToGrade(percentile: number): Grade {
  const clampedPercentile = Math.max(0, Math.min(100, percentile));

  for (const mapping of GRADE_MAPPING) {
    if (clampedPercentile >= mapping.min && clampedPercentile <= mapping.max) {
      return mapping.grade;
    }
  }

  return "F"; // Fallback
}

/**
 * Convert a score directly to letter grade
 * @param score - The resume score (0-100)
 * @returns The letter grade
 */
export function scoreToGrade(score: number): Grade {
  const percentile = scoreToPercentile(score);
  return percentileToGrade(percentile);
}

/**
 * Get percentile rank description
 * @param percentile - The percentile (0-100)
 * @returns Human-readable description
 */
export function getPercentileDescription(percentile: number): string {
  if (percentile >= 95) {
    return "Exceptional - Top 5% of resumes";
  } else if (percentile >= 90) {
    return "Excellent - Top 10% of resumes";
  } else if (percentile >= 80) {
    return "Very Good - Top 20% of resumes";
  } else if (percentile >= 70) {
    return "Good - Top 30% of resumes";
  } else if (percentile >= 50) {
    return "Average - Better than half of resumes";
  } else if (percentile >= 30) {
    return "Below Average - Needs improvement";
  } else if (percentile >= 10) {
    return "Poor - Significant improvements needed";
  } else {
    return "Very Poor - Major overhaul required";
  }
}

/**
 * Get grade color for UI display
 * @param grade - The letter grade
 * @returns Tailwind CSS color class
 */
export function getGradeColor(grade: Grade): string {
  switch (grade) {
    case "A+":
    case "A":
      return "text-green-600";
    case "A-":
    case "B+":
      return "text-green-500";
    case "B":
    case "B-":
      return "text-yellow-500";
    case "C+":
    case "C":
      return "text-orange-500";
    case "C-":
    case "D":
      return "text-red-500";
    case "F":
      return "text-red-600";
    default:
      return "text-gray-500";
  }
}

/**
 * Get score color for UI display
 * @param score - The score (0-100)
 * @returns Tailwind CSS color class
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 80) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  if (score >= 60) return "text-orange-500";
  if (score >= 50) return "text-red-500";
  return "text-red-600";
}

/**
 * Calculate improvement potential
 * @param currentScore - Current resume score
 * @param targetPercentile - Target percentile (default: 90th percentile)
 * @returns Object with improvement metrics
 */
export function calculateImprovementPotential(
  currentScore: number,
  targetPercentile: number = 90
): {
  currentPercentile: number;
  targetScore: number;
  improvementNeeded: number;
  improvementPercentage: number;
  difficulty: "easy" | "moderate" | "challenging" | "difficult";
} {
  const currentPercentile = scoreToPercentile(currentScore);
  
  // Find target score for desired percentile
  let targetScore = 100;
  for (let i = 0; i < PERCENTILE_MAPPING.length - 1; i++) {
    const current = PERCENTILE_MAPPING[i];
    const next = PERCENTILE_MAPPING[i + 1];
    
    if (targetPercentile >= current.percentile && targetPercentile <= next.percentile) {
      targetScore = Math.round(
        linearInterpolate(
          targetPercentile,
          current.percentile,
          current.score,
          next.percentile,
          next.score
        )
      );
      break;
    }
  }

  const improvementNeeded = Math.max(0, targetScore - currentScore);
  const improvementPercentage = currentScore > 0 ? (improvementNeeded / currentScore) * 100 : 0;

  let difficulty: "easy" | "moderate" | "challenging" | "difficult";
  if (improvementNeeded <= 5) difficulty = "easy";
  else if (improvementNeeded <= 15) difficulty = "moderate";
  else if (improvementNeeded <= 30) difficulty = "challenging";
  else difficulty = "difficult";

  return {
    currentPercentile,
    targetScore,
    improvementNeeded,
    improvementPercentage,
    difficulty,
  };
}

/**
 * Get benchmark scores for different industries
 * @param industry - Industry name
 * @returns Benchmark scores object
 */
export function getIndustryBenchmarks(industry: string): {
  average: number;
  good: number;
  excellent: number;
} {
  // Industry-specific benchmarks based on our data
  const benchmarks: Record<string, { average: number; good: number; excellent: number }> = {
    technology: { average: 72, good: 82, excellent: 92 },
    finance: { average: 75, good: 85, excellent: 94 },
    healthcare: { average: 70, good: 80, excellent: 90 },
    marketing: { average: 68, good: 78, excellent: 88 },
    sales: { average: 65, good: 75, excellent: 85 },
    education: { average: 67, good: 77, excellent: 87 },
    consulting: { average: 78, good: 88, excellent: 95 },
    engineering: { average: 74, good: 84, excellent: 93 },
    design: { average: 69, good: 79, excellent: 89 },
    default: { average: 70, good: 80, excellent: 90 },
  };

  return benchmarks[industry.toLowerCase()] || benchmarks.default;
}
