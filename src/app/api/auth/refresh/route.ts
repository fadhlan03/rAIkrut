import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers'; // To read HttpOnly cookies
import { db } from '@/lib/db-client'; // Import db client
import { users } from '@/db/schema'; // Import users schema
import { eq } from 'drizzle-orm'; // Import eq operator

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set for refresh endpoint.');
    // Avoid throwing here in case process restarts, but log critical error
}
const secretKey = new TextEncoder().encode(JWT_SECRET || 'fallback-secret'); // Use fallback only if really necessary and logged

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (!JWT_SECRET) {
        // Prevent operation if secret wasn't loaded initially
        return NextResponse.json({ message: 'Internal Server Error: Configuration missing' }, { status: 500 });
    }

    if (!refreshToken) {
        console.log('[Refresh Endpoint] No refresh token found.');
        return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    try {
        // Verify the refresh token
        const { payload } = await jwtVerify(refreshToken, secretKey, {
            algorithms: ['HS256'],
        });

        // Optionally: Check against a revocation list using payload.jti or similar

        // If valid, issue a new access token
        const userId = payload.userId as string; // Ensure userId is in payload
        
        if (!userId) {
            console.error('[Refresh Endpoint] User ID missing in refresh token payload.');
            throw new Error('Invalid token payload'); // Trigger catch block
        }

        // Fetch user email and type from database since refresh token only contains userId
        let userEmail: string | null = null;
        let userType: string | null = null;
        try {
            const userResult = await db.select({
                email: users.email,
                type: users.type
            }).from(users).where(eq(users.id, userId)).limit(1);
            
            if (userResult.length > 0) {
                userEmail = userResult[0].email;
                userType = userResult[0].type;
            } else {
                console.error('[Refresh Endpoint] User not found in database for userId:', userId);
                throw new Error('User not found');
            }
        } catch (dbError) {
            console.error('[Refresh Endpoint] Database error while fetching user:', dbError);
            throw new Error('Database error');
        }

        const newAccessToken = await new SignJWT({ userId, email: userEmail, type: userType }) // Include email and type from database
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('15m') // New access token with short expiry
            .sign(secretKey);

        // Set the new access token cookie in the response (accessible to client-side)
        const response = NextResponse.json({ success: true });
        response.cookies.set('access_token', newAccessToken, {
            httpOnly: false, // Allow client-side access for authentication state
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 15 * 60, // 15 minutes
            path: '/',
            sameSite: 'lax', // Or 'strict'
        });

        console.log(`[Refresh Endpoint] Issued new access token for user ${userId}`);
        return response;

    } catch (error: any) {
        console.error('[Refresh Endpoint] Refresh token verification failed or error occurred:', error.message || error);

        // If verification failed (expired, invalid signature, etc.)
        // Clear both cookies and return 401
        const response = NextResponse.json({ message: 'Session expired or invalid' }, { status: 401 });
        response.cookies.set('access_token', '', { maxAge: 0, path: '/' });
        // Ensure the path matches the path used when setting the cookie
        response.cookies.set('refresh_token', '', { maxAge: 0, path: '/api/auth/refresh' });
        return response;
    }
} 