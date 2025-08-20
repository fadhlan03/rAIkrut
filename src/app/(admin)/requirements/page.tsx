"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Circle, Building2, Target, Save, ArrowLeft, LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createJobVacancy } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const industries = [
  "Telecommunications",
  "Technology",
  "Finance",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Education",
  "Government",
  "Custom" // Add option for custom input
];

const roles = [
  "Senior Software Engineer",
  "Product Manager",
  "Data Scientist",
  "DevOps Engineer",
  "UX Designer",
  "Business Analyst",
  "Project Manager",
  "Quality Assurance Engineer",
  "Custom" // Add option for custom input
];

interface RequirementsCompany {
  company: string;
  logo: string;
  requirements: string[];
}

interface RequirementsData {
  companies: RequirementsCompany[];
}

// Form schema for job creation
const JobFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Overview must be at least 10 characters"),
  job_desc: z.array(z.object({ value: z.string().min(1, "Description item cannot be empty") })).min(1, "At least one job description item is required"),
  requirements: z.array(z.object({ value: z.string().min(1, "Requirement item cannot be empty") })).min(1, "At least one requirement is required"),
  benefits: z.array(z.object({ value: z.string().min(1, "Benefit item cannot be empty") })).optional(),
  info: z.string().optional(),
  status: z.enum(['draft', 'published']),
});

type JobFormValues = z.infer<typeof JobFormSchema>;

export default function RequirementsPage() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState(1);
  const [formData, setFormData] = useState({
    roleName: "",
    industry: "",
    customRole: "",
    customIndustry: ""
  });
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [requirementsData, setRequirementsData] = useState<RequirementsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form for job creation
  const form = useForm<JobFormValues>({
    resolver: zodResolver(JobFormSchema),
    defaultValues: {
      title: "",
      description: "",
      job_desc: [{ value: "" }],
      requirements: [],
      benefits: [],
      info: "",
      status: 'draft',
    },
  });

  // Field Arrays for Job Description, Requirements, and Benefits
  const { fields: jobDescFields, append: appendJobDesc, remove: removeJobDesc } = useFieldArray({
    control: form.control,
    name: "job_desc"
  });

  const { fields: reqFields, append: appendReq, remove: removeReq } = useFieldArray({
    control: form.control,
    name: "requirements"
  });

  const { fields: benefitsFields, append: appendBenefit, remove: removeBenefit } = useFieldArray({
    control: form.control,
    name: "benefits"
  });

  const getRoleNameValue = () => {
    return formData.roleName === "Custom" ? formData.customRole : formData.roleName;
  };

  const getIndustryValue = () => {
    return formData.industry === "Custom" ? formData.customIndustry : formData.industry;
  };

  const handleSearch = async () => {
    if (!getRoleNameValue() || !getIndustryValue()) {
      toast.error("Please select or enter both role and industry");
      return;
    }

    setIsLoading(true);
    // Clear any previously selected requirements when starting a new search
    setSelectedRequirements([]);
    
    try {
      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleName: getRoleNameValue(),
          industry: getIndustryValue()
        }),
      });

      const result = await response.json();

      if (result.success) {
        setRequirementsData(result.data);
      setCurrentScreen(2);
        toast.success("Requirements data loaded successfully!");
      } else {
        toast.error(result.error || "Failed to load requirements data");
      }
    } catch (error) {
      console.error("Error fetching requirements data:", error);
      toast.error("Failed to fetch requirements data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRequirement = (requirement: string) => {
    setSelectedRequirements(prev => 
      prev.includes(requirement) 
        ? prev.filter(r => r !== requirement)
        : [...prev, requirement]
    );
  };

  const removeRequirement = (requirement: string) => {
    setSelectedRequirements(prev => prev.filter(r => r !== requirement));
  };

  const handleBuildJob = () => {
    if (selectedRequirements.length === 0) {
      toast.error("Please select at least one requirement");
      return;
    }

    // Pre-populate the form with selected requirements and basic info
    form.setValue("title", getRoleNameValue());
    form.setValue("description", `Join our team as a ${getRoleNameValue()} in the ${getIndustryValue()} industry.`);
    
    // Clear existing requirements and add selected ones
    form.setValue("requirements", selectedRequirements.map(req => ({ value: req })));
    
    setCurrentScreen(3);
  };

  const onSubmit = async (data: JobFormValues) => {
    setIsSaving(true);
    console.log("Submitting job form data:", data);

    // Map the array of objects to array of strings before sending
    const payload = {
        title: data.title,
        description: data.description,
        job_desc: data.job_desc.map(item => item.value),
        requirements: data.requirements.map(item => item.value),
        benefits: data.benefits?.length ? data.benefits.map(item => item.value) : undefined,
        info: data.info || undefined,
        status: data.status,
    };

    try {
      const result = await createJobVacancy(payload);
      
      console.log("Server action result:", result);
      
      if (result.success) {
        toast.success(result.message || "Job created successfully!");
        // Reset everything and go back to start
        form.reset();
        setSelectedRequirements([]);
        setRequirementsData(null);
        setCurrentScreen(1);
        setFormData({
          roleName: "",
          industry: "",
          customRole: "",
          customIndustry: ""
        });
        router.refresh();
      } else {
          if (result.errors) {
              let errorMsg = result.message || "Validation failed on server.";
              console.error("Server validation errors:", result.errors);
              toast.error(errorMsg);
              return;
          }
          throw new Error(result.message || 'An unknown error occurred.');
      }
    } catch (error: any) {
      console.error("Failed to create job:", error);
      toast.error(error.message || "Failed to create job. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Screen 1 - Role and Industry Selection
  if (currentScreen === 1) {
    return (
      <div className="bg-card shadow rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Requirements Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare job requirements across top companies in your industry using real-time data
          </p>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-foreground">Role Name</Label>
              <Select onValueChange={(value) => setFormData(prev => ({ ...prev, roleName: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role or choose Custom" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.roleName === "Custom" && (
                <div className="mt-2">
                  <Input
                    placeholder="Enter custom role name"
                    value={formData.customRole}
                    onChange={(e) => setFormData(prev => ({ ...prev, customRole: e.target.value }))}
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industry" className="text-sm font-medium text-foreground">Industry</Label>
              <Select onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an industry or choose Custom" />
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
                <div className="mt-2">
                  <Input
                    placeholder="Enter custom industry"
                    value={formData.customIndustry}
                    onChange={(e) => setFormData(prev => ({ ...prev, customIndustry: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-start">
            <Button 
              onClick={handleSearch} 
              disabled={!getRoleNameValue() || !getIndustryValue() || isLoading}
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                  Searching...
                </>
              ) : (
                "Search Requirements"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Screen 3 - Job Creation Form (replacing WYSIWYG editor)
  if (currentScreen === 3) {
    return (
      <div className="bg-card shadow rounded-lg p-6 h-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentScreen(2)}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">Create Job Posting</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {getRoleNameValue()} • {getIndustryValue()} Industry
            </p>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-4">
            {/* Title Field */}
            <div>
              <Label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">Job Title</Label>
              <Input 
                id="title"
                placeholder="e.g., Senior Software Engineer" 
                {...form.register("title")}
                className={form.formState.errors.title ? "border-destructive" : ""}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>
            
            {/* Overview/Description Field */}
            <div>
              <Label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">Overview</Label>
              <Textarea
                id="description"
                placeholder="Provide a brief summary of the role and company."
                rows={4}
                {...form.register("description")}
                className={form.formState.errors.description ? "border-destructive" : ""}
              />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>
              )}
            </div>
            
            {/* Job Description Field Array */}
            <div className="space-y-3">
              <Label className="block text-sm font-medium text-foreground">Job Description</Label>
              {jobDescFields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <Input
                    placeholder={`Description item ${index + 1}`}
                    {...form.register(`job_desc.${index}.value` as const)}
                    className={form.formState.errors.job_desc?.[index]?.value ? "border-destructive flex-grow" : "flex-grow"}
                  />
                  <Button
                    type="button" 
                    variant="outline"
                    size="icon" 
                    className="mt-1 flex-shrink-0"
                    onClick={() => removeJobDesc(index)}
                    disabled={jobDescFields.length <= 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {Array.isArray(form.formState.errors.job_desc) && form.formState.errors.job_desc.map((error, index) => error?.value && (
                  <p key={index} className="text-xs text-destructive mt-1 pl-1">Item {index + 1}: {error.value.message}</p>
              ))}
                  <Button
                type="button" 
                variant="outline" 
                    size="sm"
                className="mt-1" 
                onClick={() => appendJobDesc({ value: "" })}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>
            
            {/* Requirements Field Array */}
            <div className="space-y-3">
              <Label className="block text-sm font-medium text-foreground">Requirements</Label>
              {reqFields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2">
                  <Input
                    placeholder={`Requirement item ${index + 1}`}
                    {...form.register(`requirements.${index}.value` as const)}
                    className={form.formState.errors.requirements?.[index]?.value ? "border-destructive flex-grow" : "flex-grow"}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="mt-1 flex-shrink-0"
                    onClick={() => removeReq(index)}
                    disabled={reqFields.length <= 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {Array.isArray(form.formState.errors.requirements) && form.formState.errors.requirements.map((error, index) => error?.value && (
                  <p key={index} className="text-xs text-destructive mt-1 pl-1">Item {index + 1}: {error.value.message}</p>
              ))}
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="mt-1" 
                onClick={() => appendReq({ value: "" })}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>
            
            {/* Benefits Field Array (Optional) */}
            <div className="space-y-3">
              <Label className="block text-sm font-medium text-foreground">Benefits (Optional)</Label>
              {benefitsFields.length > 0 ? (
                <>
                  {benefitsFields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2">
                      <Input
                        placeholder={`Benefit ${index + 1}`}
                        {...form.register(`benefits.${index}.value` as const)}
                        className={form.formState.errors.benefits?.[index]?.value ? "border-destructive flex-grow" : "flex-grow"}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        className="mt-1 flex-shrink-0"
                        onClick={() => removeBenefit(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {Array.isArray(form.formState.errors.benefits) && form.formState.errors.benefits.map((error, index) => error?.value && (
                    <p key={index} className="text-xs text-destructive mt-1 pl-1">Benefit {index + 1}: {error.value.message}</p>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No benefits added. Click "Add Benefit" to start.</p>
              )}
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="mt-1" 
                onClick={() => appendBenefit({ value: "" })}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Benefit
              </Button>
              </div>

            {/* Additional Info Field (Optional) */}
            <div>
              <Label htmlFor="info" className="mb-1.5 block text-sm font-medium text-foreground">Additional Information (Optional)</Label>
              <Textarea
                id="info"
                placeholder="How to apply, what documents to send, contact information, etc."
                rows={4}
                {...form.register("info")}
                className={form.formState.errors.info ? "border-destructive" : ""}
              />
              {form.formState.errors.info && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.info.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Include application instructions, required documents, contact details, or any other relevant information.
              </p>
            </div>

            {/* Status Field */}
            <div>
              <Label htmlFor="status" className="mb-1.5 block text-sm font-medium text-foreground">Status</Label>
              <Select onValueChange={(value: 'draft' | 'published') => form.setValue("status", value)} value={form.watch("status") || ""}>
                <SelectTrigger className={form.formState.errors.status ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.status && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.status.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Draft jobs are only visible to admins. Published jobs are visible to applicants.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={isSaving || !form.formState.isValid}
                size="lg"
              >
                {isSaving ? (
                  <>
                    <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                    Creating Job...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Job
                  </>
                )}
              </Button>
        </div>
          </form>
        </ScrollArea>
          </div>
    );
  }

  // Check if we have requirements data for screen 2
  if (!requirementsData) {
    return (
      <div className="bg-card shadow rounded-lg p-6">
        <div className="text-center">
          <p className="text-muted-foreground">No requirements data available</p>
          <Button 
            onClick={() => {
              setCurrentScreen(1);
              setSelectedRequirements([]);
            }} 
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Screen 2 - Requirements Selection
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left Panel - Requirements Results */}
      <div className="flex-1">
        <div className="bg-card shadow rounded-lg p-6 h-full">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setCurrentScreen(1);
                    setSelectedRequirements([]);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight">Requirements Results</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {getRoleNameValue()} • {getIndustryValue()} Industry
              </p>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-6">
              {requirementsData.companies.map((company, companyIndex) => (
                <Card key={companyIndex} className="border-border">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                        {company.logo}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{company.company}</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">{getRoleNameValue()}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {company.requirements.map((requirement, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                          onClick={() => toggleRequirement(requirement)}
                        >
                          {selectedRequirements.includes(requirement) ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-sm leading-relaxed">{requirement}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right Panel - Requirements Builder */}
      <div className="w-full lg:w-80">
        <div className="bg-card shadow rounded-lg p-6 h-full">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight mb-4">Requirements Builder</h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Industry:</span>
                  <Badge variant="secondary">{getIndustryValue()}</Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Role:</span>
                  <Badge variant="secondary">{getRoleNameValue()}</Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-3">Selected Requirements</h3>
              <div className="text-sm text-muted-foreground mb-3">
                {selectedRequirements.length} items selected
              </div>
              
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {selectedRequirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Select requirements from the companies to build your job requirements
                    </p>
                  ) : (
                    selectedRequirements.map((requirement, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border text-sm group hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span className="leading-relaxed flex-1">{requirement}</span>
                        <button
                          onClick={() => removeRequirement(requirement)}
                          className="h-5 w-5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove requirement"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <Button 
              onClick={handleBuildJob}
              disabled={selectedRequirements.length === 0}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Build Job Requirements
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
