import { NextResponse } from 'next/server';
import axios from 'axios';

// Define the Kiwi bot API URL
const KIWI_BOT_URL = 'http://localhost:5000/query';
const KIWI_LOAD_PDF_URL = 'http://localhost:5000/load_pdf';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message, pdfName } = body;

        // If pdfName is provided, load the specific PDF first
        if (pdfName) {
            try {
                // Load the PDF embeddings
                await axios.post(KIWI_LOAD_PDF_URL, {
                    pdf_name: pdfName
                });

                // If there's no message, just return success for PDF loading
                if (!message) {
                    return NextResponse.json({
                        status: "success",
                        message: `Loaded PDF: ${pdfName}`
                    });
                }
            } catch (pdfError) {
                console.error("Error loading PDF:", pdfError);
                // Continue with the message if there is one, even if PDF loading failed
                if (!message) {
                    return NextResponse.json({ error: "Failed to load PDF" }, { status: 500 });
                }
            }
        }

        if (!message) {
            return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }

        // Forward user message to kiwi bot
        const response = await axios.post(KIWI_BOT_URL, {
            query: message
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