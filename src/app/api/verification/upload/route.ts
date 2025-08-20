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
      console.warn('Verification Upload API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Allow both applicants and admins for testing purposes
    if (type !== 'applicant' && type !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Only applicants and admins can upload verification media.' }, { status: 403 });
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

    // Parse multipart form data
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const photoFile = formData.get('photo') as File;
    const audioFile = formData.get('audio') as File;

    if (!videoFile || !photoFile || !audioFile) {
      return NextResponse.json({ error: 'All media files (video, photo, audio) are required.' }, { status: 400 });
    }

    // Convert files to buffers
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // Upload to GCS
    const videoUrl = await storeVerificationVideo(videoBuffer, candidateId, videoFile.name);
    const photoUrl = await storeVerificationPhoto(photoBuffer, candidateId, photoFile.name);
    const audioUrl = await storeVerificationAudio(audioBuffer, candidateId, audioFile.name);

    // Check if verification record exists
    const existingVerification = await db
      .select()
      .from(candidateVerifications)
      .where(eq(candidateVerifications.candidateId, candidateId))
      .limit(1);

    let verificationId: string;

    if (existingVerification.length > 0) {
      // Update existing record with original media
      const updated = await db
        .update(candidateVerifications)
        .set({
          originalVideoUrl: videoUrl,
          originalPhotoUrl: photoUrl,
          originalAudioUrl: audioUrl,
          originalMediaUploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(candidateVerifications.id, existingVerification[0].id))
        .returning();

      verificationId = updated[0].id;
    } else {
      // Create new verification record
      const newVerification = await db
        .insert(candidateVerifications)
        .values({
          candidateId,
          originalVideoUrl: videoUrl,
          originalPhotoUrl: photoUrl,
          originalAudioUrl: audioUrl,
          originalMediaUploadedAt: new Date().toISOString(),
          verificationStatus: 'pending'
        })
        .returning();

      verificationId = newVerification[0].id;
    }

    return NextResponse.json({
      success: true,
      message: 'Original media uploaded successfully',
      verificationId,
      urls: {
        originalVideoUrl: videoUrl,
        originalPhotoUrl: photoUrl,
        originalAudioUrl: audioUrl
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 