'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LoaderCircle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  HandHeart, 
  Building2, 
  Users, 
  FileText, 
  PenTool, 
  Save,
  Plus,
  Trash2,
  Eye,
  Settings,
  UserPlus,
  Edit
} from 'lucide-react';
import { 
  getJobVacancies,
  getOnboardingContent, 
  createOnboardingContent, 
  updateOnboardingContent,
  OnboardingContentPayload 
} from '@/app/actions';
import { JobVacancy } from '@/types/database';

// Define the form schema matching the server action schema
const OnboardingFormSchema = z.object({
  jobId: z.string().uuid("Please select a job"),
  welcomeContent: z.object({
    title: z.string().min(1, "Title is required"),
    subtitle: z.string().min(1, "Subtitle is required"),
    description: z.string().min(1, "Description is required"),
    roleTitle: z.string().min(1, "Role title is required"),
    department: z.string().min(1, "Department is required"),
    startDate: z.string().min(1, "Start date is required"),
    manager: z.string().min(1, "Manager is required"),
    keyPoints: z.array(z.string().min(1, "Key point cannot be empty")).min(1, "At least one key point is required"),
  }),
  companyContent: z.object({
    companyName: z.string().min(1, "Company name is required"),
    foundedYear: z.string().min(1, "Founded year is required"),
    description: z.string().min(1, "Description is required"),
    mission: z.string().min(1, "Mission is required"),
    vision: z.string().min(1, "Vision is required"),
    values: z.array(z.string().min(1, "Value cannot be empty")).min(1, "At least one value is required"),
    stats: z.object({
      customers: z.string().min(1, "Customers stat is required"),
      countries: z.string().min(1, "Countries stat is required"),
      employees: z.string().min(1, "Employees stat is required"),
      revenue: z.string().min(1, "Revenue stat is required"),
    }),
    techStack: z.array(z.string().min(1, "Tech stack item cannot be empty")),
  }),
  teamMembers: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    role: z.string().min(1, "Role is required"),
    department: z.string().min(1, "Department is required"),
    email: z.string().email("Valid email is required"),
    bio: z.string().min(1, "Bio is required"),
  })).min(1, "At least one team member is required"),
  formFields: z.array(z.object({
    id: z.string(),
    label: z.string().min(1, "Label is required"),
    type: z.enum(['text', 'email', 'phone', 'select', 'textarea', 'date']),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
  })).min(1, "At least one form field is required"),
  documents: z.array(z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required"),
    type: z.enum(['contract', 'policy', 'agreement', 'handbook', 'other']),
    description: z.string().min(1, "Description is required"),
    required: z.boolean(),
    content: z.string().min(1, "Content is required"),
  })).min(1, "At least one document is required"),
});

type OnboardingFormValues = z.infer<typeof OnboardingFormSchema>;

export default function OnboardingPage() {
  const [activeTab, setActiveTab] = useState('job-selection');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<JobVacancy[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [jobSearchTerm, setJobSearchTerm] = useState('');

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(OnboardingFormSchema),
    defaultValues: {
      jobId: '',
      welcomeContent: {
        title: 'Welcome to Our Company',
        subtitle: 'We\'re excited to have you join our team!',
        description: 'You\'re about to embark on an exciting journey with us.',
        roleTitle: '',
        department: '',
        startDate: '',
        manager: '',
        keyPoints: ['Complete all onboarding steps'],
      },
      companyContent: {
        companyName: '',
        foundedYear: '',
        description: '',
        mission: '',
        vision: '',
        values: ['Innovation'],
        stats: {
          customers: '',
          countries: '',
          employees: '',
          revenue: '',
        },
        techStack: ['React'],
      },
      teamMembers: [{
        id: Date.now().toString(),
        name: '',
        role: '',
        department: '',
        email: '',
        bio: '',
      }],
      formFields: [{
        id: Date.now().toString(),
        label: 'Preferred Name',
        type: 'text',
        required: true,
        placeholder: 'What should we call you?',
      }],
      documents: [{
        id: Date.now().toString(),
        title: 'Employment Contract',
        type: 'contract',
        description: 'Your official employment agreement',
        required: true,
        content: '',
      }],
    },
    mode: 'onTouched',
  });

  // Field Arrays
  const { fields: keyPointFields, append: appendKeyPoint, remove: removeKeyPoint } = useFieldArray({
    control: form.control,
    name: "welcomeContent.keyPoints" as any
  });

  const { fields: valueFields, append: appendValue, remove: removeValue } = useFieldArray({
    control: form.control,
    name: "companyContent.values" as any
  });

  const { fields: techStackFields, append: appendTechStack, remove: removeTechStack } = useFieldArray({
    control: form.control,
    name: "companyContent.techStack" as any
  });

  const { fields: teamMemberFields, append: appendTeamMember, remove: removeTeamMember } = useFieldArray({
    control: form.control,
    name: "teamMembers"
  });

  const { fields: formFieldFields, append: appendFormField, remove: removeFormField } = useFieldArray({
    control: form.control,
    name: "formFields"
  });

  const { fields: documentFields, append: appendDocument, remove: removeDocument } = useFieldArray({
    control: form.control,
    name: "documents"
  });

  // Load jobs on component mount
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const jobData = await getJobVacancies();
        setJobs(jobData);
      } catch (error) {
        console.error('Error loading jobs:', error);
        toast.error('Failed to load jobs');
      } finally {
        setLoadingJobs(false);
      }
    };

    loadJobs();
  }, []);

  // Load existing onboarding content when job is selected
  const handleJobSelect = async (jobId: string) => {
    if (!jobId) return;
    
    form.setValue('jobId', jobId);
    
    try {
      const result = await getOnboardingContent(jobId);
      if (result.success && result.data) {
        // Populate form with existing data
        setIsEditMode(true);
        form.reset({
          jobId,
          welcomeContent: result.data.welcomeContent,
          companyContent: result.data.companyContent,
          teamMembers: result.data.teamMembers,
          formFields: result.data.formFields,
          documents: result.data.documents,
        });
        toast.success('Loaded existing onboarding content for editing');
      } else {
        // No existing content, use defaults and prefill role title
        setIsEditMode(false);
        const selectedJob = jobs.find(job => job.id === jobId);
        form.setValue('jobId', jobId);
        if (selectedJob) {
          form.setValue('welcomeContent.roleTitle', selectedJob.title);
        }
        toast.info('No existing onboarding content found. Creating new content.');
      }
      setActiveTab('welcome');
    } catch (error) {
      console.error('Error loading onboarding content:', error);
      toast.error('Failed to load onboarding content');
    }
  };

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsSubmitting(true);
    console.log("Submitting onboarding content:", data);

    try {
      let result;
      if (isEditMode) {
        result = await updateOnboardingContent(data);
      } else {
        result = await createOnboardingContent(data);
      }
      
      console.log("Server action result:", result);
      
      if (result.success) {
        toast.success(result.message || (isEditMode ? "Onboarding content updated successfully!" : "Onboarding content created successfully!"));
        setIsEditMode(true); // Switch to edit mode after successful creation
      } else {
        if (result.errors) {
          console.error("Server validation errors:", result.errors);
          toast.error(result.message || "Validation failed on server.");
          return;
        }
        throw new Error(result.message || 'An unknown error occurred.');
      }
    } catch (error: any) {
      console.error(isEditMode ? "Failed to update onboarding content:" : "Failed to create onboarding content:", error);
      toast.error(error.message || (isEditMode ? "Failed to update onboarding content. Please try again." : "Failed to create onboarding content. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter jobs based on search term
  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(jobSearchTerm.toLowerCase()) ||
    job.description.toLowerCase().includes(jobSearchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Onboarding Content Management</h1>
            <p className="text-muted-foreground mt-1">Configure the onboarding experience for new hires</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)} 
              disabled={isSubmitting || !form.formState.isValid || !form.getValues('jobId')}
              className="flex items-center gap-2"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Content' : 'Save Content')}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-4 py-6">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-6 bg-card border border-border rounded-lg p-1 h-auto gap-1">
                <TabsTrigger value="job-selection" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:block">Job</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="welcome" 
                  className="flex items-center gap-2"
                  disabled={!form.getValues('jobId')}
                >
                  <HandHeart className="h-4 w-4" />
                  <span className="hidden md:block">Welcome</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="company" 
                  className="flex items-center gap-2"
                  disabled={!form.getValues('jobId')}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="hidden md:block">Company</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="team" 
                  className="flex items-center gap-2"
                  disabled={!form.getValues('jobId')}
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden md:block">Team</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="forms" 
                  className="flex items-center gap-2"
                  disabled={!form.getValues('jobId')}
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden md:block">Forms</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="documents" 
                  className="flex items-center gap-2"
                  disabled={!form.getValues('jobId')}
                >
                  <PenTool className="h-4 w-4" />
                  <span className="hidden md:block">Documents</span>
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                {/* Job Selection Tab */}
                <TabsContent value="job-selection">
                  <Card className="bg-card shadow rounded-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Select Job for Onboarding Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Search Jobs</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by job title or description..."
                            value={jobSearchTerm}
                            onChange={(e) => setJobSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Available Jobs</Label>
                        {loadingJobs ? (
                          <div className="flex items-center justify-center py-8">
                            <LoaderCircle className="h-6 w-6 animate-spin" />
                            <span className="ml-2">Loading jobs...</span>
                          </div>
                        ) : filteredJobs.length === 0 ? (
                          <p className="text-muted-foreground py-8 text-center">
                            {jobSearchTerm ? 'No jobs found matching your search.' : 'No jobs available.'}
                          </p>
                        ) : (
                          <div className="grid gap-3 max-h-96 overflow-y-auto">
                            {filteredJobs.map((job) => (
                              <Card 
                                key={job.id} 
                                className={`cursor-pointer transition-all border ${
                                  form.getValues('jobId') === job.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                }`}
                                onClick={() => handleJobSelect(job.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-foreground">{job.title}</h3>
                                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                        {job.description}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <Badge variant={job.status === 'published' ? 'default' : 'secondary'}>
                                          {job.status}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(job.created_at).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                    {form.getValues('jobId') === job.id && (
                                      <div className="text-primary">
                                        <Edit className="h-4 w-4" />
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      {form.getValues('jobId') && (
                        <div className="pt-4 border-t">
                          <p className="text-sm text-muted-foreground mb-3">
                            Selected job: <span className="font-medium text-foreground">
                              {jobs.find(j => j.id === form.getValues('jobId'))?.title}
                            </span>
                          </p>
                          <Button 
                            type="button" 
                            onClick={() => setActiveTab('welcome')}
                            className="w-full"
                          >
                            Continue to Configure Onboarding Content
                          </Button>
                        </div>
                      )}

                      {form.formState.errors.jobId && (
                        <p className="text-sm text-destructive">{form.formState.errors.jobId.message}</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Welcome Tab */}
                <TabsContent value="welcome">
                  <Card className="bg-card shadow rounded-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <HandHeart className="h-5 w-5 text-primary" />
                        Welcome Screen Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="welcome-title">Welcome Title</Label>
                          <Input
                            id="welcome-title"
                            {...form.register("welcomeContent.title")}
                            className={form.formState.errors.welcomeContent?.title ? "border-destructive" : ""}
                          />
                          {form.formState.errors.welcomeContent?.title && (
                            <p className="text-xs text-destructive">{form.formState.errors.welcomeContent.title.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="welcome-subtitle">Subtitle</Label>
                          <Input
                            id="welcome-subtitle"
                            {...form.register("welcomeContent.subtitle")}
                            className={form.formState.errors.welcomeContent?.subtitle ? "border-destructive" : ""}
                          />
                          {form.formState.errors.welcomeContent?.subtitle && (
                            <p className="text-xs text-destructive">{form.formState.errors.welcomeContent.subtitle.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="welcome-description">Description</Label>
                        <Textarea
                          id="welcome-description"
                          {...form.register("welcomeContent.description")}
                          rows={3}
                          className={form.formState.errors.welcomeContent?.description ? "border-destructive" : ""}
                        />
                        {form.formState.errors.welcomeContent?.description && (
                          <p className="text-xs text-destructive">{form.formState.errors.welcomeContent.description.message}</p>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="role-title">Role Title</Label>
                          <Input
                            id="role-title"
                            {...form.register("welcomeContent.roleTitle")}
                            className={form.formState.errors.welcomeContent?.roleTitle ? "border-destructive" : ""}
                          />
                          {form.formState.errors.welcomeContent?.roleTitle && (
                            <p className="text-xs text-destructive">{form.formState.errors.welcomeContent.roleTitle.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="department">Department</Label>
                          <Input
                            id="department"
                            {...form.register("welcomeContent.department")}
                            className={form.formState.errors.welcomeContent?.department ? "border-destructive" : ""}
                          />
                          {form.formState.errors.welcomeContent?.department && (
                            <p className="text-xs text-destructive">{form.formState.errors.welcomeContent.department.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-date">Start Date</Label>
                          <Input
                            id="start-date"
                            type="date"
                            {...form.register("welcomeContent.startDate")}
                            className={form.formState.errors.welcomeContent?.startDate ? "border-destructive" : ""}
                          />
                          {form.formState.errors.welcomeContent?.startDate && (
                            <p className="text-xs text-destructive">{form.formState.errors.welcomeContent.startDate.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="manager">Manager</Label>
                          <Input
                            id="manager"
                            {...form.register("welcomeContent.manager")}
                            className={form.formState.errors.welcomeContent?.manager ? "border-destructive" : ""}
                          />
                          {form.formState.errors.welcomeContent?.manager && (
                            <p className="text-xs text-destructive">{form.formState.errors.welcomeContent.manager.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Key Points</Label>
                          <Button 
                            type="button"
                            onClick={() => appendKeyPoint('')} 
                            size="sm" 
                            variant="outline"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Point
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {keyPointFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                              <Input
                                {...form.register(`welcomeContent.keyPoints.${index}` as const)}
                                placeholder="Enter key point..."
                                className={form.formState.errors.welcomeContent?.keyPoints?.[index] ? "border-destructive" : ""}
                              />
                              <Button
                                type="button"
                                onClick={() => removeKeyPoint(index)}
                                size="sm"
                                variant="outline"
                                disabled={keyPointFields.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        {form.formState.errors.welcomeContent?.keyPoints && (
                          <p className="text-xs text-destructive">
                            {form.formState.errors.welcomeContent.keyPoints.message}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Company Tab */}
                <TabsContent value="company">
                  <Card className="bg-card shadow rounded-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Company Profile Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="company-name">Company Name</Label>
                          <Input
                            id="company-name"
                            {...form.register("companyContent.companyName")}
                            className={form.formState.errors.companyContent?.companyName ? "border-destructive" : ""}
                          />
                          {form.formState.errors.companyContent?.companyName && (
                            <p className="text-xs text-destructive">{form.formState.errors.companyContent.companyName.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="founded-year">Founded Year</Label>
                          <Input
                            id="founded-year"
                            {...form.register("companyContent.foundedYear")}
                            className={form.formState.errors.companyContent?.foundedYear ? "border-destructive" : ""}
                          />
                          {form.formState.errors.companyContent?.foundedYear && (
                            <p className="text-xs text-destructive">{form.formState.errors.companyContent.foundedYear.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company-description">Company Description</Label>
                        <Textarea
                          id="company-description"
                          {...form.register("companyContent.description")}
                          rows={3}
                          className={form.formState.errors.companyContent?.description ? "border-destructive" : ""}
                        />
                        {form.formState.errors.companyContent?.description && (
                          <p className="text-xs text-destructive">{form.formState.errors.companyContent.description.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mission">Mission Statement</Label>
                        <Textarea
                          id="mission"
                          {...form.register("companyContent.mission")}
                          rows={2}
                          className={form.formState.errors.companyContent?.mission ? "border-destructive" : ""}
                        />
                        {form.formState.errors.companyContent?.mission && (
                          <p className="text-xs text-destructive">{form.formState.errors.companyContent.mission.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vision">Vision Statement</Label>
                        <Textarea
                          id="vision"
                          {...form.register("companyContent.vision")}
                          rows={2}
                          className={form.formState.errors.companyContent?.vision ? "border-destructive" : ""}
                        />
                        {form.formState.errors.companyContent?.vision && (
                          <p className="text-xs text-destructive">{form.formState.errors.companyContent.vision.message}</p>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Company Values</Label>
                          <Button
                            type="button"
                            onClick={() => appendValue('')}
                            size="sm"
                            variant="outline"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Value
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {valueFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                              <Input
                                {...form.register(`companyContent.values.${index}` as const)}
                                placeholder="Enter company value..."
                                className={form.formState.errors.companyContent?.values?.[index] ? "border-destructive" : ""}
                              />
                              <Button
                                type="button"
                                onClick={() => removeValue(index)}
                                size="sm"
                                variant="outline"
                                disabled={valueFields.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="customers">Customers</Label>
                          <Input
                            id="customers"
                            {...form.register("companyContent.stats.customers")}
                            placeholder="e.g., 50+ million"
                            className={form.formState.errors.companyContent?.stats?.customers ? "border-destructive" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="countries">Countries</Label>
                          <Input
                            id="countries"
                            {...form.register("companyContent.stats.countries")}
                            placeholder="e.g., 15"
                            className={form.formState.errors.companyContent?.stats?.countries ? "border-destructive" : ""}
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="employees">Employees</Label>
                          <Input
                            id="employees"
                            {...form.register("companyContent.stats.employees")}
                            placeholder="e.g., 5,000+"
                            className={form.formState.errors.companyContent?.stats?.employees ? "border-destructive" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="revenue">Revenue</Label>
                          <Input
                            id="revenue"
                            {...form.register("companyContent.stats.revenue")}
                            placeholder="e.g., $2.3 billion"
                            className={form.formState.errors.companyContent?.stats?.revenue ? "border-destructive" : ""}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Tech Stack</Label>
                          <Button
                            type="button"
                            onClick={() => appendTechStack('')}
                            size="sm"
                            variant="outline"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Technology
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {techStackFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                              <Input
                                {...form.register(`companyContent.techStack.${index}` as const)}
                                placeholder="Enter technology..."
                                className={form.formState.errors.companyContent?.techStack?.[index] ? "border-destructive" : ""}
                              />
                              <Button
                                type="button"
                                onClick={() => removeTechStack(index)}
                                size="sm"
                                variant="outline"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Team Tab */}
                <TabsContent value="team">
                  <Card className="bg-card shadow rounded-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          Team Structure
                        </div>
                        <Button 
                          type="button"
                          onClick={() => appendTeamMember({
                            id: Date.now().toString(),
                            name: '',
                            role: '',
                            department: '',
                            email: '',
                            bio: '',
                          })} 
                          size="sm"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Team Member
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {teamMemberFields.map((member, index) => (
                        <Card key={member.id} className="border border-border">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Team Member {index + 1}</h4>
                              <Button
                                type="button"
                                onClick={() => removeTeamMember(index)}
                                size="sm"
                                variant="outline"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                  {...form.register(`teamMembers.${index}.name` as const)}
                                  placeholder="Full name"
                                  className={form.formState.errors.teamMembers?.[index]?.name ? "border-destructive" : ""}
                                />
                                {form.formState.errors.teamMembers?.[index]?.name && (
                                  <p className="text-xs text-destructive">{form.formState.errors.teamMembers[index]?.name?.message}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Role</Label>
                                <Input
                                  {...form.register(`teamMembers.${index}.role` as const)}
                                  placeholder="Job title"
                                  className={form.formState.errors.teamMembers?.[index]?.role ? "border-destructive" : ""}
                                />
                                {form.formState.errors.teamMembers?.[index]?.role && (
                                  <p className="text-xs text-destructive">{form.formState.errors.teamMembers[index]?.role?.message}</p>
                                )}
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Department</Label>
                                <Input
                                  {...form.register(`teamMembers.${index}.department` as const)}
                                  placeholder="Department"
                                  className={form.formState.errors.teamMembers?.[index]?.department ? "border-destructive" : ""}
                                />
                                {form.formState.errors.teamMembers?.[index]?.department && (
                                  <p className="text-xs text-destructive">{form.formState.errors.teamMembers[index]?.department?.message}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                  {...form.register(`teamMembers.${index}.email` as const)}
                                  placeholder="email@company.com"
                                  className={form.formState.errors.teamMembers?.[index]?.email ? "border-destructive" : ""}
                                />
                                {form.formState.errors.teamMembers?.[index]?.email && (
                                  <p className="text-xs text-destructive">{form.formState.errors.teamMembers[index]?.email?.message}</p>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Bio</Label>
                              <Textarea
                                {...form.register(`teamMembers.${index}.bio` as const)}
                                placeholder="Brief bio or description"
                                rows={2}
                                className={form.formState.errors.teamMembers?.[index]?.bio ? "border-destructive" : ""}
                              />
                              {form.formState.errors.teamMembers?.[index]?.bio && (
                                <p className="text-xs text-destructive">{form.formState.errors.teamMembers[index]?.bio?.message}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Forms Tab */}
                <TabsContent value="forms">
                  <Card className="bg-card shadow rounded-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          Onboarding Form Fields
                        </div>
                        <Button 
                          type="button"
                          onClick={() => appendFormField({
                            id: Date.now().toString(),
                            label: '',
                            type: 'text',
                            required: false,
                            placeholder: '',
                          })} 
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Field
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {formFieldFields.map((field, index) => (
                        <Card key={field.id} className="border border-border">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Form Field {index + 1}</h4>
                              <Button
                                type="button"
                                onClick={() => removeFormField(index)}
                                size="sm"
                                variant="outline"
                                disabled={formFieldFields.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Field Label</Label>
                                <Input
                                  {...form.register(`formFields.${index}.label` as const)}
                                  placeholder="Field label"
                                  className={form.formState.errors.formFields?.[index]?.label ? "border-destructive" : ""}
                                />
                                {form.formState.errors.formFields?.[index]?.label && (
                                  <p className="text-xs text-destructive">{form.formState.errors.formFields[index]?.label?.message}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Field Type</Label>
                                <Controller
                                  control={form.control}
                                  name={`formFields.${index}.type` as const}
                                  render={({ field: controllerField }) => (
                                    <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="phone">Phone</SelectItem>
                                        <SelectItem value="select">Select</SelectItem>
                                        <SelectItem value="textarea">Textarea</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Placeholder</Label>
                                <Input
                                  {...form.register(`formFields.${index}.placeholder` as const)}
                                  placeholder="Placeholder text"
                                />
                              </div>
                              <div className="flex items-center space-x-2 pt-6">
                                <Controller
                                  control={form.control}
                                  name={`formFields.${index}.required` as const}
                                  render={({ field: controllerField }) => (
                                    <input
                                      type="checkbox"
                                      id={`required-${index}`}
                                      checked={controllerField.value}
                                      onChange={controllerField.onChange}
                                    />
                                  )}
                                />
                                <Label htmlFor={`required-${index}`}>Required Field</Label>
                              </div>
                            </div>

                            {form.watch(`formFields.${index}.type`) === 'select' && (
                              <div className="space-y-2">
                                <Label>Options (one per line)</Label>
                                <Controller
                                  control={form.control}
                                  name={`formFields.${index}.options` as const}
                                  render={({ field: controllerField }) => (
                                    <Textarea
                                      value={controllerField.value?.join('\n') || ''}
                                      onChange={(e) => controllerField.onChange(e.target.value.split('\n').filter(Boolean))}
                                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                                      rows={3}
                                    />
                                  )}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents">
                  <Card className="bg-card shadow rounded-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PenTool className="h-5 w-5 text-primary" />
                          Signing Documents
                        </div>
                        <Button 
                          type="button"
                          onClick={() => appendDocument({
                            id: Date.now().toString(),
                            title: '',
                            type: 'other',
                            description: '',
                            required: false,
                            content: '',
                          })} 
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Document
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {documentFields.map((document, index) => (
                        <Card key={document.id} className="border border-border">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Document {index + 1}</h4>
                              <Button
                                type="button"
                                onClick={() => removeDocument(index)}
                                size="sm"
                                variant="outline"
                                disabled={documentFields.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Document Title</Label>
                                <Input
                                  {...form.register(`documents.${index}.title` as const)}
                                  placeholder="Document title"
                                  className={form.formState.errors.documents?.[index]?.title ? "border-destructive" : ""}
                                />
                                {form.formState.errors.documents?.[index]?.title && (
                                  <p className="text-xs text-destructive">{form.formState.errors.documents[index]?.title?.message}</p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Document Type</Label>
                                <Controller
                                  control={form.control}
                                  name={`documents.${index}.type` as const}
                                  render={({ field: controllerField }) => (
                                    <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="policy">Policy</SelectItem>
                                        <SelectItem value="agreement">Agreement</SelectItem>
                                        <SelectItem value="handbook">Handbook</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                {...form.register(`documents.${index}.description` as const)}
                                placeholder="Brief description of the document"
                                rows={2}
                                className={form.formState.errors.documents?.[index]?.description ? "border-destructive" : ""}
                              />
                              {form.formState.errors.documents?.[index]?.description && (
                                <p className="text-xs text-destructive">{form.formState.errors.documents[index]?.description?.message}</p>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              <Controller
                                control={form.control}
                                name={`documents.${index}.required` as const}
                                render={({ field: controllerField }) => (
                                  <input
                                    type="checkbox"
                                    id={`doc-required-${index}`}
                                    checked={controllerField.value}
                                    onChange={controllerField.onChange}
                                  />
                                )}
                              />
                              <Label htmlFor={`doc-required-${index}`}>Required Document</Label>
                            </div>

                            <div className="space-y-2">
                              <Label>Document Content</Label>
                              <Textarea
                                {...form.register(`documents.${index}.content` as const)}
                                placeholder="Document content or terms..."
                                rows={4}
                                className={form.formState.errors.documents?.[index]?.content ? "border-destructive" : ""}
                              />
                              {form.formState.errors.documents?.[index]?.content && (
                                <p className="text-xs text-destructive">{form.formState.errors.documents[index]?.content?.message}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </form>
        </div>
      </div>
    </div>
  );
}
