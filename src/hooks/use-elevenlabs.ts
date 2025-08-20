"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState, useRef, useEffect } from "react";
import { AudioRecorder } from "@/lib/audio-recorder";

// Speaker metadata types
export interface SpeakerTurn {
  speaker: 'User' | 'AI';
  startTimeMs: number;
  endTimeMs: number;
}

interface AudioChunk {
  chunk: ArrayBuffer;
  timestamp: number;
  sampleRate: number;
}

async function requestMicrophonePermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch {
    console.error("Microphone permission denied");
    return false;
  }
}

async function getSignedUrl(): Promise<string> {
  const response = await fetch("/api/elevenlabs/signed-url");
  if (!response.ok) {
    throw Error("Failed to get signed url");
  }
  const data = await response.json();
  return data.signedUrl;
}

export function useElevenLabs() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioChunksRef = useRef<AudioChunk[]>([]);
  const speakerMetadataRef = useRef<SpeakerTurn[]>([]);
  const callStartTimeRef = useRef<number | null>(null);
  const currentSpeakerRef = useRef<'User' | 'AI'>('User');
  const lastSpeakerChangeRef = useRef<number>(0);

  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs connected");
      setError(null);
      startAudioRecording();
    },
    onDisconnect: () => {
      console.log("ElevenLabs disconnected");
      setConversationId(null);
      stopAudioRecording();
    },
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      setError(error || "An error occurred during the conversation");
    },
    onMessage: (message) => {
      console.log("ElevenLabs message:", message);
      // Note: Speaker change detection removed due to unclear message structure
      // The audio recording will still work and transcription can infer speakers
    },
  });

  // Handle speaker changes for metadata tracking
  const handleSpeakerChange = useCallback((newSpeaker: 'User' | 'AI') => {
    const now = Date.now();
    const callStartTime = callStartTimeRef.current || now;
    const relativeTime = now - callStartTime;

    // End the previous speaker turn
    if (speakerMetadataRef.current.length > 0 || lastSpeakerChangeRef.current > 0) {
      const lastTurn = speakerMetadataRef.current[speakerMetadataRef.current.length - 1];
      if (lastTurn && lastTurn.endTimeMs === -1) {
        lastTurn.endTimeMs = relativeTime;
      } else if (lastSpeakerChangeRef.current > 0) {
        // Create a turn for the previous speaker if we missed the start
        speakerMetadataRef.current.push({
          speaker: currentSpeakerRef.current,
          startTimeMs: lastSpeakerChangeRef.current,
          endTimeMs: relativeTime,
        });
      }
    }

    // Start new speaker turn
    speakerMetadataRef.current.push({
      speaker: newSpeaker,
      startTimeMs: relativeTime,
      endTimeMs: -1, // Will be set when speaker changes again
    });

    currentSpeakerRef.current = newSpeaker;
    lastSpeakerChangeRef.current = relativeTime;
  }, []);

  // Start audio recording
  const startAudioRecording = useCallback(async () => {
    try {
      console.log("Starting audio recording for analysis...");
      
      const audioRecorder = new AudioRecorder(16000); // 16kHz sample rate
      audioRecorderRef.current = audioRecorder;
      
      // Listen for raw audio chunks
      audioRecorder.on('raw_chunk', (data: AudioChunk) => {
        audioChunksRef.current.push(data);
        console.log(`Audio chunk received: ${data.chunk.byteLength} bytes, total chunks: ${audioChunksRef.current.length}`);
      });

      await audioRecorder.start();
      setIsRecording(true);
      callStartTimeRef.current = Date.now();
      lastSpeakerChangeRef.current = 0;
      
      // Initial speaker (assuming user starts)
      speakerMetadataRef.current = [{
        speaker: 'User',
        startTimeMs: 0,
        endTimeMs: -1,
      }];
      
      console.log("Audio recording started successfully");
    } catch (error) {
      console.error("Failed to start audio recording:", error);
      setError("Failed to start audio recording for analysis");
    }
  }, []);

  // Stop audio recording
  const stopAudioRecording = useCallback(() => {
    if (audioRecorderRef.current && isRecording) {
      console.log("Stopping audio recording...");
      
      // Finalize the last speaker turn
      const now = Date.now();
      const callStartTime = callStartTimeRef.current || now;
      const relativeTime = now - callStartTime;
      
      const lastTurn = speakerMetadataRef.current[speakerMetadataRef.current.length - 1];
      if (lastTurn && lastTurn.endTimeMs === -1) {
        lastTurn.endTimeMs = relativeTime;
      }
      
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
      setIsRecording(false);
      
      console.log(`Audio recording stopped. Captured ${audioChunksRef.current.length} chunks and ${speakerMetadataRef.current.length} speaker turns`);
      console.log("Speaker metadata:", JSON.stringify(speakerMetadataRef.current, null, 2));
    } else {
      console.log("Stop audio recording called but no active recording found");
      setIsRecording(false);
    }
  }, [isRecording]);

  // Assemble audio chunks into WAV blob
  const assembleAudioBlob = useCallback((): Blob | null => {
    const chunks = audioChunksRef.current;
    console.log(`[assembleAudioBlob] Assembling ${chunks.length} audio chunks`);
    
    if (chunks.length === 0) {
      console.warn("[assembleAudioBlob] No audio chunks to assemble");
      return null;
    }

    // Calculate total samples
    let totalSamples = 0;
    for (const chunk of chunks) {
      totalSamples += chunk.chunk.byteLength / 2; // 2 bytes per sample (16-bit)
    }
    
    console.log(`[assembleAudioBlob] Total samples: ${totalSamples}`);

    // Create combined Int16Array
    const combinedAudio = new Int16Array(totalSamples);
    let offset = 0;
    
    for (const chunk of chunks) {
      const chunkArray = new Int16Array(chunk.chunk);
      combinedAudio.set(chunkArray, offset);
      offset += chunkArray.length;
    }

    // Create WAV file
    const sampleRate = chunks[0]?.sampleRate || 16000;
    console.log(`[assembleAudioBlob] Creating WAV file with sample rate: ${sampleRate}`);
    const wavBuffer = createWavFile(combinedAudio, sampleRate);
    
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    console.log(`[assembleAudioBlob] Created WAV blob: ${blob.size} bytes`);
    
    return blob;
  }, []);

  // Process and upload recording after call ends
  const processRecording = useCallback(async (callId: string) => {
    const chunks = audioChunksRef.current;
    const metadata = speakerMetadataRef.current;
    
    console.log(`[processRecording] Called with callId: ${callId}`);
    console.log(`[processRecording] isRecording: ${isRecording}`);
    console.log(`[processRecording] Audio chunks: ${chunks.length}`);
    console.log(`[processRecording] Speaker metadata turns: ${metadata.length}`);
    
    if (chunks.length === 0) {
      console.warn("[processRecording] No audio chunks to process");
      return null;
    }

    try {
      console.log("[processRecording] Processing recorded audio for transcription...");
      
      const audioBlob = assembleAudioBlob();
      if (!audioBlob) {
        throw new Error("Failed to assemble audio recording");
      }

      console.log(`[processRecording] Assembled audio blob: ${audioBlob.size} bytes`);

      const speakerMetadata = [...metadata];
      
      // Step 1: Get signed upload URL
      console.log("[processRecording] Getting signed upload URL...");
      const uploadUrlResponse = await fetch('/api/audio/generate-upload-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error(`Failed to get upload URL: ${errorData.error || uploadUrlResponse.statusText}`);
      }

      const { signedUrl, recordingId } = await uploadUrlResponse.json();
      console.log(`[processRecording] Got signed upload URL for recording ${recordingId}`);

      // Step 2: Upload audio file to GCS using signed URL
      console.log("[processRecording] Uploading audio to GCS...");
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload audio: ${uploadResponse.statusText}`);
      }

      console.log("[processRecording] Audio uploaded successfully, triggering transcription...");

      // Step 3: Trigger transcription with speaker metadata
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          callId,
          speaker_metadata: speakerMetadata.length > 0 ? speakerMetadata : null
        }),
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({}));
        throw new Error(`Transcription failed: ${errorData.error || transcribeResponse.statusText}`);
      }

      const result = await transcribeResponse.json();
      console.log("[processRecording] Audio processing completed:", result);
      
      // Clear recording data
      audioChunksRef.current = [];
      speakerMetadataRef.current = [];
      
      return result;
    } catch (error) {
      console.error("[processRecording] Error processing recording:", error);
      throw error;
    }
  }, [assembleAudioBlob]); // Removed isRecording dependency

  const startConversation = useCallback(async (
    userName: string,
    systemPrompt: string,
  ) => {
    try {
      setError(null);
      
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error("Microphone permission denied");
      }
      
      const signedUrl = await getSignedUrl();
      const id = await conversation.startSession({ 
        signedUrl,
        dynamicVariables: {
          user_name: userName,
          system_prompt: systemPrompt,
        }
      });
      setConversationId(id);
      
      console.log("Conversation started with ID:", id);
      return id;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to start conversation";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      setConversationId(null);
    } catch (err: any) {
      console.error("Error stopping conversation:", err);
      setError(err.message || "Failed to stop conversation");
    }
  }, [conversation]);

  return {
    // Status
    status: conversation.status,
    isConnected: conversation.status === "connected",
    isSpeaking: conversation.isSpeaking || false,
    conversationId,
    error,
    
    // Recording status
    isRecording,
    
    // Actions
    startConversation,
    stopConversation,
    processRecording,
    
    // Raw conversation object for advanced usage
    conversation,
  };
}

// Helper function to create WAV file header
function createWavFile(audioData: Int16Array, sampleRate: number): ArrayBuffer {
  const length = audioData.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);

  // WAV file header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);

  // Write audio data
  const offset = 44;
  for (let i = 0; i < length; i++) {
    view.setInt16(offset + i * 2, audioData[i], true);
  }

  return arrayBuffer;
} 