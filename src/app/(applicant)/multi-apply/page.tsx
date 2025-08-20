'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, ChevronDown, X, Search, Plus, Loader2 } from 'lucide-react';
import { JobVacancy } from '@/types/database';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { SheetApply } from '../apply/sheet-apply';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCookie } from 'cookies-next';
import { getPublishedJobVacancies } from '@/app/actions';

// Define an interface for the expected response from the upload API
interface ResumeUploadResponse {
  message: string;
  gcsPath: string;
  fileName: string;
  fileSize: number;
  resumeId?: string | null; // Made optional and nullable as per API logic
  candidateId?: string | null;
  applicantEmail?: string;
  applicantFullName?: string;
}

const JobApplicationPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [job, setJob] = useState<JobVacancy | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Multi-apply specific states
  const [availableJobs, setAvailableJobs] = useState<JobVacancy[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<JobVacancy[]>([]);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobsLoading, setJobsLoading] = useState(false);
  const [isMultiApplying, setIsMultiApplying] = useState(false);
  const [applicationProgress, setApplicationProgress] = useState<{
    [jobId: string]: {
      status: 'pending' | 'processing' | 'completed' | 'error',
      progress: number,
      score?: number,
      error?: string,
      assessmentResult?: any
    }
  }>({});

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [submissionMode, setSubmissionMode] = useState<string>("resume");
  const [referralName, setReferralName] = useState('');
  const [referralEmail, setReferralEmail] = useState('');
  const [referralPosition, setReferralPosition] = useState('');
  const [referralDept, setReferralDept] = useState('');
  const [isReferralExpanded, setIsReferralExpanded] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Store upload results to avoid re-uploading
  const [uploadResults, setUploadResults] = useState<{
    candidateId: string;
    resumeId: string;
    gcsPath: string;
    fileName: string;
    applicantFullName: string;
    applicantEmail: string;
  } | null>(null);

  const { setSiteTitle } = useDashboard();
  const { isAuthenticated } = useAuth();

  // Helper function to decode JWT token and extract user info
  const getUserInfoFromToken = (): { email: string; fullName: string } | null => {
    try {
      const tokenValue = getCookie('access_token');
      const token = typeof tokenValue === 'string' ? tokenValue : null;

      if (!token) return null;

      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        email: payload.email || '',
        fullName: payload.fullName || payload.full_name || payload.email?.split('@')[0] || ''
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Prefill user information when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const userInfo = getUserInfoFromToken();
      if (userInfo) {
        setFullName(userInfo.fullName);
        setEmail(userInfo.email);
      }
    }
  }, [isAuthenticated]);

  // Fetch available published jobs
  const fetchAvailableJobs = async () => {
    setJobsLoading(true);
    try {
      const jobs = await getPublishedJobVacancies();
      setAvailableJobs(jobs);
    } catch (error) {
      console.error('Error fetching available jobs:', error);
    } finally {
      setJobsLoading(false);
    }
  };

  // Load available jobs on component mount
  useEffect(() => {
    fetchAvailableJobs();
  }, []);

  // Filter jobs based on search query
  const filteredJobs = availableJobs.filter(job =>
    job.title.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(jobSearchQuery.toLowerCase())
  ).filter(job => !selectedJobs.some(selected => selected.id === job.id));

  // Add job to selected list
  const addJobToSelection = (job: JobVacancy) => {
    if (!selectedJobs.some(selected => selected.id === job.id)) {
      setSelectedJobs([...selectedJobs, job]);
      setJobSearchQuery(''); // Clear search after selection
    }
  };

  // Remove job from selected list
  const removeJobFromSelection = (jobId: string) => {
    const updatedJobs = selectedJobs.filter(job => job.id !== jobId);
    setSelectedJobs(updatedJobs);
    
    // Reset progress for this job
    setApplicationProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[jobId];
      return newProgress;
    });
    
    // Clear upload results if no jobs are selected
    if (updatedJobs.length === 0) {
      setUploadResults(null);
    }
  };

  useEffect(() => {
    setSiteTitle("Multi Apply");
    setLoading(false); // No need to load specific job for multi-apply

    return () => {
      setSiteTitle(null);
    };
  }, [setSiteTitle]);

  useEffect(() => {
    if (jobsLoading) {
      setSiteTitle("Loading Jobs...");
    } else {
      setSiteTitle("Multi Apply");
    }
  }, [jobsLoading, setSiteTitle]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
      ];

      if (allowedTypes.includes(file.type)) {
        setResume(file);
        setFileError(null);
        // Clear previous upload results when a new file is selected
        setUploadResults(null);
        setApplicationProgress({});
      } else {
        setResume(null);
        setFileError('Please upload a PDF file or an image (JPG, PNG, WebP).');
      }
    }
    setIsDragging(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  // Multi-apply function
  const handleMultiApply = async () => {
    if (!resume || selectedJobs.length === 0) {
      setFileError('Please upload a resume and select at least one job.');
      return;
    }

    // Filter out jobs that are already completed or errored
    const jobsToProcess = selectedJobs.filter(job => {
      const progress = applicationProgress[job.id];
      return !progress || (progress.status !== 'completed' && progress.status !== 'error');
    });

    if (jobsToProcess.length === 0) {
      setFileError('All selected jobs have already been processed.');
      return;
    }

    setIsMultiApplying(true);
    setSubmitError(null);

    // Initialize progress only for jobs that need processing
    const initialProgress: { [jobId: string]: any } = { ...applicationProgress };
    jobsToProcess.forEach(job => {
      initialProgress[job.id] = { status: 'pending' as const, progress: 0 };
    });
    setApplicationProgress(initialProgress);

    try {
      // Step 1: Upload the resume once
      const uploadFormData = new FormData();
      uploadFormData.append('resume', resume);
      uploadFormData.append('fullName', fullName);
      uploadFormData.append('email', email);

      const uploadResponse = await fetch('/api/resumes/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || `Resume upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult: ResumeUploadResponse = await uploadResponse.json();
      const { gcsPath, fileName: uploadedFileName, candidateId, resumeId } = uploadResult;

      if (!candidateId || !resumeId) {
        throw new Error('Failed to get candidate or resume ID after upload.');
      }

      // Store upload results for reuse in individual submissions
      setUploadResults({
        candidateId,
        resumeId,
        gcsPath,
        fileName: uploadedFileName,
        applicantFullName: uploadResult.applicantFullName || fullName,
        applicantEmail: uploadResult.applicantEmail || email
      });

      // Step 2: Extract resume data once
      try {
        const extractResponse = await fetch('/api/resumes/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gcsPath,
            fileName: uploadedFileName,
            mimeType: resume.type,
            candidateId
          }),
        });

        if (!extractResponse.ok) {
          console.warn('Resume extraction failed but continuing with applications');
        }
      } catch (extractError) {
        console.warn('Error during resume extraction but continuing:', extractError);
      }

      // Step 3: Process each job individually (only unprocessed jobs)
      for (const job of jobsToProcess) {
        try {
          // Update progress to processing
          setApplicationProgress(prev => ({
            ...prev,
            [job.id]: { status: 'processing' as const, progress: 25 }
          }));

          // Review application
          const reviewPayload = {
            gcsPath,
            fileName: uploadedFileName,
            mimeType: resume.type,
            jobId: job.id,
            jobTitle: job.title,
            jobDescription: job.description,
            jobRequirements: job.requirements as string[]
          };

          const assessmentResponse = await fetch('/api/applications/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewPayload),
          });

          if (!assessmentResponse.ok) {
            throw new Error('Assessment failed');
          }

          const assessmentResult = await assessmentResponse.json();
          console.log('Assessment result for job', job.id, ':', assessmentResult);

          // Update progress with score - calculate average from all sections
          const calculateOverallScore = (result: any) => {
            const sections = ['experience', 'education', 'skills', 'roleFit', 'certifications', 'projectImpact', 'softSkills'];
            const scores = sections.map(section => result[section]?.score || 0).filter(score => score > 0);
            return scores.length > 0 ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 20) : 0; // Convert 1-5 scale to percentage
          };

          const overallScore = calculateOverallScore(assessmentResult);

          setApplicationProgress(prev => {
            const newProgress = {
              ...prev,
              [job.id]: {
                status: 'completed' as const,
                progress: 100,
                score: overallScore,
                assessmentResult: assessmentResult
              }
            };
            console.log('Updated application progress:', newProgress);
            return newProgress;
          });

        } catch (error: any) {
          setApplicationProgress(prev => ({
            ...prev,
            [job.id]: {
              status: 'error' as const,
              progress: 0,
              error: error.message
            }
          }));
        }
      }

    } catch (error: any) {
      setSubmitError(`Multi-apply failed: ${error.message}`);
      // Reset all progress and upload results on general error
      setApplicationProgress({});
      setUploadResults(null);
    } finally {
      setIsMultiApplying(false);
    }
  };

  // Submit individual application
  const submitIndividualApplication = async (job: JobVacancy, assessmentResult: any) => {
    try {
      // Check if we have stored upload results from the multi-apply process
      if (!uploadResults) {
        throw new Error('No upload results found. Please run the multi-apply process first.');
      }

      const { candidateId, resumeId } = uploadResults;

      const applicationPayload = {
        jobId: job.id,
        candidateId,
        resumeId,
        applicantFullName: uploadResults.applicantFullName || fullName,
        applicantEmail: uploadResults.applicantEmail || email,
        applicantPhone: phone,
        referralName,
        referralEmail,
        referralPosition,
        referralDept,
        assessmentResult
      };

      const saveApplicationResponse = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationPayload),
      });

      if (!saveApplicationResponse.ok) {
        const errorData = await saveApplicationResponse.json();
        
        // Handle duplicate application (409 status)
        if (saveApplicationResponse.status === 409) {
          toast.error(`You have already applied for ${job.title}. Duplicate applications are not allowed.`);
          // Remove job from selected list since it's already applied
          removeJobFromSelection(job.id);
          return;
        }
        
        // Handle other errors
        const errorMessage = errorData.error || 'Failed to submit application';
        throw new Error(errorMessage);
      }

      // Remove job from selected list after successful submission
      removeJobFromSelection(job.id);

      // Show success message or redirect
      toast.success(`Application submitted successfully for ${job.title}!`);

    } catch (error: any) {
      toast.error(`Failed to submit application for ${job.title}: ${error.message}`);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setFileError(null);

    if (submissionMode !== 'resume') {
      console.log("Main submit called while in form mode. Manual form should handle its own submission.");
      return;
    }

    if (!resume) {
      setFileError('Please upload a resume (PDF) or image (JPG, PNG, WebP).');
      return;
    }
    if (!id || !job) {
      setSubmitError('Job details are not available. Cannot submit application.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Upload the file and get candidate/resume IDs
      const uploadFormData = new FormData();
      uploadFormData.append('resume', resume);
      uploadFormData.append('fullName', fullName); // Add fullName to FormData
      uploadFormData.append('email', email);       // Add email to FormData

      const uploadResponse = await fetch('/api/resumes/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || `Resume upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult: ResumeUploadResponse = await uploadResponse.json();
      // Destructure new fields from uploadResult
      const {
        gcsPath,
        fileName: uploadedFileName,
        candidateId,
        resumeId
      } = uploadResult;

      if (!candidateId || !resumeId) {
        throw new Error('Failed to get candidate or resume ID after upload.');
      }

      // New step: Extract resume data and save to candidates table
      try {
        console.log("JobApplicationPage: Calling /api/resumes/extract to extract resume data");
        const extractResponse = await fetch('/api/resumes/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gcsPath,
            fileName: uploadedFileName,
            mimeType: resume.type,
            candidateId
          }),
        });

        if (!extractResponse.ok) {
          // Log but don't throw - we still want to continue with application
          const extractError = await extractResponse.json();
          console.warn("Resume extraction failed but continuing with application:", extractError);
          console.warn("Resume extraction request payload:", {
            gcsPath,
            fileName: uploadedFileName,
            mimeType: resume.type,
            candidateId
          });
        } else {
          const extractResult = await extractResponse.json();
          console.log("Resume extraction successful:", extractResult);
        }
      } catch (extractError) {
        // Log but don't throw - extraction shouldn't block application submission
        console.warn("Error during resume extraction but continuing with application:", extractError);
      }

      const mimeType = resume.type;

      // Step 2: Send GCS path, metadata, AND jobRequirements to /api/applications/review
      const reviewPayload = {
        gcsPath,
        fileName: uploadedFileName,
        mimeType,
        jobId: id,
        jobTitle: job.title,
        jobDescription: job.description,
        jobRequirements: job.requirements as string[]
      };

      console.log("JobApplicationPage (Resume): Calling /api/applications/review with:", reviewPayload);
      const assessmentResponse = await fetch('/api/applications/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload),
      });

      if (!assessmentResponse.ok) {
        const errorData = await assessmentResponse.json();
        let detailedError = errorData.error || `Assessment failed: ${assessmentResponse.statusText}`;
        if (errorData.details) {
          detailedError += ` (Details: ${errorData.details})`;
        }
        throw new Error(detailedError);
      }

      const assessmentResult = await assessmentResponse.json();

      // Step 3: Call new API to save application and assessment to DB
      const applicationPayload = {
        jobId: id,
        candidateId,
        resumeId,
        applicantFullName: uploadResult.applicantFullName || fullName,
        applicantEmail: uploadResult.applicantEmail || email,
        applicantPhone: phone,
        referralName,
        referralEmail,
        referralPosition,
        referralDept,
        assessmentResult
      };

      console.log("JobApplicationPage: Calling /api/applications/submit with:", applicationPayload);

      const saveApplicationResponse = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationPayload),
      });

      if (!saveApplicationResponse.ok) {
        const errData = await saveApplicationResponse.json();
        // Provide more specific error to the user if available from the API
        let submissionApiError = errData.error || 'Failed to save application to database.';
        if (errData.details) {
          submissionApiError += ` Details: ${errData.details}`;
        }
        throw new Error(submissionApiError);
      }

      const saveApplicationResult = await saveApplicationResponse.json();
      console.log("JobApplicationPage: Application and assessment saved to DB successfully.", saveApplicationResult);

      // --- Debugging localStorage starts ---
      console.log("JobApplicationPage: Attempting to store in localStorage");
      console.log("JobApplicationPage: job.title to be stored:", job?.title); // Log job.title safely
      console.log("JobApplicationPage: assessmentResult to be stored (raw):", assessmentResult);
      try {
        console.log("JobApplicationPage: assessmentResult to be stored (stringified):", JSON.stringify(assessmentResult));
      } catch (stringifyError) {
        console.error("JobApplicationPage: Error stringifying assessmentResult:", stringifyError);
      }
      // --- Debugging localStorage ends ---

      // Store result and job title in localStorage for the result page
      // Ensure job.title is at least an empty string if null/undefined to avoid issues on the result page
      const titleToStore = job?.title ?? "";
      localStorage.setItem(`assessmentResult-${id}`, JSON.stringify(assessmentResult));
      localStorage.setItem(`assessmentJobTitle-${id}`, titleToStore);

      console.log("JobApplicationPage: Successfully stored in localStorage, redirecting..."); // Log before redirect

      // Redirect to the result page
      router.push(`/apply/${id}/result`);

    } catch (e: any) {
      console.error('Application submission failed:', e);
      setSubmitError(`Submission failed: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {selectedJobs.length > 0 && (
        <SheetApply
          job={selectedJobs[0]}
          isOpen={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          showApplyButton={false}
        />
      )}
      <div className="container mx-auto p-4 max-w-4xl">
        <section className="p-6 bg-card text-card-foreground shadow-md rounded-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-muted-foreground">Apply to Multiple Jobs at Once</h3>
          </div>
          {submitError && <p className="mb-4 text-sm text-destructive">{submitError}</p>}

          {/* Job Search Section */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Search and Select Jobs</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for job openings..."
                  value={jobSearchQuery}
                  onChange={(e) => setJobSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {jobsLoading && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Job Search Results */}
            {jobSearchQuery && filteredJobs.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {filteredJobs.slice(0, 5).map((job) => (
                  <div
                    key={job.id}
                    className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                    onClick={() => addJobToSelection(job)}
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <h4 className="font-medium truncate">{job.title}</h4>
                      <p className="text-sm text-muted-foreground truncate">{job.description}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* Selected Jobs List */}
            {selectedJobs.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground mb-2">Selected Jobs ({selectedJobs.length})</label>
                <div className="space-y-2">
                  {selectedJobs.map((job) => {
                    const progress = applicationProgress[job.id];
                    console.log('Rendering job', job.id, 'with progress:', progress);
                    return (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{job.title}</h4>
                          {/* Progress Bar for processing status */}
                          {progress && progress.status === 'processing' && (
                            <div className="mt-2">
                              <Progress value={progress.progress} className="h-2" />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                          {/* Status and Actions on the right */}
                          {!progress || progress.status === 'pending' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeJobFromSelection(job.id)}
                              disabled={isMultiApplying}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : progress.status === 'processing' ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-muted-foreground">Processing...</span>
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : progress.status === 'completed' ? (
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">
                                {progress.score !== undefined && progress.score !== null ?
                                  `Score: ${progress.score}%` :
                                  'Completed (No Score)'
                                }
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => submitIndividualApplication(job, progress.assessmentResult || { overall_score: progress.score })}
                                className="h-6 px-2 text-xs"
                              >
                                Submit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeJobFromSelection(job.id)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : progress.status === 'error' ? (
                            <Badge variant="destructive">Error: {progress.error}</Badge>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Multi Apply Button */}
            {selectedJobs.length > 0 && (
              <Button
                onClick={handleMultiApply}
                disabled={isMultiApplying || !resume || selectedJobs.every(job => {
                  const progress = applicationProgress[job.id];
                  return progress && (progress.status === 'completed' || progress.status === 'error');
                })}
                className="w-full"
              >
                {isMultiApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Applications...
                  </>
                ) : selectedJobs.every(job => {
                  const progress = applicationProgress[job.id];
                  return progress && (progress.status === 'completed' || progress.status === 'error');
                }) ? (
                  'All Jobs Processed'
                ) : (
                  `Multi Apply to ${selectedJobs.filter(job => {
                    const progress = applicationProgress[job.id];
                    return !progress || (progress.status !== 'completed' && progress.status !== 'error');
                  }).length} Job${selectedJobs.filter(job => {
                    const progress = applicationProgress[job.id];
                    return !progress || (progress.status !== 'completed' && progress.status !== 'error');
                  }).length > 1 ? 's' : ''}`
                )}
              </Button>
            )}
          </div>



          {/* Form for resume submission including personal details */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-muted-foreground mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
              />
            </div>

            <div className="sm:flex sm:space-x-4">
              <div className="sm:w-1/2">
                <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
                />
              </div>

              <div className="sm:w-1/2">
                <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1">
                  Phone Number <span className="font-thin text-muted-foreground/80">(Optional)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
                />
              </div>
            </div>

            {/* Resume Dropzone Area */}
            <div className="p-4 border border-border/50 rounded-md bg-background/30">
              <label htmlFor="resumeDropzone" className="block text-sm font-medium text-muted-foreground mb-2">
                Attach Resume or Image (PDF, JPG, PNG, WebP)
              </label>
              <div
                {...getRootProps()}
                id="resumeDropzone"
                className={`mt-1 flex flex-col justify-center items-center px-6 pt-5 pb-6 border-2 ${isDragging || isDragActive ? 'border-primary' : 'border-border'} border-dashed rounded-md cursor-pointer hover:border-primary/70 transition-colors duration-150 ease-in-out min-h-[150px] bg-background/20 hover:bg-muted/30`}
              >
                <input {...getInputProps()} />
                <div className="text-center">
                  <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-2" aria-hidden="true" />
                  {(isDragging || isDragActive) ? (
                    <p className="mt-1 text-sm text-primary">Drop the PDF here!</p>
                  ) : resume ? (
                    <p className="mt-1 text-sm text-foreground">{resume.name}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Drag & drop a PDF or image here, or click to select
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80 mt-0.5">Max 10MB</p>
                </div>
              </div>
              {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}
            </div>

            {/* Expandable Referral Information */}
            <div className="border border-border/50 rounded-md bg-background/30">
              <button
                type="button"
                onClick={() => setIsReferralExpanded(!isReferralExpanded)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  Referral (Optional)
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isReferralExpanded ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {isReferralExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="referralName" className="block text-sm font-medium text-muted-foreground mb-1">
                        Referral Name
                      </label>
                      <input
                        type="text"
                        name="referralName"
                        id="referralName"
                        value={referralName}
                        onChange={(e) => setReferralName(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="referralEmail" className="block text-sm font-medium text-muted-foreground mb-1">
                        Referral Email
                      </label>
                      <input
                        type="email"
                        name="referralEmail"
                        id="referralEmail"
                        value={referralEmail}
                        onChange={(e) => setReferralEmail(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="referralPosition" className="block text-sm font-medium text-muted-foreground mb-1">
                        Referral Role/Position
                      </label>
                      <input
                        type="text"
                        name="referralPosition"
                        id="referralPosition"
                        value={referralPosition}
                        onChange={(e) => setReferralPosition(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="referralDept" className="block text-sm font-medium text-muted-foreground mb-1">
                        Referral Department
                      </label>
                      <input
                        type="text"
                        name="referralDept"
                        id="referralDept"
                        value={referralDept}
                        onChange={(e) => setReferralDept(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>


          {/* The main submit button previously here is now part of the resume form tab */}
          {/* Or handled by ManualApplyFormWithId internally */}
        </section>
      </div>
    </>
  );
};

export default JobApplicationPage;