const { z } = require('zod');

/**
 * Detect if current page is a login/signup page
 */
async function detectLoginPage(stagehand) {
  console.log('\n🔍 Checking if login/signup is required...');

  try {
    // Use observe to detect login-related elements
    const loginActions = await stagehand.observe(
      "Find login buttons, signup buttons, email/password input fields, or 'sign in' / 'create account' links. Only return actions if this appears to be a login or authentication page."
    );

    // Check for login indicators
    const hasLoginElements = loginActions.some(action => {
      const desc = action.description.toLowerCase();
      return desc.includes('sign in') ||
             desc.includes('log in') ||
             desc.includes('login') ||
             (desc.includes('email') && desc.includes('password')) ||
             desc.includes('create account') ||
             desc.includes('sign up');
    });

    if (hasLoginElements) {
      console.log('  ✅ Login page detected!');
      return {
        isLoginPage: true,
        actions: loginActions
      };
    }

    console.log('  ℹ️  No login required, proceeding with application');
    return { isLoginPage: false };

  } catch (error) {
    console.error('  ⚠️  Login detection error:', error.message);
    return { isLoginPage: false };
  }
}

/**
 * Handle login or account creation
 */
async function handleLogin(stagehand, userProfile) {
  console.log('\n🔐 Starting login handler...');

  try {
    // Step 1: Determine if we need to create account or login
    const pageText = await stagehand.page.evaluate(() => document.body.innerText.toLowerCase());
    const needsAccountCreation = pageText.includes('create account') ||
                                  pageText.includes('sign up') ||
                                  pageText.includes('register');

    if (needsAccountCreation) {
      console.log('  📝 Account creation detected, will create new account');
      await createAccount(stagehand, userProfile);
    } else {
      console.log('  🔑 Login form detected, attempting login');
      await performLogin(stagehand, userProfile);
    }

    // Step 2: Handle email verification if needed
    await handleEmailVerification(stagehand, userProfile);

    console.log('  ✅ Login completed successfully!');
    return { success: true };

  } catch (error) {
    console.error('  ❌ Login handler error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new account
 */
async function createAccount(stagehand, userProfile) {
  console.log('\n  📝 Creating new account...');
  console.log(`    📧 Using work email: ${userProfile.workEmail}`);

  try {
    const phone = userProfile.phone || '';
    const workEmail = userProfile.workEmail; // Work email address (@nuclei-mail.com)
    const workPassword = userProfile.workPassword; // Work email password

    const actInstruction = `Create a new account using these details:
- Email: ${workEmail}
- Password: ${workPassword}
- Full Name: ${userProfile.fullName}
${phone ? `- Phone: ${phone}` : '- Phone: skip if not required'}

Fill in all required fields and submit the form. If there are optional fields, you can skip them.`;

    // Use act() to let the agent intelligently fill the signup form
    await stagehand.act(actInstruction);

    console.log('    ✅ Account creation form submitted');

    // Wait for page to load after submission
    await stagehand.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error('    ⚠️  Account creation error:', error.message);
    throw error;
  }
}

/**
 * Perform login
 */
async function performLogin(stagehand, userProfile) {
  console.log('\n  🔑 Logging in...');
  console.log(`    📧 Using work email: ${userProfile.workEmail}`);

  try {
    const workEmail = userProfile.workEmail; // Work email address (@nuclei-mail.com)
    const workPassword = userProfile.workPassword; // Work email password

    const actInstruction = `Log in to the account using:
- Email/Username: ${workEmail}
- Password: ${workPassword}

Find the email and password fields, fill them in, and click the login/sign in button.`;

    // Use act() to let the agent fill login form
    await stagehand.act(actInstruction);

    console.log('    ✅ Login form submitted');

    // Wait for page to load
    await stagehand.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error('    ⚠️  Login error:', error.message);
    throw error;
  }
}

/**
 * Handle email verification by navigating to Gmail
 */
async function handleEmailVerification(stagehand, userProfile) {
  console.log('\n  📧 Checking for email verification requirement...');

  try {
    // Check if verification is needed
    const pageText = await stagehand.page.evaluate(() => document.body.innerText.toLowerCase());
    const needsVerification = (pageText.includes('verify') && pageText.includes('email')) ||
                              pageText.includes('verification code') ||
                              pageText.includes('check your email') ||
                              pageText.includes('confirmation code');

    if (!needsVerification) {
      console.log('    ℹ️  No email verification required');
      return;
    }

    console.log('    🔔 Email verification required!');

    // Get current URL to return to
    const applicationUrl = stagehand.page.url();
    console.log(`    💾 Saved application URL: ${applicationUrl}`);

    // Navigate to Gmail
    console.log('    📬 Navigating to Gmail...');
    const workEmail = userProfile.workEmail;
    const workPassword = userProfile.workPassword;
    console.log(`    📧 Checking work email: ${workEmail}`);

    await stagehand.page.goto('https://mail.google.com', { waitUntil: 'networkidle' });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Log in to Gmail
    console.log('    🔐 Logging into Gmail...');
    await stagehand.act(
      `Log in to Gmail using:
- Email/Username: ${workEmail}
- Password: ${workPassword}

Find and fill the login form, then submit it.`
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Use agent to find and extract verification code
    console.log('    🔍 Looking for verification email...');
    await stagehand.act(
      'Find the most recent email with a verification code or confirmation code. Look for emails from the company or application system we just signed up for. Open that email.'
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract the verification code using extract()
    const codeSchema = z.object({
      code: z.string().describe("The verification or confirmation code from the email")
    });

    const extracted = await stagehand.extract(
      "Find and extract the verification code, confirmation code, or OTP from this email. It's usually a 4-8 digit number or alphanumeric code.",
      codeSchema
    );

    const verificationCode = extracted.code;
    console.log(`    ✅ Found verification code: ${verificationCode}`);

    // Navigate back to application
    console.log('    🔙 Returning to application...');
    await stagehand.page.goto(applicationUrl, { waitUntil: 'networkidle' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enter the verification code
    console.log('    ⌨️  Entering verification code...');
    await stagehand.act(
      `Enter the verification code "${verificationCode}" in the verification code input field and submit it.`
    );

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('    ✅ Email verification completed!');

  } catch (error) {
    console.error('    ⚠️  Email verification error:', error.message);
    // Don't throw - continue even if verification fails
    console.log('    ℹ️  Continuing without verification...');
  }
}

// Export the functions
module.exports = {
  detectLoginPage,
  handleLogin,
  createAccount,
  performLogin,
  handleEmailVerification
};
