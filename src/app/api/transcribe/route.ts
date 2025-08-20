import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { TranscriptSegment } from '@/types';
// --- DB/Storage Imports ---
import { db } from '@/lib/db-client';
import { recordings as recordingsTable, calls } from '@/db/schema'; // Renamed alias
import { getPresignedUrl } from '@/lib/storage';
import { eq, and } from 'drizzle-orm';
import { jwtVerify } from 'jose'; // Use jose
// --- Analysis Import ---
import { performAnalysisAndSaveReport } from '@/lib/analysis'; // Import the new function
// --- GCS Client Initialization ---
// Use the properly configured storage client that handles Base64 credentials
// This ensures it works on Vercel deployment
import { Storage, StorageOptions } from '@google-cloud/storage';

let storageOptions: StorageOptions = {};

// Check for Base64 encoded key in environment variables (for Vercel/serverless)
if (process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64) {
  try {
    const keyFileContent = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
    const credentials = JSON.parse(keyFileContent);
    storageOptions = {
      projectId: credentials.project_id,
      credentials,
    };
    console.log("[Transcribe] Using Base64 encoded service account key from ENV.");
  } catch (error) {
    console.error("[Transcribe] Failed to parse Base64 encoded service account key:", error);
    throw new Error("Invalid Base64 encoded service account key in environment variable.");
  }
} else {
  // If the Base64 var isn't set, assume local development using
  // GOOGLE_APPLICATION_CREDENTIALS file path or Application Default Credentials.
  console.log("[Transcribe] Using Application Default Credentials (or GOOGLE_APPLICATION_CREDENTIALS file path).");
}

const storage = new Storage(storageOptions);
// --- End GCS Client Initialization ---
// --------------------------

// Define the expected structure of the JWT payload
interface AccessTokenPayload {
  userId: string;
  email?: string; // Optional
}

// --- SpeakerTurn Type Definition --- 
// (Copied from previous route, assuming it's not exported globally)
type SpeakerTurn = {
    speaker: 'User' | 'AI';
    startTimeMs: number;
    endTimeMs: number;
};
// ------------------------------------

// --- Groq Client Initialization --- 
if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY environment variable not set. Transcription API will not work.");
}
const groq = new Groq();
// ----------------------------------

// --- Whisper Response Interface --- 
interface WhisperWord {
    word: string;
    start: number; // seconds
    end: number;   // seconds
}

interface WhisperSegmentFromGroq { // Renamed to avoid conflict with our TranscriptSegment
    id: number;
    seek: number;
    start: number; // seconds
    end: number;   // seconds
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
    language: string;
}

interface WhisperVerboseJsonResponseWithWords {
    text: string;
    segments: WhisperSegmentFromGroq[]; // Use renamed type
    words: WhisperWord[];
    language: string;
}
// ---------------------------------

// --- Vercel Edge Runtime Configuration ---
export const maxDuration = 60; // Set max duration to 60 seconds
// ---------------------------------------

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log("[Transcribe] POST request received, starting processing...");

  let speakerMetadata: SpeakerTurn[] | null = null; // Allow null
  let userId: string;
  let callId: string | null = null;
  let recordingId: string | null = null;
  let audioUri: string | null = null;

  try {
    const jwtSecret = process.env.JWT_SECRET;
    console.log("[Transcribe] Environment check - JWT_SECRET:", !!jwtSecret);
    console.log("[Transcribe] Environment check - GROQ_API_KEY:", !!process.env.GROQ_API_KEY);
    console.log("[Transcribe] Environment check - GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
    console.log("[Transcribe] Environment check - GCS_BUCKET_NAME:", !!process.env.GCS_BUCKET_NAME);
    
    if (!process.env.GROQ_API_KEY || !jwtSecret) {
      console.error("[Transcribe] Missing required API keys");
      return NextResponse.json({ error: "API keys not configured" }, { status: 500 });
    }
    const secretKey = new TextEncoder().encode(jwtSecret);

    // --- Authentication --- 
    console.log("[Transcribe] Starting authentication...");
    const tokenCookie = request.cookies.get('access_token');
    if (!tokenCookie) {
      console.log("[Transcribe] No access token cookie found");
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
          algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      userId = payload.userId;
      if (!userId) throw new Error('User ID missing in token payload');
      console.log("[Transcribe] Authentication successful for userId:", userId);
    } catch (authError: any) {
      console.warn('Transcribe API (Finalize): Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }
    // --- End Authentication ---

    // --- Get Request Body (callId, speakerMetadata) ---
    console.log("[Transcribe] Parsing request body...");
    const body = await request.json();
    callId = body.callId as string | null;
    const clientSpeakerMetadata = body.speaker_metadata as any; // Receive metadata from client
    console.log("[Transcribe] Call ID:", callId);
    console.log("[Transcribe] Speaker metadata provided:", !!clientSpeakerMetadata);

    if (!callId) {
      console.error("[Transcribe] No call ID provided");
      return NextResponse.json({ error: "Call ID missing in request body" }, { status: 400 });
    }
    // Allow speaker_metadata to be missing or explicitly null for manual uploads
    if (clientSpeakerMetadata) {
        try {
            speakerMetadata = clientSpeakerMetadata;
            if (!Array.isArray(speakerMetadata)) {
                console.warn(`[Transcribe ${callId}] Received speaker metadata is not an array, treating as null.`);
                speakerMetadata = null; // Treat invalid format as null
            }
            // console.log(`[Transcribe ${callId}] Received ${speakerMetadata?.length || 0} speaker turns.`);
        } catch (e) {
            console.error(`[Transcribe ${callId}] Failed to parse speaker metadata from client, treating as null:`, e);
            speakerMetadata = null;
        }
    } else {
        // console.log(`[Transcribe ${callId}] No speaker metadata provided by client (e.g., manual upload).`);
        speakerMetadata = null;
    }
    // --- End Get Request Body ---

    // --- Fetch Call/Recording Details & Verify Ownership ---
    const result = await db.select({
        recId: recordingsTable.id,
        recUri: recordingsTable.uri,
        ownerUserId: calls.userId,
        // Fetch speaker_metadata from DB as a fallback if not provided in request body, or if explicitly needed for re-runs
        dbSpeakerMetadata: recordingsTable.speakerMetadata
    })
    .from(calls)
    .leftJoin(recordingsTable, eq(calls.recordingId, recordingsTable.id))
    .where(and(eq(calls.id, callId), eq(calls.userId, userId)))
    .limit(1);

    if (result.length === 0) {
        return NextResponse.json({ error: 'Call not found or not authorized' }, { status: 404 });
    }

    recordingId = result[0].recId;
    audioUri = result[0].recUri;

    // If speakerMetadata is still null (not in request) and db has it, use db version.
    // This is useful if a retry is triggered without passing metadata again.
    if (!speakerMetadata && result[0].dbSpeakerMetadata) {
        // console.log(`[Transcribe ${callId}] Using speaker metadata from database.`);
        try {
            // Ensure dbSpeakerMetadata is parsed correctly if it's stored as JSON string
            const parsedDbMetadata = typeof result[0].dbSpeakerMetadata === 'string'
                ? JSON.parse(result[0].dbSpeakerMetadata)
                : result[0].dbSpeakerMetadata;
            if (Array.isArray(parsedDbMetadata)) {
                speakerMetadata = parsedDbMetadata as SpeakerTurn[];
            } else {
                // console.warn(`[Transcribe ${callId}] DB speaker metadata is not a valid array.`);
            }
        } catch (parseError) {
            // console.error(`[Transcribe ${callId}] Error parsing speaker metadata from DB:`, parseError);
        }
    }

    if (!recordingId || !audioUri) {
        console.error(`[Transcribe ${callId}] Recording ID or URI missing in database for this call.`);
        return NextResponse.json({ error: 'Recording details incomplete for this call' }, { status: 404 }); // Or 500?
    }
    // --- End Fetching Details ---

    // --- Verify File Existence in GCS & Update Status ---
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
        console.error(`[Transcribe ${callId}] GCS_BUCKET_NAME environment variable not set.`);
        return NextResponse.json({ error: "Server configuration error: Storage bucket not specified." }, { status: 500 });
    }
    try {
        const [fileExists] = await storage.bucket(bucketName).file(audioUri).exists();
        if (!fileExists) {
            console.warn(`[Transcribe ${callId}] Audio file ${audioUri} not found in GCS bucket ${bucketName}. Upload may have failed.`);
            await db.update(recordingsTable)
                .set({ uploadStatus: 'failed_upload' })
                .where(eq(recordingsTable.id, recordingId!)); // Added non-null assertion
            return NextResponse.json({ error: `Recording file not found. Upload may have failed or is still pending.` }, { status: 404 }); 
        }
        // File exists, proceed to mark as uploaded
        // console.log(`[Transcribe ${callId}] Audio file ${audioUri} confirmed in GCS. Marking as 'uploaded'.`);
        await db.update(recordingsTable)
            .set({ uploadStatus: 'uploaded' })
            .where(eq(recordingsTable.id, recordingId!)); // Added non-null assertion

    } catch (gcsError: any) {
        console.error(`[Transcribe ${callId}] Error checking file existence in GCS for ${audioUri}:`, gcsError);
        return NextResponse.json({ error: `Failed to verify recording file: ${gcsError.message}` }, { status: 500 });
    }
    // --- End File Verification ---

    // --- Update Recording with Speaker Metadata --- 
    try {
        // console.log(`[Transcribe ${callId}] Updating recording ${recordingId} with speaker metadata...`);
        if (clientSpeakerMetadata && Array.isArray(speakerMetadata) && speakerMetadata.length > 0) {
            await db.update(recordingsTable)
                .set({
                    speakerMetadata: speakerMetadata,
                    timestamp: new Date().toISOString(),
                })
                .where(eq(recordingsTable.id, recordingId!));
        }
        // console.log(`[Transcribe ${callId}] Recording ${recordingId} updated with speaker metadata.`);
    } catch (dbUpdateError) {
         console.error(`[Transcribe ${callId}] Failed to update recording ${recordingId} with speaker metadata:`, dbUpdateError);
         // Log error but proceed with transcription if possible?
         // Depending on requirements, maybe return 500 here
         return NextResponse.json({ error: "Failed to save speaker metadata" }, { status: 500 });
    }
    // --- End DB Update ---

    // --- Generate Presigned READ URL for Audio ---
    let presignedAudioUrl: string;
    try {
        // console.log(`[Transcribe ${callId}] Generating presigned READ URL for audio: ${audioUri}`);
        // Set expiry longer than expected transcription time (e.g., 15 minutes = 900 seconds)
        presignedAudioUrl = await getPresignedUrl(audioUri, 900); 
    } catch (urlError) {
        console.error(`[Transcribe ${callId}] Failed to generate presigned READ URL for ${audioUri}:`, urlError);
        const message = urlError instanceof Error ? urlError.message : "Failed to prepare audio URL";
        // If file wasn't found in GCS (e.g., client upload failed silently)
        if (urlError instanceof Error && urlError.message.includes('File not found')) {
             return NextResponse.json({ error: `Audio file not found in storage at ${audioUri}. Upload may have failed.` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to prepare audio for transcription: ${message}` }, { status: 500 });
    }
    // --- End Presigned URL Generation ---

    // --- Call Groq API using URL --- 
    console.log(`[Transcribe ${callId}] Sending audio URL to Groq Whisper API: ${presignedAudioUrl.substring(0, 100)}...`);
    const groqStartTime = Date.now();
    let transcription;
    try {
      transcription = await groq.audio.transcriptions.create({
        url: presignedAudioUrl, 
        model: "whisper-large-v3",
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"]
    });
    } catch (groqError) {
        console.error(`[Transcribe ${callId}] Groq transcription failed:`, groqError);
        const errorMessage = groqError instanceof Error ? groqError.message : "Groq transcription request failed";
        // Update status to 'transcription_failed'
        if (recordingId) { // Ensure recordingId is available
            try {
                await db.update(recordingsTable)
                    .set({ uploadStatus: 'transcription_failed' })
                    .where(eq(recordingsTable.id, recordingId));
            } catch (dbUpdateError) {
                console.error(`[Transcribe ${callId}] Failed to update status to 'transcription_failed' for recording ${recordingId}:`, dbUpdateError);
            }
        }
        return NextResponse.json({ error: `Transcription failed: ${errorMessage}` }, { status: 502 });
    }
    const groqEndTime = Date.now();
    console.log(`[Transcribe ${callId}] ✅ Groq Whisper transcription completed successfully in ${groqEndTime - groqStartTime}ms.`);
    // --- End Groq API Call --- 

    // --- Process the verbose_json response with Word-Level Diarization --- 
    const verboseResponse = transcription as any as WhisperVerboseJsonResponseWithWords;
    let finalSegments: TranscriptSegment[] = [];
    const matchingToleranceMs = 150;

    try {
      console.log(`[Transcribe ${callId}] Processing Groq transcript with ${verboseResponse.segments?.length || 0} segments and ${verboseResponse.words?.length || 0} words`);
      
      // Check if speakerMetadata is available and valid for word-level diarization
      if (speakerMetadata && Array.isArray(speakerMetadata) && speakerMetadata.length > 0 && verboseResponse.words && verboseResponse.words.length > 0) {
        console.log(`[Transcribe ${callId}] 🎯 Performing word-level diarization with ${speakerMetadata.length} ElevenLabs speaker turns and ${verboseResponse.words.length} Groq words.`);
        const wordsWithSpeakers: ({ word: WhisperWord; speaker: 'User' | 'AI' | 'Unknown' })[] = [];
        let lastAssignedSpeaker: 'User' | 'AI' = 'User';

        for (const word of verboseResponse.words) {
          const wordStartMs = word.start * 1000;
          const wordEndMs = word.end * 1000;

          const overlappingTurns = speakerMetadata.filter(turn =>
            (turn.startTimeMs - matchingToleranceMs) < wordEndMs &&
            (turn.endTimeMs + matchingToleranceMs) > wordStartMs
          );

          let assignedSpeaker: 'User' | 'AI' | 'Unknown' = 'Unknown';

          if (overlappingTurns.length === 1) {
            assignedSpeaker = overlappingTurns[0].speaker;
          } else if (overlappingTurns.length > 1) {
            let maxOverlap = 0;
            let bestSpeaker: 'User' | 'AI' = 'User';
            let foundBest = false;
            for (const turn of overlappingTurns) {
              const overlapStart = Math.max(wordStartMs, turn.startTimeMs);
              const overlapEnd = Math.min(wordEndMs, turn.endTimeMs);
              const overlapDuration = Math.max(0, overlapEnd - overlapStart);
              if (overlapDuration > maxOverlap) {
                maxOverlap = overlapDuration;
                bestSpeaker = turn.speaker;
                foundBest = true;
              }
            }
            assignedSpeaker = foundBest ? bestSpeaker : lastAssignedSpeaker;
          } else {
            assignedSpeaker = 'Unknown';
          }

          wordsWithSpeakers.push({ word, speaker: assignedSpeaker });
          if (assignedSpeaker === 'User' || assignedSpeaker === 'AI') {
            lastAssignedSpeaker = assignedSpeaker;
          }
        }

        // Fill in Unknown speakers using context
        for (let i = 0; i < wordsWithSpeakers.length; i++) {
            if (wordsWithSpeakers[i].speaker === 'Unknown') {
                let prevKnownSpeaker: 'User' | 'AI' | null = null;
                for (let j = i - 1; j >= 0; j--) {
                    if (wordsWithSpeakers[j].speaker !== 'Unknown') {
                        prevKnownSpeaker = wordsWithSpeakers[j].speaker as 'User' | 'AI';
                        break;
                    }
                }
                let nextKnownSpeaker: 'User' | 'AI' | null = null;
                for (let j = i + 1; j < wordsWithSpeakers.length; j++) {
                    if (wordsWithSpeakers[j].speaker !== 'Unknown') {
                        nextKnownSpeaker = wordsWithSpeakers[j].speaker as 'User' | 'AI';
                        break;
                    }
                }
                wordsWithSpeakers[i].speaker = prevKnownSpeaker || nextKnownSpeaker || lastAssignedSpeaker;
            }
        }

        // Convert words to segments
        if (wordsWithSpeakers.length > 0) {
            let currentSegment: TranscriptSegment | null = null;
            for (const { word, speaker } of wordsWithSpeakers) {
                if (speaker === 'Unknown') {
                    console.warn(`[Transcribe ${callId}] Skipping word "${word.word}" assigned "Unknown" after post-processing.`);
                    continue;
                }
                if (currentSegment && currentSegment.speaker === speaker) {
                    currentSegment.text += ` ${word.word}`;
                    currentSegment.timestamp = Math.min(currentSegment.timestamp, word.start * 1000);
                } else {
                    if (currentSegment) {
                        finalSegments.push(currentSegment);
                    }
                    currentSegment = {
                        speaker: speaker,
                        text: word.word,
                        timestamp: word.start * 1000
                    };
                }
            }
            if (currentSegment) {
                finalSegments.push(currentSegment);
            }
        }
        console.log(`[Transcribe ${callId}] ✅ Successfully combined Groq transcript with ElevenLabs diarization. Generated ${finalSegments.length} segments.`);
        
      } else if (verboseResponse.segments && verboseResponse.segments.length > 0) {
        // Fallback: Use Groq's segments directly but try to infer speakers from patterns
        console.log(`[Transcribe ${callId}] ⚠️ No ElevenLabs speaker metadata available (${speakerMetadata?.length || 0} turns). Using Groq segments with speaker inference.`);
        
        finalSegments = verboseResponse.segments.map((segment, index) => {
          // Simple heuristic: alternate speakers or use content analysis
          // In a real interview, User typically asks questions, AI responds
          let inferredSpeaker: 'User' | 'AI' = 'AI';
          
          // Look for question patterns to identify User
          const text = segment.text.toLowerCase().trim();
          const hasQuestionMark = text.includes('?');
          const hasQuestionWords = /\b(apa|siapa|kapan|dimana|bagaimana|mengapa|what|who|when|where|how|why|can you|could you|tell me|explain)\b/.test(text);
          const isShort = text.split(' ').length < 10; // Short responses might be questions
          
          if (hasQuestionMark || (hasQuestionWords && isShort)) {
            inferredSpeaker = 'User';
          }
          
          return {
            speaker: inferredSpeaker,
            text: segment.text,
            timestamp: segment.start * 1000
          };
        });
        
        console.log(`[Transcribe ${callId}] ✅ Generated ${finalSegments.length} segments using Groq transcript with speaker inference.`);
        
      } else {
        console.error(`[Transcribe ${callId}] ❌ No words or segments found in Groq response. Cannot produce transcript.`);
        return NextResponse.json({ error: "Groq transcription response lacked word-level timestamps or segments." }, { status: 500 });
      }

       // --- Smoothing and Merging (Keep existing logic) --- 
       const smoothedSegments: TranscriptSegment[] = [];
       const minWordsForStandaloneSegment = 2;
       if (finalSegments.length > 0) {
           smoothedSegments.push(finalSegments[0]);
           for (let i = 1; i < finalSegments.length; i++) {
               const currentSegment = finalSegments[i];
               const prevSmoothedSegment = smoothedSegments[smoothedSegments.length - 1];
               const wordCount = currentSegment.text.split(' ').length;
               if (wordCount < minWordsForStandaloneSegment && currentSegment.speaker !== prevSmoothedSegment.speaker) {
                   const nextOriginalSegment = (i < finalSegments.length - 1) ? finalSegments[i + 1] : null;
                   if ((nextOriginalSegment && nextOriginalSegment.speaker === prevSmoothedSegment.speaker) || (!nextOriginalSegment)) {
                       prevSmoothedSegment.text += ' ' + currentSegment.text;
                       continue;
                   }
               }
               smoothedSegments.push(currentSegment);
           }
       }
       const mergedSegments: TranscriptSegment[] = [];
       if (smoothedSegments.length > 0) {
           mergedSegments.push({ ...smoothedSegments[0] });
           for (let i = 1; i < smoothedSegments.length; i++) {
               const currentSegment = smoothedSegments[i];
               const lastMergedSegment = mergedSegments[mergedSegments.length - 1];
               if (currentSegment.speaker === lastMergedSegment.speaker) {
                   lastMergedSegment.text += ' ' + currentSegment.text;
               } else {
                   mergedSegments.push({ ...currentSegment });
               }
           }
       }
       finalSegments = mergedSegments;
       console.log(`[Transcribe ${callId}] ✅ Final processing complete. Generated ${finalSegments.length} merged & smoothed segments for Gemini analysis.`);
       
       // Log sample of the transcript for verification
       if (finalSegments.length > 0) {
         const sampleText = finalSegments.slice(0, 3).map(s => `[${s.speaker}]: ${s.text.substring(0, 100)}...`).join(' | ');
         console.log(`[Transcribe ${callId}] 📝 Sample transcript: ${sampleText}`);
       }
       // --- End Smoothing and Merging --- 

    } catch (processingError) {
      console.error(`[Transcribe ${callId}] ❌ Error processing Groq transcription response:`, processingError);
      const errorMessage = processingError instanceof Error ? processingError.message : "Failed processing transcription data";
      return NextResponse.json({ error: `Transcription processing failed: ${errorMessage}` }, { status: 500 });
    }
    // --- End Transcription Processing ---


    // --- Update DB with Transcript & Trigger Analysis --- 
    try {
        if (!recordingId) throw new Error("Recording ID became unavailable unexpectedly.");

        // --- Calculate Duration ---
        let durationInSeconds: number | null = null;
        // Ensure verboseResponse, segments exist and segments array is not empty
        if (verboseResponse?.segments && verboseResponse.segments.length > 0) {
            const lastSegment = verboseResponse.segments[verboseResponse.segments.length - 1];
            // Ensure the last segment has an 'end' property which is a number
            if (lastSegment?.end !== undefined && typeof lastSegment.end === 'number') {
               // Round to nearest integer second
               durationInSeconds = Math.round(lastSegment.end);
               // console.log(`[Transcribe ${callId}] Calculated recording duration: ${durationInSeconds} seconds from last segment end time ${lastSegment.end}.`);
            } else {
               console.warn(`[Transcribe ${callId}] Last segment found, but valid 'end' time is missing. Cannot determine duration.`);
            }
        } else {
            console.warn(`[Transcribe ${callId}] No segments found in transcription response. Cannot determine duration.`);
        }
        // --- End Calculate Duration ---

        console.log(`[Transcribe ${callId}] 💾 Saving Groq transcript (${finalSegments.length} segments) and duration (${durationInSeconds}s) to database...`);
        await db.update(recordingsTable)
            .set({
                 transcript: finalSegments,
                 duration: durationInSeconds // Add the calculated duration (can be null)
                 // upload_status remains 'uploaded' if transcription was successful
                 // If further steps like analysis determine a 'completed' state, that would be updated there.
            })
            .where(eq(recordingsTable.id, recordingId));
        console.log(`[Transcribe ${callId}] ✅ Successfully saved Groq transcript to database for recording ${recordingId}.`);

        // --- 7. *** NEW: Trigger Analysis Synchronously *** ---
        console.log(`[Transcribe ${callId}] 🤖 Transcription complete. Checking if Gemini analysis should run...`);
        
        // Skip analysis if GEMINI_API_KEY is missing or SKIP_ANALYSIS is set
        if (!process.env.GEMINI_API_KEY) {
            console.warn(`[Transcribe ${callId}] ⚠️ GEMINI_API_KEY not found, skipping analysis step.`);
        } else if (process.env.SKIP_ANALYSIS === 'true') {
            console.log(`[Transcribe ${callId}] ⚠️ SKIP_ANALYSIS is enabled, skipping analysis step.`);
        } else {
            console.log(`[Transcribe ${callId}] 🚀 Starting Gemini analysis with Groq transcript...`);
            let analysisOutcome: { success: boolean; error?: string; reportId?: string } | null = null;
            try {
                // Pass the authenticated userId obtained earlier
                analysisOutcome = await performAnalysisAndSaveReport(callId!, userId); // Added non-null assertion for callId

                if (analysisOutcome.success) {
                     console.log(`[Transcribe ${callId}] ✅ Gemini analysis completed successfully using Groq transcript (Report ID: ${analysisOutcome.reportId}).`);
                } else {
                    // Log analysis error/timeout, but don't fail the overall transcription response
                    console.warn(`[Transcribe ${callId}] ⚠️ Gemini analysis step failed or timed out: ${analysisOutcome.error}`);
                }

            } catch (unexpectedError: any) {
                // Catch any unexpected errors ONLY from the analysis function itself
                console.error(`[Transcribe ${callId}] ❌ Unexpected error calling Gemini analysis function:`, unexpectedError);
                 // Log it, but proceed to return success for transcription part
            }
        }
        // --- End Trigger Analysis --- 

    } catch (dbUpdateError) {
        console.error(`[Transcribe ${callId}] ❌ Failed to update recording ${recordingId} with Groq transcript and duration:`, dbUpdateError);
        // If DB update fails here, transcription technically succeeded but wasn't saved.
        return NextResponse.json({ error: "Failed to save final Groq transcript and duration to database." }, { status: 500 });
    }
    // --- End DB Update ---

    const processingEndTime = Date.now();
    console.log(`[Transcribe ${callId}] ✅ Complete workflow finished in ${processingEndTime - requestStartTime}ms. Groq transcript processed and ready for Gemini analysis.`);
    return NextResponse.json({
        success: true,
        message: "Groq transcription completed successfully and saved for analysis.", // Updated message to clarify Groq usage
        // Optionally return transcript if needed immediately by client, but usually not
        // transcript: finalSegments 
    });

  } catch (error) {
    console.error('Unexpected error in /api/transcribe:', error);
    const message = error instanceof Error ? error.message : "An unknown server error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
  