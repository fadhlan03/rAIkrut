"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { InterviewData } from "./data-interview";
import { highlightSwearWords, containsSwearWords } from "@/lib/swear-words";

interface TranscriptTabProps {
  interviewData: InterviewData;
  audioUrl: string | null;
  elevenLabsAudioUrl: string | null;
  isLoadingElevenLabsAudio: boolean;
  elevenLabsAudioError: string | null;
  elevenLabsTranscript: any;
  isLoadingElevenLabsTranscript: boolean;
  elevenLabsError: string | null;
  needsRetry?: boolean;
  onRetry?: () => void;
  retryCount?: number;
}

export function TranscriptTab({ 
  interviewData, 
  audioUrl,
  elevenLabsAudioUrl,
  isLoadingElevenLabsAudio,
  elevenLabsAudioError,
  elevenLabsTranscript,
  isLoadingElevenLabsTranscript,
  elevenLabsError,
  needsRetry = false,
  onRetry,
  retryCount = 0
}: TranscriptTabProps) {



  // Helper function to render ElevenLabs transcript as conversation bubbles
  const renderElevenLabsTranscript = (transcript: any[]) => {
    if (!Array.isArray(transcript) || transcript.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3 p-4">
        {transcript.map((entry: any, index: number) => {
          const timeValue = entry.time_in_call_secs ?? entry.timestamp ?? entry.time ?? entry.start_time ?? 0;
          const message = entry.message || entry.text || entry.content || '';
          const timeFormatted = timeValue > 0 ? `${Math.floor(timeValue / 60)}:${(timeValue % 60).toString().padStart(2, '0')}` : '';

          const isCandidate = entry.role === 'user';

          return (
            <div key={index} className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-2 max-w-[75%] ${isCandidate ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${isCandidate
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
                  }`}>
                  {isCandidate ? 'C' : 'AI'}
                </div>

                {/* Message bubble */}
                <div className={`relative px-4 py-3 rounded-2xl ${isCandidate
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-muted-foreground rounded-bl-md'
                  }`}>
                  {/* Message content */}
                  <div className="text-sm leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: highlightSwearWords(message) }} />
                  </div>

                  {/* Timestamp */}
                  {timeFormatted && (
                    <div className={`text-xs mt-1 opacity-70`}>
                      {timeFormatted}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Determine which transcript to show - prioritize ElevenLabs
  let displayTranscript = null;
  let transcriptSource = '';
  let hasSwearWords = false;

  // If we have a conversationId but are still loading ElevenLabs transcript, don't show database transcript yet
  const shouldWaitForElevenLabs = interviewData?.conversationId && isLoadingElevenLabsTranscript && !elevenLabsError;

  if (elevenLabsTranscript && Array.isArray(elevenLabsTranscript) && elevenLabsTranscript.length > 0) {
    // Use ElevenLabs transcript - will be rendered as bubbles
    displayTranscript = 'ELEVENLABS_BUBBLES'; // Special flag for bubble rendering
    transcriptSource = 'ElevenLabs';

    // Check for swear words in ElevenLabs transcript
    hasSwearWords = elevenLabsTranscript.some((entry: any) => {
      const message = entry.message || entry.text || entry.content || '';
      return typeof message === 'string' && containsSwearWords(message);
    });
  } else if (interviewData.recordingTranscript && !shouldWaitForElevenLabs) {
    // Fallback to database transcript
    transcriptSource = 'Database';
    try {
      const transcript = typeof interviewData.recordingTranscript === 'string'
        ? JSON.parse(interviewData.recordingTranscript)
        : interviewData.recordingTranscript;

      // Check for swear words in database transcript
      if (Array.isArray(transcript)) {
        hasSwearWords = transcript.some((segment: any) => {
          const text = segment.text || segment.content || segment;
          return typeof text === 'string' && containsSwearWords(text);
        });
      } else if (typeof transcript === 'object' && transcript.text) {
        hasSwearWords = containsSwearWords(transcript.text);
      } else if (typeof transcript === 'string') {
        hasSwearWords = containsSwearWords(transcript);
      }

      // Format database transcript using existing function
      const formatTranscriptText = (text: string) => {
        let cleanedText = text.replace(/\d+\s+(User|Assistant|Interviewer|Candidate):\s*/gi, '');
        const sentences = cleanedText.split(/\. /).filter(sentence => sentence.trim().length > 0);
        return sentences.map((sentence, index) => {
          const formattedSentence = sentence.trim();
          const needsPeriod = index < sentences.length - 1 &&
            !formattedSentence.match(/[.!?]$/);
          return formattedSentence + (needsPeriod ? '.' : '');
        }).join('\n\n');
      };

      if (Array.isArray(transcript)) {
        displayTranscript = transcript.map((segment: any) => {
          const text = segment.text || segment.content || segment;
          return typeof text === 'string' ? formatTranscriptText(text) : String(text);
        }).join('\n\n---\n\n');
      } else if (typeof transcript === 'object' && transcript.text) {
        displayTranscript = formatTranscriptText(transcript.text);
      } else if (typeof transcript === 'string') {
        displayTranscript = formatTranscriptText(transcript);
      } else {
        displayTranscript = JSON.stringify(transcript, null, 2);
      }
    } catch (error) {
      const rawText = String(interviewData.recordingTranscript);
      hasSwearWords = containsSwearWords(rawText);
      displayTranscript = rawText.replace(/\d+\s+(User|Assistant|Interviewer|Candidate):\s*/gi, '')
        .split(/\. /)
        .filter(sentence => sentence.trim().length > 0)
        .map((sentence, index, array) => {
          const trimmed = sentence.trim();
          const needsPeriod = index < array.length - 1 && !trimmed.match(/[.!?]$/);
          return trimmed + (needsPeriod ? '.' : '');
        })
        .join('\n\n');
    }
  }

  if (displayTranscript) {
    return (
      <div className="space-y-6 px-1">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Interview Transcript</h3>
              {isLoadingElevenLabsTranscript && transcriptSource === 'Database' && (
                <Badge variant="secondary" className="text-xs">
                  Loading ElevenLabs...
                </Badge>
              )}
            </div>
            {hasSwearWords && (
              <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Language Alert
              </Badge>
            )}
          </div>

          <div className="bg-muted/30 rounded-lg p-4 max-h-[600px] overflow-y-auto">
            {displayTranscript === 'ELEVENLABS_BUBBLES' ? (
              renderElevenLabsTranscript(elevenLabsTranscript)
            ) : (
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                <span dangerouslySetInnerHTML={{ __html: highlightSwearWords(displayTranscript) }} />
              </div>
            )}
          </div>

          {/* Audio Player */}
          {(() => {
            // Determine which audio to show - prioritize ElevenLabs
            const hasElevenLabsAudio = elevenLabsAudioUrl && !elevenLabsAudioError;
            const hasStorageAudio = audioUrl;
            const audioSource = hasElevenLabsAudio ? 'ElevenLabs' : hasStorageAudio ? 'Storage' : null;
            const currentAudioUrl = hasElevenLabsAudio ? elevenLabsAudioUrl : audioUrl;
            const hasAnyAudio = currentAudioUrl || isLoadingElevenLabsAudio;

            if (currentAudioUrl) {
              return (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Audio Recording</h3>
                      {isLoadingElevenLabsAudio && audioSource === 'Storage' && (
                        <Badge variant="secondary" className="text-xs">
                          Loading...
                        </Badge>
                      )}
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4">
                      <audio controls className="w-full">
                        <source src={currentAudioUrl} type="audio/wav" />
                        <source src={currentAudioUrl} type="audio/mpeg" />
                        <source src={currentAudioUrl} type="audio/mp3" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  </div>
                </>
              );
            } else if (isLoadingElevenLabsAudio) {
              return (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Audio Recording</h3>
                    <div className="text-center p-6 bg-muted/30 rounded-lg">
                      <div className="text-lg text-muted-foreground mb-2">Loading Audio...</div>
                      <div className="text-sm text-muted-foreground">
                        Fetching audio...
                      </div>
                    </div>
                  </div>
                </>
              );
            }
            return null;
          })()}
        </div>
      </div>
    );
  } else if (isLoadingElevenLabsTranscript || shouldWaitForElevenLabs) {
    return (
      <div className="space-y-6 px-1">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Interview Transcript</h3>
          <div className="text-center p-6 bg-muted/30 rounded-lg">
            {/* <div className="text-lg text-muted-foreground mb-2">Loading Transcript...</div> */}
            <div className="text-sm text-muted-foreground">
              Loading transcript...
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="space-y-6 px-1">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Interview Transcript</h3>
          <div className="text-center p-6 bg-muted/30 rounded-lg">
            <div className="text-lg text-muted-foreground mb-2">No Transcript Available</div>
            <div className="text-sm text-muted-foreground mb-4">
              {elevenLabsError ? `Error: ${elevenLabsError}` : 'The interview transcript has not been processed yet or is not available.'}
            </div>
            {needsRetry && onRetry && (
              <div className="space-y-2">
                {retryCount > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Retry attempt: {retryCount}
                  </div>
                )}
                <Button 
                  onClick={onRetry}
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry Now
                </Button>
                <div className="text-xs text-muted-foreground mt-2">
                  The server may need a few moments to process the conversation
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
