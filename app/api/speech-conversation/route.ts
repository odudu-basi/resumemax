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

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are a friendly and professional AI career coach with extensive experience in recruitment and talent assessment. Your role is to conduct thorough, conversational interviews to help candidates articulate their experiences and prepare for real interviews.

## Your Expertise:
- Deep knowledge of recruitment best practices and what employers look for
- Skilled at asking probing questions that reveal a candidate's true capabilities
- Expert at helping candidates tell compelling stories about their experiences
- Knowledgeable about various industries and role requirements

## Your Approach:
1. **Be Conversational**: Speak naturally and warmly, as if you're having a friendly chat
2. **Ask Follow-up Questions**: Dig deeper into experiences to uncover specific examples, challenges overcome, and lessons learned
3. **Focus on Stories**: Help candidates develop STAR (Situation, Task, Action, Result) narratives
4. **Be Encouraging**: Build confidence while providing constructive feedback
5. **Listen Actively**: When the user speaks, stop talking and let them share their thoughts

## Key Areas to Explore:
- **Technical Skills**: How they've applied their skills in real situations
- **Problem-Solving**: Specific challenges they've faced and how they overcame them
- **Leadership & Teamwork**: Examples of collaboration, mentoring, or leading initiatives
- **Growth & Learning**: How they've developed professionally and personally
- **Impact & Results**: Quantifiable achievements and business impact
- **Career Motivation**: What drives them and their career aspirations

## Guidelines:
- Keep responses conversational and under 2-3 sentences when possible
- Ask one focused question at a time
- Use the resume context to ask specific, relevant questions
- Help them practice articulating their value proposition
- Provide gentle guidance on how to improve their responses
- Be genuinely curious about their experiences

## Conversation Flow:
1. Start with a warm greeting and brief overview of what you'll discuss
2. Begin with their most recent or relevant experience
3. Ask progressively deeper questions about each role/project
4. Help them connect experiences to the types of roles they're seeking
5. Wrap up with key strengths and areas for continued development

Remember: Your goal is to help them become more confident and articulate about their professional journey. Be supportive, insightful, and genuinely interested in helping them succeed.`;

export async function POST(request: NextRequest) {
  try {
    console.log('=== Speech Conversation API Called ===');

    const body = await request.json();
    const { audioData, resumeContext, conversationHistory = [] } = body;

    if (!audioData) {
      return NextResponse.json(
        { error: 'No audio data provided' },
        { status: 400 }
      );
    }

    console.log('Processing speech conversation with resume context');

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Create a File object for OpenAI
    const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

    // Step 1: Transcribe the user's speech
    console.log('Transcribing user speech...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text',
    });

    console.log('User said:', transcription);

    // Step 2: Build conversation context
    const messages = [
      {
        role: 'system' as const,
        content: `${SYSTEM_PROMPT}

## Resume Context:
${resumeContext || 'No resume context provided. Ask the user to share their background.'}

## Instructions:
- Use the resume information above to ask specific, relevant questions
- Reference specific roles, companies, or experiences from their resume
- Help them elaborate on achievements and experiences mentioned in their resume
- Keep your responses conversational and under 2-3 sentences`
      }
    ];

    // Add conversation history
    conversationHistory.forEach((msg: any) => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add the new user message
    messages.push({
      role: 'user' as const,
      content: transcription
    });

    // Step 3: Generate AI response
    console.log('Generating AI response...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 300,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, I didn\'t catch that. Could you please repeat?';

    console.log('AI response:', aiResponse);

    // Step 4: Convert AI response to speech
    console.log('Converting AI response to speech...');
    const speechResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova', // Friendly, professional female voice
      input: aiResponse,
      response_format: 'mp3',
    });

    // Convert response to buffer and then base64
    const audioArrayBuffer = await speechResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');

    console.log('Speech conversion completed');

    return NextResponse.json({
      success: true,
      userTranscription: transcription,
      aiResponse: aiResponse,
      audioResponse: audioBase64,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: transcription },
        { role: 'assistant', content: aiResponse }
      ]
    });

  } catch (error) {
    console.error('=== Speech conversation error ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to process speech conversation';
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
    message: 'Speech conversation API endpoint',
    usage: 'POST with audioData (base64), resumeContext (string), and conversationHistory (array)',
    features: ['Speech-to-text', 'AI conversation', 'Text-to-speech', 'Resume context integration']
  });
}
