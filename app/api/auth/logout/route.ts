import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        // Create a response
        const response = NextResponse.json({
            success: true,
            message: "Logged out successfully"
        });

        // Clear the session cookie
        response.cookies.set({
            name: "session",
            value: "",
            expires: new Date(0), // Set expiration to the past to delete the cookie
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Error during logout:", error);
        return NextResponse.json(
            { error: "Logout failed" },
            { status: 500 }
        );
    }
} 