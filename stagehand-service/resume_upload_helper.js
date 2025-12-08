/**
 * Document Upload Helper for Stagehand Agent
 * Converts base64 document to buffer and uploads to form
 */

async function uploadResumeToForm(page, documentData, documentType = 'resume') {
  if (!documentData || !documentData.contentBase64) {
    console.log(`⚠️  No ${documentType} data provided`);
    return false;
  }

  try {
    console.log(`📤 Preparing to upload ${documentType}: ${documentData.fileName}`);

    // Convert base64 to buffer
    const buffer = Buffer.from(documentData.contentBase64, 'base64');
    console.log(`  ✅ Converted to buffer: ${buffer.length} bytes`);

    // Find the appropriate file input element based on document type
    let fileInput;

    if (documentType === 'cover letter') {
      // For cover letter, look for second file input or one with "cover" in attributes
      const fileInputsLocator = page.locator('input[type="file"]');
      const fileInputCount = await fileInputsLocator.count();

      if (fileInputCount < 2) {
        console.log('  ℹ️  No cover letter field found in form (only one file input exists)');
        return false;
      }

      // Try to find input with "cover" in name, id, or aria-label
      let coverInput = null;
      for (let i = 0; i < fileInputCount; i++) {
        const input = fileInputsLocator.nth(i);
        const name = await input.getAttribute('name') || '';
        const id = await input.getAttribute('id') || '';
        const ariaLabel = await input.getAttribute('aria-label') || '';

        if (name.toLowerCase().includes('cover') ||
            id.toLowerCase().includes('cover') ||
            ariaLabel.toLowerCase().includes('cover')) {
          coverInput = input;
          break;
        }
      }

      // If no specific cover letter input found, use second file input
      fileInput = coverInput || fileInputsLocator.nth(1);
      console.log(`  📍 Using ${coverInput ? 'labeled cover letter' : 'second file'} input`);

    } else {
      // For resume, use first file input
      fileInput = await page.locator('input[type="file"]').first();
    }

    // Upload using setInputFiles with buffer
    await fileInput.setInputFiles({
      name: documentData.fileName,
      mimeType: documentData.fileType,
      buffer: buffer
    });

    console.log(`  ✅ ${documentType.charAt(0).toUpperCase() + documentType.slice(1)} uploaded successfully: ${documentData.fileName}`);
    return true;

  } catch (error) {
    console.error(`  ❌ ${documentType.charAt(0).toUpperCase() + documentType.slice(1)} upload failed: ${error.message}`);
    return false;
  }
}

module.exports = { uploadResumeToForm };
