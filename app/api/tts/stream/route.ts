import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Ensure the audio directory exists
const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voice = 'alloy', model = 'tts-1', speed = 1.0 } = body;

    console.log('Starting TTS request with text length:', text.length);

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

      console.log('TTS server response status:', response.status);
      console.log('TTS server response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('TTS server error:', errorText);
        return NextResponse.json({ error: errorText }, { status: response.status });
      }

      // Get the audio data as a buffer
      const buffer = await response.buffer();
      console.log('Received audio buffer size:', buffer.length);

      if (buffer.length === 0) {
        console.error('Received empty buffer from TTS server');
        return NextResponse.json(
          { error: 'Received empty audio data from TTS server' },
          { status: 500 }
        );
      }

      // Save the audio file locally for debugging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tts-${timestamp}.mp3`;
      const filePath = path.join(AUDIO_DIR, filename);
      
      try {
        fs.writeFileSync(filePath, buffer);
        console.log(`Successfully saved audio file to: ${filePath}`);
      } catch (writeError) {
        console.error('Failed to save audio file:', writeError);
        // Continue even if saving fails
      }

      // Return the audio data directly
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache',
        },
      });

    } catch (fetchError: any) {
      if (fetchError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'TTS server is not running. Please start the TTS server on port 5002.' },
          { status: 503 }
        );
      }
      console.error('Fetch error in TTS API route:', fetchError);
      return NextResponse.json(
        { error: 'Failed to generate speech. Please try again later.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in TTS API route:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech. Please try again later.' },
      { status: 500 }
    );
  }
} 