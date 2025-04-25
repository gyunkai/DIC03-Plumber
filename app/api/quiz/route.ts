import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Define the Kiwi bot API URL
const KIWI_BOT_URL = 'http://127.0.0.1:5000/generate_quiz';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { pdfKey, numberOfQuestions = 1, difficulty = 'medium' } = body;

        if (!pdfKey) {
            return NextResponse.json({ error: "PDF key is required" }, { status: 400 });
        }
        console.log("pdfKey", pdfKey);
        // Extract just the filename from the path if it exists
        let filename = pdfKey;


        console.log(`Generating quiz for PDF: ${filename}, Questions: ${numberOfQuestions}, Difficulty: ${difficulty}`);

        // Forward quiz generation request to kiwi bot
        const requestBody = {
            pdf_path: filename,
            num_questions: numberOfQuestions,
            difficulty: difficulty
        };
        
        console.log("Sending request to Kiwi bot:", JSON.stringify(requestBody));
        
        const response = await axios.post(KIWI_BOT_URL, requestBody);

        // Return quiz data
        return NextResponse.json({
            success: true,
            quiz: response.data.quiz
        });

    } catch (error: any) {
        console.error("Error generating quiz:", error);
        
        // Enhanced error logging
        if (error.response) {
            console.error("Response error data:", error.response.data);
            console.error("Response error status:", error.response.status);
        }
        
        return NextResponse.json({ 
            success: false,
            error: "Failed to generate quiz" 
        }, { status: 500 });
    }
}