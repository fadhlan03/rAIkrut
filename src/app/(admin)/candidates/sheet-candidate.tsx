"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Candidate, CandidateApplication, ApplicationStatus } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { Mail, Phone as PhoneIcon, CalendarDays, UserCircle, Loader2 } from 'lucide-react';
import { CandidateInformation } from "@/components/candidates/CandidateInformation";
import { CandidateAssessment } from "@/components/candidates/CandidateAssessment";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner"
import React from 'react'

interface SheetCandidateProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isLoading?: boolean;
}

// Helper function to calculate age (copied from data-candidates.tsx for now, consider moving to a utils file)
const calculateAge = (birthdateString?: string): number | undefined => {
  if (!birthdateString) return undefined;
  try {
    const birthDate = new Date(birthdateString);
    if (isNaN(birthDate.getTime())) return undefined;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : undefined;
  } catch (e) {
    return undefined;
  }
};

const formatPhoneNumberForWhatsApp = (phone?: string): string | null => {
  if (!phone) return null;
  let cleanedPhone = phone.replace(/\D/g, ''); // Remove all non-digit characters
  if (cleanedPhone.startsWith('0')) {
    cleanedPhone = '62' + cleanedPhone.substring(1);
  } else if (cleanedPhone.startsWith('62')) {
    // Already has country code, ensure no plus if we add it later
  } else {
    // If no leading 0 or 62, assume it needs 62 prefix
    cleanedPhone = '62' + cleanedPhone;
  }
  // Basic validation for Indonesian numbers (e.g., 9-13 digits after 62)
  if (cleanedPhone.length >= 10 && cleanedPhone.length <= 15 && cleanedPhone.startsWith('62')) {
    return cleanedPhone; // Return without the +, wa.me doesn't need it if number starts with country code
  }
  return null;
};



export function SheetCandidate({ candidate, isOpen, onOpenChange, isLoading = false }: SheetCandidateProps) {
  const [isFetchingResumeUrl, setIsFetchingResumeUrl] = React.useState(false);
  const [applications, setApplications] = React.useState<CandidateApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = React.useState(false);
  const [updatingStatuses, setUpdatingStatuses] = React.useState<Set<string>>(new Set());

  // Note: Assessment functionality moved to CandidateAssessment component

  const fetchApplications = React.useCallback(async (candidateId: string) => {
    setIsLoadingApplications(true);
    try {
      const response = await fetch(`/api/candidates/${candidateId}/applications`);
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }
      const applicationsData: CandidateApplication[] = await response.json();
      setApplications(applicationsData);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
      setApplications([]);
    } finally {
      setIsLoadingApplications(false);
    }
  }, [])

  // Note: Assessment functionality moved to CandidateAssessment component

  const handleStatusUpdate = React.useCallback(async (applicationId: string, newStatus: ApplicationStatus) => {
    setUpdatingStatuses(prev => new Set(prev).add(applicationId));
    try {
      const response = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      // Update local state
      setApplications(prev =>
        prev.map(app =>
          app.application_id === applicationId
            ? { ...app, status: newStatus }
            : app
        )
      );

      toast.success('Application status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setUpdatingStatuses(prev => {
        const newSet = new Set(prev);
        newSet.delete(applicationId);
        return newSet;
      });
    }
  }, []);

  // Fetch applications when candidate changes
  React.useEffect(() => {
    if (candidate?.id && isOpen) {
      fetchApplications(candidate.id);
    }
  }, [candidate?.id, isOpen, fetchApplications]);

  if (!isOpen && !isLoading) {
    return null;
  }

  const handleViewResumeClick = async () => {
    if (!candidate?.id) return;

    setIsFetchingResumeUrl(true);
    try {
      const response = await fetch(`/api/candidates/${candidate.id}/resume`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from server.' }));
        console.error("Failed to fetch resume URL from sheet:", errorData.error || response.statusText);
        alert(`Could not load resume: ${errorData.error || 'Server error'}`); // Simple alert
        return;
      }
      const data: { fileUrl: string } = await response.json();
      if (data.fileUrl) {
        window.open(data.fileUrl, '_blank', 'noopener,noreferrer');
      } else {
        console.error("Resume URL not found in response from sheet");
        alert("Could not load resume: URL not provided.");
      }
    } catch (err) {
      console.error("Error fetching resume URL from sheet:", err);
      alert("An unexpected error occurred while trying to load the resume.");
    } finally {
      setIsFetchingResumeUrl(false);
    }
  };

  const age = candidate?.birthdate ? calculateAge(candidate.birthdate) : undefined;
  const whatsAppPhoneNumber = candidate?.phone ? formatPhoneNumberForWhatsApp(candidate.phone) : null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        className="p-0 flex flex-col max-w-full sm:max-w-2xl w-full h-svh"
        side="right"
      >
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-xl font-semibold tracking-tight pr-8 flex items-center">
            <UserCircle className="size-7 mr-2.5 text-primary" />
            {isLoading ? "Loading..." : (candidate?.full_name || "Candidate Details")}
          </SheetTitle>

          {!isLoading && candidate && (
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {candidate.email && (
                <a href={`mailto:${candidate.email}`} className="flex items-center hover:text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm">
                  <Mail className="size-3.5 mr-1.5 text-primary/80 flex-shrink-0" />
                  <span>{candidate.email}</span>
                </a>
              )}
              {whatsAppPhoneNumber && candidate.phone && (
                <a href={`https://wa.me/${whatsAppPhoneNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm">
                  <PhoneIcon className="size-3.5 mr-1.5 text-primary/80 flex-shrink-0" />
                  <span>{candidate.phone}</span>
                </a>
              )}
              {age !== undefined && (
                <div className="flex items-center">
                  <CalendarDays className="size-3.5 mr-1.5 text-primary/80 flex-shrink-0" />
                  <span>Age: {age}</span>
                </div>
              )}
            </div>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex-grow min-h-0 flex items-center justify-center p-6">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading details...</span>
          </div>
        ) : candidate ? (
          <ScrollArea className="flex-grow min-h-0">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mt-4 mx-2">
                <TabsTrigger value="details">Candidate Details</TabsTrigger>
                <TabsTrigger value="assessment">Suitability Assessment</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-6">
                <div className="px-6 pt-4 pb-6">
                  <CandidateInformation
                    candidate={candidate}
                    showApplicationsList={true}
                    applications={applications}
                    isLoadingApplications={isLoadingApplications}
                    onApplicationStatusUpdate={handleStatusUpdate}
                    updatingStatuses={updatingStatuses}
                    onViewResume={handleViewResumeClick}
                    isFetchingResumeUrl={isFetchingResumeUrl}
                  />
                </div>
              </TabsContent>

              <TabsContent value="assessment" className="mt-2">
                <div className="px-6 pt-4 pb-6">
                  {candidate && (
                    <CandidateAssessment
                      candidate={candidate}
                      applications={applications}
                      onApplicationsRefresh={() => {
                        if (candidate.id) {
                          fetchApplications(candidate.id);
                        }
                      }}
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        ) : (
          <div className="flex-grow min-h-0 flex items-center justify-center p-6">
            <p className="text-muted-foreground">No candidate data available or error loading details.</p>
          </div>
        )}

        {!isLoading && candidate && (
          <SheetFooter className="p-6 pt-4 border-t bg-background shrink-0 flex flex-row justify-between items-center">
            <div>
              {candidate.email && (
                <Button variant="outline" size="lg" asChild>
                  <a href={`mailto:${candidate.email}`}>
                    <Mail className="mr-2 size-4" /> Email
                  </a>
                </Button>
              )}
            </div>
            <div>
              {whatsAppPhoneNumber && (
                <Button variant="outline" size="lg" asChild>
                  <a href={`https://wa.me/${whatsAppPhoneNumber}`} target="_blank" rel="noopener noreferrer">
                    <PhoneIcon className="mr-2 size-4" /> Call via WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}