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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('Update Call Conversation API: Request received');
  
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('Update Call Conversation API: JWT_SECRET environment variable is not set.');
    return NextResponse.json({ error: 'Internal Server Error: Configuration missing' }, { status: 500 });
  }
  const secretKey = new TextEncoder().encode(jwtSecret);

  let userId: string;
  
  try {
    // --- Authentication --- 
    const tokenCookie = request.cookies.get('access_token');
    console.log('Update Call Conversation API: Checking for access_token cookie...', tokenCookie ? 'Found' : 'Not found');
    
    if (!tokenCookie) {
      console.log('Update Call Conversation API: No access_token cookie found');
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    
    console.log('Update Call Conversation API: Attempting to verify JWT token...');
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      });
      console.log('Update Call Conversation API: JWT verification successful, payload:', { userId: payload.userId, email: payload.email });
      userId = payload.userId as string;
      if (!userId) throw new Error('User ID missing in token payload');
      console.log('Update Call Conversation API: Authentication successful for userId:', userId);
    } catch (authError: any) {
      console.warn('Update Call Conversation API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }
    // --- End Authentication ---

    const { id: callId } = await params;
    const body = await request.json();
    const { conversationId } = body;
    
    console.log('Update Call Conversation API: Request body parsed:', { callId, conversationId });

    if (!callId) {
      return NextResponse.json({ error: 'Call ID is required' }, { status: 400 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Update the call record with conversationId, ensuring user owns the call
    console.log('Update Call Conversation API: Updating call record with conversationId...');
    const updatedCall = await db.update(calls)
      .set({ conversationId: conversationId })
      .where(and(eq(calls.id, callId), eq(calls.userId, userId)))
      .returning();

    if (updatedCall.length === 0) {
      console.log('Update Call Conversation API: Call not found or not owned by user');
      return NextResponse.json({ error: 'Call not found or not authorized' }, { status: 404 });
    }

    console.log('Update Call Conversation API: Call updated successfully with conversationId:', conversationId);
    return NextResponse.json({
      success: true,
      message: 'Conversation ID updated successfully',
      callId: callId,
      conversationId: conversationId
    });
  } catch (error) {
    console.error('Update Call Conversation API: Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
