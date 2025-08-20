import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db-client';
import { candidates, candidateVerifications } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

interface AccessTokenPayload {
  userId: string;
  email: string;
  fullName: string;
  type: 'admin' | 'applicant';
}

export async function GET(request: NextRequest) {
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

    let email: string;
    let type: string;
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      email = payload.email;
      type = payload.type;
      if (!email) throw new Error('Email missing in token payload');
    } catch (authError: any) {
      console.warn('Verification Latest API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Allow both applicants and admins for testing purposes
    if (type !== 'applicant' && type !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Only applicants and admins can access this endpoint.' }, { status: 403 });
    }

    // Get candidate ID - create candidate record if admin is testing  
    let candidate = await db.select().from(candidates).where(eq(candidates.email, email)).limit(1);
    
    if (candidate.length === 0) {
      if (type === 'admin') {
        // Create a test candidate record for admin testing
        const newCandidate = await db.insert(candidates).values({
          fullName: 'Test Admin User',
          email: email,
        }).returning();
        candidate = newCandidate;
      } else {
        return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
      }
    }

    const candidateId = candidate[0].id;

    // Get latest verification record
    const verificationRecord = await db
      .select()
      .from(candidateVerifications)
      .where(eq(candidateVerifications.candidateId, candidateId))
      .orderBy(desc(candidateVerifications.createdAt))
      .limit(1);

    if (verificationRecord.length === 0) {
      return NextResponse.json({ error: 'No verification data found.' }, { status: 404 });
    }

    const verification = verificationRecord[0];

    // Return verification data
    return NextResponse.json({
      id: verification.id,
      originalVideoUrl: verification.originalVideoUrl,
      originalPhotoUrl: verification.originalPhotoUrl,
      originalAudioUrl: verification.originalAudioUrl,
      testVideoUrl: verification.testVideoUrl,
      testPhotoUrl: verification.testPhotoUrl,
      testAudioUrl: verification.testAudioUrl,
      deepfakeScore: verification.deepfakeScore,
      faceVerificationScore: verification.faceVerificationScore,
      voiceVerificationScore: verification.voiceVerificationScore,
      overallStatus: verification.verificationStatus,
      metadata: verification.verificationMetadata,
      createdAt: verification.createdAt
    });

  } catch (error) {
    console.error('Error fetching verification data:', error);
    return NextResponse.json({ error: 'Failed to fetch verification data.' }, { status: 500 });
  }
} 