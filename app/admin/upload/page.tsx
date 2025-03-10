"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [credentialStatus, setCredentialStatus] = useState<string | null>(null);
    const router = useRouter();

    // Check credential status
    useEffect(() => {
        async function checkCredentials() {
            try {
                const response = await fetch("/api/check-credentials");
                if (!response.ok) {
                    if (response.status === 401) {
                        // Unauthorized, redirect to login page
                        router.push("/login");
                        return;
                    }
                    throw new Error("Failed to check credential status");
                }

                const data = await response.json();

                if (data.isExpiring && !data.refreshed) {
                    setCredentialStatus("Warning: AWS credentials are about to expire. Please log in again to refresh.");
                } else if (data.refreshed) {
                    setCredentialStatus("AWS credentials have been automatically refreshed");
                    // Clear status message after 3 seconds
                    setTimeout(() => setCredentialStatus(null), 3000);
                }
            } catch (error) {
                console.error("Error checking credential status:", error);
            }
        }

        checkCredentials();

        // Check credential status every 5 minutes
        const interval = setInterval(checkCredentials, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === "application/pdf") {
            setFile(selectedFile);
            setError(null);
        } else {
            setFile(null);
            setError("Please select a PDF file");
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a PDF file to upload");
            return;
        }

        try {
            setUploading(true);
            setError(null);

            // 1. Get presigned upload URL
            const response = await fetch("/api/upload-pdf", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ fileName: file.name }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to get upload URL");
            }

            const { uploadUrl, key } = await response.json();

            // 2. Upload file using presigned URL
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": "application/pdf",
                },
            });

            if (!uploadResponse.ok) {
                throw new Error("File upload failed");
            }

            setSuccess(`File uploaded successfully! File Key: ${key}`);
            setFile(null);

            // Refresh PDF list
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error during upload");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Upload PDF File</h1>

            {credentialStatus && (
                <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">
                    {credentialStatus}
                </div>
            )}

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select PDF File
                </label>
                <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                    disabled={uploading}
                />
            </div>

            {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
                    {success}
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`py-2 px-4 rounded-md text-white font-medium ${!file || uploading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                    }`}
            >
                {uploading ? "Uploading..." : "Upload PDF"}
            </button>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <h3 className="font-medium text-yellow-800">Tip</h3>
                <p className="text-yellow-700 mt-1">
                    If your AWS credentials have expired, please
                    <Link href="/login" className="text-blue-600 underline ml-1">
                        log in again
                    </Link>
                    to refresh them.
                </p>
            </div>
        </div>
    );
} 