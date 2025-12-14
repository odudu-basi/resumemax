/**
 * Resume Upload Helper
 * Downloads resume from Supabase URL and uploads to job application forms
 */

async function downloadAndUploadResume(page, resumeUrl, inputSelector) {
  try {
    console.log('📥 Downloading resume from:', resumeUrl);
    
    // Fetch the resume file from Supabase
    const response = await fetch(resumeUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch resume: ${response.statusText}`);
    }
    
    // Get the file buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Extract filename from URL or use default
    const urlPath = new URL(resumeUrl).pathname;
    const fileName = urlPath.split('/').pop() || 'resume.pdf';
    
    console.log(`  ✅ Downloaded: ${fileName} (${buffer.length} bytes)`);
    
    // Upload using Playwright's setInputFiles with buffer
    await page.locator(inputSelector).setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: buffer
    });
    
    console.log('  ✅ Resume uploaded successfully');
    return true;
    
  } catch (error) {
    console.error('  ❌ Resume upload failed:', error.message);
    return false;
  }
}

async function uploadResumeFromBase64(page, base64Content, fileName, inputSelector) {
  try {
    console.log('📄 Uploading resume from base64 content...');
    
    // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
    const base64Data = base64Content.includes(',') 
      ? base64Content.split(',')[1] 
      : base64Content;
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Use provided filename or default
    const resumeFileName = fileName || 'resume.pdf';
    
    console.log(`  ✅ Prepared: ${resumeFileName} (${buffer.length} bytes)`);
    
    // Upload using Playwright's setInputFiles with buffer
    await page.locator(inputSelector).setInputFiles({
      name: resumeFileName,
      mimeType: 'application/pdf',
      buffer: buffer
    });
    
    console.log('  ✅ Resume uploaded successfully from base64');
    return true;
    
  } catch (error) {
    console.error('  ❌ Base64 resume upload failed:', error.message);
    return false;
  }
}

module.exports = { downloadAndUploadResume, uploadResumeFromBase64 };
