import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define the Kiwi bot API URL
const KIWI_BOT_URL = 'http://localhost:5000/query';
const KIWI_LOAD_PDF_URL = 'http://localhost:5000/load_pdf';

export async function POST(req: NextRequest) {
    try {
        const { message, userId, sessionId, pdfName } = await req.json();

        console.log(`Received message: ${message}`);
        console.log(`User ID: ${userId}`);
        console.log(`Session ID: ${sessionId}`);
        console.log(`PDF Name: ${pdfName}`);

        // Get all PDF chunks from database
        const pdfChunks = await prisma.pdfChunk.findMany();
        console.log(`Retrieved ${pdfChunks.length} PDF chunks from database`);

        // Get user information
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, systemRole: true }
        });
        console.log(`Retrieved user information: ${JSON.stringify(user)}`);

        // Store user message in database
        await prisma.chatMessage.create({
            data: {
                content: message,
                sender: 'user',
                userId,
                sessionId,
                pdfKey: pdfName || null
            }
        });

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

        // Send request to Kiwi Flask bot with user info and PDF chunks
        const response = await axios.post('http://localhost:5000/query', {
            query: message,
            user_info: user,
            pdf_name: pdfName,
            use_all_chunks: true
        });

        const botResponse = response.data.response;
        console.log(`Bot response: ${botResponse}`);

        // Store bot response in database
        await prisma.chatMessage.create({
            data: {
                content: botResponse,
                sender: 'bot',
                userId,
                sessionId,
                pdfKey: pdfName || null
            }
        });

        return NextResponse.json({ response: botResponse });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Failed to process your request' },
            { status: 500 }
        );
    }
} 