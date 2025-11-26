import { Page } from 'playwright';
import { searchVerificationEmails, markEmailAsRead, VerificationEmail } from './gmail-oauth';

export interface VerificationCheckResult {
  needsVerification: boolean;
  verificationType?: 'code' | 'link' | 'unknown';
  verificationPrompt?: string;
  inputField?: {
    selector: string;
    label: string;
  };
}

/**
 * Check if the page is asking for email verification
 */
export async function detectEmailVerification(page: Page): Promise<VerificationCheckResult> {
  console.log('\n🔍 CHECKING FOR EMAIL VERIFICATION...');

  try {
    // Wait a moment for any verification prompts to appear
    await page.waitForTimeout(2000);

    // Look for verification-related text on the page
    const pageText = await page.evaluate(() => {
      return document.body.textContent || '';
    });

    const verificationKeywords = [
      'verification code',
      'verify your email',
      'check your email',
      'confirmation code',
      'enter the code',
      'email verification',
      'verify email',
      'confirmation email',
      'verification link',
      'authenticate your email',
      'security code',
      'one-time code',
      'otp'
    ];

    const needsVerification = verificationKeywords.some(keyword =>
      pageText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!needsVerification) {
      console.log('✅ No email verification detected');
      return { needsVerification: false };
    }

    console.log('⚠️  EMAIL VERIFICATION DETECTED!');

    // Try to find verification code input field
    const inputField = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));

      for (const input of inputs) {
        const label = input.labels?.[0]?.textContent || '';
        const placeholder = input.placeholder || '';
        const id = input.id || '';
        const name = input.name || '';
        const ariaLabel = input.getAttribute('aria-label') || '';

        const combinedText = `${label} ${placeholder} ${id} ${name} ${ariaLabel}`.toLowerCase();

        const codeKeywords = ['code', 'verification', 'confirm', 'otp', 'token'];
        if (codeKeywords.some(keyword => combinedText.includes(keyword))) {
          // Build a reliable selector
          let selector = input.tagName.toLowerCase();
          if (input.id) {
            selector = `#${input.id}`;
          } else if (input.name) {
            selector = `input[name="${input.name}"]`;
          } else if (input.placeholder) {
            selector = `input[placeholder="${input.placeholder}"]`;
          }

          return {
            selector,
            label: label || placeholder || 'Verification code input'
          };
        }
      }

      return null;
    });

    if (inputField) {
      console.log(`   📝 Found verification input field: "${inputField.label}"`);
      return {
        needsVerification: true,
        verificationType: 'code',
        inputField,
        verificationPrompt: pageText.slice(0, 500) // First 500 chars for context
      };
    }

    // No input field found, might be a link-based verification
    console.log('   🔗 Might be link-based verification (no input field found)');
    return {
      needsVerification: true,
      verificationType: 'link',
      verificationPrompt: pageText.slice(0, 500)
    };

  } catch (error: any) {
    console.error('❌ Error detecting email verification:', error.message);
    return { needsVerification: false };
  }
}

/**
 * Handle email verification by checking Gmail and completing the verification
 */
export async function handleEmailVerification(
  page: Page,
  userId: string,
  verificationCheck: VerificationCheckResult,
  options: {
    maxWaitTime?: number; // Max time to wait for email (ms)
    checkInterval?: number; // How often to check for email (ms)
    companyDomain?: string; // Optional: filter emails from specific domain
  } = {}
): Promise<{ success: boolean; message: string }> {
  const maxWaitTime = options.maxWaitTime || 60000; // 1 minute default
  const checkInterval = options.checkInterval || 5000; // 5 seconds default
  const startTime = Date.now();

  console.log('\n📧 STARTING EMAIL VERIFICATION PROCESS...');
  console.log(`   ⏱️  Max wait time: ${maxWaitTime / 1000} seconds`);
  console.log(`   🔄 Check interval: ${checkInterval / 1000} seconds`);

  // Determine search start time (slightly before current time to account for clock differences)
  const searchStartTime = new Date(Date.now() - 30000); // 30 seconds buffer

  let verificationEmail: VerificationEmail | null = null;

  // Poll for verification email
  while (Date.now() - startTime < maxWaitTime) {
    console.log(`\n📬 Checking Gmail for verification email... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);

    try {
      const emails = await searchVerificationEmails(userId, {
        fromDomain: options.companyDomain,
        newerThan: searchStartTime,
        maxResults: 5
      });

      if (emails.length > 0) {
        // Use the most recent email
        verificationEmail = emails[0];
        console.log('✅ Found verification email!');
        console.log(`   From: ${verificationEmail.from}`);
        console.log(`   Subject: ${verificationEmail.subject}`);
        break;
      }

      console.log('   No verification email found yet, waiting...');
      await new Promise(resolve => setTimeout(resolve, checkInterval));

    } catch (error: any) {
      console.error('❌ Error checking Gmail:', error.message);
      return {
        success: false,
        message: `Failed to check Gmail: ${error.message}`
      };
    }
  }

  if (!verificationEmail) {
    console.log('❌ Timeout: No verification email received within time limit');
    return {
      success: false,
      message: 'No verification email received within the time limit'
    };
  }

  // Handle verification based on type
  if (verificationCheck.verificationType === 'code' && verificationEmail.verificationCode) {
    return await handleCodeVerification(
      page,
      userId,
      verificationEmail,
      verificationCheck.inputField!
    );
  } else if (verificationCheck.verificationType === 'link' && verificationEmail.verificationLink) {
    return await handleLinkVerification(
      page,
      userId,
      verificationEmail
    );
  } else {
    // Try both methods
    if (verificationEmail.verificationCode && verificationCheck.inputField) {
      return await handleCodeVerification(
        page,
        userId,
        verificationEmail,
        verificationCheck.inputField
      );
    } else if (verificationEmail.verificationLink) {
      return await handleLinkVerification(
        page,
        userId,
        verificationEmail
      );
    }

    return {
      success: false,
      message: 'Could not extract verification code or link from email'
    };
  }
}

/**
 * Handle verification by entering a code
 */
async function handleCodeVerification(
  page: Page,
  userId: string,
  verificationEmail: VerificationEmail,
  inputField: { selector: string; label: string }
): Promise<{ success: boolean; message: string }> {
  console.log('\n🔑 HANDLING CODE-BASED VERIFICATION...');

  if (!verificationEmail.verificationCode) {
    return {
      success: false,
      message: 'No verification code found in email'
    };
  }

  try {
    console.log(`   📝 Entering verification code: ${verificationEmail.verificationCode}`);

    // Find and fill the input field
    await page.waitForSelector(inputField.selector, { timeout: 5000 });
    await page.fill(inputField.selector, verificationEmail.verificationCode);

    console.log('   ✅ Verification code entered');

    // Look for and click submit/verify button
    const submitButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const submitKeywords = ['verify', 'confirm', 'submit', 'continue', 'next'];

      for (const button of buttons) {
        const text = (button.textContent || '').toLowerCase().trim();
        const value = (button as any).value?.toLowerCase() || '';

        if (submitKeywords.some(keyword => text.includes(keyword) || value.includes(keyword))) {
          return {
            found: true,
            text: button.textContent?.trim() || value,
            id: button.id
          };
        }
      }

      return { found: false };
    });

    if (submitButton.found) {
      console.log(`   🎯 Found submit button: "${submitButton.text}"`);

      if (submitButton.id) {
        await page.click(`#${submitButton.id}`);
      } else {
        await page.click(`button:has-text("${submitButton.text}")`);
      }

      // Wait for verification to complete
      await page.waitForTimeout(3000);

      console.log('   ✅ Verification submitted');
    } else {
      console.log('   ⚠️  No submit button found, pressing Enter key');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Mark email as read
    await markEmailAsRead(userId, verificationEmail.id);

    return {
      success: true,
      message: 'Verification code entered and submitted successfully'
    };

  } catch (error: any) {
    console.error('❌ Error handling code verification:', error.message);
    return {
      success: false,
      message: `Failed to enter verification code: ${error.message}`
    };
  }
}

/**
 * Handle verification by clicking a link
 */
async function handleLinkVerification(
  page: Page,
  userId: string,
  verificationEmail: VerificationEmail
): Promise<{ success: boolean; message: string }> {
  console.log('\n🔗 HANDLING LINK-BASED VERIFICATION...');

  if (!verificationEmail.verificationLink) {
    return {
      success: false,
      message: 'No verification link found in email'
    };
  }

  try {
    console.log(`   🌐 Navigating to verification link: ${verificationEmail.verificationLink}`);

    // Navigate to the verification link
    await page.goto(verificationEmail.verificationLink, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for verification to complete
    await page.waitForTimeout(3000);

    // Check for success indicators
    const pageText = await page.evaluate(() => document.body.textContent || '');
    const successKeywords = ['verified', 'success', 'confirmed', 'thank you', 'completed'];
    const hasSuccess = successKeywords.some(keyword =>
      pageText.toLowerCase().includes(keyword)
    );

    console.log(`   ${hasSuccess ? '✅' : '⚠️ '} Verification ${hasSuccess ? 'successful' : 'status unclear'}`);

    // Mark email as read
    await markEmailAsRead(userId, verificationEmail.id);

    return {
      success: true,
      message: 'Verification link clicked successfully'
    };

  } catch (error: any) {
    console.error('❌ Error handling link verification:', error.message);
    return {
      success: false,
      message: `Failed to click verification link: ${error.message}`
    };
  }
}

/**
 * Extract company domain from application URL
 */
export function extractCompanyDomain(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Extract main domain (e.g., "greenhouse.io" from "boards.greenhouse.io")
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }

    return hostname;
  } catch (error) {
    return undefined;
  }
}
