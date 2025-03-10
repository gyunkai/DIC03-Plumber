import { NextRequest, NextResponse } from "next/server";
import { getPdfPresignedUrl } from "@/app/utils/s3";

export async function GET(request: NextRequest) {
    try {

        const { searchParams } = new URL(request.url);
        const key = searchParams.get("key");

        if (!key) {
            return NextResponse.json(
                { error: "PDF key is required" },
                { status: 400 }
            );
        }


        const url = await getPdfPresignedUrl(key);


        return NextResponse.json({ url });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL" },
            { status: 500 }
        );
    }
} 