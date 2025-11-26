/**
 * Greenhouse API client for direct application submission
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { UserProfile, ApplicationResult } from '../models/types.js';
import { logger } from '../utils/logger.js';

export class GreenhouseAPI {
  /**
   * Attempt to submit application via Greenhouse API
   * This uses the public job board API endpoint
   */
  async submitApplication(
    company: string,
    jobId: string,
    profile: UserProfile
  ): Promise<ApplicationResult> {
    try {
      logger.info(`Attempting API submission for job ${jobId} at ${company}`);

      // Build application URL
      const applicationUrl = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`;

      // First, fetch the job details to get application form structure
      const jobResponse = await fetch(applicationUrl);

      if (!jobResponse.ok) {
        throw new Error(`Failed to fetch job details: ${jobResponse.status}`);
      }

      const jobData = (await jobResponse.json()) as { application_url?: string | null };

      // Check if job has an application form
      if (!jobData.application_url) {
        throw new Error('Job does not have a public application form');
      }

      // Try to submit via API (this often requires multipart/form-data)
      const submitUrl = jobData.application_url;

      logger.debug(`Submit URL: ${submitUrl}`);

      // Build form data
      const formData = new FormData();
      formData.append('email', profile.email);
      formData.append('first_name', profile.firstName);
      formData.append('last_name', profile.lastName);
      formData.append('phone', profile.phone);

      // Add location fields
      if (profile.location.city) formData.append('location', profile.location.city);

      // Add optional fields
      if (profile.linkedin) formData.append('linkedin_url', profile.linkedin);
      if (profile.github) formData.append('github_url', profile.github);
      if (profile.portfolio) formData.append('website', profile.portfolio);

      // Add resume if available
      if (profile.resume.path) {
        try {
          const resumePath = resolve(process.cwd(), 'config', profile.resume.path);
          const resumeBuffer = readFileSync(resumePath);
          const resumeBlob = new Blob([resumeBuffer], { type: 'application/pdf' });
          formData.append('resume', resumeBlob, 'resume.pdf');
          logger.debug('Resume attached');
        } catch (error) {
          logger.warn('Could not attach resume:', error);
        }
      }

      // Submit application
      const submitResponse = await fetch(submitUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      });

      if (submitResponse.ok) {
        logger.success('Application submitted successfully via API');

        return {
          jobId,
          jobUrl: `https://boards.greenhouse.io/${company}/jobs/${jobId}`,
          status: 'success',
          method: 'api',
          message: 'Application submitted successfully via API',
          timestamp: new Date().toISOString(),
        };
      } else {
        const errorText = await submitResponse.text();
        throw new Error(`API submission failed: ${submitResponse.status} - ${errorText}`);
      }
    } catch (error: any) {
      logger.warn(`API submission failed: ${error.message}`);

      return {
        jobId,
        jobUrl: `https://boards.greenhouse.io/${company}/jobs/${jobId}`,
        status: 'failed',
        method: 'api',
        message: `API submission failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        errors: [error.message],
      };
    }
  }

  /**
   * Check if API submission is likely to work for this job
   */
  async canUseAPI(company: string, jobId: string): Promise<boolean> {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`;
      const response = await fetch(url);

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { application_url?: string | null };
      return Boolean(data.application_url);
    } catch {
      return false;
    }
  }
}
