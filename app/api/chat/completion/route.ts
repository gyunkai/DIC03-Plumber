import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse } from "@/app/utils/openai";
import prisma from "@/app/lib/prisma";

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
        const { messages, pdfKey } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Messages array is required" },
                { status: 400 }
            );
        }

        // Format messages for OpenAI
        const formattedMessages = messages.map(msg => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.content
        }));

        // Generate response from OpenAI
        const responseText = await generateChatResponse(formattedMessages);

        // Create a response message
        const responseMessage = {
            content: responseText,
            sender: "bot",
            timestamp: new Date(),
        };

        // Save the message to the database
        try {
            await prisma.chatMessage.create({
                data: {
                    content: responseText,
                    sender: "bot",
                    userId: sessionData.userId,
                    pdfKey,
                },
            });
        } catch (dbError) {
            console.error("Error saving bot message to database:", dbError);
            // Continue even if database save fails
        }

        return NextResponse.json({
            success: true,
            message: responseMessage,
        });
    } catch (error) {
        console.error("Error generating chat completion:", error);
        return NextResponse.json(
            { error: "Failed to generate chat completion" },
            { status: 500 }
        );
    }
} 