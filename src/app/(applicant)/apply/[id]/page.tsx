'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileEdit, FileText as FileTextIcon, ChevronDown } from 'lucide-react';
import { JobVacancy } from '@/types/database';
import { Button } from "@/components/ui/button";
import { SheetApply } from '../sheet-apply';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCookie } from 'cookies-next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApplyFormWithId from '../apply-form';

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
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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

  useEffect(() => {
    setSiteTitle("Apply");

    if (id) {
      const fetchJobDetails = async () => {
        setLoading(true);
        setError(null);
        setFileError(null);
        try {
          const response = await fetch(`/api/jobs/${id}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch job details: ${response.statusText}`);
          }
          const data: JobVacancy = await response.json();
          setJob(data);
        } catch (err: any) {
          setError(err.message);
          console.error('Error fetching job details:', err);
          setSiteTitle("Apply - Error");
        }
        setLoading(false);
      };
      fetchJobDetails();
    } else {
      setLoading(false);
      setSiteTitle("Apply - No Job ID");
    }

    return () => {
      setSiteTitle(null);
    };
  }, [id, setSiteTitle]);

  useEffect(() => {
    if (loading) {
      setSiteTitle("Loading Application...");
    } else if (job) {
      setSiteTitle(`Apply - ${job.title}`);
    } else if (error) {
        setSiteTitle("Apply - Job Not Found");
    } else if (!id && !loading) {
        setSiteTitle("Apply - Invalid Job");
    }
  }, [job, loading, error, id, setSiteTitle]);

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

  if (loading) {
    return <div className="container mx-auto p-4">Loading job details...</div>;
  }

  if (error && !job) {
    return <div className="container mx-auto p-4 text-destructive">Error: {error}</div>;
  }

  if (!job) {
    return <div className="container mx-auto p-4">Job not found or failed to load.</div>;
  }

  return (
    <>
      <SheetApply 
        job={job} 
        isOpen={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
        showApplyButton={false} 
      />
      <div className="container mx-auto p-4 max-w-2xl">
        <section className="p-6 bg-card text-card-foreground shadow-md rounded-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-muted-foreground">Submit Application</h3>
            <Button variant="outline" onClick={() => setIsSheetOpen(true)}>
              Job Details
            </Button>
          </div>
          {error && <p className="mb-4 text-sm text-destructive">An error occurred while loading job details: {error}. You can still proceed with the application if the form is visible.</p>}
          {submitError && <p className="mb-4 text-sm text-destructive">{submitError}</p>}
          
          {/* Tabs for submission mode - The main form tag is now moved inside the first tab */}
          <Tabs defaultValue="resume" value={submissionMode} onValueChange={setSubmissionMode} className="w-full pt-2">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="resume">
                <UploadCloud className="mr-2 h-4 w-4" /> Upload File
              </TabsTrigger>
              <TabsTrigger value="form">
                <FileEdit className="mr-2 h-4 w-4" /> Fill Form
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resume">
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
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                        isReferralExpanded ? 'rotate-180' : ''
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

                {/* Submit Button for Resume Form */}
                <div>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !resume}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Processing Application...' : 'Submit Application'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="form">
              <ApplyFormWithId 
                jobId={id} 
                jobTitle={job?.title || ''} 
                jobRequirements={job?.requirements as string[] || []}
                referralName={referralName}
                referralEmail={referralEmail}
                referralPosition={referralPosition}
                referralDept={referralDept}
                onReferralChange={{
                  setReferralName,
                  setReferralEmail,
                  setReferralPosition,
                  setReferralDept
                }}
              />
            </TabsContent>
          </Tabs>
          
          {/* The main submit button previously here is now part of the resume form tab */}
          {/* Or handled by ManualApplyFormWithId internally */}
        </section>
      </div>
    </>
  );
};

export default JobApplicationPage;
