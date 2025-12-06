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

module.exports = { downloadAndUploadResume };
