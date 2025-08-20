import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db-client';
import { recordings as recordingsTable, calls } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { storeFile } from '@/lib/storage';

// Define the expected structure of the JWT payload
interface AccessTokenPayload {
  userId: string;
  email?: string;
  type: 'admin' | 'applicant';
}

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    console.error("Missing JWT_SECRET environment variable.");
    return NextResponse.json({ error: 'JWT secret not configured.' }, { status: 500 });
  }
  const secretKey = new TextEncoder().encode(jwtSecret);

  let callId: string | null = null;
  let conversationId: string | null = null;
  let userId: string;
  let userType: string;

  try {
    // --- Authentication --- 
    const tokenCookie = request.cookies.get('access_token');
    if (!tokenCookie) {
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
          algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      userId = payload.userId;
      userType = payload.type;
      if (!userId) throw new Error('User ID missing in token payload');
      if (!userType) throw new Error('User type missing in token payload');
    } catch (authError: any) {
      console.warn('Backup ElevenLabs API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }
    // --- End Authentication ---

    const body = await request.json();
    callId = body.callId;
    conversationId = body.conversationId;

    if (!callId) {
      return NextResponse.json({ error: "Call ID missing in request body" }, { status: 400 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID missing in request body" }, { status: 400 });
    }

    console.log(`[Backup ElevenLabs] Processing recording backup for call ${callId}, conversation ${conversationId}...`);

    // --- Verify Call Access ---
    // Admin users can access any call, applicants can only access their own calls
    let callData;
    if (userType === 'admin') {
      // Admin can access any call
      callData = await db.select({
        recordingId: calls.recordingId,
        ownerUserId: calls.userId
      }).from(calls).where(eq(calls.id, callId)).limit(1);
    } else {
      // Applicant can only access their own calls
      callData = await db.select({
        recordingId: calls.recordingId,
        ownerUserId: calls.userId
      }).from(calls).where(and(eq(calls.id, callId), eq(calls.userId, userId))).limit(1);
    }

    if (callData.length === 0) {
      return NextResponse.json({ error: 'Call not found or not authorized' }, { status: 404 });
    }

    const recordingId = callData[0].recordingId;
    if (!recordingId) {
      return NextResponse.json({ error: 'No recording record found for this call' }, { status: 404 });
    }

    // Check if audio is already backed up
    const existingRecording = await db.select({
      uri: recordingsTable.uri,
      uploadStatus: recordingsTable.uploadStatus,
      duration: recordingsTable.duration
    }).from(recordingsTable).where(eq(recordingsTable.id, recordingId)).limit(1);

    if (existingRecording.length > 0 && existingRecording[0].uri) {
      console.log(`[Backup ElevenLabs] Audio already backed up for recording ${recordingId}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Audio already backed up',
        recordingId: recordingId,
        uri: existingRecording[0].uri,
        duration: existingRecording[0].duration
      });
    }

    // Fetch conversation metadata to get duration
    console.log(`[Backup ElevenLabs] Fetching conversation metadata for duration calculation...`);
    let durationInSeconds: number | null = null;
    
    try {
      const conversationResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        },
      });

      if (conversationResponse.ok) {
        const conversationData = await conversationResponse.json();
        console.log(`[Backup ElevenLabs] Conversation metadata fields:`, Object.keys(conversationData));
        
        // Extract duration from metadata (primary approach)
        if (conversationData.call_duration_secs) {
          durationInSeconds = Math.round(conversationData.call_duration_secs);
          console.log(`[Backup ElevenLabs] Duration from ElevenLabs metadata: ${durationInSeconds} seconds`);
        } else if (conversationData.transcript && Array.isArray(conversationData.transcript)) {
          // Fallback: Calculate duration from transcript timestamps
          console.log(`[Backup ElevenLabs] No duration metadata, calculating from transcript...`);
          const transcript = conversationData.transcript;
          if (transcript.length > 0) {
            const lastEntry = transcript[transcript.length - 1];
            const lastTimestamp = lastEntry.time_in_call_secs ?? lastEntry.timestamp ?? lastEntry.time ?? lastEntry.start_time ?? 0;
            if (lastTimestamp > 0) {
              durationInSeconds = Math.round(lastTimestamp);
              console.log(`[Backup ElevenLabs] Duration calculated from transcript: ${durationInSeconds} seconds`);
            }
          }
        }
      } else {
        console.warn(`[Backup ElevenLabs] Failed to fetch conversation metadata: ${conversationResponse.status} ${conversationResponse.statusText}`);
      }
    } catch (metadataError) {
      console.warn(`[Backup ElevenLabs] Error fetching conversation metadata:`, metadataError);
    }

    // Fetch audio from ElevenLabs
    console.log(`[Backup ElevenLabs] Fetching audio from ElevenLabs for conversation ${conversationId}...`);
    const audioResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`, {
      method: 'GET',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
    });

    if (!audioResponse.ok) {
      console.error(`[Backup ElevenLabs] Failed to fetch audio from ElevenLabs: ${audioResponse.status} ${audioResponse.statusText}`);
      return NextResponse.json({ 
        error: `Failed to fetch audio from ElevenLabs: ${audioResponse.status} ${audioResponse.statusText}` 
      }, { status: 502 });
    }

    // Get the audio as a buffer
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBufferNode = Buffer.from(audioBuffer);
    
    console.log(`[Backup ElevenLabs] Downloaded audio: ${audioBufferNode.length} bytes`);

    // Upload to GCS
    const fileName = `recording-${recordingId}.mp3`;
    const destinationFolder = 'audio';
    
    console.log(`[Backup ElevenLabs] Uploading to GCS: ${fileName}`);
    const gcsPath = await storeFile(audioBufferNode, fileName, destinationFolder);
    
    // Update recording record with GCS path and duration (only if duration doesn't exist)
    const shouldUpdateDuration = durationInSeconds && (existingRecording.length === 0 || !existingRecording[0].duration);
    
    await db.update(recordingsTable)
      .set({
        uri: gcsPath,
        uploadStatus: 'uploaded',
        timestamp: new Date().toISOString(),
        ...(shouldUpdateDuration && { duration: durationInSeconds }),
      })
      .where(eq(recordingsTable.id, recordingId));

    console.log(`[Backup ElevenLabs] ✅ Successfully backed up audio to GCS: ${gcsPath}${durationInSeconds ? ` (duration: ${durationInSeconds}s)` : ''}`);

    return NextResponse.json({ 
      success: true, 
      recordingId: recordingId,
      uri: gcsPath,
      size: audioBufferNode.length,
      duration: durationInSeconds
    });

  } catch (error: any) {
    console.error(`[Backup ElevenLabs ${callId}] Unexpected error:`, error);
    return NextResponse.json({ 
      error: error.message || 'Failed to backup ElevenLabs recording' 
    }, { status: 500 });
  }
}
