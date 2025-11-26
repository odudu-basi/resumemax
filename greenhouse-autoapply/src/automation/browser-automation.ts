/**
 * Playwright-based browser automation for Greenhouse applications
 * Fallback when API submission doesn't work
 */

import { chromium, Page, Browser } from 'playwright';
import { resolve, isAbsolute } from 'path';
import { existsSync } from 'fs';
import type { UserProfile, ApplicationResult, FieldError } from '../models/types.js';
import { logger } from '../utils/logger.js';

export class BrowserAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private headless: boolean;
  private timeout: number;
  private fieldErrors: FieldError[] = [];
  private filledFields: string[] = [];
  private missingFields: string[] = [];

  constructor(headless = false, timeout = 30000) {
    this.headless = headless;
    this.timeout = timeout;
  }

  async initialize() {
    logger.info('Launching browser...');
    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 },
    });

    this.page = await context.newPage();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Submit application via browser automation
   */
  async submitApplication(
    jobUrl: string,
    profile: UserProfile
  ): Promise<ApplicationResult> {
    if (!this.page) {
      await this.initialize();
    }

    const page = this.page!;

    // Reset tracking arrays
    this.fieldErrors = [];
    this.filledFields = [];
    this.missingFields = [];

    try {
      logger.info(`Navigating to job page: ${jobUrl}`);
      await page.goto(jobUrl, { waitUntil: 'networkidle', timeout: this.timeout });

      // Handle cookie banners early
      await this.acceptCookies(page);

      // Click "Apply" button
      const applyButton = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
      if (await applyButton.isVisible({ timeout: 5000 })) {
        logger.debug('Clicking Apply button');
        await applyButton.click();
        await page.waitForLoadState('networkidle');
        // Cookie banner may re-appear on the form page
        await this.acceptCookies(page);
      }

      // Check for CAPTCHA
      const hasCaptcha = await this.detectCaptcha(page);
      if (hasCaptcha) {
        logger.warn('⚠️  CAPTCHA detected! Please solve it manually...');
        logger.info('Waiting 60 seconds for you to solve the CAPTCHA...');

        // Wait for CAPTCHA to be solved (or timeout)
        await page.waitForTimeout(60000);

        // Check if still has CAPTCHA
        if (await this.detectCaptcha(page)) {
          const screenshotPath = `./captcha-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });

          return {
            jobId: this.extractJobId(jobUrl),
            jobUrl,
            status: 'captcha_required',
            method: 'browser',
            message: 'CAPTCHA detected and not solved within time limit',
            timestamp: new Date().toISOString(),
            filledFields: this.filledFields,
            missingFields: this.missingFields,
            fieldErrors: this.fieldErrors,
            screenshotPath,
          };
        }
      }

      // Fill out the application form
      logger.info('Filling out application form...');
      await this.fillForm(page, profile);

      // Check for submit button
      const submitButton = page.locator(
        'button[type="submit"]:has-text("Submit"), input[type="submit"], button:has-text("Submit Application")'
      ).first();

      if (await submitButton.isVisible({ timeout: 5000 })) {
        logger.info('Submitting application...');
        await submitButton.click();

        // Wait for confirmation
        await page.waitForLoadState('networkidle', { timeout: this.timeout });

        // Check for success indicators
        const successIndicators = [
          'Thank you for applying',
          'Application submitted',
          'Your application has been received',
          'Successfully submitted',
        ];

        let isSuccess = false;
        for (const indicator of successIndicators) {
          if (await page.locator(`text=${indicator}`).isVisible({ timeout: 2000 }).catch(() => false)) {
            isSuccess = true;
            break;
          }
        }

        if (isSuccess) {
          logger.success('Application submitted successfully via browser!');

          return {
            jobId: this.extractJobId(jobUrl),
            jobUrl,
            status: 'success',
            method: 'browser',
            message: 'Application submitted successfully via browser automation',
            timestamp: new Date().toISOString(),
            filledFields: this.filledFields,
            fieldErrors: this.fieldErrors.length > 0 ? this.fieldErrors : undefined,
          };
        } else {
          // Take screenshot for debugging
          const screenshotPath = `./application-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });

          return {
            jobId: this.extractJobId(jobUrl),
            jobUrl,
            status: 'manual_required',
            method: 'browser',
            message: 'Form filled but submission needs manual verification',
            timestamp: new Date().toISOString(),
            filledFields: this.filledFields,
            missingFields: this.missingFields,
            fieldErrors: this.fieldErrors,
            screenshotPath,
          };
        }
      } else {
        const screenshotPath = `./no-submit-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });

        return {
          jobId: this.extractJobId(jobUrl),
          jobUrl,
          status: 'manual_required',
          method: 'browser',
          message: 'Could not find submit button. Manual intervention required.',
          timestamp: new Date().toISOString(),
          filledFields: this.filledFields,
          missingFields: this.missingFields,
          fieldErrors: this.fieldErrors,
          screenshotPath,
        };
      }
    } catch (error: any) {
      logger.error(`Browser automation failed: ${error.message}`);

      // Take screenshot for debugging
      let screenshotPath: string | undefined;
      if (this.page) {
        screenshotPath = `./error-${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath }).catch(() => {});
      }

      return {
        jobId: this.extractJobId(jobUrl),
        jobUrl,
        status: 'failed',
        method: 'browser',
        message: `Browser automation failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        errors: [error.message],
        filledFields: this.filledFields,
        missingFields: this.missingFields,
        fieldErrors: this.fieldErrors,
        screenshotPath,
      };
    }
  }

  /**
   * Fill out the application form with user profile data
   */
  private async fillForm(page: Page, profile: UserProfile) {
    logger.info('Starting form fill process...');

    // Email (required)
    await this.fillField(page, ['email', 'Email', 'email_address'], profile.email, 'Email');

    // Name (required)
    await this.fillField(page, ['first_name', 'First Name', 'firstName'], profile.firstName, 'First Name');
    await this.fillField(page, ['last_name', 'Last Name', 'lastName'], profile.lastName, 'Last Name');

    // Phone
    await this.fillField(page, ['phone', 'Phone', 'phone_number'], profile.phone, 'Phone');

    // Location
    await this.fillField(page, ['location', 'Location', 'city'], profile.location.city, 'Location/City');

    // LinkedIn
    await this.fillField(page, ['linkedin', 'LinkedIn', 'linkedin_url'], profile.linkedin || '', 'LinkedIn URL');

    // GitHub
    await this.fillField(page, ['github', 'GitHub', 'github_url'], profile.github || '', 'GitHub URL');

    // Portfolio/Website
    await this.fillField(page, ['website', 'Website', 'portfolio'], profile.portfolio || '', 'Portfolio/Website');

    // Resume upload
    if (profile.resume.path) {
      await this.uploadResume(page, profile.resume.path);
    } else {
      this.missingFields.push('Resume');
      this.fieldErrors.push({
        fieldName: 'resume',
        fieldLabel: 'Resume',
        reason: 'missing_value',
        suggestions: ['Please upload your resume PDF to config/resume.pdf'],
      });
    }

    // Handle custom questions
    await this.handleCustomQuestions(page, profile);

    logger.info(`Form fill complete: ${this.filledFields.length} fields filled, ${this.missingFields.length} missing, ${this.fieldErrors.length} errors`);
  }

  /**
   * Fill a form field by trying multiple selectors
   */
  private async fillField(page: Page, selectors: string[], value: string, label?: string) {
    const fieldLabel = label || selectors[0];

    // Check if value is provided
    if (!value || value.trim() === '') {
      this.missingFields.push(fieldLabel);
      this.fieldErrors.push({
        fieldName: selectors[0],
        fieldLabel,
        reason: 'missing_value',
        suggestions: [`Please provide your ${fieldLabel.toLowerCase()} in your profile`],
      });
      logger.warn(`⚠️  Missing value for field: ${fieldLabel}`);
      return;
    }

    for (const selector of selectors) {
      try {
        const input = page.locator(`input[name*="${selector}" i], input[id*="${selector}" i], textarea[name*="${selector}" i]`).first();

        if (await input.isVisible({ timeout: 1000 })) {
          await input.fill(value);
          this.filledFields.push(fieldLabel);
          logger.debug(`✓ Filled field: ${fieldLabel}`);
          return;
        }
      } catch {
        continue;
      }
    }

    // Field not found on page
    logger.debug(`Field not found on page: ${fieldLabel}`);
    this.fieldErrors.push({
      fieldName: selectors[0],
      fieldLabel,
      reason: 'field_not_found',
      attemptedValue: value.substring(0, 50) + (value.length > 50 ? '...' : ''),
    });
  }

  /**
   * Upload resume file
   */
  private async uploadResume(page: Page, resumePath: string) {
    try {
      // Try to reveal file input if hidden behind a button/label
      const revealers = [
        'button:has-text("Upload")',
        'button:has-text("Choose File")',
        'label:has-text("Resume")',
      ];
      for (const r of revealers) {
        const el = page.locator(r).first();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          await el.click().catch(() => {});
          break;
        }
      }

      // Prefer specific resume inputs but fallback to any file input
      const candidateInputs = [
        'input[type="file"][name*="resume" i]',
        'input[type="file"][id*="resume" i]',
        'input[type="file"][accept*="pdf" i]',
        'input[type="file"][accept*="doc" i]',
        'input[type="file"]',
      ];

      let fileInput: ReturnType<Page['locator']> | null = null;
      // Search in main frame and any iframes
      const frames = [page.mainFrame(), ...page.frames()];
      for (const frame of frames) {
        for (const sel of candidateInputs) {
          const loc = frame.locator(sel).first();
          if (await loc.count() > 0) {
            fileInput = loc as any;
            break;
          }
        }
        if (fileInput) break;
      }

      // Resolve path: support absolute, workspace root, and config directory
      const tryPaths = [
        resumePath,
        resolve(process.cwd(), resumePath),
        resolve(process.cwd(), 'config', resumePath),
      ];

      let fullPath = tryPaths.find(p => existsSync(p));
      if (!fullPath) {
        // If provided was absolute but missing, log and skip
        logger.warn(`Resume file not found at any known path. Tried: ${tryPaths.join(', ')}`);
        this.missingFields.push('Resume');
        this.fieldErrors.push({ fieldName: 'resume', fieldLabel: 'Resume', reason: 'missing_value', suggestions: ['Ensure resume file path is correct'] });
        return;
      }

      // If we found a direct file input → use it
      if (fileInput) {
        await fileInput.setInputFiles(fullPath);
        this.filledFields.push('Resume');
        logger.debug('Resume uploaded via direct file input');
        return;
      }

      // Otherwise, try Greenhouse-style "Attach" button that opens a file chooser
      const attachButtons = [
        'button:has-text("Attach")',
        'button:has-text("Upload Resume")',
        'button:has-text("Upload")',
        'text=Attach',
      ];

      for (const sel of attachButtons) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          try {
            const [chooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 3000 }),
              btn.click(),
            ]);
            await chooser.setFiles(fullPath);
            this.filledFields.push('Resume');
            logger.debug('Resume uploaded via file chooser (Attach button)');
            return;
          } catch {
            // Continue to next selector
          }
        }
      }

      // If still not uploaded, record as missing
      logger.warn('Could not locate a working resume upload control');
      this.missingFields.push('Resume');
      this.fieldErrors.push({ fieldName: 'resume', fieldLabel: 'Resume', reason: 'field_not_found' });
    } catch (error) {
      logger.warn('Could not upload resume:', error);
    }
  }

  /**
   * Handle custom application questions
   */
  private async handleCustomQuestions(page: Page, profile: UserProfile) {
    try {
      // Get all visible textareas and inputs that might be custom questions
      const questionFields = await page.locator('textarea, input[type="text"]').all();

      for (const field of questionFields) {
        const label = await this.getFieldLabel(field);

        if (label && profile.customAnswers[label]) {
          await field.fill(profile.customAnswers[label]);
          logger.debug(`Answered custom question: ${label}`);
        }
      }
    } catch (error) {
      logger.debug('Could not handle custom questions:', error);
    }
  }

  /**
   * Get the label for a form field
   */
  private async getFieldLabel(field: any): Promise<string | null> {
    try {
      const id = await field.getAttribute('id');
      if (id) {
        const label = await field.page().locator(`label[for="${id}"]`).textContent();
        return label?.trim() || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Detect if page has CAPTCHA
   */
  private async detectCaptcha(page: Page): Promise<boolean> {
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="hcaptcha"]',
      '[class*="captcha"]',
      '[id*="captcha"]',
    ];

    for (const selector of captchaSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Attempt to accept cookie consent banners
   */
  private async acceptCookies(page: Page) {
    try {
      const selectors = [
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button:has-text("Accept all cookies")',
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'button#onetrust-accept-btn-handler',
        '.onetrust-accept-btn-handler',
        '[aria-label*="Accept" i]',
      ];
      for (const sel of selectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click().catch(() => {});
          logger.debug('Cookie consent accepted');
          // Give banner time to dismiss
          await page.waitForTimeout(300);
          return;
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Extract job ID from URL
   */
  private extractJobId(url: string): string {
    const match = url.match(/\/jobs\/(\d+)/);
    return match ? match[1] : 'unknown';
  }
}
