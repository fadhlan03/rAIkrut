"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Candidate, EducationEntry, WorkExperienceEntry, OrgExperienceEntry, CandidateApplication, ApplicationStatus } from "@/types/database";
import { 
  FileText, 
  Briefcase, 
  GraduationCap, 
  Users, 
  Target, 
  UserCircle, 
  Info, 
  Loader2, 
  Building, 
  Check, 
  X 
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from 'next/link';

interface CandidateInformationProps {
  candidate: Candidate;
  applicantName?: string; // For cases where we might have a different display name
  showApplicationsList?: boolean; // Whether to show the applications list section
  applications?: CandidateApplication[];
  isLoadingApplications?: boolean;
  onApplicationStatusUpdate?: (applicationId: string, newStatus: ApplicationStatus) => void;
  updatingStatuses?: Set<string>;
  onViewResume?: () => void;
  isFetchingResumeUrl?: boolean;
}

// Helper function to calculate age
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

// Helper function to format date ranges
const formatDateRange = (startDate?: string, endDate?: string): string => {
  let start = startDate?.trim() || '';
  let end = endDate?.trim() || '';
  
  // Handle complex case where start_date already contains a full date range
  // e.g., start_date: "Feb 2022 - Aug 2023" and end_date: "Present"
  if (start.includes(' - ') && (end.toLowerCase() === 'present' || end === '')) {
    // Check if start_date ends with a date (not "Present"), and end_date is "Present"
    // In this case, the start_date already contains the complete date range
    if (end.toLowerCase() === 'present' && !start.toLowerCase().includes('present')) {
      // start_date has "start - end" format, and current job should not add "Present"
      // because the person has already left this job
      return start;
    } else if (end.toLowerCase() === 'present' && start.toLowerCase().includes('present')) {
      // start_date already has "- Present", don't add another
      return start;
    }
    return start; // start_date already has the full range
  }
  
  // Handle case where start_date contains full range but end_date has redundant info
  if (start.includes(' - ') && end.includes(' - ')) {
    // Both contain ranges, likely malformed. Use just the start_date
    return start;
  }
  
  // Clean up malformed data where end_date might contain " - Present" suffix
  // This handles cases where the LLM returns "March 2025 - Present" as the end_date
  if (end.includes(' - Present') || end.includes(' - present')) {
    // Extract the actual end date before " - Present"
    const parts = end.split(/ - [Pp]resent/);
    if (parts.length > 0 && parts[0].trim()) {
      end = parts[0].trim();
    } else {
      // If there's nothing before " - Present", it means end should be "Present"
      end = 'Present';
    }
  }
  
  // Handle cases where end_date is exactly " - Present" (edge case)
  if (end === '- Present' || end === '- present') {
    end = 'Present';
  }
  
  // Also handle the case where start_date might be malformed similarly
  if (start.includes(' - Present') || start.includes(' - present')) {
    const parts = start.split(/ - [Pp]resent/);
    if (parts.length > 0 && parts[0].trim()) {
      start = parts[0].trim();
    } else {
      start = '';
    }
  }
  
  // If no dates provided, return N/A
  if (!start && !end) return 'N/A';
  
  // If only start date provided
  if (start && !end) return `${start} - Present`;
  
  // If only end date provided (unusual case)
  if (!start && end) {
    // If end date is "Present", it doesn't make sense without start date
    if (end.toLowerCase() === 'present') return 'N/A';
    return `- ${end}`;
  }
  
  // Both dates provided
  if (start && end) {
    // If end date is already "Present", don't add another "Present"
    if (end.toLowerCase() === 'present') return `${start} - Present`;
    return `${start} - ${end}`;
  }
  
  return 'N/A';
};

// Detail item component
const DetailItem: React.FC<{ 
  label: string; 
  value?: string | number | null; 
  isBadge?: boolean; 
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}> = ({ label, value, isBadge = false, badgeVariant = "secondary", className }) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return (
    <div className={`grid grid-cols-1 md:grid-cols-4 items-start gap-x-4 gap-y-1 py-1 ${className}`}>
      <span className="text-sm font-medium text-muted-foreground md:col-span-1">{label}</span>
      <span className="text-sm text-foreground md:col-span-2 whitespace-pre-wrap break-words">{String(value)}</span>
    </div>
  );
};

// Generic helper to render a list of items (e.g., education, experience)
const renderDetailList = <T extends object>(
  items: T[] | undefined,
  title: string,
  IconComponent: React.ElementType,
  renderItem: (item: T) => React.ReactNode,
  fallbackText: string
) => {
  if (!items || items.length === 0) {
    return (
      <div>
        <h3 className="text-md font-medium text-foreground mb-1.5 flex items-center">
          <IconComponent className="size-5 mr-2 text-primary" /> {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed ml-7">{fallbackText}</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-md font-medium text-foreground mb-2 flex items-center">
        <IconComponent className="size-5 mr-2 text-primary" /> {title}
      </h3>
      <ul className="ml-2">
        {items.map((item, index) => (
          <li key={index} className="text-sm text-muted-foreground leading-relaxed border-l-2 border-border pl-4 py-1">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export function CandidateInformation({
  candidate,
  applicantName,
  showApplicationsList = false,
  applications = [],
  isLoadingApplications = false,
  onApplicationStatusUpdate,
  updatingStatuses = new Set(),
  onViewResume,
  isFetchingResumeUrl = false,
}: CandidateInformationProps) {
  
  const handleStatusUpdate = React.useCallback(async (applicationId: string, newStatus: ApplicationStatus) => {
    if (onApplicationStatusUpdate) {
      onApplicationStatusUpdate(applicationId, newStatus);
    }
  }, [onApplicationStatusUpdate]);

  const age = candidate?.birthdate ? calculateAge(candidate.birthdate) : undefined;

  const renderEducationItem = (item: EducationEntry) => (
    <>
      <p className="font-semibold text-foreground/90">{item.level || '-'} at {item.institution || '-'}</p>
      {item.major && <p className="text-xs">Major: {item.major}</p>}
    </>
  );

  const renderWorkExperienceItem = (item: WorkExperienceEntry) => (
    <>
      <p className="font-semibold text-foreground/90">{item.position || '-'} at {item.company || '-'}</p>
      <p className="text-xs">{formatDateRange(item.start_date, item.end_date)}</p>
    </>
  );

  const renderOrgExperienceItem = (item: OrgExperienceEntry) => (
    <>
      <p className="font-semibold text-foreground/90">{item.role || '-'} at {item.organization_name || '-'}</p>
      <p className="text-xs">{formatDateRange(item.start_date, item.end_date)}</p>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="text-md font-medium text-foreground mb-1.5 flex items-center">
          <Info className="size-5 mr-2 text-primary" /> Basic Information
        </h3>
        <div className="ml-7">
          <DetailItem label="Full Name" value={candidate.full_name || applicantName || "N/A"} />
          <DetailItem label="Email" value={candidate.email} />
          <DetailItem label="Phone" value={candidate.phone || "N/A"} />
          <DetailItem label="Birthdate" value={candidate.birthdate ? new Date(candidate.birthdate).toLocaleDateString() : "N/A"} />
          {age !== undefined && (
            <DetailItem label="Age" value={`${age} years old`} />
          )}
        </div>
      </div>

      {/* Summary & Status */}
      <div>
        <h3 className="text-md font-medium text-foreground mb-1.5 flex items-center">
          <UserCircle className="size-5 mr-2 text-primary" /> Summary & Status
        </h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed ml-7">
          {candidate.summary || "No summary provided."}
        </p>
        <div className="mt-2 text-sm text-muted-foreground space-y-0.5 ml-7">
          <div className="flex items-center">
            <span className="w-32">Resume on file</span>
            <span className="w-4">:</span>
            <div>
              {candidate.has_resume ? (
                onViewResume ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-primary hover:text-primary/80 hover:underline h-auto font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    onClick={onViewResume}
                    disabled={isFetchingResumeUrl}
                  >
                    {isFetchingResumeUrl ? (
                      <><Loader2 className="size-4 animate-spin" /> Loading...</>
                    ) : (
                      <><FileText className="size-4" /> Yes, View</>
                    )}
                  </Button>
                ) : (
                  <span className="text-green-600 font-medium">Yes</span>
                )
              ) : (
                <span className="text-red-600 font-medium">No</span>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <span className="w-32">Job Applications</span>
            <span className="w-4">:</span>
            <span className="ml-3">{candidate.job_applications_count ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Applications Section (conditional) */}
      {showApplicationsList && (
        <div>
          <h3 className="text-md font-medium text-foreground mb-2 flex items-center">
            <Building className="size-5 mr-2 text-primary" /> Applications
          </h3>
          {isLoadingApplications ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm text-muted-foreground ml-2">Loading applications...</span>
            </div>
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted-foreground ml-7">No applications found.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden ml-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-medium">Rank</TableHead>
                    <TableHead className="text-xs font-medium">Job Name</TableHead>
                    <TableHead className="text-xs font-medium">Status</TableHead>
                    <TableHead className="text-xs font-medium">Score</TableHead>
                    <TableHead className="text-xs font-medium">Referral</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications
                    .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
                    .map((app, index) => (
                    <TableRow key={app.application_id} className="hover:bg-muted/25">
                      <TableCell className="text-sm py-2 font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-sm py-2">
                        <Link 
                          href={`/jobs/${app.job_id}`}
                          className="text-primary hover:text-primary/80 hover:underline cursor-pointer transition-colors"
                        >
                          {app.job_title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm py-2">
                        {onApplicationStatusUpdate ? (
                          <Select
                            value={app.status}
                            onValueChange={(value: ApplicationStatus) => handleStatusUpdate(app.application_id, value)}
                            disabled={updatingStatuses.has(app.application_id)}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue />
                              {updatingStatuses.has(app.application_id) && (
                                <Loader2 className="size-3 animate-spin" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Auto-Assessed">Auto-Assessed</SelectItem>
                              <SelectItem value="Reviewed">Reviewed</SelectItem>
                              <SelectItem value="Interviewing">Interviewing</SelectItem>
                              <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                              <SelectItem value="Offered">Offered</SelectItem>
                              <SelectItem value="Hired">Hired</SelectItem>
                              <SelectItem value="Onboard">Onboard</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                              <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                              <SelectItem value="On Hold">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{app.status}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm py-2">
                        {app.overall_score ? `${Math.round(app.overall_score * 20)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm py-2">
                        {app.referral_name ? (
                          <Check className="size-4 text-green-600" />
                        ) : (
                          <X className="size-4 text-red-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Job Interests */}
      {candidate.job_interest && candidate.job_interest.length > 0 && (
        <div>
          <h3 className="text-md font-medium text-foreground mb-1.5 flex items-center">
            <Target className="size-5 mr-2 text-primary" /> Job Interests
          </h3>
          <div className="ml-7">
            <ul className="list-disc list-outside space-y-1 text-sm text-muted-foreground leading-relaxed pl-5">
              {candidate.job_interest.map((interest: string, index: number) => (
                <li key={index} className="pl-1">{interest}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Education History */}
      {renderDetailList(candidate.education, "Education History", GraduationCap, renderEducationItem, "No education history provided.")}

      {/* Work Experience */}
      {renderDetailList(candidate.work_experience, "Work Experience", Briefcase, renderWorkExperienceItem, "No work experience provided.")}

      {/* Organizational Experience */}
      {renderDetailList(candidate.org_experience as OrgExperienceEntry[] | undefined, "Organizational Experience", Users, renderOrgExperienceItem, "No organizational experience provided.")}
    </div>
  );
}
