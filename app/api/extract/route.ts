import { NextRequest, NextResponse } from 'next/server';
import { 
  extractTextFromFile, 
  ExtractionError, 
  SUPPORTED_FILE_TYPES,
  isSupportedFileType,
  getFileTypeName 
} from '@/src/lib/extract';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime for file processing
export const runtime = 'nodejs';

// Configure maximum request size (10MB)
export const maxDuration = 30; // 30 seconds timeout

/**
 * POST /api/extract
 * Extracts plain text from uploaded PDF/DOC/DOCX files
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get configuration
    const config = getConfig();

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validate file presence
    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No file provided',
          code: 'NO_FILE'
        },
        { status: 400 }
      );
    }

    // Basic file validation
    if (!file.name) {
      return NextResponse.json(
        { 
          success: false,
          error: 'File name is required',
          code: 'NO_FILENAME'
        },
        { status: 400 }
      );
    }

    // Check file type
    if (!isSupportedFileType(file.type)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Unsupported file type: ${file.type}. Supported types: PDF, DOC, DOCX`,
          code: 'UNSUPPORTED_TYPE',
          supportedTypes: Object.values(SUPPORTED_FILE_TYPES)
        },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > config.upload.maxFileSize) {
      return NextResponse.json(
        { 
          success: false,
          error: `File size too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size: ${(config.upload.maxFileSize / 1024 / 1024)}MB`,
          code: 'FILE_TOO_LARGE',
          maxSize: config.upload.maxFileSize
        },
        { status: 400 }
      );
    }

    // Check if file is empty
    if (file.size === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'File is empty',
          code: 'EMPTY_FILE'
        },
        { status: 400 }
      );
    }

    // Extract text from file
    const extractionResult = await extractTextFromFile(file);

    // Calculate total processing time
    const totalProcessingTime = Date.now() - startTime;

    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        text: extractionResult.text,
        metadata: {
          ...extractionResult.metadata,
          totalProcessingTime,
          fileTypeName: getFileTypeName(file.type),
        }
      },
      message: 'Text extracted successfully'
    });

  } catch (error) {
    console.error('Text extraction error:', error);

    // Handle extraction errors
    if (error instanceof ExtractionError) {
      const statusCode = getStatusCodeForError(error.code);
      
      return NextResponse.json(
        { 
          success: false,
          error: error.message,
          code: error.code,
          details: error.originalError?.message
        },
        { status: statusCode }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error during text extraction',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/extract
 * Returns API information and supported file types
 */
export async function GET() {
  const config = getConfig();

  return NextResponse.json({
    name: 'ResumeMax Text Extraction API',
    version: '1.0',
    description: 'Extract plain text from PDF and Word documents',
    endpoints: {
      POST: {
        description: 'Extract text from uploaded file',
        parameters: {
          file: 'File to extract text from (multipart/form-data)'
        },
        supportedTypes: Object.values(SUPPORTED_FILE_TYPES),
        maxFileSize: `${config.upload.maxFileSize / 1024 / 1024}MB`,
      }
    },
    supportedFormats: [
      {
        type: SUPPORTED_FILE_TYPES.PDF,
        name: 'PDF Document',
        extensions: ['.pdf']
      },
      {
        type: SUPPORTED_FILE_TYPES.DOC,
        name: 'Microsoft Word Document (Legacy)',
        extensions: ['.doc']
      },
      {
        type: SUPPORTED_FILE_TYPES.DOCX,
        name: 'Microsoft Word Document',
        extensions: ['.docx']
      }
    ],
    limits: {
      maxFileSize: config.upload.maxFileSize,
      maxFileSizeMB: config.upload.maxFileSize / 1024 / 1024,
      timeout: 30,
    },
    runtime: 'nodejs',
  });
}

/**
 * OPTIONS /api/extract
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Get appropriate HTTP status code for extraction error
 */
function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'NO_FILE':
    case 'NO_FILENAME':
    case 'INVALID_FILE':
    case 'EMPTY_FILE':
      return 400; // Bad Request
    
    case 'UNSUPPORTED_TYPE':
      return 415; // Unsupported Media Type
    
    case 'FILE_TOO_LARGE':
      return 413; // Payload Too Large
    
    case 'PDF_EXTRACTION_FAILED':
    case 'WORD_EXTRACTION_FAILED':
    case 'NO_TEXT_EXTRACTED':
      return 422; // Unprocessable Entity
    
    case 'INVALID_RESULT':
    case 'UNKNOWN_ERROR':
    default:
      return 500; // Internal Server Error
  }
}
