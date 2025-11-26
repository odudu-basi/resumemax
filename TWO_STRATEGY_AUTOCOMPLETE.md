# Two-Strategy Autocomplete System

## Overview

The autocomplete system now uses **two different strategies** based on the field type:

---

## Strategy 1: Location/School/Discipline/Major Fields

**Fields detected:**
- Location
- City
- School
- University
- College
- Discipline
- Major
- Field of study
- Degree

**Method:** Type slowly + Keyboard navigation

### How it works:

1. **Type the full answer slowly** (30ms delay per character)
2. **Wait for autocomplete to filter options**
3. **Press ArrowDown** to highlight first match
4. **Press Enter** to select, or **Tab** if no highlight

### Console output:

```
🔍 Detected AUTOCOMPLETE input field
🎓 Location/School field detected - using typing strategy
⌨️  Typed: "Indianapolis"
🎹 Using keyboard navigation to select option...
✅ Selected option using keyboard (ArrowDown + Enter)
```

### Why this approach:
- Location/school fields often have HUGE lists (thousands of cities/schools)
- Extracting all options would be slow and overwhelming
- Typing filters the list automatically
- Keyboard navigation is most reliable

---

## Strategy 2: Regular Dropdowns (Gender, Yes/No, etc.)

**Fields detected:**
- Gender pronouns
- Work authorization
- Veteran status
- Disability status
- Any other autocomplete NOT in Strategy 1 list

**Method:** Extract options → Pick best → Type → Click

### How it works:

1. **Click field to open dropdown**
2. **Extract ALL visible options** (only near this field)
3. **Ask GPT to pick best option** from the extracted list
4. **Type the selected option**
5. **Click the matching option** from dropdown

### Console output:

```
🔍 Detected AUTOCOMPLETE input field
📋 Regular dropdown - using option extraction strategy
🎯 No static options - triggering dropdown to extract options dynamically
📋 Extracted 5 dynamic options: "He/Him", "She/Her", "They/Them", "Prefer not to say", "Other"
✅ Direct match found: "He/Him"
⌨️  Typed best match: "He/Him"
🖱️  Looking for option to click...
✅ Option clicked successfully
```

### Why this approach:
- These dropdowns have **small lists** (3-10 options)
- Quick to extract all options
- GPT can intelligently pick best match
- Ensures we select valid option from list
- More reliable clicking since we know exact text

---

## Key Differences

| Aspect | Strategy 1 (Location/School) | Strategy 2 (Other Dropdowns) |
|--------|------------------------------|------------------------------|
| **Fields** | Location, School, Major, etc. | Gender, Yes/No, Status fields |
| **List Size** | Huge (1000s of options) | Small (3-10 options) |
| **Method** | Type + Keyboard nav | Extract → Pick → Click |
| **Speed** | Fast (no extraction) | Slightly slower (extraction) |
| **Reliability** | Good for big lists | Excellent for small lists |
| **Selection** | First filtered match | Exact match from extracted list |

---

## Technical Implementation

### Field Detection Logic:

```typescript
const fieldLabel = (question || originalField.label || originalField.placeholder || '').toLowerCase();

const isLocationSchoolField =
  fieldLabel.includes('location') ||
  fieldLabel.includes('city') ||
  fieldLabel.includes('school') ||
  fieldLabel.includes('university') ||
  fieldLabel.includes('college') ||
  fieldLabel.includes('discipline') ||
  fieldLabel.includes('major') ||
  fieldLabel.includes('field of study') ||
  fieldLabel.includes('degree');

if (isLocationSchoolField) {
  // STRATEGY 1: Type + Keyboard
} else {
  // STRATEGY 2: Extract + Click
}
```

### Option Extraction (Strategy 2 Only):

Uses field position to filter options **only near this specific field**:

```typescript
const fieldPosition = await element.boundingBox();

// Extract options near this field only
const dynamicOptions = await page.evaluate((fieldBox) => {
  // Filter by proximity (within 500px vertically, 200px horizontally)
  const verticalDistance = Math.abs(rect.top - (fieldBox.y + fieldBox.height));
  const horizontalDistance = Math.abs(rect.left - fieldBox.x);

  return verticalDistance < 500 && horizontalDistance < 200;
}, fieldPosition);
```

This ensures we only get options from **this dropdown**, not from other dropdowns on the page!

---

## Benefits

### For Location/School Fields:
✅ Fast - no need to extract thousands of options
✅ Works with infinite scroll/lazy-loaded lists
✅ Natural typing behavior triggers autocomplete
✅ Keyboard navigation is universally supported

### For Other Dropdowns:
✅ Accurate - knows exact options available
✅ Smart selection - GPT picks best match
✅ Reliable clicking - exact text match
✅ Only extracts nearby options (not all page dropdowns)

---

## Example Scenarios

### Example 1: Gender Pronouns (Strategy 2)

```
Field: "What gender pronouns do you prefer?"

Process:
1. Click field → dropdown opens
2. Extract options: ["He/Him", "She/Her", "They/Them", "Prefer not to say"]
3. GPT picks: "He/Him" (based on user profile)
4. Type "He/Him"
5. Click matching option
6. ✅ Selected
```

### Example 2: Location (Strategy 1)

```
Field: "Location (City)"

Process:
1. Type "Indianapolis" slowly
2. Autocomplete filters to cities starting with "Ind"
3. Press ArrowDown → highlights "Indianapolis, IN"
4. Press Enter
5. ✅ Selected
```

### Example 3: Have you worked here? (Strategy 2)

```
Field: "Have you ever worked for Robinhood as an employee, intern or contractor?"

Process:
1. Click field → dropdown opens
2. Extract options: ["Yes", "No"]
3. GPT picks: "No" (based on work history)
4. Type "No"
5. Click "No" option
6. ✅ Selected
```

---

## Configuration

### To add more fields to Strategy 1 (typing method):

Add keywords to the detection logic:

```typescript
const isLocationSchoolField =
  fieldLabel.includes('location') ||
  fieldLabel.includes('city') ||
  fieldLabel.includes('your-new-keyword');
```

### To force all fields to use Strategy 2:

Set `isLocationSchoolField = false`

---

## Troubleshooting

### If location field not selecting:
- Check console for: `🎓 Location/School field detected`
- If not detected, field label might not match keywords
- Add your specific label to detection logic

### If dropdown not extracting options:
- Check console for: `📋 Extracted X dynamic options`
- If 0 options, dropdown might not be opening
- Increase wait time after click: `await page.waitForTimeout(500)`

### If wrong option clicked:
- Check console for: `🖱️ Looking for option to click...`
- Ensure typed text exactly matches option text
- Check field proximity filter (500px vertical, 200px horizontal)
