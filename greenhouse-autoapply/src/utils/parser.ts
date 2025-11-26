/**
 * Utility to parse Greenhouse job URLs
 */

export interface ParsedJobUrl {
  company: string;
  jobId: string;
  fullUrl: string;
  boardUrl: string;
}

export function parseGreenhouseUrl(url: string): ParsedJobUrl | null {
  // Match patterns like:
  // https://boards.greenhouse.io/company/jobs/123456
  // https://job-boards.greenhouse.io/company/jobs/123456
  // https://company.greenhouse.io/jobs/123456

  const patterns = [
    /https?:\/\/boards\.greenhouse\.io\/([^\/]+)\/jobs\/(\d+)/,
    /https?:\/\/job-boards\.greenhouse\.io\/([^\/]+)\/jobs\/(\d+)/,
    /https?:\/\/([^.]+)\.greenhouse\.io\/jobs\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const company = match[1];
      const jobId = match[2];
      return {
        company,
        jobId,
        fullUrl: url,
        boardUrl: `https://boards.greenhouse.io/${company}`,
      };
    }
  }

  return null;
}

export function buildApplicationUrl(company: string, jobId: string): string {
  return `https://boards.greenhouse.io/${company}/jobs/${jobId}`;
}
