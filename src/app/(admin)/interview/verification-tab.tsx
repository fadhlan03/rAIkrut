"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InterviewData } from "./data-interview";
import { cn } from "@/lib/utils";

interface VerificationTabProps {
  interviewData: InterviewData;
}

function VerificationCard({ title, score, status, details }: {
  title: string;
  score: number | null;
  status?: string | null;
  details?: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-gray-100 text-gray-800 border-gray-200";
    if (score >= 0.8) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 0.6) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'verified': return "bg-green-100 text-green-800";
      case 'processing': return "bg-blue-100 text-blue-800";
      case 'pending': return "bg-yellow-100 text-yellow-800";
      case 'rejected':
      case 'failed': return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleToggle = () => {
    if (details) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        details && "cursor-pointer hover:bg-muted/30 transition-colors"
      )}
      onClick={handleToggle}
    >
      <div className="flex items-center justify-between p-4">
        <h4 className="font-medium">{title}</h4>
        <div className="flex items-center gap-2">
          {score !== null ? (
            <Badge variant="outline" className={cn("font-mono", getScoreColor(score))}>
              {(score * 100).toFixed(1)}%
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-gray-100 text-gray-800">
              N/A
            </Badge>
          )}
          {status && (
            <Badge variant="outline" className={getStatusColor(status)}>
              {status}
            </Badge>
          )}
          {details && (
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
      {details && isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-sm text-muted-foreground border-t pt-3">{details}</p>
        </div>
      )}
    </div>
  );
}

export function VerificationTab({ interviewData }: VerificationTabProps) {
  return (
    <div className="space-y-6 px-1">
      {/* Verification Phrase Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Verification Phrase</h3>
        <div className="bg-muted/30 rounded-lg p-4">
          {interviewData.callNotes ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {interviewData.callNotes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No verification phrase recorded for this interview.
            </p>
          )}
        </div>
      </div>

      {/* Individual Verification Scores */}
      {interviewData.hasVerification && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Verification Results</h3>
            <div className="grid grid-cols-1 gap-4">
              <VerificationCard
                title="Face Verification"
                score={interviewData.faceVerificationScore}
                status={interviewData.verificationStatus}
                details={interviewData.verificationMetadata?.face?.details ||
                  (interviewData.faceVerificationScore !== null ?
                    `Face verification score: ${(interviewData.faceVerificationScore * 100).toFixed(1)}%` :
                    null)}
              />
              <VerificationCard
                title="Voice Verification"
                score={interviewData.voiceVerificationScore}
                status={interviewData.verificationStatus}
                details={interviewData.verificationMetadata?.voice?.details ||
                  (interviewData.voiceVerificationScore !== null ?
                    `Voice verification score: ${(interviewData.voiceVerificationScore * 100).toFixed(1)}%` :
                    null)}
              />
              <VerificationCard
                title="Video Analysis (Deepfake Detection)"
                score={interviewData.deepfakeScore}
                status={interviewData.verificationStatus}
                details={interviewData.verificationMetadata?.video?.details ||
                  (interviewData.deepfakeScore !== null ?
                    `Video analysis score: ${(interviewData.deepfakeScore * 100).toFixed(1)}%` :
                    null)}
              />
            </div>
          </div>
        </>
      )}

      {/* No Verification Message */}
      {!interviewData.hasVerification && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Verification Status</h3>
          <div className="text-center p-6 bg-muted/30 rounded-lg">
            <div className="text-lg text-muted-foreground mb-2">No Verification Data Available</div>
            <div className="text-sm text-muted-foreground">
              The candidate has not completed identity verification or verification data is not linked to this application.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
