import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/app/utils/s3";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key || key.trim() === "") {
      return NextResponse.json(
        { success: false, error: "PDF key is required" },
        { status: 400 }
      );
    }

    // Sanitize input
    if (key.includes("..") || key.startsWith("/")) {
      return NextResponse.json(
        { success: false, error: "Invalid key format" },
        { status: 400 }
      );
    }

    // Prefix the key to match S3 structure
    const s3Key = key.startsWith("public/") ? key : `public/${key}`;
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
