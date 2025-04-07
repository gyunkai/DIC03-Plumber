import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        // Input validation
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password cannot be empty' }, { status: 400 });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        // Check if user exists
        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password || '');

        if (!passwordMatch) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Check if user is admin
        if (user.systemRole !== 'admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.systemRole,
                name: user.name
            },
            process.env.JWT_SECRET || 'default_secret_replace_in_production',
            { expiresIn: '8h' }
        );

        // Create response
        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.systemRole
            }
        });
    } catch (error) {
        console.error('Professor login error:', error);
        return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 });
    }
} 