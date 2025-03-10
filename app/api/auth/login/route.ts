import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAwsCredentials, updateAwsCredentials } from "@/app/utils/aws-credentials";

// Check if email is an admin email
function isAdminEmail(email: string): boolean {
    // Define admin email rules based on your requirements
    // For example, all emails ending with @admin.example.com are admins
    return email.endsWith("@admin.example.com") ||
        email.includes("admin") ||
        email === "admin@example.com";
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        // There should be real user validation logic here
        // For demonstration, we only check email format

        // Check if user is an admin
        const isAdmin = isAdminEmail(email);

        // If admin, get and update AWS credentials
        let awsCredentials = null;
        if (isAdmin) {
            awsCredentials = await getAwsCredentials();
            if (awsCredentials) {
                await updateAwsCredentials(awsCredentials);
            }
        }

        // Set session cookie
        const cookieStore = cookies();
        cookieStore.set("session", isAdmin ? "admin-session-token" : "user-session-token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24, // 1 day
            path: "/",
        });

        return NextResponse.json({
            success: true,
            isAdmin,
            message: `Login successful${isAdmin ? " (Admin)" : ""}`,
            // If admin, return credentials expiration time
            ...(isAdmin && awsCredentials ? { credentialsExpiration: awsCredentials.expiration } : {})
        });
    } catch (error) {
        console.error("Error during login:", error);
        return NextResponse.json(
            { error: "Login failed" },
            { status: 500 }
        );
    }
} 