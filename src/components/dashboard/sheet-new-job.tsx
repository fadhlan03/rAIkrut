'use client';

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { LoaderCircle, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from "@/components/ui/button";
import {
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter, 
  SheetClose
} from "@/components/ui/sheet";
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
import { createJobVacancy, updateJobVacancy } from '@/app/actions';
import { JobVacancy } from '@/types/database';

interface SheetNewJobProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editJob?: JobVacancy | null; // Optional job to edit
}

// Updated Schema: job_desc and requirements are arrays of strings, each non-empty, and require at least one item.
// Benefits and info are optional fields.
const NewJobFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Overview must be at least 10 characters"),
  job_desc: z.array(z.object({ value: z.string().min(1, "Description item cannot be empty") })).min(1, "At least one job description item is required"),
  requirements: z.array(z.object({ value: z.string().min(1, "Requirement item cannot be empty") })).min(1, "At least one requirement is required"),
  benefits: z.array(z.object({ value: z.string().min(1, "Benefit item cannot be empty") })).optional(),
  info: z.string().optional(),
  status: z.enum(['draft', 'published']),
});

type NewJobFormValues = z.infer<typeof NewJobFormSchema>;

export function SheetNewJob({ isOpen, onOpenChange, editJob }: SheetNewJobProps) {
  const isEditMode = !!editJob;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<NewJobFormValues>({
    resolver: zodResolver(NewJobFormSchema),
    defaultValues: {
      title: editJob?.title || "",
      description: editJob?.description || "",
      job_desc: editJob?.job_desc ? 
        (Array.isArray(editJob.job_desc) ? editJob.job_desc.map(item => ({ value: item })) : [{ value: editJob.job_desc }]) :
        [{ value: "" }],
      requirements: editJob?.requirements ? 
        (Array.isArray(editJob.requirements) ? editJob.requirements.map(item => ({ value: item })) : [{ value: editJob.requirements }]) :
        [{ value: "" }],
      benefits: editJob?.benefits ? 
        (Array.isArray(editJob.benefits) ? editJob.benefits.map(item => ({ value: item })) : [{ value: editJob.benefits }]) :
        [],
      info: editJob?.info || "",
      status: (editJob?.status as 'draft' | 'published') || 'draft',
    },
    mode: 'onTouched', // Only validate after field has been touched
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

  // Updated onSubmit to send JSON data directly
  const onSubmit = async (data: NewJobFormValues) => {
    setIsSubmitting(true);
    console.log("Submitting form data (JSON):", data);

    // Map the array of objects to array of strings before sending
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
      if (isEditMode && editJob) {
        // Update existing job
        result = await updateJobVacancy({
          jobId: editJob.id,
          ...payload,
        });
      } else {
        // Create new job
        result = await createJobVacancy(payload);
      }
      
      console.log("Server action result:", result);
      
      if (result.success) {
        toast.success(result.message || (isEditMode ? "Job updated successfully!" : "Job posted successfully!"));
        form.reset(); 
        onOpenChange(false);
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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        className="p-0 flex flex-col max-w-full sm:max-w-2xl w-full h-svh" // Increased max width slightly
        side="right"
        style={{ isolation: 'isolate', zIndex: 100 }}
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement).closest('[data-sonner-toast]')) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-xl font-semibold tracking-tight pr-8">
            {isEditMode ? 'Edit Job' : 'Post New Job'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          {/* Use React Hook Form's Form Provider if needed, but direct onSubmit works here */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pt-4 pb-6 space-y-6"> {/* Increased spacing */}
            {/* Title Field */}
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
            
            {/* Overview/Description Field (Still a single textarea) */}
            <div>
              <Label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">Overview</Label>
              <Textarea
                id="description"
                placeholder="Provide a brief summary of the role and company."
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
                    className="mt-1 flex-shrink-0" // Adjusted margin
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
              <Label className="block text-sm font-medium text-foreground">Benefits (Optional)</Label>
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
              <Label htmlFor="info" className="mb-1.5 block text-sm font-medium text-foreground">Additional Information (Optional)</Label>
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
                    <SelectContent className="z-[9999]">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.status && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.status.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Draft jobs are only visible to admins. Published jobs are visible to applicants.
              </p>
            </div>
          </form>
        </ScrollArea>

        <SheetFooter className="p-6 pt-4 border-t bg-background shrink-0">
          <div className="flex w-full justify-between items-center">
            <SheetClose asChild>
                <Button variant="outline" type="button" disabled={isSubmitting}>Cancel</Button>
            </SheetClose>
            <Button 
                type="submit" 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={isSubmitting || !form.formState.isValid} // Disable when submitting or form is invalid
                size="lg"
            >
              {isSubmitting ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : null}
              {isSubmitting ? (isEditMode ? "Updating..." : "Posting...") : (isEditMode ? "Update Job" : "Post Job")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
} 