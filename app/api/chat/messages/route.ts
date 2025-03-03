import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { generateEmbedding } from "@/app/utils/openai";

// Get chat messages for a user
export async function GET(request: NextRequest) {
    try {
        // Get session cookie
        const sessionCookie = request.cookies.get("session");

        // If no session cookie, user is not authenticated
        if (!sessionCookie) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        // Parse session data
        let sessionData;
        try {
            sessionData = JSON.parse(sessionCookie.value);
        } catch (error) {
            return NextResponse.json(
                { error: "Invalid session" },
                { status: 401 }
            );
        }

        // If no user ID in session, user is not authenticated
        if (!sessionData.userId) {
            return NextResponse.json(
                { error: "Invalid session" },
                { status: 401 }
            );
        }

        // Get URL parameters
        const url = new URL(request.url);
        const pdfKey = url.searchParams.get("pdfKey");
        const limit = parseInt(url.searchParams.get("limit") || "50");

        // Query to get messages
        const whereClause: any = {
            userId: sessionData.userId,
        };

        // If PDF key is provided, filter by it
        if (pdfKey) {
            whereClause.pdfKey = pdfKey;
        }

        // Get chat messages for the user
        const messages = await prisma.chatMessage.findMany({
            where: whereClause,
            orderBy: {
                timestamp: "asc",
            },
            take: limit,
            select: {
                id: true,
                content: true,
                sender: true,
                timestamp: true,
                pdfKey: true,
            },
        });

        return NextResponse.json({
            success: true,
            messages,
        });
    } catch (error) {
        console.error("Error fetching chat messages:", error);
        return NextResponse.json(
            { error: "Failed to fetch chat messages" },
            { status: 500 }
        );
    }
}

// Save a new chat message
export async function POST(request: NextRequest) {
    try {
        // Get session cookie
        const sessionCookie = request.cookies.get("session");

        // If no session cookie, user is not authenticated
        if (!sessionCookie) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        // Parse session data
        let sessionData;
        try {
            sessionData = JSON.parse(sessionCookie.value);
        } catch (error) {
            return NextResponse.json(
                { error: "Invalid session" },
                { status: 401 }
            );
        }

        // If no user ID in session, user is not authenticated
        if (!sessionData.userId) {
            return NextResponse.json(
                { error: "Invalid session" },
                { status: 401 }
            );
        }

        // Get request body
        const body = await request.json();
        const { content, sender, pdfKey } = body;

        if (!content || !sender) {
            return NextResponse.json(
                { error: "Content and sender are required" },
                { status: 400 }
            );
        }

        // Create a new chat message
        const message = await prisma.chatMessage.create({
            data: {
                content,
                sender,
                userId: sessionData.userId,
                pdfKey,
            },
        });

        // Generate embedding for the message
        try {
            const embedding = await generateEmbedding(content);

            // Save the embedding
            await prisma.chatEmbedding.create({
                data: {
                    messageId: message.id,
                    embedding,
                },
            });
        } catch (embeddingError) {
            console.error("Error generating embedding:", embeddingError);
            // Continue even if embedding fails
        }

        return NextResponse.json({
            success: true,
            message,
        });
    } catch (error) {
        console.error("Error saving chat message:", error);
        return NextResponse.json(
            { error: "Failed to save chat message" },
            { status: 500 }
        );
    }
} 