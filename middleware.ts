import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define protected routes that require authentication
const protectedRoutes = ['/profile', '/chat'];
// Define only admin routes
const adminRoutes = ['/professor', '/admin'];

// This middleware runs before every request
export async function middleware(request: NextRequest) {
    // Get the path from the request
    const path = request.nextUrl.pathname;

    console.log('Middleware running for path:', path);

    // Check if the path is an admin route
    const isAdminRoute = adminRoutes.some(route => path.startsWith(route));

    // Check if the path is a protected route
    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));

    // Create a response
    let response = NextResponse.next();

    // Modify response headers to allow iframe embedding
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self' *");

    // Get tokens from cookies
    const jwtToken = request.cookies.get('authToken')?.value;
    const sessionCookie = request.cookies.get('session')?.value;

    // Function to verify JWT token
    const verifyToken = async (token: string) => {
        try {
            const secret = new TextEncoder().encode(
                process.env.JWT_SECRET || 'default_secret_replace_in_production'
            );
            const { payload } = await jwtVerify(token, secret);
            return { valid: true, payload };
        } catch (error) {
            console.error('Token verification failed:', error);
            return { valid: false, payload: null };
        }
    };

    // If it's an admin route, validate JWT token and check role
    if (isAdminRoute) {
        // If there's no JWT token, redirect to login
        if (!jwtToken) {
            console.log('No JWT token for admin route, redirecting to login');
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Verify JWT token
        const { valid, payload } = await verifyToken(jwtToken);

        if (!valid || !payload) {
            console.log('Invalid JWT token, redirecting to login');
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Check if user role is admin
        if (payload.role !== 'admin') {
            console.log('User role is not admin, redirecting to unauthorized');
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        // If everything is fine, allow the request to proceed with modified headers
        console.log('Admin access granted, allowing request to proceed');
        return response;
    }

    // For normal protected routes, check either JWT token or session cookie
    if (isProtectedRoute) {
        // Check if either token exists
        if (!jwtToken && !sessionCookie) {
            console.log('No authentication token found, redirecting to login');
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // If JWT token exists, verify it
        if (jwtToken) {
            const { valid } = await verifyToken(jwtToken);
            if (valid) {
                console.log('Valid JWT token, allowing access');
                return response;
            }
        }

        // If session cookie exists, check if it's valid
        if (sessionCookie) {
            try {
                const session = JSON.parse(sessionCookie);
                if (session && session.userId) {
                    console.log('Valid session, allowing access');
                    return response;
                }
            } catch (error) {
                console.error('Error parsing session cookie:', error);
            }
        }

        // If we get here, neither token was valid
        console.log('No valid authentication found, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return response;
}

// Configure the middleware to run on all routes except specific exclusions
export const config = {
    matcher: [
        '/profile/:path*',
        '/chat/:path*',
        '/professor/:path*',
        '/admin/:path*',
    ]
};