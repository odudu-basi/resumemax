const { z } = require('zod');

async function detectLoginPage(stagehand) {
  console.log('\n🔍 Checking if login/signup is required...');
  try {
    const loginActions = await stagehand.observe(
      "Find login buttons, signup buttons, email/password input fields, or 'sign in' / 'create account' links. Only return actions if this appears to be a login or authentication page."
    );
    const hasLoginElements = loginActions.some(action => {
      const desc = action.description.toLowerCase();
      return desc.includes('sign in') || desc.includes('log in') || desc.includes('login') ||
             (desc.includes('email') && desc.includes('password')) ||
             desc.includes('create account') || desc.includes('sign up');
    });
    if (hasLoginElements) {
      console.log('  ✅ Login page detected!');
      return { isLoginPage: true, actions: loginActions };
    }
    console.log('  ℹ️  No login required, proceeding with application');
    return { isLoginPage: false };
  } catch (error) {
    console.error('  ⚠️  Login detection error:', error.message);
    return { isLoginPage: false };
  }
}

async function handleLogin(stagehand, userProfile, maxRetries = 2) {
  console.log('\n═══════════════════════════════════════');
  console.log('  PHASE 0: Authentication');
  console.log('═══════════════════════════════════════');
  let phase0Cost = 0;
  let phase0Usage = { input_tokens: 0, output_tokens: 0 };
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n🔐 Login attempt ${attempt}/${maxRetries}...`);
    try {
      console.log('  🔧 Attempting manual login/signup...');
      const manualResult = await tryManualLogin(stagehand, userProfile);
      if (manualResult.success) {
        console.log('  ✅ Manual login successful!');
        return { success: true, method: 'manual', attempt, cost: phase0Cost, usage: phase0Usage };
      }
      console.log('  ⚠️  Manual login failed, trying agent fallback...');
      const agentResult = await agentLoginFallback(stagehand, userProfile);
      if (agentResult.usage) {
        const inputCost = (agentResult.usage.input_tokens / 1000000) * 1.25;
        const outputCost = (agentResult.usage.output_tokens / 1000000) * 10;
        phase0Cost += inputCost + outputCost;
        phase0Usage.input_tokens += agentResult.usage.input_tokens || 0;
        phase0Usage.output_tokens += agentResult.usage.output_tokens || 0;
      }
      if (agentResult.success) {
        console.log('  ✅ Agent login successful!');
        console.log(`  💰 Phase 0 cost: $${phase0Cost.toFixed(4)}`);
        return { success: true, method: 'agent', attempt, cost: phase0Cost, usage: phase0Usage };
      }
      console.log(`  ❌ Attempt ${attempt} failed`);
    } catch (error) {
      console.error(`  ❌ Login attempt ${attempt} error:`, error.message);
    }
    if (attempt < maxRetries) {
      console.log('  ⏳ Waiting 3 seconds before retry...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  console.log('  ❌ All login attempts failed');
  console.log(`  💰 Phase 0 total cost: $${phase0Cost.toFixed(4)}`);
  return { success: false, error: 'Login failed after all attempts', cost: phase0Cost, usage: phase0Usage };
}

async function tryManualLogin(stagehand, userProfile) {
  try {
    const pageText = await stagehand.page.evaluate(() => document.body.innerText.toLowerCase());
    const needsAccountCreation = pageText.includes('create account') ||
                                  pageText.includes('sign up') ||
                                  pageText.includes('register');
    const workEmail = userProfile.workEmail;
    const workPassword = userProfile.workPassword;
    const firstName = userProfile.first_name || userProfile.fullName?.split(' ')[0] || '';
    const lastName = userProfile.last_name || userProfile.fullName?.split(' ').slice(1).join(' ') || '';
    const phone = userProfile.phone || '';
    if (needsAccountCreation) {
      console.log('    📝 Creating account...');
      const signupInstruction = `Create a new account using:
- Email: ${workEmail}
- Password: ${workPassword}
- First Name: ${firstName}
- Last Name: ${lastName}` + (phone ? `\n- Phone: ${phone}` : '') + `\n\nFill in all required fields and submit the form.`;
      await stagehand.act(signupInstruction, {});
    } else {
      console.log('    🔑 Logging in...');
      await stagehand.act(`Log in using:
- Email: ${workEmail}
- Password: ${workPassword}

Find and fill the email and password fields, then click the login button.`, {});
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    const stillOnLogin = await detectLoginPage(stagehand);
    return { success: !stillOnLogin.isLoginPage };
  } catch (error) {
    console.error('    ⚠️  Manual login error:', error.message);
    return { success: false, error: error.message };
  }
}

async function agentLoginFallback(stagehand, userProfile) {
  console.log('    🤖 Starting agent login fallback...');
  try {
    const agent = stagehand.agent({
      cua: true,
      model: {
        modelName: "google/gemini-2.5-computer-use-preview-10-2025",
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
      },
      systemPrompt: 'You are a login/signup assistant. Your task is to help users log into or create accounts on job application sites.'
    });
    const firstName = userProfile.first_name || userProfile.fullName?.split(' ')[0] || '';
    const lastName = userProfile.last_name || userProfile.fullName?.split(' ').slice(1).join(' ') || '';
    const userContext = `
USER PROFILE:
Name: ${firstName} ${lastName}
Work Email: ${userProfile.workEmail}
Work Password: ${userProfile.workPassword}
Phone: ${userProfile.phone || 'N/A'}
Location: ${userProfile.location || 'N/A'}
LinkedIn: ${userProfile.linkedinUrl || 'N/A'}

Use any information from this profile that may be requested during signup.
`;
    const instruction = `${userContext}

Log into this application or create an account if needed.

Steps to follow:
1. Check if there's a login form or signup form on the current page
2. Try to log in with the work email and work password
3. If it says "account doesn't exist", "user not found", or similar:
   - Create a new account using the user's information from the profile above
   - Use work email as the email
   - Use work password as the password
   - Fill in first name, last name, and any other required fields from the profile
   - Submit the signup form
4. If a verification code or link is requested after signup/login:
   - Navigate to https://mail.google.com
   - Log in with the work email and work password
   - Find the MOST RECENT email from the site you were just working on
   - Look for verification code or confirmation link
   - If it's a link, click it
   - If it's a code, copy it, navigate back to the application, and enter it in the verification field
   - Submit the verification
5. Complete the login/signup process and ensure you're logged into the application

IMPORTANT:
- Only look at the most recent emails in Gmail (top of inbox)
- Make sure the verification email is from the application site, not spam
- After verification, ensure you end up logged into the application
- If login succeeds without verification, stop and return success`;
    console.log('    🚀 Executing agent login/signup...');
    const result = await agent.execute({
      instruction,
      maxSteps: 35,
      highlightCursor: false
    });
    console.log(`    ${result.success ? '✅' : '❌'} Agent completed`);
    console.log(`    📊 Steps taken: ${result.actions ? result.actions.length : 'N/A'}`);
    if (result.usage) {
      const inputTokens = result.usage.input_tokens || 0;
      const outputTokens = result.usage.output_tokens || 0;
      const inputCost = (inputTokens / 1000000) * 1.25;
      const outputCost = (outputTokens / 1000000) * 10;
      const totalCost = inputCost + outputCost;
      console.log(`    💰 Agent cost: $${totalCost.toFixed(4)}`);
      console.log(`       Input tokens: ${inputTokens.toLocaleString()}`);
      console.log(`       Output tokens: ${outputTokens.toLocaleString()}`);
    }
    return {
      success: result.success,
      usage: result.usage,
      steps: result.actions ? result.actions.length : 0,
      messages: result.messages || []
    };
  } catch (error) {
    console.error('    ❌ Agent login error:', error.message);
    return { success: false, error: error.message, usage: null };
  }
}

module.exports = {
  detectLoginPage,
  handleLogin,
  tryManualLogin,
  agentLoginFallback
};
