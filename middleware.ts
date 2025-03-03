import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes that require authentication
const protectedRoutes = ['/profile', '/chat'];

export function middleware(request: NextRequest) {
    // Get the path from the request
    const path = request.nextUrl.pathname;

    // Check if the path is a protected route
    const isProtectedRoute = protectedRoutes.some(route =>
        path === route || path.startsWith(`${route}/`)
    );

    // If it's not a protected route, allow the request to proceed
    if (!isProtectedRoute) {
        return NextResponse.next();
    }

    // Get the session cookie
    const sessionCookie = request.cookies.get('session');

    // If there's no session cookie, redirect to login
    if (!sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    try {
        // Try to parse the session cookie
        const session = JSON.parse(sessionCookie.value);

        // Check if the session has a userId
        if (!session.userId) {
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }

        // If everything is fine, allow the request to proceed
        return NextResponse.next();
    } catch (error) {
        // If there's an error parsing the session, redirect to login
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }
}

// Configure the middleware to run on specific paths
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
    ],
}; 