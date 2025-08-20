"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, User, Bot, Play, Pause, Volume2, Download, Calendar, Timer } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface TranscriptEntry {
  role: "user" | "assistant";
  time_in_call_secs?: number;
  message: string;
  // ElevenLabs might use different field names
  timestamp?: number;
  time?: number;
  start_time?: number;
}

interface ConversationMetadata {
  start_time_unix_secs?: number;
  end_time_unix_secs?: number;
  call_duration_secs?: number;
  status?: string;
  cost?: number;
  [key: string]: any;
}

interface ConversationData {
  transcript?: TranscriptEntry[];
  metadata?: ConversationMetadata;
  full_audio?: string; // base64 encoded audio
  conversation_id?: string;
  status?: string;
  agent_id?: string;
  [key: string]: any;
}

interface TranscriptViewerProps {
  transcript: TranscriptEntry[];
  conversationId: string;
  conversationData?: ConversationData;
}

function getTimeFromEntry(entry: TranscriptEntry): number {
  // Try different possible time field names
  return entry.time_in_call_secs ?? 
         entry.timestamp ?? 
         entry.time ?? 
         entry.start_time ?? 
         0;
}

function formatTime(timeInSeconds: number | undefined | null): string {
  // Handle undefined, null, or NaN values
  if (timeInSeconds === undefined || timeInSeconds === null || isNaN(timeInSeconds)) {
    return "0:00";
  }
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateTime(unixSeconds: number | undefined): string {
  if (!unixSeconds) return "Unknown";
  return new Date(unixSeconds * 1000).toLocaleString();
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays: Uint8Array[] = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: mimeType });
}

function AudioPlayer({ audioBase64, conversationId }: { audioBase64?: string; conversationId: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (audioBase64) {
      // Use provided base64 audio
      try {
        const audioBlob = base64ToBlob(audioBase64, 'audio/mp3');
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error creating audio blob:', error);
        setAudioError('Failed to process audio data');
      }
    } else {
      // Fetch audio from separate endpoint
      const fetchAudio = async () => {
        setIsLoadingAudio(true);
        setAudioError(null);
        
        try {
          console.log('Fetching audio for conversation:', conversationId);
          const response = await fetch(`/api/elevenlabs/conversations/${conversationId}/audio`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.audio) {
            const audioBlob = base64ToBlob(data.audio, data.contentType || 'audio/mp3');
            const url = URL.createObjectURL(audioBlob);
            setAudioUrl(url);
            console.log('Audio loaded successfully');
          } else {
            throw new Error('No audio data received');
          }
        } catch (error) {
          console.error('Error fetching audio:', error);
          setAudioError(error instanceof Error ? error.message : 'Failed to load audio');
        } finally {
          setIsLoadingAudio(false);
        }
      };

      fetchAudio();
    }
  }, [audioBase64, conversationId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = (value[0] / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newVolume = value[0] / 100;
    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'conversation-recording.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (isLoadingAudio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Audio Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-muted-foreground">Loading audio...</p>
        </CardContent>
      </Card>
    );
  }

  if (audioError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Audio Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-red-500">Error loading audio: {audioError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!audioUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Audio Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-muted-foreground">No audio available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Audio Recording
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
            onValueChange={handleSeek}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={togglePlayPause}
            disabled={!audioUrl}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {/* Volume Control */}
          <div className="flex items-center gap-2 flex-1">
            <Volume2 className="h-4 w-4" />
            <Slider
              value={[volume * 100]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1 max-w-24"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadAudio}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TranscriptViewer({ transcript, conversationId, conversationData }: TranscriptViewerProps) {
  // Debug: Log the actual conversation structure
  console.log("TranscriptViewer received conversation data:", conversationData);
  console.log("TranscriptViewer received transcript:", transcript);
  if (transcript && transcript.length > 0) {
    console.log("First transcript entry structure:", JSON.stringify(transcript[0], null, 2));
    console.log("All available fields in first entry:", Object.keys(transcript[0]));
  }

  const metadata = conversationData?.metadata;
  const hasAudio = conversationData?.full_audio || conversationData?.hasAudio;

  if (!transcript || transcript.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Audio Player */}
        {hasAudio && (
          <AudioPlayer 
            audioBase64={conversationData?.full_audio} 
            conversationId={conversationId}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Conversation Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No transcript available for this conversation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Audio Player */}
      {hasAudio && (
        <AudioPlayer 
          audioBase64={conversationData?.full_audio} 
          conversationId={conversationId}
        />
      )}

      {/* Conversation Metadata */}
      {(metadata || conversationData) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Conversation Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{conversationId}</Badge>
                  <span className="text-sm text-muted-foreground">Conversation ID</span>
                </div>
                {metadata?.start_time_unix_secs && (
                  <div className="text-sm">
                    <strong>Start Time:</strong> {formatDateTime(metadata.start_time_unix_secs)}
                  </div>
                )}
                {metadata?.end_time_unix_secs && (
                  <div className="text-sm">
                    <strong>End Time:</strong> {formatDateTime(metadata.end_time_unix_secs)}
                  </div>
                )}
                {metadata?.call_duration_secs && (
                  <div className="text-sm flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    <strong>Duration:</strong> {formatTime(metadata.call_duration_secs)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {conversationData?.status && (
                  <div className="text-sm">
                    <strong>Status:</strong> 
                    <Badge variant={conversationData.status === 'done' ? 'default' : 'secondary'} className="ml-2">
                      {conversationData.status}
                    </Badge>
                  </div>
                )}
                {conversationData?.agent_id && (
                  <div className="text-sm">
                    <strong>Agent ID:</strong> {conversationData.agent_id}
                  </div>
                )}
                {metadata?.cost && (
                  <div className="text-sm">
                    <strong>Cost:</strong> ${metadata.cost.toFixed(4)}
                  </div>
                )}
                <div className="text-sm">
                  <strong>Messages:</strong> {transcript.length}
                </div>
              </div>
            </div>

            {/* Additional metadata fields */}
            {conversationData && (
              <div className="mt-4 pt-4 border-t">
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium mb-2">Raw Conversation Data</summary>
                  <pre className="bg-muted p-3 rounded-md overflow-auto text-xs">
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(conversationData).filter(([key]) => 
                          !['transcript', 'full_audio'].includes(key)
                        )
                      ), 
                      null, 
                      2
                    )}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Conversation Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="space-y-4">
              {transcript.map((entry, index) => {
                const timeValue = getTimeFromEntry(entry);
                const hasValidTime = timeValue > 0;
                
                return (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 min-w-fit">
                      <div className={`p-2 rounded-full ${
                        entry.role === "user" 
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                      }`}>
                        {entry.role === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {hasValidTime ? formatTime(timeValue) : `#${index + 1}`}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm capitalize">
                          {entry.role === "user" ? "User" : "Assistant"}
                        </span>
                      </div>
                      <div className="text-sm bg-muted/50 rounded-lg p-3">
                        {entry.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
