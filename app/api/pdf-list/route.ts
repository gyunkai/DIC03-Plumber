import { NextRequest, NextResponse } from "next/server";
import { listPdfFiles, pdfFiles } from "@/app/utils/s3";

export async function GET(request: NextRequest) {
    try {
        // Get PDF files list from S3
        const files = await listPdfFiles();
        console.log(files);
        // If no files found, use static list as fallback
        const pdfList = files.length > 0 ? files : pdfFiles;

        return NextResponse.json({ files: pdfList });
    } catch (error) {
        console.error("Error listing PDF files:", error);
        return NextResponse.json(
            { error: "Failed to list PDF files", files: pdfFiles },
            { status: 500 }
        );
    }
} 