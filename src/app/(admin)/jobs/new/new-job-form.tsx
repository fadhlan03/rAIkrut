'use client';

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { LoaderCircle, Plus, X, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createJobVacancy, updateJobVacancy, autoSaveJobDraft, getDepartments, getJobFamilies, Department } from '@/app/actions';
import { JobVacancy } from '@/types/database';
import { SheetLamarinAssistant } from '@/components/dashboard/sheet-lamarin-assistant';
import { Search } from 'lucide-react';

// Schema definition
const NewJobFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  industry: z.string().optional(),
  attribute: z.string().optional(),
  deptId: z.string().optional(),
  jobFamily: z.string().optional(),
  description: z.string().min(10, "Overview must be at least 10 characters"),
  job_desc: z.array(z.object({ value: z.string().min(1, "Description item cannot be empty") })).min(1, "At least one job description item is required"),
  requirements: z.array(z.object({ value: z.string().min(1, "Requirement item cannot be empty") })).min(1, "At least one requirement is required"),
  benefits: z.array(z.object({ value: z.string().min(1, "Benefit item cannot be empty") })).optional(),
  info: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
});

type NewJobFormValues = z.infer<typeof NewJobFormSchema>;

interface NewJobFormProps {
  jobToEdit?: JobVacancy;
}

export function NewJobForm({ jobToEdit }: NewJobFormProps = {}) {
  const isEditMode = !!jobToEdit;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftId, setDraftId] = React.useState<string | undefined>(jobToEdit?.id);
  const [hasFormChanged, setHasFormChanged] = React.useState(false);
  const [hasBeenManuallySaved, setHasBeenManuallySaved] = React.useState(!!jobToEdit); // True if editing existing job
  const isNewJob = !jobToEdit; // True if creating a new job
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = React.useState(true);
  const [jobFamilies, setJobFamilies] = React.useState<string[]>([]);
  const [isLoadingJobFamilies, setIsLoadingJobFamilies] = React.useState(true);

  // Fetch departments and job families on component mount
  React.useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const depts = await getDepartments();
        setDepartments(depts);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      } finally {
        setIsLoadingDepartments(false);
      }
    };
    
    const fetchJobFamilies = async () => {
      try {
        const families = await getJobFamilies();
        // If editing a job and it has a jobFamily, ensure it's included in the list
        if (jobToEdit?.jobFamily && !families.includes(jobToEdit.jobFamily)) {
          setJobFamilies([...families, jobToEdit.jobFamily].sort());
        } else {
          setJobFamilies(families);
        }
      } catch (error) {
        console.error('Failed to fetch job families:', error);
      } finally {
        setIsLoadingJobFamilies(false);
      }
    };
    
    fetchDepartments();
    fetchJobFamilies();
  }, []);

  const form = useForm<NewJobFormValues>({
    resolver: zodResolver(NewJobFormSchema),
    defaultValues: {
      title: jobToEdit?.title || "",
      industry: jobToEdit?.industry || "",
      attribute: jobToEdit?.attribute || "",
      deptId: jobToEdit?.deptId || "",
      jobFamily: jobToEdit?.jobFamily || "",
      description: jobToEdit?.description || "",
      job_desc: jobToEdit?.job_desc ?
        (Array.isArray(jobToEdit.job_desc) ? jobToEdit.job_desc.map(item => ({ value: item })) : [{ value: jobToEdit.job_desc }]) :
        [{ value: "" }],
      requirements: jobToEdit?.requirements ?
        (Array.isArray(jobToEdit.requirements) ? jobToEdit.requirements.map(item => ({ value: item })) : [{ value: jobToEdit.requirements }]) :
        [{ value: "" }],
      benefits: jobToEdit?.benefits ?
        (Array.isArray(jobToEdit.benefits) ? jobToEdit.benefits.map(item => ({ value: item })) : [{ value: jobToEdit.benefits }]) :
        [],
      info: jobToEdit?.info || "",
      status: (jobToEdit?.status as 'draft' | 'published') || 'draft',
    },
    mode: 'onTouched',
  });

  // Watch fields for changes
  const titleValue = form.watch("title");
  const statusValue = form.watch("status");
  const formValues = form.watch(); // Watch all form values for auto-save

  // Keep track of last saved form state
  const lastSavedFormRef = React.useRef<any>(null);

  // Function to handle auto-saving
  const handleAutoSave = React.useCallback(async () => {
    // Don't auto-save if the form is empty
    const hasTitle = !!formValues.title;
    const hasDescription = !!formValues.description;
    const hasJobDesc = formValues.job_desc.some(item => !!item.value);
    const hasRequirements = formValues.requirements.some(item => !!item.value);

    if (!hasTitle && !hasDescription && !hasJobDesc && !hasRequirements) {
      return;
    }

    // Prepare the payload
    const payload = {
      id: draftId,
      title: formValues.title,
      industry: formValues.industry || undefined,
      attribute: formValues.attribute || undefined,
      deptId: formValues.deptId || undefined,
      jobFamily: formValues.jobFamily || undefined,
      description: formValues.description,
      job_desc: formValues.job_desc.map(item => item.value).filter(Boolean),
      requirements: formValues.requirements.map(item => item.value).filter(Boolean),
      benefits: formValues.benefits?.map(item => item.value).filter(Boolean),
      info: formValues.info,
      // Only pass status if job has been manually saved or is being edited
      ...(hasBeenManuallySaved || !isNewJob ? { status: formValues.status } : {}),
      isNewJob: isNewJob,
      hasBeenManuallySaved: hasBeenManuallySaved,
    };

    // Check if there are actual changes since last save
    if (lastSavedFormRef.current) {
      const lastSaved = lastSavedFormRef.current;
      const noChanges =
        lastSaved.title === payload.title &&
        lastSaved.industry === payload.industry &&
        lastSaved.attribute === payload.attribute &&
        lastSaved.deptId === payload.deptId &&
        lastSaved.description === payload.description &&
        JSON.stringify(lastSaved.job_desc) === JSON.stringify(payload.job_desc) &&
        JSON.stringify(lastSaved.requirements) === JSON.stringify(payload.requirements) &&
        JSON.stringify(lastSaved.benefits || []) === JSON.stringify(payload.benefits || []) &&
        lastSaved.info === payload.info;

      // Skip save if no changes
      if (noChanges) {
        return;
      }
    }

    setAutoSaveStatus('saving');
    console.log('Auto-save payload being sent:', payload);
    
    try {
      const result = await autoSaveJobDraft(payload);
      console.log('Auto-save result:', result);
      
      if (result.success) {
        // Store the current form state as the last saved state
        lastSavedFormRef.current = { ...payload };
        setAutoSaveStatus('saved');
          
          // Reset the status to idle after a few seconds
          setTimeout(() => {
            setAutoSaveStatus('idle');
          }, 3000);
        if (result.id && !draftId) {
          setDraftId(result.id);
          // Show toast with the message from server
          toast.success(result.message, {
            duration: 2000,
            position: "bottom-right"
          });
        }
      } else {
        console.error("Auto-save failed:", result.message);
        setAutoSaveStatus('error');
        // Don't show error toast to avoid spam
        // toast.error("Failed to auto-save draft", {
        //   duration: 3000,
        //   position: "bottom-right"
        // });
      }
    } catch (error) {
      console.error("Auto-save error:", error);
      setAutoSaveStatus('error');
      // Don't show error toast to avoid spam
      // toast.error("Failed to auto-save draft", {
      //   duration: 3000,
      //   position: "bottom-right"
      // });
    }
  }, [formValues, draftId]);

  // Track if form has been modified
  const [formModified, setFormModified] = React.useState(false);

  // Check if form has been modified
  React.useEffect(() => {
    const hasTitle = !!formValues.title;
    const hasDescription = !!formValues.description;
    const hasJobDesc = formValues.job_desc.some(item => !!item.value);
    const hasRequirements = formValues.requirements.some(item => !!item.value);

    if (hasTitle || hasDescription || hasJobDesc || hasRequirements) {
      setFormModified(true);
    }
  }, [formValues]);

  // Set up debounced auto-save effect
  React.useEffect(() => {
    // Don't auto-save if the form hasn't been modified
    if (!formModified) {
      return;
    }

    // Don't auto-save when in edit mode
    if (isEditMode) {
      return;
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set a new timeout for auto-save (3 seconds delay)
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 3000);

    // Cleanup function
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formValues, handleAutoSave, formModified]);

  // Field Arrays
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

  const onSubmit = async (data: NewJobFormValues) => {
    setIsSubmitting(true);
    console.log("Submitting form data (JSON):", data);

    const payload = {
      ...data,
      job_desc: data.job_desc.map(item => item.value),
      requirements: data.requirements.map(item => item.value),
      benefits: data.benefits?.length ? data.benefits.map(item => item.value) : undefined,
      info: data.info || undefined,
      status: data.status,
    };

    try {
      let result;

      if (isEditMode && jobToEdit) {
        // Update existing job
        result = await updateJobVacancy({
          jobId: jobToEdit.id,
          title: payload.title,
          industry: payload.industry,
          attribute: payload.attribute,
          deptId: payload.deptId,
          jobFamily: payload.jobFamily,
          description: payload.description,
          job_desc: payload.job_desc,
          requirements: payload.requirements,
          benefits: payload.benefits,
          info: payload.info,
          status: payload.status,
        });
      } else {
        // Create new job
        result = await createJobVacancy(payload);
      }

      console.log("Server action result:", result);

      if (result.success) {
        toast.success(result.message || (isEditMode ? "Job updated successfully!" : "Job posted successfully!"));
        // Mark as manually saved
        setHasBeenManuallySaved(true);
        // Reset auto-save state
        setAutoSaveStatus('idle');
        setDraftId(undefined);
        // Navigate away
        router.push(isEditMode ? `/jobs/${jobToEdit?.id}` : '/jobs');
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
      console.error(isEditMode ? "Failed to update job:" : "Failed to post job:", error);
      toast.error(error.message || (isEditMode ? "Failed to update job. Please try again." : "Failed to post job. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add this function to handle selected responsibilities from the assistant
  const handleAssistantResponsibilities = (responsibilities: string[]) => {
    // If we only have one empty field, remove it before adding new items
    if (jobDescFields.length === 1 && !jobDescFields[0].value) {
      // Remove the empty placeholder
      removeJobDesc(0);
      
      // Add all responsibilities directly
      responsibilities.forEach(resp => {
        appendJobDesc({ value: resp });
      });
    } else {
      // Append new responsibilities to existing ones
      responsibilities.forEach(resp => {
        // Check if this responsibility already exists to avoid duplicates
        const exists = jobDescFields.some(field => field.value === resp);
        if (!exists) {
          appendJobDesc({ value: resp });
        }
      });
    }
  };

  // Add this function to handle selected requirements from the assistant
  const handleAssistantRequirements = (requirements: string[]) => {
    // If we only have one empty field, remove it before adding new items
    if (reqFields.length === 1 && !reqFields[0].value) {
      // Remove the empty placeholder
      removeReq(0);
      
      // Add all requirements directly
      requirements.forEach(req => {
        appendReq({ value: req });
      });
    } else {
      // Append new requirements to existing ones
      requirements.forEach(req => {
        // Check if this requirement already exists to avoid duplicates
        const exists = reqFields.some(field => field.value === req);
        if (!exists) {
          appendReq({ value: req });
        }
      });
    }
  };

  // Add this function to handle selected overview from the assistant
  const handleAssistantOverview = (overview: string) => {
    // Set the overview in the form
    form.setValue("description", overview);
    form.trigger("description");
  };

  // Add this function to handle selected job title from the assistant
  const handleAssistantJobTitle = (jobTitle: string) => {
    // Set the job title in the form
    form.setValue("title", jobTitle);
    form.trigger("title");
    toast.success("Job title added to form");
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-semibold">
          {isEditMode ? `Edit Job: ${titleValue || jobToEdit?.title}` : (titleValue ? titleValue : 'New Job')}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAssistantOpen(true)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Lamarin Assistant
        </Button>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Job Title */}
              <div>
                <Label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">Job Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Senior Software Engineer"
                  {...form.register("title")}
                  className={form.formState.errors.title && form.formState.touchedFields.title ? "border-destructive" : ""}
                />
                {form.formState.errors.title && form.formState.touchedFields.title && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Department and Job Family */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department */}
                <div>
                  <Label htmlFor="deptId" className="mb-1.5 block text-sm font-medium text-foreground">Department <span className="text-muted-foreground">(Optional)</span></Label>
                  <Controller
                    control={form.control}
                    name="deptId"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className={form.formState.errors.deptId ? "border-destructive" : ""}>
                          {field.value ? (
                            <span>
                              {jobToEdit?.departmentName || 
                               departments.find(dept => dept.id === field.value)?.name || 
                               "Loading department..."}
                            </span>
                          ) : (
                            <SelectValue placeholder={isLoadingDepartments ? "Loading departments..." : "Select department"} />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.deptId && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.deptId.message}</p>
                  )}
                </div>

                {/* Job Family */}
                <div>
                  <Label htmlFor="jobFamily" className="mb-1.5 block text-sm font-medium text-foreground">Job Family <span className="text-muted-foreground">(Optional)</span></Label>
                  <Controller
                    control={form.control}
                    name="jobFamily"
                    render={({ field }) => {
                      const [isOpen, setIsOpen] = React.useState(false);
                      const [pendingCustomValue, setPendingCustomValue] = React.useState<string | null>(null);
                      
                      // Handle setting custom value after jobFamilies is updated
                      React.useEffect(() => {
                        if (pendingCustomValue && jobFamilies.includes(pendingCustomValue)) {
                          field.onChange(pendingCustomValue);
                          setPendingCustomValue(null);
                          setIsOpen(false);
                        }
                      }, [jobFamilies, pendingCustomValue, field]);
                      
                      return (
                        <Select onValueChange={field.onChange} value={field.value || ""} open={isOpen} onOpenChange={setIsOpen}>
                          <SelectTrigger className={form.formState.errors.jobFamily ? "border-destructive" : ""}>
                            {field.value ? (
                              <span className="text-foreground">{field.value}</span>
                            ) : (
                              <SelectValue placeholder={isLoadingJobFamilies ? "Loading job families..." : "Select or type job family"} />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {jobFamilies.map((family) => (
                              <SelectItem key={family} value={family}>
                                {family}
                              </SelectItem>
                            ))}
                            <div className="p-2 border-t">
                              <Input
                                placeholder="Type custom job family..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const customValue = e.currentTarget.value.trim();
                                    if (customValue) {
                                      e.currentTarget.value = '';
                                      
                                      if (jobFamilies.includes(customValue)) {
                                        // Value already exists, set it directly
                                        field.onChange(customValue);
                                        setIsOpen(false);
                                      } else {
                                        // Add to jobFamilies list and set pending value
                                        setJobFamilies(prev => [...prev, customValue].sort());
                                        setPendingCustomValue(customValue);
                                      }
                                    }
                                  }
                                }}
                                className="text-sm"
                              />
                              {/* <p className="text-xs text-muted-foreground mt-1">Press Enter to add custom job family</p> */}
                            </div>
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                  {form.formState.errors.jobFamily && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.jobFamily.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Attribute */}
              <div>
                <Label htmlFor="attribute" className="mb-1.5 block text-sm font-medium text-foreground">Attribute <span className="text-muted-foreground">(Optional)</span></Label>
                <Input
                  id="attribute"
                  placeholder="e.g., Remote, Full-time, Contract"
                  {...form.register("attribute")}
                  className={form.formState.errors.attribute && form.formState.touchedFields.attribute ? "border-destructive" : ""}
                />
                {form.formState.errors.attribute && form.formState.touchedFields.attribute && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.attribute.message}</p>
                )}
              </div>

              {/* Industry */}
              <div>
                <Label htmlFor="industry" className="mb-1.5 block text-sm font-medium text-foreground">Industry <span className="text-muted-foreground">(Optional)</span></Label>
                <Input
                  id="industry"
                  placeholder="e.g., Technology, Healthcare, Finance"
                  {...form.register("industry")}
                  className={form.formState.errors.industry && form.formState.touchedFields.industry ? "border-destructive" : ""}
                />
                {form.formState.errors.industry && form.formState.touchedFields.industry && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.industry.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Overview/Description Field */}
          <div>
            <Label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">Overview</Label>
            <Textarea
              id="description"
              placeholder="Provide a brief summary of the role."
              rows={4}
              {...form.register("description")}
              className={form.formState.errors.description && form.formState.touchedFields.description ? "border-destructive" : ""}
            />
            {form.formState.errors.description && form.formState.touchedFields.description && (
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
                  className={form.formState.errors.job_desc?.[index]?.value && form.formState.touchedFields.job_desc?.[index]?.value ? "border-destructive flex-grow" : "flex-grow"}
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
            {Array.isArray(form.formState.errors.job_desc) && form.formState.errors.job_desc.map((error, index) => error?.value && form.formState.touchedFields.job_desc?.[index]?.value && (
              <p key={index} className="text-xs text-destructive mt-1 pl-1">Item {index + 1}: {error.value.message}</p>
            ))}
            {form.formState.errors.job_desc?.root && form.formState.touchedFields.job_desc && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.job_desc.root.message}</p>
            )}
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
                  className={form.formState.errors.requirements?.[index]?.value && form.formState.touchedFields.requirements?.[index]?.value ? "border-destructive flex-grow" : "flex-grow"}
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
            {Array.isArray(form.formState.errors.requirements) && form.formState.errors.requirements.map((error, index) => error?.value && form.formState.touchedFields.requirements?.[index]?.value && (
              <p key={index} className="text-xs text-destructive mt-1 pl-1">Item {index + 1}: {error.value.message}</p>
            ))}
            {form.formState.errors.requirements?.root && form.formState.touchedFields.requirements && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.requirements.root.message}</p>
            )}
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
            <Label className="block text-sm font-medium text-foreground">Benefits <span className="text-muted-foreground">(Optional)</span></Label>
            {benefitsFields.length > 0 ? (
              <>
                {benefitsFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Input
                      placeholder={`Benefit ${index + 1}`}
                      {...form.register(`benefits.${index}.value` as const)}
                      className={form.formState.errors.benefits?.[index]?.value && form.formState.touchedFields.benefits?.[index]?.value ? "border-destructive flex-grow" : "flex-grow"}
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
                {Array.isArray(form.formState.errors.benefits) && form.formState.errors.benefits.map((error, index) => error?.value && form.formState.touchedFields.benefits?.[index]?.value && (
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
            <Label htmlFor="info" className="mb-1.5 block text-sm font-medium text-foreground">Additional Information <span className="text-muted-foreground">(Optional)</span></Label>
            <Textarea
              id="info"
              placeholder="How to apply, what documents to send, contact information, etc."
              rows={4}
              {...form.register("info")}
              className={form.formState.errors.info && form.formState.touchedFields.info ? "border-destructive" : ""}
            />
            {form.formState.errors.info && form.formState.touchedFields.info && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.info.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Include application instructions, required documents, contact details, or any other relevant information.
            </p>
          </div>

          {/* Status Field */}
          <div>
            <Label htmlFor="status" className="mb-1.5 block text-sm font-medium text-foreground">Status</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={form.formState.errors.status ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.status && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.status.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Draft jobs are only visible to admins. Published jobs are visible to applicants. Archived jobs are hidden from both.
            </p>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={isSubmitting}
            onClick={() => router.push('/jobs')}
          >
            Cancel
          </Button>

          {/* Auto-save status indicator */}
          {autoSaveStatus === 'saving' && (
            <span className="text-xs text-muted-foreground flex items-center">
              <LoaderCircle className="animate-spin mr-1 h-3 w-3" />
              Auto-saving...
            </span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="text-xs text-green-500 flex items-center">
              Draft auto-saved
            </span>
          )}
          {autoSaveStatus === 'error' && (
            <span className="text-xs text-destructive flex items-center">
              Auto-save failed
            </span>
          )}
        </div>

        <Button
          type="submit"
          onClick={form.handleSubmit(onSubmit)}
          disabled={isSubmitting || !form.formState.isValid}
          size="lg"
        >
          {isSubmitting ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : null}
          {isSubmitting
            ? (statusValue === 'draft' ? "Saving..." : statusValue === 'published' ? "Publishing..." : "Archiving...")
            : isEditMode
              ? (statusValue === 'draft' ? "Save Changes" : statusValue === 'published' ? "Update & Publish" : "Update & Archive")
              : (statusValue === 'draft' ? "Save as Draft" : statusValue === 'published' ? "Publish Job" : "Archive Job")}
        </Button>
      </CardFooter>

      <SheetLamarinAssistant
        isOpen={isAssistantOpen}
        onOpenChange={setIsAssistantOpen}
        initialJobTitle={titleValue}
        initialIndustry={form.watch("industry") || ""}
        onSelectResponsibilities={handleAssistantResponsibilities}
        onSelectRequirements={handleAssistantRequirements}
        onSelectOverview={handleAssistantOverview}
        onSelectJobTitle={handleAssistantJobTitle}
        currentOverview={form.watch("description")}
        currentJobDesc={form.watch("job_desc").map(item => item.value).filter(Boolean)}
        currentRequirements={form.watch("requirements").map(item => item.value).filter(Boolean)}
        currentJobId={jobToEdit?.id} // Pass the current job ID when editing to exclude from internal matcher
        userId="93a0cd60-44f7-4968-be63-0d8e76972a53" // Pass the user ID (hardcoded for now)
      />
    </Card>
  );
}