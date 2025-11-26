import { Page } from 'playwright';

/**
 * Minimal field structure - only necessary attributes for LLM
 * This reduces token usage from 130K+ to ~5K tokens
 */
export interface MinimalDOMField {
  type: 'input' | 'textarea' | 'select';
  inputType?: string; // e.g., 'text', 'email', 'tel', 'number'
  id: string | null;
  name: string | null;
  placeholder: string | null;
  label: string | null;
  ariaLabel: string | null;
  required: boolean;
  options?: Array<{ value: string; text: string | null }>; // For select elements only
}

/**
 * Complete field structure with selectors for Playwright
 * Used internally, NOT sent to LLM
 */
export interface DOMField {
  // Element identification
  id: string;
  name: string;
  className: string;
  tagName: string;
  type: string;

  // Visual positioning
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Context and metadata
  placeholder: string;
  labels: string[];
  ariaLabel: string;
  title: string;
  required: boolean;
  value: string;
  options: string[]; // For select elements

  // Generated selectors (in order of reliability)
  selectors: string[];

  // Visibility and interaction
  visible: boolean;
  enabled: boolean;
  readonly: boolean;

  // Field context
  fieldContext: string;
  nearbyText: string;

  // Confidence scoring
  confidence: number;
}

export interface FormStructure {
  fields: DOMField[];
  submitButtons: DOMField[];
  formElement: {
    action: string;
    method: string;
    selector: string;
  } | null;
  pageTitle: string;
  pageUrl: string;
}

export interface MinimalFormStructure {
  fields: MinimalDOMField[];
}

export class DOMExtractor {

  /**
   * Extract MINIMAL form fields for LLM processing
   * This sends only necessary attributes to avoid token overflow
   */
  async extractMinimalFormFields(page: Page): Promise<MinimalFormStructure> {
    console.log('🔍 Extracting minimal form fields (optimized for LLM)...');

    const fields = await page.evaluate(() => {
      function getLabelText(element: HTMLElement): string | null {
        let labelText = null;

        // Method 1: Direct label via 'for' attribute
        if (element.id) {
          const label = document.querySelector(`label[for="${element.id}"]`);
          if (label?.textContent?.trim()) labelText = label.textContent.trim();
        }

        // Method 2: Parent label
        if (!labelText) {
          const parentLabel = element.closest('label');
          if (parentLabel?.textContent?.trim()) labelText = parentLabel.textContent.trim();
        }

        // Method 3: aria-labelledby
        if (!labelText && element.getAttribute('aria-labelledby')) {
          const ariaLabelledBy = element.getAttribute('aria-labelledby');
          const labelElement = ariaLabelledBy ? document.getElementById(ariaLabelledBy) : null;
          if (labelElement?.textContent?.trim()) labelText = labelElement.textContent.trim();
        }

        // Method 4: Previous sibling label
        if (!labelText) {
          let sibling = element.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === 'LABEL' && sibling.textContent?.trim()) {
              labelText = sibling.textContent.trim();
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
          text: opt.textContent?.trim() || null
        }));
      }

      const extractedFields: any[] = [];

      // Extract INPUT fields
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
      inputs.forEach((input: any) => {
        extractedFields.push({
          type: 'input',
          inputType: input.type || 'text',
          id: input.id || null,
          name: input.name || null,
          placeholder: input.placeholder || null,
          label: getLabelText(input),
          ariaLabel: input.getAttribute('aria-label') || null,
          required: input.required || false,
        });
      });

      // Extract TEXTAREA fields
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach((textarea: any) => {
        extractedFields.push({
          type: 'textarea',
          id: textarea.id || null,
          name: textarea.name || null,
          placeholder: textarea.placeholder || null,
          label: getLabelText(textarea),
          ariaLabel: textarea.getAttribute('aria-label') || null,
          required: textarea.required || false,
        });
      });

      // Extract SELECT fields
      const selects = document.querySelectorAll('select');
      selects.forEach((select: any) => {
        extractedFields.push({
          type: 'select',
          id: select.id || null,
          name: select.name || null,
          placeholder: null,
          label: getLabelText(select),
          ariaLabel: select.getAttribute('aria-label') || null,
          required: select.required || false,
          options: getSelectOptions(select),
        });
      });

      return extractedFields;
    });

    console.log(`✅ Extracted ${fields.length} minimal fields`);
    return { fields };
  }

  /**
   * Extract complete form structure from page
   * Use this for internal processing, NOT for sending to LLM
   */
  async extractFormStructure(page: Page): Promise<FormStructure> {
    console.log('🔍 Extracting complete DOM form structure...');

    const formData = await page.evaluate(() => {
      // Helper function to get all associated labels for an element
      function getAssociatedLabels(element: Element): string[] {
        const labels: string[] = [];
        
        // Method 1: Direct label association via 'for' attribute
        if (element.id) {
          const directLabel = document.querySelector(`label[for="${element.id}"]`);
          if (directLabel?.textContent) {
            labels.push(directLabel.textContent.trim());
          }
        }
        
        // Method 2: Parent label
        const parentLabel = element.closest('label');
        if (parentLabel?.textContent) {
          labels.push(parentLabel.textContent.trim());
        }
        
        // Method 3: Previous sibling label
        let sibling = element.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === 'LABEL' && sibling.textContent) {
            labels.push(sibling.textContent.trim());
            break;
          }
          sibling = sibling.previousElementSibling;
        }
        
        // Method 4: Aria-labelledby
        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy);
          if (labelElement?.textContent) {
            labels.push(labelElement.textContent.trim());
          }
        }
        
        // Remove duplicates and clean up
        return [...new Set(labels)]
          .map(label => label.replace(/\s+/g, ' ').trim())
          .filter(label => label.length > 0);
      }
      
      // Helper function to get nearby text context
      function getNearbyText(element: Element): string {
        const texts: string[] = [];
        
        // Get text from parent container
        const parent = element.parentElement;
        if (parent) {
          const parentText = parent.textContent || '';
          const elementText = element.textContent || '';
          const nearbyText = parentText.replace(elementText, '').trim();
          if (nearbyText) texts.push(nearbyText);
        }
        
        // Get text from previous siblings
        let prev = element.previousElementSibling;
        let count = 0;
        while (prev && count < 3) {
          if (prev.textContent?.trim()) {
            texts.push(prev.textContent.trim());
          }
          prev = prev.previousElementSibling;
          count++;
        }
        
        return texts.join(' ').substring(0, 200);
      }
      
      // Helper function to generate reliable selectors
      function generateSelectors(element: Element): string[] {
        const selectors: string[] = [];
        
        // ID selector (most reliable)
        if (element.id) {
          selectors.push(`#${element.id}`);
        }
        
        // Name attribute selector
        if (element.getAttribute('name')) {
          selectors.push(`[name="${element.getAttribute('name')}"]`);
          selectors.push(`${element.tagName.toLowerCase()}[name="${element.getAttribute('name')}"]`);
        }
        
        // Type + name combination
        const type = element.getAttribute('type');
        const name = element.getAttribute('name');
        if (type && name) {
          selectors.push(`${element.tagName.toLowerCase()}[type="${type}"][name="${name}"]`);
        }
        
        // Class selectors (if not too generic)
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.split(' ').filter(c => c.length > 0);
          if (classes.length > 0 && !classes.some(c => ['form-control', 'input', 'field'].includes(c))) {
            selectors.push(`.${classes[0]}`);
            selectors.push(`${element.tagName.toLowerCase()}.${classes[0]}`);
          }
        }
        
        // Placeholder selector
        if (element.getAttribute('placeholder')) {
          selectors.push(`[placeholder="${element.getAttribute('placeholder')}"]`);
        }
        
        // Aria-label selector
        if (element.getAttribute('aria-label')) {
          selectors.push(`[aria-label="${element.getAttribute('aria-label')}"]`);
        }
        
        // Position-based selector (last resort)
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element);
          selectors.push(`${parent.tagName.toLowerCase()} > ${element.tagName.toLowerCase()}:nth-child(${index + 1})`);
        }
        
        return selectors;
      }
      
      // Helper function to get select options
      function getSelectOptions(element: Element): string[] {
        if (element.tagName !== 'SELECT') return [];
        
        const options = Array.from(element.querySelectorAll('option'));
        return options
          .map(option => option.textContent?.trim() || '')
          .filter(text => text.length > 0);
      }
      
      // Helper function to calculate confidence score
      function calculateConfidence(element: Element, labels: string[]): number {
        let confidence = 0.5; // Base confidence
        
        // Boost confidence for good identifiers
        if (element.id) confidence += 0.3;
        if (element.getAttribute('name')) confidence += 0.2;
        if (labels.length > 0) confidence += 0.2;
        if (element.getAttribute('placeholder')) confidence += 0.1;
        if (element.getAttribute('aria-label')) confidence += 0.1;
        
        // Reduce confidence for generic attributes
        const className = element.className;
        if (typeof className === 'string' && ['input', 'field', 'form-control'].some(c => className.includes(c))) {
          confidence -= 0.1;
        }
        
        return Math.min(confidence, 1.0);
      }
      
      // Main extraction logic
      const fields: DOMField[] = [];
      const submitButtons: DOMField[] = [];
      
      // Find all form elements
      const formElements = document.querySelectorAll(`
        input:not([type="hidden"]):not([type="submit"]):not([type="button"]),
        select,
        textarea,
        [contenteditable="true"],
        [role="textbox"],
        [role="combobox"]
      `);
      
      // Find submit buttons separately
      const buttonElements = document.querySelectorAll(`
        input[type="submit"],
        input[type="button"],
        button[type="submit"],
        button:not([type]),
        [role="button"]
      `);
      
      // Process form fields
      formElements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const labels = getAssociatedLabels(element);
        const selectors = generateSelectors(element);
        const confidence = calculateConfidence(element, labels);
        
        const field: DOMField = {
          // Element identification
          id: element.id || '',
          name: element.getAttribute('name') || '',
          className: element.className || '',
          tagName: element.tagName,
          type: element.getAttribute('type') || element.tagName.toLowerCase(),
          
          // Visual positioning
          coordinates: {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          
          // Context and metadata
          placeholder: element.getAttribute('placeholder') || '',
          labels: labels,
          ariaLabel: element.getAttribute('aria-label') || '',
          title: element.getAttribute('title') || '',
          required: element.hasAttribute('required'),
          value: (element as HTMLInputElement).value || '',
          options: getSelectOptions(element),
          
          // Generated selectors
          selectors: selectors,
          
          // Visibility and interaction
          visible: rect.width > 0 && rect.height > 0 && 
                   window.getComputedStyle(element).display !== 'none' &&
                   window.getComputedStyle(element).visibility !== 'hidden',
          enabled: !(element as HTMLInputElement).disabled,
          readonly: (element as HTMLInputElement).readOnly || false,
          
          // Field context
          fieldContext: labels.join(' | '),
          nearbyText: getNearbyText(element),
          
          // Confidence scoring
          confidence: confidence
        };
        
        fields.push(field);
      });
      
      // Process submit buttons
      buttonElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const text = element.textContent?.trim() || '';
        const value = element.getAttribute('value') || '';
        
        // Only include buttons that look like submit buttons
        const isSubmitButton = 
          element.getAttribute('type') === 'submit' ||
          /submit|apply|send|continue|next/i.test(text) ||
          /submit|apply|send|continue|next/i.test(value);
          
        if (isSubmitButton && rect.width > 0 && rect.height > 0) {
          const button: DOMField = {
            id: element.id || '',
            name: element.getAttribute('name') || '',
            className: element.className || '',
            tagName: element.tagName,
            type: 'submit',
            coordinates: {
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            placeholder: '',
            labels: [text || value],
            ariaLabel: element.getAttribute('aria-label') || '',
            title: element.getAttribute('title') || '',
            required: false,
            value: value,
            options: [],
            selectors: generateSelectors(element),
            visible: window.getComputedStyle(element).display !== 'none',
            enabled: !(element as HTMLButtonElement).disabled,
            readonly: false,
            fieldContext: text || value,
            nearbyText: '',
            confidence: 0.8
          };
          
          submitButtons.push(button);
        }
      });
      
      // Find form element
      const formElement = document.querySelector('form');
      const formInfo = formElement ? {
        action: formElement.action || '',
        method: formElement.method || 'POST',
        selector: formElement.id ? `#${formElement.id}` : 'form'
      } : null;
      
      return {
        fields: fields.sort((a, b) => b.confidence - a.confidence), // Sort by confidence
        submitButtons: submitButtons,
        formElement: formInfo,
        pageTitle: document.title,
        pageUrl: window.location.href
      };
    });
    
    console.log(`✅ DOM extraction complete: ${formData.fields.length} fields, ${formData.submitButtons.length} submit buttons`);
    
    return formData as FormStructure;
  }
  
  /**
   * Get field by various selector methods
   */
  async getFieldElement(page: Page, field: DOMField) {
    // Try selectors in order of reliability
    for (const selector of field.selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          return element;
        }
      } catch (error) {
        continue;
      }
    }
    
    // Fallback to coordinates
    return null;
  }
  
  /**
   * Fill field using best available method
   */
  async fillField(page: Page, field: DOMField, value: string): Promise<boolean> {
    if (!value || value.trim() === '') {
      console.log(`⚠️ Skipping field with empty value: ${field.fieldContext || field.labels[0] || field.name}`);
      return false;
    }

    console.log(`🔧 Filling field: ${field.fieldContext || field.labels[0] || field.name} with value: "${value}"`);
    console.log(`🔍 Available selectors: ${field.selectors.slice(0, 3).join(', ')}`);
    
    // Try DOM selectors first
    for (let i = 0; i < field.selectors.length; i++) {
      const selector = field.selectors[i];
      try {
        console.log(`🎯 Trying selector ${i + 1}/${field.selectors.length}: ${selector}`);
        
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 });
        
        if (isVisible) {
          console.log(`✅ Element found and visible with selector: ${selector}`);
          // Ensure element is in view and briefly highlight it for the recording
          try {
            await element.scrollIntoViewIfNeeded();
            await element.evaluate((el, label) => {
              const node = el as HTMLElement;
              const prev = node.style.outline;
              node.style.outline = '3px solid #22c55e';
              node.style.outlineOffset = '1px';

              // Create a lightweight tooltip near the element to show what is being filled
              const rect = node.getBoundingClientRect();
              const tip = document.createElement('div');
              tip.textContent = `Filling: ${label}`;
              tip.style.position = 'fixed';
              tip.style.left = `${Math.max(8, rect.left)}px`;
              tip.style.top = `${Math.max(8, rect.top - 24)}px`;
              tip.style.background = 'rgba(34,197,94,0.9)';
              tip.style.color = '#fff';
              tip.style.padding = '2px 6px';
              tip.style.borderRadius = '4px';
              tip.style.fontSize = '12px';
              tip.style.zIndex = '2147483647';
              document.body.appendChild(tip);

              setTimeout(() => { node.style.outline = prev; tip.remove(); }, 1200);
            }, (field.fieldContext || field.labels[0] || field.name));
          } catch {}
          
        if (field.tagName === 'SELECT') {
          // Normalize desired value and try to match against known options
          const desired = (value || '').toString().trim();
          const desiredLc = desired.toLowerCase();
          const options = (field.options || []).map(o => o.trim()).filter(Boolean);

          // Find best label match (case-insensitive, contains)
          let bestLabel = options.find(o => o.toLowerCase() === desiredLc)
            || options.find(o => o.toLowerCase().includes(desiredLc))
            || desired;

          // Try selection by label first
          try {
            await element.selectOption({ label: bestLabel });
            console.log(`✅ Selected option via label: ${bestLabel}`);
          } catch (errorSelectByLabel) {
            // Try by value
            try {
              await element.selectOption({ value: bestLabel });
              console.log(`✅ Selected option via value: ${bestLabel}`);
            } catch {
              // Fallback: open dropdown and type + enter
              await element.click();
              await page.waitForTimeout(200);
              await page.keyboard.type(bestLabel);
              await page.waitForTimeout(150);
              await page.keyboard.press('Enter');
              console.log(`✅ Selected option via typing: ${bestLabel}`);
            }
          }
        } else {
          // For text inputs
          await element.fill(value);
          console.log(`✅ Filled text field with: ${value}`);
        }
          
          // Verify the field was actually filled/selected
          if (field.tagName === 'SELECT') {
            const selectedText = await element.evaluate(el => {
              const sel = el as HTMLSelectElement;
              const opt = sel.selectedOptions && sel.selectedOptions[0];
              return opt ? (opt.text || opt.value || '') : (sel.value || '');
            }).catch(() => '');
            if (selectedText) {
              console.log(`✅ Verified select value: ${selectedText}`);
              return true;
            }
            console.log(`⚠️ Select verification failed. Expected similar to: ${value}`);
          } else {
            const currentValue = await element.inputValue().catch(() => '');
            if (currentValue && currentValue.toLowerCase().includes((value || '').toLowerCase().substring(0, Math.min(5, value.length)))) {
              console.log(`✅ Verified field filled successfully`);
              return true;
            } else {
              console.log(`⚠️ Field fill verification failed. Expected: ${value}, Got: ${currentValue}`);
            }
          }
        } else {
          console.log(`❌ Element not visible with selector: ${selector}`);
        }
      } catch (error) {
        console.log(`❌ Selector failed: ${selector} - ${error}`);
        continue;
      }
    }
    
    // Fallback to coordinate-based filling
    console.log(`🎯 Trying coordinate fallback: (${field.coordinates.x}, ${field.coordinates.y})`);
    try {
      // Scroll element into view first
      await page.mouse.click(field.coordinates.x, field.coordinates.y);
      await page.waitForTimeout(300);
      
      if (field.tagName === 'SELECT') {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        await page.keyboard.type(value);
        await page.keyboard.press('Enter');
      } else {
        // Clear existing content and type new value
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(100);
        await page.keyboard.type(value);
      }
      
      console.log(`✅ Filled via coordinates: (${field.coordinates.x}, ${field.coordinates.y})`);
      return true;
    } catch (error) {
      console.log(`❌ Coordinate filling failed: ${error}`);
      return false;
    }
  }
}

export const domExtractor = new DOMExtractor();
