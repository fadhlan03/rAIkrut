import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db-client';
import { recordings as recordingsTable, calls } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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
      console.warn('Backup Transcript API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }
    // --- End Authentication ---

    const body = await request.json();
    callId = body.callId;
    const transcript = body.transcript;

    if (!callId) {
      return NextResponse.json({ error: "Call ID missing in request body" }, { status: 400 });
    }

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json({ error: "Valid transcript array required" }, { status: 400 });
    }

    console.log(`[Backup Transcript] Processing transcript backup for call ${callId}...`);

    // Calculate duration from transcript timestamps
    let durationInSeconds: number | null = null;
    if (transcript.length > 0) {
      console.log(`[Backup Transcript] Calculating duration from transcript...`);
      const lastEntry = transcript[transcript.length - 1];
      const lastTimestamp = lastEntry.timestamp ?? lastEntry.time ?? lastEntry.start_time ?? 0;
      if (lastTimestamp > 0) {
        durationInSeconds = Math.round(lastTimestamp / 1000); // Convert from milliseconds to seconds
        console.log(`[Backup Transcript] Duration calculated from transcript: ${durationInSeconds} seconds`);
      }
    }

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

    let recordingId = callData[0].recordingId;

    // Create recording record if it doesn't exist
    if (!recordingId) {
      recordingId = uuidv4();
      console.log(`[Backup Transcript] Creating new recording record ${recordingId} for call ${callId}...`);
      
      await db.transaction(async (tx) => {
        // Create recording record
        await tx.insert(recordingsTable).values({
          id: recordingId!,
          timestamp: new Date().toISOString(),
          transcript: transcript,
          uri: null, // Will be set when audio is backed up
          uploadStatus: 'transcript_backed_up',
          duration: durationInSeconds,
        });
        
        // Link recording to call
        await tx.update(calls)
          .set({ recordingId: recordingId })
          .where(eq(calls.id, callId!));
      });
    } else {
      // Update existing recording with transcript
      console.log(`[Backup Transcript] Updating existing recording ${recordingId} with transcript...`);
      
      // First check if duration already exists
      const existingRecord = await db.select({
        duration: recordingsTable.duration
      }).from(recordingsTable).where(eq(recordingsTable.id, recordingId)).limit(1);
      
      const shouldUpdateDuration = durationInSeconds && (existingRecord.length === 0 || !existingRecord[0].duration);
      
      await db.update(recordingsTable)
        .set({
          transcript: transcript,
          timestamp: new Date().toISOString(),
          ...(shouldUpdateDuration && { duration: durationInSeconds }),
        })
        .where(eq(recordingsTable.id, recordingId));
    }

    console.log(`[Backup Transcript] ✅ Successfully backed up transcript to database for recording ${recordingId}${durationInSeconds ? ` (duration: ${durationInSeconds}s)` : ''}`);

    return NextResponse.json({ 
      success: true, 
      recordingId: recordingId,
      transcriptSegments: transcript.length,
      duration: durationInSeconds
    });

  } catch (error: any) {
    console.error(`[Backup Transcript ${callId}] Unexpected error:`, error);
    return NextResponse.json({ 
      error: error.message || 'Failed to backup transcript' 
    }, { status: 500 });
  }
}
