# Vision AI Setup Guide

## Overview

The Vision AI integration uses OpenAI's GPT-4 Vision model to intelligently analyze job application forms and automatically fill them out. This provides a much more robust solution than traditional CSS selectors.

## Features

- **Intelligent Form Analysis**: Uses GPT-4 Vision to identify form fields, buttons, and their locations
- **Flexible Field Detection**: Works with any form layout, regardless of CSS classes or IDs
- **Fallback Support**: Falls back to traditional selectors if Vision AI fails
- **Screen Recording**: Captures the entire automation process for debugging
- **Coordinate-Based Interaction**: Clicks and fills fields based on visual coordinates

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# OpenAI API Key for Vision AI
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. API Key Requirements

- You need an OpenAI API key with access to GPT-4 Vision
- The key should have sufficient credits for image analysis
- Each form analysis costs approximately $0.01-0.03 depending on image size

### 3. How It Works

1. **Screenshot Analysis**: Takes a full-page screenshot of the job application form
2. **AI Processing**: Sends the screenshot to GPT-4 Vision for analysis
3. **Field Mapping**: Maps identified fields to user profile data
4. **Coordinate Filling**: Uses mouse coordinates to fill fields instead of CSS selectors
5. **Button Detection**: Finds Apply and Submit buttons visually

### 4. Fallback Behavior

If Vision AI fails or returns insufficient results:
- Falls back to traditional CSS selectors
- Uses scrolling search for Apply buttons
- Maintains compatibility with existing automation

### 5. Performance Considerations

- Vision AI analysis takes 2-5 seconds per form
- Screenshots are automatically cleaned up after analysis
- Results are not cached (each form is analyzed fresh)

### 6. Debugging

- Screenshots are saved to `public/vision-screenshots/` during analysis
- Video recordings are saved to `public/recordings/`
- Console logs show detailed Vision AI results

## Usage

The Vision AI is automatically integrated into the auto-apply functionality. No additional configuration is needed once the API key is set.

## Cost Estimation

- GPT-4 Vision: ~$0.01-0.03 per form analysis
- Typical job application: 1 form analysis = ~$0.02
- 100 applications per month: ~$2.00 in Vision AI costs

## Troubleshooting

### Common Issues

1. **"Neither apiKey nor config.authenticator provided"**
   - Add `OPENAI_API_KEY` to your environment variables

2. **Vision AI returns no fields**
   - Check if the form is fully loaded before analysis
   - Verify the screenshot contains visible form fields

3. **Fields not being filled**
   - Vision AI may have incorrect coordinates
   - Fallback to traditional selectors will be used

### Debug Mode

Enable detailed logging by checking the console output for:
- `🤖 Vision AI identified X form fields`
- `✅ Successfully filled: Field Name`
- `❌ Failed to fill: Field Name`
