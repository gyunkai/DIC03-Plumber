import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Define the Kiwi bot API URL
const KIWI_BOT_URL = 'http://localhost:5000/query';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, pdfName } = body;

        console.log(`Received message: ${message}`);
        console.log(`PDF Name: ${pdfName}`);

        if (!message) {
            return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }

        // Forward user message to kiwi bot
        const response = await axios.post(KIWI_BOT_URL, {
            query: message,
            pdf_name: pdfName,
            use_all_chunks: true  // Always use all available chunks
        });

        // Return kiwi bot's response
        return NextResponse.json({
            answer: response.data.answer
        });

    } catch (error) {
        console.error("Error processing chat message:", error);
        return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
    }
} 