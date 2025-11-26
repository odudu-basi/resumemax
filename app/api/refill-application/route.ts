import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Force Node.js runtime
export const runtime = 'nodejs';

// Request schema
const RefillRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║       🔄 RE-FILLING APPLICATION WITH SAVED DATA               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const body = await request.json();
    const { sessionId } = RefillRequestSchema.parse(body);

    console.log(`🔑 Session ID: ${sessionId}`);

    // Step 1: Fetch session data from database
    console.log('📚 Fetching session data from database...');
    const { data: session, error: sessionError } = await supabase
      .from('auto_apply_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found or expired');
    }

    console.log(`✅ Session found: ${session.job_url}`);
    console.log(`📊 Fields to fill: ${session.fields_filled}`);

    // Check if session is still valid (not expired)
    const expiresAt = new Date(session.expires_at);
    const now = new Date();
    let sessionExtended = false;
    
    if (expiresAt < now) {
      console.log(`⏰ Session expired at ${expiresAt.toISOString()}, current time: ${now.toISOString()}`);
      
      // Extend the session by 15 more minutes when user tries to review
      const newExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
      
      console.log(`🔄 Extending session expiry to: ${newExpiresAt.toISOString()}`);
      
      // Update the session with new expiry time
      const { error: updateError } = await supabase
        .from('auto_apply_sessions')
        .update({ 
          expires_at: newExpiresAt.toISOString(),
          status: 'awaiting_review' // Ensure it's still in review status
        })
        .eq('id', sessionId);
      
      if (updateError) {
        console.error('❌ Failed to extend session:', updateError);
        throw new Error('Session has expired and could not be extended. Please try applying again.');
      }
      
      console.log('✅ Session expiry extended successfully');
      sessionExtended = true;
    }

    const filledFormData = session.filled_form_data || [];
    const userProfile = session.user_profile_data;

    if (filledFormData.length === 0) {
      throw new Error('No filled form data available');
    }

    console.log('📋 Resume data available:', !!userProfile?.resume);
    if (userProfile?.resume) {
      console.log(`   📄 Resume file: ${userProfile.resume.fileName}`);
    }

    // Step 2: Launch browser in HEADLESS mode first (user won't see it yet)
    console.log('🌐 Launching browser in headless mode for filling...');
    browser = await chromium.launch({
      headless: true, // Start headless to fill form first
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();
    console.log(`🔗 Navigating to: ${session.job_url}`);
    await page.goto(session.job_url, { waitUntil: 'networkidle', timeout: 60000 });

    // Step 3: Fill the form with saved data (WHILE HEADLESS)
    console.log(`\n🎯 Filling ${filledFormData.length} fields with saved data (headless)...`);

    let filled = 0;
    let failed = 0;

    for (const fieldData of filledFormData) {
      try {
        console.log(`\n📝 Filling: ${fieldData.fieldLabel}`);
        console.log(`   Type: ${fieldData.fieldType}`);
        console.log(`   Value: ${typeof fieldData.value === 'string' ? fieldData.value.substring(0, 50) : fieldData.value}...`);

        // Extract key words from label for better matching
        const labelWords = fieldData.fieldLabel.toLowerCase().split(/\s+/).filter(w => w.length > 3);

        // Find the field by label (comprehensive matching)
        const selectors = [
          // Exact aria-label match
          `input[aria-label*="${fieldData.fieldLabel}" i]`,
          `textarea[aria-label*="${fieldData.fieldLabel}" i]`,
          `select[aria-label*="${fieldData.fieldLabel}" i]`,

          // Label association (most common)
          `label:has-text("${fieldData.fieldLabel}") input`,
          `label:has-text("${fieldData.fieldLabel}") textarea`,
          `label:has-text("${fieldData.fieldLabel}") select`,

          // Partial label text match
          ...labelWords.map(word => `label:has-text("${word}") select`),
          ...labelWords.map(word => `label:has-text("${word}") input`),

          // Name attribute match
          `input[name*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `textarea[name*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `select[name*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,

          // ID attribute match
          `input[id*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `textarea[id*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `select[id*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,

          // Placeholder match
          `input[placeholder*="${fieldData.fieldLabel}" i]`,
          `textarea[placeholder*="${fieldData.fieldLabel}" i]`,
        ];

        let fieldFound = false;
        let selectorsTried = 0;
        for (const selector of selectors) {
          try {
            selectorsTried++;
            const element = page.locator(selector).first();
            const count = await element.count();

            if (count > 0) {
              console.log(`   ✓ Found field using selector #${selectorsTried}: ${selector.substring(0, 80)}`);
              // Fill based on field type
              if (fieldData.fieldType === 'file') {
                console.log('   📎 FILE UPLOAD field detected');

                // Check if we have resume data
                if (userProfile?.resume?.fileBase64) {
                  console.log('   📄 Uploading resume file...');

                  try {
                    // Import required modules at top if not already
                    const fs = require('fs');
                    const path = require('path');
                    const os = require('os');

                    // Create temp file from base64
                    const tempDir = os.tmpdir();
                    const tempFilePath = path.resolve(tempDir, userProfile.resume.fileName);
                    const buffer = Buffer.from(userProfile.resume.fileBase64, 'base64');
                    fs.writeFileSync(tempFilePath, buffer);

                    console.log(`   📁 Created temp file: ${tempFilePath}`);

                    // Upload the file
                    await element.setInputFiles(tempFilePath);
                    console.log('   ✅ Resume uploaded successfully');

                    // Wait for upload to process
                    await page.waitForTimeout(2000);

                    // Clean up temp file
                    try {
                      fs.unlinkSync(tempFilePath);
                      console.log('   🗑️  Temp file cleaned up');
                    } catch (cleanupError) {
                      console.log('   ⚠️  Could not delete temp file (will be auto-deleted by OS)');
                    }
                  } catch (uploadError: any) {
                    console.error(`   ❌ File upload failed: ${uploadError.message}`);
                    console.log('   ⚠️  User will need to upload manually');
                  }
                } else {
                  console.log('   ⚠️  No resume data available - user must upload manually');
                }
                continue;
              } else if (fieldData.fieldType === 'select' || fieldData.fieldType === 'dropdown') {
                // SELECT dropdown - click the option just like initial filling
                console.log(`   📋 SELECT dropdown - clicking option: "${fieldData.value}"`);

                // First, click to open the dropdown
                await element.click();
                await page.waitForTimeout(500);

                // Find and click the matching option
                const clicked = await page.evaluate(({ targetValue }) => {
                  // Try to find the option by text content
                  const allOptions = document.querySelectorAll('option');

                  for (const option of allOptions) {
                    const optionText = option.textContent?.trim().toLowerCase() || '';
                    const optionValue = (option as HTMLOptionElement).value.toLowerCase();
                    const target = targetValue.toLowerCase();

                    // Exact match
                    if (optionText === target || optionValue === target) {
                      (option as HTMLElement).click();
                      console.log(`   ✅ Clicked option: "${option.textContent}"`);
                      return true;
                    }
                  }

                  // Partial match
                  for (const option of allOptions) {
                    const optionText = option.textContent?.trim().toLowerCase() || '';
                    const target = targetValue.toLowerCase();

                    if (optionText.includes(target) || target.includes(optionText)) {
                      (option as HTMLElement).click();
                      console.log(`   ✅ Clicked option (partial match): "${option.textContent}"`);
                      return true;
                    }
                  }

                  return false;
                }, { targetValue: fieldData.value });

                if (clicked) {
                  console.log('   ✅ Option clicked successfully');
                } else {
                  // Fallback to programmatic selection
                  console.log('   ⚠️  Click failed, using programmatic selection');
                  await element.evaluate((el, valueToSelect) => {
                    const select = el as HTMLSelectElement;
                    const options = Array.from(select.options);

                    for (let i = 0; i < options.length; i++) {
                      const optionText = options[i].textContent?.trim().toLowerCase() || '';
                      const optionValue = options[i].value.toLowerCase();
                      const targetValue = valueToSelect.toLowerCase();

                      if (optionText === targetValue || optionValue === targetValue ||
                          optionText.includes(targetValue) || targetValue.includes(optionText)) {
                        select.selectedIndex = i;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                      }
                    }
                  }, fieldData.value);
                  console.log('   ✅ Programmatically selected');
                }

                await page.waitForTimeout(300);
              } else if (fieldData.fieldType === 'autocomplete') {
                // Handle autocomplete fields - ALWAYS TYPE AND CLICK
                console.log('   🔍 AUTOCOMPLETE field - type and click option');

                try {
                  // Clear and type to trigger dropdown
                  await element.clear();
                  await page.waitForTimeout(200);
                  await element.type(fieldData.value, { delay: 50 });
                  console.log(`   ⌨️  Typed: "${fieldData.value}"`);
                  await page.waitForTimeout(1000); // Wait for dropdown

                  // Try to click matching option from dropdown
                  const clicked = await page.evaluate(({ value }) => {
                    const optionSelectors = [
                      '[role="listbox"] [role="option"]',
                      '[role="option"]',
                      '.autocomplete-option',
                      '.autocomplete-suggestion',
                      '.autocomplete-item',
                      '[class*="option"]',
                      '[class*="suggestion"]',
                      '[class*="dropdown"] li',
                      '[class*="menu"] li',
                      'li[role="option"]',
                      'div[role="option"]',
                      '.MuiAutocomplete-option',
                    ];

                    for (const sel of optionSelectors) {
                      const options = document.querySelectorAll(sel);
                      for (const opt of options) {
                        const optText = opt.textContent?.trim().toLowerCase() || '';
                        const target = value.toLowerCase();
                        const isVisible = opt.offsetParent !== null;

                        // Exact match
                        if (isVisible && optText === target) {
                          (opt as HTMLElement).click();
                          console.log(`   ✅ Clicked autocomplete option: "${opt.textContent}"`);
                          return true;
                        }
                      }
                    }

                    // Partial match
                    for (const sel of optionSelectors) {
                      const options = document.querySelectorAll(sel);
                      for (const opt of options) {
                        const optText = opt.textContent?.trim().toLowerCase() || '';
                        const target = value.toLowerCase();
                        const isVisible = opt.offsetParent !== null;

                        if (isVisible && (optText.includes(target) || target.includes(optText))) {
                          (opt as HTMLElement).click();
                          console.log(`   ✅ Clicked autocomplete option (partial): "${opt.textContent}"`);
                          return true;
                        }
                      }
                    }
                    return false;
                  }, { value: fieldData.value });

                  if (clicked) {
                    console.log('   ✅ Autocomplete option clicked');
                  } else {
                    console.log('   ⚠️  No option clicked, pressing Tab to confirm');
                    await element.press('Tab');
                  }

                  await page.waitForTimeout(300);
                } catch (autoError: any) {
                  console.error(`   ⚠️  Autocomplete error: ${autoError.message}, using fill()`);
                  await element.fill(fieldData.value);
                }
              } else {
                await element.fill(fieldData.value);
              }

              console.log('   ✅ Filled successfully');
              fieldFound = true;
              filled++;
              break;
            }
          } catch (selectorError) {
            // Try next selector
            continue;
          }
        }

        if (!fieldFound) {
          console.log(`   ⚠️  Field not found after trying ${selectorsTried} selectors`);
          console.log(`   🔍 Label: "${fieldData.fieldLabel}"`);
          console.log(`   🔍 Key words tried: ${labelWords.join(', ')}`);

          // Last resort: try to find ANY input/select/textarea on the page that might match
          console.log('   🆘 Attempting fuzzy match on all visible fields...');
          const fuzzyMatched = await page.evaluate(({ label, value }) => {
            const labelLower = label.toLowerCase();
            const allInputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');

            for (const input of allInputs) {
              // Get all possible label sources
              const id = input.id;
              const name = (input as HTMLInputElement).name;
              const placeholder = (input as HTMLInputElement).placeholder;
              const ariaLabel = input.getAttribute('aria-label');

              let labelText = '';
              if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                labelText = label?.textContent?.trim().toLowerCase() || '';
              }
              if (!labelText) {
                const parentLabel = input.closest('label');
                labelText = parentLabel?.textContent?.trim().toLowerCase() || '';
              }

              // Combine all text sources
              const allText = [labelText, ariaLabel, placeholder, name, id]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

              console.log(`Checking: "${allText}"`);

              // Check if any word from the label matches
              if (allText.includes(labelLower) ||
                  labelLower.split(/\s+/).some(word => word.length > 3 && allText.includes(word))) {
                console.log(`FUZZY MATCH FOUND: "${allText}"`);

                // Try to fill it
                if (input.tagName === 'SELECT') {
                  // For select, just set first non-empty option as placeholder
                  return { found: true, fieldInfo: allText, canFill: false };
                } else {
                  (input as HTMLInputElement).value = value;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  return { found: true, fieldInfo: allText, canFill: true };
                }
              }
            }

            return { found: false };
          }, { label: fieldData.fieldLabel, value: fieldData.value });

          if (fuzzyMatched.found) {
            console.log(`   ✅ Fuzzy match succeeded: "${fuzzyMatched.fieldInfo}"`);
            if (fuzzyMatched.canFill) {
              filled++;
            } else {
              console.log('   ⚠️  Field found but is a select - needs manual selection');
              failed++;
            }
          } else {
            console.log('   ❌ No fuzzy match found - manual entry required');
          failed++;
          }
        }

      } catch (error: any) {
        console.error(`   ❌ Error filling field: ${error.message}`);
        failed++;
      }
    }

    console.log(`\n✅ Form re-filled: ${filled} fields filled, ${failed} failed`);

    // Step 4: NOW make browser visible by launching a new visible browser and connecting to same page
    console.log('\n🎬 Form filled! Now opening browser for user to see...');

    // Close the headless browser
    await browser.close();

    // Launch a NEW browser in visible mode and navigate to the same URL
    console.log('🌐 Launching VISIBLE browser...');
    browser = await chromium.launch({
      headless: false, // NOW visible for user
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const visibleContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const visiblePage = await visibleContext.newPage();
    console.log(`🔗 Opening visible browser at: ${session.job_url}`);
    await visiblePage.goto(session.job_url, { waitUntil: 'networkidle', timeout: 60000 });

    // Re-fill the form in the visible browser
    console.log('🎯 Re-filling form in visible browser...');
    for (const fieldData of filledFormData) {
      try {
        // Extract key words from label for better matching
        const labelWords = fieldData.fieldLabel.toLowerCase().split(/\s+/).filter(w => w.length > 3);

        const selectors = [
          // Exact aria-label match
          `input[aria-label*="${fieldData.fieldLabel}" i]`,
          `textarea[aria-label*="${fieldData.fieldLabel}" i]`,
          `select[aria-label*="${fieldData.fieldLabel}" i]`,

          // Label association (most common)
          `label:has-text("${fieldData.fieldLabel}") input`,
          `label:has-text("${fieldData.fieldLabel}") textarea`,
          `label:has-text("${fieldData.fieldLabel}") select`,

          // Partial label text match
          ...labelWords.map(word => `label:has-text("${word}") select`),
          ...labelWords.map(word => `label:has-text("${word}") input`),

          // Name attribute match
          `input[name*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `textarea[name*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `select[name*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,

          // ID attribute match
          `input[id*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `textarea[id*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,
          `select[id*="${fieldData.fieldLabel.replace(/\s+/g, '_').toLowerCase()}" i]`,

          // Placeholder match
          `input[placeholder*="${fieldData.fieldLabel}" i]`,
          `textarea[placeholder*="${fieldData.fieldLabel}" i]`,
        ];

        let selectorsTried = 0;
        let fieldFound = false;

        for (const selector of selectors) {
          try {
            selectorsTried++;
            const element = visiblePage.locator(selector).first();
            const count = await element.count();

            if (count > 0) {
              console.log(`   ✓ Found field using selector #${selectorsTried}: ${selector.substring(0, 80)}`);
              fieldFound = true;

              if (fieldData.fieldType === 'file') {
                console.log('   📎 FILE UPLOAD field detected');

                // Check if we have resume data
                if (userProfile?.resume?.fileBase64) {
                  console.log('   📄 Uploading resume file...');

                  try {
                    const fs = require('fs');
                    const path = require('path');
                    const os = require('os');

                    // Create temp file from base64
                    const tempDir = os.tmpdir();
                    const tempFilePath = path.resolve(tempDir, userProfile.resume.fileName);
                    const buffer = Buffer.from(userProfile.resume.fileBase64, 'base64');
                    fs.writeFileSync(tempFilePath, buffer);

                    console.log(`   📁 Created temp file: ${tempFilePath}`);

                    // Upload the file
                    await element.setInputFiles(tempFilePath);
                    console.log('   ✅ Resume uploaded successfully');

                    // Wait for upload to process
                    await visiblePage.waitForTimeout(2000);

                    // Clean up temp file
                    try {
                      fs.unlinkSync(tempFilePath);
                      console.log('   🗑️  Temp file cleaned up');
                    } catch (cleanupError) {
                      console.log('   ⚠️  Could not delete temp file (will be auto-deleted by OS)');
                    }
                  } catch (uploadError: any) {
                    console.error(`   ❌ File upload failed: ${uploadError.message}`);
                    console.log('   ⚠️  User will need to upload manually');
                  }
                } else {
                  console.log('   ⚠️  No resume data available - user must upload manually');
                }
                continue;
              } else if (fieldData.fieldType === 'select' || fieldData.fieldType === 'dropdown') {
                // SELECT dropdown - click the option
                console.log(`   📋 SELECT dropdown - clicking option: "${fieldData.value}"`);

                // First, click to open the dropdown
                await element.click();
                await visiblePage.waitForTimeout(500);

                // Find and click the matching option
                const clicked = await visiblePage.evaluate(({ targetValue }) => {
                  // Try to find the option by text content
                  const allOptions = document.querySelectorAll('option');

                  for (const option of allOptions) {
                    const optionText = option.textContent?.trim().toLowerCase() || '';
                    const optionValue = (option as HTMLOptionElement).value.toLowerCase();
                    const target = targetValue.toLowerCase();

                    // Exact match
                    if (optionText === target || optionValue === target) {
                      (option as HTMLElement).click();
                      console.log(`   ✅ Clicked option: "${option.textContent}"`);
                      return true;
                    }
                  }

                  // Partial match
                  for (const option of allOptions) {
                    const optionText = option.textContent?.trim().toLowerCase() || '';
                    const target = targetValue.toLowerCase();

                    if (optionText.includes(target) || target.includes(optionText)) {
                      (option as HTMLElement).click();
                      console.log(`   ✅ Clicked option (partial match): "${option.textContent}"`);
                      return true;
                    }
                  }

                  return false;
                }, { targetValue: fieldData.value });

                if (clicked) {
                  console.log('   ✅ Option clicked successfully');
                } else {
                  // Fallback to programmatic selection
                  console.log('   ⚠️  Click failed, using programmatic selection');
                  await element.evaluate((el, valueToSelect) => {
                    const select = el as HTMLSelectElement;
                    const options = Array.from(select.options);

                    for (let i = 0; i < options.length; i++) {
                      const optionText = options[i].textContent?.trim().toLowerCase() || '';
                      const optionValue = options[i].value.toLowerCase();
                      const targetValue = valueToSelect.toLowerCase();

                      if (optionText === targetValue || optionValue === targetValue ||
                          optionText.includes(targetValue) || targetValue.includes(optionText)) {
                        select.selectedIndex = i;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                      }
                    }
                  }, fieldData.value);
                  console.log('   ✅ Programmatically selected');
                }

                await visiblePage.waitForTimeout(300);
              } else if (fieldData.fieldType === 'autocomplete') {
                // Handle autocomplete fields - ALWAYS TYPE AND CLICK
                console.log(`   🔍 AUTOCOMPLETE field - type and click option`);

                try {
                  // Clear and type to trigger dropdown
                  await element.clear();
                  await visiblePage.waitForTimeout(200);
                  await element.type(fieldData.value, { delay: 50 });
                  console.log(`   ⌨️  Typed: "${fieldData.value}"`);
                  await visiblePage.waitForTimeout(1000); // Wait for dropdown

                  // Try to click matching option from dropdown
                  const clicked = await visiblePage.evaluate(({ value }) => {
                    const optionSelectors = [
                      '[role="listbox"] [role="option"]',
                      '[role="option"]',
                      '.autocomplete-option',
                      '.autocomplete-suggestion',
                      '.autocomplete-item',
                      '[class*="option"]',
                      '[class*="suggestion"]',
                      '[class*="dropdown"] li',
                      '[class*="menu"] li',
                      'li[role="option"]',
                      'div[role="option"]',
                      '.MuiAutocomplete-option',
                    ];

                    for (const sel of optionSelectors) {
                      const options = document.querySelectorAll(sel);
                      for (const opt of options) {
                        const optText = opt.textContent?.trim().toLowerCase() || '';
                        const target = value.toLowerCase();
                        const isVisible = opt.offsetParent !== null;

                        // Exact match
                        if (isVisible && optText === target) {
                          (opt as HTMLElement).click();
                          console.log(`   ✅ Clicked autocomplete option: "${opt.textContent}"`);
                          return true;
                        }
                      }
                    }

                    // Partial match
                    for (const sel of optionSelectors) {
                      const options = document.querySelectorAll(sel);
                      for (const opt of options) {
                        const optText = opt.textContent?.trim().toLowerCase() || '';
                        const target = value.toLowerCase();
                        const isVisible = opt.offsetParent !== null;

                        if (isVisible && (optText.includes(target) || target.includes(optText))) {
                          (opt as HTMLElement).click();
                          console.log(`   ✅ Clicked autocomplete option (partial): "${opt.textContent}"`);
                          return true;
                        }
                      }
                    }
                    return false;
                  }, { value: fieldData.value });

                  if (clicked) {
                    console.log('   ✅ Autocomplete option clicked');
                  } else {
                    console.log('   ⚠️  No option clicked, pressing Tab to confirm');
                    await element.press('Tab');
                  }

                  await visiblePage.waitForTimeout(300);
                } catch (autoError: any) {
                  console.error(`   ⚠️  Autocomplete error: ${autoError.message}, using fill()`);
                  await element.fill(fieldData.value);
                }
              } else {
                await element.fill(fieldData.value);
              }
              break;
            }
          } catch {
            continue;
          }
        }

        // If field not found, try fuzzy matching
        if (!fieldFound) {
          console.log(`   ⚠️  Field not found after trying ${selectorsTried} selectors`);
          console.log(`   🔍 Label: "${fieldData.fieldLabel}"`);

          // Extract key words for logging
          const labelWords = fieldData.fieldLabel.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          console.log(`   🔍 Key words tried: ${labelWords.join(', ')}`);

          // Last resort: fuzzy match
          console.log('   🆘 Attempting fuzzy match on all visible fields...');
          const fuzzyMatched = await visiblePage.evaluate(({ label, value }) => {
            const labelLower = label.toLowerCase();
            const allInputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');

            for (const input of allInputs) {
              const id = input.id;
              const name = (input as HTMLInputElement).name;
              const placeholder = (input as HTMLInputElement).placeholder;
              const ariaLabel = input.getAttribute('aria-label');

              let labelText = '';
              if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                labelText = label?.textContent?.trim().toLowerCase() || '';
              }
              if (!labelText) {
                const parentLabel = input.closest('label');
                labelText = parentLabel?.textContent?.trim().toLowerCase() || '';
              }

              const allText = [labelText, ariaLabel, placeholder, name, id]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

              console.log(`Checking: "${allText}"`);

              if (allText.includes(labelLower) ||
                  labelLower.split(/\s+/).some(word => word.length > 3 && allText.includes(word))) {
                console.log(`FUZZY MATCH FOUND: "${allText}"`);

                if (input.tagName === 'SELECT') {
                  return { found: true, fieldInfo: allText, canFill: false };
                } else {
                  (input as HTMLInputElement).value = value;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  return { found: true, fieldInfo: allText, canFill: true };
                }
              }
            }

            return { found: false };
          }, { label: fieldData.fieldLabel, value: fieldData.value });

          if (fuzzyMatched.found) {
            console.log(`   ✅ Fuzzy match succeeded: "${fuzzyMatched.fieldInfo}"`);
          } else {
            console.log('   ❌ No fuzzy match found - will need manual entry');
          }
        }
      } catch (error: any) {
        // Continue filling other fields
      }
    }

    console.log('👀 BROWSER IS NOW VISIBLE WITH FILLED FORM!');
    console.log('📝 User can review and submit manually');

    // Enable scrolling and ensure page is scrollable
    console.log('🎨 Enabling scrolling functionality...');
    await visiblePage.evaluate(() => {
      // Remove any overflow:hidden that might prevent scrolling
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';

      // Remove any fixed positioning on body
      document.body.style.position = 'static';

      // Ensure height is set properly
      if (document.body.style.height === '100vh' || document.body.style.height === '100%') {
        document.body.style.height = 'auto';
      }

      // Scroll to top to start
      window.scrollTo(0, 0);

      console.log('✅ Scrolling enabled');
    });

    // Add form submission monitoring with localStorage tracking
    console.log('🎯 Adding form submission monitoring...');
    await visiblePage.evaluate((sessionId) => {
      // Store session ID for tracking
      localStorage.setItem('resumemax_session_id', sessionId);
      localStorage.setItem('resumemax_session_status', 'reviewing');

      // Function to mark as submitted
      const markAsSubmitted = () => {
        localStorage.setItem('resumemax_session_status', 'submitted');
        localStorage.setItem('resumemax_submitted_at', new Date().toISOString());
        console.log('✅ Application marked as submitted in localStorage');
        
        // Show visual confirmation
        const notification = document.createElement('div');
        notification.innerHTML = '✅ Application Submitted! Status will update in ResumeMax dashboard.';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: slideIn 0.3s ease-out;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
          notification.remove();
          style.remove();
        }, 5000);
      };

      // Monitor form submissions
      const forms = document.querySelectorAll('form');
      console.log(`🔍 Found ${forms.length} forms to monitor`);

      forms.forEach((form, index) => {
        console.log(`📝 Monitoring form ${index + 1}`);
        
        // Listen for form submission
        form.addEventListener('submit', (event) => {
          console.log(`🚀 Form ${index + 1} submitted!`);
          markAsSubmitted();
        });
      });

      // Monitor submit buttons
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button',
        '[role="button"]'
      ];
      
      const submitButtons = [];
      submitSelectors.forEach(selector => {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(button => {
          const text = (button.textContent || button.value || '').toLowerCase();
          if (text.includes('submit') || text.includes('apply') || text.includes('send') || 
              text.includes('continue') || text.includes('next') || button.type === 'submit') {
            submitButtons.push(button);
          }
        });
      });
      
      console.log(`🔍 Found ${submitButtons.length} submit buttons to monitor`);

      submitButtons.forEach((button, index) => {
        console.log(`🔘 Monitoring submit button ${index + 1}: "${button.textContent || button.value}"`);
        
        button.addEventListener('click', (event) => {
          // Wait a bit to see if form submission happens
          setTimeout(() => {
            console.log(`🚀 Submit button ${index + 1} clicked!`);
            markAsSubmitted();
          }, 1000);
        });
      });

      // Monitor for navigation away from page (another indicator of submission)
      let navigationTimeout;
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function(...args) {
        console.log('🔄 Navigation detected via pushState');
        clearTimeout(navigationTimeout);
        navigationTimeout = setTimeout(() => {
          markAsSubmitted();
        }, 2000);
        return originalPushState.apply(history, args);
      };

      history.replaceState = function(...args) {
        console.log('🔄 Navigation detected via replaceState');
        clearTimeout(navigationTimeout);
        navigationTimeout = setTimeout(() => {
          markAsSubmitted();
        }, 2000);
        return originalReplaceState.apply(history, args);
      };

      window.addEventListener('beforeunload', () => {
        console.log('🚪 Page unloading - likely submitted');
        markAsSubmitted();
      });

      // Add a manual "Mark as Submitted" button for edge cases
      const manualButton = document.createElement('button');
      manualButton.innerHTML = '✅ Mark as Submitted';
      manualButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: background-color 0.2s;
      `;
      
      manualButton.addEventListener('click', markAsSubmitted);
      manualButton.addEventListener('mouseenter', () => {
        manualButton.style.background = '#2563eb';
      });
      manualButton.addEventListener('mouseleave', () => {
        manualButton.style.background = '#3b82f6';
      });
      
      document.body.appendChild(manualButton);

      console.log('✅ Form submission monitoring active with localStorage tracking');
    }, sessionId);

    console.log('✅ Scrolling enabled in visible browser');
    console.log('⚠️  Browser will stay open - DO NOT close it from server');

    // DON'T close browser - leave it open for user
    // DON'T await the response - return immediately

    // Update session status
    await supabase
      .from('auto_apply_sessions')
      .update({
        status: 'awaiting_review',
      })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      message: sessionExtended 
        ? 'Session extended! Browser opened with pre-filled form. Please review and submit!'
        : 'Browser opened with pre-filled form. Please review and submit!',
      fieldsFilled: filled,
      fieldsFailed: failed,
      totalFields: filledFormData.length,
      browserOpen: true,
      sessionExtended: sessionExtended,
    });

  } catch (error: any) {
    console.error('❌ === Re-fill Error ===');
    console.error('Error:', error);

    // Close browser on error
    if (browser) {
      await browser.close().catch(() => {});
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to re-fill application',
    }, { status: 500 });
  }
}
