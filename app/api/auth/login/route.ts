import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import prisma from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

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

        // Find user in database by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        // If user not found or password doesn't match, return error
        if (!user || !user.password) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
            
        }

        // Verify password using bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Set session cookie with user information
        const response = NextResponse.json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

        // Set the cookie on the response
        response.cookies.set({
            name: "session",
            value: JSON.stringify({
                userId: user.id,
                email: user.email,
                name: user.name
            }),
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24, // 1 day
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Error during login:", error);
        return NextResponse.json(
            { error: "Login failed" },
            { status: 500 }
        );
    }
} 