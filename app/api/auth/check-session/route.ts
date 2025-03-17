import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        // Get session cookie
        const sessionCookie = request.cookies.get("session");

        // If no session cookie, user is not authenticated
        if (!sessionCookie) {
            return NextResponse.json(
                { authenticated: false },
                { status: 200 }
            );
        }

        // Parse session data
        let sessionData;
        try {
            sessionData = JSON.parse(sessionCookie.value);
        } catch (error) {
            return NextResponse.json(
                { authenticated: false, error: "Invalid session format" },
                { status: 200 }
            );
        }

        // If no user ID in session, user is not authenticated
        if (!sessionData.userId) {
            return NextResponse.json(
                { authenticated: false, error: "No user ID in session" },
                { status: 200 }
            );
        }

        // User is authenticated
        return NextResponse.json(
            {
                authenticated: true,
                user: {
                    id: sessionData.userId,
                    email: sessionData.email,
                    name: sessionData.name
                }
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error checking session:", error);
        return NextResponse.json(
            { authenticated: false, error: "Server error" },
            { status: 500 }
        );
    }
} 