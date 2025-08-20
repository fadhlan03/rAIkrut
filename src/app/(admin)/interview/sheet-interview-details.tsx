"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { InterviewData } from "./data-interview";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applicationStatusEnum } from "@/db/schema";

import { TranscriptTab } from "./transcript-tab";
import { VerificationTab } from "./verification-tab";
import { toast } from "sonner";

interface InterviewDetailsSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  interviewData: InterviewData | null;
  onDataUpdate: () => void; // New prop for data refresh
}

const applicationStatuses = applicationStatusEnum.enumValues;

interface QAItem {
  question: string;
  answer: string;
  star_evaluation?: {
    score: number;
    rationale: string;
    situation_present: boolean;
    task_present: boolean;
    action_present: boolean;
    result_present: boolean;
  };
}

function StarEvaluationCard({ starEval }: { starEval: QAItem['star_evaluation'] }) {
  if (!starEval) return null;

  const getStarScoreColor = (score: number) => {
    if (score >= 4) return "bg-accent text-accent-foreground border-border";
    if (score >= 3) return "bg-secondary text-secondary-foreground border-border";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const getComponentColor = (present: boolean) => {
    return present ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive";
  };

  return (
    <div className="mt-3 p-3 border border-border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">STAR Method Evaluation</span>
        <Badge variant="outline" className={cn("text-xs", getStarScoreColor(starEval.score))}>
          {starEval.score}/5
        </Badge>
      </div>

      {/* STAR Components */}
      <div className="grid grid-cols-4 gap-1 mb-2">
        <Badge variant="outline" className={cn("text-xs justify-center", getComponentColor(starEval.situation_present))}>
          S: {starEval.situation_present ? "✓" : "✗"}
        </Badge>
        <Badge variant="outline" className={cn("text-xs justify-center", getComponentColor(starEval.task_present))}>
          T: {starEval.task_present ? "✓" : "✗"}
        </Badge>
        <Badge variant="outline" className={cn("text-xs justify-center", getComponentColor(starEval.action_present))}>
          A: {starEval.action_present ? "✓" : "✗"}
        </Badge>
        <Badge variant="outline" className={cn("text-xs justify-center", getComponentColor(starEval.result_present))}>
          R: {starEval.result_present ? "✓" : "✗"}
        </Badge>
      </div>

      {/* Rationale */}
      <p className="text-xs text-muted-foreground leading-relaxed">{starEval.rationale}</p>
    </div>
  );
}

function ScoreCard({ title, score, rationale, isLegacyRecord }: { title: string; score: number; rationale?: string | null; isLegacyRecord?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number, isLegacy?: boolean) => {
    if (isLegacy) return "bg-muted text-muted-foreground border-border"; // Special styling for legacy records
    if (score >= 4) return "bg-secondary text-secondary-foreground border-border";
    if (score >= 3) return "bg-accent text-accent-foreground border-border";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const handleToggle = () => {
    if (rationale) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        rationale && "cursor-pointer hover:bg-muted/30 transition-colors"
      )}
      onClick={handleToggle}
    >
      <div className="flex items-center justify-between p-4">
        <h4 className="font-medium">{title}</h4>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("font-mono", getScoreColor(score, isLegacyRecord))}>
            {isLegacyRecord ? "N/A" : `${score}/5`}
          </Badge>
          {rationale && (
            <div className="h-6 w-6 flex items-center justify-center">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          )}
        </div>
      </div>
      {rationale && isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <p className={cn(
            "text-sm border-t pt-3",
            isLegacyRecord ? "text-muted-foreground italic" : "text-muted-foreground"
          )}>
            {rationale}
          </p>
        </div>
      )}
    </div>
  );
}



export function InterviewDetailsSheet({
  isOpen,
  onOpenChange,
  interviewData,
  onDataUpdate, // Destructure the new prop
}: InterviewDetailsSheetProps) {
  // ElevenLabs data state - moved from TranscriptTab to persist across tab switches
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [elevenLabsAudioUrl, setElevenLabsAudioUrl] = useState<string | null>(null);
  const [isLoadingElevenLabsAudio, setIsLoadingElevenLabsAudio] = useState(false);
  const [elevenLabsAudioError, setElevenLabsAudioError] = useState<string | null>(null);
  const [elevenLabsTranscript, setElevenLabsTranscript] = useState<any>(null);
  const [isLoadingElevenLabsTranscript, setIsLoadingElevenLabsTranscript] = useState(false);
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null);

  // Auto-analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStep, setBackupStep] = useState<string>("");
  const [needsRetry, setNeedsRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Updated interview data state
  const [updatedInterviewData, setUpdatedInterviewData] = useState<InterviewData | null>(null);

  // Function to fetch audio from ElevenLabs
  const fetchElevenLabsAudio = async (conversationId: string) => {
    try {
      setIsLoadingElevenLabsAudio(true);
      setElevenLabsAudioError(null);
      console.log('Fetching ElevenLabs audio for conversation:', conversationId);

      const response = await fetch(`/api/elevenlabs/conversations/${conversationId}/audio`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ElevenLabs audio: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.audio) {
        // Convert base64 audio to blob URL (similar to TranscriptViewer implementation)
        const base64ToBlob = (base64: string, mimeType: string): Blob => {
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
        };

        const audioBlob = base64ToBlob(data.audio, data.contentType || 'audio/mp3');
        const url = URL.createObjectURL(audioBlob);
        setElevenLabsAudioUrl(url);
        console.log('ElevenLabs audio loaded successfully');

        // Cleanup function to revoke URL when component unmounts
        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        throw new Error('No audio data received from ElevenLabs');
      }
    } catch (error) {
      console.error('Error fetching ElevenLabs audio:', error);
      setElevenLabsAudioError(error instanceof Error ? error.message : 'Failed to load ElevenLabs audio');
    } finally {
      setIsLoadingElevenLabsAudio(false);
    }
  };

  // Function to fetch transcript from ElevenLabs
  const fetchElevenLabsTranscript = async (conversationId: string, retryCount = 0) => {
    const maxRetries = 2;
    const retryDelay = 3000; // 3 seconds

    try {
      setIsLoadingElevenLabsTranscript(true);
      setElevenLabsError(null);
      console.log(`Fetching ElevenLabs transcript for conversation: ${conversationId} (attempt ${retryCount + 1})`);

      const response = await fetch(`/api/elevenlabs/conversations/${conversationId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("ElevenLabs error response:", errorData);

        // If it's a 404 and we haven't exceeded max retries, try again
        if (response.status === 404 && retryCount < maxRetries) {
          console.log(`ElevenLabs conversation not found yet, retrying in ${retryDelay / 1000} seconds...`);
          setNeedsRetry(true);
          setRetryCount(retryCount + 1);
          setTimeout(() => {
            fetchElevenLabsTranscript(conversationId, retryCount + 1);
          }, retryDelay);
          return;
        }

        throw new Error(`Failed to fetch ElevenLabs transcript: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("ElevenLabs conversation data:", data);

      if (data.transcript && Array.isArray(data.transcript)) {
        console.log("ElevenLabs transcript found:", data.transcript.length, "entries");
        setElevenLabsTranscript(data.transcript);
        setNeedsRetry(false);
        setRetryCount(0);
        
        // Trigger auto-analysis if no report exists
        const currentData = updatedInterviewData || interviewData;
        if (currentData && !currentData.hasReport) {
          console.log("No report found, triggering auto-analysis...");
          await performAutoAnalysis(conversationId, data.transcript);
        }
      } else if (data.status && data.status !== 'done' && retryCount < maxRetries) {
        // Conversation is still processing
        console.log(`ElevenLabs conversation status: ${data.status}, retrying in ${retryDelay / 1000} seconds...`);
        setNeedsRetry(true);
        setRetryCount(retryCount + 1);
        setTimeout(() => {
          fetchElevenLabsTranscript(conversationId, retryCount + 1);
        }, retryDelay);
        return;
      } else {
        console.log("No ElevenLabs transcript found or not ready yet");
        setElevenLabsError("ElevenLabs transcript not available or still processing");
        setNeedsRetry(true);
      }
    } catch (error) {
      console.error("Error fetching ElevenLabs transcript:", error);
      if (retryCount < maxRetries) {
        console.log(`Retrying ElevenLabs transcript in ${retryDelay / 1000} seconds...`);
        setNeedsRetry(true);
        setRetryCount(retryCount + 1);
        setTimeout(() => {
          fetchElevenLabsTranscript(conversationId, retryCount + 1);
        }, retryDelay);
      } else {
        setElevenLabsError(error instanceof Error ? error.message : 'Failed to fetch ElevenLabs transcript');
        setNeedsRetry(true);
      }
    } finally {
      if (retryCount === maxRetries || retryCount === 0) {
        setIsLoadingElevenLabsTranscript(false);
      }
    }
  };

  // Function to backup transcript to database
  const backupTranscriptToDatabase = async (callId: string, transcript: any) => {
    try {
      setBackupStep("Backing up transcript to database...");
      
      // Convert ElevenLabs transcript format to our database format
      const formattedTranscript = transcript.map((entry: any) => ({
        speaker: entry.role === 'user' ? 'User' : 'AI',
        text: entry.message || entry.text || entry.content || '',
        timestamp: (entry.time_in_call_secs ?? entry.timestamp ?? entry.time ?? entry.start_time ?? 0) * 1000 // Convert to milliseconds
      }));

      const response = await fetch('/api/recordings/backup-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          callId, 
          transcript: formattedTranscript 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to backup transcript: ${response.statusText}`);
      }

      console.log("Successfully backed up transcript to database");
    } catch (error) {
      console.error("Error backing up transcript:", error);
      throw error;
    }
  };

  // Function to backup recording to GCP storage
  const backupRecordingToStorage = async (conversationId: string, callId: string) => {
    try {
      setBackupStep("Backing up recording to storage...");
      
      const response = await fetch('/api/recordings/backup-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          conversationId, 
          callId 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to backup recording: ${response.statusText}`);
      }

      console.log("Successfully backed up recording to storage");
    } catch (error) {
      console.error("Error backing up recording:", error);
      throw error;
    }
  };

  // Function to perform automatic analysis
  const performAutoAnalysis = async (conversationId: string, transcript: any) => {
    if (isAnalyzing) return; // Prevent duplicate analysis
    
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setAnalysisStep("Starting analysis...");
      
      const currentData = updatedInterviewData || interviewData;
      if (!currentData) {
        throw new Error("No interview data available");
      }

      // Step 1: Backup transcript to database (only if not already exists)
      if (!currentData.recordingTranscript) {
        setAnalysisStep("Backing up transcript...");
        await backupTranscriptToDatabase(currentData.callId, transcript);
      } else {
        console.log("Transcript already exists in database, skipping backup");
      }

      // Step 2: Backup recording to storage (in parallel, only if not already exists)
      if (!currentData.recordingUri) {
        setIsBackingUp(true);
        backupRecordingToStorage(conversationId, currentData.callId).catch(error => {
          console.error("Recording backup failed (non-critical):", error);
        }).finally(() => {
          setIsBackingUp(false);
          setBackupStep("");
        });
      } else {
        console.log("Recording already exists in storage, skipping backup");
      }

      // Step 3: Trigger analysis
      setAnalysisStep("Sending transcript for analysis...");
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: currentData.callId }),
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed: ${analysisResponse.statusText}`);
      }

      const analysisResult = await analysisResponse.json();
      console.log("Analysis completed successfully:", analysisResult);

      // Step 4: Refresh interview data to get updated analysis
      setAnalysisStep("Refreshing data...");
      await refreshInterviewData();
      
      setAnalysisStep("Analysis completed successfully!");
      setTimeout(() => setAnalysisStep(""), 3000);

    } catch (error) {
      console.error("Auto-analysis failed:", error);
      setAnalysisError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to refresh interview data
  const refreshInterviewData = async () => {
    if (!interviewData) return;
    
    try {
      const response = await fetch('/api/interview');
      if (response.ok) {
        const allInterviews = await response.json();
        const updatedInterview = allInterviews.find((interview: InterviewData) => 
          interview.callId === interviewData.callId
        );
        if (updatedInterview) {
          setUpdatedInterviewData(updatedInterview);
          onDataUpdate(); // Call the new prop to notify parent of update
        }
      }
    } catch (error) {
      console.error("Failed to refresh interview data:", error);
    }
  };

  // Function to manually retry transcript fetch
  const handleRetry = () => {
    if (interviewData?.conversationId) {
      setNeedsRetry(false);
      setRetryCount(0);
      setElevenLabsError(null);
      fetchElevenLabsTranscript(interviewData.conversationId);
    }
  };

  useEffect(() => {
    if (interviewData?.recordingUri) {
      // Generate presigned URL for audio
      fetch('/api/recordings/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: interviewData.recordingUri })
      })
        .then(res => res.json())
        .then(data => setAudioUrl(data.url))
        .catch(err => console.error('Failed to get audio URL:', err));
    }
  }, [interviewData]);

  // Effect to fetch ElevenLabs data (audio and transcript) when sheet opens
  useEffect(() => {
    if (isOpen && interviewData?.conversationId) {
      console.log('Sheet opened with conversationId:', interviewData.conversationId);
      // Reset state before fetching
      setElevenLabsTranscript(null);
      setElevenLabsError(null);
      setElevenLabsAudioUrl(null);
      setElevenLabsAudioError(null);

      // Fetch both transcript and audio
      fetchElevenLabsTranscript(interviewData.conversationId);
      fetchElevenLabsAudio(interviewData.conversationId);
    } else if (isOpen && !interviewData?.conversationId) {
      console.log('Sheet opened but no conversationId available');
      // Clear ElevenLabs data and set error states
      setElevenLabsTranscript(null);
      setElevenLabsError('No ElevenLabs conversation ID available');
      setElevenLabsAudioUrl(null);
      setElevenLabsAudioError('No ElevenLabs conversation ID available');
    }
  }, [isOpen, interviewData?.conversationId]);

  const [currentStatus, setCurrentStatus] = useState<string>('');

  useEffect(() => {
    if (interviewData?.applicationStatus) {
      setCurrentStatus(interviewData.applicationStatus);
    }
  }, [interviewData?.applicationStatus]);

  if (!interviewData) {
    return null;
  }

  // Use updated interview data if available
  const currentInterviewData = updatedInterviewData || interviewData;

  const handleStatusChange = async (newStatus: string) => {
    if (!currentInterviewData) return;

    try {
      const response = await fetch(`/api/applications/${currentInterviewData.applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: currentInterviewData.applicationId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`);
      }

      setCurrentStatus(newStatus);
      onDataUpdate(); // Notify parent to refresh data
      toast.success(`Application status updated to ${newStatus}`);
      console.log(`Application status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating application status:', error);
      // Optionally show a toast or error message to the user
    }
  };

  // Parse Q&A data from reports answers
  let qaData: QAItem[] = [];
  if (currentInterviewData.reportAnswers) {
    try {
      const answers = typeof currentInterviewData.reportAnswers === 'string'
        ? JSON.parse(currentInterviewData.reportAnswers)
        : currentInterviewData.reportAnswers;
      qaData = Array.isArray(answers) ? answers : [];
    } catch (err) {
      console.error('Failed to parse Q&A data:', err);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[700px] sm:max-w-none px-6">
        <SheetHeader className="px-0">
          <SheetTitle className="text-xl">Pre-Interview Details</SheetTitle>
          <SheetDescription>
            Detailed Pre-Interview Report and Scoring Breakdown
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="scoring" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scoring">Scoring & Analysis</TabsTrigger>
            <TabsTrigger value="qna">Q&A Summary</TabsTrigger>
            <TabsTrigger value="transcript">Transcript & Recording</TabsTrigger>
            {/* <TabsTrigger value="verification">Verification</TabsTrigger> */}
          </TabsList>

          <ScrollArea className="h-[calc(100vh-200px)] mt-4">
            <TabsContent value="scoring" className="mt-0 pb-4">
              <div className="space-y-6 px-1">

                {/* Analysis Progress */}
                {(isAnalyzing || analysisStep) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Analysis in Progress</h3>
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-primary">{analysisStep || "Processing..."}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analysis Error */}
                {analysisError && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Analysis Error</h3>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <div className="text-destructive">{analysisError}</div>
                      {needsRetry && (
                        <Button 
                          onClick={handleRetry}
                          size="sm"
                          variant="destructive"
                          className="mt-2"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Retry Analysis
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Backup Progress */}
                {(isBackingUp || backupStep) && (
                  <div className="space-y-4">
                    <div className="bg-accent border border-border rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-accent-foreground text-sm">{backupStep || "Backing up data..."}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Overall Score */}
                {currentInterviewData.averageScore !== null && (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Overall Performance</h3>
                      <div className="text-center p-6 bg-muted/30 rounded-lg">
                        <div className="text-3xl font-bold mb-2">
                          {currentInterviewData.averageScore.toFixed(1)}/5
                        </div>
                        <div className="text-sm text-muted-foreground">Average Score</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Individual Scores */}
                {currentInterviewData.individualScores && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Detailed Scoring</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <ScoreCard
                          title="STAR Method"
                          score={currentInterviewData.individualScores.star_method.score}
                          rationale={currentInterviewData.individualScores.star_method.rationale}
                          isLegacyRecord={currentInterviewData.individualScores.star_method.score === 0 &&
                            currentInterviewData.individualScores.star_method.rationale?.includes("legacy record")}
                        />
                        <ScoreCard
                          title="Clarity"
                          score={currentInterviewData.individualScores.clarity.score}
                          rationale={currentInterviewData.individualScores.clarity.rationale}
                        />
                        <ScoreCard
                          title="Relevance"
                          score={currentInterviewData.individualScores.relevance.score}
                          rationale={currentInterviewData.individualScores.relevance.rationale}
                        />
                        <ScoreCard
                          title="Depth"
                          score={currentInterviewData.individualScores.depth.score}
                          rationale={currentInterviewData.individualScores.depth.rationale}
                        />
                        <ScoreCard
                          title="Communication Style"
                          score={currentInterviewData.individualScores.communication_style.score}
                          rationale={currentInterviewData.individualScores.communication_style.rationale}
                        />
                        <ScoreCard
                          title="Cultural Fit"
                          score={currentInterviewData.individualScores.cultural_fit.score}
                          rationale={currentInterviewData.individualScores.cultural_fit.rationale}
                        />
                        <ScoreCard
                          title="Attention to Detail"
                          score={currentInterviewData.individualScores.attention_to_detail.score}
                          rationale={currentInterviewData.individualScores.attention_to_detail.rationale}
                        />
                        <ScoreCard
                          title="Language Proficiency"
                          score={currentInterviewData.individualScores.language_proficiency.score}
                          rationale={currentInterviewData.individualScores.language_proficiency.rationale}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* No Report Message */}
                {!currentInterviewData.hasReport && !isAnalyzing && !analysisError && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Report Status</h3>
                    <div className="text-center p-6 bg-muted/30 rounded-lg">
                      <div className="text-lg text-muted-foreground mb-2">No Analysis Report Available</div>
                      <div className="text-sm text-muted-foreground">
                        {currentInterviewData.conversationId 
                          ? "The analysis will start automatically when transcript is ready."
                          : "The interview call has been recorded but analysis report has not been generated yet."
                        }
                      </div>
                      {needsRetry && (
                        <Button 
                          onClick={handleRetry}
                          size="sm"
                          className="mt-3"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Retry Now
                        </Button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </TabsContent>

            <TabsContent value="qna" className="mt-0 pb-4">
              <div className="space-y-6 px-1">

                {/* Question-Answer Pairs */}
                {qaData.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Interview Q&A</h3>
                    <div className="space-y-6">
                      {qaData.map((qa: QAItem, index: number) => (
                        <div key={index} className="space-y-3">
                          <div className="border border-border rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                Q{index + 1}
                              </div>
                              <div className="flex-1 text-sm font-medium text-foreground">
                                {qa.question}
                              </div>
                            </div>
                          </div>
                          <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                A
                              </div>
                              <div className="flex-1 text-sm text-secondary leading-relaxed">
                                {qa.answer}
                              </div>
                            </div>
                          </div>
                          {qa.star_evaluation && <StarEvaluationCard starEval={qa.star_evaluation} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show message only if no Q&A available */}
                {qaData.length === 0 && (
                  <div className="text-center p-6 bg-muted/30 rounded-lg">
                    <div className="text-lg text-muted-foreground mb-2">No Q&A Available</div>
                    <div className="text-sm text-muted-foreground">
                      The interview Q&A has not been processed yet or is not available.
                    </div>
                  </div>
                )}

              </div>
            </TabsContent>

            <TabsContent value="transcript" className="mt-0 pb-4">
              <TranscriptTab 
                interviewData={currentInterviewData} 
                audioUrl={audioUrl}
                elevenLabsAudioUrl={elevenLabsAudioUrl}
                isLoadingElevenLabsAudio={isLoadingElevenLabsAudio}
                elevenLabsAudioError={elevenLabsAudioError}
                elevenLabsTranscript={elevenLabsTranscript}
                isLoadingElevenLabsTranscript={isLoadingElevenLabsTranscript}
                elevenLabsError={elevenLabsError}
                needsRetry={needsRetry}
                onRetry={handleRetry}
                retryCount={retryCount}
              />
            </TabsContent>

            <TabsContent value="verification" className="mt-0 pb-4">
              <VerificationTab interviewData={currentInterviewData} />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <SheetFooter className="fixed bottom-0 w-full bg-background p-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <label htmlFor="status-select" className="text-sm font-medium">Set Application Status:</label>
              <Select value={currentStatus} onValueChange={handleStatusChange}>
                <SelectTrigger id="status-select" className="w-[180px]">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {applicationStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Optional: Add action buttons here */}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}