import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { detectEmailVerification, handleEmailVerification, extractCompanyDomain } from '@/src/lib/email-verification-handler';
import { uploadSessionMedia } from '@/src/lib/upload-session-media';
import { launchBrowser } from '@/src/lib/browserless';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Force Node.js runtime
export const runtime = 'nodejs';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a unique fingerprint for a field to detect changes
 */
function getFieldFingerprint(field: any) {
  const fingerprint = `${field.type}_${field.inputType || ''}_${field.id || ''}_${field.name || ''}_${field.label || ''}_${field.placeholder || ''}`;
  return fingerprint;
}

/**
 * Compare two sets of fields and return only NEW fields
 */
function getNewFields(currentFields: any[], previousFields: any[]) {
  console.log(`\n🔍 COMPARING FIELDS:`);
  console.log(`   Current fields: ${currentFields.length}`);
  console.log(`   Previously filled fields: ${previousFields.length}`);

  const previousFingerprints = new Set(
    previousFields.map(f => getFieldFingerprint(f))
  );

  const newFields = currentFields.filter(field =>
    !previousFingerprints.has(getFieldFingerprint(field))
  );

  console.log(`   🆕 NEW fields detected: ${newFields.length}`);
  if (newFields.length > 0) {
    console.log(`   📋 New field labels:`);
    newFields.forEach((field, idx) => {
      console.log(`      ${idx + 1}. ${field.label || field.placeholder || field.name || 'Unnamed field'}`);
    });
  }

  return newFields;
}

/**
 * Wait for potential DOM mutations (new fields appearing)
 */
async function waitForDynamicFields(page: Page, timeoutMs = 3000) {
  console.log(`\n⏳ WAITING FOR DYNAMIC FIELDS (${timeoutMs}ms timeout)...`);
  console.log('   👀 Watching for DOM mutations...');

  try {
    const startTime = Date.now();
    const mutationCount = await page.evaluate((timeout) => {
      return new Promise<number>((resolve) => {
        let timeoutId: NodeJS.Timeout;
        let mutationCount = 0;

        const observer = new MutationObserver((mutations) => {
          mutationCount++;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            observer.disconnect();
            resolve(mutationCount);
          }, 1000);
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });

        setTimeout(() => {
          observer.disconnect();
          resolve(mutationCount);
        }, timeout);
      });
    }, timeoutMs);

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ Dynamic field wait complete (${elapsedTime}ms, ${mutationCount} mutations detected)`);
  } catch (error: any) {
    console.log('⚠️  Error waiting for dynamic fields:', error.message);
  }
}

// Request schema
const IntelligentApplySchema = z.object({
  url: z.string().url(),
  userId: z.string().optional(), // User ID for session tracking
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
    }).optional(),
    parsedResume: z.any().optional(),
    coverLetter: z.string().optional(),
    linkedinUrl: z.string().optional(),
    portfolioUrl: z.string().optional(),
    demographics: z.any().optional(),
    workAuthorization: z.any().optional(),
    education: z.any().optional(),
    experience: z.any().optional(),
    applicationData: z.any().optional(),
    customFields: z.record(z.string(), z.string()).optional(),
  }),
  options: z.object({
    submitForm: z.boolean().optional().default(true),
    recordVideo: z.boolean().optional().default(true),
    autoApply: z.boolean().optional().default(false), // New auto-apply toggle
  }).optional(),
});

/**
 * Extract job title and company name from the page
 */
async function extractJobInfo(page: Page) {
  console.log('🏢 Extracting job title and company name from page...');
  
  const jobInfo = await page.evaluate(() => {
    // Common selectors for job titles
    const titleSelectors = [
      'h1[data-testid*="job-title"]',
      'h1[class*="job-title"]',
      'h1[class*="jobTitle"]',
      'h1[class*="title"]',
      '[data-testid*="job-title"]',
      '[class*="job-title"]',
      '[class*="jobTitle"]',
      '.job-title',
      '.jobTitle',
      'h1',
      'h2[class*="title"]',
      '[role="heading"][aria-level="1"]',
      '.position-title',
      '.role-title'
    ];

    // Common selectors for company names
    const companySelectors = [
      '[data-testid*="company"]',
      '[class*="company"]',
      '[class*="employer"]',
      '.company-name',
      '.employer-name',
      'a[href*="company"]',
      'a[href*="employer"]',
      '[class*="organization"]',
      '.org-name',
      'h2[class*="company"]',
      'span[class*="company"]'
    ];

    let jobTitle = '';
    let companyName = '';

    // Try to find job title
    for (const selector of titleSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          const text = element.textContent.trim();
          // Skip if it's too generic or too long
          if (text.length > 5 && text.length < 100 && 
              !text.toLowerCase().includes('search') &&
              !text.toLowerCase().includes('filter') &&
              !text.toLowerCase().includes('menu')) {
            jobTitle = text;
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Try to find company name
    for (const selector of companySelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.textContent?.trim()) {
            const text = element.textContent.trim();
            // Skip if it's too generic, too long, or looks like a job title
            if (text.length > 2 && text.length < 50 && 
                !text.toLowerCase().includes('search') &&
                !text.toLowerCase().includes('filter') &&
                !text.toLowerCase().includes('apply') &&
                !text.toLowerCase().includes('save') &&
                !text.toLowerCase().includes('share') &&
                text !== jobTitle) {
              companyName = text;
              break;
            }
          }
        }
        if (companyName) break;
      } catch (e) {
        // Continue to next selector
      }
    }

    // Fallback: try to extract from page title or URL
    if (!jobTitle || !companyName) {
      const pageTitle = document.title;
      const url = window.location.href;
      
      // Try to parse from page title (common format: "Job Title at Company Name")
      if (pageTitle) {
        const titleParts = pageTitle.split(' at ');
        if (titleParts.length === 2) {
          if (!jobTitle) jobTitle = titleParts[0].trim();
          if (!companyName) companyName = titleParts[1].split(' |')[0].split(' -')[0].trim();
        }
        
        // Try other common formats
        const dashParts = pageTitle.split(' - ');
        if (dashParts.length >= 2 && !jobTitle) {
          jobTitle = dashParts[0].trim();
        }
      }
      
      // Try to extract company from URL (e.g., company.com, jobs.company.com)
      if (!companyName && url) {
        const hostname = new URL(url).hostname;
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          const potentialCompany = parts[parts.length - 2];
          if (potentialCompany && potentialCompany !== 'jobs' && potentialCompany !== 'careers' && 
              potentialCompany !== 'www' && potentialCompany.length > 2) {
            companyName = potentialCompany.charAt(0).toUpperCase() + potentialCompany.slice(1);
          }
        }
      }
    }

    return { jobTitle, companyName };
  });

  console.log(`📋 Extracted job info: "${jobInfo.jobTitle}" at "${jobInfo.companyName}"`);
  return jobInfo;
}

/**
 * Extract all form fields from the page
 */
async function extractFormFields(page: Page) {
  console.log('🔍 Extracting form fields from page...');

  const fields = await page.evaluate(() => {
    const extractedFields: any[] = [];
    const skippedCaptchas: string[] = [];

    // Helper function to check if element is in footer/header (should be ignored)
    function isInFooterOrHeader(element: HTMLElement): boolean {
      let current: HTMLElement | null = element;
      while (current && current !== document.body) {
        const tagName = current.tagName.toLowerCase();
        const className = current.className?.toLowerCase() || '';
        const id = current.id?.toLowerCase() || '';

        // Check if parent is footer, header, nav, or sidebar
        if (
          tagName === 'footer' ||
          tagName === 'header' ||
          tagName === 'nav' ||
          className.includes('footer') ||
          className.includes('header') ||
          className.includes('nav') ||
          className.includes('sidebar') ||
          className.includes('newsletter') ||
          id.includes('footer') ||
          id.includes('header') ||
          id.includes('nav') ||
          id.includes('sidebar') ||
          id.includes('newsletter')
        ) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }

    function getLabelText(element: HTMLElement) {
      let labelText = null;

      // Method 1: label[for] association
      if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) labelText = label.textContent?.trim();
      }

      // Method 2: Parent label
      if (!labelText) {
        const parentLabel = element.closest('label');
        if (parentLabel) labelText = parentLabel.textContent?.trim();
      }

      // Method 3: aria-labelledby
      if (!labelText && element.getAttribute('aria-labelledby')) {
        const labelId = element.getAttribute('aria-labelledby');
        const label = labelId ? document.getElementById(labelId) : null;
        if (label) labelText = label.textContent?.trim();
      }

      // Method 4: Previous sibling label
      if (!labelText) {
        let sibling = element.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === 'LABEL') {
            labelText = sibling.textContent?.trim();
            break;
          }
          sibling = sibling.previousElementSibling;
        }
      }

      // Clean the label text: remove asterisks, extra whitespace, and special chars
      if (labelText) {
        labelText = labelText
          .replace(/\*/g, '')           // Remove asterisks (required field indicators)
          .replace(/\s+/g, ' ')         // Normalize whitespace
          .replace(/[:\-_]+$/g, '')     // Remove trailing colons, dashes, underscores
          .trim();
      }

      return labelText;
    }

    function getSelectOptions(selectElement: HTMLSelectElement) {
      const options = Array.from(selectElement.querySelectorAll('option'));
      return options.map(opt => ({
        value: opt.value,
        text: opt.textContent?.trim()
      }));
    }

    function getAutocompleteOptions(inputElement: HTMLInputElement) {
      // Try to find associated datalist
      const listId = inputElement.getAttribute('list');
      if (listId) {
        const datalist = document.getElementById(listId);
        if (datalist && datalist.tagName === 'DATALIST') {
          const options = Array.from(datalist.querySelectorAll('option'));
          return options.map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim() || opt.value
          }));
        }
      }

      // Try to find aria-controls
      const controlsId = inputElement.getAttribute('aria-controls');
      if (controlsId) {
        const listbox = document.getElementById(controlsId);
        if (listbox) {
          const options = listbox.querySelectorAll('[role="option"]');
          return Array.from(options).map(opt => ({
            value: opt.getAttribute('data-value') || opt.textContent?.trim() || '',
            text: opt.textContent?.trim() || ''
          }));
        }
      }

      return null;
    }

    // Extract INPUT fields
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
    inputs.forEach((input: any, index) => {
      // Skip if in footer/header (newsletter signups, etc.)
      if (isInFooterOrHeader(input)) {
        console.log(`Skipping footer/header field: ${input.id || input.name || 'unknown'}`);
        return;
      }

      // Get label first for CAPTCHA detection
      const label = getLabelText(input);

      // Check if this is a CAPTCHA field - skip these entirely
      const isCaptcha = (
        input.id?.toLowerCase().includes('captcha') ||
        input.id?.toLowerCase().includes('recaptcha') ||
        input.name?.toLowerCase().includes('captcha') ||
        input.name?.toLowerCase().includes('recaptcha') ||
        input.className?.toLowerCase().includes('captcha') ||
        input.className?.toLowerCase().includes('recaptcha') ||
        input.id?.toLowerCase().includes('g-recaptcha') ||
        input.name?.toLowerCase().includes('g-recaptcha') ||
        input.getAttribute('data-sitekey') ||  // reCAPTCHA has this attribute
        label?.toLowerCase().includes('captcha') ||
        label?.toLowerCase().includes('recaptcha')
      );

      // Skip CAPTCHA fields - they can't be filled programmatically
      if (isCaptcha) {
        const captchaIdentifier = label || input.id || input.name || 'unknown-captcha';
        skippedCaptchas.push(captchaIdentifier);
        return;
      }

      // Check if this is an autocomplete/combobox field
      const isDemographicField = label && (
        /\b(gender|race|ethnicity|hispanic|latino|veteran|disability)\b/i.test(label) ||
        /\b(gender|race|ethnicity|hispanic|latino|veteran|disability)\b/i.test(input.name || '') ||
        /\b(gender|race|ethnicity|hispanic|latino|veteran|disability)\b/i.test(input.placeholder || '')
      );

      const isAutocomplete = (
        input.getAttribute('role') === 'combobox' ||
        input.getAttribute('aria-autocomplete') === 'list' ||
        input.getAttribute('aria-autocomplete') === 'both' ||
        input.classList.contains('autocomplete') ||
        input.classList.contains('auto-complete') ||
        isDemographicField  // Treat demographic fields as autocomplete even if not explicitly marked
      );

      // Check if it's a location-related field (these use autocomplete for address lookup)
      // (label already fetched above for CAPTCHA detection)
      const isLocationField = label && (
        /\b(city|location|address|country|state|zip|postal)\b/i.test(label) ||
        /\b(city|location|address|country|state|zip|postal)\b/i.test(input.name || '') ||
        /\b(city|location|address|country|state|zip|postal)\b/i.test(input.placeholder || '')
      );

      // Extract options for autocomplete fields (both location and non-location)
      const autocompleteOptions = isAutocomplete ? getAutocompleteOptions(input) : null;

      extractedFields.push({
        type: 'input',  // ✅ Accurate - it's an input element
        inputType: input.type || 'text',
        id: input.id || null,
        name: input.name || null,
        placeholder: input.placeholder || null,
        label: label,
        ariaLabel: input.getAttribute('aria-label') || null,
        required: input.required,
        value: input.value || null,
        index: index,
        isAutocomplete: isAutocomplete,  // ✅ Metadata flag
        isLocationField: isLocationField,
        options: autocompleteOptions,  // Include options if available (for GPT to pick from)
      });
    });

    // Extract TEXTAREA fields
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((textarea: any, index) => {
      // Skip if in footer/header
      if (isInFooterOrHeader(textarea)) {
        console.log(`Skipping footer/header textarea: ${textarea.id || textarea.name || 'unknown'}`);
        return;
      }

      // Get label first for CAPTCHA detection
      const label = getLabelText(textarea);

      // Check if this is a CAPTCHA field - skip these entirely
      const isCaptcha = (
        textarea.id?.toLowerCase().includes('captcha') ||
        textarea.id?.toLowerCase().includes('recaptcha') ||
        textarea.name?.toLowerCase().includes('captcha') ||
        textarea.name?.toLowerCase().includes('recaptcha') ||
        textarea.className?.toLowerCase().includes('captcha') ||
        textarea.className?.toLowerCase().includes('recaptcha') ||
        textarea.id?.toLowerCase().includes('g-recaptcha') ||
        textarea.name?.toLowerCase().includes('g-recaptcha') ||
        textarea.getAttribute('data-sitekey') ||
        label?.toLowerCase().includes('captcha') ||
        label?.toLowerCase().includes('recaptcha')
      );

      // Skip CAPTCHA fields - they can't be filled programmatically
      if (isCaptcha) {
        const captchaIdentifier = label || textarea.id || textarea.name || 'unknown-captcha';
        skippedCaptchas.push(captchaIdentifier);
        return;
      }

      extractedFields.push({
        type: 'textarea',
        id: textarea.id || null,
        name: textarea.name || null,
        placeholder: textarea.placeholder || null,
        label: label,
        ariaLabel: textarea.getAttribute('aria-label') || null,
        required: textarea.required,
        value: textarea.value || null,
        index: index,
        maxLength: textarea.maxLength > 0 ? textarea.maxLength : null
      });
    });

    // Extract SELECT fields
    const selects = document.querySelectorAll('select');
    selects.forEach((select: any, index) => {
      // Skip if in footer/header
      if (isInFooterOrHeader(select)) {
        console.log(`Skipping footer/header select: ${select.id || select.name || 'unknown'}`);
        return;
      }

      extractedFields.push({
        type: 'select',
        id: select.id || null,
        name: select.name || null,
        label: getLabelText(select),
        ariaLabel: select.getAttribute('aria-label') || null,
        required: select.required,
        options: getSelectOptions(select),
        index: index
      });
    });

    return { extractedFields, skippedCaptchas };
  });

  // Log skipped CAPTCHAs
  if (fields.skippedCaptchas.length > 0) {
    console.log(`⏭️  Skipped ${fields.skippedCaptchas.length} CAPTCHA field(s):`);
    fields.skippedCaptchas.forEach(captchaId => {
      console.log(`   - ${captchaId}`);
    });
  }

  console.log(`✅ Extracted ${fields.extractedFields.length} form fields`);
  return fields.extractedFields;
}

/**
 * Extract comprehensive user profile data for LLM
 * Includes all relevant information for intelligent form filling
 */
function extractEssentialProfile(userProfile: any) {
  return {
    // Personal Information
    firstName: userProfile.firstName,
    lastName: userProfile.lastName,
    fullName: `${userProfile.firstName} ${userProfile.lastName}`,
    email: userProfile.email,
    phone: userProfile.phone,
    preferredName: userProfile.demographics?.preferredName,
    pronouns: userProfile.demographics?.pronouns,

    // Location
    address: userProfile.location?.address,
    city: userProfile.location?.city,
    state: userProfile.location?.state,
    zipCode: userProfile.location?.zipCode,
    country: userProfile.location?.country || 'United States',

    // Professional Links
    linkedinUrl: userProfile.linkedinUrl,
    portfolioUrl: userProfile.portfolioUrl,

    // Work Authorization
    visaStatus: userProfile.workAuthorization?.visaStatus,
    requiresSponsorship: userProfile.workAuthorization?.requiresSponsorship,
    authorizedToWork: userProfile.workAuthorization?.authorizedToWork !== false,
    availableStartDate: userProfile.workAuthorization?.availableStartDate,

    // Demographics (for EEO questions)
    race: userProfile.demographics?.race,
    ethnicity: userProfile.demographics?.ethnicity,
    gender: userProfile.demographics?.gender,
    veteranStatus: userProfile.demographics?.veteranStatus,
    disabilityStatus: userProfile.demographics?.disabilityStatus,

    // Application Data
    careerHighlight: userProfile.applicationData?.careerHighlight,
    salaryExpectation: userProfile.applicationData?.salaryExpectation,

    // Full Resume Data (GPT needs this to answer questions accurately)
    resume: userProfile.parsedResume ? {
      // Professional Summary
      summary: userProfile.parsedResume.summary,
      objective: userProfile.parsedResume.objective,

      // Skills (all of them - important for technical questions)
      skills: userProfile.parsedResume.skills || [],
      technicalSkills: userProfile.parsedResume.technicalSkills,
      softSkills: userProfile.parsedResume.softSkills,

      // Work Experience (all jobs, not just recent - for "previous company" questions)
      experience: userProfile.parsedResume.experience?.map((exp: any) => ({
        company: exp.company,
        title: exp.title,
        location: exp.location,
        duration: exp.duration,
        startDate: exp.startDate,
        endDate: exp.endDate,
        description: exp.description,
        responsibilities: exp.responsibilities,
        achievements: exp.achievements,
      })) || [],

      // Education (all degrees)
      education: userProfile.parsedResume.education?.map((edu: any) => ({
        degree: edu.degree,
        field: edu.field,
        school: edu.school,
        location: edu.location,
        graduationDate: edu.graduationDate,
        gpa: edu.gpa,
      })) || [],

      // Additional Resume Sections
      certifications: userProfile.parsedResume.certifications,
      projects: userProfile.parsedResume.projects,
      awards: userProfile.parsedResume.awards,
      publications: userProfile.parsedResume.publications,
      languages: userProfile.parsedResume.languages,
      volunteering: userProfile.parsedResume.volunteering,

      // Metadata
      yearsOfExperience: userProfile.parsedResume.yearsOfExperience,

      // RAW RESUME TEXT - Full context for better answers
      rawResumeText: userProfile.parsedResume.rawText || userProfile.parsedResume.fullText,
    } : undefined,

    // CHATGPT ESSAY - User's personalized essay about career goals, motivations, etc.
    chatgptEssay: userProfile.applicationData?.chatgptEssay || userProfile.applicationData?.coverLetter || userProfile.applicationData?.personalStatement,
  };
}

/**
 * Generate GPT prompt for field mapping
 */
function generateGPTPrompt(fields: any[], userProfile: any) {
  const essentialProfile = extractEssentialProfile(userProfile);

  return `You are an expert form-filling assistant. Your task is to analyze job application form fields and provide accurate, professional answers based on the user's profile.

USER PROFILE:
${JSON.stringify(essentialProfile, null, 2)}

FORM FIELDS TO FILL:
${JSON.stringify(fields, null, 2)}

TASK:
You are an intelligent form-filling assistant. Map EVERY field to an answer using the profile data.
You have ${fields.length} fields - return exactly ${fields.length} mappings.

⚠️ CRITICAL: USE ALL AVAILABLE CONTEXT
- The user profile includes STRUCTURED DATA (parsed resume sections)
- The user profile includes RAW RESUME TEXT (resume.rawResumeText) - use this for detailed context
- The user profile includes CHATGPT ESSAY (chatgptEssay) - use this for motivations, career goals, "why this company", etc.
- ALWAYS reference these sources when answering open-ended questions
- The ChatGPT essay is specifically crafted to answer "why this company", "why this role", "career goals" questions
- The raw resume text contains the full unstructured details that may not be in structured fields

⚠️ CRITICAL: BE TRUTHFUL - NEVER FABRICATE INFORMATION
- Only use information that exists in the user profile, raw resume text, or ChatGPT essay
- If asked about specific companies/projects not in profile → leave blank or say "See resume"
- Don't make up company names, project names, or specific experiences
- Don't invent skills or qualifications the user doesn't have
- When inferring, base it on actual profile data (e.g., infer degree level from experience, not random)
- For open-ended questions, synthesize from actual profile data + raw resume + ChatGPT essay, don't create fiction

LOCATOR PRIORITY:
1. getByLabel (if label exists)
2. getByPlaceholder (if placeholder exists)
3. css with name: [name="fieldName"]
4. css with id: #fieldId

INTELLIGENT ANSWER RULES:

⚠️ NEVER LEAVE ANSWERS BLANK:
- EVERY field must have an answer - even if you have to infer or pick a default
- If resume doesn't mention something → provide honest answer like "None", "No", "N/A", or reasonable default
- For EEO/diversity fields → ALWAYS check profile.gender, profile.ethnicity, profile.race, profile.veteranStatus, profile.disabilityStatus
- If demographic values exist in profile → use them (formatted to match dropdown options)
- If demographic values NOT in profile → use defaults like "Prefer not to say" or "I don't wish to answer"
- For required fields → ALWAYS provide an answer (never "")

**Personal Info**: Use exact values from profile (ALL data is available)
- Name fields → firstName, lastName, fullName (ALWAYS in profile)
- Email → exact email from profile (ALWAYS in profile)
- Phone → exact phone from profile: ${essentialProfile.phone || 'Not provided'} (format as requested)
- Address → ${essentialProfile.address || 'Not provided'}
- City → ${essentialProfile.city || 'Not provided'}
- State → ${essentialProfile.state || 'Not provided'}
- Zip Code → ${essentialProfile.zipCode || 'Not provided'}
- Country → ${essentialProfile.country || 'United States'}
- Gender → ${essentialProfile.gender || 'Prefer not to say'}
- Race → ${essentialProfile.race || 'Prefer not to say'}
- Ethnicity → ${essentialProfile.ethnicity || 'Prefer not to say'}
- Veteran Status → ${essentialProfile.veteranStatus || 'I am not a protected veteran'}
- Disability Status → ${essentialProfile.disabilityStatus || 'I do not wish to answer'}

**File Uploads** (IMPORTANT):
- Resume/CV upload field (type="file") → answer: "[RESUME_FILE]" (this signals to upload the resume)
- Cover letter upload → answer: "[RESUME_FILE]" (will use resume if no separate cover letter)
- Any file upload asking for resume, CV, or document → answer: "[RESUME_FILE]"
- DO NOT try to fill file inputs with text - ONLY use "[RESUME_FILE]" marker

**CAPTCHA Fields** (CRITICAL - DO NOT ANSWER):
- CAPTCHA fields are automatically filtered out and will NOT appear in the fields list
- You should NEVER see a CAPTCHA field in the fields you need to fill
- If you somehow see one, it's a bug - report it in the output

**Security Code / Verification Code Fields** (CRITICAL - SPECIAL HANDLING):
- If field label contains "security code", "verification code", "OTP", "one-time password", "2FA code", "authentication code"
- Answer with: "[EMAIL_VERIFICATION_CODE]" (this signals to fetch code from user's email)
- DO NOT answer with "N/A" or any other text
- The system will automatically check the user's email for the verification code and fill it
- Examples:
  - Field: "Enter security code" → Answer: "[EMAIL_VERIFICATION_CODE]"
  - Field: "Verification code" → Answer: "[EMAIL_VERIFICATION_CODE]"
  - Field: "Security input 1", "Security input 2", etc. → Answer: "[EMAIL_VERIFICATION_CODE]"

**Select Dropdowns** (CRITICAL - Most Important Rule):
- ALWAYS check if field has "options" array
- If field.type === "select" AND field has "options":
  1. READ all available options first
  2. CHOOSE the option that best matches the user's profile
  3. Your answer MUST be the EXACT text from options (copy it character-for-character)
  4. DO NOT generate your own answer and try to match - PICK from options!

**Autocomplete Input Fields** (CRITICAL - New Rule):
- If field.isAutocomplete === true AND field has "options" array:
  1. READ all available options first
  2. CHOOSE the option that best matches the user's profile
  3. Your answer MUST be the EXACT text from options (copy it character-for-character)
  4. DO NOT generate your own text - PICK from the provided options!
  5. The system will TYPE your answer and let autocomplete match it
- If field.isAutocomplete === true WITHOUT options (like location fields):
  1. Generate appropriate text based on user profile
  2. The system will type it and select from autocomplete suggestions
- Examples:
  - Field: {type: "input", isAutocomplete: true, label: "Gender", options: ["Male", "Female", "Non-binary"]}
    → Pick one: "Male" (system will type "Male" and autocomplete will match)
  - Field: {type: "input", isAutocomplete: true, label: "City", options: null, isLocationField: true}
    → Generate: "San Francisco" (system will type it and select from suggestions)

**Selection Logic**:
- Example field:
  {
    type: "select",
    label: "Years of Experience",
    options: [
      {text: "0-1 years"},
      {text: "2-3 years"},
      {text: "4-5 years"},
      {text: "6-10 years"},
      {text: "10+ years"}
    ]
  }

  User profile: yearsOfExperience = 7

  ✅ CORRECT Process:
  1. Look at options: ["0-1 years", "2-3 years", "4-5 years", "6-10 years", "10+ years"]
  2. User has 7 years → best match is "6-10 years"
  3. Answer: "6-10 years" (copied exactly from options)

  ❌ WRONG Process:
  1. Generate answer: "7 years"
  2. Try to match: No option "7 years" found → fail!

**Professional Info**:
- LinkedIn → linkedinUrl
- Portfolio/Website → portfolioUrl
- Current Company → resume.experience[0].company (most recent)
- Current Title → resume.experience[0].title (most recent)
- Previous Company → resume.experience[1].company (second most recent)
- Years of Experience → resume.yearsOfExperience or calculate from experience dates

**Work Authorization**:
- "Are you authorized to work?" → "Yes" if authorizedToWork is true, else "No"
- "Do you require sponsorship?" → "Yes" if requiresSponsorship is true, else "No"
- Visa status → use visaStatus if available, else infer: "US Citizen" if authorizedToWork and !requiresSponsorship

**Education**:
- Highest degree → resume.education[0].degree (e.g., "Bachelor's", "Master's", "PhD")
- School → resume.education[0].school
- Field of study → resume.education[0].field
- GPA → resume.education[0].gpa (if asked and available)
- Graduation date → resume.education[0].graduationDate
- If not in profile → infer reasonable answer: "Bachelor's Degree" is most common

**Experience Questions** (MUST be truthful - base on actual profile data):
- "Why do you want to work here?" → Use chatgptEssay FIRST (it's specifically written for this!), then careerHighlight and actual skills from resume.skills
- "Why this company?" → Use chatgptEssay FIRST (custom-written for motivation and interest in specific companies)
- "What motivates you?" → Use chatgptEssay FIRST + careerHighlight
- "Career goals?" → Use chatgptEssay FIRST + resume.objective or resume.summary
- "Tell us about yourself" → Use resume.summary or resume.objective, or synthesize from actual experience (don't invent)
- "What are your strengths?" → Use ONLY actual skills from resume.skills (top 3-5)
- "Describe a project" → Use ONLY from resume.projects or resume.experience[].description (check resume.rawResumeText for more details)
- "Biggest achievement?" → Use ONLY from careerHighlight, resume.experience[].achievements, or resume.awards
- "Tell us about a challenge" → Use from resume.experience[].description or responsibilities (check resume.rawResumeText for context)
- "Why are you leaving current job?" → Professional answer like "Seeking new opportunities" (don't fabricate)
- "What technologies have you used?" → ONLY from resume.skills or resume.technicalSkills
- "Languages spoken?" → ONLY from resume.languages (if available)
- "Certifications?" → ONLY from resume.certifications
- NEVER mention companies, projects, or achievements not in the profile
- ⚠️ ALWAYS prioritize chatgptEssay for motivation/goals questions - it's personalized for this purpose!

**Company-Specific Questions** (Be honest if not applicable):
- "SpaceX Employment History" / "Tesla Employment History" / etc. → Check if company is in resume.experience[].company
  - If YES: Provide details from that job (title, dates, description)
  - If NO: Answer "No prior employment" or "N/A" or "None" (NEVER invent employment!)
- "Active Security Clearance(s)" → Check resume for clearance mentions
  - If YES: State the clearance level
  - If NO: Answer "None" or "No active clearance" (NEVER claim false clearances!)
  - For dropdown: Pick "None" option if available
- "Referral Source" / "How did you hear about us?" → Reasonable default like "Company website" or "Job board"
- Company-specific questions → MUST answer, even if "N/A" or best guess

**Salary**:
- If salaryExpectation exists → use it
- If not → leave blank or say "Negotiable" (prefer leaving blank)

**Availability**:
- Start date → use availableStartDate if exists, else "Immediately" or "2 weeks notice"

**Diversity/EEO Questions** (use standard application format):
- ALWAYS check profile.gender, profile.ethnicity, profile.race, profile.veteranStatus, profile.disabilityStatus FIRST
- If profile has explicit values → use them (formatted properly for the dropdown options)
- If NOT in profile → use appropriate default (e.g., "Prefer not to say", "I don't wish to answer")
- NEVER leave demographic fields blank - ALWAYS provide an answer

**EEO Answer Format** (use these exact phrases for common questions):
- "Gender" → Use profile.gender if exists, else "Prefer not to say"
  Available values: "Male", "Female", "Non-binary", "Prefer not to say" (not "male"/"female")
- "Are you Hispanic/Latino?" → Use profile.ethnicity if exists, else "I am not Hispanic or Latino"
  Options: "I am Hispanic or Latino", "I am not Hispanic or Latino" (not "not-hispanic-latino")
- "Race/Ethnicity" → Use profile.race if exists, else "Decline to Self Identify"
  Options: "White", "Black or African American", "Hispanic or Latino", "Asian", "Two or More Races", "Decline to Self Identify" (not abbreviated codes)
- "Veteran Status" → Use profile.veteranStatus if exists, else "I am not a protected veteran"
  Options: "I am not a protected veteran", "I identify as one or more of the classifications of protected veteran" (not "not-veteran")
- "Disability Status" → Use profile.disabilityStatus if exists, else "I don't wish to answer"
  Options: "I don't wish to answer", "No, I don't have a disability", "Yes, I have a disability" (not "no-disability")

Use formal, professional language that matches typical application forms.
⚠️ CRITICAL: Always match the EXACT wording from the dropdown options. Profile values are hints - convert to proper format!

**Select Dropdowns**:
- Answer MUST match one of the available options exactly
- Try exact match first, then partial match
- For Yes/No questions → answer "Yes" or "No" (not "yes"/"no")
- For country → usually "United States"
- For state → use 2-letter code (e.g., "CA", "NY")

**Textareas (multi-line)**:
- Keep answers concise (2-4 sentences)
- Use professional tone
- Draw from resumeSummary and careerHighlight

**Required vs Optional**:
- Required fields → ALWAYS provide a reasonable answer (never leave blank)
- Optional fields → Provide answer if data exists, otherwise leave blank

**General Intelligence**:
- Use context clues from field label/placeholder to understand intent
- Provide professional, HONEST, TRUTHFUL answers
- When unsure, give a reasonable default based on field type AND actual profile data
- NEVER fabricate experiences, skills, or qualifications
- NEVER leave required fields blank (but use "See resume" or "N/A" if no truthful answer exists)

**Examples of GOOD vs BAD answers**:

**EEO Format Examples (CRITICAL - Use proper application language):**

GOOD ✅:
Q: "Are you Hispanic/Latino?" (select dropdown with options)
Available options: ["I am Hispanic or Latino", "I am not Hispanic or Latino"]
A: "I am not Hispanic or Latino" (proper application format)

BAD ❌:
Q: "Are you Hispanic/Latino?"
A: "not-hispanic-latino" or "no" or "No" (wrong format!)

GOOD ✅:
Q: "Veteran Status" (select dropdown)
Available options: ["I am not a protected veteran", "I identify as one or more..."]
A: "I am not a protected veteran" (proper application format)

BAD ❌:
Q: "Veteran Status"
A: "not-veteran" or "no" or "N/A" (wrong format!)

GOOD ✅:
Q: "Disability Status" (select dropdown)
Available options: ["I don't wish to answer", "No, I don't have a disability", "Yes, I have a disability"]
A: "I don't wish to answer" (proper application format)

BAD ❌:
Q: "Disability Status"
A: "no-disability" or "none" (wrong format!)

GOOD ✅:
Q: "Gender" (select dropdown)
Available options: ["Male", "Female", "Non-binary", "Prefer not to say"]
A: "Male" (if in profile.gender) or "Prefer not to say" (if not in profile)

BAD ❌:
Q: "Gender"
A: "male" or "M" or "man" (inconsistent with dropdown options!)

GOOD ✅:
Q: "Race/Ethnicity" (select dropdown)
Available options: ["White", "Black or African American", "Asian", "Two or More Races", "Decline to Self Identify"]
A: "Asian" (if in profile.race) or "Decline to Self Identify" (if not in profile)

BAD ❌:
Q: "Race/Ethnicity"
A: "asian" or "decline" or "prefer-not-to-say" (doesn't match options!)

IMPORTANT RULE: For ALL select dropdowns, your answer MUST match one of the available options EXACTLY (case-sensitive). Don't abbreviate, don't use synonyms, don't change capitalization.

**Select Dropdown Examples (MOST IMPORTANT - READ CAREFULLY):**

Example 1: Yes/No Dropdown
Field from DOM:
{
  "type": "select",
  "label": "Are you eligible to work?",
  "options": [{"value": "yes", "text": "Yes"}, {"value": "no", "text": "No"}]
}
User profile: authorizedToWork = true

GOOD ✅:
Process: Look at options → ["Yes", "No"] → User is authorized → Pick "Yes"
Your response: {
  "fieldType": "select",
  "answer": "Yes"  // ← Copied from options[0].text
}

BAD ❌:
Process: Generate "true" → Try to match → No option "true" found → Fail!
Your response: {
  "fieldType": "select",
  "answer": "true"  // ← NOT in options!
}

Example 2: Experience Level Dropdown
Field from DOM:
{
  "type": "select",
  "label": "Years of Experience",
  "options": [
    {"text": "0-2 years"},
    {"text": "3-5 years"},
    {"text": "6-10 years"},
    {"text": "10+ years"}
  ]
}
User profile: yearsOfExperience = 7

GOOD ✅:
Process: Look at options → User has 7 years → Best match is "6-10 years"
Your response: {
  "fieldType": "select",
  "answer": "6-10 years"  // ← Exact text from options
}

BAD ❌:
Process: Generate "7" → Try to match → No exact match → Fail!
Your response: {
  "fieldType": "select",
  "answer": "7"  // ← NOT in options!
}

Example 3: Security Clearance Dropdown
Field from DOM:
{
  "type": "select",
  "label": "Active Security Clearance(s)",
  "options": [
    {"text": "None"},
    {"text": "Secret"},
    {"text": "Top Secret"},
    {"text": "TS/SCI"}
  ]
}
User profile: No security clearance mentioned in resume

GOOD ✅:
Process: Check resume → No clearance found → Pick "None"
Your response: {
  "fieldType": "select",
  "answer": "None"  // ← Honest answer from options
}

BAD ❌:
Process: Skip field because no data
Your response: {
  "fieldType": "select",
  "answer": ""  // ← NEVER leave blank! Pick "None"
}

**Work Authorization Format Examples:**

GOOD ✅:
Q: "Are you legally authorized to work in the United States?" (select dropdown)
Available options: ["Yes", "No"]
A: "Yes" (from authorizedToWork: true)

BAD ❌:
Q: "Are you legally authorized to work in the United States?"
A: "yes" or "authorized" or "true" (doesn't match options!)

GOOD ✅:
Q: "Will you now or in the future require sponsorship?" (select dropdown)
Available options: ["Yes", "No"]
A: "No" (from requiresSponsorship: false)

BAD ❌:
Q: "Will you now or in the future require sponsorship?"
A: "no" or "does-not-require" or "false" (doesn't match options!)

GOOD ✅:
Q: "Visa/Work Authorization Status" (select dropdown)
Available options: ["U.S. Citizen", "Green Card Holder", "H1B", "F1 (OPT)", "Other"]
A: "U.S. Citizen" (from visaStatus or infer from authorizedToWork + !requiresSponsorship)

BAD ❌:
Q: "Visa/Work Authorization Status"
A: "us-citizen" or "citizen" or "USA" (doesn't match options!)

**Company-Specific Question Examples:**

GOOD ✅:
Q: "SpaceX Employment History"
Resume: No SpaceX mentioned
A: "No prior employment at SpaceX" (honest answer)

BAD ❌:
Q: "SpaceX Employment History"
Resume: No SpaceX mentioned
A: "" (blank - skipped field!)

GOOD ✅:
Q: "Active Security Clearance(s)" (text field)
Resume: No clearance mentioned
A: "None" or "No active clearance" (honest answer)

BAD ❌:
Q: "Active Security Clearance(s)"
Resume: No clearance mentioned
A: "" (blank - skipped field!)

GOOD ✅:
Q: "Active Security Clearance(s)" (dropdown)
Options: ["None", "Secret", "Top Secret", "TS/SCI"]
Resume: No clearance mentioned
A: "None" (picked from options - honest)

BAD ❌:
Q: "Active Security Clearance(s)" (dropdown)
Options: ["None", "Secret", "Top Secret", "TS/SCI"]
Resume: No clearance mentioned
A: "" (blank - should pick "None"!)

**Technical Examples:**

GOOD ✅:
Q: "Describe a technical challenge"
A: "Led development of microservices architecture serving 1M+ users" (from resume.experience[0].description)

BAD ❌:
Q: "Describe a technical challenge"
A: "Built an AI system that increased revenue by 300%" (NOT in profile - fabricated!)

GOOD ✅:
Q: "Tell me about a project"
A: "Built a real-time analytics dashboard using React and PostgreSQL" (from resume.projects[0].description)

BAD ❌:
Q: "Tell me about a project"
A: "Created blockchain app that won best innovation award" (NOT in resume.projects - fabricated!)

GOOD ✅:
Q: "What certifications do you have?"
A: "AWS Solutions Architect, Google Cloud Professional" (from resume.certifications)

BAD ❌:
Q: "What certifications do you have?"
A: "PMP, Scrum Master, Six Sigma" (NOT in resume.certifications - fabricated!)

GOOD ✅:
Q: "Why this company?"
A: "My 5 years in React and Node.js align with your stack, and I'm passionate about scalable systems" (from resume.skills + careerHighlight)

BAD ❌:
Q: "Why this company?"
A: "I've always admired your mission to revolutionize healthcare" (company/industry not mentioned - fabricated!)

GOOD ✅:
Q: "Biggest achievement?"
A: "Led team that launched product serving 1M+ users" (from resume.experience[0].achievements or careerHighlight)

GOOD ✅ (Alternative):
Q: "Biggest achievement?"
A: "See resume" (if no achievements listed)

BAD ❌:
Q: "Biggest achievement?"
A: "Won hackathon and built app with 10K downloads" (NOT in resume - fabricated!)

OUTPUT (JSON only):
{
  "fields": [
    {
      "question": "What is this field asking?",
      "locatorStrategy": "getByLabel|getByPlaceholder|css",
      "locatorValue": "selector value",
      "answer": "intelligent answer based on profile",
      "fieldType": "input|textarea|select",
      "inputType": "text|email|tel|etc"
    }
  ]
}

⚠️ CRITICAL RULES FOR OUTPUT:
1. Return ALL ${fields.length} fields - no more, no less
2. NEVER leave answer blank ("") except for optional EEO fields
   - If data not in profile → use honest defaults: "None", "N/A", "No", etc.
   - Company-specific questions → "No prior employment" or "None" if not applicable
   - Security clearance → "None" if not mentioned
   - ALWAYS provide an answer, even if it's honest negative
3. PRESERVE the exact "type" from input fields as "fieldType" in your response:
   - If input field has type: "select" → your response MUST have fieldType: "select"
   - If input field has type: "input" → your response MUST have fieldType: "input"
   - If input field has type: "textarea" → your response MUST have fieldType: "textarea"
4. For SELECT dropdowns with "options":
   - READ the options array first
   - PICK the best matching option based on user profile
   - COPY the option text EXACTLY (character-for-character, case-sensitive)
   - DO NOT generate your own answer - CHOOSE from options
5. For INPUT fields with isAutocomplete=true AND "options":
   - READ the options array first
   - PICK the best matching option based on user profile
   - COPY the option text EXACTLY (character-for-character, case-sensitive)
   - DO NOT generate your own text - CHOOSE from options
   - System will TYPE your answer and let autocomplete match it
6. For INPUT fields with isAutocomplete=true WITHOUT options (location fields):
   - Generate appropriate text from user profile
   - System will type it and select from autocomplete suggestions
7. No markdown formatting. No explanations. Only valid JSON.`;
}

/**
 * Get AI field mapping from OpenAI
 */
async function getAIFieldMapping(fields: any[], userProfile: any) {
  console.log('🤖 Sending fields to OpenAI for intelligent mapping...');

  try {
    const prompt = generateGPTPrompt(fields, userProfile);
    const estimatedTokens = Math.ceil(prompt.length / 4);
    console.log(`📊 Estimated prompt tokens: ~${estimatedTokens.toLocaleString()} (${(prompt.length / 1024).toFixed(1)}KB)`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert assistant that helps fill out job application forms accurately, professionally, and TRUTHFULLY. You ONLY use information from the user profile - you NEVER fabricate experiences, skills, companies, projects, or achievements. When information is not available, you use reasonable defaults or leave fields blank. You always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2, // Lower temperature for more consistent, truthful responses (was 0.3)
      max_tokens: 16000, // Allow large responses for many fields (47 fields × ~200 tokens = ~9400 tokens)
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    console.log('📥 Received AI response');
    console.log(`📊 Response length: ${content?.length || 0} characters`);
    console.log(`📊 Finish reason: ${response.choices[0].finish_reason}`);

    const parsed = JSON.parse(content || '{}');
    let fieldMappings = parsed.fields || parsed.mappings || parsed;

    if (!Array.isArray(fieldMappings)) {
      const keys = Object.keys(parsed);
      const arrayKey = keys.find(key => Array.isArray(parsed[key]));
      if (arrayKey) {
        fieldMappings = parsed[arrayKey];
      }
    }

    if (!Array.isArray(fieldMappings)) {
      throw new Error('AI response is not an array');
    }

    console.log(`✅ AI mapped ${fieldMappings.length} fields (expected ${fields.length})`);

    if (fieldMappings.length < fields.length) {
      console.log(`⚠️  WARNING: AI only returned ${fieldMappings.length}/${fields.length} fields!`);
      console.log(`   This might be due to response truncation or token limits.`);
    }

    return fieldMappings;

  } catch (error: any) {
    console.error('❌ Error calling OpenAI:', error.message);
    throw error;
  }
}

/**
 * Fill a single field using Playwright
 */
async function fillField(page: Page, fieldMapping: any, originalField: any, userProfile?: any) {
  const { question, locatorStrategy, locatorValue, answer, fieldType, inputType } = fieldMapping;

  console.log(`\n📝 Filling field: "${question}"`);
  console.log(`   Strategy: ${locatorStrategy}, Value: ${locatorValue}`);
  console.log(`   Answer: "${answer}"`);

  if (!answer || answer === '') {
    console.log('   ⏭️  Skipping - no answer provided');
    return { success: true, skipped: true, fieldLabel: question };
  }

  // Special handling for email verification code
  if (answer === '[EMAIL_VERIFICATION_CODE]') {
    console.log('   🔐 Email verification code requested - checking user email...');

    try {
      // Import email verification handler
      const { handleEmailVerification } = await import('@/src/lib/email-verification-handler');

      // Get user ID from userProfile
      const userId = (userProfile as any)?.id || (userProfile as any)?.userId;

      if (!userId) {
        console.log('   ❌ Cannot fetch verification code - no user ID available');
        return { success: false, error: 'No user ID for email verification', skipped: false, fieldLabel: question };
      }

      console.log(`   📧 Checking email for user ${userId}...`);

      // Extract company domain from current page URL
      const currentUrl = page.url();
      const companyDomain = extractCompanyDomain(currentUrl);

      // Attempt to detect and handle email verification
      const verificationCheck = await detectEmailVerification(page);

      if (verificationCheck.needsVerification) {
        const verificationResult = await handleEmailVerification(
          page,
          userId,
          verificationCheck,
          {
            maxWaitTime: 60000, // 1 minute
            checkInterval: 3000, // Check every 3 seconds
            companyDomain
          }
        );

        if (verificationResult.success && verificationResult.code) {
          console.log(`   ✅ Got verification code: ${verificationResult.code}`);

          // The code might be a single string or need to be split
          const codeStr = verificationResult.code.toString();

          // If this is a single input field, fill the whole code
          // If it's a multi-input field (e.g., security-input-1, security-input-2), fill just one digit
          const isMultiInput = question.toLowerCase().match(/input\s*\d+|code\s*\d+|digit\s*\d+/);

          let valueToFill = codeStr;

          if (isMultiInput) {
            // Extract digit number from field name (e.g., "Security input 3" → index 2 → digit at position 2)
            const digitMatch = question.match(/\d+/);
            if (digitMatch) {
              const digitIndex = parseInt(digitMatch[0]) - 1; // Convert to 0-based index
              if (digitIndex >= 0 && digitIndex < codeStr.length) {
                valueToFill = codeStr[digitIndex];
                console.log(`   📍 Multi-input field detected - filling digit ${digitIndex + 1}: ${valueToFill}`);
              }
            }
          }

          // Continue with normal field filling using the verification code
          fieldMapping.answer = valueToFill;
          console.log(`   ✅ Verification code ready to fill: ${valueToFill}`);

          // Recursively call fillField with updated answer
          return await fillField(page, { ...fieldMapping, answer: valueToFill }, originalField, userProfile);
        } else {
          console.log(`   ❌ Could not get verification code: ${verificationResult.message}`);
          return { success: false, error: verificationResult.message, skipped: false, fieldLabel: question };
        }
      } else {
        console.log('   ⚠️  No email verification detected on page');
        return { success: false, error: 'No email verification detected', skipped: false, fieldLabel: question };
      }
    } catch (verificationError: any) {
      console.log(`   ❌ Email verification error: ${verificationError.message}`);
      return { success: false, error: verificationError.message, skipped: false, fieldLabel: question };
    }
  }

  try {
    let element;
    let locatorFound = false;

    // Clean the locator value (remove special chars that might cause issues)
    const cleanLocatorValue = locatorValue.replace(/\*/g, '').replace(/[:\-_]+$/g, '').trim();

    // Try primary locator strategy with cleaned value
    try {
      switch (locatorStrategy) {
        case 'getByLabel':
          // Try exact match first, then partial
          try {
            element = page.getByLabel(cleanLocatorValue, { exact: true });
            await element.waitFor({ state: 'visible', timeout: 2000 });
            locatorFound = true;
          } catch {
            element = page.getByLabel(cleanLocatorValue, { exact: false });
            await element.waitFor({ state: 'visible', timeout: 2000 });
            locatorFound = true;
          }
          break;
        case 'getByPlaceholder':
          element = page.getByPlaceholder(cleanLocatorValue, { exact: false });
          await element.waitFor({ state: 'visible', timeout: 2000 });
          locatorFound = true;
          break;
        case 'getByRole':
          element = page.getByRole(locatorValue as any, {});
          await element.waitFor({ state: 'visible', timeout: 2000 });
          locatorFound = true;
          break;
        case 'css':
          element = page.locator(locatorValue);
          await element.waitFor({ state: 'visible', timeout: 2000 });
          locatorFound = true;
          break;
        case 'xpath':
          element = page.locator(locatorValue);
          await element.waitFor({ state: 'visible', timeout: 2000 });
          locatorFound = true;
          break;
        default:
          throw new Error(`Unknown locator strategy: ${locatorStrategy}`);
      }

      if (locatorFound) {
        console.log(`   ✅ Primary locator succeeded: ${locatorStrategy}("${cleanLocatorValue}")`);
      }

    } catch (primaryError) {
      console.log(`   ⚠️  Primary locator failed, trying fallbacks...`);
      element = null;

      // Fallback 1: Try CSS selector by name (most reliable)
      if (!element && originalField.name) {
        try {
          element = page.locator(`[name="${originalField.name}"]`);
          await element.waitFor({ state: 'visible', timeout: 2000 });
          console.log('   ✅ Fallback: CSS by name succeeded');
        } catch (e) {
          element = null;
        }
      }

      // Fallback 2: Try CSS selector by ID
      if (!element && originalField.id) {
        try {
          element = page.locator(`#${originalField.id}`);
          await element.waitFor({ state: 'visible', timeout: 2000 });
          console.log('   ✅ Fallback: CSS by ID succeeded');
        } catch (e) {
          element = null;
        }
      }

      // Fallback 3: Try getByLabel with cleaned original label
      if (!element && originalField.label && locatorStrategy !== 'getByLabel') {
        try {
          const cleanLabel = originalField.label.replace(/\*/g, '').replace(/[:\-_]+$/g, '').trim();
          element = page.getByLabel(cleanLabel, { exact: false });
          await element.waitFor({ state: 'visible', timeout: 2000 });
          console.log('   ✅ Fallback: getByLabel succeeded');
        } catch (e) {
          element = null;
        }
      }

      // Fallback 4: Try getByPlaceholder
      if (!element && originalField.placeholder) {
        try {
          element = page.getByPlaceholder(originalField.placeholder, { exact: false });
          await element.waitFor({ state: 'visible', timeout: 2000 });
          console.log('   ✅ Fallback: getByPlaceholder succeeded');
        } catch (e) {
          element = null;
        }
      }

      // Fallback 5: Try aria-label
      if (!element && originalField.ariaLabel) {
        try {
          element = page.locator(`[aria-label="${originalField.ariaLabel}"]`);
          await element.waitFor({ state: 'visible', timeout: 2000 });
          console.log('   ✅ Fallback: aria-label succeeded');
        } catch (e) {
          element = null;
        }
      }

      // Fallback 6: For demographic fields, try special patterns
      if (!element) {
        const demographicPatterns = ['gender', 'race', 'ethnicity', 'hispanic', 'latino', 'veteran', 'disability'];
        const questionLower = question.toLowerCase();
        const isDemographicField = demographicPatterns.some(pattern => questionLower.includes(pattern));

        if (isDemographicField) {
          console.log('   🎯 Demographic field detected, trying special selectors...');

          // Try finding by text content in labels
          const labelSelectors = [
            `//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${questionLower.slice(0, 15)}')]//following::input[1]`,
            `//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${questionLower.slice(0, 15)}')]//following::select[1]`,
            `//div[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${questionLower.slice(0, 15)}')]//following::input[1]`,
            `//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${questionLower.slice(0, 15)}')]//following::input[1]`
          ];

          for (const selector of labelSelectors) {
            try {
              element = page.locator(selector).first();
              await element.waitFor({ state: 'visible', timeout: 2000 });
              console.log(`   ✅ Fallback: Demographic XPath succeeded with: ${selector.slice(0, 50)}...`);
              break;
            } catch (e) {
              element = null;
            }
          }
        }
      }

      if (!element) {
        throw new Error('All locator strategies failed');
      }
    }

    // Scroll element into view for video recording
    try {
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200); // Brief pause so video captures the scroll
    } catch (scrollError) {
      // Ignore scroll errors, proceed with filling
    }

    // Check if this is a select element (even if GPT said it's an input)
    const isSelectElement = await element.evaluate((el) => el.tagName === 'SELECT');
    const isFileInput = inputType === 'file' || await element.evaluate((el) => {
      return el instanceof HTMLInputElement && el.type === 'file';
    });

    // Auto-detect if this is a file input and upload resume directly (bypass GPT)
    if (isFileInput) {
      console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
      console.log(`║   🔍 FILE INPUT DETECTED - Starting Robust Upload         ║`);
      console.log(`╚═══════════════════════════════════════════════════════════╝`);
      console.log(`   📋 Question: "${question}"`);
      console.log(`   📋 Field Type: "${fieldType}"`);
      console.log(`   📋 Input Type: "${inputType}"`);

      const isResumeOrCVField = question.toLowerCase().includes('resume') ||
                                question.toLowerCase().includes('cv') ||
                                question.toLowerCase().includes('curriculum');

      const isCoverLetterField = question.toLowerCase().includes('cover') &&
                                 question.toLowerCase().includes('letter');

      console.log(`   📋 Is Resume/CV Field: ${isResumeOrCVField}`);
      console.log(`   📋 Is Cover Letter Field: ${isCoverLetterField}`);

      // Get resume data directly from fieldMapping
      const resumeData = (fieldMapping as any).resumeFile;

      if (resumeData && resumeData.fileBase64 && resumeData.fileName) {
        console.log(`\n   ✅ Resume data available: ${resumeData.fileName}`);
        console.log(`   📊 File size: ${(resumeData.fileBase64.length * 0.75 / 1024).toFixed(2)} KB`);

          const fs = require('fs');
          const path = require('path');
          const os = require('os');

        let tempFilePath: string | null = null;
        let uploadSucceeded = false;
        const maxRetries = 2;

        for (let attempt = 1; attempt <= maxRetries && !uploadSucceeded; attempt++) {
          try {
            console.log(`\n   🔄 Upload Attempt ${attempt}/${maxRetries}`);

            // Step 1: Create temp file with absolute path
            console.log(`   📁 Step 1: Creating temporary file...`);
          const buffer = Buffer.from(resumeData.fileBase64, 'base64');
          const tempDir = os.tmpdir();
            tempFilePath = path.resolve(tempDir, resumeData.fileName); // Use path.resolve for absolute path

          fs.writeFileSync(tempFilePath, buffer);
            console.log(`   ✅ Temp file created: ${tempFilePath}`);

            // Verify file exists
            if (!fs.existsSync(tempFilePath)) {
              throw new Error('Temp file was not created');
            }
            console.log(`   ✅ File exists on disk`);

            // Step 2: Ensure file input is ready
            console.log(`   ⏳ Step 2: Waiting for file input to be ready...`);
            await element.waitFor({ state: 'attached', timeout: 3000 });
            await element.waitFor({ state: 'visible', timeout: 3000 });

            // Check if input is enabled
            const isDisabled = await element.evaluate((el) => (el as HTMLInputElement).disabled);
            if (isDisabled) {
              console.log(`   ⚠️  Input is disabled, waiting for it to be enabled...`);
              await page.waitForTimeout(1000);
            }
            console.log(`   ✅ File input is ready`);

            // Step 3: Scroll into view
            console.log(`   📜 Step 3: Scrolling file input into view...`);
            await element.scrollIntoViewIfNeeded();
            await page.waitForTimeout(300);
            console.log(`   ✅ Scrolled into view`);

            // Step 4: Set the file
            console.log(`   📤 Step 4: Uploading file to input...`);
            if (!tempFilePath) {
              throw new Error('Temp file path is null');
            }
          await element.setInputFiles(tempFilePath);
            console.log(`   ✅ setInputFiles() completed`);

            // Step 5: Verify upload succeeded
            console.log(`   🔍 Step 5: Verifying upload...`);
            const uploadedFileName = await element.evaluate((el) => {
              const input = el as HTMLInputElement;
              if (input.files && input.files.length > 0) {
                return input.files[0].name;
              }
              return null;
            });

            if (uploadedFileName) {
              console.log(`   ✅ Upload verified! File name in input: "${uploadedFileName}"`);
              uploadSucceeded = true;
            } else {
              throw new Error('File was not set in input (files.length = 0)');
            }

            // Step 6: Wait for network activity to settle
            console.log(`   🌐 Step 6: Waiting for network activity to settle...`);
            try {
              await page.waitForLoadState('networkidle', { timeout: 5000 });
              console.log(`   ✅ Network idle`);
            } catch (networkError) {
              console.log(`   💡 Network did not settle (timeout) - continuing anyway`);
            }

            // Additional wait for UI updates
            await page.waitForTimeout(1000);

            // Step 7: Check for error messages
            console.log(`   🔍 Step 7: Checking for upload error messages...`);
            const errorMessages = await page.evaluate(() => {
              const errorSelectors = [
                '.error',
                '.error-message',
                '[class*="error"]',
                '[role="alert"]',
                '.alert-danger',
                '.validation-error'
              ];

              for (const selector of errorSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of Array.from(elements)) {
                  const text = (el as HTMLElement).textContent?.trim() || '';
                  if (text.length > 0 && text.length < 200) {
                    // Check if error is related to file upload
                    if (/file|upload|resume|cv|document/i.test(text)) {
                      return text;
                    }
                  }
                }
              }
              return null;
            });

            if (errorMessages) {
              throw new Error(`Upload error message detected: "${errorMessages}"`);
            }

            console.log(`   ✅ No error messages found`);

            console.log(`\n   ╔═══════════════════════════════════════════════════╗`);
            console.log(`   ║   ✅✅✅ FILE UPLOAD SUCCESSFUL ✅✅✅            ║`);
            console.log(`   ╚═══════════════════════════════════════════════════╝`);
            console.log(`   📄 Uploaded: ${resumeData.fileName}`);

        } catch (uploadError: any) {
            console.error(`\n   ❌ Upload attempt ${attempt} failed: ${uploadError.message}`);

            if (attempt < maxRetries) {
              console.log(`   🔄 Retrying upload in 2 seconds...`);
              await page.waitForTimeout(2000);
            } else {
              console.error(`\n   ❌❌❌ ALL UPLOAD ATTEMPTS FAILED ❌❌❌`);
              return { success: false, error: `File upload failed after ${maxRetries} attempts: ${uploadError.message}`, skipped: false, fieldLabel: question };
            }
          } finally {
            // Clean up temp file (if created)
            if (tempFilePath && fs.existsSync(tempFilePath)) {
              try {
                fs.unlinkSync(tempFilePath);
                console.log(`   🗑️  Temp file cleaned up`);
              } catch (cleanupError: any) {
                console.log(`   ⚠️  Could not delete temp file: ${cleanupError.message}`);
              }
            }
          }
        }

        if (uploadSucceeded) {
          return { success: true, skipped: false, fieldLabel: question, value: resumeData.fileName, fieldType: 'file' };
        } else {
          return { success: false, error: 'Upload failed after all retries', skipped: false, fieldLabel: question };
        }

      } else {
        console.log(`   ⚠️  No resume data available to upload`);
        console.log(`   📋 resumeData exists: ${!!resumeData}`);
        console.log(`   📋 fileBase64 exists: ${!!(resumeData && resumeData.fileBase64)}`);
        console.log(`   📋 fileBase64 length: ${resumeData?.fileBase64?.length || 0}`);
        console.log(`   📋 fileName exists: ${!!(resumeData && resumeData.fileName)}`);
        console.log(`   💡 TIP: User needs to upload resume in dashboard settings`);

        // Skip this field instead of erroring
        console.log(`   ⏭️  Skipping file upload field - no resume available`);
        return { success: true, error: null, skipped: true, fieldLabel: question };
      }
    }

    // Check if this is actually a native SELECT element
    const isActualSelectTag = await element.evaluate((el) => el.tagName === 'SELECT');

    // Fill the field based on type
    if (fieldType === 'select' || isSelectElement) {
      // For native select dropdowns, use selectOption API
      if (!isActualSelectTag) {
        console.log(`   ⚠️  Field marked as 'select' but is not a <select> element - skipping select handler`);
        // Fall through to other handlers
      } else {
        try {
          console.log(`   🎯 Detected native SELECT element, attempting dropdown selection`);

          // First, get all available options to help with matching
            const options = await element.evaluate((el) => {
              const selectEl = el as HTMLSelectElement;
              return Array.from(selectEl.options).map(opt => ({
                value: opt.value,
                text: opt.textContent?.trim() || ''
              }));
            });

        console.log(`   📋 Available options: ${options.map(o => `"${o.text}"`).join(', ')}`);

        // Try exact label match first
        let selected = false;
        try {
          await element.selectOption({ label: answer });
          console.log(`   ✅ Selected by exact label: "${answer}"`);
          selected = true;
        } catch (labelError) {
          // Try exact value match
          try {
            await element.selectOption({ value: answer });
            console.log(`   ✅ Selected by exact value: "${answer}"`);
            selected = true;
          } catch (valueError) {
            // Try partial/fuzzy match
            const answerLower = answer.toLowerCase();
            const matchedOption = options.find(opt =>
              opt.text.toLowerCase() === answerLower ||
              opt.value.toLowerCase() === answerLower ||
              opt.text.toLowerCase().includes(answerLower) ||
              answerLower.includes(opt.text.toLowerCase())
            );

            if (matchedOption) {
              await element.selectOption({ value: matchedOption.value });
              console.log(`   ✅ Selected by fuzzy match: "${matchedOption.text}" (from answer: "${answer}")`);
              selected = true;
            } else {
              throw new Error(`No matching option found for "${answer}". Available: ${options.map(o => o.text).join(', ')}`);
            }
          }
        }

        if (!selected) {
          throw new Error('Failed to select option');
        }

        } catch (selectError: any) {
          console.error(`   ⚠️  Select failed: ${selectError.message}`);
        throw selectError;
        }
      }
    } else if (originalField.isAutocomplete === true) {
      // Handle autocomplete input fields - TWO STRATEGIES based on field type
      try {
        console.log(`   🔍 Detected AUTOCOMPLETE input field`);

        // ALL autocomplete fields now use smart matching strategy
        // This allows fuzzy matching (e.g., "Prefer not to say" → "I don't wish to answer")
        const fieldLabel = (question || originalField.label || originalField.placeholder || '').toLowerCase();

        // Determine field category for logging
        const isLocationField =
          fieldLabel.includes('location') ||
          fieldLabel.includes('city') ||
          fieldLabel.includes('address') ||
          fieldLabel.includes('state') ||
          fieldLabel.includes('country') ||
          fieldLabel.includes('zip') ||
          fieldLabel.includes('postal');

        const isSchoolDegreeField =
          fieldLabel.includes('school') ||
          fieldLabel.includes('university') ||
          fieldLabel.includes('college') ||
          fieldLabel.includes('degree') ||
          fieldLabel.includes('discipline') ||
          fieldLabel.includes('major') ||
          fieldLabel.includes('field of study') ||
          fieldLabel.includes('education');

        // Determine strategy based on field type
        const needsSmartMatching = isLocationField || isSchoolDegreeField;
        const fieldType = isLocationField ? 'Location' :
                         isSchoolDegreeField ? 'School/Degree/Discipline' :
                         'Autocomplete';

        if (needsSmartMatching) {
          // STRATEGY 1: Smart matching for location/school/degree/discipline
          console.log(`   📍 ${fieldType} field detected - using smart matching strategy`);

          await element.clear();
          await page.waitForTimeout(200);
          await element.type(answer, { delay: 50 }); // Type slowly with more delay
          console.log(`   ⌨️  Typed: "${answer}"`);
          await page.waitForTimeout(1500); // Increased wait time for dropdown to appear

          // Try to extract dropdown options that appeared after typing
          console.log(`   🔍 Extracting dropdown options...`);
          const dropdownOptions = await page.evaluate(() => {
            const selectors = [
              '[role="listbox"] [role="option"]',
              '[role="option"]',
              '.autocomplete-suggestion',
              '.autocomplete-item',
              '[class*="suggestion"]',
              '[class*="dropdown"] li',
              '[class*="menu"] li',
              '[class*="Menu"] li',
              'ul[role="listbox"] li',
              '.MuiAutocomplete-option',
              '.MuiMenuItem-root',
              '.ant-select-item',
              '.ant-select-item-option',
              '[class*="select-option"]',
              '[class*="Select-option"]',
              '[class*="dropdown-item"]',
              '[class*="Dropdown-item"]',
              '[data-testid*="option"]',
              '[data-test*="option"]',
              'div[role="option"]',
              'li[role="option"]',
              '[class*="option-"]',
            ];

            for (const selector of selectors) {
              const options = document.querySelectorAll(selector);
              if (options.length > 0) {
                const visibleOptions = Array.from(options)
                  .filter(opt => {
                    const el = opt as HTMLElement;
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return (
                      style.display !== 'none' &&
                      style.visibility !== 'hidden' &&
                      style.opacity !== '0' &&
                      rect.width > 0 &&
                      rect.height > 0
                    );
                  })
                  .map(opt => ({
                    text: (opt as HTMLElement).textContent?.trim() || '',
                    element: opt
                  }));

                if (visibleOptions.length > 0) {
                  return visibleOptions.map(opt => opt.text);
                }
              }
            }
            return [];
          });

          console.log(`   📋 Found ${dropdownOptions.length} options:`, dropdownOptions.slice(0, 5));

          // Find best match (contains the typed text)
          if (dropdownOptions.length > 0) {
            const searchTerm = answer.toLowerCase();
            const bestMatch = dropdownOptions.find(opt =>
              opt.toLowerCase().includes(searchTerm)
            );

            if (bestMatch) {
              console.log(`   ✨ Found matching option: "${bestMatch}"`);

              // Wait for dropdown to stabilize before clicking
              console.log(`   ⏳ Waiting for dropdown to stabilize...`);
              await page.waitForTimeout(2500); // Increased to 2.5 seconds for slow-loading dropdowns

              // AGGRESSIVE MULTI-RETRY CLICK STRATEGY - Try up to 3 times
              let clicked = false;
              let retryCount = 0;
              const maxRetries = 3;

              while (!clicked && retryCount < maxRetries) {
                retryCount++;
                console.log(`   🎯 Click attempt ${retryCount}/${maxRetries}...`);

                clicked = await page.evaluate((matchText) => {
                  const selectors = [
                    '[role="listbox"] [role="option"]',
                    '[role="option"]',
                    '.autocomplete-suggestion',
                    '.autocomplete-item',
                    '[class*="suggestion"]',
                    '[class*="dropdown"] li',
                    '[class*="menu"] li',
                    '[class*="Menu"] li',
                    'ul[role="listbox"] li',
                    '.MuiAutocomplete-option',
                    '.MuiMenuItem-root',
                    '.ant-select-item',
                    '.ant-select-item-option',
                    '[class*="select-option"]',
                    '[class*="Select-option"]',
                    '[class*="dropdown-item"]',
                    '[class*="Dropdown-item"]',
                    '[data-testid*="option"]',
                    '[data-test*="option"]',
                    'div[role="option"]',
                    'li[role="option"]',
                    '[class*="option-"]',
                  ];

                  for (const selector of selectors) {
                    const options = document.querySelectorAll(selector);
                    for (const opt of Array.from(options)) {
                      const el = opt as HTMLElement;
                      const text = el.textContent?.trim();

                      // Try exact match first, then contains match
                      if (text === matchText || (text && text.includes(matchText))) {
                        console.log(`[CLICK] Found and clicking option: "${text}" using selector: ${selector}`);

                        // Scroll element into view
                        el.scrollIntoView({ behavior: 'auto', block: 'center' });

                        // Multiple click attempts
                        el.click();
                        setTimeout(() => el.click(), 50);

                        // Also dispatch mouse events for stubborn elements
                        const clickEvent = new MouseEvent('click', {
                          bubbles: true,
                          cancelable: true,
                          view: window
                        });
                        el.dispatchEvent(clickEvent);

                        return true;
                      }
                    }
                  }
                  return false;
                }, bestMatch);

                if (clicked) {
                  await page.waitForTimeout(500);
                  console.log(`   ✅ Successfully clicked on option: "${bestMatch}" (attempt ${retryCount})`);
                  break;
                } else {
                  console.log(`   ⚠️  Click attempt ${retryCount} failed, retrying...`);
                  await page.waitForTimeout(800); // Wait before retry
                }
              }

              if (!clicked) {
                // Fallback to keyboard navigation
                console.log(`   🎹 All click attempts failed, trying keyboard navigation...`);
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(300);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(300);
                console.log(`   ✅ Selected using keyboard`);
              }
          } else {
              console.log(`   ⚠️  No match found for "${answer}" in dropdown options`);
              // Try keyboard navigation as fallback
              await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(300);
              await page.keyboard.press('Enter');
              await page.waitForTimeout(300);
              console.log(`   💡 Used keyboard navigation as fallback`);
            }
          } else {
            // No options found initially - try extracting from full page
            console.log(`   ⚠️  No location options found in immediate dropdown`);
            console.log(`   🔍 Attempting to extract options from full page (max 20)...`);

            // Strategy: Extract dropdown options from the entire page
            const pageOptions = await page.evaluate(() => {
              const allOptions: string[] = [];
              const selectors = [
                '[role="listbox"] [role="option"]',
                '[role="option"]',
                '.autocomplete-suggestion',
                '.autocomplete-item',
                '[class*="suggestion"]',
                '[class*="dropdown"] li',
                '[class*="menu"] li',
                '[class*="Menu"] li',
                'ul[role="listbox"] li',
                '.MuiAutocomplete-option',
                '.MuiMenuItem-root',
                '.ant-select-item',
                '.ant-select-item-option',
                '[class*="select-option"]',
                '[class*="Select-option"]',
                '[class*="dropdown-item"]',
                '[class*="Dropdown-item"]',
                '.MuiAutocomplete-option',
                '[data-testid*="option"]',
                'div[role="option"]',
                'li[role="option"]'
              ];

              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el) => {
                  const text = el.textContent?.trim();
                  if (text && text.length > 0 && !allOptions.includes(text)) {
                    allOptions.push(text);
                  }
                });
                if (allOptions.length >= 20) break;
              }

              return allOptions.slice(0, 20); // Max 20 options
            });

            if (pageOptions.length > 0) {
              console.log(`   ✅ Extracted ${pageOptions.length} location options from page`);
              console.log(`   📋 Options: ${pageOptions.slice(0, 5).join(', ')}${pageOptions.length > 5 ? '...' : ''}`);

              // Use GPT to pick the best matching location
              try {
                console.log(`   🤖 Using GPT to select best location match...`);

                const userLocation = `${userProfile?.location?.city || ''}, ${userProfile?.location?.state || ''}, ${userProfile?.location?.country || 'United States'}`.replace(/^,\s*|,\s*$/g, '');

                const selectionPrompt = `You are helping fill out a job application location field.

USER'S LOCATION: ${userLocation}

AVAILABLE OPTIONS IN DROPDOWN (choose ONE that best matches):
${pageOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

TASK: Select the option that BEST matches the user's location.
- If exact match exists → choose it
- If city exists → choose it
- If state exists → choose it
- If multiple matches → choose most specific (city > state > region)
- If no good match → choose the closest option or first option

Respond with ONLY the exact option text (copy it exactly as shown above), nothing else.`;

                const selectionResponse = await openai.chat.completions.create({
                  model: 'gpt-4o-mini',
                  messages: [
                    {
                      role: 'system',
                      content: 'You are a location matching assistant. Respond with only the exact option text that best matches the user\'s location.'
                    },
                    {
                      role: 'user',
                      content: selectionPrompt
                    }
                  ],
                  temperature: 0,
                  max_tokens: 50
                });

                const selectedOption = selectionResponse.choices[0].message.content?.trim() || pageOptions[0];
                console.log(`   🎯 GPT selected location: "${selectedOption}"`);

                // Clear and type the selected option
                await element.clear();
                await page.waitForTimeout(100);
                await element.fill(selectedOption);
                console.log(`   ⌨️  Typed: "${selectedOption}"`);
                await page.waitForTimeout(800);

                // Try to click matching option
                const clicked = await page.evaluate((matchText) => {
                  const selectors = [
                    '[role="listbox"] [role="option"]',
                    '[role="option"]',
                    '.autocomplete-suggestion',
                    '.autocomplete-item',
                    '[class*="suggestion"]',
                    '[class*="dropdown"] li',
                    'ul li',
                    'div[role="option"]'
                  ];

                  for (const selector of selectors) {
                    const options = document.querySelectorAll(selector);
                    for (const opt of options) {
                      if (opt.textContent?.trim().toLowerCase() === matchText.toLowerCase()) {
                        (opt as HTMLElement).click();
                        return true;
                      }
                    }
                  }
                  return false;
                }, selectedOption);

                if (clicked) {
                  console.log(`   ✅ Clicked matching option`);
                } else {
                  console.log(`   💡 Pressed Enter to accept typed value`);
                  await page.keyboard.press('Enter');
                }
                await page.waitForTimeout(300);

              } catch (gptError: any) {
                console.error(`   ⚠️  GPT location selection failed: ${gptError.message}`);
                // Fallback to first option
                await element.clear();
                await element.fill(pageOptions[0]);
                await page.waitForTimeout(500);
                await page.keyboard.press('Enter');
                console.log(`   💡 Used first option as fallback: "${pageOptions[0]}"`);
              }

            } else {
              // No options at all - use enhanced location fallback
              console.log(`   ⚠️  No location options found anywhere on page`);

              // Try to enhance location with state/country from user profile
              let enhancedLocation = answer;
              if (userProfile?.location?.state) {
                enhancedLocation = `${answer}, ${userProfile.location.state}`;
                console.log(`   💡 Fallback: Enhanced with state: "${enhancedLocation}"`);
              } else if (userProfile?.location?.country && userProfile.location.country !== 'United States') {
                enhancedLocation = `${answer}, ${userProfile.location.country}`;
                console.log(`   💡 Fallback: Enhanced with country: "${enhancedLocation}"`);
              } else {
                console.log(`   💡 Fallback: Using original value: "${enhancedLocation}"`);
              }

              // Clear and type enhanced location
              await element.clear();
              await page.waitForTimeout(100);
              await element.fill(enhancedLocation);
              console.log(`   ⌨️  Typed: "${enhancedLocation}"`);
              await page.waitForTimeout(500);

              // Press Enter to accept freeform input
              await page.keyboard.press('Enter');
              await page.waitForTimeout(300);
              console.log(`   ✅ Accepted freeform location input`);
            }
          }

        } else {
          // STRATEGY 2: GPT selection for other autocomplete fields (gender, race, LGBTQ+, etc.)
          console.log(`   🤖 ${fieldType} field detected - using GPT selection strategy`);

          // Click to open dropdown and extract options
            await element.click();
          await page.waitForTimeout(500);

          const extractedOptions = await page.evaluate(() => {
            const selectors = [
              '[role="listbox"] [role="option"]',
              '[role="option"]',
              '.autocomplete-suggestion',
              '.autocomplete-item',
              '[class*="suggestion"]',
              '[class*="dropdown"] li',
              '[class*="menu"] li',
              'ul[role="listbox"] li',
              '.MuiAutocomplete-option',
            ];

            for (const selector of selectors) {
              const options = document.querySelectorAll(selector);
              if (options.length > 0) {
                const visibleOptions = Array.from(options)
                  .filter(opt => {
                  const el = opt as HTMLElement;
                  const style = window.getComputedStyle(el);
                  const rect = el.getBoundingClientRect();
                    return (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    rect.width > 0 &&
                    rect.height > 0
                  );
                  })
                  .map(opt => (opt as HTMLElement).textContent?.trim() || '');

                if (visibleOptions.length > 0 && visibleOptions.length < 50) {
                  return visibleOptions;
                }
              }
            }
            return [];
          });

          console.log(`   📋 Extracted ${extractedOptions.length} options:`, extractedOptions);

          if (extractedOptions.length > 0) {
            // Ask GPT to pick the best option
            console.log(`   🤖 Asking GPT to select best option from list...`);

              try {
                const selectionPrompt = `You are helping fill out a form field.

Field Question: "${question}"
User's intended answer: "${answer}"
Available options from dropdown: ${JSON.stringify(extractedOptions)}

The user wanted to answer "${answer}" but you must pick from the available options.
Which option from the list best represents their intent?

IMPORTANT RULES:
- If the answer is "Prefer not to say", "Prefer not to answer", "N/A", "None" → look for options like "I don't wish to answer", "Prefer not to say", "Decline to answer", "Not applicable", "None"
- If no good match exists → pick the most neutral/harmless option
- Your response must be ONLY the exact text of one option from the list (copy it character-for-character)
- Do NOT add quotes, explanations, or any other text

Return ONLY the option text, nothing else.`;

                const selectionResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                  messages: [
                    {
                      role: 'system',
                      content: 'You are a helpful assistant that picks the best option from a list. Respond with ONLY the option text, nothing else.'
                    },
                    {
                      role: 'user',
                      content: selectionPrompt
                    }
                  ],
                  temperature: 0.1,
                  max_tokens: 100
                });

                const selectedOption = selectionResponse.choices[0].message.content?.trim() || '';
                console.log(`   🎯 GPT selected: "${selectedOption}"`);

              // Close dropdown first
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

              // Type the selected option
            await element.clear();
            await page.waitForTimeout(100);
              await element.fill(selectedOption);
              console.log(`   ⌨️  Typed: "${selectedOption}"`);
              await page.waitForTimeout(800);

              // Click on the matching option
              const clicked = await page.evaluate((matchText) => {
                const selectors = [
                  '[role="listbox"] [role="option"]',
                  '[role="option"]',
                  '.autocomplete-suggestion',
                  '.autocomplete-item',
                  '[class*="suggestion"]',
                  '[class*="dropdown"] li',
                  '[class*="menu"] li',
                  'ul[role="listbox"] li',
                  '.MuiAutocomplete-option',
                ];

                for (const selector of selectors) {
                  const options = document.querySelectorAll(selector);
                  for (const opt of Array.from(options)) {
                    const el = opt as HTMLElement;
                    if (el.textContent?.trim() === matchText) {
                      el.click();
                      return true;
                    }
                  }
                }
                return false;
              }, selectedOption);

            if (clicked) {
              await page.waitForTimeout(300);
                console.log(`   ✅ Clicked on GPT-selected option: "${selectedOption}"`);
            } else {
                // Fallback: press Enter
              await page.keyboard.press('Enter');
              await page.waitForTimeout(300);
              console.log(`   💡 Pressed Enter as fallback`);
            }

            } catch (gptError: any) {
              console.error(`   ⚠️  GPT selection failed: ${gptError.message}`);
              // Fallback: use simple fuzzy match
              const searchTerm = answer.toLowerCase();
              const bestMatch = extractedOptions.find(opt =>
                opt.toLowerCase().includes(searchTerm)
              );

              if (bestMatch) {
                console.log(`   💡 Fallback: Using fuzzy match: "${bestMatch}"`);
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
            await element.clear();
                await element.fill(bestMatch);
                await page.waitForTimeout(800);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(300);
              } else {
                console.log(`   💡 No match found, leaving typed value: "${answer}"`);
              }
          }
        } else {
            console.log(`   ⚠️  No options extracted, typing answer directly: "${answer}"`);
          await element.clear();
          await page.waitForTimeout(100);
          await element.fill(answer);
            await page.waitForTimeout(500);
          }
        }

      } catch (autocompleteError: any) {
        console.error(`   ⚠️  Autocomplete filling failed: ${autocompleteError.message}`);
        // Fallback: just leave the typed value
        console.log(`   💡 Typed value remains in field: "${answer}"`);
      }
    } else if (originalField.type === 'checkbox' && originalField.inputType === 'checkbox') {
      // Handle multi-select checkbox fields (e.g., "How did you hear about us? - select all that apply")
      try {
        console.log(`   ☑️  Detected CHECKBOX field (multi-select)`);

        // Extract all checkboxes in the same group
        const checkboxGroup = await page.evaluate((selector) => {
          const targetEl = document.querySelector(selector);
          if (!targetEl) return [];

          // Find parent container (fieldset, div with role="group", or common parent)
          let container = targetEl.closest('fieldset') ||
                         targetEl.closest('[role="group"]') ||
                         targetEl.closest('div[class*="checkbox"]') ||
                         targetEl.parentElement;

          if (!container) return [];

          // Find all checkboxes in this container
          const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));

          return checkboxes.map((cb: any) => {
            // Find associated label
            let labelText = '';

            // Method 1: label wrapping checkbox
            const wrappingLabel = cb.closest('label');
            if (wrappingLabel) {
              labelText = wrappingLabel.textContent?.trim() || '';
            }

            // Method 2: label with for attribute
            if (!labelText && cb.id) {
              const associatedLabel = container.querySelector(`label[for="${cb.id}"]`);
              if (associatedLabel) {
                labelText = associatedLabel.textContent?.trim() || '';
              }
            }

            // Method 3: next sibling text
            if (!labelText) {
              const nextSibling = cb.nextSibling;
              if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                labelText = nextSibling.textContent?.trim() || '';
              } else if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
                labelText = (nextSibling as HTMLElement).textContent?.trim() || '';
              }
            }

            return {
              selector: cb.id ? `#${cb.id}` : `input[type="checkbox"][name="${cb.name}"]`,
              label: labelText,
              name: cb.name,
              value: cb.value,
              checked: cb.checked
            };
          }).filter(item => item.label); // Only include checkboxes with labels
        }, fieldMapping.selector);

        console.log(`   📋 Found ${checkboxGroup.length} checkboxes in group:`, checkboxGroup.map(c => c.label));

        if (checkboxGroup.length === 0) {
          console.log(`   ⚠️  No checkbox group found - falling back to single checkbox toggle`);
          // Just toggle the single checkbox
          await element.check();
          return { success: true, error: null, skipped: false, fieldLabel: question };
        }

        // Use GPT to select which checkboxes to check
        console.log(`   🤖 Asking GPT to select appropriate checkboxes...`);

        const selectionPrompt = `You are helping fill out a job application form. The user has been asked a multi-select checkbox question.

Question: "${question}"

Available checkbox options:
${checkboxGroup.map((opt, idx) => `${idx + 1}. ${opt.label}`).join('\n')}

User Profile Context:
- Name: ${userProfile?.personalInfo?.firstName || 'Not provided'} ${userProfile?.personalInfo?.lastName || ''}
- Location: ${userProfile?.location?.city || 'Not provided'}, ${userProfile?.location?.state || 'Not provided'}
- Work Authorization: ${userProfile?.demographics?.workAuthorization || 'Not provided'}

TASK: Based on the question and user profile, select ALL checkboxes that apply. Consider:
1. Common job discovery channels (LinkedIn, company website, employee referral, etc.)
2. User's professional context and network
3. Realistic answers (e.g., someone might find jobs through multiple channels)

IMPORTANT RULES:
- Return a JSON array of checkbox labels to check
- Select AT LEAST ONE option (never return empty array)
- If user profile is incomplete or not provided, select the most common/professional option (e.g., "LinkedIn", "Company Website", "Indeed")
- Avoid selecting "Other" unless no better option exists
- Return ONLY valid JSON, no explanation

Example response format:
["LinkedIn", "Company Website"]

Now select the appropriate checkboxes:`;

        const gptResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a precise form-filling assistant. Return ONLY valid JSON arrays of checkbox labels to select. No explanations, no markdown, just the JSON array.'
            },
            {
              role: 'user',
              content: selectionPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 150
        });

        const gptAnswer = gptResponse.choices[0]?.message?.content?.trim() || '[]';
        console.log(`   🤖 GPT Response: ${gptAnswer}`);

        // Parse GPT response
        let selectedLabels: string[] = [];
        try {
          selectedLabels = JSON.parse(gptAnswer);
        } catch (parseError) {
          console.error(`   ⚠️  Failed to parse GPT response, trying to extract array...`);
          // Try to extract array from response
          const arrayMatch = gptAnswer.match(/\[.*\]/s);
          if (arrayMatch) {
            selectedLabels = JSON.parse(arrayMatch[0]);
          } else {
            console.error(`   ⚠️  Could not extract valid JSON array, defaulting to first option`);
            selectedLabels = [checkboxGroup[0].label];
          }
        }

        console.log(`   ✅ Selected checkboxes: ${selectedLabels.join(', ')}`);

        // Check the selected checkboxes
        let checkedCount = 0;
        for (const label of selectedLabels) {
          // Find matching checkbox (fuzzy match)
          const matchingCheckbox = checkboxGroup.find(cb =>
            cb.label.toLowerCase() === label.toLowerCase() ||
            cb.label.toLowerCase().includes(label.toLowerCase()) ||
            label.toLowerCase().includes(cb.label.toLowerCase())
          );

          if (matchingCheckbox) {
            try {
              // Use more specific selector if available
              const checkboxSelector = matchingCheckbox.selector;
              await page.locator(checkboxSelector).first().check();
              console.log(`   ✅ Checked: "${matchingCheckbox.label}"`);
              checkedCount++;
              await page.waitForTimeout(300); // Small delay between checks
            } catch (checkError: any) {
              console.error(`   ⚠️  Failed to check "${matchingCheckbox.label}": ${checkError.message}`);
            }
          } else {
            console.error(`   ⚠️  Could not find checkbox matching "${label}"`);
          }
        }

        if (checkedCount === 0) {
          throw new Error(`Failed to check any checkboxes from GPT selection: ${selectedLabels.join(', ')}`);
        }

        console.log(`   ✅ Successfully checked ${checkedCount} checkbox(es)\n`);
        return { success: true, error: null, skipped: false, fieldLabel: question, value: selectedLabels.join(', ') };

      } catch (checkboxError: any) {
        console.error(`   ⚠️  Checkbox filling failed: ${checkboxError.message}`);
        throw checkboxError;
      }
    } else if (originalField.type === 'textarea') {
      // Handle textarea fields
      try {
      await element.clear();
        await page.waitForTimeout(100);
      await element.fill(answer);
        await page.waitForTimeout(200);
      } catch (textareaError: any) {
        console.error(`   ⚠️  Textarea filling failed: ${textareaError.message}`);
        throw textareaError;
      }
    } else {
      // SMART CHECKBOX DETECTION: Check if element is actually a checkbox before trying to fill
      const isCheckboxElement = await element.evaluate((el) => {
        return el instanceof HTMLInputElement && el.type === 'checkbox';
      });

      if (isCheckboxElement) {
        // This is a single consent/agreement checkbox (not multi-select)
        console.log(`   ☑️  Detected single CHECKBOX (consent/agreement type)`);
        console.log(`   📝 Checkbox question: "${question}"`);
        console.log(`   💡 GPT answer: "${answer}"`);

        // Use ChatGPT to determine if we should check this box
        try {
          const checkboxPrompt = `
You are filling out a job application form. You encountered a checkbox field with this question/label:

"${question}"

The user's answer from their profile data is: "${answer}"

Based on the question and answer, should this checkbox be CHECKED (clicked) or left UNCHECKED?

IMPORTANT RULES:
1. If the question is about consent/GDPR/data processing/privacy and the answer is "yes", "1", "true", or similar → CHECK IT
2. If the question is about terms and conditions and answer is "yes" → CHECK IT
3. If the question asks about agreement/acknowledgment and answer is "yes" → CHECK IT
4. If the answer is "no", "0", "false", or empty → DO NOT CHECK IT
5. If unsure, default to CHECKING it for consent-related questions

Respond with ONLY ONE WORD:
- "CHECK" if the box should be checked
- "UNCHECK" if the box should remain unchecked`;

          const checkboxDecision = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a precise checkbox decision maker for job applications. Respond with only CHECK or UNCHECK.'
              },
              {
                role: 'user',
                content: checkboxPrompt
              }
            ],
            temperature: 0,
            max_tokens: 10
          });

          const decision = checkboxDecision.choices[0].message.content?.trim().toUpperCase() || 'CHECK';
          console.log(`   🤖 GPT Decision: ${decision}`);

          if (decision === 'CHECK') {
            // Check if already checked
            const isAlreadyChecked = await element.isChecked();

            if (!isAlreadyChecked) {
              console.log(`   ✅ Clicking checkbox to CHECK it`);
              await element.click();
              await page.waitForTimeout(300);

              // Verify it was checked
              const nowChecked = await element.isChecked();
              if (nowChecked) {
                console.log(`   ✅ Checkbox successfully CHECKED`);
              } else {
                console.log(`   ⚠️  Checkbox click may not have worked, trying again...`);
                await element.click();
                await page.waitForTimeout(200);
              }
            } else {
              console.log(`   ℹ️  Checkbox already CHECKED, skipping click`);
            }
          } else {
            console.log(`   ℹ️  Leaving checkbox UNCHECKED per GPT decision`);
          }

        } catch (checkboxError: any) {
          console.error(`   ⚠️  Checkbox decision error: ${checkboxError.message}`);
          // Fallback: For consent questions, default to checking
          if (question.toLowerCase().includes('consent') ||
              question.toLowerCase().includes('agree') ||
              question.toLowerCase().includes('acknowledge') ||
              answer === '1' || answer.toLowerCase() === 'yes') {
            console.log(`   💡 Fallback: Checking consent checkbox`);
            const isChecked = await element.isChecked();
            if (!isChecked) {
              await element.click();
              await page.waitForTimeout(300);
            }
          }
        }
      } else {
        // Handle regular text/email/tel/number inputs
        try {
          // Clear existing value
          await element.clear();
          await page.waitForTimeout(100);

          // Fill with new value
          await element.fill(answer);
          await page.waitForTimeout(200);
        } catch (fillError: any) {
          console.error(`   ⚠️  Fill failed: ${fillError.message}`);
          throw fillError;
        }
      }
    }

    console.log(`   ✅ Field filled successfully\n`);
    return { success: true, error: null, skipped: false, fieldLabel: question };

  } catch (error: any) {
    console.error(`   ❌ Error filling field: ${error.message}\n`);
    return { success: false, error: error.message, skipped: false, fieldLabel: question };
  }
}


export async function POST(request: NextRequest) {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║       🚀 AUTO-APPLY INTELLIGENT SYSTEM v2.0                   ║');
    console.log('║       WITH MULTI-PASS & FILE UPLOAD SUPPORT                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log('🎯 Features Enabled:');
    console.log('   ✅ Multi-pass form filling (handles dynamic fields)');
    console.log('   ✅ File upload support (resume/CV)');
    console.log('   ✅ DOM mutation detection');
    console.log('   ✅ 10-second pre-submit wait');
    console.log('   ✅ AI-powered field mapping');
    console.log('📋 Strategy: DOM Extraction → GPT-4 Mapping → Playwright Filling\n');

    const body = await request.json();
    const application = IntelligentApplySchema.parse(body);

    console.log(`📄 Target URL: ${application.url}`);

    const results = {
      totalFields: 0,
      filled: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
      fieldResults: [] as any[],
      submitted: false
    };

    // Step 1: Launch browser (uses Browserless.io in production, local Playwright in development)
    const autoApplyEnabled = application.options?.autoApply === true;

    console.log('🌐 Launching browser...');
    browser = await launchBrowser();

    // Set up recordings directory
    const fs = require('fs');
    const path = require('path');
    const recordingsDir = path.resolve(process.cwd(), 'public/recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
      ...(application.options?.recordVideo && {
        recordVideo: {
          dir: recordingsDir,
          size: { width: 1920, height: 1080 }
        }
      })
    });

    page = await context.newPage();

    // Step 2: Navigate to page
    console.log('📄 Navigating to application page...');
    await page.goto(application.url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Page loaded successfully\n');

    await page.waitForTimeout(2000);

    // Step 2.5: Handle cookie banners (if present)
    console.log('🍪 Checking for cookie banners...');
    try {
      const cookieButtonSelectors = [
        // Accept/Allow buttons (most common)
        'button:has-text("Accept")',
        'button:has-text("Accept all")',
        'button:has-text("Accept All")',
        'button:has-text("Allow")',
        'button:has-text("Allow all")',
        'button:has-text("I accept")',
        'button:has-text("I Accept")',
        'button:has-text("Agree")',
        'button:has-text("I agree")',
        'button:has-text("OK")',
        'button:has-text("Got it")',
        'button:has-text("Continue")',
        '[id*="accept" i]:visible',
        '[id*="cookie" i]:visible:has-text("Accept")',
        '[class*="accept" i]:visible',
        '[class*="cookie" i]:visible:has-text("Accept")',
        // Common cookie banner frameworks
        '#onetrust-accept-btn-handler',
        '.onetrust-close-btn-handler',
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        '.cookie-consent-accept',
        '[data-testid="cookie-banner-accept"]',
        '[aria-label*="Accept" i]',
        '[aria-label*="Allow" i]',
        // Generic close/dismiss
        'button[class*="cookie" i][class*="accept" i]',
        'button[id*="cookie" i][id*="accept" i]',
      ];

      let cookieBannerFound = false;

      for (const selector of cookieButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          const isVisible = await button.isVisible({ timeout: 1000 }).catch(() => false);

          if (isVisible) {
            const buttonText = await button.textContent().catch(() => '');
            console.log(`   ✅ Found cookie banner button: "${buttonText}" (${selector})`);

            await button.click({ timeout: 3000 });
            console.log(`   ✅ Clicked cookie accept button`);

            cookieBannerFound = true;
            await page.waitForTimeout(1000); // Wait for banner to disappear
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!cookieBannerFound) {
        console.log('   ℹ️  No cookie banner detected');
      }
    } catch (cookieError: any) {
      console.log(`   ⚠️  Cookie banner handling failed: ${cookieError.message}`);
      // Continue anyway - not critical
    }

    // Step 2.75: Click Apply button if present (BEFORE form extraction)
    console.log('\n🎯 Checking for Apply/Start Application button...');
    try {
      const applyButtonSelectors = [
        // Common "Apply" button patterns
        'button:has-text("Apply")',
        'a:has-text("Apply")',
        'button:has-text("Apply Now")',
        'a:has-text("Apply Now")',
        'button:has-text("Start Application")',
        'a:has-text("Start Application")',
        'button:has-text("Apply for this job")',
        'a:has-text("Apply for this job")',
        'button:has-text("Submit Application")',
        'button:has-text("Begin Application")',
        'button:has-text("Continue to Application")',
        '[data-testid*="apply" i]',
        '[data-qa*="apply" i]',
        '[aria-label*="Apply" i]',
        '[class*="apply-button" i]',
        '[id*="apply-button" i]',
        // Greenhouse specific
        '#application_form button:has-text("Apply")',
        '.application-form button:has-text("Apply")',
        // Lever specific
        '.posting-apply button',
        // Workday specific
        'button[data-automation-id*="apply" i]',
        // Generic fallbacks
        'button[type="submit"]:has-text("Apply")',
        'input[type="submit"][value*="Apply" i]',
      ];

      let applyButtonClicked = false;

      for (const selector of applyButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          const isVisible = await button.isVisible({ timeout: 1000 }).catch(() => false);

          if (isVisible) {
            // Get button text for logging
            const buttonText = await button.textContent().catch(() => '') ||
                              await button.getAttribute('value').catch(() => '') ||
                              await button.getAttribute('aria-label').catch(() => '') ||
                              'Apply button';

            console.log(`   ✅ Found Apply button: "${buttonText.trim()}" (${selector})`);

            // Check if button is enabled
            const isDisabled = await button.isDisabled().catch(() => false);
            if (isDisabled) {
              console.log(`   ⚠️  Button is disabled, skipping...`);
              continue;
            }

            // Scroll button into view
            await button.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);

            // Click the button
            await button.click({ timeout: 5000 });
            console.log(`   ✅ Clicked Apply button`);

            applyButtonClicked = true;

            // Wait for form to appear (network activity + DOM changes)
            console.log(`   ⏳ Waiting for application form to load...`);
            try {
              await page.waitForLoadState('networkidle', { timeout: 10000 });
              console.log(`   ✅ Network activity settled`);
            } catch (networkError) {
              console.log(`   💡 Network did not settle (timeout) - continuing...`);
            }

            // Wait for potential DOM mutations (form appearing)
            await page.waitForTimeout(2000);

            // Check if form appeared by looking for form fields
            const hasFormFields = await page.evaluate(() => {
              const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
              const selects = document.querySelectorAll('select');
              const textareas = document.querySelectorAll('textarea');
              return inputs.length > 0 || selects.length > 0 || textareas.length > 0;
            });

            if (hasFormFields) {
              console.log(`   ✅ Application form detected after clicking Apply`);
            } else {
              console.log(`   ℹ️  No form fields detected yet (may appear later)`);
            }

            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!applyButtonClicked) {
        console.log('   ℹ️  No Apply button found (form may already be visible)');
      }
    } catch (applyButtonError: any) {
      console.log(`   ⚠️  Apply button handling failed: ${applyButtonError.message}`);
      // Continue anyway - form may already be visible
    }

    // Step 3: MULTI-PASS FORM FILLING
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  🔄 MULTI-PASS INTELLIGENT FORM FILLING SYSTEM ACTIVE    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('📝 This system detects and fills dynamic/conditional fields');
    console.log('   that appear after filling previous fields.\n');

    const MAX_PASSES = 2;
    let allFilledFields: any[] = [];
    let currentPass = 1;

    console.log(`⚙️  Configuration:`);
    console.log(`   Max passes: ${MAX_PASSES}`);
    console.log(`   Mutation timeout: 3000ms`);
    console.log(`   Between-field delay: 500ms\n`);

    while (currentPass <= MAX_PASSES) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`║ 📋 PASS ${currentPass} OF ${MAX_PASSES}: EXTRACTING FORM FIELDS`);
      console.log('═'.repeat(70));

      const currentFormFields = await extractFormFields(page);

      if (currentFormFields.length === 0) {
        console.log('⚠️  No form fields found on the page');
        if (currentPass === 1) {
      throw new Error('No form fields found on the page');
        }
        break;
      }

      let fieldsToProcess = currentFormFields;
      if (currentPass > 1) {
        console.log(`\n🔍 CHECKING FOR NEW FIELDS (Pass ${currentPass})...`);
        fieldsToProcess = getNewFields(currentFormFields, allFilledFields);

        if (fieldsToProcess.length === 0) {
          console.log(`\n✅✅✅ NO NEW FIELDS DETECTED! ✅✅✅`);
          console.log(`🎉 Form filling complete after ${currentPass - 1} passes.`);
          console.log(`📊 Total fields filled: ${allFilledFields.length}`);
          break;
        }

        console.log(`\n🆕🆕🆕 FOUND ${fieldsToProcess.length} NEW DYNAMIC FIELDS! 🆕🆕🆕`);
        console.log(`💡 These fields appeared after filling previous fields.`);
      } else {
        console.log(`\n📝 INITIAL PASS: Found ${fieldsToProcess.length} fields to fill`);
        results.totalFields = fieldsToProcess.length;
      }

      const fieldMappings = await getAIFieldMapping(fieldsToProcess, application.userProfile);

      console.log('\n🎯 Filling fields...\n');
    console.log('═'.repeat(60));

      const fieldsToFill = Math.min(fieldMappings.length, fieldsToProcess.length);

      if (fieldMappings.length < fieldsToProcess.length) {
        console.log(`⚠️  Only filling ${fieldMappings.length} out of ${fieldsToProcess.length} fields (AI response incomplete)`);
    }

    for (let i = 0; i < fieldsToFill; i++) {
      const mapping = fieldMappings[i];
        const originalField = fieldsToProcess[i];

        // Add resume file data to mapping if needed
        if (mapping.answer === '[RESUME_FILE]' && application.userProfile.resume) {
          mapping.resumeFile = {
            fileName: application.userProfile.resume.fileName,
            fileBase64: application.userProfile.resume.fileBase64,
            mimeType: application.userProfile.resume.mimeType
          };
          console.log(`   📎 Attaching resume file: ${mapping.resumeFile.fileName}`);
        }

      const result = await fillField(page, mapping, originalField, application.userProfile);
      results.fieldResults.push(result);

      if (result.skipped) {
        results.skipped++;
      } else if (result.success) {
        results.filled++;
          allFilledFields.push(originalField);
      } else {
        results.failed++;
        results.errors.push(result.error || 'Unknown error');
      }

      await page.waitForTimeout(500);
    }

      console.log(`\n✅✅✅ PASS ${currentPass} COMPLETE! ✅✅✅`);
      console.log(`   📊 Fields filled this pass: ${fieldMappings.length}`);
      console.log(`   📊 Total fields filled so far: ${allFilledFields.length}`);

      if (currentPass < MAX_PASSES) {
        console.log(`\n🔄 Checking if new fields will appear...`);
        await waitForDynamicFields(page, 3000);
      }

      currentPass++;
    }

    if (currentPass > MAX_PASSES) {
      console.log(`\n⚠️⚠️⚠️  WARNING: Reached maximum of ${MAX_PASSES} passes! ⚠️⚠️⚠️`);
    }

    results.totalFields = allFilledFields.length;

    console.log(`\n${'═'.repeat(70)}`);
    console.log('🏁 MULTI-PASS FORM FILLING COMPLETE');
    console.log('═'.repeat(70));

    // VALIDATE ALL FIELDS ARE FILLED - Enhanced validation
    console.log('\n🔍 VALIDATING ALL FIELDS ARE FILLED...');
    const emptyFields = await page.evaluate(() => {
      const empty: Array<{label: string, type: string, required: boolean}> = [];

      // Check all input fields
      const inputs = document.querySelectorAll('input:not([type="hidden"])');
      inputs.forEach((input: any) => {
        const isRequired = input.hasAttribute('required') ||
                          input.getAttribute('aria-required') === 'true' ||
                          input.closest('[required]') !== null;

        if (isRequired && (!input.value || input.value.trim() === '')) {
          const label = input.labels?.[0]?.textContent?.trim() ||
                       input.placeholder ||
                       input.name ||
                       'Unknown field';
          empty.push({ label, type: input.type, required: true });
        }
      });

      // Check all select dropdowns
      const selects = document.querySelectorAll('select');
      selects.forEach((select: any) => {
        const isRequired = select.hasAttribute('required') ||
                          select.getAttribute('aria-required') === 'true';

        if (isRequired && (select.selectedIndex <= 0 || !select.value || select.value === '')) {
          const label = select.labels?.[0]?.textContent?.trim() ||
                       select.name ||
                       'Unknown dropdown';
          empty.push({ label, type: 'select', required: true });
        }
      });

      // Check all textareas
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach((textarea: any) => {
        const isRequired = textarea.hasAttribute('required') ||
                          textarea.getAttribute('aria-required') === 'true';

        if (isRequired && (!textarea.value || textarea.value.trim() === '')) {
          const label = textarea.labels?.[0]?.textContent?.trim() ||
                       textarea.placeholder ||
                       textarea.name ||
                       'Unknown textarea';
          empty.push({ label, type: 'textarea', required: true });
        }
      });

      return empty;
    });

    if (emptyFields.length > 0) {
      console.log(`\n⚠️⚠️⚠️  WARNING: ${emptyFields.length} REQUIRED FIELDS ARE STILL EMPTY! ⚠️⚠️⚠️`);
      emptyFields.forEach((field, idx) => {
        console.log(`   ${idx + 1}. [${field.type}] "${field.label}" - EMPTY/NOT FILLED`);
      });
      console.log(`\n❌ CRITICAL: Not all required fields were filled. Form submission may fail.`);
    } else {
      console.log(`   ✅ All required fields appear to be filled!`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 FORM FILLING SUMMARY:');
    console.log(`   Total fields: ${results.totalFields}`);
    console.log(`   ✅ Filled: ${results.filled}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   🚨 Empty required fields: ${emptyFields.length}`);

    // Calculate completion rate
    const completionRate = results.totalFields > 0
      ? Math.round((results.filled / results.totalFields) * 100)
      : 0;
    console.log(`   📊 Completion rate: ${completionRate}%`);

    // Check if we should proceed with submission
    const shouldSubmit = completionRate >= 50 && emptyFields.length === 0;
    if (!shouldSubmit && application.options?.submitForm !== false) {
      if (emptyFields.length > 0) {
        console.log(`   ⚠️  WARNING: ${emptyFields.length} required fields still empty - may not submit form`);
      } else {
        console.log(`   ⚠️  WARNING: Only ${completionRate}% of fields filled - may not submit form`);
      }
    }

    // Step 6: Scroll to top to show complete form in final screenshot
    console.log('\n📜 Scrolling to top for final view...');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    // Step 7: Take screenshot BEFORE submitting (so we can see filled form)
    let screenshotPath: string | undefined;
    let sessionId: string | null = null; // Declare at higher scope for later use
    const screenshotsDir = path.resolve(process.cwd(), 'public/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    try {
      const screenshotFileName = `intelligent-apply-${Date.now()}.png`;
      const screenshotFullPath = path.resolve(screenshotsDir, screenshotFileName);
      await page.screenshot({ path: screenshotFullPath, fullPage: true });
      screenshotPath = `/screenshots/${screenshotFileName}`;
      console.log('📸 Screenshot saved:', screenshotPath);
    } catch (error: any) {
      console.log('⚠️  Could not save screenshot:', error.message);
    }

    // Step 8: PAUSE FOR USER REVIEW (Option A)
    console.log(`\n📋 Form filling complete - preparing for user review...`);
    console.log(`   Completion rate: ${completionRate}%`);
    console.log(`   shouldSubmit (${completionRate}% >= 50%): ${shouldSubmit ? 'YES' : 'NO'}`);

    if (application.options?.submitForm !== false) {
      if (shouldSubmit) {
        // Check if auto-apply is enabled
        const autoApplyEnabled = application.options?.autoApply === true;
        
        if (autoApplyEnabled) {
          console.log('\n🚀 AUTO-APPLY MODE ENABLED - PROCEEDING WITH AUTOMATIC SUBMISSION');
        console.log('╔════════════════════════════════════════════════════════════════╗');
          console.log('║  🤖 FORM FILLED - SUBMITTING AUTOMATICALLY                   ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');
          console.log('🎯 Auto-Apply Steps:');
          console.log('   1. Form has been filled automatically');
          console.log('   2. Will attempt to submit form automatically');
          console.log('   3. No user review required');
          console.log('   4. Application will be submitted immediately');
        console.log('');
        } else {
          console.log('\n🔄 OPENING BROWSER FOR USER REVIEW');
          console.log('╔════════════════════════════════════════════════════════════════╗');
          console.log('║  📋 FORM FILLED - OPENING BROWSER FOR REVIEW & SUBMIT        ║');
          console.log('╚════════════════════════════════════════════════════════════════╝');
          console.log('');
          console.log('🎯 Apply & Review Mode:');
          console.log('   1. Form has been filled in headless mode');
          console.log('   2. Opening visible browser for user review');
          console.log('   3. User can review all filled fields');
          console.log('   4. User manually submits when ready');
          console.log('   5. Browser will remain open until user closes it');
          console.log('');
        }

        // Log any failed fields for debugging
        if (results.failed > 0) {
          console.log(`   ⚠️  Note: ${results.failed} fields failed to fill:`);
          const failedFields = results.fieldResults.filter(r => !r.success && !r.skipped);
          failedFields.forEach(field => {
            console.log(`      - ${field.fieldLabel}: ${field.error}`);
          });
        }

        // WAIT 10 SECONDS FOR FILE UPLOADS TO COMPLETE
        console.log('⏳ Waiting 10 seconds for file uploads to complete...');
        for (let i = 10; i > 0; i--) {
          console.log(`   ⏰ ${i} seconds remaining...`);
          await page.waitForTimeout(1000);
        }
        console.log('✅ File upload wait complete\n');

        // EXTRACT JOB INFO
        const jobInfo = await extractJobInfo(page);

        // CREATE SUPABASE SESSION FOR BOTH MODES (for tracking purposes)
        console.log('💾 Creating session in database for tracking...');
        const filledAt = new Date();
        const expiresAt = new Date(filledAt.getTime() + 15 * 60 * 1000); // 15 minutes from now

        // Prepare filled form data for re-filling
        const filledFormData = results.fieldResults
          .filter(r => r.success && !r.skipped)
          .map(r => ({
            fieldLabel: r.fieldLabel,
            value: r.value,
            fieldType: r.fieldType,
          }));

        // Set status based on mode
        const sessionStatus = autoApplyEnabled ? 'submitted' : 'awaiting_review';
        const closedAt = autoApplyEnabled ? new Date().toISOString() : null; // Close auto-submitted sessions immediately

        try {
          const { data: session, error: sessionError } = await supabase
            .from('auto_apply_sessions')
            .insert({
              user_id: application.userId || null, // Use provided userId or NULL
              job_url: application.url,
              job_title: jobInfo.jobTitle || null,
              company_name: jobInfo.companyName || null,
              status: sessionStatus,
              total_fields: results.totalFields,
              fields_filled: results.filled,
              fields_skipped: results.skipped,
              fields_failed: results.failed,
              success_rate: Math.round((results.filled / results.totalFields) * 100),
              filled_at: filledAt.toISOString(),
              expires_at: expiresAt.toISOString(),
              closed_at: closedAt, // Set closed_at for manual submissions
              field_errors: results.errors.length > 0 ? results.errors : null,
              screenshot_path: screenshotPath || null,
              filled_form_data: autoApplyEnabled ? filledFormData : null, // Only save for auto-apply
              user_profile_data: autoApplyEnabled ? application.userProfile : null, // Only save for auto-apply
            })
            .select('id')
            .single();

          if (sessionError) {
            console.log('⚠️  Could not create session in database:', sessionError.message);
          } else if (session) {
            sessionId = session.id;
            console.log(`✅ Session created with ID: ${sessionId} (Status: ${sessionStatus})`);

            // SEND NOTIFICATION TO USER (only for auto-apply mode)
            if (autoApplyEnabled) {
            try {
              console.log('📬 Sending notification to user...');
              const notifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'form_filled',
                  sessionId: sessionId,
                  userId: application.userId || null,
                  message: 'Your application form has been filled and is ready for review'
                })
              });

              if (notifyResponse.ok) {
                console.log('✅ Notification sent successfully');
              } else {
                console.log('⚠️  Could not send notification:', await notifyResponse.text());
              }
            } catch (notifyError: any) {
              console.log('⚠️  Notification error:', notifyError.message);
              }
            }
          }
        } catch (dbError: any) {
          console.log('⚠️  Database error:', dbError.message);
        }

        // Handle auto-submit or manual review
        if (autoApplyEnabled) {
          console.log('\n🤖 AUTO-APPLY MODE: Attempting automatic form submission...');

          let validationErrors: Array<{field: string, message: string}> = [];
          
          try {
            // Look for submit buttons
            const submitButton = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
              
              // Look for submit-like buttons
              const submitKeywords = ['submit', 'apply', 'send', 'continue', 'next', 'finish', 'complete'];
              
              for (const button of buttons) {
                const text = (button.textContent || '').toLowerCase().trim();
                const value = (button as any).value?.toLowerCase() || '';
                const type = (button as any).type?.toLowerCase() || '';
                
                // Check if it's a submit button
                if (type === 'submit' || 
                    submitKeywords.some(keyword => text.includes(keyword) || value.includes(keyword))) {
                  return {
                    found: true,
                    text: button.textContent?.trim() || value,
                    selector: button.tagName.toLowerCase() + 
                             (button.id ? `#${button.id}` : '') + 
                             (button.className ? `.${button.className.split(' ').join('.')}` : '')
                  };
                }
              }
              
              return { found: false };
            });
            
            if (submitButton.found) {
              console.log(`🎯 Found submit button: "${submitButton.text}"`);
              console.log('⚡ Clicking submit button...');
              
              // Click the submit button
              await page.click('button:has-text("' + submitButton.text + '"), input[type="submit"]');
              
              // Wait for submission to process
              console.log('⏳ Waiting for form submission...');
              await page.waitForTimeout(3000);

              // Check for validation errors FIRST (before email verification)
              console.log('\n🔍 Checking for validation errors...');
              const validationErrors = await page.evaluate(() => {
                const errors: Array<{field: string, message: string}> = [];

                // Common error selectors
                const errorSelectors = [
                  '.error',
                  '.field-error',
                  '.invalid-feedback',
                  '[class*="error"]',
                  '[class*="Error"]',
                  '[role="alert"]',
                  '.text-red-500',
                  '.text-danger',
                  '[aria-invalid="true"]',
                  'span[class*="required"]',
                  'div[class*="validation"]'
                ];

                for (const selector of errorSelectors) {
                  const errorElements = document.querySelectorAll(selector);
                  errorElements.forEach(el => {
                    const errorText = el.textContent?.trim();
                    if (errorText && errorText.length > 0 && errorText.length < 200) {
                      // Try to find associated field label
                      let fieldName = 'Unknown field';

                      // Look for parent with label
                      const parent = el.closest('.form-group, .field, [class*="field"], label');
                      if (parent) {
                        const label = parent.querySelector('label');
                        if (label) {
                          fieldName = label.textContent?.trim() || fieldName;
                        }
                      }

                      // Look for previous sibling label
                      const prevLabel = el.previousElementSibling;
                      if (prevLabel && prevLabel.tagName === 'LABEL') {
                        fieldName = prevLabel.textContent?.trim() || fieldName;
                      }

                      errors.push({
                        field: fieldName,
                        message: errorText
                      });
                    }
                  });
                }

                // Also check for invalid input fields with HTML5 validation
                const invalidInputs = document.querySelectorAll('input:invalid, select:invalid, textarea:invalid');
                invalidInputs.forEach(input => {
                  const inputEl = input as HTMLInputElement;
                  if (inputEl.validationMessage) {
                    const fieldName = inputEl.labels?.[0]?.textContent?.trim() ||
                                     inputEl.placeholder ||
                                     inputEl.name ||
                                     'Unknown field';

                    errors.push({
                      field: fieldName,
                      message: inputEl.validationMessage
                    });
                  }
                });

                // Remove duplicates
                const uniqueErrors = errors.filter((error, index, self) =>
                  index === self.findIndex(e => e.field === error.field && e.message === error.message)
                );

                return uniqueErrors;
              });

              console.log(`   Found ${validationErrors.length} validation error(s)`);
              if (validationErrors.length > 0) {
                console.log('   Validation errors:', validationErrors);

                // If we only have generic errors (like "*"), try to find actual missing required fields
                const hasOnlyGenericErrors = validationErrors.every(e =>
                  e.message === '*' || e.message.length < 3 || e.field === 'Unknown field'
                );

                if (hasOnlyGenericErrors) {
                  console.log('   ⚠️  Only generic validation errors found - searching for unfilled required fields...');

                  // Find all required fields that are empty
                  const missingRequiredFields = await page.evaluate(() => {
                    const missing: Array<{field: string, selector: string}> = [];

                    // Find all required inputs that are empty
                    const requiredInputs = document.querySelectorAll('input[required], select[required], textarea[required]');
                    requiredInputs.forEach(input => {
                      const inputEl = input as HTMLInputElement;
                      const isEmpty = !inputEl.value || inputEl.value.trim() === '';

                      if (isEmpty) {
                        const fieldName = inputEl.labels?.[0]?.textContent?.trim() ||
                                         inputEl.placeholder ||
                                         inputEl.name ||
                                         inputEl.id ||
                                         'Unknown field';

                        missing.push({
                          field: fieldName,
                          selector: inputEl.id ? `#${inputEl.id}` : inputEl.name ? `[name="${inputEl.name}"]` : ''
                        });
                      }
                    });

                    // Also check for fields marked with asterisk that are empty
                    const asteriskFields = document.querySelectorAll('label:has(span:contains("*")), label:contains("*")');
                    asteriskFields.forEach(label => {
                      const input = label.querySelector('input, select, textarea') ||
                                   document.getElementById(label.getAttribute('for') || '');

                      if (input) {
                        const inputEl = input as HTMLInputElement;
                        const isEmpty = !inputEl.value || inputEl.value.trim() === '';

                        if (isEmpty) {
                          const fieldName = label.textContent?.trim() || 'Unknown field';
                          missing.push({
                            field: fieldName,
                            selector: inputEl.id ? `#${inputEl.id}` : inputEl.name ? `[name="${inputEl.name}"]` : ''
                          });
                        }
                      }
                    });

                    return missing;
                  });

                  if (missingRequiredFields.length > 0) {
                    console.log(`   🔍 Found ${missingRequiredFields.length} unfilled required fields:`);
                    missingRequiredFields.forEach(field => {
                      console.log(`      - ${field.field} (${field.selector})`);
                    });

                    // Update validation errors with specific fields
                    validationErrors.length = 0; // Clear generic errors
                    missingRequiredFields.forEach(field => {
                      validationErrors.push({
                        field: field.field,
                        message: 'Required field is empty'
                      });
                    });
                  }
                }
              }

              // Check for email verification requirement
              console.log('\n🔍 Checking if email verification is required...');
              const verificationCheck = await detectEmailVerification(page);

              if (verificationCheck.needsVerification && application.userId) {
                console.log('📧 Email verification required - attempting to handle automatically...');

                // Extract company domain for email filtering
                const companyDomain = extractCompanyDomain(application.url);

                // Handle email verification
                const verificationResult = await handleEmailVerification(
                  page,
                  application.userId,
                  verificationCheck,
                  {
                    maxWaitTime: 90000, // 1.5 minutes
                    checkInterval: 5000, // Check every 5 seconds
                    companyDomain
                  }
                );

                if (verificationResult.success) {
                  console.log('✅ Email verification completed successfully!');
                  console.log(`   ${verificationResult.message}`);

                  // Wait for any post-verification redirects
                  await page.waitForTimeout(3000);
                } else {
                  console.log('⚠️  Email verification failed or timed out');
                  console.log(`   ${verificationResult.message}`);
                  console.log('   User may need to complete verification manually');
                }
              }
              
              // Check if we were redirected or if there's a success message
              const currentUrl = page.url();
              const hasSuccessMessage = await page.evaluate(() => {
                const successKeywords = ['success', 'submitted', 'thank you', 'received', 'confirmation'];
                const pageText = document.body.textContent?.toLowerCase() || '';
                return successKeywords.some(keyword => pageText.includes(keyword));
              });
              
              // Determine if submission was successful based on errors and success indicators
              const hasValidationErrors = validationErrors.length > 0;
              const submissionSuccessful = !hasValidationErrors && (currentUrl !== application.url || hasSuccessMessage);

              if (submissionSuccessful) {
                console.log('✅ Form appears to have been submitted successfully!');
                console.log(`   Original URL: ${application.url}`);
                console.log(`   Current URL: ${currentUrl}`);
                
                // Update session status to submitted
        if (sessionId) {
              await supabase
                .from('auto_apply_sessions')
                .update({
                      status: 'submitted',
                      closed_at: new Date().toISOString(),
                      validation_errors: null
                })
                .eq('id', sessionId);

                  console.log('✅ Session marked as submitted in database');
                }
                
                results.submitted = true;
              } else if (hasValidationErrors) {
                console.log('⚠️  Form submission failed due to validation errors!');
                console.log(`   Found ${validationErrors.length} error(s)`);

                // Try to re-extract and fill missing fields, then retry submission
                console.log('\n🔄 ATTEMPTING TO FIX VALIDATION ERRORS AND RETRY...');

                try {
                  // Re-extract form fields to capture any that may have been missed
                  const retryFormFields = await extractFormFields(page);
                  console.log(`   📋 Found ${retryFormFields.length} total fields on page`);

                  // Use GPT to map fields again
                  const retryFieldMappings = await getAIFieldMapping(retryFormFields, application.userProfile);

                  // Fill any fields that are currently empty
                  let retryFilled = 0;
                  for (let i = 0; i < Math.min(retryFieldMappings.length, retryFormFields.length); i++) {
                    const mapping = retryFieldMappings[i];
                    const field = retryFormFields[i];

                    // Check if field is empty
                    const isEmpty = await page.evaluate((selector) => {
                      const element = document.querySelector(selector);
                      if (!element) return false;
                      const inputEl = element as HTMLInputElement;
                      return !inputEl.value || inputEl.value.trim() === '';
                    }, field.selector);

                    if (isEmpty && mapping.answer) {
                      console.log(`   🔧 Filling missing field: ${field.label}`);
                      const fillResult = await fillField(page, mapping, field, application.userProfile);
                      if (fillResult.success) {
                        retryFilled++;
                      }
                      await page.waitForTimeout(300);
                    }
                  }

                  console.log(`   ✅ Re-filled ${retryFilled} missing fields`);

                  if (retryFilled > 0) {
                    console.log('\n🔄 RETRYING FORM SUBMISSION...');
                    await page.waitForTimeout(1000);

                    // Click submit button again
                    await page.click('button:has-text("' + submitButton.text + '"), input[type="submit"]');
                    await page.waitForTimeout(3000);

                    // Check for validation errors again
                    const retryValidationErrors = await page.evaluate(() => {
                      const errors: Array<{field: string, message: string}> = [];
                      const errorSelectors = [
                        '.error', '.field-error', '.invalid-feedback',
                        '[class*="error"]', '[role="alert"]', '.text-red-500'
                      ];

                      for (const selector of errorSelectors) {
                        const errorElements = document.querySelectorAll(selector);
                        errorElements.forEach(el => {
                          const errorText = el.textContent?.trim();
                          if (errorText && errorText.length > 0 && errorText.length < 200) {
                            errors.push({
                              field: 'Unknown field',
                              message: errorText
                            });
                          }
                        });
                      }
                      return errors;
                    });

                    // Check for success
                    const retryCurrentUrl = page.url();
                    const retryHasSuccess = await page.evaluate(() => {
                      const successKeywords = ['success', 'submitted', 'thank you', 'received'];
                      const pageText = document.body.textContent?.toLowerCase() || '';
                      return successKeywords.some(keyword => pageText.includes(keyword));
                    });

                    if (retryValidationErrors.length === 0 && (retryCurrentUrl !== application.url || retryHasSuccess)) {
                      console.log('✅ RETRY SUCCESSFUL! Form submitted after fixing validation errors');

                      if (sessionId) {
                        await supabase
                          .from('auto_apply_sessions')
                          .update({
                            status: 'submitted',
                            closed_at: new Date().toISOString(),
                            validation_errors: null
                          })
                          .eq('id', sessionId);
                      }

                      results.submitted = true;
                      validationErrors.length = 0; // Clear errors
                    } else {
                      console.log('❌ RETRY FAILED - Still have validation errors or no success detected');
                      console.log(`   Errors: ${retryValidationErrors.length}, URL changed: ${retryCurrentUrl !== application.url}`);

                      // Update session with validation errors
                      if (sessionId) {
                        await supabase
                          .from('auto_apply_sessions')
                          .update({
                            status: 'failed',
                            validation_errors: retryValidationErrors.length > 0 ? retryValidationErrors : validationErrors,
                            closed_at: new Date().toISOString()
                          })
                          .eq('id', sessionId);
                      }

                      results.submitted = false;
                    }
                  } else {
                    console.log('   ⚠️  No empty fields found to fill - marking as failed');

                    // Update session with validation errors
                    if (sessionId) {
                      await supabase
                        .from('auto_apply_sessions')
                        .update({
                          status: 'failed',
                          validation_errors: validationErrors,
                          closed_at: new Date().toISOString()
                        })
                        .eq('id', sessionId);
                    }

                    results.submitted = false;
                  }
                } catch (retryError: any) {
                  console.log('❌ Error during retry:', retryError.message);

                  // Update session with validation errors
                  if (sessionId) {
                    await supabase
                      .from('auto_apply_sessions')
                      .update({
                        status: 'failed',
                        validation_errors: validationErrors,
                        closed_at: new Date().toISOString()
                      })
                      .eq('id', sessionId);
                  }

                  results.submitted = false;
                }
              } else {
                console.log('⚠️  Form submission unclear - may need manual review');
              }
            } else {
              console.log('⚠️  No submit button found - form may need manual submission');
            }
          } catch (submitError: any) {
            console.log('❌ Error during auto-submit:', submitError.message);
          }
          
          // SEND NOTIFICATION FOR AUTO-APPLY COMPLETION
          if (sessionId) {
            try {
              console.log('📬 Sending auto-apply completion notification...');

              let notificationMessage = '';
              let notificationType: 'auto_apply_submitted' | 'auto_apply_completed' | 'error' = 'auto_apply_completed';

              if (validationErrors.length > 0) {
                notificationType = 'error';
                notificationMessage = `Application submission failed with ${validationErrors.length} validation error(s). Please review and fix the issues.`;
              } else if (results.submitted) {
                notificationType = 'auto_apply_submitted';
                notificationMessage = 'Your application has been automatically submitted! Check the details below.';
              } else {
                notificationMessage = 'Your application form has been filled automatically. Please review the submission status.';
              }
              
                const notifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                  type: notificationType,
                    sessionId: sessionId,
                    userId: application.userId || null,
                  message: notificationMessage,
                  autoApplied: true,
                  submitted: results.submitted,
                  validationErrors: validationErrors.length > 0 ? validationErrors : undefined
                  })
                });

                if (notifyResponse.ok) {
                console.log('✅ Auto-apply notification sent successfully');
                } else {
                console.log('⚠️  Could not send auto-apply notification:', await notifyResponse.text());
                }
              } catch (notifyError: any) {
              console.log('⚠️  Auto-apply notification error:', notifyError.message);
            }
          }

          console.log('\n╔══════════════════════════════════════════════════════════╗');
          console.log('║  🤖 AUTO-APPLY COMPLETED                                ║');
          console.log('╚══════════════════════════════════════════════════════════╝\n');
        } else {
          // APPLY & REVIEW MODE: Bring the minimized browser to front
          console.log('\n🌐 APPLY & REVIEW MODE: Bringing browser to front for user review...');
          
          try {
            // Bring the current page to front (the browser was launched minimized)
            console.log('🚀 Bringing browser window to front...');
            await page.bringToFront();
            
            // Optional: Focus the window to ensure it's active
            await page.evaluate(() => {
              window.focus();
            });

              console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║  ✅ FORM FILLED - BROWSER READY FOR USER REVIEW         ║');
              console.log('╚══════════════════════════════════════════════════════════╝');
              console.log('');
              console.log('🎯 Apply & Review Mode Active:');
            console.log('   🌐 Browser window brought to front');
            console.log('   📝 Form has been pre-filled (same session, same page)');
              console.log('   👀 User can review all filled fields');
              console.log('   ✏️  User can make any necessary changes');
              console.log('   📤 User manually submits when ready');
              console.log('   🌐 Browser will remain open until user closes it');
              console.log('');
            console.log('📋 Fill Summary:');
            console.log(`   ✅ Filled: ${results.filled}`);
            console.log(`   ⏭️  Skipped: ${results.skipped}`);
            console.log(`   ❌ Failed: ${results.failed}`);
            
            // Note: We don't close the browser - user will close it manually
            // The browser will remain open for the user to review and submit
            
          } catch (bringToFrontError: any) {
            console.log('❌ Error bringing browser to front:', bringToFrontError.message);
            console.log('⚠️  Browser may still be minimized, but form is filled...');
            
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║  ⚠️  FORM FILLED - BROWSER MAY BE MINIMIZED             ║');
            console.log('╚══════════════════════════════════════════════════════════╝\n');
          }
        }
        
        // Log session details for both modes
        console.log('📋 Form filled successfully!');
        console.log('📸 Screenshot captured');
        if (autoApplyEnabled) {
          console.log('⏰ Session created with 15-minute expiry');
          console.log('📬 User can review via session link');
      } else {
          console.log('📊 Session created for tracking purposes');
          console.log('🌐 Browser opened for manual submission');
        }
        if (sessionId) {
          console.log(`🔑 Session ID: ${sessionId}`);
          console.log('✅ Returning session to frontend immediately\n');
    } else {
          console.log('');
    }

        // Save video recording before returning (only for auto-apply mode)
    let videoPath: string | undefined;
        if (application.options?.recordVideo && autoApplyEnabled) {
      try {
            console.log('🎬 Finalizing video recording...');
        await page.waitForTimeout(500); // Let video capture final state
        const videoFilePath = await page.video()?.path();

            // Close context to finalize video (only if not already closed)
            try {
        await context.close();
            } catch (closeError: any) {
              // Context may already be closed, ignore error
              console.log('⚠️  Context already closed or error closing:', closeError.message);
            }

        if (videoFilePath) {
          const videoFileName = `intelligent-apply-${Date.now()}.webm`;
          const publicVideoPath = path.resolve(recordingsDir, videoFileName);

          fs.copyFileSync(videoFilePath, publicVideoPath);
          videoPath = `/recordings/${videoFileName}`;
          console.log('🎥 Recording saved:', videoPath);

              // Update session with video path (only for auto-apply mode)
              if (sessionId) {
                await supabase
                  .from('auto_apply_sessions')
                  .update({ video_path: videoPath })
                  .eq('id', sessionId);
                console.log('✅ Session updated with video path');
              }
        }
      } catch (videoError: any) {
        console.log('⚠️  Could not save recording:', videoError.message);
      }
    }

    // Upload screenshot and video to Supabase Storage (async, don't block response)
    if (sessionId && autoApplyEnabled && (screenshotPath || videoPath)) {
      // Convert relative paths to absolute file system paths
      const screenshotFilePath = screenshotPath
        ? path.resolve(process.cwd(), 'public', screenshotPath.replace(/^\//, ''))
        : undefined;
      const videoFilePath = videoPath
        ? path.resolve(process.cwd(), 'public', videoPath.replace(/^\//, ''))
        : undefined;

      // Upload in background (don't await)
      uploadSessionMedia(sessionId, screenshotFilePath, videoFilePath).then(async (result) => {
        if (result.screenshotUrl || result.videoUrl) {
          // Update session with public URLs
          await supabase
            .from('auto_apply_sessions')
            .update({
              screenshot_url: result.screenshotUrl || null,
              video_url: result.videoUrl || null,
            })
            .eq('id', sessionId);
          console.log('✅ Session updated with Supabase Storage URLs');
        }
        if (result.error) {
          console.error('⚠️  Error uploading media to Supabase:', result.error);
        }
      }).catch(err => {
        console.error('⚠️  Failed to upload session media:', err);
      });
        } else if (autoApplyEnabled) {
          // Close context if no video recording and auto-apply mode
          try {
      await context.close();
          } catch (closeError: any) {
            // Context may already be closed, ignore error
            console.log('⚠️  Context already closed or error closing:', closeError.message);
          }
        }
        // Note: For manual review mode, context is already closed in the visible browser section

        // Calculate success rate
        const successRate = results.totalFields > 0
          ? Math.round((results.filled / results.totalFields) * 100)
          : 0;

        return NextResponse.json({
          success: true,
          message: autoApplyEnabled 
            ? 'Form filled and submitted automatically!' 
            : 'Form filled successfully! Browser opened for review and manual submission.',
          sessionId: sessionId || undefined, // Return sessionId for both modes now
          fieldsFilled: results.filled,
          fieldsAttempted: results.totalFields,
          successRate,
          fieldResults: results.fieldResults,
          errors: results.errors,
          screenshotPath: autoApplyEnabled ? screenshotPath : undefined,
          videoPath: autoApplyEnabled ? videoPath : undefined,
          timestamp: new Date().toISOString(),
          mode: autoApplyEnabled ? 'auto_apply' : 'apply_and_review',
          browserOpened: !autoApplyEnabled,
        });

      } else {
        console.log(`\n⚠️  SKIPPING FORM SUBMISSION - Completion rate too low (${completionRate}%)`);
        console.log(`   ❌ Failed fields (${results.failed}):`);
        const failedFields = results.fieldResults.filter(r => !r.success && !r.skipped);
        failedFields.forEach(field => {
          console.log(`      - ${field.fieldLabel}: ${field.error}`);
        });
        console.log(`   💡 Form was filled but not submitted. Please review and submit manually.`);

    // Calculate success rate
    const successRate = results.totalFields > 0
      ? Math.round((results.filled / results.totalFields) * 100)
      : 0;

    return NextResponse.json({
          success: false,
          message: 'Form filling completed with errors. Completion rate too low.',
      sessionId: sessionId || undefined,
      fieldsFilled: results.filled,
      fieldsAttempted: results.totalFields,
      successRate,
      fieldResults: results.fieldResults,
      errors: results.errors,
      screenshotPath,
      timestamp: new Date().toISOString(),
    });
      }
    } else {
      console.log('\n⏭️  Form submission disabled by options - skipping submit');

      // Calculate success rate
      const successRate = results.totalFields > 0
        ? Math.round((results.filled / results.totalFields) * 100)
        : 0;

      return NextResponse.json({
        success: true,
        message: 'Form filled successfully (submission disabled by options).',
        fieldsFilled: results.filled,
        fieldsAttempted: results.totalFields,
        successRate,
        fieldResults: results.fieldResults,
        errors: results.errors,
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error: any) {
    console.error('❌ === Intelligent Auto-Apply Error ===');
    console.error('Error:', error);

    // Take error screenshot BEFORE closing browser
    let screenshotPath: string | undefined;
    if (page) {
      try {
        const fs = require('fs');
        const path = require('path');
        const screenshotsDir = path.resolve(process.cwd(), 'public/screenshots');
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        const screenshotFileName = `intelligent-apply-error-${Date.now()}.png`;
        const screenshotFullPath = path.resolve(screenshotsDir, screenshotFileName);
        await page.screenshot({ path: screenshotFullPath, fullPage: true });
        screenshotPath = `/screenshots/${screenshotFileName}`;
        console.log('📸 Error screenshot saved:', screenshotPath);
      } catch (e) {
        console.log('⚠️  Could not save error screenshot');
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
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Intelligent Auto-Apply API',
    version: '2.0',
    description: 'Smart form filling using DOM extraction + GPT-4 field mapping + Playwright',
    strategy: {
      step1: 'Extract all form fields with DOM analysis',
      step2: 'Send fields to GPT-4 for intelligent mapping',
      step3: 'Fill fields using Playwright with multiple fallback strategies',
      step4: 'Submit form and capture evidence (screenshot + video)',
    },
    features: [
      'Intelligent DOM field extraction',
      'GPT-4 powered field-to-answer mapping',
      'Multiple fallback locator strategies',
      'Video recording of entire process',
      'Full-page screenshot capture',
      'Detailed field-by-field reporting',
    ],
    advantages: [
      'No hardcoded selectors - works on any form',
      'AI understands field intent from labels/placeholders',
      'Robust fallback system for dynamic forms',
      'Complete audit trail (video + screenshot)',
    ],
  });
}
