"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useCallback, useState } from "react";
import { Card, CardContent} from "@/components/ui/card";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";
import { TranscriptViewer } from "./TranscriptViewer";

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
  const response = await fetch("/api/signed-url");
  if (!response.ok) {
    throw Error("Failed to get signed url");
  }
  const data = await response.json();
  return data.signedUrl;
}

interface TranscriptEntry {
  role: "user" | "assistant";
  time_in_call_secs: number;
  message: string;
}

export default function ConvAI() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [conversationData, setConversationData] = useState<any>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      console.log("connected");
      setShowTranscript(false);
      setTranscript([]);
      setConversationData(null);
    },
    onDisconnect: async () => {
      console.log("disconnected - conversation ID:", currentConversationId);
      // Add a small delay to ensure the conversation is fully processed
      if (currentConversationId) {
        setTimeout(() => {
          fetchTranscript(currentConversationId);
        }, 2000); // Wait 2 seconds before fetching transcript
      }
    },
    onError: error => {
      console.log(error);
      alert("An error occurred during the conversation");
    },
    onMessage: message => {
      console.log(message);
    },
  });

  async function fetchTranscript(conversationId: string, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds
    
    try {
      setIsLoadingTranscript(true);
      console.log(`Fetching transcript for conversation: ${conversationId} (attempt ${retryCount + 1})`);
      
      const response = await fetch(`/api/elevenlabs/conversations/${conversationId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("Error response:", errorData);
        
        // If it's a 404 and we haven't exceeded max retries, try again
        if (response.status === 404 && retryCount < maxRetries) {
          console.log(`Conversation not found yet, retrying in ${retryDelay/1000} seconds...`);
          setTimeout(() => {
            fetchTranscript(conversationId, retryCount + 1);
          }, retryDelay);
          return;
        }
        
        throw new Error(`Failed to fetch transcript: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Full conversation data:", data);
      
      // Store the full conversation data
      setConversationData(data);
      
      if (data.transcript && Array.isArray(data.transcript)) {
        console.log("Sample transcript entry:", data.transcript[0]);
        console.log("All transcript entries:", data.transcript.map((entry: any, index: number) => ({
          index,
          role: entry.role,
          message: entry.message,
          timeFields: {
            time_in_call_secs: entry.time_in_call_secs,
            timestamp: entry.timestamp,
            time: entry.time,
            start_time: entry.start_time,
            allFields: Object.keys(entry)
          }
        })));
        setTranscript(data.transcript);
        setShowTranscript(true);
      } else if (data.status && data.status !== 'done' && retryCount < maxRetries) {
        // Conversation is still processing
        console.log(`Conversation status: ${data.status}, retrying in ${retryDelay/1000} seconds...`);
        setTimeout(() => {
          fetchTranscript(conversationId, retryCount + 1);
        }, retryDelay);
        return;
      } else {
        console.log("No transcript found or transcript not ready yet");
        alert("Transcript is still being processed or not available. Please try again later.");
      }
    } catch (error) {
      console.error("Error fetching transcript:", error);
      if (retryCount < maxRetries) {
        console.log(`Retrying in ${retryDelay/1000} seconds...`);
        setTimeout(() => {
          fetchTranscript(conversationId, retryCount + 1);
        }, retryDelay);
      } else {
        alert(`Error fetching transcript after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoadingTranscript(false);
      }
    }
    
    if (retryCount === 0) {
      // Only set loading to false if this is the final attempt or success
      setIsLoadingTranscript(false);
    }
  }

  async function startConversation() {
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      alert("No permission");
      return;
    }
    const signedUrl = await getSignedUrl();
    const conversationId = await conversation.startSession({ signedUrl });
    console.log(conversationId);
    setCurrentConversationId(conversationId);
  }

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  if (showTranscript && transcript.length > 0) {
    return (
      <div className="flex flex-col items-center gap-6">
        <TranscriptViewer 
          transcript={transcript} 
          conversationId={currentConversationId || "unknown"}
          conversationData={conversationData}
        />
        <Button
          variant="outline"
          onClick={() => setShowTranscript(false)}
        >
          Start New Conversation
        </Button>
      </div>
    );
  }

  return (
    <div className={"flex justify-center items-center gap-x-4"}>
      <Card className={"rounded-3xl"}>
        <CardContent>
          <div className="px-6 pb-6 text-center">
            <div className="leading-none font-semibold text-center w-full mb-2">
              {conversation.status === "connected"
                ? conversation.isSpeaking
                  ? `Agent is speaking`
                  : "Agent is listening"
                : "Disconnected"}
            </div>
            {currentConversationId && (
              <div className="text-xs text-muted-foreground text-center w-full">
                ID: {currentConversationId}
              </div>
            )}
          </div>
          <div className={"flex flex-col gap-y-4 text-center"}>
            <div
              className={cn(
                "orb my-16 mx-12",
                conversation.status === "connected" && conversation.isSpeaking
                  ? "orb-active animate-orb"
                  : conversation.status === "connected"
                  ? "animate-orb-slow orb-inactive"
                  : "orb-inactive"
              )}
            ></div>

            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={
                conversation !== null && conversation.status === "connected"
              }
              onClick={startConversation}
            >
              Start conversation
            </Button>
            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={conversation === null}
              onClick={stopConversation}
            >
              End conversation
            </Button>
            
            {/* Show transcript button if we have a conversation ID and not currently connected */}
            {currentConversationId && conversation.status !== "connected" && (
              <Button
                variant={"default"}
                className={"rounded-full"}
                size={"lg"}
                disabled={isLoadingTranscript}
                onClick={() => fetchTranscript(currentConversationId)}
              >
                {isLoadingTranscript ? "Loading Transcript..." : "Show Transcript"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}