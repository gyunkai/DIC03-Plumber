import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    // Check if all required fields are provided
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Hash the password for security
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user in database
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        oauth: false,
      },
    });

    // Return success response with user data (excluding password)
    return NextResponse.json({
      success: true,
      message: 'Registration successful. Please login.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Registration failed, please try again later' }, { status: 500 });
  }
};

// NEW: Added professorLogin function to handle professor login using preset credentials.
export const professorLogin = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Check if the credentials match the professor's preset credentials
    if (email === "professor@nyu.edu" && password === "8888") {
      // Return success response with professor details
      return NextResponse.json({
        success: true,
        message: "Professor login successful",
        user: {
          id: "professor",
          email: "professor@nyu.edu",
          name: "Professor"
        }
      }, { status: 200 });
    } else {
      return NextResponse.json({ error: "Invalid professor credentials" }, { status: 401 });
    }
  } catch (error) {
    console.error('Professor login error:', error);
    return NextResponse.json({ error: 'Professor login failed, please try again later' }, { status: 500 });
  }
};
