import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes that require authentication
const protectedRoutes = ['/profile', '/chat'];

export function middleware(request: NextRequest) {
    // Get the path from the request
    const path = request.nextUrl.pathname;

    console.log('Middleware running for path:', path);

    // Let Next.js config handle root path redirection, don't process it here
    // if (path === '/') {
    //     console.log('Redirecting from root to /begin');
    //     return NextResponse.redirect(new URL('/begin', request.url));
    // }

    // Check if the path is a protected route
    const isProtectedRoute = protectedRoutes.some(route =>
        path === route || path.startsWith(`${route}/`)
    );

    // If it's not a protected route, allow the request to proceed
    if (!isProtectedRoute) {
        console.log('Not a protected route, allowing request to proceed');
        return NextResponse.next();
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

        // If everything is fine, allow the request to proceed
        console.log('Session valid, allowing request to proceed');
        return NextResponse.next();
    } catch (error) {
        // If there's an error parsing the session, redirect to login
        console.log('Error parsing session, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

// Configure the middleware to run on protected routes only
export const config = {
    matcher: [
        '/profile/:path*',
        '/chat/:path*'
    ]
}