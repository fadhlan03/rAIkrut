'use client';

import * as React from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";

export interface SimilarJob {
  id: string;
  title: string;
  description: string;
  job_desc: string[];
  requirements: string[];
  similarity: number;
  dept_id?: string;
  department_name?: string;
  department_email?: string;
}

export interface InternalJobMatcherProps {
  currentJobDesc?: string[];
  currentRequirements?: string[];
  currentOverview?: string;
  currentJobId?: string; // Job ID to exclude from search results
  // Props for state management to persist across tab switches
  similarJobs?: SimilarJob[];
  setSimilarJobs?: (jobs: SimilarJob[]) => void;
  isMatchingLoading?: boolean;
  setIsMatchingLoading?: (loading: boolean) => void;
}

export function InternalJobMatcher({
  currentJobDesc = [],
  currentRequirements = [],
  currentOverview = "",
  currentJobId,
  similarJobs: externalSimilarJobs,
  setSimilarJobs: externalSetSimilarJobs,
  isMatchingLoading: externalIsMatchingLoading,
  setIsMatchingLoading: externalSetIsMatchingLoading
}: InternalJobMatcherProps) {
  // Use external state if provided, otherwise fall back to local state
  const [internalSimilarJobs, setInternalSimilarJobs] = React.useState<SimilarJob[]>([]);
  const [internalIsMatchingLoading, setInternalIsMatchingLoading] = React.useState(false);
  const [showLowSimilarity, setShowLowSimilarity] = React.useState(false);
  
  const similarJobs = externalSimilarJobs ?? internalSimilarJobs;
  const setSimilarJobs = externalSetSimilarJobs ?? setInternalSimilarJobs;
  const isMatchingLoading = externalIsMatchingLoading ?? internalIsMatchingLoading;
  const setIsMatchingLoading = externalSetIsMatchingLoading ?? setInternalIsMatchingLoading;

  const handleMatchAnalysis = async () => {
    // Get current job description and requirements from the form data
    const formJobDesc = currentJobDesc && currentJobDesc.length > 0 ? currentJobDesc.join('. ') : '';
    const formRequirements = currentRequirements && currentRequirements.length > 0 ? currentRequirements.join('. ') : '';
    const formOverview = currentOverview || '';
    
    if (!formJobDesc && !formRequirements && !formOverview) {
      toast.error("Please add job descriptions, requirements, or overview in the form first");
      return;
    }

    setIsMatchingLoading(true);
    setSimilarJobs([]);

    try {
      const response = await fetch('/api/internal-matcher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentJobDesc: formJobDesc || 'No job description provided',
          currentRequirements: formRequirements || 'No requirements provided',
          currentOverview: formOverview || 'No overview provided',
          excludeJobId: currentJobId // Exclude current job from results
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze job matches');
      }

      const data = await response.json();
      setSimilarJobs(data.data || []);
      
      if (data.data && data.data.length > 0) {
        toast.success(`Found ${data.data.length} similar jobs`);
      } else {
        toast.info("No similar jobs found");
      }
    } catch (error) {
      console.error('Error analyzing job matches:', error);
      toast.error('Failed to analyze job matches');
    } finally {
      setIsMatchingLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Match Analysis Button */}
      <div className="flex flex-col gap-3">
        <div className="text-xs text-muted-foreground">
          Analyze job similarity using job descriptions, requirements, and overview from the current form.
        </div>
        <Button
          onClick={handleMatchAnalysis}
          disabled={isMatchingLoading || ((!currentJobDesc || currentJobDesc.length === 0) && (!currentRequirements || currentRequirements.length === 0) && !currentOverview)}
          className="w-full"
        >
          {isMatchingLoading ? (
            <>
              <LoaderCircle className="animate-spin h-4 w-4" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Match Analysis
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {similarJobs.length > 0 && (() => {
        const highSimilarityJobs = similarJobs.filter(job => job.similarity >= 40);
        const lowSimilarityJobs = similarJobs.filter(job => job.similarity < 40);
        
        return (
          <>
            <div className="text-sm font-medium">
              Found {similarJobs.length} similar jobs
              {highSimilarityJobs.length > 0 && (
                <span className="text-muted-foreground ml-2">
                  ({highSimilarityJobs.length} high similarity)
                </span>
              )}
            </div>
            <ScrollArea className="h-[calc(100vh-380px)] pr-4">
              <div className="space-y-4">
                {/* High Similarity Jobs (>=40%) */}
                {highSimilarityJobs.length > 0 && (
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {highSimilarityJobs.map((job) => (
                      <AccordionItem key={job.id} value={job.id} className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex justify-between items-center w-full pr-4">
                            <div className="text-left">
                              <h4 className="font-semibold">{job.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                Dept: {job.department_name || "-"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Email: {job.department_email || (job.department_name ? `${job.department_name.toLowerCase().replace(/\s+/g, '')}@telkomsel.com` : 'mail@telkomsel.com')}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-lg font-bold text-primary">
                                {job.similarity}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Similarity
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-4 pt-2">
                            {/* Job Description */}
                            {job.job_desc && job.job_desc.length > 0 && (
                              <div>
                                <h5 className="text-sm font-semibold mb-2">Job Description</h5>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {job.job_desc.map((desc, index) => (
                                    <li key={index} className="flex items-start gap-2 ">
                                      <span className="text-primary">•</span>
                                      <span>{desc}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Requirements */}
                            {job.requirements && job.requirements.length > 0 && (
                              <div>
                                <h5 className="text-sm font-semibold mb-2">Requirements</h5>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {job.requirements.map((req, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-primary">•</span>
                                      <span>{req}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}

                {/* Low Similarity Jobs (<40%) - Show More Section */}
                {lowSimilarityJobs.length > 0 && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLowSimilarity(!showLowSimilarity)}
                      className="w-full mb-4"
                    >
                      {showLowSimilarity ? 'Hide' : 'Show more'} ({lowSimilarityJobs.length} jobs with lower similarity)
                    </Button>
                    
                    {showLowSimilarity && (
                      <Accordion type="single" collapsible className="w-full space-y-2">
                        {lowSimilarityJobs.map((job) => (
                          <AccordionItem key={job.id} value={job.id} className="border rounded-lg px-4 opacity-75">
                            <AccordionTrigger className="hover:no-underline py-4">
                              <div className="flex justify-between items-center w-full pr-4">
                                <div className="text-left">
                                  <h4 className="font-semibold">{job.title}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Dept: {job.department_name || "-"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Email: {job.department_email || (job.department_name ? `${job.department_name.toLowerCase().replace(/\s+/g, '')}@telkomsel.com` : 'mail@telkomsel.com')}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-lg font-bold text-muted-foreground">
                                    {job.similarity}%
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Similarity
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="space-y-4 pt-2">
                                {/* Job Description */}
                                {job.job_desc && job.job_desc.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-semibold mb-2">Job Description</h5>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                      {job.job_desc.map((desc, index) => (
                                        <li key={index} className="flex items-start gap-2 ">
                                          <span className="text-primary">•</span>
                                          <span>{desc}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Requirements */}
                                {job.requirements && job.requirements.length > 0 && (
                                  <div>
                                    <h5 className="text-sm font-semibold mb-2">Requirements</h5>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                      {job.requirements.map((req, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                          <span className="text-primary">•</span>
                                          <span>{req}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        );
      })()}

      {/* Empty State */}
      {!isMatchingLoading && similarJobs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No job matches found yet.</p>
          <p className="text-sm mt-2">Click "Match Analysis" to find similar jobs.</p>
        </div>
      )}
    </div>
  );
}