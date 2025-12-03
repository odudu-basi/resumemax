/**
 * Resume Upload Helper for Stagehand Agent
 * Converts base64 resume to buffer and uploads to form
 */

async function uploadResumeToForm(page, resumeData) {
  if (!resumeData || !resumeData.contentBase64) {
    console.log('⚠️  No resume data provided');
    return false;
  }

  try {
    console.log(`📤 Preparing to upload resume: ${resumeData.fileName}`);
    
    // Convert base64 to buffer
    const buffer = Buffer.from(resumeData.contentBase64, 'base64');
    console.log(`  ✅ Converted to buffer: ${buffer.length} bytes`);
    
    // Find the file input element
    const fileInput = await page.locator('input[type="file"]').first();
    
    // Upload using setInputFiles with buffer
    await fileInput.setInputFiles({
      name: resumeData.fileName,
      mimeType: resumeData.fileType,
      buffer: buffer
    });
    
    console.log(`  ✅ Resume uploaded successfully: ${resumeData.fileName}`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Resume upload failed: ${error.message}`);
    return false;
  }
}

module.exports = { uploadResumeToForm };
