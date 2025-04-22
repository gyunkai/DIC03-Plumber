import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const KIWI_BOT_URL = 'http://127.0.0.1:5000/query';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, pdfName, userId, userName, userEmail, quiz_mode, pageNumber } = body;
    const pdf_url = pdfName;

    // Extract just the filename from the path if it exists
    let filename = pdfName;
    if (pdfName && pdfName.includes('/')) {
      filename = pdfName.split('/').pop();
    } else if (pdfName && pdfName.includes('\\')) {
      filename = pdfName.split('\\').pop();
    }

    if (!message) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    // Forward the request to the Flask backend
    const response = await axios.post(KIWI_BOT_URL, {
      query: message,
      pdf_url: pdf_url,
      pdf_name: filename,
      use_all_chunks: true,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      quiz_mode: quiz_mode,
      pageNumber: pageNumber,
    }, {
      responseType: 'stream',
    });

    // Create a TransformStream to process the response
    const stream = new TransformStream({
      async transform(chunk, controller) {
        // Convert the chunk to text
        const text = new TextDecoder().decode(chunk);
        // Split by double newlines to get individual SSE messages
        const messages = text.split('\n\n');

        for (const message of messages) {
          if (message.startsWith('data: ')) {
            // Forward the SSE message
            controller.enqueue(new TextEncoder().encode(message + '\n\n'));
          }
        }
      },
    });

    // Create a ReadableStream from the response data
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response.data) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    // Pipe the readable stream through our transform stream
    const transformedStream = readableStream.pipeThrough(stream);

    // Return the transformed stream
    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("Error processing chat message:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
} 