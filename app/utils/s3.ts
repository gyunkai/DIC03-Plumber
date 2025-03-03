import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Create S3 client with fixed IAM credentials
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

// S3 bucket name
const bucketName = process.env.AWS_S3_BUCKET_NAME || "plumbers3";

// Get PDF file directly from S3
export async function getPdfFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    try {
        const response = await s3Client.send(command);

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        if (response.Body) {
            // @ts-ignore - AWS SDK types are not perfect
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
        }

        return Buffer.concat(chunks);
    } catch (error) {
        console.error("Error getting PDF from S3:", error);
        throw error;
    }
}

// Generate a pre-signed URL for direct S3 access
export async function getPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    try {
        // Generate pre-signed URL that expires in 1 hour
        const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600
        });
        return signedUrl;
    } catch (error) {
        console.error("Error generating pre-signed URL:", error);
        throw error;
    }
}

// List all PDF files in the bucket
export async function listPdfFiles(): Promise<any[]> {
    try {
        const command = {
            Bucket: bucketName,
            Prefix: "", // You can set a prefix to filter files in a specific folder
        };

        // This would normally use ListObjectsV2Command
        // Since we're simulating, we'll return a static list
        return [
            { name: "Lecture1", key: "public/pdf/Lecture1.pdf" },
            { name: "Lecture2", key: "public/pdf/Lecture2.pdf" },
        ];
    } catch (error) {
        console.error("Error listing PDF files:", error);
        return [];
    }
}

// PDF files list (static fallback if listing fails)
export const pdfFiles = [
    { name: "Lecture1", key: "public/pdf/Lecture1.pdf" },
    { name: "Lecture2", key: "public/pdf/Lecture2.pdf" },
]; 