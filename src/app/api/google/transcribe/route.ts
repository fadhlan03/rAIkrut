import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import { google } from '@google-cloud/speech/build/protos/protos'; // Import specific types
import { TranscriptSegment } from '@/types';
import fs from 'fs/promises'; // *** ADDED: Node.js file system module ***
import path from 'path'; // *** ADDED: Node.js path module ***
import { StorageOptions } from '@google-cloud/storage'; // *** ADDED: Import StorageOptions type ***
// import { ClientOptions } from '@google-cloud/speech'; // *** REMOVED: Import specific ClientOptions ***

// --- Debug Output Directory ---
const DEBUG_OUTPUT_DIR = path.resolve(process.cwd(), 'debug_output'); // *** ADDED: Path to debug folder ***
// Ensure the debug directory exists
const ensureDebugDirExists = async () => { // *** ADDED: Function to create dir ***
  try {
    await fs.mkdir(DEBUG_OUTPUT_DIR, { recursive: true });
  } catch (error: any) {
    // Ignore EEXIST error (directory already exists)
    if (error.code !== 'EEXIST') {
      console.error(`Failed to create debug directory ${DEBUG_OUTPUT_DIR}:`, error);
      // Decide if this should be a fatal error for the request
    }
  }
};
ensureDebugDirExists(); // Call it once at startup (or per request if preferred)
// --- End Debug Output Directory ---

// --- Google Client Initialization ---
let speechClient: SpeechClient | null = null;
let storageClient: Storage | null = null;
let bucketName: string | undefined = undefined;

// *** MODIFIED: Separate options objects ***
// Let TypeScript infer the type for speechOptions
let speechOptions: any = {}; // Use 'any' initially or let it be inferred
let storageOptions: StorageOptions = {};

// Check for Base64 encoded key in environment variables (for Vercel/serverless)
if (process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64) {
  try {
    const keyFileContent = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
    const credentials = JSON.parse(keyFileContent);
    // Create specific options for each client
    speechOptions = {
      projectId: credentials.project_id,
      credentials,
    };
    storageOptions = {
      projectId: credentials.project_id,
      credentials,
    };
    // console.log("[GoogleTranscribe Route] Using Base64 encoded service account key from ENV.");
  } catch (error) {
    console.error("[GoogleTranscribe Route] Failed to parse Base64 encoded service account key:", error);
    throw new Error("Invalid Base64 encoded service account key provided to Google Transcribe route.");
  }
} else {
  // console.log("[GoogleTranscribe Route] Using Application Default Credentials (or GOOGLE_APPLICATION_CREDENTIALS file path).");
  // No specific options needed for ADC, leave speechOptions/storageOptions empty
}
// *** END MODIFIED ***

try {
  // Ensure GOOGLE_APPLICATION_CREDENTIALS or Base64 key is handled
  // The warning below is less relevant now as ADC is the fallback or Base64 is used
  // if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64) {
  //   console.warn("GOOGLE_APPLICATION_CREDENTIALS or GCP_SERVICE_ACCOUNT_KEY_BASE64 environment variable not set. Google STT/Storage API will likely fail.");
  // }

  // Use the correct env variable name already fixed by user
  if (!process.env.GCS_BUCKET_NAME) {
    console.warn("GCS_BUCKET_NAME environment variable not set. File upload will fail.");
  } else {
    bucketName = process.env.GCS_BUCKET_NAME;
  }

  // *** MODIFIED: Initialize clients WITH their specific options ***
  speechClient = new SpeechClient(speechOptions);
  storageClient = new Storage(storageOptions);
  // *** END MODIFIED ***

  // console.log("Google Speech and Storage Clients initialized successfully for transcribe route.");
} catch (error) {
  console.error("Failed to initialize Google Clients for transcribe route:", error);
  // Clients will remain null, and requests will fail
}
// -----------------------------------------

// --- Vercel Edge Runtime Configuration ---
export const maxDuration = 60; // Max duration for Vercel Hobby plan (seconds)
// ---------------------------------------

// Simple mapping: Assumes speaker tags are assigned consistently (e.g., 1st detected = User, 2nd = AI)
// This might need adjustment based on real-world results.
const mapSpeakerTag = (tag: number, tagMap: Map<number, 'User' | 'AI'>): 'User' | 'AI' => {
  if (!tagMap.has(tag)) {
    // Assign 'User' to the first encountered tag, 'AI' to the second
    const assignedSpeaker = tagMap.size === 0 ? 'User' : 'AI';
    tagMap.set(tag, assignedSpeaker);
    // console.log(`Mapped Google speakerTag ${tag} to ${assignedSpeaker}`);
  }
  return tagMap.get(tag) || 'User'; // Default to 'User' if somehow exceeds map size
};

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  // console.log("Received POST request to /api/google/transcribe (long-running)");

  // *** ADDED: Ensure debug dir exists per request (alternative placement) ***
  // await ensureDebugDirExists();

  if (!speechClient || !storageClient) {
    return NextResponse.json({ error: "Google Clients not initialized" }, { status: 500 });
  }
  if (!bucketName) {
    return NextResponse.json({ error: "Storage bucket not configured" }, { status: 500 });
  }

  let callId: string | null = null;
  let audioFile: File | null = null;
  let gcsFileName: string | null = null;
  let gcsUri: string | null = null;

  try {
    // --- Get Data from FormData ---
    const formData = await request.formData();
    callId = formData.get('callId') as string | null;
    audioFile = formData.get('audio') as File | null;

    if (!callId) {
      return NextResponse.json({ error: "Call ID missing in form data" }, { status: 400 });
    }
    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json({ error: "Audio file missing or empty in form data" }, { status: 400 });
    }
    // console.log(`[GoogleTranscribeLR ${callId}] Received audio file: ${audioFile.name}, size: ${audioFile.size}`);
    // --- End Get Data from FormData ---

    // --- Convert Audio File Buffer ---
    const audioBytes = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(audioBytes);
    // --- End Audio Conversion ---

    // *** ADDED: Save original audio file for debugging ***
    try {
      const debugAudioFileName = `${callId}_${Date.now()}_input.wav`;
      const debugAudioFilePath = path.join(DEBUG_OUTPUT_DIR, debugAudioFileName);
      await fs.writeFile(debugAudioFilePath, audioBuffer);
      // console.log(`[GoogleTranscribeLR ${callId}] Saved debug audio to: ${debugAudioFilePath}`);
    } catch (writeError) {
      console.error(`[GoogleTranscribeLR ${callId}] Failed to save debug audio file:`, writeError);
      // Continue processing even if debug save fails
    }
    // *** END ADDED ***

    // --- Upload Audio to GCS ---
    const uploadStartTime = Date.now();
    gcsFileName = `transcribe-temp/${callId}-${Date.now()}.wav`;
    gcsUri = `gs://${bucketName}/${gcsFileName}`;

    // console.log(`[GoogleTranscribeLR ${callId}] Uploading audio to ${gcsUri}...`);
    try {
      const bucket = storageClient.bucket(bucketName);
      const file = bucket.file(gcsFileName);
      await file.save(audioBuffer, {
        contentType: 'audio/wav',
      });
      // console.log(`[GoogleTranscribeLR ${callId}] Upload successful in ${Date.now() - uploadStartTime}ms.`);
    } catch (uploadError) {
      console.error(`[GoogleTranscribeLR ${callId}] Failed to upload audio to GCS:`, uploadError);
      const errorMessage = uploadError instanceof Error ? uploadError.message : "GCS upload failed";
      return NextResponse.json({ error: `Failed to prepare audio for transcription: ${errorMessage}` }, { status: 500 });
    }
    // --- End GCS Upload ---

    // --- Configure Google STT Request (Long Running) ---
    const audio: google.cloud.speech.v1.IRecognitionAudio = {
      uri: gcsUri,
    };

    const config: google.cloud.speech.v1.IRecognitionConfig = {
      encoding: google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
      sampleRateHertz: 16000,
      languageCode: 'id-ID',
      model: 'telephony',
      enableWordTimeOffsets: true,
      diarizationConfig: {
        enableSpeakerDiarization: true,
        minSpeakerCount: 2,
        maxSpeakerCount: 2,
      },
    };

    const requestPayload: google.cloud.speech.v1.ILongRunningRecognizeRequest = {
      config: config,
      audio: audio,
    };
    // --- End Request Configuration ---

    // --- Call Google STT API (Long Running) ---
    // console.log(`[GoogleTranscribeLR ${callId}] Sending long-running request to Google STT for ${gcsUri}...`);
    const googleStartTime = Date.now();
    let operation: any; // Use 'any' to bypass strict type check for .promise()

    try {
      const [op] = await speechClient.longRunningRecognize(requestPayload);
      operation = op;
    } catch (sttError) {
      console.error(`[GoogleTranscribeLR ${callId}] Failed to *initiate* Google STT long-running job:`, sttError);
      const errorMessage = sttError instanceof Error ? sttError.message : "Google STT initiation failed";
      return NextResponse.json({ error: `Transcription failed: ${errorMessage}` }, { status: 502 });
    }

    if (!operation) {
      console.error(`[GoogleTranscribeLR ${callId}] STT operation object was not obtained.`);
      return NextResponse.json({ error: "Failed to obtain transcription operation status." }, { status: 500 });
    }
    // console.log(`[GoogleTranscribeLR ${callId}] Waiting for STT operation to complete...`);

    let recognizeResponse: google.cloud.speech.v1.ILongRunningRecognizeResponse | undefined;
    try {
      const [response] = await operation.promise();
      recognizeResponse = response;
    } catch (opError) {
      console.error(`[GoogleTranscribeLR ${callId}] Google STT *operation* failed:`, opError);
      const errorMessage = opError instanceof Error ? opError.message : "Google STT operation failed";
      return NextResponse.json({ error: `Transcription failed: ${errorMessage}` }, { status: 502 });
    }

    const googleEndTime = Date.now();
    // console.log(`[GoogleTranscribeLR ${callId}] Google STT operation finished in ${googleEndTime - googleStartTime}ms.`);
    // --- End Google STT API Call ---

    // --- Process Google STT Response ---
    const finalSegments: TranscriptSegment[] = [];
    const speakerTagMap = new Map<number, 'User' | 'AI'>();

    if (!recognizeResponse) {
      console.error(`[GoogleTranscribeLR ${callId}] STT operation completed but response object was not obtained.`);
      return NextResponse.json({ error: "Failed to obtain transcription results after operation completion." }, { status: 500 });
    }

    // console.log(`[GoogleTranscribeLR ${callId}] Received ${recognizeResponse.results?.length ?? 0} transcription result(s) from Google.`);

    // *** Process ONLY the LAST result ***
    let allWords: google.cloud.speech.v1.IWordInfo[] = [];
    // if (!recognizeResponse.results || recognizeResponse.results.length === 0) { // Check moved below
    //   console.warn(`[GoogleTranscribeLR ${callId}] Google STT returned no transcription results.`);
    //   // Return empty array if no results, but log it
    //   // return NextResponse.json({ transcription: [] });
    // }

    const lastResult = recognizeResponse.results?.[recognizeResponse.results.length - 1];

    if (lastResult && lastResult.alternatives && lastResult.alternatives[0] && lastResult.alternatives[0].words) {
        // console.log(`[GoogleTranscribeLR ${callId}] Processing words from the last result.`);
        allWords = lastResult.alternatives[0].words;
        // Log first few words with speaker tags from the last result for inspection
        if (allWords.length > 0) {
            // console.log(`[GoogleTranscribeLR ${callId}] First word: '${allWords[0].word}', Tag: ${allWords[0].speakerTag}`);
            if (allWords.length > 1) {
                // console.log(`[GoogleTranscribeLR ${callId}] Second word: '${allWords[1].word}', Tag: ${allWords[1].speakerTag}`);
            }
            const lastWordIndex = allWords.length - 1;
            // console.log(`[GoogleTranscribeLR ${callId}] Last word: '${allWords[lastWordIndex].word}', Tag: ${allWords[lastWordIndex].speakerTag}`);
        }
    } else {
        console.warn(`[GoogleTranscribeLR ${callId}] The last result from Google STT lacked alternatives or word-level details.`);
        // Check previous results? For now, we'll treat this as potentially failed diarization/transcription.
        // Attempt to concatenate words from ALL results as a fallback (original behavior)
        console.warn(`[GoogleTranscribeLR ${callId}] Fallback: Concatenating words from all results.`);
        recognizeResponse.results?.forEach((result, index) => {
            if (result.alternatives && result.alternatives[0] && result.alternatives[0].words) {
                allWords = allWords.concat(result.alternatives[0].words);
                // console.log(`[GoogleTranscribeLR ${callId}] Added ${result.alternatives[0].words.length} words from result index ${index}`);
            }
        });
        if (allWords.length === 0) {
             console.warn(`[GoogleTranscribeLR ${callId}] Google STT returned no transcription results even after checking all results.`);
             return NextResponse.json({ transcription: [] }); // Return empty if still no words
        }
    }

    // Check if all words have the same speaker tag (or no tag) - Run this check AFTER collecting words
    const uniqueSpeakerTags = new Set(allWords.map(w => w?.speakerTag).filter(tag => tag !== undefined && tag !== null));
    // console.log(`[GoogleTranscribeLR ${callId}] Unique speaker tags detected in processed words:`, Array.from(uniqueSpeakerTags));
    if (uniqueSpeakerTags.size <= 1) {
        console.warn(`[GoogleTranscribeLR ${callId}] Diarization might have failed or only one speaker detected: Only ${uniqueSpeakerTags.size} unique speaker tag(s) found in the final word list.`);
        // Consider returning a specific error or a single segment transcript?
    }


    // console.log(`[GoogleTranscribeLR ${callId}] Processing ${allWords.length} final words for segment generation...`);
    let currentSegment: TranscriptSegment | null = null;
    // const speakerTagMap = new Map<number, 'User' | 'AI'>(); // Defined earlier

    for (const wordInfo of allWords) {
      // Add null check for wordInfo itself just in case concatenation resulted in undefined entries
      if (!wordInfo || wordInfo.word == null || wordInfo.speakerTag == null || wordInfo.startTime == null ||
        wordInfo.startTime.seconds == null || wordInfo.startTime.nanos == null) {
        console.warn(`[GoogleTranscribeLR ${callId}] Skipping word with missing info:`, JSON.stringify(wordInfo));
        continue;
      }

      const speaker = mapSpeakerTag(wordInfo.speakerTag, speakerTagMap);
      const wordText = wordInfo.word;
      const startTimeMs = (Number(wordInfo.startTime.seconds) * 1000) + Math.round(wordInfo.startTime.nanos / 1_000_000);

      if (currentSegment && currentSegment.speaker === speaker) {
        currentSegment.text += ` ${wordText}`;
      } else {
        if (currentSegment) {
          finalSegments.push(currentSegment);
        }
        currentSegment = {
          speaker: speaker,
          text: wordText,
          timestamp: startTimeMs,
        };
      }
    }

    if (currentSegment) {
      finalSegments.push(currentSegment);
    }

    // console.log(`[GoogleTranscribeLR ${callId}] Processed ${finalSegments.length} final transcript segments.`);
    // --- End Response Processing ---

    // *** ADDED: Save transcription JSON for debugging ***
    try {
      const debugJsonFileName = `${callId}_${Date.now()}_transcription.json`;
      const debugJsonFilePath = path.join(DEBUG_OUTPUT_DIR, debugJsonFileName);
      await fs.writeFile(debugJsonFilePath, JSON.stringify(finalSegments, null, 2)); // Pretty print JSON
      // console.log(`[GoogleTranscribeLR ${callId}] Saved debug transcription JSON to: ${debugJsonFilePath}`);
    } catch (writeError) {
      console.error(`[GoogleTranscribeLR ${callId}] Failed to save debug transcription JSON:`, writeError);
      // Continue processing even if debug save fails
    }
    // *** END ADDED ***

    const processingEndTime = Date.now();
    // console.log(`[GoogleTranscribeLR ${callId}] Full processing completed in ${processingEndTime - requestStartTime}ms.`);

    // --- Return the Transcription ---
    return NextResponse.json({
      transcription: finalSegments
    });

  } catch (error) {
    console.error(`[GoogleTranscribeLR ${callId}] Unexpected error:`, error);
    const message = error instanceof Error ? error.message : "An unknown server error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (gcsFileName && storageClient && bucketName) {
      // console.log(`[GoogleTranscribeLR ${callId}] Cleaning up temporary GCS file: ${gcsUri}...`);
      try {
        await storageClient.bucket(bucketName).file(gcsFileName).delete({ ignoreNotFound: true });
        // console.log(`[GoogleTranscribeLR ${callId}] GCS cleanup successful.`);
      } catch (cleanupError) {
        console.error(`[GoogleTranscribeLR ${callId}] Error deleting GCS file ${gcsUri}:`, cleanupError);
      }
    }
  }
} 