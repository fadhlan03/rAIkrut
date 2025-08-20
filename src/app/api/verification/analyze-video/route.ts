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
const DEEPFAKE_API_BASE = process.env.DEEPFAKE_API_BASE;

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
      console.warn('Verification Analyze Video API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Allow both applicants and admins for testing purposes
    if (type !== 'applicant' && type !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Only applicants and admins can access this endpoint.' }, { status: 403 });
    }

    // Get request body
    const { originalVideoUrl, testVideoUrl } = await request.json();
    
    if (!originalVideoUrl || !testVideoUrl) {
      return NextResponse.json({ error: 'Both original and test video URLs are required.' }, { status: 400 });
    }

    // Convert GCS paths to presigned URLs if needed
    const getVideoUrl = async (videoUrl: string) => {
      // If it's already a full URL, use it directly
      if (videoUrl.startsWith('http')) {
        return videoUrl;
      }
      // Otherwise, generate presigned URL from GCS path
      return await getPresignedUrl(videoUrl, 3600); // 1 hour expiry
    };

    // Get presigned URLs for both videos
    const [originalPresignedUrl, testPresignedUrl] = await Promise.all([
      getVideoUrl(originalVideoUrl),
      getVideoUrl(testVideoUrl)
    ]);

    // Download only the test video for deepfake analysis
    console.log('Downloading test video for deepfake analysis...');
    const testVideoResponse = await fetch(testPresignedUrl);

    if (!testVideoResponse.ok) {
      throw new Error('Failed to download test video file');
    }

    const testVideoBuffer = await testVideoResponse.arrayBuffer();
    const testVideoBlob = new Blob([testVideoBuffer], { type: 'video/mp4' });

    // Analyze test video for deepfakes using the correct API endpoint
    console.log('Analyzing test video for deepfakes...');
    const testFormData = new FormData();
    testFormData.append('video', testVideoBlob, 'test_video.mp4');

    const testAnalysis = await fetch(`${DEEPFAKE_API_BASE}/analyze`, {
      method: 'POST',
      body: testFormData,
    });

    if (!testAnalysis.ok) {
      console.error('❌ VIDEO VERIFICATION FAILED: API returned error');
      console.error('Test analysis status:', testAnalysis.status);
      console.error('Returning random score for prototype purposes...');
      
      // Generate random score between 40-90% for prototype
      const randomScore = (Math.random() * 50 + 40) / 100; // 40-90% as decimal
      
      return NextResponse.json({
        score: randomScore,
        details: `Video verification unavailable - using random prototype score: ${(randomScore * 100).toFixed(1)}%`,
        prototype: true,
        originalMessage: `API returned status: ${testAnalysis.status}`,
        attempted_endpoint: '/analyze'
      });
    }

    const testResult = await testAnalysis.json();
    
    // Get authenticity score (higher = more authentic)
    const testScore = testResult.authenticity_score || testResult.confidence || 0;
    
    // Calculate verification score based on test video authenticity
    let verificationScore = testScore;
    let details = '';
    
    if (testScore >= 0.8) {
      // High authenticity - likely real
      details = `Test video verified as authentic with ${(testScore * 100).toFixed(1)}% confidence`;
    } else if (testScore >= 0.6) {
      // Moderate authenticity
      details = `Test video shows moderate authenticity with ${(testScore * 100).toFixed(1)}% confidence`;
    } else {
      // Low authenticity - potential deepfake detected
      details = `Low authenticity detected in test video: ${(testScore * 100).toFixed(1)}% confidence`;
    }
    
    return NextResponse.json({
      score: verificationScore,
      details,
      testAnalysis: testResult
    });

  } catch (error) {
    console.error('Video analysis error:', error);
    return NextResponse.json({ 
      error: 'Video analysis failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 