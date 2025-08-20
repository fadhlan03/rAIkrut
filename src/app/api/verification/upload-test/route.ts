import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db-client';
import { candidates, candidateVerifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { 
  storeVerificationVideo, 
  storeVerificationPhoto, 
  storeVerificationAudio 
} from '@/lib/storage';

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
      console.warn('Verification Upload Test API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Allow both applicants and admins for testing purposes
    if (type !== 'applicant' && type !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Only applicants and admins can upload test media.' }, { status: 403 });
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

    // Check if verification record exists with original media
    const existingVerification = await db
      .select()
      .from(candidateVerifications)
      .where(eq(candidateVerifications.candidateId, candidateId))
      .limit(1);

    if (existingVerification.length === 0) {
      return NextResponse.json({ 
        error: 'No original media found. Please upload your ID media first at /verify.' 
      }, { status: 400 });
    }

    const verificationRecord = existingVerification[0];

    // Ensure original media exists
    if (!verificationRecord.originalVideoUrl || !verificationRecord.originalPhotoUrl || !verificationRecord.originalAudioUrl) {
      return NextResponse.json({ 
        error: 'Original media is incomplete. Please upload your ID media first at /verify.' 
      }, { status: 400 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const photoFile = formData.get('photo') as File;
    const audioFile = formData.get('audio') as File;

    if (!videoFile || !photoFile || !audioFile) {
      return NextResponse.json({ error: 'All test media files (video, photo, audio) are required.' }, { status: 400 });
    }

    // Convert files to buffers
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // Upload test media to GCS with test prefix
    const testVideoUrl = await storeVerificationVideo(videoBuffer, candidateId, `test_${videoFile.name}`);
    const testPhotoUrl = await storeVerificationPhoto(photoBuffer, candidateId, `test_${photoFile.name}`);
    const testAudioUrl = await storeVerificationAudio(audioBuffer, candidateId, `test_${audioFile.name}`);

    // Update verification record with test media
    const updated = await db
      .update(candidateVerifications)
      .set({
        testVideoUrl,
        testPhotoUrl,
        testAudioUrl,
        testMediaUploadedAt: new Date().toISOString(),
        verificationStatus: 'pending', // Reset status for new analysis
        updatedAt: new Date().toISOString()
      })
      .where(eq(candidateVerifications.id, verificationRecord.id))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Test media uploaded successfully. Ready for verification analysis.',
      verificationId: updated[0].id,
      urls: {
        testVideoUrl,
        testPhotoUrl,
        testAudioUrl
      },
      originalUrls: {
        originalVideoUrl: verificationRecord.originalVideoUrl,
        originalPhotoUrl: verificationRecord.originalPhotoUrl,
        originalAudioUrl: verificationRecord.originalAudioUrl
      }
    });

  } catch (error) {
    console.error('Test upload error:', error);
    return NextResponse.json({ 
      error: 'Test upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 