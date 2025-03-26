import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voice = 'alloy', model = 'tts-1', speed = 1.0 } = body;

    // Forward the request to the TTS server
    try {
      const response = await fetch('http://127.0.0.1:5002/tts/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          voice,
          model,
          speed
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: errorText }, { status: response.status });
      }

      // Get the audio data as a buffer
      const buffer = await response.buffer();

      // Return the audio data with the correct content type
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
        },
      });
    } catch (fetchError: any) {
      if (fetchError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'TTS server is not running. Please start the TTS server on port 5002.' },
          { status: 503 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in TTS API route:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech. Please try again later.' },
      { status: 500 }
    );
  }
} 