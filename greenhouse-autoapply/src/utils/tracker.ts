/**
 * Application tracker to prevent duplicate submissions
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { ApplicationRecord, ApplicationResult } from '../models/types.js';
import { logger } from './logger.js';

export class ApplicationTracker {
  private trackerPath: string;
  private applications: ApplicationRecord[];

  constructor(trackerPath = './config/applications.json') {
    this.trackerPath = resolve(process.cwd(), trackerPath);
    this.applications = this.load();
  }

  /**
   * Load application history
   */
  private load(): ApplicationRecord[] {
    try {
      if (existsSync(this.trackerPath)) {
        const data = readFileSync(this.trackerPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn('Could not load application tracker:', error);
    }

    return [];
  }

  /**
   * Save application history
   */
  private save() {
    try {
      writeFileSync(this.trackerPath, JSON.stringify(this.applications, null, 2));
    } catch (error) {
      logger.error('Could not save application tracker:', error);
    }
  }

  /**
   * Check if already applied to this job with this email
   */
  hasApplied(email: string, jobId: string, jobUrl: string): boolean {
    return this.applications.some(
      (app) =>
        app.email === email &&
        (app.jobId === jobId || app.jobUrl === jobUrl)
    );
  }

  /**
   * Record a new application
   */
  recordApplication(result: ApplicationResult, email: string) {
    const record: ApplicationRecord = {
      email,
      jobId: result.jobId,
      jobUrl: result.jobUrl,
      appliedAt: result.timestamp,
      status: result.status,
    };

    this.applications.push(record);
    this.save();

    logger.debug(`Recorded application: ${result.jobId} (${result.status})`);
  }

  /**
   * Get all applications for a specific email
   */
  getApplications(email: string): ApplicationRecord[] {
    return this.applications.filter((app) => app.email === email);
  }

  /**
   * Get application statistics
   */
  getStats(email?: string) {
    const apps = email
      ? this.applications.filter((app) => app.email === email)
      : this.applications;

    const stats = {
      total: apps.length,
      byStatus: {} as Record<string, number>,
    };

    apps.forEach((app) => {
      stats.byStatus[app.status] = (stats.byStatus[app.status] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear all application history (use with caution)
   */
  clear() {
    this.applications = [];
    this.save();
    logger.info('Application history cleared');
  }
}
