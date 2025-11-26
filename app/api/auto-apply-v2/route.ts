import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chromium, Browser, Page } from 'playwright';
import { getConfig } from '@/src/lib/env';
import { visionAnalyzer } from '../../../src/lib/vision-ai';
import { hybridVisionAI } from '../../../src/lib/hybrid-vision-ai';

// Force Node.js runtime
export const runtime = 'nodejs';

// Get configuration
const config = getConfig();

// Request schema for auto-apply
const AutoApplySchema = z.object({
  jobId: z.string(),
  companyId: z.string(),
  jobTitle: z.string(),
  jobUrl: z.string(),
  userProfile: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string(),
    resume: z.object({
      fileName: z.string(),
      content: z.string().optional(), // Fallback resume text content
      fileBase64: z.string().optional(), // Base64-encoded resume file
      mimeType: z.string().optional(), // e.g., application/pdf
    }),
    coverLetter: z.string().optional(),
    linkedinUrl: z.string().optional(),
    portfolioUrl: z.string().optional(),
    location: z.object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      address: z.string().optional()
    }).optional(),
    // Demographic information for job applications
    demographics: z.object({
      race: z.string().optional(),
      ethnicity: z.string().optional(),
      gender: z.string().optional(),
      preferredName: z.string().optional(),
      veteranStatus: z.string().optional(),
      disabilityStatus: z.string().optional(),
      pronouns: z.string().optional()
    }).optional(),
    // Work authorization and legal status
    workAuthorization: z.object({
      visaStatus: z.string().optional(),
      requiresSponsorship: z.boolean().optional(),
      authorizedToWork: z.boolean().optional(),
      availableStartDate: z.string().optional()
    }).optional(),
    // Additional application data
    applicationData: z.object({
      careerHighlight: z.string().optional(),
      salaryExpectation: z.string().optional(),
      noticePeriod: z.string().optional()
    }).optional()
  })
});

interface FieldError {
  fieldName: string;
  fieldLabel: string;
  reason: 'missing_value' | 'field_not_found' | 'validation_failed' | 'required_but_empty';
  attemptedValue?: string;
  suggestions?: string[];
}

interface ApplicationResult {
  jobId: string;
  jobUrl: string;
  status: 'success' | 'failed' | 'duplicate' | 'captcha_required' | 'manual_required';
  method: 'api' | 'browser' | 'none';
  message: string;
  timestamp: string;
  errors?: string[];
  confirmationId?: string;
  screenshotPath?: string;
  videoPath?: string;
  fieldErrors?: FieldError[];
  filledFields?: string[];
  missingFields?: string[];
  stats?: {
    method: string;
    totalFields: number;
    mappedFields: number;
    highConfidenceFields: number;
    formComplexity: string;
    estimatedFillTime: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Enhanced Auto Apply Started ===');

    const body = await request.json();
    console.log('Request body received');
    
    const application = AutoApplySchema.parse(body);
    console.log('Schema validation passed');

    console.log(`Auto-applying to: ${application.jobTitle} at ${application.companyId}`);

    // Step 1: Try API submission first (fastest method)
    console.log('🚀 Attempting API submission...');
    const apiResult = await attemptAPISubmission(application);
    
    if (apiResult.status === 'success') {
      console.log('✅ API submission successful');
      return NextResponse.json({
        success: true,
        method: 'api',
        message: 'Application submitted successfully via API!',
        details: apiResult.message,
        confirmationId: apiResult.confirmationId,
        submittedAt: apiResult.timestamp,
        fieldErrors: apiResult.fieldErrors || [],
        filledFields: apiResult.filledFields || [],
        missingFields: apiResult.missingFields || []
      });
    }

    console.log('⚠️ API submission failed, trying browser automation...');

    // Step 2: Fallback to browser automation
    console.log('🌐 Attempting browser automation...');
    const browserResult = await attemptBrowserSubmission(application);

    if (browserResult.status === 'success') {
      console.log('✅ Browser submission successful');
      return NextResponse.json({
        success: true,
        method: 'browser',
        message: 'Application submitted successfully via browser automation!',
        details: browserResult.message,
        confirmationId: browserResult.confirmationId,
        submittedAt: browserResult.timestamp,
        fieldErrors: browserResult.fieldErrors || [],
        filledFields: browserResult.filledFields || [],
        missingFields: browserResult.missingFields || [],
        videoPath: (browserResult as any).videoPath
      });
    }

    // Both methods failed
    console.log('❌ Both API and browser methods failed');
    return NextResponse.json({
      success: false,
      error: 'Auto-apply failed',
      message: 'Both API and browser automation failed. Please apply manually.',
      fallbackUrl: application.jobUrl,
      details: `API Error: ${apiResult.message}. Browser Error: ${browserResult.message}`,
      errors: [...(apiResult.errors || []), ...(browserResult.errors || [])],
      screenshotPath: browserResult.screenshotPath,
      videoPath: (browserResult as any).videoPath,
      fieldErrors: [...(apiResult.fieldErrors || []), ...(browserResult.fieldErrors || [])],
      filledFields: browserResult.filledFields || [],
      missingFields: browserResult.missingFields || []
    }, { status: 400 });

  } catch (error: any) {
    console.error('=== Auto Apply Error ===');
    console.error('Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid application data',
        details: error.issues,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Auto-apply failed',
      message: error.message || 'An unexpected error occurred during application submission'
    }, { status: 500 });
  }
}

/**
 * Attempt API submission to Greenhouse
 */
async function attemptAPISubmission(application: any): Promise<ApplicationResult> {
  try {
    console.log('📡 Fetching job details from Greenhouse API...');
    
    // Build application URL using Greenhouse API
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${application.companyId}/jobs/${application.jobId}`;
    
    const jobResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (!jobResponse.ok) {
      throw new Error(`Failed to fetch job details: ${jobResponse.status}`);
    }

    const jobData = await jobResponse.json();
    console.log('✅ Job details fetched');

    // Check if job has a public application form
    if (!jobData.application_url) {
      throw new Error('Job does not have a public application form');
    }

    console.log('📝 Building application form data...');
    
  // Build form data for submission
    const formData = new FormData();
    formData.append('email', application.userProfile.email);
    formData.append('first_name', application.userProfile.firstName);
    formData.append('last_name', application.userProfile.lastName);
    formData.append('phone', application.userProfile.phone);

    // Add location if available
    if (application.userProfile.location?.city) {
      formData.append('location', application.userProfile.location.city);
    }
    if (application.userProfile.location?.address) {
      formData.append('address', application.userProfile.location.address);
    }
    if (application.userProfile.location?.state) {
      formData.append('state', application.userProfile.location.state);
    }

    // Add optional fields
    if (application.userProfile.linkedinUrl) {
      formData.append('linkedin_url', application.userProfile.linkedinUrl);
    }
    if (application.userProfile.portfolioUrl) {
      formData.append('website', application.userProfile.portfolioUrl);
    }

    // Add demographic information
    if (application.userProfile.demographics?.race) {
      formData.append('race', application.userProfile.demographics.race);
    }
    if (application.userProfile.demographics?.ethnicity) {
      formData.append('ethnicity', application.userProfile.demographics.ethnicity);
    }
    if (application.userProfile.demographics?.gender) {
      formData.append('gender', application.userProfile.demographics.gender);
    }
    if (application.userProfile.demographics?.preferredName) {
      formData.append('preferred_name', application.userProfile.demographics.preferredName);
    }
    if (application.userProfile.demographics?.veteranStatus) {
      formData.append('veteran_status', application.userProfile.demographics.veteranStatus);
    }
    if (application.userProfile.demographics?.disabilityStatus) {
      formData.append('disability_status', application.userProfile.demographics.disabilityStatus);
    }
    if (application.userProfile.demographics?.pronouns) {
      formData.append('pronouns', application.userProfile.demographics.pronouns);
    }

    // Add work authorization information
    if (application.userProfile.workAuthorization?.visaStatus) {
      formData.append('visa_status', application.userProfile.workAuthorization.visaStatus);
    }
    if (application.userProfile.workAuthorization?.requiresSponsorship !== undefined) {
      formData.append('requires_sponsorship', application.userProfile.workAuthorization.requiresSponsorship.toString());
    }
    if (application.userProfile.workAuthorization?.authorizedToWork !== undefined) {
      formData.append('authorized_to_work', application.userProfile.workAuthorization.authorizedToWork.toString());
    }
    if (application.userProfile.workAuthorization?.availableStartDate) {
      formData.append('available_start_date', application.userProfile.workAuthorization.availableStartDate);
    }

    // Add additional application data
    if (application.userProfile.applicationData?.careerHighlight) {
      formData.append('career_highlight', application.userProfile.applicationData.careerHighlight);
    }
    if (application.userProfile.applicationData?.salaryExpectation) {
      formData.append('salary_expectation', application.userProfile.applicationData.salaryExpectation);
    }
    if (application.userProfile.applicationData?.noticePeriod) {
      formData.append('notice_period', application.userProfile.applicationData.noticePeriod);
    }

  // Add resume file if provided (preferred)
  if (application.userProfile.resume.fileBase64) {
    try {
      const buffer = Buffer.from(application.userProfile.resume.fileBase64, 'base64');
      const mime = application.userProfile.resume.mimeType || 'application/pdf';
      const blob = new Blob([buffer], { type: mime });
      formData.append('resume', blob, application.userProfile.resume.fileName || 'resume.pdf');
    } catch (e) {
      console.log('Failed to attach resume file, falling back to text content');
      if (application.userProfile.resume.content) {
        const resumeBlob = new Blob([application.userProfile.resume.content], { type: 'text/plain' });
        formData.append('resume', resumeBlob, application.userProfile.resume.fileName || 'resume.txt');
      }
    }
  } else if (application.userProfile.resume.content) {
    // Fallback: attach text content if file not available
    const resumeBlob = new Blob([application.userProfile.resume.content], { type: 'text/plain' });
    formData.append('resume', resumeBlob, application.userProfile.resume.fileName || 'resume.txt');
  }

    // Add cover letter if provided
    if (application.userProfile.coverLetter) {
      formData.append('cover_letter', application.userProfile.coverLetter);
    }

    console.log('🚀 Submitting application via API...');

    // Submit application
    const submitResponse = await fetch(jobData.application_url, {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': application.jobUrl,
      }
    });

    if (submitResponse.ok || submitResponse.status === 302) {
      // Success or redirect (common for successful submissions)
      return {
        jobId: application.jobId,
        jobUrl: application.jobUrl,
        status: 'success',
        method: 'api',
        message: 'Application submitted successfully via Greenhouse API',
        timestamp: new Date().toISOString(),
        confirmationId: `api_${Date.now()}`
      };
    } else {
      const errorText = await submitResponse.text();
      throw new Error(`API submission failed: ${submitResponse.status} - ${errorText.substring(0, 200)}`);
    }

  } catch (error: any) {
    console.log('❌ API submission failed:', error.message);
    
    return {
      jobId: application.jobId,
      jobUrl: application.jobUrl,
      status: 'failed',
      method: 'api',
      message: `API submission failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      errors: [error.message]
    };
  }
}

/**
 * Attempt browser automation submission
 */
async function attemptBrowserSubmission(application: any): Promise<ApplicationResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('🌐 Launching browser for automation...');
    
    // Launch browser with enhanced configuration and screen recording
    browser = await chromium.launch({
      headless: true, // Always headless - no visible browser window
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-proxy-server', // Disable proxy usage
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--single-process',
        '--window-size=1280,720' // Fixed window size for consistent recording
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true, // Ignore SSL certificate errors
      bypassCSP: true, // Bypass Content Security Policy
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      // Enable screen recording
      recordVideo: {
        dir: './public/recordings/',
        size: { width: 1280, height: 720 }
      }
    });

    page = await context.newPage();

    console.log('📄 Navigating to job page...');
    
    // Try navigation with retries and better error handling
    let navigationSuccess = false;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 Navigation attempt ${attempt}/3 to: ${application.jobUrl}`);
        
        await page.goto(application.jobUrl, { 
          waitUntil: 'networkidle', 
          timeout: 45000 // Increased timeout
        });
        
        navigationSuccess = true;
        console.log('✅ Navigation successful');
        break;
        
      } catch (error: any) {
        lastError = error;
        console.log(`❌ Navigation attempt ${attempt} failed:`, error.message);
        
        if (attempt < 3) {
          console.log(`⏳ Waiting 5 seconds before retry...`);
          await page.waitForTimeout(5000);
        }
      }
    }
    
    if (!navigationSuccess) {
      throw new Error(`Failed to navigate to job page after 3 attempts. Last error: ${lastError?.message}`);
    }

    // Handle cookies immediately after page load
    await handleCookies(page);

    // Try Vision AI first for Apply button detection
    console.log('🤖 Attempting to find Apply button with Vision AI...');
    let applyButtonFound = await visionAnalyzer.findAndClickApplyButtonWithVision(page);
    
    if (!applyButtonFound) {
      console.log('🔍 Vision AI failed, falling back to scrolling search...');
      applyButtonFound = await findAndClickApplyButton(page);
    }
    
    if (!applyButtonFound) {
      throw new Error('Could not find apply button with either Vision AI or traditional scrolling');
    }

    // Wait for application form to load
    await page.waitForLoadState('networkidle');
    console.log('📝 Application form loaded');

    // Handle cookies again on form page
    await handleCookies(page);

    // Fill out the application form using Hybrid DOM + Vision AI
    console.log('🤖 Filling out application form with Hybrid DOM + Vision AI...');

    // Try Hybrid approach first (DOM + Vision AI)
    const hybridAnalysis = await hybridVisionAI.analyzeForm(page, application.userProfile);
    const hybridResult = await hybridVisionAI.fillFormWithHybridData(page, hybridAnalysis);
    
    // Convert hybrid results to match expected format
    const fieldResults: Array<{ success: boolean; fieldName: string; fieldLabel: string; reason?: string; attemptedValue?: string }> = 
      hybridResult.fieldResults.map(result => ({
        success: result.success,
        fieldName: result.fieldPurpose.toLowerCase().replace(/\s+/g, '_'),
        fieldLabel: result.fieldPurpose,
        reason: result.reason
      }));

    console.log(`🎯 Hybrid Analysis Results: ${hybridResult.fieldsSuccessful}/${hybridResult.fieldsAttempted} fields filled`);
    console.log(`📊 Analysis Stats: ${hybridAnalysis.stats.highConfidenceFields} high confidence, ${hybridAnalysis.stats.requiresManualReview.length} need review`);
    
    // If Hybrid approach didn't fill enough fields, fall back to traditional selectors for critical fields
    if (hybridResult.fieldsSuccessful < 3) {
      console.log('🔄 Hybrid approach filled too few fields, adding traditional fallback...');

    // Fill basic fields (REQUIRED) - using more flexible selectors
    fieldResults.push(await fillFieldIfExists(page, 'input[name*="first"], input[name*="First"], input[placeholder*="first" i], input[placeholder*="First" i], label:has-text("First Name") + input, label:contains("First Name") ~ input', application.userProfile.firstName, 'First Name'));
    fieldResults.push(await fillFieldIfExists(page, 'input[name*="last"], input[name*="Last"], input[placeholder*="last" i], input[placeholder*="Last" i], label:has-text("Last Name") + input, label:contains("Last Name") ~ input', application.userProfile.lastName, 'Last Name'));
    fieldResults.push(await fillFieldIfExists(page, 'input[name*="email"], input[name*="Email"], input[type="email"], input[placeholder*="email" i], label:has-text("Email") + input, label:contains("Email") ~ input', application.userProfile.email, 'Email'));
    fieldResults.push(await fillFieldIfExists(page, 'input[name*="phone"], input[name*="Phone"], input[type="tel"], input[placeholder*="phone" i], label:has-text("Phone") + input, label:contains("Phone") ~ input', application.userProfile.phone, 'Phone'));

    // Fill location fields
    if (application.userProfile.location?.address) {
      fieldResults.push(await fillFieldIfExists(page, 'input[name*="address"], input[name*="street"], textarea[name*="address"]', application.userProfile.location.address, 'Address'));
    }
    
    if (application.userProfile.location?.state) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="state"], input[name*="state"]', application.userProfile.location.state, 'State'));
    }

    // Fill optional fields
    if (application.userProfile.linkedinUrl) {
      fieldResults.push(await fillFieldIfExists(page, 'input[name*="linkedin"], input[name*="LinkedIn"]', application.userProfile.linkedinUrl, 'LinkedIn URL'));
    }

    if (application.userProfile.portfolioUrl) {
      fieldResults.push(await fillFieldIfExists(page, 'input[name*="website"], input[name*="portfolio"]', application.userProfile.portfolioUrl, 'Portfolio/Website'));
    }

    // Fill demographic information
    if (application.userProfile.demographics?.race) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="race"], input[name*="race"]', application.userProfile.demographics.race, 'Race'));
    }

    if (application.userProfile.demographics?.ethnicity) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="ethnicity"], select[name*="hispanic"], input[name*="ethnicity"]', application.userProfile.demographics.ethnicity, 'Ethnicity'));
    }

    if (application.userProfile.demographics?.gender) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="gender"], input[name*="gender"]', application.userProfile.demographics.gender, 'Gender'));
    }

    if (application.userProfile.demographics?.preferredName) {
      fieldResults.push(await fillFieldIfExists(page, 'input[name*="preferred"], input[name*="nickname"]', application.userProfile.demographics.preferredName, 'Preferred Name'));
    }

    if (application.userProfile.demographics?.veteranStatus) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="veteran"], input[name*="veteran"]', application.userProfile.demographics.veteranStatus, 'Veteran Status'));
    }

    if (application.userProfile.demographics?.disabilityStatus) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="disability"], input[name*="disability"]', application.userProfile.demographics.disabilityStatus, 'Disability Status'));
    }

    if (application.userProfile.demographics?.pronouns) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="pronoun"], input[name*="pronoun"]', application.userProfile.demographics.pronouns, 'Pronouns'));
    }

    // Fill work authorization information
    if (application.userProfile.workAuthorization?.visaStatus) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="visa"], select[name*="authorization"], input[name*="visa"]', application.userProfile.workAuthorization.visaStatus, 'Visa Status'));
    }

    if (application.userProfile.workAuthorization?.requiresSponsorship !== undefined) {
      const sponsorshipValue = application.userProfile.workAuthorization.requiresSponsorship ? 'yes' : 'no';
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="sponsor"], input[name*="sponsor"]', sponsorshipValue, 'Requires Sponsorship'));
    }

    if (application.userProfile.workAuthorization?.authorizedToWork !== undefined) {
      const workAuthValue = application.userProfile.workAuthorization.authorizedToWork ? 'yes' : 'no';
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="authorized"], input[name*="work_auth"]', workAuthValue, 'Authorized to Work'));
    }

    if (application.userProfile.workAuthorization?.availableStartDate) {
      fieldResults.push(await fillFieldIfExists(page, 'input[name*="start"], input[name*="available"]', application.userProfile.workAuthorization.availableStartDate, 'Available Start Date'));
    }

    // Fill additional application data
    if (application.userProfile.applicationData?.careerHighlight) {
      fieldResults.push(await fillFieldIfExists(page, 'textarea[name*="highlight"], textarea[name*="achievement"], textarea[name*="experience"]', application.userProfile.applicationData.careerHighlight, 'Career Highlight'));
    }

    if (application.userProfile.applicationData?.salaryExpectation) {
      fieldResults.push(await fillFieldIfExists(page, 'input[name*="salary"], input[name*="compensation"]', application.userProfile.applicationData.salaryExpectation, 'Salary Expectation'));
    }

    if (application.userProfile.applicationData?.noticePeriod) {
      fieldResults.push(await fillFieldIfExists(page, 'select[name*="notice"], input[name*="notice"]', application.userProfile.applicationData.noticePeriod, 'Notice Period'));
    }

  // Handle resume upload if there's a file input
  const resumeInput = page.locator('input[type="file"][name*="resume"], input[type="file"][accept*="pdf"], input[type="file"][accept*="doc"]').first();
  const resumeVisible = await resumeInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (resumeVisible) {
    if (application.userProfile.resume.fileBase64) {
      try {
        const buffer = Buffer.from(application.userProfile.resume.fileBase64, 'base64');
        const payload = {
          name: application.userProfile.resume.fileName || 'resume.pdf',
          mimeType: application.userProfile.resume.mimeType || 'application/pdf',
          buffer,
        } as any; // Playwright FilePayload
        await resumeInput.setInputFiles(payload);
        console.log('📎 Resume file uploaded');
        fieldResults.push({
          success: true,
          fieldName: 'input[type="file"][name*="resume"]',
          fieldLabel: 'Resume Upload',
        });
      } catch (e) {
        console.log('Failed to upload resume file:', e);
        fieldResults.push({
          success: false,
          fieldName: 'input[type="file"][name*="resume"]',
          fieldLabel: 'Resume Upload',
          reason: 'validation_failed',
        });
      }
    } else {
      console.log('📎 Resume upload field found but no file provided');
      fieldResults.push({
        success: false,
        fieldName: 'input[type="file"][name*="resume"]',
        fieldLabel: 'Resume Upload',
        reason: 'missing_value',
      });
    }
  }

      // Fill cover letter if available
      if (application.userProfile.coverLetter) {
        fieldResults.push(await fillFieldIfExists(page, 'textarea[name*="cover"], textarea[name*="letter"]', application.userProfile.coverLetter, 'Cover Letter'));
      }
    } // End of traditional fallback

    // Wait 10 seconds after filling all fields to allow for form processing
    console.log('⏳ Waiting 10 seconds for form processing and validation...');
    await page.waitForTimeout(10000);
    console.log('✅ Wait complete, proceeding with submission');

    // Separate successful and failed fields
    const filledFields = fieldResults.filter(r => r.success).map(r => r.fieldLabel);
    const failedFields = fieldResults.filter(r => !r.success);
    const missingFields = failedFields.map(r => r.fieldLabel);

    // Build detailed field errors
    const fieldErrors: FieldError[] = failedFields.map(field => ({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      reason: (field.reason || 'field_not_found') as FieldError['reason'],
      attemptedValue: field.attemptedValue,
      suggestions: field.reason === 'field_not_found'
        ? ['This field may not exist on the application form', 'Try applying manually to complete this field']
        : []
    }));

    console.log(`📊 Field Fill Summary: ${filledFields.length} filled, ${missingFields.length} missing`);
    console.log('✅ Filled:', filledFields.join(', '));
    if (missingFields.length > 0) {
      console.log('❌ Missing:', missingFields.join(', '));
    }

    // Submit the form using Hybrid approach first
    console.log('🚀 Submitting application form...');
    
    // Try Hybrid approach for submit button
    let submitSuccess = await hybridVisionAI.submitFormWithHybridData(page, hybridAnalysis);
    
    if (!submitSuccess) {
      console.log('🔄 Hybrid submit failed, trying Vision AI...');
      submitSuccess = await visionAnalyzer.findAndClickSubmitButtonWithVision(page);
    }
    
    if (!submitSuccess) {
      console.log('🔄 Vision AI submit failed, trying traditional selectors...');
      const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), .submit-button').first();
      
      if (await submitButton.isVisible({ timeout: 5000 })) {
        await submitButton.click();
        submitSuccess = true;
        console.log('✅ Submit button clicked via traditional selector');
      }
    } else {
      console.log('✅ Submit button clicked via Hybrid/Vision AI');
    }
    
    if (!submitSuccess) {
      throw new Error('Could not find submit button with Hybrid, Vision AI, or traditional selectors');
    }
    
    // Wait for submission to complete
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check for CAPTCHA
    const captchaElements = await page.locator('.captcha, .recaptcha, [data-sitekey]').count();
    if (captchaElements > 0) {
      console.log('🤖 CAPTCHA detected - manual intervention required');
      return {
        jobId: application.jobId,
        jobUrl: application.jobUrl,
        status: 'captcha_required',
        method: 'browser',
        message: 'CAPTCHA detected. Please apply manually.',
        timestamp: new Date().toISOString(),
        errors: ['CAPTCHA verification required'],
        fieldErrors,
        filledFields,
        missingFields
      };
    }

    // Check for success indicators after submission
      const successIndicators = [
        'thank you',
        'application received',
        'successfully submitted',
        'application complete',
        'we have received your application'
      ];
      
      const pageContent = await page.textContent('body');
      const hasSuccessIndicator = successIndicators.some(indicator => 
        pageContent?.toLowerCase().includes(indicator)
      );
      
      if (hasSuccessIndicator) {
        console.log('✅ Application appears to have been submitted successfully');
      
      // Get video recording path
      let videoPath = null;
      try {
        const videoFilePath = await page.video()?.path();
        if (videoFilePath) {
          // Move video to public directory with a meaningful name
          const videoFileName = `auto-apply-${application.jobId}-${Date.now()}.webm`;
          const publicVideoPath = `./public/recordings/${videoFileName}`;
          
          // Ensure recordings directory exists
          const fs = require('fs');
          const path = require('path');
          const recordingsDir = path.dirname(publicVideoPath);
          if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
          }
          
          // Copy video file
          fs.copyFileSync(videoFilePath, publicVideoPath);
          videoPath = `/recordings/${videoFileName}`;
          console.log('🎥 Screen recording saved:', videoPath);
        }
      } catch (videoError) {
        console.log('⚠️ Could not save screen recording:', videoError);
      }
      
      // Take success screenshot to show completed application
      let screenshotPath = null;
      try {
        screenshotPath = `success-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('📸 Success screenshot saved:', screenshotPath);
      } catch (screenshotError) {
        console.log('⚠️ Could not save success screenshot:', screenshotError);
      }
      
        return {
          jobId: application.jobId,
          jobUrl: application.jobUrl,
          status: 'success',
          method: 'browser',
          message: `Application submitted successfully via hybrid DOM + Vision AI (${hybridResult.fieldsSuccessful}/${hybridResult.fieldsAttempted} fields filled)`,
          timestamp: new Date().toISOString(),
          confirmationId: `browser_${Date.now()}`,
          fieldErrors,
          filledFields,
        missingFields,
        screenshotPath: screenshotPath || undefined,
        videoPath: videoPath || undefined,
        stats: {
          method: 'hybrid_dom_vision',
          totalFields: hybridAnalysis.stats.totalFields,
          mappedFields: hybridAnalysis.stats.mappedFields,
          highConfidenceFields: hybridAnalysis.stats.highConfidenceFields,
          formComplexity: hybridAnalysis.formAnalysis.complexity,
          estimatedFillTime: hybridAnalysis.formAnalysis.estimatedFillTime
        }
        };
      } else {
        // Take screenshot before throwing error
        let screenshotPath = null;
        try {
          screenshotPath = `error-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log('📸 Error screenshot saved:', screenshotPath);
        } catch (screenshotError) {
          console.log('Could not save screenshot:', screenshotError);
        }

        const error = new Error('Could not confirm successful submission');
        (error as any).screenshotPath = screenshotPath;
        (error as any).fieldErrors = fieldErrors;
        (error as any).filledFields = filledFields;
        (error as any).missingFields = missingFields;
        throw error;
    }

  } catch (error: any) {
    console.log('❌ Browser automation failed:', error.message);

    // Take screenshot and save video for debugging (if not already taken)
    let screenshotPath = error.screenshotPath || null;
    let videoPath = null;
    
    if (!screenshotPath && page) {
      try {
        screenshotPath = `error-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('📸 Error screenshot saved:', screenshotPath);
      } catch (screenshotError) {
        console.log('Could not save screenshot:', screenshotError);
      }
    }
    
    // Save video recording for failed attempts
    if (page) {
      try {
        const videoFilePath = await page.video()?.path();
        if (videoFilePath) {
          const videoFileName = `auto-apply-failed-${application.jobId}-${Date.now()}.webm`;
          const publicVideoPath = `./public/recordings/${videoFileName}`;
          
          const fs = require('fs');
          const path = require('path');
          const recordingsDir = path.dirname(publicVideoPath);
          if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
          }
          
          fs.copyFileSync(videoFilePath, publicVideoPath);
          videoPath = `/recordings/${videoFileName}`;
          console.log('🎥 Failed attempt recording saved:', videoPath);
        }
      } catch (videoError) {
        console.log('⚠️ Could not save failed attempt recording:', videoError);
      }
    }

    return {
      jobId: application.jobId,
      jobUrl: application.jobUrl,
      status: 'failed',
      method: 'browser',
      message: `Browser automation failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      errors: [error.message],
      screenshotPath: screenshotPath,
      videoPath: videoPath || undefined,
      fieldErrors: error.fieldErrors || [],
      filledFields: error.filledFields || [],
      missingFields: error.missingFields || []
    };
  } finally {
    // Clean up browser
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed');
    }
  }
}


/**
 * Scroll through the page to find and click the Apply button
 * Returns true if found and clicked, false otherwise
 */
async function findAndClickApplyButton(page: Page): Promise<boolean> {
  console.log('🔍 Starting systematic search for Apply button...');
  
  // Scroll to top first
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  
  // Get page dimensions for scrolling
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const scrollSteps = Math.ceil(pageHeight / (viewportHeight * 0.7)); // Overlap scrolling for better coverage
  
  console.log(`📏 Page height: ${pageHeight}px, viewport: ${viewportHeight}px, will scroll in ${scrollSteps} steps`);
  
  // Define comprehensive Apply button selectors
  const applySelectors = [
    // Common Apply button patterns
    'a[href*="apply"]',
    'button:has-text("Apply")',
    'button:has-text("Apply Now")',
    'button:has-text("Apply for this job")',
    'button:has-text("Apply for this position")',
    'a:has-text("Apply")',
    'a:has-text("Apply Now")',
    'a:has-text("Apply for this job")',
    
    // Class-based selectors
    '.apply-button',
    '.application-button', 
    '.apply-now',
    '.job-apply',
    '.btn-apply',
    
    // ID-based selectors
    '#apply-button',
    '#apply-now',
    '#job-apply',
    
    // Data attribute selectors
    '[data-testid*="apply"]',
    '[data-cy*="apply"]',
    '[data-qa*="apply"]',
    
    // Role-based selectors
    '[role="button"]:has-text("Apply")',
    
    // Input/form selectors
    'input[type="submit"][value*="Apply"]',
    'input[type="button"][value*="Apply"]'
  ];
  
  // Search at each scroll position
  for (let step = 0; step <= scrollSteps; step++) {
    console.log(`📜 Searching at scroll position ${step + 1}/${scrollSteps + 1}...`);
    
    // Calculate scroll position with overlap
    const scrollY = Math.min(step * viewportHeight * 0.7, Math.max(0, pageHeight - viewportHeight));
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(1500); // Wait for content to load and animations
    
    // Try each selector at this scroll position
    for (const selector of applySelectors) {
      try {
        const elements = await page.locator(selector).all();
        
        for (const element of elements) {
          // Check if element is visible and clickable
          const isVisible = await element.isVisible().catch(() => false);
          const isEnabled = await element.isEnabled().catch(() => false);
          
          if (isVisible && isEnabled) {
            // Get element text to verify it's actually an apply button
            const elementText = await element.textContent().catch(() => '');
            const elementHref = await element.getAttribute('href').catch(() => '');
            
            // Verify this is actually an Apply button
            const isApplyButton = 
              /apply/i.test(elementText || '') || 
              /apply/i.test(elementHref || '') ||
              selector.includes('apply') ||
              selector.includes('Apply');
            
            if (isApplyButton) {
              console.log(`✅ Found Apply button with selector: ${selector}`);
              console.log(`📝 Button text: "${elementText}"`);
              console.log(`🔗 Button href: "${elementHref}"`);
              
              // Scroll element into view
              await element.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500);
              
              // Click the Apply button
              await element.click();
              console.log('🎯 Apply button clicked successfully!');
              return true;
            }
          }
        }
      } catch (error) {
        // Continue searching with other selectors
        continue;
      }
    }
  }
  
  console.log('❌ Apply button not found after searching entire page');
  return false;
}

/**
 * Helper function to fill form fields if they exist
 * Returns object with success status and field info
 */
async function fillFieldIfExists(
  page: Page,
  selector: string,
  value: string,
  fieldLabel: string
): Promise<{ success: boolean; fieldName: string; fieldLabel: string; reason?: string }> {
  try {
    console.log(`🔍 Looking for field: ${fieldLabel}`);
    
    // First try the provided selectors
    const field = page.locator(selector).first();
    const isVisible = await field.isVisible({ timeout: 1000 }).catch(() => false);

    if (isVisible) {
      await field.fill(value);
      console.log(`✅ Filled field: ${fieldLabel}`);
      return {
        success: true,
        fieldName: selector.split(',')[0].trim(),
        fieldLabel
      };
    }
    
    // If not found, try label-based approach
    console.log(`🔍 Trying label-based search for: ${fieldLabel}`);
    
    // Look for labels containing the field name and find associated input
    const labelSelectors = [
      `label:has-text("${fieldLabel}") input`,
      `label:has-text("${fieldLabel}") ~ input`,
      `label:has-text("${fieldLabel}") + input`,
      `label:contains("${fieldLabel}") input`,
      `label:contains("${fieldLabel}") ~ input`,
      `label:contains("${fieldLabel}") + input`,
      `text="${fieldLabel}" >> .. >> input`,
      `text="${fieldLabel} *" >> .. >> input`,
      `:has-text("${fieldLabel}") >> input`,
      `:has-text("${fieldLabel} *") >> input`
    ];
    
    for (const labelSelector of labelSelectors) {
      try {
        const labelField = page.locator(labelSelector).first();
        const labelIsVisible = await labelField.isVisible({ timeout: 500 }).catch(() => false);
        
        if (labelIsVisible) {
          await labelField.fill(value);
          console.log(`✅ Filled field via label: ${fieldLabel}`);
          return {
            success: true,
            fieldName: labelSelector,
            fieldLabel
          };
        }
      } catch (error) {
        continue; // Try next selector
      }
    }
    
    // If still not found, try generic input detection by position
    console.log(`🔍 Trying generic input detection for: ${fieldLabel}`);
    const allInputs = await page.locator('input[type="text"], input[type="email"], input[type="tel"], input:not([type])').all();
    
    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const isInputVisible = await input.isVisible().catch(() => false);
      const isEmpty = await input.inputValue().then(val => !val || val.trim() === '').catch(() => true);
      
      if (isInputVisible && isEmpty) {
        // Check if this input is near text that matches our field
        const elementHandle = await input.elementHandle();
        const nearbyText = elementHandle ? await page.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const elements = document.elementsFromPoint(rect.left - 100, rect.top - 30);
          return elements.map(el => el.textContent || '').join(' ');
        }, elementHandle).catch(() => '') : '';
        
        if (nearbyText.toLowerCase().includes(fieldLabel.toLowerCase().replace(' *', ''))) {
          await input.fill(value);
          console.log(`✅ Filled field via position detection: ${fieldLabel}`);
          return {
            success: true,
            fieldName: `input[${i}]`,
            fieldLabel
          };
        }
      }
    }

    console.log(`⚠️ Field not found: ${fieldLabel}`);
    return {
      success: false,
      fieldName: selector.split(',')[0].trim(),
      fieldLabel,
      reason: 'field_not_found'
    };
  } catch (error) {
    console.log(`❌ Error filling field ${fieldLabel}:`, error);
    return {
      success: false,
      fieldName: selector.split(',')[0].trim(),
      fieldLabel,
      reason: 'validation_failed'
    };
  }
}

/**
 * Helper function for dropdown/select fields
 */
async function fillSelectFieldIfExists(
  page: Page,
  selector: string,
  value: string,
  fieldLabel: string
): Promise<{ success: boolean; fieldName: string; fieldLabel: string; reason?: string }> {
  try {
    const field = page.locator(selector).first();
    const isVisible = await field.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      await field.selectOption({ label: value });
      console.log(`✅ Selected option: ${fieldLabel} = ${value}`);
      return {
        success: true,
        fieldName: selector.split(',')[0].trim(),
        fieldLabel
      };
    } else {
      console.log(`⚠️ Select field not visible: ${fieldLabel}`);
      return {
        success: false,
        fieldName: selector.split(',')[0].trim(),
        fieldLabel,
        reason: 'field_not_found'
      };
    }
  } catch (error) {
    console.log(`❌ Could not fill select field ${fieldLabel}:`, error);
    return {
      success: false,
      fieldName: selector.split(',')[0].trim(),
      fieldLabel,
      reason: 'field_not_found'
    };
  }
}

/**
 * Handle cookie consent banners aggressively
 */
async function handleCookies(page: Page) {
  try {
    console.log('🍪 Checking for cookie banners...');
    
    // Wait longer for banners to appear and load
    await page.waitForTimeout(3000);
    
    // First, try to close any modal overlays that might be blocking
    const overlaySelectors = [
      '[role="dialog"]',
      '.modal',
      '.overlay',
      '[class*="modal"]',
      '[class*="overlay"]',
      '[style*="position: fixed"]'
    ];
    
    for (const selector of overlaySelectors) {
      try {
        const overlay = page.locator(selector);
        if (await overlay.isVisible({ timeout: 500 })) {
          console.log(`🍪 Found overlay with selector: ${selector}`);
          // Look for close/accept buttons within the overlay
          const closeButtons = overlay.locator('button:has-text("Accept"), button:has-text("OK"), button:has-text("Got it"), button:has-text("Close"), button[aria-label*="close" i], button[aria-label*="accept" i]');
          const closeButton = closeButtons.first();
          if (await closeButton.isVisible({ timeout: 500 })) {
            await closeButton.click({ timeout: 2000 });
            console.log('✅ Clicked overlay close/accept button');
    await page.waitForTimeout(1000);
            return;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    const cookieSelectors = [
      // Common "Accept All" buttons
      'button:has-text("Accept All")',
      'button:has-text("Accept all")',
      'button:has-text("ACCEPT ALL")',
      'button:has-text("Accept All Cookies")',
      'button:has-text("Accept all cookies")',
      
      // Agree buttons
      'button:has-text("Agree")',
      'button:has-text("I Agree")',
      'button:has-text("I agree")',
      'button:has-text("AGREE")',
      
      // OK buttons
      'button:has-text("OK")',
      'button:has-text("Ok")',
      'button:has-text("Okay")',
      
      // Allow buttons
      'button:has-text("Allow")',
      'button:has-text("Allow All")',
      'button:has-text("Allow all")',
      
      // Continue buttons
      'button:has-text("Continue")',
      'button:has-text("Proceed")',
      
      // Common cookie banner frameworks
      'button#onetrust-accept-btn-handler',
      '.onetrust-accept-btn-handler',
      'button[data-testid="accept-all"]',
      'button[data-testid="accept-cookies"]',
      'button[aria-label*="Accept" i]',
      'button[aria-label*="Agree" i]',
      'button[title*="Accept" i]',
      
      // Enhanced selectors for various cookie banners
      'button:has-text("Accept All")',
      'button:has-text("Got it")',
      'button:has-text("Understood")',
      'button:has-text("Close")',
      'button:has-text("Dismiss")',
      
      // Generic selectors for cookie banners (more aggressive)
      '[class*="cookie"] button',
      '[class*="consent"] button', 
      '[class*="privacy"] button',
      '[class*="banner"] button',
      '[class*="notice"] button',
      '[id*="cookie"] button',
      '[id*="consent"] button',
      '[id*="privacy"] button',
      '[id*="banner"] button',
      
      // Modal and overlay buttons
      '[role="dialog"] button:has-text("Accept")',
      '[role="dialog"] button:has-text("OK")',
      '[role="dialog"] button:has-text("Got it")',
      '.modal button:has-text("Accept")',
      '.overlay button:has-text("Accept")',
      
      // Try any visible button that might be a cookie consent
      'button[style*="position: fixed"]',
      'button[style*="z-index"]',
      
      // Last resort - any button in common cookie banner positions
      'div[style*="bottom"] button',
      'div[style*="top"] button',
      'div[style*="fixed"] button',
    ];

    for (const selector of cookieSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 500 })) {
          console.log(`🍪 Found cookie button with selector: ${selector}`);
          await button.click({ timeout: 2000 });
          console.log('✅ Cookie consent accepted');
          
          // Wait for banner to disappear
          await page.waitForTimeout(1000);
          return;
        }
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }
    
    console.log('🍪 No cookie banners found');
  } catch (error) {
    console.log('🍪 Error handling cookies:', error);
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Enhanced Auto Apply API - Automated job application submission',
    version: '2.0',
    methods: ['API submission (primary)', 'Browser automation (fallback)'],
    features: [
      'Greenhouse API integration',
      'Playwright browser automation',
      'CAPTCHA detection',
      'Form field auto-detection',
      'Error screenshots',
      'Comprehensive error handling'
    ],
    usage: 'POST with job details and user profile',
    parameters: {
      jobId: 'string (required) - Greenhouse job ID',
      companyId: 'string (required) - Company identifier',
      jobTitle: 'string (required) - Job title for logging',
      jobUrl: 'string (required) - Full job URL',
      userProfile: {
        firstName: 'string (required)',
        lastName: 'string (required)', 
        email: 'string (required)',
        phone: 'string (required)',
        resume: {
          fileName: 'string (required)',
          content: 'string (optional) - Resume text content',
          fileBase64: 'string (optional) - Base64 encoded resume file',
          mimeType: 'string (optional) - File MIME type'
        },
        coverLetter: 'string (optional)',
        linkedinUrl: 'string (optional)',
        portfolioUrl: 'string (optional)',
        location: {
          city: 'string (optional)',
          state: 'string (optional)',
          country: 'string (optional)',
          address: 'string (optional)'
        },
        demographics: {
          race: 'string (optional)',
          ethnicity: 'string (optional)',
          gender: 'string (optional)',
          preferredName: 'string (optional)',
          veteranStatus: 'string (optional)',
          disabilityStatus: 'string (optional)',
          pronouns: 'string (optional)'
        },
        workAuthorization: {
          visaStatus: 'string (optional)',
          requiresSponsorship: 'boolean (optional)',
          authorizedToWork: 'boolean (optional)',
          availableStartDate: 'string (optional)'
        },
        applicationData: {
          careerHighlight: 'string (optional)',
          salaryExpectation: 'string (optional)',
          noticePeriod: 'string (optional)'
        }
      }
    }
  });
}
