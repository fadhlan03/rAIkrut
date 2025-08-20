import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { calls } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { jwtVerify } from 'jose';

// Define the expected structure of the JWT payload
interface AccessTokenPayload {
  userId: string;
  email?: string; // Optional
}

export async function POST(request: NextRequest) {
  console.log('Create Call API: Request received');
  
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('Create Call API: JWT_SECRET environment variable is not set.');
    return NextResponse.json({ error: 'Internal Server Error: Configuration missing' }, { status: 500 });
  }
  const secretKey = new TextEncoder().encode(jwtSecret);

  let userId: string;

  try {
    // --- Authentication --- 
    const tokenCookie = request.cookies.get('access_token');
    console.log('Create Call API: Checking for access_token cookie...', tokenCookie ? 'Found' : 'Not found');
    
    if (!tokenCookie) {
      console.log('Create Call API: No access_token cookie found');
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    
    console.log('Create Call API: Attempting to verify JWT token...');
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      });
      console.log('Create Call API: JWT verification successful, payload:', { userId: payload.userId, email: payload.email });
      userId = payload.userId as string;
      if (!userId) throw new Error('User ID missing in token payload');
      console.log('Create Call API: Authentication successful for userId:', userId);
    } catch (authError: any) {
      console.warn('Create Call API: Access token verification failed:', authError.code || authError.message);
      console.warn('Create Call API: Token value length:', tokenCookie.value.length);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }
    // --- End Authentication ---

    const body = await request.json();
    const { applicationId, systemPrompt, conversationId } = body;
    console.log('Create Call API: Request body parsed:', { applicationId, systemPromptLength: systemPrompt?.length || 0, conversationId });

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
    }

    // Check if a call already exists for this application and user to prevent duplicates
    const existingCall = await db.select()
      .from(calls)
      .where(and(eq(calls.applicationId, applicationId), eq(calls.userId, userId)))
      .limit(1);

    if (existingCall.length > 0) {
      console.log('Create Call API: Call already exists for this application and user:', existingCall[0].id);
      return NextResponse.json({
        callId: existingCall[0].id,
        message: 'Using existing call record'
      });
    }

    // Create a new call record with userId and optional conversationId
    console.log('Create Call API: Creating new call record...');
    const newCall = await db.insert(calls).values({
      applicationId: applicationId,
      userId: userId, // Associate call with authenticated user
      systemPrompt: systemPrompt || null,
      conversationId: conversationId || null, // Include ElevenLabs conversationId if provided
      result: 'in_progress',
    }).returning();

    console.log('Create Call API: Call created successfully with ID:', newCall[0].id);
    return NextResponse.json({
      callId: newCall[0].id,
      message: 'Call created successfully'
    });
  } catch (error) {
    console.error('Create Call API: Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 