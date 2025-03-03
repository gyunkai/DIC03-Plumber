import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        // Get session cookie
        const sessionCookie = request.cookies.get("session");

        // If no session cookie, user is not authenticated
        if (!sessionCookie) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        // Parse session data
        let sessionData;
        try {
            sessionData = JSON.parse(sessionCookie.value);
        } catch (error) {
            return NextResponse.json(
                { error: "Invalid session" },
                { status: 401 }
            );
        }

        // If no user ID in session, user is not authenticated
        if (!sessionData.userId) {
            return NextResponse.json(
                { error: "Invalid session" },
                { status: 401 }
            );
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: sessionData.userId },
            select: {
                id: true,
                name: true,
                email: true,
                systemRole: true,
            },
        });

        // If user not found, session is invalid
        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 401 }
            );
        }

        // Return user data
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.systemRole === "admin",
            },
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return NextResponse.json(
            { error: "Failed to fetch user profile" },
            { status: 500 }
        );
    }
} 