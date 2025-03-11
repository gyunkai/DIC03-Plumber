import { NextRequest, NextResponse } from "next/server";
import { getPdfFromS3 } from "@/app/utils/s3";

export async function GET(
    request: NextRequest,
    { params }: { params: { key: string[] } }
) {
    try {
        // Join the key segments with slashes to get the full path
        const fullKey = params.key.join('/');

        if (!fullKey) {
            return NextResponse.json(
                { error: "PDF key is required" },
                { status: 400 }
            );
        }

        console.log("Fetching PDF with key:", fullKey);

        // Get PDF file directly from S3
        const pdfBuffer = await getPdfFromS3(fullKey);

        // Return PDF file with appropriate headers
        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${fullKey.split('/').pop()}"`,
                "Content-Length": pdfBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error("Error fetching PDF:", error);
        return NextResponse.json(
            { error: "Failed to fetch PDF" },
            { status: 500 }
        );
    }
} 