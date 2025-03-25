// app/api/pdf-proxy/route.ts (for App Router in Next.js)
import { NextRequest } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");

  if (!urlParam) {
    return new Response(JSON.stringify({ error: "URL parameter missing" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(urlParam);

    // Extract the S3 object key from the presigned URL
    const match = decodedUrl.match(/public\/(.+\.pdf)/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Invalid S3 key in URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const key = `public/${match[1]}`;

    const s3Res = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: key,
      })
    );

    const stream = s3Res.Body as ReadableStream;

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${match[1]}"`,
        "Accept-Ranges": "bytes",
        "Content-Length": s3Res.ContentLength?.toString() || "",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "X-Frame-Options": "ALLOWALL",
        "Cache-Control": "max-age=600",
        "Content-Security-Policy":
          "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' *",
      },
    });
  } catch (error) {
    console.error("PDF proxy streaming error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to stream PDF",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
