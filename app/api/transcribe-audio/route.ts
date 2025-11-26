import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getConfig } from '@/src/lib/env';

// Force Node.js runtime
export const runtime = 'nodejs';

// Get configuration
const config = getConfig();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== Transcribe Audio API Called ===');

    // Get the form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('Audio file received:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    });

    // Convert File to Buffer for OpenAI
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a new File object for OpenAI (it needs the file in a specific format)
    const file = new File([buffer], audioFile.name, { type: audioFile.type });

    // Call OpenAI Whisper API
    console.log('Calling OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en', // You can make this dynamic if needed
      response_format: 'text',
    });

    console.log('Transcription successful');
    console.log('Transcription length:', transcription.length);

    return NextResponse.json({
      success: true,
      transcription: transcription,
    });

  } catch (error) {
    console.error('=== Transcription error ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio';
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
    message: 'Audio transcription API endpoint',
    usage: 'POST with FormData containing an audio file',
    supportedFormats: ['webm', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'ogg']
  });
}
