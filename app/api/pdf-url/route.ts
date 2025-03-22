import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/app/utils/s3";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get("key");

        if (!key) {
            return NextResponse.json(
                { success: false, error: "PDF key is required" },
                { status: 400 }
            );
        }

        // Add public/ prefix to match S3 storage path
        const s3Key = `public/${key}`;
        console.log("Requesting S3 file path:", s3Key);
        const url = await getPresignedUrl(s3Key);

        return NextResponse.json({ success: true, url });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate presigned URL" },
            { status: 500 }
        );
    }
} 