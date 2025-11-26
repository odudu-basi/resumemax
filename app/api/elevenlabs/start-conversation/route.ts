import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { agentId, apiKey } = await request.json();

    if (!agentId || !apiKey) {
      return NextResponse.json(
        { error: 'Agent ID and API key are required' },
        { status: 400 }
      );
    }

    // Start conversation with ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        agent_id: agentId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('ElevenLabs API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to start conversation with ElevenLabs', details: errorData },
        { status: response.status }
      );
    }

    const conversationData = await response.json();
    
    return NextResponse.json({
      success: true,
      conversationId: conversationData.conversation_id,
      data: conversationData
    });

  } catch (error: any) {
    console.error('Start conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
