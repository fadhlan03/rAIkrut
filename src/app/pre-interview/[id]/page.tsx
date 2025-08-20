"use client"; 

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { LoaderCircle, FileText,Check, Mic, MicOff, Play, PhoneOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useElevenLabs } from "@/hooks/use-elevenlabs";
import AudioVisualizer from "@/components/call/AudioVisualizer";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export default function PreInterviewSimple() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;
  
  // ElevenLabs conversation
  const {
    status,
    isConnected,
    isSpeaking,
    conversationId,
    error,
    isRecording,
    startConversation,
    stopConversation,
    processRecording,
  } = useElevenLabs();

  // UI State
  const [actualCallId, setActualCallId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState<string>("Pre-Interview Call");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isNotesSheetOpen, setIsNotesSheetOpen] = useState(false);
  const [currentNotes, setCurrentNotes] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesAutoSaved, setNotesAutoSaved] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  
  // Camera functionality (video only, no audio conflict)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [isCameraStreaming, setIsCameraStreaming] = useState(false);

  // Call context details
  const [callContextDetails, setCallContextDetails] = useState<{
    candidateName: string | null;
    candidateEmail: string | null;
    candidatePhone: string | null;
    candidateBirthdate: string | null;
    candidateAge: string | null;
    candidateEducation: string | null;
    candidateWorkExperience: string | null;
    candidateJobInterest: string | null;
    candidateSummary: string | null;
    jobTitle: string | null;
    jobDescription: string | null;
    jobRequirements: string | null;
    jobDesc: string | null;
    applicationId: string | null;
    systemPrompt: string | null;
    resumeContent: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isConnected && !isProcessingRecording) {
      handleEndCall();
    }
  }, [isConnected]);

  // Start camera with video only (no audio to avoid conflict)
  const startCamera = useCallback(async () => {
    try {
      setIsCameraLoading(true);
      setCameraError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false // No audio to avoid conflict with ElevenLabs
      });
      
      setCameraStream(stream);
      setIsCameraStreaming(true);
      setIsCameraLoading(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to start camera:', error);
      setCameraError('Failed to access camera. Please check permissions.');
      setIsCameraLoading(false);
      setIsCameraStreaming(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraStreaming(false);
    }
  }, [cameraStream]);

  // Start camera when call is connected
  useEffect(() => {
    if (isConnected && !isCameraStreaming) {
        startCamera();
    }
  }, [isConnected, startCamera, isCameraStreaming]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Retrieve data from sessionStorage
  useEffect(() => {
    const storedApplicationId = sessionStorage.getItem('applicationId');
    const storedCandidateName = sessionStorage.getItem('candidateName');
    const storedCandidateEmail = sessionStorage.getItem('candidateEmail');
    const storedCandidatePhone = sessionStorage.getItem('candidatePhone');
    const storedCandidateBirthdate = sessionStorage.getItem('candidateBirthdate');
    const storedCandidateAge = sessionStorage.getItem('candidateAge');
    const storedCandidateEducation = sessionStorage.getItem('candidateEducation');
    const storedCandidateWorkExperience = sessionStorage.getItem('candidateWorkExperience');
    const storedCandidateJobInterest = sessionStorage.getItem('candidateJobInterest');
    const storedCandidateSummary = sessionStorage.getItem('candidateSummary');
    
    const storedJobTitle = sessionStorage.getItem('jobTitle');
    const storedJobDescription = sessionStorage.getItem('jobDescription');
    const storedJobRequirements = sessionStorage.getItem('jobRequirements');
    const storedJobDesc = sessionStorage.getItem('jobDesc');
    
    const storedSystemPrompt = sessionStorage.getItem('systemInstruction');
    const storedResumeContent = sessionStorage.getItem('resumeContent');

    if (storedCandidateName && storedJobTitle) {
      setPageTitle(`Pre-Interview: ${storedCandidateName} - ${storedJobTitle}`);
    } else {
      setPageTitle("Pre-Interview Call");
    }

    setCallContextDetails({
      candidateName: storedCandidateName,
      candidateEmail: storedCandidateEmail,
      candidatePhone: storedCandidatePhone,
      candidateBirthdate: storedCandidateBirthdate,
      candidateAge: storedCandidateAge,
      candidateEducation: storedCandidateEducation,
      candidateWorkExperience: storedCandidateWorkExperience,
      candidateJobInterest: storedCandidateJobInterest,
      candidateSummary: storedCandidateSummary,
      jobTitle: storedJobTitle,
      jobDescription: storedJobDescription,
      jobRequirements: storedJobRequirements,
      jobDesc: storedJobDesc,
      applicationId: storedApplicationId,
      systemPrompt: storedSystemPrompt,
      resumeContent: storedResumeContent,
    });

    setCustomerName(storedCandidateName);
  }, []);

  // NOTE: Removed automatic call creation on component load
  // Call will be created only when user starts conversation with ElevenLabs conversationId

  // Handle start call - now creates call record WITH conversationId in one step
  const handleStartCall = useCallback(async () => {
    try {
      const storedCandidateName = sessionStorage.getItem('candidateName') || '';
      const storedSystemPrompt = sessionStorage.getItem('systemInstruction') || '';

      // Step 1: Start ElevenLabs conversation and get conversationId
      const elevenLabsConversationId = await startConversation(storedCandidateName, storedSystemPrompt);
      
      if (!elevenLabsConversationId) {
        throw new Error('Failed to get conversation ID from ElevenLabs');
      }

      // Step 2: Create call record WITH conversationId (single database write)
      if (!actualCallId) {
        try {
          console.log(`[handleStartCall] Creating call record with ElevenLabs conversationId ${elevenLabsConversationId}`);
          const response = await fetchWithAuth('/api/calls/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicationId: callId,
              systemPrompt: storedSystemPrompt,
              conversationId: elevenLabsConversationId // Include conversationId in initial creation
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create call record');
          }

          const data = await response.json();
          setActualCallId(data.callId);
          console.log(`[handleStartCall] Successfully created call ${data.callId} with conversationId - ${data.message}`);
        } catch (createError) {
          console.error(`[handleStartCall] Error creating call record:`, createError);
          toast.error('Failed to create call record');
          // If call creation fails, we should also stop the ElevenLabs conversation
          try {
            await stopConversation();
          } catch (stopError) {
            console.error('Error stopping conversation after call creation failure:', stopError);
          }
          throw createError;
        }
      } else {
        console.log(`[handleStartCall] Using existing call ID: ${actualCallId}`);
      }
      
      toast.success("Call started successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to start call");
    }
  }, [startConversation, stopConversation, actualCallId, callId]);

  // Handle end call with recording processing
  const handleEndCall = useCallback(async () => {
    try {
      console.log("[handleEndCall] Starting call end process...");
      
      // Stop the conversation first
      console.log("[handleEndCall] Stopping conversation...");
      setProcessingStatus("Ending call...");
      await stopConversation();
      console.log("[handleEndCall] Conversation stopped");
      
      // Give a brief moment for audio recording to finalize
      console.log("[handleEndCall] Waiting for audio recording to finalize...");
      setProcessingStatus("Finalizing audio recording...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("[handleEndCall] Audio finalization wait complete");
      
      // Auto-save notes if any and not already saved
      if (currentNotes && actualCallId && !notesSaved && !notesAutoSaved) {
        console.log("[handleEndCall] Auto-saving notes...");
        setProcessingStatus("Auto-saving notes...");
        try {
          const notesResponse = await fetchWithAuth(`/api/calls/${actualCallId}/notes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: currentNotes }),
          });
          
          if (!notesResponse.ok) {
            console.warn("[handleEndCall] Failed to auto-save notes");
            toast.warning("Failed to auto-save notes. Please save manually if needed.");
          } else {
            console.log("[handleEndCall] Notes auto-saved successfully");
            setNotesAutoSaved(true);
            toast.success("Notes auto-saved successfully!");
          }
        } catch (notesError) {
          console.warn("[handleEndCall] Error auto-saving notes:", notesError);
          toast.warning("Failed to auto-save notes. Please save manually if needed.");
        }
      }
      
      // DISABLED: Recording processing, transcription, and LLM analysis
      // ElevenLabs Conversational AI now handles recording & transcription
      // We will handle the processing later through a separate workflow
      
      /* 
      // Process the recorded audio for transcription and analysis
      if (actualCallId) {
        console.log(`[handleEndCall] Processing recording for call ${actualCallId}, isRecording: ${isRecording}`);
        setIsProcessingRecording(true);
        setProcessingStatus("Processing recording for analysis...");
        toast.info("Processing recording for analysis...", { duration: 10000 });
        
        try {
          console.log("[handleEndCall] Calling processRecording...");
          const result = await processRecording(actualCallId);
          console.log("[handleEndCall] processRecording result:", result);
          
          if (result) {
            setProcessingStatus("Analysis completed successfully!");
            toast.success("Recording processed successfully! Transcription and analysis will be available shortly.");
            console.log("[handleEndCall] Recording processing completed successfully");
          } else {
            setProcessingStatus("No recording to process.");
            toast.info("Call ended successfully. No recording to process.");
            console.log("[handleEndCall] No recording to process");
          }
        } catch (recordingError) {
          console.error("[handleEndCall] Error processing recording:", recordingError);
          setProcessingStatus(`Error: ${recordingError instanceof Error ? recordingError.message : 'Unknown error'}`);
          toast.error(`Failed to process recording: ${recordingError instanceof Error ? recordingError.message : 'Unknown error'}`);
        } finally {
          setIsProcessingRecording(false);
          console.log("[handleEndCall] Recording processing phase completed");
        }
      }
      */
      
      console.log("[handleEndCall] Skipping recording processing - handled by ElevenLabs Conversational AI");
      
      console.log("[handleEndCall] Call end process completed, navigating to thank you page");
      setProcessingStatus("Redirecting to thank you page...");
      toast.success("Call ended successfully");
      
      // Navigate to thank you page
      if (actualCallId) {
        router.push(`/pre-interview/${actualCallId}/thank-you`);
      }
    } catch (error: any) {
      console.error("[handleEndCall] Error ending call:", error);
      setProcessingStatus(`Error: ${error.message || 'Failed to end call'}`);
      toast.error(error.message || "Failed to end call");
      setIsProcessingRecording(false);
    }
  }, [stopConversation, currentNotes, actualCallId, router, isRecording, processRecording, notesSaved, notesAutoSaved]);

  // Handle save notes
  const handleSaveNotes = useCallback(async () => {
    if (!actualCallId || !currentNotes.trim()) {
      toast.error("Cannot save notes: missing call ID or empty notes.");
      return;
    }

    setIsSavingNotes(true);
    setNotesSaved(false);

    try {
      const notesResponse = await fetchWithAuth(`/api/calls/${actualCallId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: currentNotes }),
      });
      
      if (!notesResponse.ok) {
        const errorData = await notesResponse.json().catch(() => ({}));
        toast.error("Failed to save notes", { description: errorData.error || `Server error: ${notesResponse.status}` });
      } else {
        setNotesSaved(true);
        toast.success("Notes saved successfully!");
        
        // Reset saved state after 3 seconds
        setTimeout(() => setNotesSaved(false), 3000);
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Could not save notes due to a network error.");
    } finally {
      setIsSavingNotes(false);
    }
  }, [actualCallId, currentNotes]);
  
  // Display error if any
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <TooltipProvider>
    <div className="streamingConsole flex h-screen w-full text-foreground bg-background overflow-hidden">
      {/* Main content area takes full space */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Main view area - takes most space */}
        <div className="flex flex-1 items-center justify-center p-5 relative overflow-hidden">
            {/* Recording status indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-red-500/20 text-red-600 px-3 py-2 rounded-full border border-red-500/30">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Recording</span>
              </div>
            )}

          {/* Main content - Audio Visualizer and Camera Feed */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center gap-12">
              {/* Audio Visualizer side panel */}
                <div className="flex flex-col items-center justify-center bg-muted/30 rounded-2xl p-2 h-96 w-72 border border-border/20">
                  <div className="w-40 h-40 flex items-center justify-center mb-4">
                  <AudioVisualizer
                      micVolume={isMuted ? 0 : 0.5}
                      apiVolume={isSpeaking ? 0.8 : 0}
                      active={isConnected}
                  />
                </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      {status === "connected"
                        ? isSpeaking
                          ? "Speaking..."
                          : "Listening..."
                        : "Disconnected"}
                    </p>
                    {/* {conversationId && (
                      <p className="text-xs text-muted-foreground">
                        ID: {conversationId.slice(0, 8)}...
                      </p>
                    )}
                    {isRecording && (
                      <p className="text-xs text-red-600 mt-1">
                        Recording for analysis
                      </p>
                    )} */}
                  </div>
              </div>

              {/* Camera Feed - video call frame */}
              <div className="flex flex-col items-center">
                <div className="relative w-[600px] h-96">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-2xl border-2 border-border shadow-lg"
                  />
                  {(isCameraLoading || cameraError || !isCameraStreaming) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-2xl">
                      {isCameraLoading ? (
                          <p className="text-sm text-muted-foreground">Camera will be active when you start the call</p>
                      ) : cameraError ? (
                        <div className="text-center space-y-2">
                          <p className="text-sm text-red-600">{cameraError}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={startCamera}
                          >
                            Try Again
                          </Button>
                        </div>
                      ) : (
                          <p className="text-sm text-muted-foreground">Camera starting...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Customer name at the bottom */}
            {/* {customerName && (
            <h1 className="absolute bottom-7 left-1/2 transform -translate-x-1/2 text-center text-xl font-semibold text-muted-foreground">
              {customerName}'s Pre-Interview
            </h1>
            )} */}
        </div>

          {/* Control Tray - centered at bottom */}
        <div className="flex justify-center items-center p-4 flex-shrink-0">
            {/* Processing status display */}
            {processingStatus && isProcessingRecording && (
              <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 mb-2">
                <p className="text-sm text-muted-foreground text-center">
                  {processingStatus}
                </p>
              </div>
            )}
            
            <div className="bg-background border border-primary/30 rounded-[27px] inline-flex gap-3 items-center p-2.5">
              {/* Microphone Control */}
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                disabled={!isConnected}
                className="relative"
              >
                {!isMuted ? <Mic size={24} /> : <MicOff size={24} />}
              </Button>

              {/* Start/Stop Call Control */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isConnected ? "destructive" : "default"}
                    size="icon"
                    onClick={isConnected ? handleEndCall : handleStartCall}
                    disabled={status === "connecting" || isProcessingRecording}
                    className="mx-2"
                  >
                    {status === "connecting" || isProcessingRecording ? (
                      <LoaderCircle className="h-6 w-6 animate-spin" />
                    ) : isConnected ? (
                      <PhoneOff size={24} />
                    ) : (
                      <Play size={24} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isConnected ? "End Call" : "Start Call"}</p>
                </TooltipContent>
              </Tooltip>

              {/* Volume indicator placeholder */}
              <Button variant="outline" size="icon" disabled className="pointer-events-none">
                <div className={`w-4 h-4 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              </Button>
            </div>
        </div>
      </main>

      {/* Notes Button and Sheet */}
      <Sheet open={isNotesSheetOpen} onOpenChange={setIsNotesSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-24 sm:bottom-16 right-6 h-12 w-12 rounded-full !border !border-primary/30 shadow-lg z-50"
            aria-label="Open notes"
          >
            <FileText className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Pre-Interview Notes</SheetTitle>
          </SheetHeader>
            
          {/* Call Context Display */}
          {callContextDetails && (
            <div className="px-4 py-4 mx-4 text-sm overflow-y-auto bg-muted rounded-md">
              <div className="grid grid-cols-[max-content_min-content_1fr] gap-x-2 gap-y-0.5">
                {/* Candidate Info Section */}
                <h5 className="col-span-3 font-semibold mb-1 text-muted-foreground">Candidate Info</h5>

                {/* Name Row */}
                <span className="font-medium text-left">Name</span>
                <span className="text-center">:</span>
                <span className="items-baseline first-letter:uppercase break-words">
                  {callContextDetails.candidateName || 'N/A'}
                  {callContextDetails.candidateAge && (
                    <span className="ml-1 text-muted-foreground">
                      (Age: {callContextDetails.candidateAge})
                    </span>
                  )}
                </span>

                {/* Summary Row */}
                {callContextDetails.candidateSummary && (
                  <>
                    <span className="font-medium text-left">Summary</span>
                    <span className="text-center">:</span>
                    <span className="break-words">{callContextDetails.candidateSummary}</span>
                  </>
                )}

                {/* Job Info Section */}
                <h5 className="col-span-3 font-semibold mt-3 mb-1 text-muted-foreground">Job Info</h5>

                {/* Position Row */}
                <span className="font-medium text-left">Position</span>
                <span className="text-center">:</span>
                <span className="first-letter:uppercase break-words">{callContextDetails.jobTitle || 'N/A'}</span>

                {/* Description Row */}
                {callContextDetails.jobDescription && (
                  <>
                    <span className="font-medium text-left">Description</span>
                    <span className="text-center">:</span>
                    <span className="break-words">{callContextDetails.jobDescription}</span>
                  </>
                )}

                {/* Resume Row */}
                {callContextDetails.resumeContent && callContextDetails.resumeContent !== '{}' && (
                  <>
                    <span className="font-medium text-left">Resume</span>
                    <span className="text-center">:</span>
                    <span className="break-words">Available</span>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Notes Section */}
          <div className="flex-1 flex flex-col px-6 py-4">
            <h5 className="font-semibold mb-3 text-muted-foreground">Verification Phrase</h5>
            <div className="flex-1 flex flex-col gap-3">
              <Textarea
                placeholder="Write your answer for the verification question here as instructed by the interviewer in the call..."
                value={currentNotes}
                  onChange={(e) => {
                    setCurrentNotes(e.target.value);
                    // Reset saved states when user types
                    if (notesSaved || notesAutoSaved) {
                      setNotesSaved(false);
                      setNotesAutoSaved(false);
                    }
                  }}
                className="flex-1 min-h-[200px] resize-none"
              />
              <Button 
                onClick={handleSaveNotes}
                  disabled={!currentNotes.trim() || !actualCallId || isSavingNotes}
                size="sm"
                  className={`self-end ${notesSaved ? 'bg-green-600 hover:bg-green-700' : ''} ${notesAutoSaved ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                >
                  {isSavingNotes ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : notesSaved ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Saved!
                    </>
                  ) : notesAutoSaved ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Auto-saved
                    </>
                  ) : (
                    <>
                <Check className="mr-2 h-4 w-4" />
                Save Notes
                    </>
                  )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </TooltipProvider>
  );
}