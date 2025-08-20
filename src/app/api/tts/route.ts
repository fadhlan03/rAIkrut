import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Define the expected structure of the JWT payload
interface AccessTokenPayload {
  userId: string;
  email?: string;
}

// Configure for Vercel Edge Runtime
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;
  const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!jwtSecret || !elevenlabsApiKey || !voiceId) {
    console.error("Missing required environment variables.");
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const secretKey = new TextEncoder().encode(jwtSecret);

  try {
    // --- Authentication --- 
    const tokenCookie = req.cookies.get('access_token');
    if (!tokenCookie) {
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }

    let userId: string;
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      userId = payload.userId;
      if (!userId) throw new Error('User ID missing in token payload');
    } catch (authError: any) {
      console.warn('TTS API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { text } = body;

    console.log('TTS Request - Text length:', text?.length, 'Text preview:', text?.substring(0, 100));

    if (!text?.trim()) {
      console.log('TTS Error: Empty text received');
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    // Limit text length for performance
    if (text.length > 1000) {
      console.log('TTS Error: Text too long:', text.length, 'characters');
      return NextResponse.json({ error: "Text too long. Maximum 1000 characters." }, { status: 400 });
    }

    // Initialize ElevenLabs client
    const elevenlabs = new ElevenLabsClient({
      apiKey: elevenlabsApiKey,
    });

    // Generate speech using configured voice
    const audio = await elevenlabs.textToSpeech.convert(
      voiceId, // Voice ID from environment variable
      {
        text: text,
        modelId: "eleven_multilingual_v2", // Supports Indonesian language auto-detection
        outputFormat: "mp3_44100_128",
        voiceSettings: {
          stability: 0.7,
          similarityBoost: 0.8,
          style: 0.3,
          useSpeakerBoost: true
        }
      }
    );

    // Convert audio stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = audio.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Combine all chunks into a single buffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Return audio as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error: any) {
    console.error('ElevenLabs TTS API error:', error);
    
    // Handle specific ElevenLabs API errors
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
      return NextResponse.json({ error: 'Invalid API configuration.' }, { status: 500 });
    }
    if (error.message?.includes('QUOTA_EXCEEDED') || error.message?.includes('429')) {
      return NextResponse.json({ error: 'TTS service temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    if (error.message?.includes('voice_id')) {
      return NextResponse.json({ error: 'Voice configuration error. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ 
      error: 'Failed to generate speech. Please try again.' 
    }, { status: 500 });
  }
} 