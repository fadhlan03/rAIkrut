import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs'; // Import bcrypt
import { db } from '@/lib/db-client'; // Import db client
import { users } from '@/db/schema'; // Import users schema
import { eq } from 'drizzle-orm'; // Import eq operator

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set.');
      return NextResponse.json({ message: 'Internal Server Error: Configuration missing' }, { status: 500 });
    }
    // Encode secret for jose
    const secretKey = new TextEncoder().encode(jwtSecret);

    // Find user by email
    const userResult = await db.select({
        id: users.id, // Select necessary fields
        email: users.email,
        type: users.type, // Include user type
        hashedPassword: users.passwordHash // Alias for clarity
    }).from(users).where(eq(users.email, email)).limit(1);

    if (userResult.length === 0) {
      console.log(`Login attempt failed: User not found for email ${email}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 }); // Use generic message
    }

    const user = userResult[0];

    // IMPORTANT: Check if hashedPassword is null or undefined before comparing
    if (!user.hashedPassword) {
        console.error(`Login error: User ${email} has no password hash stored.`);
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 }); // Use generic message
    }

    // Compare provided password with stored hash
    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordMatch) {
      console.log(`Login attempt failed: Password mismatch for email ${email}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 }); // Use generic message
    }

    // Credentials match - Create Access Token (short-lived)
    const accessToken = await new SignJWT({ userId: user.id, email: user.email, type: user.type })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m') // Access token expires in 15 minutes
      .sign(secretKey);

    // Create Refresh Token (long-lived)
    // Optional: Add a unique identifier (jti) if implementing revocation later
    const refreshToken = await new SignJWT({ userId: user.id, type: user.type })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('90d') // Refresh token expires in 90 days (3 months)
      .sign(secretKey);

    // Create response and set cookies
    const response = NextResponse.json({ message: 'Login successful', userId: user.id }); // Optionally return userId

    // Set Access Token Cookie (accessible to client-side for auth state)
    response.cookies.set('access_token', accessToken, {
      httpOnly: false, // Allow client-side access for authentication state
      secure: process.env.NODE_ENV !== 'development',
      maxAge: 15 * 60, // 15 minutes in seconds
      path: '/', // Accessible to all paths
      sameSite: 'lax', // Or 'strict'
    });

    // Set Refresh Token Cookie
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      maxAge: 90 * 24 * 60 * 60, // 90 days in seconds
      path: '/api/auth/refresh', // IMPORTANT: Only send to refresh endpoint
      sameSite: 'lax', // Or 'strict'
    });

    console.log(`Login successful for email ${email}`);
    return response; // Return the response with the cookie set

  } catch (error) {
      console.error('Login API error:', error);
      // Avoid leaking specific error details in production
      return NextResponse.json({ message: 'An unexpected error occurred during login.' }, { status: 500 });
  }
}