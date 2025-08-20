'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation'; // To get the job ID from URL
import { JobVacancy, Candidate as CandidateType, ApplicationStatus } from '@/types/database'; // Assuming this is the correct type
import { DataTableApplicants } from './data-applicants'; // We will create this later
import { useDashboard } from '@/contexts/DashboardContext'; // Import useDashboard
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'; // Import icons
import { Button } from '@/components/ui/button';
import { updateJobStatus } from '@/app/actions';
import { toast } from 'sonner';
import Link from 'next/link';
import { Edit, Archive } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
// import { Candidate } from '@/types/database'; // We will need this for applicants

// Mock candidate type for now, will be replaced by DataTableApplicants and its data
interface Candidate {
  id: string;
  name: string;
  email: string;
  score: number;
  status: 'pending' | 'reviewed' | 'rejected' | 'accepted';
}

// Interface for applicant data as expected by DataTableApplicants (includes job-specific app status/date)
interface ApplicantDataForPage extends CandidateType {
  application_status_for_this_job?: ApplicationStatus;
  application_date_for_this_job?: string;
  // New fields from the updated API response
  application_id: string; // From job_applications.id, non-optional
  decision?: string;       // From scoring_results.decision
  overall_score?: number;  // From scoring_results.overall_score
  referralName?: string;
  referralEmail?: string;
  referralPosition?: string;
  referralDept?: string;
}

// Helper to render text or array of text as a list
const renderTextAsList = (content: any, fallbackText: string, listClassName: string = "list-disc list-outside space-y-1 text-sm text-muted-foreground leading-relaxed pl-5") => {
  if (!content) {
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{fallbackText}</p>;
  }

  if (Array.isArray(content)) {
    if (content.length === 0) {
      return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{fallbackText}</p>;
    }
    return (
      <ul className={listClassName}>
        {content.map((item, index) => (
          <li key={index} className="pl-1">
            {typeof item === 'string' ? item : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof content === 'string' && content.trim() !== '') {
    // Treat string as a single bullet point or paragraph depending on context
    // For this page, we'll make it a single bullet if it's not already an array.
    // Or, if it's a long string, it could be split by newlines if desired.
    // For simplicity here, let's wrap it in a ul/li if it's meant to be a list item.
    // However, the original page.tsx displays strings directly, so we'll check the usage.
    // Given the request for "bullet points", we should try to make it a list.
    // If the string contains newlines, we can split it.
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length > 1) {
      return (
        <ul className={listClassName}>
          {lines.map((item, index) => (
            <li key={index} className="pl-1">{item}</li>
          ))}
        </ul>
      );
    }
    // If it's a single line string or doesn't contain newlines for splitting
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{content}</p>;
  }
  
  // Fallback for other types or empty content
  return <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{fallbackText}</p>;
};

// Helper function to get status variant for badges
const getStatusVariant = (status: string | undefined) => {
  if (!status) return 'secondary';
  
  switch (status.toLowerCase()) {
    case 'published':
      return 'default';
    case 'draft':
      return 'secondary';
    case 'archived':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const applicationId = searchParams.get('applicationId');
  const { setSiteTitle } = useDashboard(); // Get setSiteTitle from context

  const [job, setJob] = useState<JobVacancy | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [errorJob, setErrorJob] = useState<string | null>(null);

  const [applicants, setApplicants] = useState<ApplicantDataForPage[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(true); 
  const [errorApplicants, setErrorApplicants] = useState<string | null>(null);

  const [showJobDesc, setShowJobDesc] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  useEffect(() => {
    // Set initial title or clear it
    setSiteTitle("Job Details");

    if (jobId) {
      async function fetchJobDetails() {
        setLoadingJob(true);
        try {
          const response = await fetch(`/api/jobs/${jobId}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch job details: ${response.statusText}`);
          }
          const data: JobVacancy = await response.json();
          setJob(data);
          setErrorJob(null);
        } catch (err) {
          console.error("Failed to load job details:", err);
          setErrorJob(err instanceof Error ? err.message : 'An unknown error occurred.');
          setJob(null);
        } finally {
          setLoadingJob(false);
        }
      }

      async function fetchJobApplicants() {
        setLoadingApplicants(true);
        try {
          const response = await fetch(`/api/jobs/${jobId}/applicants`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch applicants: ${response.statusText}`);
          }
          // The API returns an array of candidates, each potentially with applicationStatus and applicationDate
          const dataFromApi = await response.json(); 
          
          // The API at /api/jobs/[id]/applicants/route.ts now returns these fields directly.
          // The existing mapping structure in page.tsx should correctly pick them up
          // if dataFromApi objects have properties like 'application_id', 'decision', 'overall_score'.
          const formattedData: ApplicantDataForPage[] = dataFromApi.map((apiApp: any) => ({
            // CandidateType fields (ensure apiApp has them or map them)
            id: apiApp.id,
            created_at: apiApp.created_at,
            full_name: apiApp.full_name,
            email: apiApp.email,
            phone: apiApp.phone,
            birthdate: apiApp.birthdate,
            job_interest: apiApp.job_interest,
            education: apiApp.education,
            work_experience: apiApp.work_experience,
            org_experience: apiApp.org_experience,
            summary: apiApp.summary,
            has_resume: apiApp.has_resume,
            job_applications_count: apiApp.job_applications_count,
            
            // Job application specific fields, already expected by API
            application_status_for_this_job: apiApp.application_status_for_this_job,
            application_date_for_this_job: apiApp.application_date_for_this_job,

            // New scoring fields from API
            application_id: apiApp.application_id, // This is now directly from the API response
            decision: apiApp.decision,             // This is now directly from the API response
            overall_score: apiApp.overall_score,   // This is now directly from the API response
            
            // Add referral information
            referralName: apiApp.referral_name,
            referralEmail: apiApp.referral_email,
            referralPosition: apiApp.referral_position,
            referralDept: apiApp.referral_dept,
          }));
          setApplicants(formattedData);
          setErrorApplicants(null);
        } catch (err) {
          console.error("Failed to load applicants:", err);
          setErrorApplicants(err instanceof Error ? err.message : 'An unknown error occurred.');
          setApplicants([]);
        } finally {
          setLoadingApplicants(false);
        }
      }

      fetchJobDetails();
      fetchJobApplicants();
    }

    // Cleanup function to reset title when component unmounts
    return () => {
      setSiteTitle(null);
    };
  }, [jobId, setSiteTitle]); // Add setSiteTitle to dependency array

  // Update site title based on job loading state and data
  useEffect(() => {
    if (loadingJob) {
      setSiteTitle("Loading Job...");
    } else if (job) {
      setSiteTitle(`Job: ${job.title}`);
    } else if (errorJob) {
      setSiteTitle("Job - Error");
    } else if (!jobId && !loadingJob) {
      setSiteTitle("Job - Not Found");
    }
  }, [job, loadingJob, errorJob, jobId, setSiteTitle]);

  // Function to handle status update
  const handleStatusUpdate = async (newStatus: 'draft' | 'published' | 'archived') => {
    if (!job || isUpdatingStatus) return;
    
    setIsUpdatingStatus(true);
    try {
      const result = await updateJobStatus({
        jobId: job.id,
        status: newStatus
      });
      
      if (result.success) {
        setJob({ ...job, status: newStatus });
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Failed to update job status:', error);
      toast.error('Failed to update job status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Function to handle archive confirmation
  const handleArchive = () => {
    // Check if there are applicants
    const hasApplicants = applicants.length > 0;
    setIsArchiveDialogOpen(true);
  };

  // Function to confirm archive action
  const confirmArchive = () => {
    handleStatusUpdate('archived');
    setIsArchiveDialogOpen(false);
  };

  // Function to refresh job data after edit
  const refreshJobData = async () => {
    if (!jobId) return;
    
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (response.ok) {
        const data: JobVacancy = await response.json();
        setJob(data);
      }
    } catch (error) {
      console.error('Failed to refresh job data:', error);
    }
  };

  const handleApplicationIdChange = (newApplicationId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newApplicationId) {
      params.set('applicationId', newApplicationId);
    } else {
      params.delete('applicationId');
    }
    router.push(`/jobs/${jobId}?${params.toString()}`, { scroll: false });
  };



  if (loadingJob) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading job details...</p> {/* Replace with a spinner later */}
      </div>
    );
  }

  if (errorJob) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Error: {errorJob}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Job not found.</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-8">
      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Job</AlertDialogTitle>
            <AlertDialogDescription>
              {applicants.length > 0 
                ? `Are you sure? This job post already has ${applicants.length} applicant${applicants.length === 1 ? '' : 's'}.` 
                : 'Are you sure you want to archive this job?'}
              <br /><br />
              Archiving will remove this job from active listings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Job Details Section */}
      <div className="bg-card shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2 text-foreground">{job.title}</h1>
            <p className="text-sm text-muted-foreground">Posted on: {new Date(job.created_at).toLocaleDateString()}</p>
          </div>
          
          {/* Status Management Section */}
          <div className="flex flex-col sm:items-end gap-3">
            
            <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  asChild
                >
                  <Link href={`/jobs/${jobId}/edit`}>
                    <Edit className="h-4 w-4" />
                    Edit
                  </Link>
                </Button>
                
                {(job.status || 'draft') !== 'draft' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusUpdate('draft')}
                    disabled={isUpdatingStatus}
                  >
                    {isUpdatingStatus ? 'Updating...' : 'Set as Draft'}
                  </Button>
                )}
                {(job.status || 'draft') !== 'published' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusUpdate('published')}
                    disabled={isUpdatingStatus}
                  >
                    {isUpdatingStatus ? 'Publishing...' : 'Publish'}
                  </Button>
                )}
                {(job.status || 'draft') !== 'archived' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleArchive}
                    disabled={isUpdatingStatus}
                    className="flex items-center gap-1"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </Button>
                )}
              </div>
            
          </div>
        </div>
        
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2 text-foreground">Overview</h2>
          <p className="text-muted-foreground whitespace-pre-wrap">{job.description || "No overview provided."}</p>
        </div>
        
        {/* Combined Job Description and Requirements Section */}
        {(job.job_desc || job.requirements) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-4">
            {/* Job Description Column */}
            {job.job_desc && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowJobDesc(!showJobDesc)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h2 className="text-xl font-semibold text-foreground">Job Description Details</h2>
                  {showJobDesc ? <ChevronUpIcon className="h-5 w-5 text-muted-foreground" /> : <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />}
                </button>
                {showJobDesc && (
                  <div className="pl-2 pt-1">
                    {renderTextAsList(job.job_desc, "No detailed description provided.")}
                  </div>
              )}
            </div>
            )}

            {/* Requirements Column */}
            {job.requirements && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowRequirements(!showRequirements)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h2 className="text-xl font-semibold text-foreground">Requirements</h2>
                  {showRequirements ? <ChevronUpIcon className="h-5 w-5 text-muted-foreground" /> : <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />}
                </button>
                {showRequirements && (
                  <div className="pl-2 pt-1">
                    {renderTextAsList(job.requirements, "No requirements specified.")}
                  </div>
                )}
            </div>
            )}
          </div>
        )}
      </div>

      {/* Applicants Table Section */}
      <div className="bg-card shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Applicants for this Job</h2>
        <DataTableApplicants 
          data={applicants} 
          loading={loadingApplicants} 
          error={errorApplicants} 
          jobTitle={job?.title}
          selectedApplicationId={applicationId}
          onApplicationIdChange={handleApplicationIdChange}
          onDataRefresh={async () => {
            setLoadingApplicants(true);
            try {
              const response = await fetch(`/api/jobs/${jobId}/applicants`);
              if (response.ok) {
                const dataFromApi = await response.json();
                const formattedData: ApplicantDataForPage[] = dataFromApi.map((apiApp: any) => ({
                  id: apiApp.id,
                  created_at: apiApp.created_at,
                  full_name: apiApp.full_name,
                  email: apiApp.email,
                  phone: apiApp.phone,
                  birthdate: apiApp.birthdate,
                  job_interest: apiApp.job_interest,
                  education: apiApp.education,
                  work_experience: apiApp.work_experience,
                  org_experience: apiApp.org_experience,
                  summary: apiApp.summary,
                  has_resume: apiApp.has_resume,
                  job_applications_count: apiApp.job_applications_count,
                  application_status_for_this_job: apiApp.application_status_for_this_job,
                  application_date_for_this_job: apiApp.application_date_for_this_job,
                  application_id: apiApp.application_id,
                  decision: apiApp.decision,
                  overall_score: apiApp.overall_score,
                  referralName: apiApp.referral_name,
                  referralEmail: apiApp.referral_email,
                }));
                setApplicants(formattedData);
              }
            } catch (error) {
              console.error('Failed to refresh applicants:', error);
            } finally {
              setLoadingApplicants(false);
            }
          }}
        />
      </div>


    </main>
  );
}