import { NextRequest, NextResponse } from "next/server";
import { areCredentialsExpiring, refreshCredentialsIfNeeded } from "@/app/utils/aws-credentials";

// Check if user is an admin
async function isAdmin(request: NextRequest) {
    const session = request.cookies.get("session")?.value;
    return session === "admin-session-token";
}

export async function GET(request: NextRequest) {
    try {
        // Check if user is an admin
        if (!await isAdmin(request)) {
            return NextResponse.json(
                { error: "Unauthorized. Admin access required." },
                { status: 401 }
            );
        }

        // Check if credentials are about to expire
        const isExpiring = areCredentialsExpiring();

        // If expiring, try to refresh
        let refreshed = false;
        if (isExpiring) {
            refreshed = await refreshCredentialsIfNeeded();
        }

        return NextResponse.json({
            isExpiring,
            refreshed,
            message: refreshed
                ? "Credentials refreshed"
                : (isExpiring ? "Credentials expiring soon, but refresh failed" : "Credentials valid")
        });
    } catch (error) {
        console.error("Error checking credential status:", error);
        return NextResponse.json(
            { error: "Failed to check credential status" },
            { status: 500 }
        );
    }
} 