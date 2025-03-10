import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


const s3Client = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        sessionToken: process.env.AWS_SESSION_TOKEN || "",
    },
});


const bucketName = process.env.AWS_S3_BUCKET_NAME || "plumbers3";


export async function getPdfPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    try {

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
        return presignedUrl;
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        throw error;
    }
}


export const pdfFiles = [
    { name: "Lecture1", key: "public/pdf/Lecture1.pdf" },
    { name: "Lecture2", key: "public/pdf/Lecture2.pdf" },
]; 