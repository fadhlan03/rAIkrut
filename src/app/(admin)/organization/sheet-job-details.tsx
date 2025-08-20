"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose
} from "@/components/ui/sheet";
import { JobVacancy } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InternalJobMatcher, SimilarJob, InternalJobMatcherProps } from "@/components/dashboard/internal-job-matcher";
import * as React from "react";
import { JobVacancyWithUIState } from './organization-client';

interface SheetJobDetailsProps {
  job: JobVacancy | JobVacancyWithUIState | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// Helper to render text or array of text as a list
const renderTextAsList = (content: any, fallbackText: string) => {
  if (!content) {
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{fallbackText}</p>;
  }

  if (Array.isArray(content)) {
    if (content.length === 0) {
      return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{fallbackText}</p>;
    }
    return (
      <ul className="list-disc list-outside space-y-1 text-sm text-muted-foreground leading-relaxed pl-5">
        {content.map((item, index) => (
          <li key={index} className="pl-1">
            {typeof item === 'string' ? item : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof content === 'string' && content.trim() !== '') {
    // If it's a non-empty string, render as a paragraph.
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{content}</p>;
  }
  
  // Fallback for other types or empty content
  return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{fallbackText}</p>;
};

export function SheetJobDetails({ job, isOpen, onOpenChange }: SheetJobDetailsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<string>("details");
  
  // State for InternalJobMatcher to persist across tab switches
  const [similarJobs, setSimilarJobs] = React.useState<SimilarJob[]>([]);
  const [isMatchingLoading, setIsMatchingLoading] = React.useState(false);
  
  // Set active tab to internal-matcher if opened from Internal Matcher button
  React.useEffect(() => {
    if (job && '_internalMatcherTab' in job) {
      setActiveTab("internal-matcher");
    }
  }, [job]);
  
  // Reset internal matcher state when job changes
  React.useEffect(() => {
    setSimilarJobs([]);
    setIsMatchingLoading(false);
  }, [job?.id]);
  
  if (!job) {
    return null;
  }

  const formattedDate = job.created_at 
    ? format(new Date(job.created_at), 'dd MMM yyyy') 
    : 'N/A';

  const handleEditJob = () => {
    router.push(`/jobs/${job.id}/edit`);
    onOpenChange(false); // Close the sheet when navigating
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-primary/10 text-primary';
      case 'draft':
        return 'bg-accent text-accent-foreground';
      case 'archived':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary/10 text-secondary';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        className="p-0 flex flex-col max-w-full sm:max-w-xl w-full h-svh" 
        side="right"
        style={{
          isolation: 'isolate',
          zIndex: 150
        }}
      >
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-8">
              <SheetTitle className="text-xl font-semibold tracking-tight">{job.title || "Job Details"}</SheetTitle>
            {/* Job Attribute */}
            {job.attribute && job.attribute.trim() !== '' && (
              <div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
                  {job.attribute}
                </p>
              </div>
            )}
            </div>
            <Badge className={getStatusColor(job.status)}>
              {job.status}
            </Badge>
          </div>
        </SheetHeader>

        <div className="px-6 pt-4 pb-0">
          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="internal-matcher">Internal Matcher</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <ScrollArea className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="details" className="mt-0">
              <div className="px-6 pt-4 pb-6 space-y-5">
                <div>
                  <h3 className="text-md font-semibold text-foreground mb-1.5">Overview</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
                    {job.description || "No overview provided."}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-md font-semibold text-foreground mb-1.5">Job Description</h3>
                  {renderTextAsList(job.job_desc, "No detailed description provided.")}
                </div>
                
                <div>
                  <h3 className="text-md font-semibold text-foreground mb-1.5">Requirements</h3>
                  {renderTextAsList(job.requirements, "No requirements specified.")}
                </div>
                
                {/* Benefits Section - Only show if benefits exist and are not empty */}
                {job.benefits && Array.isArray(job.benefits) && job.benefits.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-foreground mb-1.5">Benefits</h3>
                    {renderTextAsList(job.benefits, "No benefits specified.")}
                  </div>
                )}
                
                {/* Additional Information Section - Only show if info exists and is not empty */}
                {job.info && job.info.trim() !== '' && (
                  <div>
                    <h3 className="text-md font-semibold text-foreground mb-1.5">Additional Information</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
                      {job.info}
                    </p>
                  </div>
                )}

                {/* Department Position */}
                {job.deptPosition && (
                  <div>
                    <h3 className="text-md font-semibold text-foreground mb-1.5">Department Position</h3>
                    <p className="text-sm text-muted-foreground">
                      Position #{job.deptPosition}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="internal-matcher" className="mt-0">
              <div className="px-6 pt-4 pb-6">
                <InternalJobMatcher 
                  currentJobDesc={Array.isArray(job.job_desc) ? job.job_desc : []}
                  currentRequirements={Array.isArray(job.requirements) ? job.requirements : []}
                  currentOverview={job.description || ""}
                  currentJobId={job.id}
                  similarJobs={similarJobs}
                  setSimilarJobs={setSimilarJobs}
                  isMatchingLoading={isMatchingLoading}
                  setIsMatchingLoading={setIsMatchingLoading}
                />
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
        
        {/* Edit Button */}
        <div className="p-6 pt-4 border-t shrink-0">
          <Button 
            onClick={handleEditJob}
            className="w-full"
            variant="default"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Job
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}