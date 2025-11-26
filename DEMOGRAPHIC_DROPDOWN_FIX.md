# ✅ Demographic Dropdown Fields Fix

## Problem
Demographic fields (Gender, Hispanic/Latino, Veteran Status, Disability Status) were not being filled properly:

```
📝 Filling: Gender
   Type: input
   Value: Prefer not to say...
   ⚠️  Field not found - may need manual entry

📝 Filling: Are you Hispanic/Latino?
   Type: input
   Value: I am not Hispanic or Latino...
   ⚠️  Field not found - may need manual entry
```

## Root Causes

### 1. **Fields Not Being Found (Locator Failure)**
The primary locator strategies (getByLabel, getByPlaceholder, etc.) were failing to find the demographic fields, causing "Field not found" errors before even attempting to fill them.

### 2. **Not Detected as Autocomplete**
Demographic dropdowns are often custom components (not native `<select>` elements) using inputs with `role="combobox"`. They weren't always being detected as autocomplete fields during DOM extraction.

## Solution

### 1. Added Demographic-Specific Fallback Selectors (lines 1204-1232)

Added a 6th fallback strategy specifically for demographic fields that uses XPath to find inputs by searching for labels containing demographic keywords:

```typescript
// Fallback 6: For demographic fields, try special patterns
if (!element) {
  const demographicPatterns = ['gender', 'race', 'ethnicity', 'hispanic', 'latino', 'veteran', 'disability'];
  const questionLower = question.toLowerCase();
  const isDemographicField = demographicPatterns.some(pattern => questionLower.includes(pattern));

  if (isDemographicField) {
    console.log('   🎯 Demographic field detected, trying special selectors...');

    // Try finding by text content in labels using XPath
    const labelSelectors = [
      `//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${questionLower.slice(0, 15)}')]//following::input[1]`,
      `//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${questionLower.slice(0, 15)}')]//following::select[1]`,
      // ... more patterns
    ];

    for (const selector of labelSelectors) {
      try {
        element = page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout: 2000 });
        console.log(`   ✅ Fallback: Demographic XPath succeeded`);
        break;
      } catch (e) {
        element = null;
      }
    }
  }
}
```

**How it works:**
- Detects demographic fields by checking if question contains keywords: gender, race, ethnicity, hispanic, latino, veteran, disability
- Uses XPath with case-insensitive text matching to find labels
- Finds the next input or select element after the label
- Tries multiple patterns (label, div, span)

### 2. Force Demographic Fields to be Treated as Autocomplete (lines 300-313)

Modified DOM extraction to automatically mark demographic fields as autocomplete, even if they don't have explicit `role="combobox"`:

```typescript
// Check if this is a demographic field
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
  isDemographicField  // NEW: Treat demographic fields as autocomplete
);
```

**Why this helps:**
- Demographic dropdowns are often custom components (divs/inputs styled as dropdowns)
- By marking them as autocomplete, they get the autocomplete filling logic (lines 1348-1809)
- This logic:
  1. Clicks the field to open dropdown
  2. Extracts all visible options dynamically
  3. Matches GPT's answer to one of the options
  4. Clicks the matching option

## How It Works Now

### Step 1: DOM Extraction
```javascript
// Field detected as: type="input", isAutocomplete=true
{
  type: "input",
  label: "Gender",
  isAutocomplete: true,  // ← NEW: Automatically marked
  options: []
}
```

### Step 2: GPT Mapping
```javascript
// GPT provides answer
{
  question: "Gender",
  answer: "Prefer not to say",
  fieldType: "input"
}
```

### Step 3: Field Filling (with new fallbacks)
```
1. Try primary locator (getByLabel) → May fail
2. Try fallback 1-5 (CSS by name, ID, etc.) → May fail
3. ✅ Try demographic XPath fallback → SUCCESS! Field found
4. Detect as autocomplete field → Use autocomplete strategy
5. Click field → Open dropdown
6. Extract visible options dynamically
7. Match "Prefer not to say" to an option
8. Click the matching option
9. ✅ Field filled successfully!
```

## Expected Logs (After Fix)

```
📝 Filling: Gender
   Type: input
   Strategy: getByLabel, Value: Gender
   ⚠️  Primary locator failed, trying fallbacks...
   🎯 Demographic field detected, trying special selectors...
   ✅ Fallback: Demographic XPath succeeded
   🔍 Detected AUTOCOMPLETE input field
   📋 Regular dropdown - using option extraction strategy
   📋 Extracted 4 dynamic options: "Male", "Female", "Non-binary", "Prefer not to say"
   ✅ Direct match found: "Prefer not to say"
   ⌨️  Typed best match: "Prefer not to say"
   🖱️  Looking for option to click...
   ✅ Clicked exact match: "Prefer not to say"
   ✅✅✅ Option clicked successfully!
   ✅ Field filled successfully
```

## Files Modified

**app/api/intelligent-apply/route.ts**

1. **Lines 300-313:** Added demographic field detection and forced autocomplete marking
2. **Lines 1204-1232:** Added demographic-specific XPath fallback selectors

## Testing

Test with a job application that has demographic fields:

1. ✅ Run auto-apply on a job with demographic questions
2. ✅ Check console logs for "Demographic field detected, trying special selectors..."
3. ✅ Verify fields are found using XPath fallback
4. ✅ Verify options are extracted from dropdowns
5. ✅ Verify correct option is clicked
6. ✅ Check that all demographic fields are filled (no more "Field not found")

## Key Improvements

✅ **Better Field Detection:** XPath with text content matching finds fields even when other strategies fail
✅ **Autocomplete Handling:** Demographic fields automatically use intelligent dropdown extraction and clicking
✅ **Case-Insensitive:** XPath uses translate() for case-insensitive matching
✅ **Multiple Patterns:** Tries finding via label, div, span elements
✅ **First Match:** Uses `.first()` to avoid ambiguity when multiple matches exist
