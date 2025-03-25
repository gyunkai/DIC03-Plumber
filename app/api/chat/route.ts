import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import path from 'path';

// Define the Kiwi bot API URL
const KIWI_BOT_URL = 'http://127.0.0.1:5000/query';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, pdfName, userId, userName, userEmail } = body;  // Extract user session data

        console.log(`Received message: ${message}`);
        console.log(`Original PDF Name: ${pdfName}`);
        console.log(`User: ${userId}, ${userName}, ${userEmail}`);

        // Extract just the filename from the path if it exists
        let filename = pdfName;
        if (pdfName && pdfName.includes('/')) {
            filename = pdfName.split('/').pop();
        } else if (pdfName && pdfName.includes('\\')) {
            filename = pdfName.split('\\').pop();
        }

        console.log(`Processed PDF Name: ${filename}`);

        if (!message) {
            return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }

        // Forward user message along with user info to Kiwi bot
        const response = await axios.post(KIWI_BOT_URL, {
            query: message,
            pdf_name: filename,
            use_all_chunks: true,
            user_id: userId,
            user_name: userName,
            user_email: userEmail
        });

        // Return Kiwi bot's response
        return NextResponse.json({
            answer: response.data.answer
        });

    } catch (error) {
        console.error("Error processing chat message:", error);
        return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
    }
}
