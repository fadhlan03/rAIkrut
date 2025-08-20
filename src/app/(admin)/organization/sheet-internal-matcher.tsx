"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LoaderCircle, Search, Plus, X, Sparkles } from "lucide-react";
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

interface SheetInternalMatcherProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface JobDescItem {
  value: string;
}

interface RequirementItem {
  value: string;
}

export function SheetInternalMatcher({ isOpen, onOpenChange }: SheetInternalMatcherProps) {
  const [activeTab, setActiveTab] = React.useState<string>("input");
  const [overview, setOverview] = React.useState("");
  const [jobDescItems, setJobDescItems] = React.useState<JobDescItem[]>([{ value: "" }]);
  const [requirementItems, setRequirementItems] = React.useState<RequirementItem[]>([{ value: "" }]);
  const [similarJobs, setSimilarJobs] = React.useState<SimilarJob[]>([]);
  const [isMatchingLoading, setIsMatchingLoading] = React.useState(false);
  const [isGeneratingJobDesc, setIsGeneratingJobDesc] = React.useState(false);
  const [isGeneratingRequirements, setIsGeneratingRequirements] = React.useState(false);
  const [showLowSimilarity, setShowLowSimilarity] = React.useState(false);

  // Reset form when sheet opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab("input");
      setOverview("");
      setJobDescItems([{ value: "" }]);
      setRequirementItems([{ value: "" }]);
      setSimilarJobs([]);
      setShowLowSimilarity(false);
    }
  }, [isOpen]);

  const addJobDescItem = () => {
    setJobDescItems([...jobDescItems, { value: "" }]);
  };

  const removeJobDescItem = (index: number) => {
    if (jobDescItems.length > 1) {
      setJobDescItems(jobDescItems.filter((_, i) => i !== index));
    }
  };

  const updateJobDescItem = (index: number, value: string) => {
    const updated = [...jobDescItems];
    updated[index] = { value };
    setJobDescItems(updated);
  };

  const addRequirementItem = () => {
    setRequirementItems([...requirementItems, { value: "" }]);
  };

  const removeRequirementItem = (index: number) => {
    if (requirementItems.length > 1) {
      setRequirementItems(requirementItems.filter((_, i) => i !== index));
    }
  };

  const updateRequirementItem = (index: number, value: string) => {
    const updated = [...requirementItems];
    updated[index] = { value };
    setRequirementItems(updated);
  };

  const generateJobDescriptions = async () => {
    if (!overview.trim()) {
      toast.error("Please provide an overview first to generate job descriptions");
      return;
    }

    setIsGeneratingJobDesc(true);
    try {
      const response = await fetch('/api/generate-job-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          section: 'job_desc',
          existingData: {
            description: overview,
            job_desc: [],
            requirements: []
          },
          temperature: 0.7
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate job descriptions');
      }

      const data = await response.json();
      if (data.success && data.data && data.data.content && Array.isArray(data.data.content)) {
        setJobDescItems(data.data.content.map((desc: string) => ({ value: desc })));
        toast.success("Job descriptions generated successfully!");
      } else {
        toast.error("Failed to generate job descriptions");
      }
    } catch (error) {
      console.error('Error generating job descriptions:', error);
      toast.error("Failed to generate job descriptions");
    } finally {
      setIsGeneratingJobDesc(false);
    }
  };

  const generateRequirements = async () => {
    if (!overview.trim()) {
      toast.error("Please provide an overview first to generate requirements");
      return;
    }

    setIsGeneratingRequirements(true);
    try {
      const response = await fetch('/api/generate-job-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          section: 'requirements',
          existingData: {
            description: overview,
            job_desc: jobDescItems.map(item => item.value).filter(value => value.trim() !== ''),
            requirements: []
          },
          temperature: 0.7
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate requirements');
      }

      const data = await response.json();
      if (data.success && data.data && data.data.content && Array.isArray(data.data.content)) {
        setRequirementItems(data.data.content.map((req: string) => ({ value: req })));
        toast.success("Requirements generated successfully!");
      } else {
        toast.error("Failed to generate requirements");
      }
    } catch (error) {
      console.error('Error generating requirements:', error);
      toast.error("Failed to generate requirements");
    } finally {
      setIsGeneratingRequirements(false);
    }
  };

  const handleMatchAnalysis = async () => {
    // Get current job description and requirements from the form data
    const formJobDesc = jobDescItems.filter(item => item.value.trim() !== "").map(item => item.value);
    const formRequirements = requirementItems.filter(item => item.value.trim() !== "").map(item => item.value);
    const formOverview = overview.trim();
    
    if (formJobDesc.length === 0 && formRequirements.length === 0 && !formOverview) {
      toast.error("Please add job descriptions, requirements, or overview first");
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
          currentJobDesc: formJobDesc.join('. ') || 'No job description provided',
          currentRequirements: formRequirements.join('. ') || 'No requirements provided',
          currentOverview: formOverview || 'No overview provided'
          // No excludeJobId since this is for creating new jobs
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze job matches');
      }

      const data = await response.json();
      setSimilarJobs(data.data || []);
      
      if (data.data && data.data.length > 0) {
        toast.success(`Found ${data.data.length} similar jobs`);
        setActiveTab("results"); // Switch to results tab
      } else {
        toast.info("No similar jobs found");
        setActiveTab("results"); // Still switch to show empty state
      }
    } catch (error) {
      console.error('Error analyzing job matches:', error);
      toast.error('Failed to analyze job matches');
    } finally {
      setIsMatchingLoading(false);
    }
  };

  const canAnalyze = overview.trim() !== "" || 
    jobDescItems.some(item => item.value.trim() !== "") || 
    requirementItems.some(item => item.value.trim() !== "");

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
          <SheetTitle className="text-xl font-semibold tracking-tight">Internal Job Matcher</SheetTitle>
        </SheetHeader>

        <div className="px-6 pt-4 pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <ScrollArea className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="input" className="mt-0">
              <div className="px-6 pt-4 pb-6 space-y-5">
                {/* Overview/Description Field */}
                <div>
                  <Label htmlFor="overview" className="mb-1.5 block text-sm font-medium text-foreground">Overview</Label>
                  <Textarea
                    id="overview"
                    placeholder="Provide a brief summary of the role."
                    rows={4}
                    value={overview}
                    onChange={(e) => setOverview(e.target.value)}
                  />
                </div>

                {/* Job Description Field Array */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="block text-sm font-medium text-foreground">Job Description</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={generateJobDescriptions}
                      disabled={!overview.trim() || isGeneratingJobDesc}
                      className="h-8 px-2"
                    >
                      {isGeneratingJobDesc ? (
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {jobDescItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Input
                        placeholder={`Description item ${index + 1}`}
                        value={item.value}
                        onChange={(e) => updateJobDescItem(index, e.target.value)}
                        className="flex-grow"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mt-1 flex-shrink-0"
                        onClick={() => removeJobDescItem(index)}
                        disabled={jobDescItems.length <= 1}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={addJobDescItem}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>

                {/* Requirements Field Array */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="block text-sm font-medium text-foreground">Requirements</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={generateRequirements}
                      disabled={!overview.trim() || isGeneratingRequirements}
                      className="h-8 px-2"
                    >
                      {isGeneratingRequirements ? (
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {requirementItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Input
                        placeholder={`Requirement item ${index + 1}`}
                        value={item.value}
                        onChange={(e) => updateRequirementItem(index, e.target.value)}
                        className="flex-grow"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mt-1 flex-shrink-0"
                        onClick={() => removeRequirementItem(index)}
                        disabled={requirementItems.length <= 1}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={addRequirementItem}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>

                {/* Match Analysis Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleMatchAnalysis}
                    disabled={isMatchingLoading || !canAnalyze}
                    className="w-full"
                  >
                    {isMatchingLoading ? (
                      <>
                        <LoaderCircle className="animate-spin h-4 w-4" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        Start Match Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="results" className="mt-0">
              <div className="px-6 pt-4 pb-6">
                {/* Results */}
                {similarJobs.length > 0 && (() => {
                  const highSimilarityJobs = similarJobs.filter(job => job.similarity >= 40);
                  const lowSimilarityJobs = similarJobs.filter(job => job.similarity < 40);
                  
                  return (
                    <>
                      <div className="text-sm font-medium mb-4">
                        Found {similarJobs.length} similar jobs
                        {highSimilarityJobs.length > 0 && (
                          <span className="text-muted-foreground ml-2">
                            ({highSimilarityJobs.length} high similarity)
                          </span>
                        )}
                      </div>

                      {/* High Similarity Jobs (>=40%) */}
                      {highSimilarityJobs.length > 0 && (
                        <Accordion type="single" collapsible className="w-full space-y-2 mb-4">
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
                                          <li key={index} className="flex items-start gap-2">
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
                        <div className="mt-6">
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
                                              <li key={index} className="flex items-start gap-2">
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
                    </>
                  );
                })()}

                {/* Empty State */}
                {!isMatchingLoading && similarJobs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No job matches found yet.</p>
                    <p className="text-sm mt-2">Go to the Input tab to start matching.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}