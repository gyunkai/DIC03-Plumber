import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes that require authentication
// const protectedRoutes = ['/profile', '/chat'];
const protectedRoutes = [''];

// This middleware runs before every request
export function middleware(request: NextRequest) {
    // Get the path from the request
    const path = request.nextUrl.pathname;

    console.log('Middleware running for path:', path);

    // Check if the path is a protected route
    const isProtectedRoute = protectedRoutes.some(route =>
        path === route || path.startsWith(`${route}/`)
    );

    // Create a response
    let response = NextResponse.next();

    // Modify response headers to allow iframe embedding
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self' *");

    // If it's not a protected route, allow the request to proceed with modified headers
    if (!isProtectedRoute) {
        console.log('Not a protected route, allowing request to proceed');
        return response;
    }

    // Only check session for protected routes
    const sessionCookie = request.cookies.get('session');

    // If there's no session cookie, redirect to login
    if (!sessionCookie) {
        console.log('No session cookie, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        // Try to parse the session cookie
        const session = JSON.parse(sessionCookie.value);

        // Check if the session has a userId
        if (!session.userId) {
            console.log('No userId in session, redirecting to login');
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // If everything is fine, allow the request to proceed with modified headers
        console.log('Session valid, allowing request to proceed');
        return response;
    } catch (error) {
        // If there's an error parsing the session, redirect to login
        console.log('Error parsing session, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

// Configure the middleware to run on all routes except specific exclusions
export const config = {
    matcher: [
        '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
    ]
};