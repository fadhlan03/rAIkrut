"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { JobVacancy } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface SheetApplyProps {
  job: JobVacancy | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  showApplyButton?: boolean;
  hasApplied?: boolean;
}

// Helper function to remove citations like [1], [2], [123], [1, 2, 3], [1,2,3] from text
const removeCitations = (text: string): string => {
  return text.replace(/\[\d+(?:,\s*\d+)*\]/g, '').trim();
};

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
            {typeof item === 'string' ? removeCitations(item) : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof content === 'string' && content.trim() !== '') {
    // If it's a non-empty string, render as a paragraph.
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{removeCitations(content)}</p>;
  }
  
  // Fallback for other types or empty content
  return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{fallbackText}</p>;
};

export function SheetApply({ job, isOpen, onOpenChange, showApplyButton = true, hasApplied = false }: SheetApplyProps) {
  const router = useRouter();

  if (!job) {
    return null;
  }

  const handleApply = () => {
    if (job?.id) {
      router.push(`/apply/${job.id}`);
    }
  };

  const formattedDate = job.created_at 
    ? format(new Date(job.created_at), 'dd MMM yyyy') 
    : 'N/A';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        className="p-0 flex flex-col max-w-full sm:max-w-xl w-full h-svh" 
        side="right"
        style={{
          isolation: 'isolate',
          zIndex: 100
        }}
      >
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-xl font-semibold tracking-tight pr-8">{job.title || "Job Details"}</SheetTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Posted on {formattedDate}
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-6 pt-4 pb-6 space-y-5">
            <div>
              <h3 className="text-md font-medium text-foreground mb-1.5">Overview</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
                {job.description ? removeCitations(job.description) : "No overview provided."}
              </p>
            </div>
            <div>
              <h3 className="text-md font-medium text-foreground mb-1.5">Job Description</h3>
              {renderTextAsList(job.job_desc, "No detailed description provided.")}
            </div>
            <div>
              <h3 className="text-md font-medium text-foreground mb-1.5">Requirements</h3>
              {renderTextAsList(job.requirements, "No requirements specified.")}
            </div>
            
            {/* Benefits Section - Only show if benefits exist and are not empty */}
            {job.benefits && Array.isArray(job.benefits) && job.benefits.length > 0 && (
              <div>
                <h3 className="text-md font-medium text-foreground mb-1.5">Benefits</h3>
                {renderTextAsList(job.benefits, "No benefits specified.")}
              </div>
            )}
            
            {/* Additional Information Section - Only show if info exists and is not empty */}
            {job.info && job.info.trim() !== '' && (
              <div>
                <h3 className="text-md font-medium text-foreground mb-1.5">Additional Information</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
                  {job.info}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {showApplyButton && (
          <SheetFooter className="p-6 pt-4 border-t bg-background shrink-0">
            <div className="flex w-full justify-start">
              {hasApplied ? (
                <div className="flex flex-col gap-2">
                  <Button disabled size="lg" variant="outline">
                    Already Applied
                  </Button>
                </div>
              ) : (
                <Button onClick={handleApply} size="lg">Apply Now</Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
} 