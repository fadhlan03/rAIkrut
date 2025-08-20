import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { calls } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const secretKey = new TextEncoder().encode(jwtSecret);

    const tokenCookie = request.cookies.get('access_token');
    if (!tokenCookie) {
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      });
      // Token verified successfully, we can proceed
    } catch (authError: any) {
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    const { id: callId } = await params;
    const { notes } = await request.json();

    if (!notes || typeof notes !== 'string') {
      return NextResponse.json({ error: 'Notes must be a non-empty string' }, { status: 400 });
    }

    // Update the call with notes
    const result = await db
      .update(calls)
      .set({ 
        notes: notes
      })
      .where(eq(calls.id, callId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      callId: callId,
      notes: notes 
    });

  } catch (error) {
    console.error('Error saving call notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 