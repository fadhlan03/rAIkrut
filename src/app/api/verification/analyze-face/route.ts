import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPresignedUrl } from '@/lib/storage';

interface AccessTokenPayload {
  userId: string;
  email: string;
  fullName: string;
  type: 'admin' | 'applicant';
}

// Deepfake Detection System API endpoints
const DEEPFAKE_API_BASE =  process.env.DEEPFAKE_API_BASE;

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
      }) as unknown as { payload: AccessTokenPayload };
      type = payload.type;
    } catch (authError: any) {
      console.warn('Verification Analyze Face API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Allow both applicants and admins for testing purposes
    if (type !== 'applicant' && type !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Only applicants and admins can access this endpoint.' }, { status: 403 });
    }

    // Get request body
    const { originalPhotoUrl, testVideoUrl } = await request.json();
    
    if (!originalPhotoUrl || !testVideoUrl) {
      return NextResponse.json({ error: 'Both original photo URL and test video URL are required.' }, { status: 400 });
    }

    // Convert GCS path to presigned URL if needed
    const getFileUrl = async (url: string) => {
      // If it's already a full URL, use it directly
      if (url.startsWith('http')) {
        return url;
      }
      // Otherwise, generate presigned URL from GCS path
      return await getPresignedUrl(url, 3600); // 1 hour expiry
    };

    // Get presigned URLs for both files
    const [photoPresignedUrl, videoPresignedUrl] = await Promise.all([
      getFileUrl(originalPhotoUrl),
      getFileUrl(testVideoUrl)
    ]);

    // Download both files from GCS using presigned URLs
    const [photoResponse, videoResponse] = await Promise.all([
      fetch(photoPresignedUrl),
      fetch(videoPresignedUrl)
    ]);

    if (!photoResponse.ok || !videoResponse.ok) {
      throw new Error('Failed to download photo or video files');
    }

    const [photoBuffer, videoBuffer] = await Promise.all([
      photoResponse.arrayBuffer(),
      videoResponse.arrayBuffer()
    ]);

    const photoBlob = new Blob([photoBuffer], { type: 'image/jpeg' });
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });

    // Prepare form data for face verification API
    const formData = new FormData();
    formData.append('reference_image', photoBlob, 'reference_photo.jpg');
    formData.append('video', videoBlob, 'test_video.mp4');

    // Call face verification API
    const faceResponse = await fetch(`${DEEPFAKE_API_BASE}/face/verify`, {
      method: 'POST',
      body: formData,
    });

    if (!faceResponse.ok) {
      const errorText = await faceResponse.text();
      console.error('Face verification API error:', errorText);
      throw new Error(`Face verification failed: ${faceResponse.status}`);
    }

    const faceResult = await faceResponse.json();
    
    // Parse the result and calculate score
    // The API returns verification results
    const isVerified = faceResult.verified === true;
    const confidence = faceResult.confidence || 0;
    
    // Convert to a score where higher = more verified
    const verification_score = isVerified ? confidence : (1 - confidence);
    
    return NextResponse.json({
      score: verification_score,
      verified: faceResult.verified,
      confidence: confidence,
      details: `Face ${isVerified ? 'verified' : 'failed verification'} with ${(confidence * 100).toFixed(1)}% confidence`,
      rawResult: faceResult
    });

  } catch (error) {
    console.error('Face verification error:', error);
    return NextResponse.json({ 
      error: 'Face verification failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 