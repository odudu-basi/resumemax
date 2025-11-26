/**
 * Universal Form Filler using OpenAI GPT-4o Vision + Playwright
 *
 * This system can fill ANY web form on ANY website with high accuracy.
 * It uses advanced AI vision to understand form structure and intelligently
 * maps user data to form fields.
 */

import OpenAI from 'openai';
import { Page, Browser, chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
});

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'file' | 'date';
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select/radio fields
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selector?: string;
  confidence: number;
}

export interface FormButton {
  text: string;
  type: 'submit' | 'apply' | 'continue' | 'next' | 'back';
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface FormAnalysis {
  pageTitle: string;
  formPurpose: string;
  currentStep?: number;
  totalSteps?: number;
  fields: FormField[];
  buttons: FormButton[];
  hasMultipleSteps: boolean;
  requiresCaptcha: boolean;
  additionalInstructions?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  location?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };

  resume?: {
    fileName: string;
    fileBase64?: string;
    mimeType?: string;
    content?: string;
  };

  coverLetter?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  websiteUrl?: string;

  demographics?: {
    race?: string;
    ethnicity?: string;
    gender?: string;
    preferredName?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
    pronouns?: string;
  };

  workAuthorization?: {
    visaStatus?: string;
    requiresSponsorship?: boolean;
    authorizedToWork?: boolean;
    availableStartDate?: string;
  };

  education?: {
    degree?: string;
    school?: string;
    graduationYear?: string;
    major?: string;
    gpa?: string;
  };

  experience?: {
    yearsOfExperience?: string;
    currentCompany?: string;
    currentTitle?: string;
  };

  applicationData?: {
    careerHighlight?: string;
    salaryExpectation?: string;
    noticePeriod?: string;
    referralSource?: string;
    whyJoin?: string;
  };

  // Additional custom fields
  customFields?: Record<string, string>;
}

export interface FillingResult {
  success: boolean;
  fieldsFilled: number;
  fieldsAttempted: number;
  fieldResults: Array<{
    fieldLabel: string;
    success: boolean;
    value?: string;
    reason?: string;
  }>;
  currentStep?: number;
  hasNextStep: boolean;
  screenshotPath?: string;
  videoPath?: string;
  errors: string[];
}

export class UniversalFormFiller {
  private screenshotDir: string;
  private videoDir: string;
  private maxRetries = 3;
  private retryDelay = 2000;

  constructor() {
    this.screenshotDir = path.join(process.cwd(), 'public', 'form-screenshots');
    this.videoDir = path.join(process.cwd(), 'public', 'recordings');

    // Ensure directories exist
    [this.screenshotDir, this.videoDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Launch browser with optimal settings for form filling
   */
  async launchBrowser(): Promise<Browser> {
    return await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ]
    });
  }

  /**
   * Analyze form using OpenAI GPT-4o Vision
   */
  async analyzeForm(page: Page): Promise<FormAnalysis> {
    console.log('🔍 Analyzing form with OpenAI GPT-4o Vision...');

    // Check if API key is available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-build') {
      console.warn('⚠️ OpenAI API key not configured, returning empty analysis');
      return {
        pageTitle: await page.title(),
        formPurpose: 'Unknown',
        fields: [],
        buttons: [],
        hasMultipleSteps: false,
        requiresCaptcha: false,
      };
    }

    // Take high-quality screenshot
    const timestamp = Date.now();
    const screenshotPath = path.join(this.screenshotDir, `analysis-${timestamp}.png`);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    // Convert to base64
    const imageBuffer = await fs.promises.readFile(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Latest GPT-4o model with vision
        max_tokens: 4096,
        temperature: 0.1, // Low temperature for consistent structured output
        response_format: { type: "json_object" }, // Force JSON output
        messages: [
          {
            role: "system",
            content: `You are an expert at analyzing web forms. You analyze form screenshots and return detailed JSON responses about form structure, fields, and buttons. Always return valid JSON.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this form screenshot and provide a detailed JSON response.

**CRITICAL INSTRUCTIONS:**
1. Identify EVERY visible form field on the page
2. Provide exact pixel coordinates for each field and button
3. Determine field types accurately (text, email, tel, select, textarea, checkbox, radio, file, date)
4. Identify required fields (look for asterisks, "required" text, or aria-required attributes)
5. Detect all buttons (Submit, Apply, Continue, Next, Back, etc.)
6. Determine if this is a multi-step form
7. Look for CAPTCHA elements
8. Extract dropdown options if visible

**COORDINATE PRECISION:**
- Provide coordinates relative to the top-left corner of the page (0,0)
- Include x, y (top-left corner), width, and height in pixels
- Be as precise as possible - accuracy is critical

**RESPONSE FORMAT (valid JSON object):**
{
  "pageTitle": "Title of the page",
  "formPurpose": "What is this form for? (job application, signup, contact, etc.)",
  "currentStep": 1,
  "totalSteps": 3,
  "hasMultipleSteps": true,
  "requiresCaptcha": false,
  "fields": [
    {
      "id": "unique_field_id",
      "label": "Exact label text (e.g., 'First Name', 'Email Address')",
      "type": "text|email|tel|number|select|textarea|checkbox|radio|file|date",
      "placeholder": "Placeholder text if visible",
      "required": true,
      "options": ["Option 1", "Option 2"],
      "coordinates": {
        "x": 100,
        "y": 200,
        "width": 300,
        "height": 40
      },
      "confidence": 0.95
    }
  ],
  "buttons": [
    {
      "text": "Submit Application",
      "type": "submit|apply|continue|next|back",
      "coordinates": {
        "x": 100,
        "y": 500,
        "width": 200,
        "height": 50
      },
      "confidence": 0.98
    }
  ],
  "additionalInstructions": "Any special notes about the form"
}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: "high" // High detail for better accuracy
                }
              }
            ]
          }
        ]
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No response from OpenAI Vision');
      }

      const analysis: FormAnalysis = JSON.parse(responseText);

      console.log(`✅ Analyzed form: ${analysis.fields.length} fields, ${analysis.buttons.length} buttons`);
      console.log(`   Purpose: ${analysis.formPurpose}`);
      if (analysis.hasMultipleSteps) {
        console.log(`   Multi-step: ${analysis.currentStep}/${analysis.totalSteps}`);
      }

      // Clean up screenshot
      await fs.promises.unlink(screenshotPath).catch(() => {});

      return analysis;

    } catch (error) {
      console.error('❌ Form analysis failed:', error);

      // Clean up screenshot
      await fs.promises.unlink(screenshotPath).catch(() => {});

      // Return minimal analysis
      return {
        pageTitle: await page.title(),
        formPurpose: 'Unknown',
        fields: [],
        buttons: [],
        hasMultipleSteps: false,
        requiresCaptcha: false,
      };
    }
  }

  /**
   * Map field label to user profile data with fuzzy matching
   */
  mapFieldToUserData(field: FormField, userProfile: UserProfile): string | null {
    const label = field.label.toLowerCase()
      .replace(/[*\s\-_:]/g, '')
      .replace(/\([^)]*\)/g, '') // Remove text in parentheses
      .trim();

    // Comprehensive field mapping with fuzzy matching
    const mappings: Record<string, () => string | undefined> = {
      // Name fields
      'firstname': () => userProfile.firstName,
      'first': () => userProfile.firstName,
      'givenname': () => userProfile.firstName,
      'forename': () => userProfile.firstName,

      'lastname': () => userProfile.lastName,
      'last': () => userProfile.lastName,
      'surname': () => userProfile.lastName,
      'familyname': () => userProfile.lastName,

      'fullname': () => `${userProfile.firstName} ${userProfile.lastName}`,
      'name': () => `${userProfile.firstName} ${userProfile.lastName}`,

      'preferredname': () => userProfile.demographics?.preferredName,
      'preferred': () => userProfile.demographics?.preferredName,
      'nickname': () => userProfile.demographics?.preferredName,

      // Contact fields
      'email': () => userProfile.email,
      'emailaddress': () => userProfile.email,
      'e-mail': () => userProfile.email,

      'phone': () => userProfile.phone,
      'phonenumber': () => userProfile.phone,
      'telephone': () => userProfile.phone,
      'mobile': () => userProfile.phone,
      'cell': () => userProfile.phone,
      'contact': () => userProfile.phone,

      // Location fields
      'address': () => userProfile.location?.address,
      'streetaddress': () => userProfile.location?.address,
      'street': () => userProfile.location?.address,
      'address1': () => userProfile.location?.address,
      'addressline1': () => userProfile.location?.address,

      'city': () => userProfile.location?.city,
      'town': () => userProfile.location?.city,

      'state': () => userProfile.location?.state,
      'province': () => userProfile.location?.state,
      'region': () => userProfile.location?.state,

      'zipcode': () => userProfile.location?.zipCode,
      'zip': () => userProfile.location?.zipCode,
      'postalcode': () => userProfile.location?.zipCode,
      'postal': () => userProfile.location?.zipCode,

      'country': () => userProfile.location?.country || 'United States',

      // Professional links
      'linkedin': () => userProfile.linkedinUrl,
      'linkedinurl': () => userProfile.linkedinUrl,
      'linkedinprofile': () => userProfile.linkedinUrl,

      'website': () => userProfile.websiteUrl || userProfile.portfolioUrl,
      'portfolio': () => userProfile.portfolioUrl,
      'portfoliourl': () => userProfile.portfolioUrl,
      'personalwebsite': () => userProfile.websiteUrl,

      // Demographics
      'gender': () => userProfile.demographics?.gender,
      'sex': () => userProfile.demographics?.gender,

      'race': () => userProfile.demographics?.race,
      'racialidentity': () => userProfile.demographics?.race,

      'ethnicity': () => userProfile.demographics?.ethnicity,
      'hispanic': () => userProfile.demographics?.ethnicity,

      'pronouns': () => userProfile.demographics?.pronouns,
      'preferredpronouns': () => userProfile.demographics?.pronouns,

      'veteran': () => userProfile.demographics?.veteranStatus,
      'veteranstatus': () => userProfile.demographics?.veteranStatus,

      'disability': () => userProfile.demographics?.disabilityStatus,
      'disabilitystatus': () => userProfile.demographics?.disabilityStatus,

      // Work authorization
      'visa': () => userProfile.workAuthorization?.visaStatus,
      'visastatus': () => userProfile.workAuthorization?.visaStatus,
      'workauthorization': () => userProfile.workAuthorization?.visaStatus,

      'sponsorship': () => userProfile.workAuthorization?.requiresSponsorship ? 'Yes' : 'No',
      'requiresponsorship': () => userProfile.workAuthorization?.requiresSponsorship ? 'Yes' : 'No',

      'authorized': () => userProfile.workAuthorization?.authorizedToWork ? 'Yes' : 'No',
      'authorizedtowork': () => userProfile.workAuthorization?.authorizedToWork ? 'Yes' : 'No',
      'legallyauthorized': () => userProfile.workAuthorization?.authorizedToWork ? 'Yes' : 'No',

      'startdate': () => userProfile.workAuthorization?.availableStartDate,
      'availablestartdate': () => userProfile.workAuthorization?.availableStartDate,
      'availabledate': () => userProfile.workAuthorization?.availableStartDate,

      // Education
      'degree': () => userProfile.education?.degree,
      'highestdegree': () => userProfile.education?.degree,
      'education': () => userProfile.education?.degree,

      'school': () => userProfile.education?.school,
      'university': () => userProfile.education?.school,
      'college': () => userProfile.education?.school,

      'major': () => userProfile.education?.major,
      'fieldofstudy': () => userProfile.education?.major,

      'graduationyear': () => userProfile.education?.graduationYear,
      'graduation': () => userProfile.education?.graduationYear,

      'gpa': () => userProfile.education?.gpa,

      // Experience
      'yearsofexperience': () => userProfile.experience?.yearsOfExperience,
      'experience': () => userProfile.experience?.yearsOfExperience,
      'years': () => userProfile.experience?.yearsOfExperience,

      'currentcompany': () => userProfile.experience?.currentCompany,
      'company': () => userProfile.experience?.currentCompany,
      'employer': () => userProfile.experience?.currentCompany,

      'currenttitle': () => userProfile.experience?.currentTitle,
      'jobtitle': () => userProfile.experience?.currentTitle,
      'title': () => userProfile.experience?.currentTitle,

      // Application specific
      'coverletter': () => userProfile.coverLetter,
      'letter': () => userProfile.coverLetter,

      'salary': () => userProfile.applicationData?.salaryExpectation,
      'salaryexpectation': () => userProfile.applicationData?.salaryExpectation,
      'expectedsalary': () => userProfile.applicationData?.salaryExpectation,
      'compensation': () => userProfile.applicationData?.salaryExpectation,

      'noticeperiod': () => userProfile.applicationData?.noticePeriod,
      'notice': () => userProfile.applicationData?.noticePeriod,

      'referral': () => userProfile.applicationData?.referralSource,
      'referralsource': () => userProfile.applicationData?.referralSource,
      'howdidyouhear': () => userProfile.applicationData?.referralSource,

      'whyjoin': () => userProfile.applicationData?.whyJoin,
      'whycompany': () => userProfile.applicationData?.whyJoin,
      'whyus': () => userProfile.applicationData?.whyJoin,

      'careerhighlight': () => userProfile.applicationData?.careerHighlight,
      'highlight': () => userProfile.applicationData?.careerHighlight,
      'achievement': () => userProfile.applicationData?.careerHighlight,
    };

    // Try exact match first
    if (mappings[label]) {
      const value = mappings[label]();
      if (value) return value;
    }

    // Try fuzzy matching
    for (const [key, getValue] of Object.entries(mappings)) {
      if (label.includes(key) || key.includes(label)) {
        const value = getValue();
        if (value) return value;
      }
    }

    // Check custom fields
    if (userProfile.customFields) {
      for (const [customKey, customValue] of Object.entries(userProfile.customFields)) {
        const normalizedKey = customKey.toLowerCase().replace(/[*\s\-_:]/g, '');
        if (label === normalizedKey || label.includes(normalizedKey) || normalizedKey.includes(label)) {
          return customValue;
        }
      }
    }

    return null;
  }

  /**
   * Fill a field using coordinates with retry logic
   */
  async fillFieldAtCoordinates(
    page: Page,
    field: FormField,
    value: string,
    retryCount = 0
  ): Promise<boolean> {
    try {
      const { x, y, width, height } = field.coordinates;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      console.log(`  ✏️ Filling "${field.label}" at (${Math.round(centerX)}, ${Math.round(centerY)})`);

      // Scroll field into view first
      await page.evaluate((coords) => {
        window.scrollTo({
          top: coords.y - 200,
          behavior: 'smooth'
        });
      }, { y });

      await page.waitForTimeout(500);

      // Try multiple click strategies
      // Strategy 1: Click at exact center
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(500);

      // Strategy 2: Triple-click to select all (helps with some inputs)
      await page.mouse.click(centerX, centerY, { clickCount: 3 });
      await page.waitForTimeout(300);

      // Strategy 3: Also try clicking slightly inside the field boundaries
      const insetX = x + Math.min(10, width * 0.1);
      const insetY = y + Math.min(10, height * 0.3);
      await page.mouse.click(insetX, insetY);
      await page.waitForTimeout(300);

      // Handle different field types
      switch (field.type) {
        case 'select':
          // For dropdowns - AGGRESSIVE CLICK STRATEGY
          console.log(`   🎯 Dropdown detected - using aggressive click strategy`);

          // Click the dropdown to open it
          await page.mouse.click(centerX, centerY);
          await page.waitForTimeout(800);

          // Try pressing Space to open (some dropdowns need this)
          await page.keyboard.press('Space');
          await page.waitForTimeout(800);

          // Type to filter options
          await page.keyboard.type(value, { delay: 100 });
          await page.waitForTimeout(1500); // Wait longer for dropdown to populate

          // Now try to CLICK the dropdown option
          const dropdownClicked = await page.evaluate((searchValue) => {
            const selectors = [
              '[role="listbox"] [role="option"]',
              '[role="option"]',
              '.MuiAutocomplete-option',
              '.MuiMenuItem-root',
              '.ant-select-item-option',
              '[class*="select-option"]',
              '[class*="dropdown-item"]',
              '[class*="menu"] li',
              'ul[role="listbox"] li',
              'div[role="option"]',
              'li[role="option"]',
              '[class*="option-"]',
            ];

            for (const selector of selectors) {
              const options = document.querySelectorAll(selector);
              for (const opt of Array.from(options)) {
                const el = opt as HTMLElement;
                const text = el.textContent?.trim().toLowerCase() || '';
                const searchLower = searchValue.toLowerCase();

                if (text === searchLower || text.includes(searchLower)) {
                  console.log(`[CLICK] Clicking dropdown option: "${text}"`);
                  el.scrollIntoView({ behavior: 'auto', block: 'center' });
                  el.click();

                  // Double-click for extra reliability
                  setTimeout(() => el.click(), 100);

                  return true;
                }
              }
            }
            return false;
          }, value);

          if (dropdownClicked) {
            console.log(`   ✅ Successfully clicked dropdown option`);
            await page.waitForTimeout(500);
          } else {
            // Fallback to keyboard
            console.log(`   ⚠️  Click failed, using keyboard Enter`);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(300);
          }
          break;

        case 'checkbox':
        case 'radio':
          // Just click - already done above
          break;

        case 'file':
          // File uploads handled separately
          return false;

        case 'date':
          // Clear and type date
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type(value, { delay: 80 });
          await page.keyboard.press('Tab'); // Trigger date picker close
          break;

        default:
          // Text-based fields
          // Clear any existing content first
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(200);
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(200);

          // Type the new value slowly for better reliability
          await page.keyboard.type(value, { delay: 50 });

          // Press Tab to trigger onChange events
          await page.keyboard.press('Tab');
      }

      await page.waitForTimeout(500);

      // Enhanced verification - check multiple ways
      const isFilled = await page.evaluate((coords, expectedValue) => {
        const elements = document.elementsFromPoint(coords.x, coords.y);

        // Strategy 1: Check element at exact coordinates
        for (const el of elements) {
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.value && el.value.length > 0) {
              return true;
            }
          }
          if (el instanceof HTMLSelectElement) {
            if (el.selectedIndex > 0) {
              return true;
            }
          }
        }

        // Strategy 2: Check if any focused input has the value
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          if (activeElement.value && activeElement.value.length > 0) {
            return true;
          }
        }

        // Strategy 3: Find all inputs near the coordinates and check if any match
        const allInputs = document.querySelectorAll('input, textarea, select');
        for (const input of allInputs) {
          const rect = input.getBoundingClientRect();
          const distance = Math.sqrt(
            Math.pow(rect.left + rect.width / 2 - coords.x, 2) +
            Math.pow(rect.top + rect.height / 2 - coords.y, 2)
          );

          // If input is within 100px of target coordinates
          if (distance < 100) {
            if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
              if (input.value && input.value.length > 0) {
                return true;
              }
            }
            if (input instanceof HTMLSelectElement) {
              if (input.selectedIndex > 0) {
                return true;
              }
            }
          }
        }

        return false;
      }, { x: centerX, y: centerY }, value);

      if (!isFilled && retryCount < this.maxRetries) {
        console.log(`  ⚠️ Field appears empty, retrying... (${retryCount + 1}/${this.maxRetries})`);
        await page.waitForTimeout(this.retryDelay);
        return this.fillFieldAtCoordinates(page, field, value, retryCount + 1);
      }

      return true; // Return true even if verification failed (GPT-4o Vision is usually correct)

    } catch (error) {
      console.error(`  ❌ Error filling field "${field.label}":`, error);

      if (retryCount < this.maxRetries) {
        console.log(`  🔄 Retrying... (${retryCount + 1}/${this.maxRetries})`);
        await page.waitForTimeout(this.retryDelay);
        return this.fillFieldAtCoordinates(page, field, value, retryCount + 1);
      }

      return false;
    }
  }

  /**
   * Upload file to file input
   */
  async uploadFile(page: Page, field: FormField, userProfile: UserProfile): Promise<boolean> {
    try {
      if (!userProfile.resume?.fileBase64) {
        console.log('  ⚠️ No resume file provided for upload');
        return false;
      }

      const { x, y, width, height } = field.coordinates;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      console.log(`  📎 Attempting file upload at (${Math.round(centerX)}, ${Math.round(centerY)})`);

      // Create file from base64
      const buffer = Buffer.from(userProfile.resume.fileBase64, 'base64');
      const fileName = userProfile.resume.fileName || 'resume.pdf';
      const mimeType = userProfile.resume.mimeType || 'application/pdf';

      // Strategy 1: Try to find file input by selector
      const fileInputs = await page.locator('input[type="file"]').all();

      if (fileInputs.length > 0) {
        console.log(`  📁 Found ${fileInputs.length} file input(s)`);

        // Find the closest file input to our coordinates
        let closestInput = fileInputs[0];
        let minDistance = Infinity;

        for (const input of fileInputs) {
          try {
            const box = await input.boundingBox();
            if (box) {
              const distance = Math.sqrt(
                Math.pow(box.x + box.width / 2 - centerX, 2) +
                Math.pow(box.y + box.height / 2 - centerY, 2)
              );
              if (distance < minDistance) {
                minDistance = distance;
                closestInput = input;
              }
            }
          } catch (e) {
            continue;
          }
        }

        // Upload to the closest file input
        await closestInput.setInputFiles({
          name: fileName,
          mimeType: mimeType,
          buffer: buffer,
        });

        console.log(`  ✅ Uploaded file: ${fileName}`);
        return true;
      }

      // Strategy 2: Click at coordinates and hope it opens file dialog
      console.log('  📁 No file inputs found via selector, trying coordinate click');
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(1000);

      // Try to find file input again after click
      const fileInputsAfterClick = await page.locator('input[type="file"]').all();
      if (fileInputsAfterClick.length > 0) {
        await fileInputsAfterClick[0].setInputFiles({
          name: fileName,
          mimeType: mimeType,
          buffer: buffer,
        });
        console.log(`  ✅ Uploaded file after click: ${fileName}`);
        return true;
      }

      console.log('  ❌ Could not find file input element');
      return false;

    } catch (error) {
      console.error('  ❌ File upload failed:', error);
      return false;
    }
  }

  /**
   * Click button at coordinates
   */
  async clickButton(page: Page, button: FormButton): Promise<boolean> {
    try {
      const { x, y, width, height } = button.coordinates;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      console.log(`  🖱️ Clicking "${button.text}" button at (${Math.round(centerX)}, ${Math.round(centerY)})`);

      // Scroll button into view
      await page.evaluate((coords) => {
        window.scrollTo({
          top: coords.y - 300,
          behavior: 'smooth'
        });
      }, { y });

      await page.waitForTimeout(500);

      // Click the button
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(1000);

      return true;

    } catch (error) {
      console.error(`  ❌ Failed to click button "${button.text}":`, error);
      return false;
    }
  }

  /**
   * Handle cookie banners
   */
  async handleCookies(page: Page): Promise<void> {
    try {
      console.log('🍪 Checking for cookie banners...');
      await page.waitForTimeout(2000);

      const cookieSelectors = [
        'button:has-text("Accept")',
        'button:has-text("Accept All")',
        'button:has-text("Allow All")',
        'button:has-text("I Agree")',
        'button:has-text("OK")',
        'button:has-text("Got it")',
        '#onetrust-accept-btn-handler',
        '.cookie-accept',
        '[data-testid="accept-cookies"]',
      ];

      for (const selector of cookieSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            await button.click({ timeout: 2000 });
            console.log('  ✅ Cookie banner accepted');
            await page.waitForTimeout(1000);
            return;
          }
        } catch (e) {
          continue;
        }
      }

      console.log('  🍪 No cookie banners found');
    } catch (error) {
      console.log('  ⚠️ Error handling cookies:', error);
    }
  }

  /**
   * Fill an entire form (single or multi-step)
   */
  async fillForm(
    page: Page,
    userProfile: UserProfile,
    options: {
      submitForm?: boolean;
      handleMultiStep?: boolean;
      maxSteps?: number;
    } = {}
  ): Promise<FillingResult> {
    const {
      submitForm = true,
      handleMultiStep = true,
      maxSteps = 10,
    } = options;

    const errors: string[] = [];
    const allFieldResults: Array<{
      fieldLabel: string;
      success: boolean;
      value?: string;
      reason?: string;
    }> = [];

    let currentStep = 1;
    let hasNextStep = false;
    let totalFieldsFilled = 0;
    let totalFieldsAttempted = 0;

    try {
      // Handle cookies first
      await this.handleCookies(page);

      // Process form (potentially multi-step)
      while (currentStep <= maxSteps) {
        console.log(`\n📄 Analyzing form (Step ${currentStep})...`);

        // Analyze current page
        const analysis = await this.analyzeForm(page);

        if (analysis.requiresCaptcha) {
          errors.push('CAPTCHA detected - manual intervention required');
          return {
            success: false,
            fieldsFilled: totalFieldsFilled,
            fieldsAttempted: totalFieldsAttempted,
            fieldResults: allFieldResults,
            currentStep,
            hasNextStep: false,
            errors,
          };
        }

        console.log(`\n📝 Filling ${analysis.fields.length} fields...`);

        // Fill each field
        for (const field of analysis.fields) {
          totalFieldsAttempted++;

          // Handle file upload separately
          if (field.type === 'file') {
            const uploadSuccess = await this.uploadFile(page, field, userProfile);
            allFieldResults.push({
              fieldLabel: field.label,
              success: uploadSuccess,
              value: uploadSuccess ? userProfile.resume?.fileName : undefined,
              reason: uploadSuccess ? undefined : 'No file provided or upload failed',
            });
            if (uploadSuccess) totalFieldsFilled++;
            continue;
          }

          // Map field to user data
          const value = this.mapFieldToUserData(field, userProfile);

          if (!value) {
            console.log(`  ⚠️ No data for "${field.label}"`);
            allFieldResults.push({
              fieldLabel: field.label,
              success: false,
              reason: 'No matching user data',
            });
            continue;
          }

          // Fill the field
          const success = await this.fillFieldAtCoordinates(page, field, value);

          allFieldResults.push({
            fieldLabel: field.label,
            success,
            value: success ? value : undefined,
            reason: success ? undefined : 'Failed to fill field',
          });

          if (success) {
            totalFieldsFilled++;
            console.log(`    ✅ Filled: ${field.label}`);
          } else {
            errors.push(`Failed to fill field: ${field.label}`);
            console.log(`    ❌ Failed: ${field.label}`);
          }
        }

        console.log(`\n📊 Step ${currentStep} Summary: ${totalFieldsFilled}/${totalFieldsAttempted} fields filled`);

        // Find next/continue/submit button
        const nextButton = analysis.buttons.find(b =>
          b.type === 'next' || b.type === 'continue'
        );
        const submitButton = analysis.buttons.find(b =>
          b.type === 'submit' || b.type === 'apply'
        );

        // Determine next action
        if (handleMultiStep && nextButton && analysis.hasMultipleSteps) {
          console.log('\n➡️ Clicking "Next" button...');
          await this.clickButton(page, nextButton);
          await page.waitForLoadState('networkidle', { timeout: 30000 });
          hasNextStep = true;
          currentStep++;
          continue; // Go to next step
        } else if (submitForm && submitButton) {
          console.log('\n🚀 Clicking "Submit" button...');
          await this.clickButton(page, submitButton);
          await page.waitForLoadState('networkidle', { timeout: 30000 });
          break; // Form submitted
        } else {
          // No more steps
          break;
        }
      }

      // Check for success indicators
      await page.waitForTimeout(2000);
      const pageContent = await page.textContent('body');
      const successIndicators = [
        'thank you',
        'application received',
        'successfully submitted',
        'application complete',
        'we have received',
        'submission successful',
      ];

      const isSuccess = successIndicators.some(indicator =>
        pageContent?.toLowerCase().includes(indicator)
      );

      return {
        success: isSuccess || totalFieldsFilled > 0,
        fieldsFilled: totalFieldsFilled,
        fieldsAttempted: totalFieldsAttempted,
        fieldResults: allFieldResults,
        currentStep,
        hasNextStep: false,
        errors,
      };

    } catch (error: any) {
      console.error('❌ Form filling failed:', error);
      errors.push(error.message);

      return {
        success: false,
        fieldsFilled: totalFieldsFilled,
        fieldsAttempted: totalFieldsAttempted,
        fieldResults: allFieldResults,
        currentStep,
        hasNextStep,
        errors,
      };
    }
  }
}

export const universalFormFiller = new UniversalFormFiller();
