import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Logout successful' });

  // Clear the cookie by setting its maxAge to 0
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    maxAge: 0, // Expire immediately
    path: '/',
    sameSite: 'lax',
  });

  return response;
} 