"use client";

import {
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScoringResult, Candidate as CandidateType, CandidateApplication, ApplicationStatus } from "@/types/database";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoaderCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, HelpCircle, Edit3, Save, X, Mail, Loader2, Copy, ExternalLink, ChevronDown } from "lucide-react";
import { CandidateInformation } from "@/components/candidates/CandidateInformation";
import { CandidateAssessment } from "@/components/candidates/CandidateAssessment";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ScoringDetailsSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  scoringData: ScoringResult | null;
  candidateData: CandidateType | null;
  isLoading: boolean;
  applicantName?: string;
  referralName?: string;
  referralEmail?: string;
  referralPosition?: string;
  referralDept?: string;
  applicationId?: string;
  jobTitle?: string;
  onReferralUpdate?: (newReferralName: string, newReferralEmail: string, newReferralPosition: string, newReferralDept: string) => void;
}

const DetailItem: React.FC<{ 
  label: string; 
  value?: string | number | null; 
  isBadge?: boolean; 
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}> = ({ label, value, isBadge = false, badgeVariant = "secondary", className }) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 items-start gap-x-4 gap-y-1 py-2 ${className}`}>
      <span className="text-sm font-medium text-muted-foreground md:col-span-1">{label}</span>
      {isBadge ? (
        <Badge variant={badgeVariant} className="md:col-span-2 justify-self-start text-sm break-words">
          {String(value)}
        </Badge>
      ) : (
        <span className="text-sm text-foreground md:col-span-2 whitespace-pre-wrap break-words">{String(value)}</span>
      )}
    </div>
  );
};

const ReviewSection: React.FC<{ title: string; score?: number | null; review?: string | null }> = ({ title, score, review }) => {
    if ((score === undefined || score === null) && (review === undefined || review === null || review.trim() === "")) return null;
    return (
      <div className="mt-3 first:mt-0">
        <h4 className="text-md font-semibold text-foreground mb-1">{title}</h4>
        {score !== undefined && score !== null && <DetailItem label="Score" value={Number(score).toFixed(2)} />}
        {review && review.trim() !== "" && <DetailItem label="Review" value={review} />}
      </div>
    );
};

// Helper to render array data (like education or work experience) as a list or joined string
const renderArrayData = (items: any[] | undefined, propertyToShow?: string, fallbackText: string = "N/A") => {
  if (!items || items.length === 0) return fallbackText;
  return (
    <ul className="list-disc list-outside pl-5 space-y-1 text-sm">
      {items.map((item, index) => (
        <li key={index}>
          {typeof item === 'string' ? item :
           (propertyToShow && item[propertyToShow]) ? item[propertyToShow] :
           item.name || item.title || JSON.stringify(item)}
        </li>
      ))}
    </ul>
  );
};

// Helper component for Status Badge
const StatusBadge = ({ status }: { status: string | boolean }) => {
  const statusValue = typeof status === 'boolean' ? (status ? "Yes" : "No") : String(status);
  
  switch (statusValue.toLowerCase()) {
    case "yes":
    case "true":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="mr-1.5 h-3 w-3" /> Yes
        </span>
      );
    case "no":
    case "false":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="mr-1.5 h-3 w-3" /> No
        </span>
      );
    case "unclear":
    case "partial":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <HelpCircle className="mr-1.5 h-3 w-3" /> Unclear
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {statusValue}
        </span>
      );
  }
};

export function ScoringDetailsSheet({
  isOpen,
  onOpenChange,
  scoringData,
  candidateData,
  isLoading,
  applicantName,
  referralName,
  referralEmail,
  referralPosition,
  referralDept,
  applicationId,
  jobTitle,
  onReferralUpdate,
}: ScoringDetailsSheetProps) {
  const [isEditingReferral, setIsEditingReferral] = useState(false);
  const [editReferralName, setEditReferralName] = useState("");
  const [editReferralEmail, setEditReferralEmail] = useState("");
  const [editReferralPosition, setEditReferralPosition] = useState("");
  const [editReferralDept, setEditReferralDept] = useState("");
  const [isSavingReferral, setIsSavingReferral] = useState(false);

  // Email generation states
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [hasGeneratedEmail, setHasGeneratedEmail] = useState(false);

  // Applications states
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [updatingStatuses, setUpdatingStatuses] = useState<Set<string>>(new Set());

  // Resume viewing state
  const [isFetchingResumeUrl, setIsFetchingResumeUrl] = useState(false);

  // Fetch applications for the candidate
  const fetchApplications = useCallback(async (candidateId: string) => {
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
  }, []);

  // Handle application status updates
  const handleApplicationStatusUpdate = useCallback(async (applicationId: string, newStatus: ApplicationStatus) => {
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

  // Fetch applications when candidate data changes
  useEffect(() => {
    if (candidateData?.id && isOpen) {
      fetchApplications(candidateData.id);
    }
  }, [candidateData?.id, isOpen, fetchApplications]);

  // Handle resume viewing
  const handleViewResumeClick = async () => {
    if (!candidateData?.id) return;

    setIsFetchingResumeUrl(true);
    try {
      const response = await fetch(`/api/candidates/${candidateData.id}/resume`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from server.' }));
        console.error("Failed to fetch resume URL:", errorData.error || response.statusText);
        toast.error(`Could not load resume: ${errorData.error || 'Server error'}`);
        return;
      }
      const data: { fileUrl: string } = await response.json();
      if (data.fileUrl) {
        window.open(data.fileUrl, '_blank', 'noopener,noreferrer');
      } else {
        console.error("Resume URL not found in response");
        toast.error("Could not load resume: URL not provided.");
      }
    } catch (err) {
      console.error("Error fetching resume URL:", err);
      toast.error("An unexpected error occurred while trying to load the resume.");
    } finally {
      setIsFetchingResumeUrl(false);
    }
  };

  const handleStartEditReferral = () => {
    setEditReferralName(referralName || "");
    setEditReferralEmail(referralEmail || "");
    setEditReferralPosition(referralPosition || "");
    setEditReferralDept(referralDept || "");
    setIsEditingReferral(true);
  };

  const handleCancelEditReferral = () => {
    setIsEditingReferral(false);
    setEditReferralName("");
    setEditReferralEmail("");
    setEditReferralPosition("");
    setEditReferralDept("");
  };

  const handleSaveReferral = async () => {
    if (!applicationId && !scoringData?.application_id) {
      toast.error("Cannot update referral: Application ID not found");
      return;
    }

    const appId = applicationId || scoringData?.application_id;
    setIsSavingReferral(true);

    try {
      const response = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralName: editReferralName.trim(),
          referralEmail: editReferralEmail.trim(),
          referralPosition: editReferralPosition.trim(),
          referralDept: editReferralDept.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update referral information');
      }

      toast.success("Referral information updated successfully");
      setIsEditingReferral(false);
      
      // Call the callback to update parent component data
      if (onReferralUpdate) {
        onReferralUpdate(editReferralName.trim(), editReferralEmail.trim(), editReferralPosition.trim(), editReferralDept.trim());
      }
    } catch (error) {
      console.error('Error updating referral:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update referral information');
    } finally {
      setIsSavingReferral(false);
    }
  };

  const generateEmailContent = async () => {
    if (!scoringData || !candidateData) {
      toast.error("Missing scoring data or candidate information");
      return;
    }

    setIsGeneratingEmail(true);
    try {
      const emailPayload = {
        candidateName: candidateData.full_name || applicantName,
        candidateEmail: candidateData.email,
        jobTitle: jobTitle || "Position",
        overallScore: scoringData.overall_score,
        overallSummary: scoringData.overall_summary,
        decision: scoringData.decision,
        experienceScore: scoringData.experience_score,
        experienceReview: scoringData.experience_review,
        educationScore: scoringData.education_score,
        educationReview: scoringData.education_review,
        skillsScore: scoringData.skills_score,
        skillsReview: scoringData.skills_review,
        roleFitScore: scoringData.role_fit_score,
        roleFitReview: scoringData.role_fit_review,
      };

      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate email content');
      }

      const { subject, body } = await response.json();
      setEmailSubject(subject);
      setEmailBody(body);
      setHasGeneratedEmail(true);
      toast.success("Email content generated successfully");
    } catch (error) {
      console.error('Error generating email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate email content');
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const sendEmail = () => {
    if (!candidateData?.email) {
      toast.error("Candidate email not available");
      return;
    }

    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailBody);
    const mailtoLink = `mailto:${candidateData.email}?subject=${encodedSubject}&body=${encodedBody}`;
    
    // Try multiple approaches to open email client
    try {
      // Method 1: Direct window.open with target="_blank"
      const emailWindow = window.open(mailtoLink, '_blank', 'noopener,noreferrer');
      
      // Method 2: If window.open didn't work, try location.href
      if (!emailWindow) {
        window.location.href = mailtoLink;
      }
    } catch (error) {
      // Fallback: create and click a link
      const link = document.createElement('a');
      link.href = mailtoLink;
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const copyEmailContent = async () => {
    if (!candidateData?.email) {
      toast.error("Candidate email not available");
      return;
    }

    const emailContent = `To: ${candidateData.email}
Subject: ${emailSubject}

${emailBody}`;

    try {
      await navigator.clipboard.writeText(emailContent);
      toast.success("Email content copied to clipboard!");
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = emailContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success("Email content copied to clipboard!");
    }
  };

  const openGmail = () => {
    if (!candidateData?.email) {
      toast.error("Candidate email not available");
      return;
    }

    // Gmail has character limits on URL parameters, so we'll include subject in body if URL gets too long
    const maxUrlLength = 2000; // Conservative limit
    let gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(candidateData.email)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    // If URL is too long, put subject in the body
    if (gmailUrl.length > maxUrlLength) {
      const bodyWithSubject = `Subject: ${emailSubject}\n\n${emailBody}`;
      gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(candidateData.email)}&body=${encodeURIComponent(bodyWithSubject)}`;
    }
    
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const openOutlookWeb = () => {
    if (!candidateData?.email) {
      toast.error("Candidate email not available");
      return;
    }

    const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(candidateData.email)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(outlookUrl, '_blank', 'noopener,noreferrer');
  };

  const resetEmailGeneration = () => {
    setEmailSubject("");
    setEmailBody("");
    setHasGeneratedEmail(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        className="p-0 flex flex-col max-w-full sm:max-w-xl md:max-w-2xl w-full h-svh" 
        side="right"
      >
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-xl font-semibold tracking-tight pr-8">
            Applicant Details: {applicantName || "N/A"}
          </SheetTitle>
          <SheetDescription className="pt-1">
            Review scoring information and applicant profile.
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 h-full flex-grow px-4">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading details...</p>
          </div>
        )}

        {!isLoading && !scoringData && !candidateData && (
          <div className="flex flex-col items-center justify-center py-10 h-full flex-grow px-4">
            <p className="text-muted-foreground">No details available for this applicant.</p>
          </div>
        )}

        {!isLoading && (scoringData || candidateData) && (
          <Tabs defaultValue="scoring" className="flex-grow flex flex-col min-h-0 mt-0 mb-0">
            <TabsList className="mx-6 my-4 self-start space-x-1">
              <TabsTrigger value="scoring">Scoring Details</TabsTrigger>
              <TabsTrigger value="applicant">Applicant Information</TabsTrigger>
              <TabsTrigger value="referral">Referral</TabsTrigger>
              <TabsTrigger value="email">Email Result</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-grow min-h-0">
              <TabsContent value="scoring" className="px-6 pt-2 pb-6 space-y-3">
                {scoringData ? (
                  <>
                    <DetailItem label="Application ID" value={scoringData.application_id} />
                    {scoringData.decision && 
                        <DetailItem label="Decision" value={scoringData.decision} isBadge badgeVariant="outline" />
                    }
                    <Separator className="my-3"/>
                    <div className="grid grid-cols-1 md:grid-cols-3 items-start gap-x-4 gap-y-1 py-4">
                      <span className="text-sm font-medium text-muted-foreground md:col-span-1">Overall Score</span>
                      <div className="md:col-span-2 justify-self-start flex items-center gap-2">
                        <Badge variant="default" className="text-sm">
                          {scoringData.overall_score ? Number(scoringData.overall_score).toFixed(2) : "N/A"}
                        </Badge>
                        {scoringData.overall_score && (
                          <span className="text-sm text-muted-foreground">({Math.round((Number(scoringData.overall_score) / 5) * 100)}%)</span>
                        )}
                      </div>
                    </div>
                    <DetailItem label="Overall Summary" value={scoringData.overall_summary || "N/A"} className="pb-1"/>
                    <Separator className="my-3"/>

                    <ReviewSection title="Experience Assessment" score={scoringData.experience_score} review={scoringData.experience_review} />
                    <ReviewSection title="Education Assessment" score={scoringData.education_score} review={scoringData.education_review} />
                    <ReviewSection title="Skills Match Assessment" score={scoringData.skills_score} review={scoringData.skills_review} />
                    <ReviewSection title="Role Fit Assessment" score={scoringData.role_fit_score} review={scoringData.role_fit_review} />
                    <ReviewSection title="Certifications Assessment" score={scoringData.certifications_score} review={scoringData.certifications_review} />
                    <ReviewSection title="Project Impact Assessment" score={scoringData.project_impact_score} review={scoringData.project_impact_review} />
                    <ReviewSection title="Soft Skills Assessment" score={scoringData.soft_skills_score} review={scoringData.soft_skills_review} />
                    
                    {scoringData.skills_completeness && (
                        <>
                            <Separator className="my-3"/>
                            <h4 className="text-md font-semibold text-foreground mb-1">Skills Completeness</h4>
                            <div className="border rounded-md">
                              <ul className="divide-y divide-border">
                                {typeof scoringData.skills_completeness === 'string' ? (
                                  <li className="p-3 text-sm text-muted-foreground">{scoringData.skills_completeness}</li>
                                ) : Array.isArray(scoringData.skills_completeness) ? (
                                  scoringData.skills_completeness.map((item: any, index) => (
                                    <li key={index} className="py-3 px-3 flex justify-between items-start">
                                      <div className="w-[85%] pr-4">
                                        <p className="text-sm font-medium text-foreground">{item.requirement}</p>
                                        {item.reasoning && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {item.reasoning}
                                          </p>
                                        )}
                                      </div>
                                      <div className="w-[15%] flex justify-end items-start pt-0.5">
                                        <StatusBadge status={item.status as string} />
                                      </div>
                                    </li>
                                  ))
                                ) : (
                                  Object.entries(scoringData.skills_completeness as Record<string, string | boolean>).map(([skill, status], index) => (
                                    <li key={index} className="py-3 px-3 flex justify-between items-start">
                                      <div className="w-[85%] pr-4">
                                        <p className="text-sm font-medium text-foreground">{skill}</p>
                                      </div>
                                      <div className="w-[15%] flex justify-end items-start pt-0.5">
                                        <StatusBadge status={status as string | boolean} />
                                      </div>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                        </>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground p-4 text-center">No scoring details available for this applicant.</p>
                )}
              </TabsContent>

              <TabsContent value="applicant" className="px-6 pt-4 pb-6">
                {candidateData ? (
                  <CandidateInformation
                    candidate={candidateData}
                    applicantName={applicantName}
                    showApplicationsList={true}
                    applications={applications}
                    isLoadingApplications={isLoadingApplications}
                    onApplicationStatusUpdate={handleApplicationStatusUpdate}
                    updatingStatuses={updatingStatuses}
                    onViewResume={handleViewResumeClick}
                    isFetchingResumeUrl={isFetchingResumeUrl}
                  />
                ) : (
                  <p className="text-muted-foreground p-4 text-center">No applicant profile information available.</p>
                )}
              </TabsContent>

              <TabsContent value="referral" className="px-6 pt-2 pb-6 space-y-2">
                <div className="space-y-1 p-1">
                  {!isEditingReferral ? (
                    <div 
                      onDoubleClick={handleStartEditReferral}
                      className="cursor-pointer hover:bg-muted/50 rounded-md p-2 transition-colors group"
                      title="Double-click to edit referral information"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <DetailItem 
                            label="Referral Name" 
                            value={referralName || "No referral"} 
                            isBadge={!!referralName} 
                            badgeVariant="outline" 
                          />
                          {referralName && (
                            <DetailItem 
                              label="Referral Email" 
                              value={referralEmail || "No email provided"} 
                              isBadge={!!referralEmail} 
                              badgeVariant="outline" 
                            />
                          )}
                          {referralName && referralPosition && (
                            <DetailItem 
                              label="Referral Position" 
                              value={referralPosition} 
                              isBadge={true} 
                              badgeVariant="outline" 
                            />
                          )}
                          {referralName && referralDept && (
                            <DetailItem 
                              label="Referral Department" 
                              value={referralDept} 
                              isBadge={true} 
                              badgeVariant="outline" 
                            />
                          )}
                        </div>
                        <Edit3 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Double-click to edit
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 p-2 border rounded-md bg-muted/20">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Referral Name
                        </label>
                        <Input
                          value={editReferralName}
                          onChange={(e) => setEditReferralName(e.target.value)}
                          placeholder="Enter referral name"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Referral Email
                        </label>
                        <Input
                          value={editReferralEmail}
                          onChange={(e) => setEditReferralEmail(e.target.value)}
                          placeholder="Enter referral email"
                          type="email"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Referral Position
                        </label>
                        <Input
                          value={editReferralPosition}
                          onChange={(e) => setEditReferralPosition(e.target.value)}
                          placeholder="Enter referral position/role"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Referral Department
                        </label>
                        <Input
                          value={editReferralDept}
                          onChange={(e) => setEditReferralDept(e.target.value)}
                          placeholder="Enter referral department"
                          className="w-full"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEditReferral}
                          disabled={isSavingReferral}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveReferral}
                          disabled={isSavingReferral}
                        >
                          {isSavingReferral ? (
                            <LoaderCircle className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          {isSavingReferral ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="email" className="px-6 pt-2 pb-6 space-y-4">
                {!hasGeneratedEmail ? (
                  <div className="flex items-center justify-center min-h-[300px]">
                    <div className="text-center space-y-4">
                      <div className="w-24 h-24 mx-auto bg-muted rounded-lg flex items-center justify-center">
                        <Mail className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium">Generate Email Content</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Create a personalized email for the candidate based on their application results
                        </p>
                      </div>
                      <Button 
                        onClick={generateEmailContent}
                        disabled={isGeneratingEmail || !scoringData || !candidateData}
                        size="lg"
                      >
                        {isGeneratingEmail ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            Generate Email
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Email Content</h3>
                      <Button variant="outline" size="sm" onClick={resetEmailGeneration}>
                        <X className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Subject
                        </label>
                        <Input
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Email subject"
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Message Body
                        </label>
                        <Textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          placeholder="Email body"
                          className="w-full min-h-[300px] resize-none"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-between pt-4 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          toast.info("Chrome: chrome://settings/content/handlers → Reset 'mailto' | Firefox: Settings → Applications → mailto → Always ask", {
                            duration: 6000,
                          });
                        }}
                        className="text-xs"
                      >
                        Reset Email Client
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={resetEmailGeneration}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              disabled={!emailSubject.trim() || !emailBody.trim() || !candidateData?.email}
                            >
                              <Mail className="h-4 w-4 mr-1" />
                              Send Email
                              <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={sendEmail}>
                              <Mail className="h-4 w-4 mr-2" />
                              Default Email Client
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={openGmail}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open in Gmail
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={openOutlookWeb}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open in Outlook Web
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={copyEmailContent}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy to Clipboard
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assessment" className="px-6 pt-2 pb-6">
                {candidateData ? (
                  <CandidateAssessment
                    candidate={candidateData}
                    applications={applications}
                    onApplicationsRefresh={() => {
                      if (candidateData.id) {
                        fetchApplications(candidateData.id);
                      }
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground p-4 text-center">No candidate data available for assessment.</p>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>)}
        
        <SheetFooter className="p-6 pt-4 border-t bg-background shrink-0">
            <SheetClose asChild>
                <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto">
                Close
                </Button>
            </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}