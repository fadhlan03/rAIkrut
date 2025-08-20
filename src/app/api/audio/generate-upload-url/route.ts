import { NextRequest, NextResponse } from 'next/server';
import { getSignedUploadUrl } from '@/lib/storage'; 
import { db } from '@/lib/db-client';
import { calls, recordings } from '@/db/schema'; 
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';

// Define the expected structure of the JWT payload
interface AccessTokenPayload {
  userId: string;
  email?: string; // Optional
}

export async function POST(request: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;
  console.log('[Generate Upload URL] JWT_SECRET exists:', !!jwtSecret);
  console.log('[Generate Upload URL] Request URL:', request.url);
  
  if (!jwtSecret) {
      console.error('Generate Upload URL API: JWT_SECRET environment variable is not set.');
      return NextResponse.json({ error: 'Internal Server Error: Configuration missing' }, { status: 500 });
  }
  const secretKey = new TextEncoder().encode(jwtSecret);

  let userId: string;

  try {
    // --- Authentication --- 
    const tokenCookie = request.cookies.get('access_token');
    console.log('[Generate Upload URL] Token cookie exists:', !!tokenCookie);
    console.log('[Generate Upload URL] Token cookie value length:', tokenCookie?.value?.length || 0);
    
    if (!tokenCookie) {
      console.log('[Generate Upload URL] No access token cookie found');
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
          algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      userId = payload.userId;
      if (!userId) throw new Error('User ID missing in token payload');
      console.log('[Generate Upload URL] Authentication successful for userId:', userId);
    } catch (authError: any) {
      console.warn('Generate Upload URL API: Access token verification failed:', authError.code || authError.message);
      console.warn('Generate Upload URL API: Token verification error details:', authError);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }
    // --- End Authentication ---

    const body = await request.json();
    const callId = body.callId as string | null;

    if (!callId) {
      return NextResponse.json({ error: 'Call ID is required' }, { status: 400 });
    }

    // --- Verify Call Ownership ---
    const callData = await db.select({ 
        ownerUserId: calls.userId,
        existingRecordingId: calls.recordingId 
    }).from(calls).where(eq(calls.id, callId)).limit(1);
    
    if (callData.length === 0) {
        return NextResponse.json({ error: `Call not found` }, { status: 404 });
    }
    if (callData[0].ownerUserId !== userId) {
        console.warn(`User ${userId} attempted to generate upload URL for call ${callId} owned by ${callData[0].ownerUserId}.`);
        return NextResponse.json({ error: 'Forbidden: You do not own this call record.' }, { status: 403 });
    }
    // --- End Call Ownership Verification ---

    // --- Prepare Recording Record ---
    let recordingId = callData[0].existingRecordingId;
    const newRecordingNeeded = !recordingId;

    if (newRecordingNeeded) {
        recordingId = uuidv4(); // Generate new ID if needed
    }
    
    // Generate unique GCS path
    const fileExtension = '.wav'; // Assuming client will upload WAV
    const uniqueGcsFileName = `recording-${recordingId}${fileExtension}`;
    const gcsPath = `audio/${uniqueGcsFileName}`; // Structure: audio/recording-<uuid>.wav
    const contentType = 'audio/wav';

    // --- Create/Update Database Records within a Transaction ---
    try {
        await db.transaction(async (tx) => {
            if (newRecordingNeeded) {
                // console.log(`Generate Upload URL API: Creating new recording record ${recordingId} for call ${callId}...`);
                await tx.insert(recordings).values({
                    id: recordingId!,
                    timestamp: new Date().toISOString(),
                    uri: gcsPath,
                    uploadStatus: 'pending',
                    // transcript and speaker_metadata will be added later
                });
                
                await tx.update(calls)
                        .set({ recordingId: recordingId })
                        .where(eq(calls.id, callId));
                // console.log(`Generate Upload URL API: Linked new recording ${recordingId} to call ${callId}.`);
            } else {
                // Optional: Handle existing recording? Overwrite URI? Add logic if needed.
                // For now, we assume if recordingId exists, we just generate URL for its existing URI
                // Re-fetch the URI in case it differs? Or assume it matches the new gcsPath format?
                // Let's fetch the existing URI to be safe.
                const existingRecording = await tx.select({ uri: recordings.uri })
                                                .from(recordings)
                                                .where(eq(recordings.id, recordingId!))
                                                .limit(1);
                if (existingRecording.length === 0 || !existingRecording[0].uri) {
                    // This case should ideally not happen if recordingId is linked, but handle defensively
                    console.error(`Generate Upload URL API: Recording ID ${recordingId} linked to call ${callId}, but record or URI missing.`);
                    // If URI is missing, update it.
                     await tx.update(recordings)
                             .set({ uri: gcsPath, timestamp: new Date().toISOString(), uploadStatus: 'pending' })
                             .where(eq(recordings.id, recordingId!));
                     // console.log(`Generate Upload URL API: Updated missing URI for existing recording ${recordingId} to ${gcsPath}.`);
                } else {
                    // Use the URI already stored in the database for the signed URL
                    // gcsPath = existingRecording[0].uri; 
                    // Decided against this: Let's force the filename format consistency
                    // If URI exists but doesn't match expected format, maybe log warning or error?
                    // console.log(`Generate Upload URL API: Found existing recording ${recordingId} for call ${callId}. Using expected GCS path: ${gcsPath}`);
                    // Ensure the URI is updated if the format needs enforcement, and reset status
                     await tx.update(recordings)
                             .set({ uri: gcsPath, timestamp: new Date().toISOString(), uploadStatus: 'pending' })
                             .where(eq(recordings.id, recordingId!));
                }
            }
        });
    } catch (dbError: any) {
         console.error(`Generate Upload URL API: Database transaction failed for call ${callId}:`, dbError);
         return NextResponse.json({ error: `Failed to prepare recording record: ${dbError.message}` }, { status: 500 });
    }
    // --- End Database Operations ---


    // --- Generate Signed Upload URL ---
    try {
        const { signedUrl } = await getSignedUploadUrl(gcsPath, contentType, 300); // 5 min expiry
        // console.log(`Generate Upload URL API: Generated signed upload URL for ${gcsPath}`);

        return NextResponse.json({ 
            signedUrl: signedUrl, 
            gcsPath: gcsPath, // Return path for client confirmation/reference
            recordingId: recordingId // Return recording ID
        });

    } catch (urlError: any) {
        console.error(`Generate Upload URL API: Error generating signed upload URL for ${gcsPath}:`, urlError);
        return NextResponse.json({ error: `Failed to generate upload URL: ${urlError.message}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Generate Upload URL API - General error:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 