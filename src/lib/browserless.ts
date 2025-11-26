import { chromium, Browser, Page } from 'playwright';
import { getConfig } from './env';

/**
 * Browserless.io Integration
 *
 * This module provides a simple interface to connect Playwright to Browserless.io
 * instead of running browsers locally.
 */

const config = getConfig();

export interface BrowserlessConfig {
  apiKey?: string;
  endpoint?: string;
  headless?: boolean;
  timeout?: number;
}

/**
 * Connect to Browserless.io browser instance
 *
 * @returns Browser instance connected to Browserless
 */
export async function connectToBrowserless(
  customConfig?: BrowserlessConfig
): Promise<Browser> {
  const apiKey = customConfig?.apiKey || config.browserless.apiKey;
  const endpoint = customConfig?.endpoint || config.browserless.endpoint;

  if (!apiKey) {
    throw new Error(
      'Browserless API key not found. Please set BROWSERLESS_API_KEY in your environment variables.'
    );
  }

  // Construct WebSocket URL with API token
  const wsEndpoint = `${endpoint}?token=${apiKey}`;

  console.log('🌐 Connecting to Browserless.io...');

  try {
    // Connect to remote browser using CDP (Chrome DevTools Protocol)
    // This is the correct method for Browserless.io
    const browser = await chromium.connectOverCDP(wsEndpoint, {
      timeout: customConfig?.timeout || 30000,
    });

    console.log('✅ Connected to Browserless.io browser');
    return browser;
  } catch (error: any) {
    console.error('❌ Failed to connect to Browserless.io:', error.message);
    throw new Error(`Browserless connection failed: ${error.message}`);
  }
}

/**
 * Create a new page with recommended settings
 *
 * @param browser Browser instance
 * @returns Configured Page instance
 */
export async function createBrowserlessPage(browser: Browser): Promise<Page> {
  // When using Browserless with CDP, get the existing context or create one
  const context = browser.contexts()[0] || await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Set default timeout
  page.setDefaultTimeout(60000); // 60 seconds

  // Set default navigation timeout
  page.setDefaultNavigationTimeout(60000);

  return page;
}

/**
 * Wrapper function to execute Playwright scripts on Browserless
 * Automatically handles browser connection and cleanup
 *
 * @param callback Function that receives a Page instance
 * @returns Result from the callback
 */
export async function withBrowserless<T>(
  callback: (page: Page) => Promise<T>,
  config?: BrowserlessConfig
): Promise<T> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Connect to Browserless
    browser = await connectToBrowserless(config);

    // Create page
    page = await createBrowserlessPage(browser);

    // Execute user callback
    const result = await callback(page);

    return result;
  } catch (error: any) {
    console.error('❌ Browserless execution error:', error);
    throw error;
  } finally {
    // Cleanup
    try {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
      }
      console.log('🧹 Browserless connection closed');
    } catch (cleanupError) {
      console.error('Warning: Error during cleanup:', cleanupError);
    }
  }
}

/**
 * Check if we should use Browserless or local Playwright
 *
 * @returns true if Browserless should be used
 */
export function shouldUseBrowserless(): boolean {
  // Use Browserless if API key is set and we're not in local development
  const hasApiKey = !!config.browserless.apiKey;
  const isProduction = process.env.NODE_ENV === 'production';

  return hasApiKey && isProduction;
}

/**
 * Launch browser (either local or Browserless based on environment)
 *
 * @returns Browser instance
 */
export async function launchBrowser(): Promise<Browser> {
  if (shouldUseBrowserless()) {
    console.log('🌐 Using Browserless.io');
    return await connectToBrowserless();
  } else {
    console.log('💻 Using local Playwright');
    return await chromium.launch({
      headless: true,
    });
  }
}

/**
 * Example usage:
 *
 * ```typescript
 * // Simple usage with automatic cleanup
 * const result = await withBrowserless(async (page) => {
 *   await page.goto('https://example.com');
 *   return await page.title();
 * });
 *
 * // Manual usage
 * const browser = await connectToBrowserless();
 * const page = await createBrowserlessPage(browser);
 * await page.goto('https://example.com');
 * await browser.close();
 * ```
 */
