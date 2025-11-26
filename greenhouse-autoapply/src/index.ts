#!/usr/bin/env node

/**
 * Greenhouse Auto-Apply CLI
 * Main orchestrator for application submissions
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';
import type { UserProfile, ApplicationResult } from './models/types.js';
import { GreenhouseAPI } from './api/greenhouse-api.js';
import { BrowserAutomation } from './automation/browser-automation.js';
import { ApplicationTracker } from './utils/tracker.js';
import { logger } from './utils/logger.js';
import { parseGreenhouseUrl } from './utils/parser.js';

class GreenhouseAutoApply {
  private api: GreenhouseAPI;
  private browser: BrowserAutomation;
  private tracker: ApplicationTracker;
  private profile: UserProfile;

  constructor() {
    this.api = new GreenhouseAPI();
    this.browser = new BrowserAutomation(
      process.env.HEADLESS !== 'false',
      parseInt(process.env.TIMEOUT || '30000')
    );
    this.tracker = new ApplicationTracker();
    this.profile = this.loadProfile();

    // Set log level
    logger.setLevel((process.env.LOG_LEVEL as any) || 'info');
  }

  /**
   * Load user profile from config
   */
  private loadProfile(): UserProfile {
    try {
      const profilePath = resolve(process.cwd(), 'config', 'profile.json');
      const data = readFileSync(profilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to load profile.json');
      logger.error('Please create config/profile.json with your information');
      process.exit(1);
    }
  }

  /**
   * Apply to a job given its URL
   */
  async apply(jobUrl: string): Promise<ApplicationResult> {
    logger.info('='.repeat(60));
    logger.info(`Starting application process for: ${jobUrl}`);
    logger.info('='.repeat(60));

    // Parse URL
    const parsed = parseGreenhouseUrl(jobUrl);
    if (!parsed) {
      logger.error('Invalid Greenhouse URL');
      return {
        jobId: 'unknown',
        jobUrl,
        status: 'failed',
        method: 'none',
        message: 'Invalid Greenhouse URL format',
        timestamp: new Date().toISOString(),
      };
    }

    const { company, jobId } = parsed;

    // Check for duplicates
    if (this.tracker.hasApplied(this.profile.email, jobId, jobUrl)) {
      logger.warn('⚠️  Already applied to this job!');
      return {
        jobId,
        jobUrl,
        status: 'duplicate',
        method: 'none',
        message: 'Already applied to this job with this email',
        timestamp: new Date().toISOString(),
      };
    }

    let result: ApplicationResult;

    // STEP 1: Try API submission first
    logger.info('\n[Step 1] Attempting API submission...');
    const canUseAPI = await this.api.canUseAPI(company, jobId);

    if (canUseAPI) {
      result = await this.api.submitApplication(company, jobId, this.profile);

      if (result.status === 'success') {
        this.tracker.recordApplication(result, this.profile.email);
        this.printResult(result);
        return result;
      }

      logger.warn('API submission failed, falling back to browser automation');
    } else {
      logger.warn('API submission not available for this job');
    }

    // STEP 2: Fallback to browser automation
    logger.info('\n[Step 2] Using browser automation...');

    try {
      result = await this.browser.submitApplication(jobUrl, this.profile);

      // Record application if successful or needs manual verification
      if (result.status === 'success' || result.status === 'manual_required') {
        this.tracker.recordApplication(result, this.profile.email);
      }

      this.printResult(result);
      return result;
    } catch (error: any) {
      logger.error(`Unexpected error: ${error.message}`);

      result = {
        jobId,
        jobUrl,
        status: 'failed',
        method: 'browser',
        message: `Unexpected error: ${error.message}`,
        timestamp: new Date().toISOString(),
        errors: [error.message],
      };

      this.printResult(result);
      return result;
    }
  }

  /**
   * Apply to multiple jobs
   */
  async applyBatch(jobUrls: string[]): Promise<ApplicationResult[]> {
    logger.info(`Processing ${jobUrls.length} job applications...`);

    const results: ApplicationResult[] = [];

    for (let i = 0; i < jobUrls.length; i++) {
      logger.info(`\n[${ i + 1}/${jobUrls.length}]`);

      const result = await this.apply(jobUrls[i]);
      results.push(result);

      // Wait between applications to avoid rate limiting
      if (i < jobUrls.length - 1) {
        logger.info('Waiting 5 seconds before next application...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // Print summary
    this.printBatchSummary(results);

    return results;
  }

  /**
   * Print application result
   */
  private printResult(result: ApplicationResult) {
    logger.info('\n' + '='.repeat(60));
    logger.info('APPLICATION RESULT');
    logger.info('='.repeat(60));

    const statusEmoji = {
      success: '✅',
      failed: '❌',
      duplicate: '⚠️',
      captcha_required: '🤖',
      manual_required: '👤',
    };

    logger.info(`Status: ${statusEmoji[result.status]} ${result.status.toUpperCase()}`);
    logger.info(`Method: ${result.method}`);
    logger.info(`Message: ${result.message}`);

    if (result.errors && result.errors.length > 0) {
      logger.info('\nErrors:');
      result.errors.forEach((err) => logger.error(`  - ${err}`));
    }

    logger.info('='.repeat(60));
  }

  /**
   * Print batch summary
   */
  private printBatchSummary(results: ApplicationResult[]) {
    logger.info('\n' + '='.repeat(60));
    logger.info('BATCH SUMMARY');
    logger.info('='.repeat(60));

    const stats = {
      total: results.length,
      success: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      captcha: results.filter((r) => r.status === 'captcha_required').length,
      manual: results.filter((r) => r.status === 'manual_required').length,
    };

    logger.info(`Total: ${stats.total}`);
    logger.success(`✅ Success: ${stats.success}`);
    logger.error(`❌ Failed: ${stats.failed}`);
    logger.warn(`⚠️  Duplicate: ${stats.duplicate}`);
    logger.warn(`🤖 CAPTCHA Required: ${stats.captcha}`);
    logger.warn(`👤 Manual Required: ${stats.manual}`);

    logger.info('='.repeat(60));
  }

  /**
   * Show application statistics
   */
  showStats() {
    const stats = this.tracker.getStats(this.profile.email);

    logger.info('\n' + '='.repeat(60));
    logger.info('APPLICATION STATISTICS');
    logger.info('='.repeat(60));
    logger.info(`Total applications: ${stats.total}`);
    logger.info('\nBy Status:');

    Object.entries(stats.byStatus).forEach(([status, count]) => {
      logger.info(`  ${status}: ${count}`);
    });

    logger.info('='.repeat(60));
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.browser.close();
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Greenhouse Auto-Apply CLI

Usage:
  npm run apply <job-url>              Apply to a single job
  npm run apply <url1> <url2> ...      Apply to multiple jobs
  npm run apply -- --stats             Show application statistics

Examples:
  npm run apply https://boards.greenhouse.io/company/jobs/123456
  npm run apply url1 url2 url3
  npm run apply -- --stats
    `);
    process.exit(0);
  }

  const autoApply = new GreenhouseAutoApply();

  try {
    // Check for flags
    if (args.includes('--stats')) {
      autoApply.showStats();
      process.exit(0);
    }

    // Apply to jobs
    if (args.length === 1) {
      await autoApply.apply(args[0]);
    } else {
      await autoApply.applyBatch(args);
    }

    await autoApply.cleanup();
    process.exit(0);
  } catch (error: any) {
    logger.error(`Fatal error: ${error.message}`);
    await autoApply.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { GreenhouseAutoApply };
