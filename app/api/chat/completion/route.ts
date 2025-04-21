import { NextRequest, NextResponse } from "next/server";
import axios from 'axios';

// Define message type
interface Message {
    content: string;
    sender: 'user' | 'bot';
    timestamp?: Date;
}

// Define the Kiwi bot API URL (copy from chat/route.ts)
const KIWI_BOT_URL = 'http://localhost:5000/query';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, pdfKey } = body;

        // Get the latest user message
        const lastUserMessage = messages.filter((m: Message) => m.sender === 'user').pop();

        if (!lastUserMessage) {
            return NextResponse.json({
                success: false,
                error: "No user message found"
            }, { status: 400 });
        }

        // Extract just the filename from the path if it exists (copied from chat/route.ts)
        let filename = pdfKey;
        if (pdfKey && pdfKey.includes('/')) {
            filename = pdfKey.split('/').pop();
        } else if (pdfKey && pdfKey.includes('\\')) {
            filename = pdfKey.split('\\').pop();
        }

        console.log(`Processing message: "${lastUserMessage.content}"`);
        console.log(`Using PDF: ${filename}`);

        try {
            // Directly forward user message to kiwi bot (skip the intermediate /api/chat call)
            const response = await axios.post(KIWI_BOT_URL, {
                query: lastUserMessage.content,
                pdf_name: filename,
                use_all_chunks: true  // Always use all available chunks
            });

            console.log("Received response from Kiwi Bot");

            // Format response to match the expected format for this endpoint
            return NextResponse.json({
                success: true,
                message: {
                    content: response.data.answer,
                    sender: "bot"
                }
            });
        } catch (kiwiBotError) {
            // Add type check for the error object
            let errorMessage = "An unknown error occurred while connecting to Kiwi Bot";
            if (kiwiBotError instanceof Error) {
                errorMessage = kiwiBotError.message;
            } else if (typeof kiwiBotError === 'string') {
                errorMessage = kiwiBotError;
            }
            console.error("Error connecting to Kiwi Bot:", errorMessage);

            // Return a more specific error message
            return NextResponse.json({
                success: false,
                message: {
                    content: "Sorry, I couldn't connect to the Kiwi Bot backend. Please make sure it's running at http://localhost:5000.",
                    sender: "bot"
                }
            });
        }
    } catch (error) {
        console.error("Error processing completion:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to process completion request"
        }, { status: 500 });
    }
}