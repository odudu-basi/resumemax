/**
 * TypeScript client for the Browser Automation Service
 *
 * This module provides helper functions to interact with the queue-based
 * Python browser automation service from Next.js API routes
 */

interface JobSubmitRequest {
  user_id: string;
  job_url: string;
  user_profile: Record<string, any>;
  resume_data: Record<string, any>;
  session_id: string;
  additional_params?: Record<string, any>;
}

interface JobSubmitResponse {
  job_id: string;
  status: string;
  message: string;
  queue_position?: number;
}

interface JobStatusResponse {
  job_id: string;
  status: 'queued' | 'started' | 'finished' | 'failed';
  result?: Record<string, any>;
  error?: string;
  created_at?: string;
  started_at?: string;
  ended_at?: string;
}

/**
 * Configuration for the browser service client
 */
export class BrowserServiceClient {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config?: {
    baseUrl?: string;
    apiKey?: string;
    maxRetries?: number;
    retryDelay?: number;
  }) {
    this.baseUrl = config?.baseUrl || process.env.BROWSER_SERVICE_URL || 'http://localhost:8000';
    this.apiKey = config?.apiKey || process.env.BROWSER_SERVICE_API_KEY || '';
    this.maxRetries = config?.maxRetries || 3;
    this.retryDelay = config?.retryDelay || 1000; // 1 second
  }

  /**
   * Submit a browser automation job to the queue
   */
  async submitJob(request: JobSubmitRequest): Promise<JobSubmitResponse> {
    const url = `${this.baseUrl}/jobs/submit`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error: any) {
        lastError = error;
        console.warn(
          `[BrowserService] Job submission attempt ${attempt + 1}/${this.maxRetries} failed:`,
          error.message
        );

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to submit job after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Get the status of a job
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const url = `${this.baseUrl}/jobs/${jobId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(`Failed to get job status: ${error.message}`);
    }
  }

  /**
   * Poll for job completion
   *
   * @param jobId - The job ID to poll
   * @param pollInterval - Interval between polls in milliseconds (default: 2000)
   * @param maxWaitTime - Maximum time to wait in milliseconds (default: 300000 = 5 minutes)
   * @returns JobStatusResponse when job is finished or failed
   */
  async waitForJobCompletion(
    jobId: string,
    pollInterval: number = 2000,
    maxWaitTime: number = 300000
  ): Promise<JobStatusResponse> {
    const startTime = Date.now();

    while (true) {
      const status = await this.getJobStatus(jobId);

      // Job is complete
      if (status.status === 'finished' || status.status === 'failed') {
        return status;
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`Job ${jobId} did not complete within ${maxWaitTime}ms`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Cancel a queued job
   */
  async cancelJob(jobId: string): Promise<{ message: string; job_id: string }> {
    const url = `${this.baseUrl}/jobs/${jobId}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(`Failed to cancel job: ${error.message}`);
    }
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const url = `${this.baseUrl}/health`;

    try {
      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Health check failed: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const browserServiceClient = new BrowserServiceClient();
