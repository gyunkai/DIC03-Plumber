import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const KIWI_BOT_URL = 'http://127.0.0.1:5000/query';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Extract all necessary fields, including quiz_mode
    const { message, pdfName, userId, userName, userEmail, quiz_mode} = body;
    const  pdf_url = pdfName; 
    console.log(`PDF URL: ${pdf_url}`);

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

    // Forward user message along with all user info and the quiz_mode flag to Kiwi Bot
    const response = await axios.post(KIWI_BOT_URL, {
      query: message,
      pdf_url: pdf_url, 
      pdf_name: filename,
      use_all_chunks: true,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      quiz_mode: quiz_mode, // Include quiz_mode flag here
    });

    // Return Kiwi Bot's response (should include an "answer" property)
    return NextResponse.json({
      answer: response.data.answer
    });

  } catch (error) {
    console.error("Error processing chat message:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
