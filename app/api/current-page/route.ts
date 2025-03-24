// Simple API to receive current page information without storing in database
import { NextRequest, NextResponse } from 'next/server';

// API endpoint to handle current page data
export async function POST(request: NextRequest) {
    console.log('[API] Current page endpoint called');

    try {
        // Parse the request body
        const body = await request.json();
        const { pdfKey, currentPage, totalPages } = body;

        // Validate required parameters
        if (!pdfKey || !currentPage) {
            console.error('[API] Missing required parameters:', { pdfKey, currentPage });
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Log the received information (English)
        console.log(`[API] PDF page information received - Key: ${pdfKey}, Current Page: ${currentPage}, Total Pages: ${totalPages}`);

        // Here you would typically store this information in a database
        // For now, we're just logging it

        // Return success response
        console.log('[API] Successfully processed page information');
        return NextResponse.json({
            success: true,
            message: 'Page information received',
            data: { pdfKey, currentPage, totalPages }
        });

    } catch (error) {
        // Log and handle errors
        console.error('[API] Error processing page information:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process page information' },
            { status: 500 }
        );
    }
} 