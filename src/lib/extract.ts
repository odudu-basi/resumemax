import mammoth from 'mammoth';
import { z } from 'zod';

// Import pdf-parse using require for Node.js compatibility
// This works reliably in Next.js API routes with Node.js runtime

/**
 * Supported file types for text extraction
 */
export const SUPPORTED_FILE_TYPES = {
  PDF: 'application/pdf',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

/**
 * File validation schema
 */
export const FileValidationSchema = z.object({
  type: z.string(),
  size: z.number(),
  name: z.string(),
});

/**
 * Extraction result schema
 */
export const ExtractionResultSchema = z.object({
  text: z.string(),
  metadata: z.object({
    fileName: z.string(),
    fileSize: z.number(),
    fileType: z.string(),
    pageCount: z.number().optional(),
    wordCount: z.number(),
    characterCount: z.number(),
    extractedAt: z.date(),
    processingTime: z.number(),
  }),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Custom error class for extraction errors
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): void {
  const validation = FileValidationSchema.safeParse({
    type: file.type,
    size: file.size,
    name: file.name,
  });

  if (!validation.success) {
    throw new ExtractionError(
      'Invalid file format',
      'INVALID_FILE',
      new Error(validation.error.message)
    );
  }

  // Check file type
  const supportedTypes = Object.values(SUPPORTED_FILE_TYPES);
  if (!supportedTypes.includes(file.type as any)) {
    throw new ExtractionError(
      `Unsupported file type: ${file.type}. Supported types: PDF, DOC, DOCX`,
      'UNSUPPORTED_TYPE'
    );
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new ExtractionError(
      `File size too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size: 10MB`,
      'FILE_TOO_LARGE'
    );
  }

  // Check if file is empty
  if (file.size === 0) {
    throw new ExtractionError(
      'File is empty',
      'EMPTY_FILE'
    );
  }
}

/**
 * Extract text from PDF file using pdf2json
 */
async function extractFromPDF(buffer: Buffer): Promise<{ text: string; pageCount?: number }> {
  try {
    console.log('Starting PDF extraction with pdf2json');
    console.log('Buffer size:', buffer.length);
    
    // Import pdf2json
    const PDFParser = require('pdf2json');
    
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      // Set up event listeners
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('PDF parsing error:', errData);
        reject(new Error(`PDF parsing failed: ${errData.parserError}`));
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          console.log('PDF parsing successful!');
          console.log('Page count:', pdfData.Pages?.length || 0);
          
          let fullText = '';
          
          // Extract text from each page
          if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
            pdfData.Pages.forEach((page: any, pageIndex: number) => {
              if (page.Texts && Array.isArray(page.Texts)) {
                const pageText = page.Texts
                  .map((textItem: any) => {
                    if (textItem.R && Array.isArray(textItem.R)) {
                      return textItem.R
                        .map((run: any) => {
                          try {
                            return decodeURIComponent(run.T || '');
                          } catch (e) {
                            // If decoding fails, return the raw text
                            return run.T || '';
                          }
                        })
                        .join('');
                    }
                    return '';
                  })
                  .join(' ');
                
                fullText += pageText + '\n';
                console.log(`Page ${pageIndex + 1} extracted, text length: ${pageText.length}`);
              }
            });
          }
          
          console.log('Total text length:', fullText.length);
          
          resolve({
            text: fullText.trim(),
            pageCount: pdfData.Pages?.length || 0,
          });
        } catch (processingError) {
          console.error('Error processing PDF data:', processingError);
          reject(processingError);
        }
      });
      
      // Parse the PDF buffer
      pdfParser.parseBuffer(buffer);
    });
  } catch (error) {
    console.error('=== PDF PARSING ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    
    throw new ExtractionError(
      'Failed to extract text from PDF',
      'PDF_EXTRACTION_FAILED',
      error as Error
    );
  }
}

/**
 * Extract text from DOC/DOCX file
 */
async function extractFromWord(buffer: Buffer): Promise<{ text: string }> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    if (result.messages && result.messages.length > 0) {
      // Log warnings but don't fail
      console.warn('Word extraction warnings:', result.messages);
    }

    return {
      text: result.value,
    };
  } catch (error) {
    throw new ExtractionError(
      'Failed to extract text from Word document',
      'WORD_EXTRACTION_FAILED',
      error as Error
    );
  }
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
}

/**
 * Calculate text statistics
 */
function calculateTextStats(text: string): {
  wordCount: number;
  characterCount: number;
} {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const characterCount = text.length;

  return {
    wordCount,
    characterCount,
  };
}

/**
 * Main text extraction function
 */
export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Validate file
    validateFile(file);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractionResult: { text: string; pageCount?: number };

    // Extract text based on file type
    switch (file.type) {
      case SUPPORTED_FILE_TYPES.PDF:
        extractionResult = await extractFromPDF(buffer);
        break;
      
      case SUPPORTED_FILE_TYPES.DOC:
      case SUPPORTED_FILE_TYPES.DOCX:
        extractionResult = await extractFromWord(buffer);
        break;
      
      default:
        throw new ExtractionError(
          `Unsupported file type: ${file.type}`,
          'UNSUPPORTED_TYPE'
        );
    }

    // Clean the extracted text
    const cleanedText = cleanText(extractionResult.text);

    // Check if we got any meaningful text
    if (!cleanedText || cleanedText.length < 10) {
      throw new ExtractionError(
        'No meaningful text could be extracted from the file. The file may be corrupted, password-protected, or contain only images.',
        'NO_TEXT_EXTRACTED'
      );
    }

    // Calculate text statistics
    const textStats = calculateTextStats(cleanedText);
    const processingTime = Date.now() - startTime;

    // Create result object
    const result: ExtractionResult = {
      text: cleanedText,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        pageCount: extractionResult.pageCount,
        wordCount: textStats.wordCount,
        characterCount: textStats.characterCount,
        extractedAt: new Date(),
        processingTime,
      },
    };

    // Validate result
    const validation = ExtractionResultSchema.safeParse(result);
    if (!validation.success) {
      throw new ExtractionError(
        'Invalid extraction result',
        'INVALID_RESULT',
        new Error(validation.error.message)
      );
    }

    return result;

  } catch (error) {
    if (error instanceof ExtractionError) {
      throw error;
    }

    throw new ExtractionError(
      'Unexpected error during text extraction',
      'UNKNOWN_ERROR',
      error as Error
    );
  }
}

/**
 * Extract text from buffer (for server-side use)
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  fileType: string
): Promise<ExtractionResult> {
  // Create a mock File object for validation
  const mockFile = {
    name: fileName,
    type: fileType,
    size: buffer.length,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as File;

  return extractTextFromFile(mockFile);
}

/**
 * Get file type from file extension
 */
export function getFileTypeFromExtension(fileName: string): string | null {
  const extension = fileName.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'pdf':
      return SUPPORTED_FILE_TYPES.PDF;
    case 'doc':
      return SUPPORTED_FILE_TYPES.DOC;
    case 'docx':
      return SUPPORTED_FILE_TYPES.DOCX;
    default:
      return null;
  }
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(fileType: string): boolean {
  return Object.values(SUPPORTED_FILE_TYPES).includes(fileType as any);
}

/**
 * Get human-readable file type name
 */
export function getFileTypeName(fileType: string): string {
  switch (fileType) {
    case SUPPORTED_FILE_TYPES.PDF:
      return 'PDF Document';
    case SUPPORTED_FILE_TYPES.DOC:
      return 'Microsoft Word Document (Legacy)';
    case SUPPORTED_FILE_TYPES.DOCX:
      return 'Microsoft Word Document';
    default:
      return 'Unknown Document Type';
  }
}
