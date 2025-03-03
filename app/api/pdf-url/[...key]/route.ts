import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/app/utils/s3";

interface Params {
    params: {
        key: string[]
    }
}

export async function GET(
    request: NextRequest,
    context: Params
) {
    try {
        // Ensure params is properly awaited by using context
        const { params } = context;

        // Join the key segments with slashes to get the full path
        const fullKey = params.key.join('/');

        if (!fullKey) {
            return NextResponse.json(
                { error: "PDF key is required" },
                { status: 400 }
            );
        }

        console.log("Generating presigned URL for PDF with key:", fullKey);

        // Generate a pre-signed URL for the PDF
        const presignedUrl = await getPresignedUrl(fullKey);

        // Return the pre-signed URL
        return NextResponse.json({
            success: true,
            url: presignedUrl
        });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL" },
            { status: 500 }
        );
    }
} 