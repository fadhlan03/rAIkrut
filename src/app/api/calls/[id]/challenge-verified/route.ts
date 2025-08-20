import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { calls } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

interface AccessTokenPayload {
  userId: string;
  email?: string;
}

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const callId = resolvedParams.id;
  
  console.log('Challenge Verified API: Request received for call ID:', callId);
  
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('Challenge Verified API: JWT_SECRET environment variable is not set.');
    return NextResponse.json({ error: 'Internal Server Error: Configuration missing' }, { status: 500 });
  }
  const secretKey = new TextEncoder().encode(jwtSecret);

  let userId: string;

  try {
    // Authentication
    const tokenCookie = request.cookies.get('access_token');
    console.log('Challenge Verified API: Checking for access_token cookie...', tokenCookie ? 'Found' : 'Not found');
    
    if (!tokenCookie) {
      console.log('Challenge Verified API: No access_token cookie found');
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    
    console.log('Challenge Verified API: Attempting to verify JWT token...');
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      }) as { payload: AccessTokenPayload };
      
      console.log('Challenge Verified API: JWT verification successful');
      userId = payload.userId;
      if (!userId) throw new Error('User ID missing in token payload');
      console.log('Challenge Verified API: Authentication successful for userId:', userId);
    } catch (authError: any) {
      console.warn('Challenge Verified API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    if (!callId) {
      return NextResponse.json({ error: 'Call ID is required' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { verified } = body;

    if (typeof verified !== 'boolean') {
      return NextResponse.json({ error: 'Verified status must be a boolean' }, { status: 400 });
    }

    // Verify Call Ownership
    const callData = await db.select({ 
        ownerUserId: calls.userId 
    }).from(calls).where(eq(calls.id, callId)).limit(1);
    
    if (callData.length === 0) {
        return NextResponse.json({ error: `Call not found` }, { status: 404 });
    }
    if (callData[0].ownerUserId !== userId) {
        console.warn(`User ${userId} attempted to update challenge verification for call ${callId} owned by ${callData[0].ownerUserId}.`);
        return NextResponse.json({ error: 'Forbidden: You do not own this call record.' }, { status: 403 });
    }

    // Update challenge verification status
    console.log(`Challenge Verified API: Updating call ${callId} with challenge_verified = ${verified}`);
    const updatedCall = await db.update(calls)
      .set({ 
        challenge_verified: verified,
        timestamp: new Date().toISOString()
      })
      .where(eq(calls.id, callId))
      .returning();

    if (updatedCall.length === 0) {
      return NextResponse.json({ error: 'Failed to update call record' }, { status: 500 });
    }

    console.log('Challenge Verified API: Successfully updated challenge verification status');
    return NextResponse.json({
      message: 'Challenge verification status updated successfully',
      callId: callId,
      challenge_verified: verified
    });

  } catch (error) {
    console.error('Challenge Verified API: Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 