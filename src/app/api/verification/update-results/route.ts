import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db-client';
import { candidateVerifications } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface AccessTokenPayload {
  userId: string;
  email: string;
  fullName: string;
  type: 'admin' | 'applicant';
}

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    console.error("JWT_SECRET environment variable is not set.");
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const secretKey = new TextEncoder().encode(jwtSecret);

  try {
    // Authentication using cookies (like the rest of the app)
    const tokenCookie = request.cookies.get('access_token');
    if (!tokenCookie) {
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }

    let type: string;
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      });
      type = (payload as unknown as AccessTokenPayload).type;
    } catch (authError: any) {
      console.warn('Verification Update Results API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Allow both applicants and admins for testing purposes
    if (type !== 'applicant' && type !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Only applicants and admins can access this endpoint.' }, { status: 403 });
    }

    // Get request body
    const { 
      id, 
      deepfakeScore, 
      faceVerificationScore, 
      voiceVerificationScore, 
      overallStatus,
      metadata 
    } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Verification ID is required.' }, { status: 400 });
    }

    // Update verification record
    const updateData: any = {
      updatedAt: new Date(),
      verificationStatus: overallStatus,
      verifiedAt: overallStatus === 'verified' ? new Date() : null
    };

    if (deepfakeScore !== undefined) {
      updateData.deepfakeScore = deepfakeScore.toString();
    }
    if (faceVerificationScore !== undefined) {
      updateData.faceVerificationScore = faceVerificationScore.toString();
    }
    if (voiceVerificationScore !== undefined) {
      updateData.voiceVerificationScore = voiceVerificationScore.toString();
    }
    if (metadata) {
      updateData.verificationMetadata = metadata;
    }

    const result = await db
      .update(candidateVerifications)
      .set(updateData)
      .where(eq(candidateVerifications.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Verification record not found or not updated.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification results updated successfully',
      data: result[0]
    });

  } catch (error) {
    console.error('Error updating verification results:', error);
    return NextResponse.json({ 
      error: 'Failed to update verification results', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 