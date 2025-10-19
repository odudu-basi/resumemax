import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile } from '@/src/lib/extract';

// Force Node.js runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Text Extraction API Called ===');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Extract text from the file
    const extractionResult = await extractTextFromFile(file);
    
    console.log('Text extraction completed, length:', extractionResult.text.length);
    console.log('Word count:', extractionResult.metadata.wordCount);

    return NextResponse.json({
      success: true,
      text: extractionResult.text,
      metadata: extractionResult.metadata
    });

  } catch (error) {
    console.error('=== Text extraction error ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract text from file';
    console.log('Returning error response:', errorMessage);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        type: typeof error,
        constructor: error?.constructor?.name 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Text extraction API endpoint',
    usage: 'POST with multipart/form-data containing a file',
    supportedTypes: ['PDF', 'DOC', 'DOCX']
  });
}
