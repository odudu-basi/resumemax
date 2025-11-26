import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chromium, Browser, Page } from 'playwright';
import { universalFormFiller, UserProfile } from '@/src/lib/universal-form-filler';

// Force Node.js runtime
export const runtime = 'nodejs';

// Request schema
const UniversalApplySchema = z.object({
  url: z.string().url(),
  userProfile: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string(),

    location: z.object({
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    }).optional(),

    resume: z.object({
      fileName: z.string(),
      fileBase64: z.string().optional(),
      mimeType: z.string().optional(),
      content: z.string().optional(),
    }).optional(),

    coverLetter: z.string().optional(),
    linkedinUrl: z.string().optional(),
    portfolioUrl: z.string().optional(),
    websiteUrl: z.string().optional(),

    demographics: z.object({
      race: z.string().optional(),
      ethnicity: z.string().optional(),
      gender: z.string().optional(),
      preferredName: z.string().optional(),
      veteranStatus: z.string().optional(),
      disabilityStatus: z.string().optional(),
      pronouns: z.string().optional(),
    }).optional(),

    workAuthorization: z.object({
      visaStatus: z.string().optional(),
      requiresSponsorship: z.boolean().optional(),
      authorizedToWork: z.boolean().optional(),
      availableStartDate: z.string().optional(),
    }).optional(),

    education: z.object({
      degree: z.string().optional(),
      school: z.string().optional(),
      graduationYear: z.string().optional(),
      major: z.string().optional(),
      gpa: z.string().optional(),
    }).optional(),

    experience: z.object({
      yearsOfExperience: z.string().optional(),
      currentCompany: z.string().optional(),
      currentTitle: z.string().optional(),
    }).optional(),

    applicationData: z.object({
      careerHighlight: z.string().optional(),
      salaryExpectation: z.string().optional(),
      noticePeriod: z.string().optional(),
      referralSource: z.string().optional(),
      whyJoin: z.string().optional(),
    }).optional(),

    customFields: z.record(z.string()).optional(),
  }),

  options: z.object({
    submitForm: z.boolean().optional().default(true),
    handleMultiStep: z.boolean().optional().default(true),
    maxSteps: z.number().optional().default(10),
    recordVideo: z.boolean().optional().default(true),
  }).optional(),
});

export async function POST(request: NextRequest) {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('🚀 === Universal Form Filler Started ===');

    const body = await request.json();
    const application = UniversalApplySchema.parse(body);

    console.log(`📄 Target URL: ${application.url}`);

    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await universalFormFiller.launchBrowser();

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      // Enable screen recording if requested
      ...(application.options?.recordVideo && {
        recordVideo: {
          dir: './public/recordings/',
          size: { width: 1920, height: 1080 }
        }
      })
    });

    page = await context.newPage();

    // Navigate to the URL
    console.log('📄 Navigating to application page...');
    let navigationSuccess = false;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 Navigation attempt ${attempt}/3...`);
        await page.goto(application.url, {
          waitUntil: 'networkidle',
          timeout: 45000
        });
        navigationSuccess = true;
        console.log('✅ Navigation successful');
        break;
      } catch (error: any) {
        lastError = error;
        console.log(`❌ Attempt ${attempt} failed:`, error.message);
        if (attempt < 3) {
          console.log('⏳ Waiting 5 seconds before retry...');
          await page.waitForTimeout(5000);
        }
      }
    }

    if (!navigationSuccess) {
      throw new Error(`Failed to navigate after 3 attempts. Last error: ${lastError?.message}`);
    }

    // Fill the form
    console.log('\n🤖 Starting intelligent form filling...');
    const result = await universalFormFiller.fillForm(
      page,
      application.userProfile as UserProfile,
      {
        submitForm: application.options?.submitForm ?? true,
        handleMultiStep: application.options?.handleMultiStep ?? true,
        maxSteps: application.options?.maxSteps ?? 10,
      }
    );

    // Save video if enabled
    let videoPath: string | undefined;
    if (application.options?.recordVideo) {
      try {
        const videoFilePath = await page.video()?.path();
        if (videoFilePath) {
          const fs = require('fs');
          const path = require('path');
          const videoFileName = `universal-apply-${Date.now()}.webm`;
          const publicVideoPath = `./public/recordings/${videoFileName}`;

          const recordingsDir = path.dirname(publicVideoPath);
          if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
          }

          // Wait for video to finish writing
          await page.waitForTimeout(2000);
          fs.copyFileSync(videoFilePath, publicVideoPath);
          videoPath = `/recordings/${videoFileName}`;
          console.log('🎥 Recording saved:', videoPath);
        }
      } catch (videoError) {
        console.log('⚠️ Could not save recording:', videoError);
      }
    }

    // Take final screenshot
    let screenshotPath: string | undefined;
    try {
      screenshotPath = `form-final-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('📸 Screenshot saved:', screenshotPath);
    } catch (screenshotError) {
      console.log('⚠️ Could not save screenshot:', screenshotError);
    }

    console.log('\n✅ === Form Filling Complete ===');

    // Return result
    return NextResponse.json({
      success: result.success,
      message: result.success
        ? 'Form filled and submitted successfully!'
        : 'Form filling completed with errors',
      fieldsFilled: result.fieldsFilled,
      fieldsAttempted: result.fieldsAttempted,
      successRate: result.fieldsAttempted > 0
        ? Math.round((result.fieldsFilled / result.fieldsAttempted) * 100)
        : 0,
      fieldResults: result.fieldResults,
      currentStep: result.currentStep,
      hasNextStep: result.hasNextStep,
      errors: result.errors,
      videoPath,
      screenshotPath,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ === Universal Form Filling Error ===');
    console.error('Error:', error);

    // Take error screenshot
    let screenshotPath: string | undefined;
    if (page) {
      try {
        screenshotPath = `error-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (e) {
        console.log('Could not save error screenshot:', e);
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.issues,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Form filling failed',
      message: error.message || 'An unexpected error occurred',
      screenshotPath,
    }, { status: 500 });

  } finally {
    // Clean up
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed');
    }
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Universal Form Filler API',
    version: '1.0',
    description: 'AI-powered form filling for ANY website using Claude 3.5 Sonnet Vision',
    features: [
      'Works on any website (not just Greenhouse)',
      'Intelligent field detection using Claude Vision',
      'Fuzzy matching for 100+ field types',
      'Multi-step form support',
      'Auto-retry on failures',
      'Cookie banner handling',
      'Screen recording',
      'Detailed field-level reporting',
    ],
    usage: {
      method: 'POST',
      endpoint: '/api/universal-apply',
      body: {
        url: 'Full URL of the application page',
        userProfile: {
          firstName: 'string (required)',
          lastName: 'string (required)',
          email: 'string (required)',
          phone: 'string (required)',
          location: {
            address: 'string (optional)',
            city: 'string (optional)',
            state: 'string (optional)',
            zipCode: 'string (optional)',
            country: 'string (optional)',
          },
          resume: {
            fileName: 'string',
            fileBase64: 'string (base64 encoded file)',
            mimeType: 'string (e.g., application/pdf)',
          },
          coverLetter: 'string (optional)',
          linkedinUrl: 'string (optional)',
          portfolioUrl: 'string (optional)',
          demographics: '... (see schema)',
          workAuthorization: '... (see schema)',
          education: '... (see schema)',
          experience: '... (see schema)',
          applicationData: '... (see schema)',
          customFields: 'object (optional) - any additional fields',
        },
        options: {
          submitForm: 'boolean (default: true)',
          handleMultiStep: 'boolean (default: true)',
          maxSteps: 'number (default: 10)',
          recordVideo: 'boolean (default: true)',
        },
      },
    },
    examples: {
      basic: {
        url: 'https://company.com/careers/apply',
        userProfile: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1-234-567-8900',
        },
      },
    },
  });
}
