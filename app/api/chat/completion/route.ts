import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse } from "@/app/utils/openai";
import prisma from "@/app/lib/prisma";
import axios from 'axios';

// Define message type
interface Message {
    content: string;
    sender: 'user' | 'bot';
    timestamp?: Date;
}

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

        // Forward request to /api/chat
        const chatResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: lastUserMessage.content,
                pdfName: pdfKey,
            }),
        });

        if (!chatResponse.ok) {
            throw new Error("Failed to get response from chat API");
        }

        const chatData = await chatResponse.json();

        // Format response to match the expected format for this endpoint
        return NextResponse.json({
            success: true,
            message: {
                content: chatData.answer,
                sender: "bot"
            }
        });
    } catch (error) {
        console.error("Error processing completion:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to process completion request"
        }, { status: 500 });
    }
} 