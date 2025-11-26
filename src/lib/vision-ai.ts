import OpenAI from 'openai';
import { Page } from 'playwright';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
});

export interface FormField {
  label: string;
  type: 'input' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'file';
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selector?: string;
  confidence: number;
  required: boolean;
}

export interface VisionAnalysisResult {
  fields: FormField[];
  submitButton?: {
    coordinates: { x: number; y: number; width: number; height: number };
    text: string;
    confidence: number;
  };
  applyButton?: {
    coordinates: { x: number; y: number; width: number; height: number };
    text: string;
    confidence: number;
  };
}

export class VisionFormAnalyzer {
  private screenshotDir: string;

  constructor() {
    this.screenshotDir = path.join(process.cwd(), 'public', 'vision-screenshots');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * Take a screenshot and analyze it with Vision AI
   */
  async analyzeFormPage(page: Page): Promise<VisionAnalysisResult> {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'dummy-key-for-build') {
      console.log('⚠️ OpenAI API key not configured, skipping Vision AI analysis');
      return { fields: [] };
    }

    console.log('📸 Taking screenshot for vision analysis...');
    
    // Take full page screenshot
    const timestamp = Date.now();
    const screenshotPath = path.join(this.screenshotDir, `form-analysis-${timestamp}.png`);
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    console.log('🔍 Analyzing form with Vision AI...');
    
    // Convert screenshot to base64 for OpenAI
    const imageBuffer = await fs.promises.readFile(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this job application form screenshot and identify all form fields, buttons, and their locations. 

Please provide a JSON response with the following structure:
{
  "fields": [
    {
      "label": "Field label text (e.g., 'First Name', 'Email')",
      "type": "input|select|textarea|checkbox|radio|file",
      "coordinates": {"x": pixel_x, "y": pixel_y, "width": pixel_width, "height": pixel_height},
      "confidence": 0.0-1.0,
      "required": true|false
    }
  ],
  "submitButton": {
    "coordinates": {"x": pixel_x, "y": pixel_y, "width": pixel_width, "height": pixel_height},
    "text": "Button text",
    "confidence": 0.0-1.0
  },
  "applyButton": {
    "coordinates": {"x": pixel_x, "y": pixel_y, "width": pixel_width, "height": pixel_height},
    "text": "Button text", 
    "confidence": 0.0-1.0
  }
}

Focus on identifying:
1. Text input fields (First Name, Last Name, Email, Phone, etc.)
2. Dropdown/select fields (Country, State, etc.)
3. File upload fields (Resume/CV, Cover Letter)
4. Checkbox fields (agreements, demographics)
5. Radio button groups (gender, race, etc.)
6. Submit/Apply buttons
7. Required field indicators (asterisks, "required" text)

Be as precise as possible with coordinates and confidence scores.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      });

      const analysisText = response.choices[0]?.message?.content;
      if (!analysisText) {
        throw new Error('No analysis result from Vision AI');
      }

      // Parse JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from Vision AI response');
      }

      const analysis: VisionAnalysisResult = JSON.parse(jsonMatch[0]);
      
      console.log(`✅ Vision AI identified ${analysis.fields.length} form fields`);
      
      // Clean up screenshot
      await fs.promises.unlink(screenshotPath).catch(() => {});
      
      return analysis;

    } catch (error) {
      console.error('❌ Vision AI analysis failed:', error);
      
      // Clean up screenshot on error
      await fs.promises.unlink(screenshotPath).catch(() => {});
      
      // Return empty result as fallback
      return {
        fields: []
      };
    }
  }

  /**
   * Find and click an element based on vision coordinates
   */
  async clickElementAtCoordinates(
    page: Page, 
    coordinates: { x: number; y: number; width: number; height: number }
  ): Promise<boolean> {
    try {
      const centerX = coordinates.x + coordinates.width / 2;
      const centerY = coordinates.y + coordinates.height / 2;
      
      console.log(`🎯 Clicking at coordinates (${centerX}, ${centerY})`);
      
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(1000); // Wait for any animations
      
      return true;
    } catch (error) {
      console.error('❌ Failed to click at coordinates:', error);
      return false;
    }
  }

  /**
   * Fill a form field based on vision coordinates
   */
  async fillFieldAtCoordinates(
    page: Page,
    coordinates: { x: number; y: number; width: number; height: number },
    value: string,
    fieldType: string = 'input'
  ): Promise<boolean> {
    try {
      const centerX = coordinates.x + coordinates.width / 2;
      const centerY = coordinates.y + coordinates.height / 2;
      
      console.log(`✏️ Filling field at coordinates (${centerX}, ${centerY}) with value: ${value}`);
      
      // Click to focus the field
      await page.mouse.click(centerX, centerY);
      await page.waitForTimeout(500);
      
      if (fieldType === 'select') {
        // For dropdowns, try to find and select the option
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        
        // Type to search for the value
        await page.keyboard.type(value);
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
      } else if (fieldType === 'file') {
        // File upload will be handled separately
        console.log('📎 File upload field detected - skipping for now');
        return false;
      } else {
        // Clear existing content and type new value
        await page.keyboard.press('Control+A');
        await page.keyboard.type(value);
      }
      
      await page.waitForTimeout(300);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to fill field at coordinates:', error);
      return false;
    }
  }

  /**
   * Map field labels to user profile data
   */
  mapFieldToUserData(fieldLabel: string, userProfile: any): string | null {
    const label = fieldLabel.toLowerCase().replace(/[*\s]/g, '');
    
    const fieldMapping: { [key: string]: string } = {
      'firstname': userProfile.firstName || '',
      'first': userProfile.firstName || '',
      'lastname': userProfile.lastName || '',
      'last': userProfile.lastName || '',
      'email': userProfile.email || '',
      'phone': userProfile.phone || '',
      'phonenumber': userProfile.phone || '',
      'address': userProfile.location?.address || '',
      'city': userProfile.location?.city || '',
      'state': userProfile.location?.state || '',
      'zipcode': userProfile.location?.zipCode || '',
      'zip': userProfile.location?.zipCode || '',
      'country': userProfile.location?.country || 'United States',
      'linkedin': userProfile.linkedinUrl || '',
      'website': userProfile.portfolioUrl || '',
      'portfolio': userProfile.portfolioUrl || '',
      'preferredname': userProfile.applicationData?.preferredName || '',
      'preferred': userProfile.applicationData?.preferredName || '',
      'pronouns': userProfile.applicationData?.pronouns || '',
      'gender': userProfile.demographics?.gender || '',
      'race': userProfile.demographics?.race || '',
      'ethnicity': userProfile.demographics?.ethnicity || '',
      'veteran': userProfile.demographics?.veteranStatus || '',
      'disability': userProfile.demographics?.disabilityStatus || '',
      'salary': userProfile.applicationData?.salaryExpectation || '',
      'compensation': userProfile.applicationData?.salaryExpectation || '',
      'visa': userProfile.workAuthorization?.visaStatus || '',
      'authorized': userProfile.workAuthorization?.authorizedToWork || '',
      'authorization': userProfile.workAuthorization?.authorizedToWork || '',
      'coverletter': userProfile.applicationData?.coverLetter || ''
    };

    return fieldMapping[label] || null;
  }

  /**
   * Fill entire form using vision analysis
   */
  async fillFormWithVision(page: Page, userProfile: any): Promise<{
    fieldsAttempted: number;
    fieldsSuccessful: number;
    fieldResults: Array<{ label: string; success: boolean; reason?: string }>;
  }> {
    console.log('🤖 Starting vision-guided form filling...');
    
    const analysis = await this.analyzeFormPage(page);
    const fieldResults: Array<{ label: string; success: boolean; reason?: string }> = [];
    
    let fieldsAttempted = 0;
    let fieldsSuccessful = 0;

    // Fill each identified field
    for (const field of analysis.fields) {
      fieldsAttempted++;
      
      const value = this.mapFieldToUserData(field.label, userProfile);
      
      if (!value) {
        console.log(`⚠️ No data available for field: ${field.label}`);
        fieldResults.push({
          label: field.label,
          success: false,
          reason: 'no_data_available'
        });
        continue;
      }

      const success = await this.fillFieldAtCoordinates(
        page,
        field.coordinates,
        value,
        field.type
      );

      if (success) {
        fieldsSuccessful++;
        console.log(`✅ Successfully filled: ${field.label}`);
        fieldResults.push({
          label: field.label,
          success: true
        });
      } else {
        console.log(`❌ Failed to fill: ${field.label}`);
        fieldResults.push({
          label: field.label,
          success: false,
          reason: 'fill_failed'
        });
      }
    }

    console.log(`📊 Vision filling complete: ${fieldsSuccessful}/${fieldsAttempted} fields filled`);
    
    return {
      fieldsAttempted,
      fieldsSuccessful,
      fieldResults
    };
  }

  /**
   * Find and click Apply button using vision
   */
  async findAndClickApplyButtonWithVision(page: Page): Promise<boolean> {
    console.log('🔍 Looking for Apply button with vision...');
    
    const analysis = await this.analyzeFormPage(page);
    
    if (analysis.applyButton) {
      console.log(`🎯 Found Apply button: "${analysis.applyButton.text}"`);
      return await this.clickElementAtCoordinates(page, analysis.applyButton.coordinates);
    }
    
    console.log('❌ No Apply button found with vision');
    return false;
  }

  /**
   * Find and click Submit button using vision
   */
  async findAndClickSubmitButtonWithVision(page: Page): Promise<boolean> {
    console.log('🔍 Looking for Submit button with vision...');
    
    const analysis = await this.analyzeFormPage(page);
    
    if (analysis.submitButton) {
      console.log(`🎯 Found Submit button: "${analysis.submitButton.text}"`);
      return await this.clickElementAtCoordinates(page, analysis.submitButton.coordinates);
    }
    
    console.log('❌ No Submit button found with vision');
    return false;
  }
}

export const visionAnalyzer = new VisionFormAnalyzer();
