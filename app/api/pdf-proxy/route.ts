import { NextRequest } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

// In-memory cache with timestamp (optional TTL logic)
type CachedFile = {
  data: Uint8Array;
  timestamp: number;
};
const pdfCache = new Map<string, CachedFile>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
  const download = searchParams.get("download") === "true";

  if (!urlParam) {
    return new Response(JSON.stringify({ error: "URL parameter missing" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(urlParam);
    const match = decodedUrl.match(/public\/([^?#]+\.pdf)/);

    if (!match) {
      return new Response(JSON.stringify({ error: "Invalid S3 key in URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const key = `public/${match[1]}`;
    const fileName = match[1];

    let fileBuffer: Uint8Array;

    const cached = pdfCache.get(key);
    const isValidCache =
      cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

    if (isValidCache) {
      fileBuffer = cached.data;
      console.log(`✅ Serving "${key}" from memory cache`);
    } else {
      console.log(`⏬ Fetching "${key}" from S3...`);

      const s3Res = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: key,
        })
      );

      const stream = s3Res.Body as Readable;
      const chunks: Uint8Array[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk as Uint8Array);
      }

      fileBuffer = Buffer.concat(chunks);
      pdfCache.set(key, { data: fileBuffer, timestamp: Date.now() });
      console.log(`📦 Cached "${key}" in memory`);
    }

    // Handle Range header for progressive loading
    const range = request.headers.get("range");

    if (range) {
      const byteRange = range.match(/bytes=(\d+)-(\d*)/);
      if (byteRange) {
        const start = parseInt(byteRange[1], 10);
        const end = byteRange[2]
          ? parseInt(byteRange[2], 10)
          : fileBuffer.length - 1;

        if (start >= fileBuffer.length || end >= fileBuffer.length) {
          return new Response(null, {
            status: 416,
            headers: {
              "Content-Range": `bytes */${fileBuffer.length}`,
            },
          });
        }

        const chunk = fileBuffer.slice(start, end + 1);

        return new Response(chunk, {
          status: 206,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Range": `bytes ${start}-${end}/${fileBuffer.length}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunk.length.toString(),
            "Content-Disposition": download
              ? `attachment; filename="${fileName}"`
              : `inline; filename="${fileName}"`,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "X-Frame-Options": "ALLOWALL",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' *",
          },
        });
      }
    }

    // If no Range requested → send whole PDF
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": download
          ? `attachment; filename="${fileName}"`
          : `inline; filename="${fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "X-Frame-Options": "ALLOWALL",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' *",
      },
    });
  } catch (error) {
    console.error("❌ PDF proxy streaming error:", error);
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
