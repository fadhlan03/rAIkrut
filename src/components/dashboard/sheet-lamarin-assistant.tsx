'use client';

import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { LoaderCircle, Circle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getJobSearchBenchmarks } from "@/app/actions";
import { format } from "date-fns";
import { InternalJobMatcher } from "./internal-job-matcher";

const industries = [
  "Telecommunications",
  "Technology",
  "Finance",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Education",
  "Government",
  "Custom"
];

interface BenchmarkCompany {
  company: string;
  logo: string;
  responsibilities: string[];
  requirements: string[];
  overview: string;
}

interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

interface GroundingSupport {
  segment: {
    startIndex: number;
    endIndex: number;
    text: string;
  };
  groundingChunkIndices: number[];
}

interface BenchmarkData {
  inferredRoleName?: string;
  companies: BenchmarkCompany[];
  groundingMetadata?: {
    webSearchQueries?: string[];
    groundingChunks?: GroundingChunk[];
    groundingSupports?: GroundingSupport[];
  };
}

interface JobSearchHistory {
  id: string;
  timestamp: string;
  searchRoleName: string;
  searchIndustry: string;
  creativity: string;
  results: BenchmarkData;
  groundingMetadata?: {
    webSearchQueries?: string[];
    groundingChunks?: GroundingChunk[];
    groundingSupports?: GroundingSupport[];
  };
}

// Helper function to remove citations from text
const removeCitationsFromText = (text: string): string => {
  // Remove citation patterns like [1], [2, 3], [1,2,3] etc.
  return text.replace(/\s*\[(\d+(?:,\s*\d+)*)\]/g, '').trim();
};

// Helper function to add inline citations to text based on citation patterns
const addInlineCitations = (text: string, groundingSupports?: GroundingSupport[], groundingChunks?: GroundingChunk[], hideCitations: boolean = true): React.ReactNode => {
  if (!groundingChunks || groundingChunks.length === 0) {
    return text;
  }

  // If hideCitations is true, just remove citation patterns and return clean text
  if (hideCitations) {
    return removeCitationsFromText(text);
  }

  // Simple regex to find citation patterns like [1], [2, 3], [1,2,3] etc.
  const citationRegex = /\[(\d+(?:,\s*\d+)*)\]/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    // Add text before citation
    if (startIndex > lastIndex) {
      elements.push(text.slice(lastIndex, startIndex));
    }

    // Create clickable citation
    elements.push(
      <sup key={`citation-${startIndex}`} className="text-xs text-primary ml-0.5 cursor-pointer" 
           onClick={() => {
             // Scroll to references section
             const referencesElement = document.getElementById('references');
             if (referencesElement) {
               referencesElement.scrollIntoView({ behavior: 'smooth' });
             }
           }}
           title="Click to view references">
        {fullMatch}
      </sup>
    );

    lastIndex = endIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  // If no citations were found, return original text
  return elements.length > 0 ? elements : text;
};

// Using SimilarJob interface from internal-job-matcher.tsx

interface SheetLamarinAssistantProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialJobTitle?: string;
  initialIndustry?: string;
  onSelectResponsibilities: (responsibilities: string[]) => void;
  onSelectRequirements: (requirements: string[]) => void;
  onSelectOverview: (overview: string) => void;
  onSelectJobTitle: (jobTitle: string) => void;
  currentOverview?: string;
  currentJobDesc?: string[];
  currentRequirements?: string[];
  currentJobId?: string; // Add currentJobId prop for excluding from internal matcher
  userId?: string; // Add userId prop
}

export function SheetLamarinAssistant({
  isOpen,
  onOpenChange,
  initialJobTitle = "",
  initialIndustry = "",
  onSelectResponsibilities,
  onSelectRequirements,
  onSelectOverview,
  onSelectJobTitle,
  currentOverview = "",
  currentJobDesc = [],
  currentRequirements = [],
  currentJobId,
  userId = "93a0cd60-44f7-4968-be63-0d8e76972a53" // Default to hardcoded user ID if not provided
}: SheetLamarinAssistantProps) {
  // Component now handles responsibilities, requirements, and overview
  const [formData, setFormData] = React.useState({
    roleName: initialJobTitle,
    industry: "",
    customIndustry: "",
    temperature: 0.3
  });
  const [benchmarkData, setBenchmarkData] = React.useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [selectedResponsibilities, setSelectedResponsibilities] = React.useState<string[]>([]);
  const [selectedRequirements, setSelectedRequirements] = React.useState<string[]>([]);
  const [selectedOverview, setSelectedOverview] = React.useState<string>("");
  const [selectedJobTitle, setSelectedJobTitle] = React.useState<string>("");
  const [activeTab, setActiveTab] = React.useState<string>("benchmark");
  const [searchHistory, setSearchHistory] = React.useState<JobSearchHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = React.useState<JobSearchHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [historyFilters, setHistoryFilters] = React.useState({
    roleNameFilter: "",
    industryFilter: ""
  });
  
  // Internal job matching functionality is now handled by the InternalJobMatcher component

  // Reset form when sheet opens with initial job title and industry
  React.useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ 
        ...prev, 
        roleName: initialJobTitle,
        industry: industries.includes(initialIndustry) ? initialIndustry : (initialIndustry ? "Custom" : ""),
        customIndustry: !industries.includes(initialIndustry) && initialIndustry ? initialIndustry : ""
      }));
      // Don't reset benchmarkData to keep previous search results
      // Don't reset selections to maintain state between openings
      setValidationError(null);

      // Load search history when sheet opens
      if (userId) {
        loadSearchHistory();
      }
    }
  }, [isOpen, initialJobTitle, initialIndustry, userId]);

  // Function to load search history
  const loadSearchHistory = async () => {
    if (!userId) return;

    setIsLoadingHistory(true);
    try {
      const result = await getJobSearchBenchmarks(userId);
      if (result.success && result.data) {
        const historyData = result.data as JobSearchHistory[];
        setSearchHistory(historyData);
        setFilteredHistory(historyData);
      } else {
        console.error("Failed to load search history:", result.message);
      }
    } catch (error) {
      console.error("Error loading search history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getIndustryValue = () => {
    return formData.industry === "Custom" ? formData.customIndustry : formData.industry;
  };

  const handleSearch = async () => {
    const hasRoleAndIndustry = formData.roleName && getIndustryValue();
    const hasJobData = currentOverview || (currentJobDesc && currentJobDesc.length > 0) || (currentRequirements && currentRequirements.length > 0);

    if (!hasRoleAndIndustry && !hasJobData) {
      toast.error("Please enter role and industry, or ensure there is existing job data to analyze");
      return;
    }

    setValidationError(null);
    setIsValidating(true);
    // Don't reset selections when searching for new results

    try {
      // Step 1: Validate job role and industry (only if provided)
      if (hasRoleAndIndustry) {
        const validationResponse = await fetch('/api/validate-job-input', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roleName: formData.roleName,
            industry: getIndustryValue()
          }),
        });

        const validationResult = await validationResponse.json();

        if (!validationResponse.ok || !validationResult.success) {
          throw new Error(validationResult.error || "Failed to validate input");
        }

        // If validation fails, show error and stop
        if (!validationResult.isValid) {
          setValidationError("Please Input Relevant Job Role & Industry");
          toast.error("Please Input Relevant Job Role & Industry");
          return;
        }
      }

      // Step 2: Proceed with LLM generation
      setIsValidating(false);
      setIsLoading(true);

      // Include current form data in the request if available
      interface BenchmarkRequestBody {
        roleName?: string;
        industry?: string;
        temperature: number;
        currentOverview?: string;
        currentJobDesc?: string[];
        currentRequirements?: string[];
        userId?: string; // Add userId property
      }

      const requestBody: BenchmarkRequestBody = {
        temperature: formData.temperature,
        userId: userId // Include userId in the request
      };

      // Add role and industry if provided
      if (hasRoleAndIndustry) {
        requestBody.roleName = formData.roleName;
        requestBody.industry = getIndustryValue();
      }

      // Add existing form data if available
      if (currentOverview) {
        requestBody.currentOverview = currentOverview;
      }

      if (currentJobDesc && currentJobDesc.length > 0) {
        requestBody.currentJobDesc = currentJobDesc;
      }

      if (currentRequirements && currentRequirements.length > 0) {
        requestBody.currentRequirements = currentRequirements;
      }

      const response = await fetch('/api/benchmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        setBenchmarkData(result.data);
        toast.success("Job information loaded successfully!");

        // Refresh search history after successful search
        if (userId) {
          loadSearchHistory();
        }
      } else {
        toast.error(result.error || "Failed to load data");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data. Please try again.");
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  };

  const toggleResponsibility = (responsibility: string) => {
    setSelectedResponsibilities(prev =>
      prev.includes(responsibility)
        ? prev.filter(r => r !== responsibility)
        : [...prev, responsibility]
    );
  };

  const toggleRequirement = (requirement: string) => {
    setSelectedRequirements(prev =>
      prev.includes(requirement)
        ? prev.filter(r => r !== requirement)
        : [...prev, requirement]
    );
  };

  const selectOverview = (overview: string) => {
    setSelectedOverview(overview);
    toast.success("Overview selected");
  };

  const selectJobTitle = (jobTitle: string) => {
    setSelectedJobTitle(jobTitle);
    toast.success("Job title selected");
  };

  // Function to load a specific benchmark from history
  const loadBenchmarkFromHistory = (historyItem: JobSearchHistory) => {
    // Set the form data from history
    setFormData(prev => ({
      ...prev,
      roleName: historyItem.searchRoleName,
      industry: industries.includes(historyItem.searchIndustry) ? historyItem.searchIndustry : "Custom",
      customIndustry: !industries.includes(historyItem.searchIndustry) ? historyItem.searchIndustry : "",
      temperature: parseFloat(historyItem.creativity)
    }));

    // Set the benchmark data from history
    // If groundingMetadata exists in the history item, merge it with the results
    if (historyItem.groundingMetadata) {
      const updatedResults = {
        ...historyItem.results,
        groundingMetadata: historyItem.groundingMetadata
      };
      setBenchmarkData(updatedResults);
    } else {
      setBenchmarkData(historyItem.results);
    }

    // Reset selections
    setSelectedResponsibilities([]);
    setSelectedRequirements([]);
    setSelectedOverview("");
    setSelectedJobTitle("");

    // Switch to benchmark tab
    setActiveTab("benchmark");

    toast.success("Loaded search results from history");
  };

  const handleApplySelected = () => {
    // Remove citations from selected content before passing to form
    const cleanResponsibilities = selectedResponsibilities.map(resp => removeCitationsFromText(resp));
    const cleanRequirements = selectedRequirements.map(req => removeCitationsFromText(req));
    
    onSelectResponsibilities(cleanResponsibilities);
    onSelectRequirements(cleanRequirements);

    if (selectedOverview) {
      onSelectOverview(removeCitationsFromText(selectedOverview));
    }

    if (selectedJobTitle) {
      onSelectJobTitle(removeCitationsFromText(selectedJobTitle));
    }

    // Don't close the sheet after applying selections
    // onOpenChange(false);

    let successMessage = [];
    if (selectedResponsibilities.length > 0) {
      successMessage.push(`${selectedResponsibilities.length} job descriptions`);
    }
    if (selectedRequirements.length > 0) {
      successMessage.push(`${selectedRequirements.length} requirements`);
    }
    if (selectedOverview) {
      successMessage.push("overview");
    }
    if (selectedJobTitle) {
      successMessage.push("job title");
    }

    toast.success(`Added ${successMessage.join(", ")}`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl"
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Lamarin Assistant</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="benchmark" className="flex-1">Benchmark</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
              <TabsTrigger value="matcher" className="flex-1">Internal Matcher</TabsTrigger>
            </TabsList>

            <TabsContent value="benchmark" className="mt-4">
              {/* Search Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="roleName" className='mb-2'>Role Name</Label>
                    <Input
                      id="roleName"
                      value={formData.roleName}
                      onChange={(e) => setFormData(prev => ({ ...prev, roleName: e.target.value }))}
                      placeholder="Enter role name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="industry" className='mb-2'>Industry</Label>
                    <Select value={formData.industry} onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.industry === "Custom" && (
                      <Input
                        className="mt-2"
                        placeholder="Enter custom industry"
                        value={formData.customIndustry}
                        onChange={(e) => setFormData(prev => ({ ...prev, customIndustry: e.target.value }))}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-4 mb-4">
                  <div className="flex justify-between">
                    <Label htmlFor="temperature">Openness (Temperature): {formData.temperature.toFixed(1)}</Label>
                    <span className="text-xs text-muted-foreground">
                      {formData.temperature === 0 && "Extremely Deterministic"}
                      {formData.temperature > 0 && formData.temperature < 0.3 && "Deterministic"}
                      {formData.temperature >= 0.3 && formData.temperature <= 0.7 && "Balanced"}
                      {formData.temperature > 0.7 && formData.temperature < 1 && "Creative"}
                      {formData.temperature === 1 && "Extremely Creative"}
                    </span>
                  </div>
                  <Slider
                    id="temperature"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[formData.temperature]}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, temperature: value[0] }))}
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={(!formData.roleName || !getIndustryValue()) && (!currentOverview && (!currentJobDesc || currentJobDesc.length === 0) && (!currentRequirements || currentRequirements.length === 0)) || isLoading || isValidating}
                  className="w-full"
                >
                  {isValidating ? (
                    <>
                      <LoaderCircle className="animate-spin h-4 w-4" />
                      Validating...
                    </>
                  ) : isLoading ? (
                    <>
                      <LoaderCircle className="animate-spin h-4 w-4" />
                      Researching...
                    </>
                  ) : (
                    "Benchmark Job"
                  )}
                </Button>

                {/* Validation Error Message */}
                {validationError && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive font-medium">{validationError}</p>
                    <p className="text-xs text-destructive/80 mt-1">
                      Please enter a real job role and industry (e.g., "Software Engineer" in "Technology")
                    </p>
                  </div>
                )}
              </div>

              {/* Results */}
              {benchmarkData && (
                <>
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      {`${selectedResponsibilities.length} responsibilities, ${selectedRequirements.length} requirements${selectedOverview ? ", 1 overview" : ""}${selectedJobTitle ? ", 1 job title" : ""} selected`}
                    </div>
                    <Button
                      onClick={handleApplySelected}
                      disabled={selectedResponsibilities.length === 0 && selectedRequirements.length === 0 && !selectedOverview && !selectedJobTitle}
                      size="sm"
                    >
                      Apply Selected
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(100vh-400px)] pr-4 mt-4">
                    <div className="space-y-6 pb-8">
                      {benchmarkData?.companies.map((company, companyIndex) => (
                        <Card key={companyIndex}>
                          <CardHeader className="pb-0">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                                {company.logo}
                              </div>
                              <div>
                                <CardTitle className="text-lg">{company.company}</CardTitle>
                                <CardDescription>{formData.roleName}</CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {/* Inferred Job Title Section */}
                            {benchmarkData?.inferredRoleName && (
                              <div className="px-3 py-1 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-sm font-bold">
                                      {addInlineCitations(
                                        benchmarkData.inferredRoleName,
                                        benchmarkData?.groundingMetadata?.groundingSupports,
                                        benchmarkData?.groundingMetadata?.groundingChunks
                                      )}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`text-xs ${selectedJobTitle === benchmarkData.inferredRoleName ? 'bg-primary/10 text-primary' : ''}`}
                                    onClick={() => selectJobTitle(benchmarkData.inferredRoleName!)}
                                  >
                                    {selectedJobTitle === benchmarkData.inferredRoleName ? "Selected" : "Select"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Overview Section */}
                            <div className="mb-4 p-3 border border-dashed border-muted-foreground/20 rounded-lg">
                              <div className="flex justify-between items-start">
                                <h4 className="text-sm font-medium">Overview</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`text-xs ${selectedOverview === company.overview ? 'bg-primary/10 text-primary' : ''}`}
                                  onClick={() => selectOverview(company.overview)}
                                >
                                  {selectedOverview === company.overview ? "Selected" : "Select"}
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                  {addInlineCitations(
                                    company.overview,
                                    benchmarkData?.groundingMetadata?.groundingSupports,
                                    benchmarkData?.groundingMetadata?.groundingChunks
                                  )}
                                </p>
                            </div>

                            {/* Responsibilities Section */}
                            <div className="mb-4">
                              <h4 className="text-sm font-medium mb-2">Responsibilities</h4>
                              <div className="space-y-0">
                                {company.responsibilities.map((responsibility, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 px-3 py-1 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => toggleResponsibility(responsibility)}
                                  >
                                    {selectedResponsibilities.includes(responsibility) ? (
                                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                    ) : (
                                      <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    )}
                                    <span className="text-sm leading-relaxed">
                                      {addInlineCitations(
                                        responsibility,
                                        benchmarkData?.groundingMetadata?.groundingSupports,
                                        benchmarkData?.groundingMetadata?.groundingChunks
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Requirements Section */}
                            <div>
                              <h4 className="text-sm font-medium mb-2">Requirements</h4>
                              <div className="space-y-0">
                                {company.requirements.map((requirement, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 px-3 py-1 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => toggleRequirement(requirement)}
                                  >
                                    {selectedRequirements.includes(requirement) ? (
                                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                    ) : (
                                      <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    )}
                                    <span className="text-sm leading-relaxed">
                                      {addInlineCitations(
                                        requirement,
                                        benchmarkData?.groundingMetadata?.groundingSupports,
                                        benchmarkData?.groundingMetadata?.groundingChunks
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {/* Citation References */}
                    <div id="references" className="mt-2 pt-4 mb-15 border-t border-border">
                      <h4 className="text-sm font-semibold mb-2">References</h4>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {benchmarkData?.groundingMetadata?.groundingChunks && benchmarkData.groundingMetadata.groundingChunks.length > 0 ? (
                          benchmarkData.groundingMetadata.groundingChunks.map((chunk, index) => (
                            <div key={index} className="flex items-start gap-2 mb-2">
                              <span className="font-medium">[{index + 1}]</span>
                              <a 
                                href={chunk.web.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline text-primary break-words"
                              >
                                {chunk.web.title}
                              </a>
                            </div>
                          ))
                        ) : (
                          <div>
                            {benchmarkData?.groundingMetadata?.webSearchQueries && benchmarkData.groundingMetadata.webSearchQueries.length > 0 ? (
                              benchmarkData.groundingMetadata.webSearchQueries.map((query, index) => (
                                <div key={`ref-${index}`} className="flex items-start gap-2">
                                  <span className="font-medium text-secondary">[{index + 1}]</span>
                                  <a 
                                    href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline text-primary break-words text-secondary"
                                  >
                                    "{query}"
                                  </a>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-start gap-2 mb-2">
                                <span className="font-medium text-primary">[1]</span>
                                <span className="text-primary">No references available</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Only show search queries section if we have groundingChunks */}
                        {/* {benchmarkData?.groundingMetadata?.groundingChunks && benchmarkData.groundingMetadata.groundingChunks.length > 0 && benchmarkData?.groundingMetadata?.webSearchQueries && benchmarkData.groundingMetadata.webSearchQueries.length > 0 && (
                          <div className="mt-3 pt-3 mb-4 border-t border-border">
                            <h5 className="text-xs font-semibold mb-1">Search Queries Used</h5>
                            {benchmarkData.groundingMetadata.webSearchQueries.map((query, index) => (
                              <div key={`query-${index}`} className="text-xs text-muted-foreground mt-2 break-words">
                                - "{query}"
                              </div>
                            ))}
                          </div>
                        )} */}
                      </div>
                    </div>
                  </ScrollArea>
                  

                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <LoaderCircle className="animate-spin h-6 w-6" />
                  <span>Loading history...</span>
                </div>
              ) : searchHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No search history found.</p>
                  <p className="text-sm mt-2">Perform a benchmark search to save results.</p>
                </div>
              ) : (
                <>
                  {/* History Filters */}
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="roleNameFilter" className="text-xs mb-1 block">Filter by Role Name</Label>
                        <Input
                          id="roleNameFilter"
                          placeholder="Search role names..."
                          value={historyFilters.roleNameFilter}
                          onChange={(e) => {
                            setHistoryFilters(prev => ({ ...prev, roleNameFilter: e.target.value }));

                            // Apply filters
                            const roleFilter = e.target.value.toLowerCase();
                            const industryFilter = historyFilters.industryFilter.toLowerCase();

                            const filtered = searchHistory.filter(item => {
                              const matchesRole = roleFilter === "" || item.searchRoleName.toLowerCase().includes(roleFilter);
                              const matchesIndustry = industryFilter === "" || item.searchIndustry.toLowerCase().includes(industryFilter);
                              return matchesRole && matchesIndustry;
                            });

                            setFilteredHistory(filtered);
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="industryFilter" className="text-xs mb-1 block">Filter by Industry</Label>
                        <Input
                          id="industryFilter"
                          placeholder="Search industries..."
                          value={historyFilters.industryFilter}
                          onChange={(e) => {
                            setHistoryFilters(prev => ({ ...prev, industryFilter: e.target.value }));

                            // Apply filters
                            const roleFilter = historyFilters.roleNameFilter.toLowerCase();
                            const industryFilter = e.target.value.toLowerCase();

                            const filtered = searchHistory.filter(item => {
                              const matchesRole = roleFilter === "" || item.searchRoleName.toLowerCase().includes(roleFilter);
                              const matchesIndustry = industryFilter === "" || item.searchIndustry.toLowerCase().includes(industryFilter);
                              return matchesRole && matchesIndustry;
                            });

                            setFilteredHistory(filtered);
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Results count */}
                    <div className="text-xs text-muted-foreground">
                      {filteredHistory.length === searchHistory.length
                        ? `Showing all ${searchHistory.length} results`
                        : `Showing ${filteredHistory.length} of ${searchHistory.length} results`}
                    </div>
                  </div>

                  <ScrollArea className="h-[calc(100vh-380px)] pr-4">
                    <div className="space-y-3">
                      {filteredHistory.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <p>No matching results found.</p>
                          <p className="text-xs mt-1">Try adjusting your filters.</p>
                        </div>
                      ) : filteredHistory.map((item) => (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors py-0"
                          onClick={() => loadBenchmarkFromHistory(item)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{item.searchRoleName} in {item.searchIndustry}</h4>
                                <div className="flex items-center text-sm text-muted-foreground mt-1">
                                  <Clock className="h-3.5 w-3.5 mr-1" />
                                  {format(new Date(item.timestamp), 'MMM d, yyyy h:mm a')}
                                </div>
                              </div>
                              <div className="text-xs bg-muted px-2 py-1 rounded-full">
                                Creativity: {parseFloat(item.creativity).toFixed(1)}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>

            <TabsContent value="matcher" className="mt-4">
              <InternalJobMatcher 
                currentJobDesc={currentJobDesc}
                currentRequirements={currentRequirements}
                currentOverview={currentOverview}
                currentJobId={currentJobId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}