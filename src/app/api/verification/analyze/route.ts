import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db-client';
import { candidates, candidateVerifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPresignedUrl } from '@/lib/storage';

interface AccessTokenPayload {
  userId: string;
  email: string;
  fullName: string;
  type: 'admin' | 'applicant';
}

// Deepfake Detection System API endpoints
const DEEPFAKE_API_BASE = process.env.DEEPFAKE_API_BASE;

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    console.error("JWT_SECRET environment variable is not set.");
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const secretKey = new TextEncoder().encode(jwtSecret);

  try {
    // Authentication
    const tokenCookie = request.cookies.get('access_token');
    if (!tokenCookie) {
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }

    let userEmail: string;
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      userEmail = payload.email;
      if (!userEmail) throw new Error('Email missing in token payload');
    } catch (authError: any) {
      console.warn('Verification Analyze API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Get request body
    const { videoPath, photoPath, audioPath } = await request.json();

    if (!videoPath || !photoPath || !audioPath) {
      return NextResponse.json({ 
        error: 'Missing required file paths. Video, photo, and audio paths are all required.' 
      }, { status: 400 });
    }

    // Get candidate info
    const candidate = await db.select()
      .from(candidates)
      .where(eq(candidates.email, userEmail))
      .limit(1);

    if (candidate.length === 0) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const candidateId = candidate[0].id;

    console.log('Starting verification analysis for candidate:', candidateId);

    // Generate presigned URLs for the files (valid for 1 hour)
    const [videoUrl, photoUrl, audioUrl] = await Promise.all([
      getPresignedUrl(videoPath, 3600),
      getPresignedUrl(photoPath, 3600),
      getPresignedUrl(audioPath, 3600)
    ]);

    // 1. Analyze video for deepfakes
    console.log('Analyzing video for deepfakes...');
    let deepfakeScore = 0;
    try {
      const deepfakeResponse = await fetch(`${DEEPFAKE_API_BASE}/analyze/video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: videoUrl,
          duration: 15 // 15 second video
        }),
      });

      if (deepfakeResponse.ok) {
        const deepfakeResult = await deepfakeResponse.json();
        deepfakeScore = deepfakeResult.authenticity_score || 0;
        console.log('Deepfake analysis result:', deepfakeResult);
      } else {
        console.warn('Deepfake analysis failed:', deepfakeResponse.statusText);
      }
    } catch (error) {
      console.error('Error calling deepfake API:', error);
    }

    // 2. Face verification against ID photo
    console.log('Performing face verification...');
    let faceVerificationScore = 0;
    try {
      const faceVerifyResponse = await fetch(`${DEEPFAKE_API_BASE}/verify/face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_image_url: photoUrl,
          video_url: videoUrl,
          strictness: 'balanced' // balanced, lenient, strict
        }),
      });

      if (faceVerifyResponse.ok) {
        const faceResult = await faceVerifyResponse.json();
        faceVerificationScore = faceResult.similarity_score || 0;
        console.log('Face verification result:', faceResult);
      } else {
        console.warn('Face verification failed:', faceVerifyResponse.statusText);
      }
    } catch (error) {
      console.error('Error calling face verification API:', error);
    }

    // 3. Voice verification (register and verify)
    console.log('Performing voice verification...');
    let voiceVerificationScore = 0;
    try {
      // First, register the voice print
      const voiceRegisterResponse = await fetch(`${DEEPFAKE_API_BASE}/voice/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: candidateId,
          audio_url: audioUrl,
          method: 'custom' // or 'speechbrain'
        }),
      });

      if (voiceRegisterResponse.ok) {
        // Then verify against the same audio (this would normally be a different audio sample)
        const voiceVerifyResponse = await fetch(`${DEEPFAKE_API_BASE}/voice/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: candidateId,
            audio_url: audioUrl,
            method: 'custom'
          }),
        });

        if (voiceVerifyResponse.ok) {
          const voiceResult = await voiceVerifyResponse.json();
          voiceVerificationScore = voiceResult.similarity_score || 0;
          console.log('Voice verification result:', voiceResult);
        } else {
          console.warn('Voice verification failed:', voiceVerifyResponse.statusText);
        }
      } else {
        console.warn('Voice registration failed:', voiceRegisterResponse.statusText);
      }
    } catch (error) {
      console.error('Error calling voice verification API:', error);
    }

    // Calculate overall verification status
    const scores = {
      deepfakeScore,
      faceVerificationScore,
      voiceVerificationScore
    };

    // Determine overall status based on thresholds
    const isDeepfakeAuth = deepfakeScore >= 0.8; // 80% threshold for authenticity
    const isFaceVerified = faceVerificationScore >= 0.7; // 70% threshold for face match
    const isVoiceVerified = voiceVerificationScore >= 0.7; // 70% threshold for voice match

    const verificationStatus = isDeepfakeAuth && isFaceVerified && isVoiceVerified ? 'verified' : 'rejected';

    // Update database with results
    await db.update(candidateVerifications)
      .set({
        deepfakeScore: deepfakeScore.toFixed(4),
        faceVerificationScore: faceVerificationScore.toFixed(4),
        voiceVerificationScore: voiceVerificationScore.toFixed(4),
        verificationStatus,
        verificationMetadata: {
          analyzedAt: new Date().toISOString(),
          thresholds: {
            deepfake: 0.8,
            face: 0.7,
            voice: 0.7
          },
          results: {
            deepfakeAuth: isDeepfakeAuth,
            faceVerified: isFaceVerified,
            voiceVerified: isVoiceVerified
          }
        },
        verifiedAt: verificationStatus === 'verified' ? new Date().toISOString() : null,
        rejectionReason: verificationStatus === 'rejected' ? 
          `Failed verification: ${!isDeepfakeAuth ? 'Deepfake detected' : ''} ${!isFaceVerified ? 'Face mismatch' : ''} ${!isVoiceVerified ? 'Voice mismatch' : ''}`.trim() : 
          null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(candidateVerifications.candidateId, candidateId));

    console.log('Verification analysis completed:', {
      candidateId,
      scores,
      status: verificationStatus
    });

    return NextResponse.json({
      message: 'Verification analysis completed',
      candidateId,
      scores,
      status: verificationStatus,
      details: {
        deepfakeAuth: isDeepfakeAuth,
        faceVerified: isFaceVerified,
        voiceVerified: isVoiceVerified
      }
    });

  } catch (error: any) {
    console.error('Verification analysis error:', error);
    
    // Try to update status to failed in database
    try {
      const { videoPath, photoPath, audioPath } = await request.json();
      if (videoPath) {
        // Get candidate from verification record
        const verification = await db.select()
          .from(candidateVerifications)
          .where(eq(candidateVerifications.originalVideoUrl, videoPath))
          .limit(1);
        
        if (verification.length > 0) {
          await db.update(candidateVerifications)
            .set({
              verificationStatus: 'failed',
              rejectionReason: `Analysis failed: ${error.message}`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(candidateVerifications.id, verification[0].id));
        }
      }
    } catch (updateError) {
      console.error('Failed to update verification status to failed:', updateError);
    }

    return NextResponse.json({ 
      error: 'Failed to analyze verification files',
      details: error.message 
    }, { status: 500 });
  }
} 