import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    // Get URL parameter
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter missing' }, { status: 400 });
    }

    try {
        // Decode URL (if encoded)
        const decodedUrl = decodeURIComponent(url);

        // Fetch PDF content
        const response = await fetch(decodedUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        // Get response buffer
        const pdfBuffer = await response.arrayBuffer();

        // Build new response with proper headers
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Length': pdfBuffer.byteLength.toString(),
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Cache-Control': 'max-age=300',
                // Set X-Frame-Options to allow any origin
                'X-Frame-Options': 'ALLOWALL',
                // Allow embedding from any origin
                'Content-Security-Policy': "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' *"
            }
        });
    } catch (error) {
        console.error('PDF proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch PDF', details: (error as Error).message },
            { status: 500 }
        );
    }
} 