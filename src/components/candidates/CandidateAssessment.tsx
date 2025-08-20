"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { getPublishedJobVacancies } from '@/app/actions';
import { JobVacancy, Candidate, CandidateApplication } from '@/types/database';

interface AssessmentProgress {
  [jobId: string]: {
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    score?: number;
    error?: string;
    assessmentResult?: any;
    autoSaved?: boolean;
  };
}

interface CandidateAssessmentProps {
  candidate: Candidate;
  applications: CandidateApplication[];
  onApplicationsRefresh?: () => void;
  className?: string;
}

export function CandidateAssessment({ 
  candidate, 
  applications, 
  onApplicationsRefresh,
  className = ""
}: CandidateAssessmentProps) {
  // Assessment tab states
  const [availableJobs, setAvailableJobs] = React.useState<JobVacancy[]>([]);
  const [selectedJobs, setSelectedJobs] = React.useState<JobVacancy[]>([]);
  const [jobSearchQuery, setJobSearchQuery] = React.useState('');
  const [jobsLoading, setJobsLoading] = React.useState(false);
  const [isAssessing, setIsAssessing] = React.useState(false);
  const [assessmentProgress, setAssessmentProgress] = React.useState<AssessmentProgress>({});

  // Fetch available published jobs for assessment
  const fetchAvailableJobs = React.useCallback(async () => {
    setJobsLoading(true);
    try {
      const jobs = await getPublishedJobVacancies();
      // Filter out jobs that the candidate has already applied to
      const candidateApplicationJobIds = applications.map(app => app.job_id);
      const availableJobsFiltered = jobs.filter(job => !candidateApplicationJobIds.includes(job.id));
      setAvailableJobs(availableJobsFiltered);
    } catch (error) {
      console.error('Error fetching available jobs:', error);
      toast.error('Failed to fetch available jobs');
    } finally {
      setJobsLoading(false);
    }
  }, [applications]);

  // Add job to selected list
  const addJobToSelection = (job: JobVacancy) => {
    if (!selectedJobs.some(selected => selected.id === job.id)) {
      setSelectedJobs([...selectedJobs, job]);
      setJobSearchQuery(''); // Clear search after selection
    }
  };

  // Remove job from selected list
  const removeJobFromSelection = (jobId: string) => {
    setSelectedJobs(selectedJobs.filter(job => job.id !== jobId));
    // Reset progress for this job
    setAssessmentProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[jobId];
      return newProgress;
    });
  };

  // Handle assessment for selected jobs
  const handleAssessment = async () => {
    if (selectedJobs.length === 0 || !candidate) {
      toast.error('Please select at least one job');
      return;
    }

    // Filter out jobs that are already completed or errored
    const jobsToProcess = selectedJobs.filter(job => {
      const progress = assessmentProgress[job.id];
      return !progress || (progress.status !== 'completed' && progress.status !== 'error');
    });

    if (jobsToProcess.length === 0) {
      toast.error('All selected jobs have already been processed');
      return;
    }

    setIsAssessing(true);

    // Initialize progress only for jobs that need processing
    const initialProgress: AssessmentProgress = { ...assessmentProgress };
    jobsToProcess.forEach(job => {
      initialProgress[job.id] = { status: 'pending' as const, progress: 0 };
    });
    setAssessmentProgress(initialProgress);

    try {
      // Process each job individually using candidate's structured data
      for (const job of jobsToProcess) {
        try {
          // Update progress to processing
          setAssessmentProgress(prev => ({
            ...prev,
            [job.id]: { status: 'processing' as const, progress: 25 }
          }));

          // Prepare candidate data for assessment (same format as apply-form.tsx)
          const candidateData = {
            fullName: candidate.full_name,
            email: candidate.email,
            birthdate: candidate.birthdate,
            phone: candidate.phone,
            jobInterest: candidate.job_interest || [],
            education: candidate.education || [],
            workExperience: candidate.work_experience || [],
            orgExperience: candidate.org_experience || [],
            summary: candidate.summary
          };

          // Call assessment API using structured candidate data instead of resume file
          const reviewPayload = {
            candidateData: candidateData,
            jobId: job.id,
            jobTitle: job.title,
            jobDescription: Array.isArray(job.job_desc) ? job.job_desc.join('\n') : job.job_desc || job.description,
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

          // Calculate overall score
          const calculateOverallScore = (result: any) => {
            const sections = ['experience', 'education', 'skills', 'roleFit', 'certifications', 'projectImpact', 'softSkills'];
            const scores = sections.map(section => result[section]?.score || 0).filter(score => score > 0);
            return scores.length > 0 ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 20) : 0;
          };

          const overallScore = calculateOverallScore(assessmentResult);

          // Automatically submit the application with Auto-Assessed status
          const applicationPayload = {
            candidateId: candidate.id,
            jobId: job.id,
            applicantFullName: candidate.full_name,
            applicantEmail: candidate.email,
            applicantPhone: candidate.phone,
            assessmentResult: assessmentResult,
            status: 'Auto-Assessed' // New enum status for system assessments
          };

          const submitResponse = await fetch('/api/applications/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(applicationPayload),
          });

          if (!submitResponse.ok) {
            throw new Error('Failed to save assessment results');
          }

          setAssessmentProgress(prev => ({
            ...prev,
            [job.id]: {
              status: 'completed' as const,
              progress: 100,
              score: overallScore,
              assessmentResult: assessmentResult,
              autoSaved: true // Flag to indicate automatic saving
            }
          }));

          // Refresh applications list to show the new auto-assessed application
          if (onApplicationsRefresh) {
            onApplicationsRefresh();
          }

        } catch (error: any) {
          setAssessmentProgress(prev => ({
            ...prev,
            [job.id]: {
              status: 'error' as const,
              progress: 0,
              error: error.message
            }
          }));
        }
      }

      toast.success('Assessment completed and applications saved for all selected jobs');

      // Clear selected jobs after successful assessment and auto-submission
      setSelectedJobs([]);

    } catch (error: any) {
      toast.error(`Assessment failed: ${error.message}`);
      // Reset all progress on general error
      setAssessmentProgress({});
    } finally {
      setIsAssessing(false);
    }
  };

  // Submit application for a specific job
  const submitApplication = async (job: JobVacancy, assessmentResult: any) => {
    if (!candidate) return;

    try {
      const applicationPayload = {
        jobId: job.id,
        candidateId: candidate.id,
        applicantFullName: candidate.full_name,
        applicantEmail: candidate.email,
        applicantPhone: candidate.phone,
        referralName: '',
        referralEmail: '',
        referralPosition: '',
        referralDept: '',
        assessmentResult
      };

      const saveApplicationResponse = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationPayload),
      });

      if (!saveApplicationResponse.ok) {
        throw new Error('Failed to submit application');
      }

      // Remove job from selected list after successful submission
      removeJobFromSelection(job.id);

      // Refresh applications list
      if (onApplicationsRefresh) {
        onApplicationsRefresh();
      }

      toast.success(`Application submitted successfully for ${job.title}!`);

    } catch (error: any) {
      toast.error(`Failed to submit application for ${job.title}: ${error.message}`);
    }
  };

  // Load available jobs when applications change
  React.useEffect(() => {
    if (applications.length >= 0) {
      fetchAvailableJobs();
    }
  }, [applications, fetchAvailableJobs]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Auto-Assessed Jobs */}
      {applications.filter(app => app.status === 'Auto-Assessed').length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-foreground mb-2">Auto-Assessed Jobs</h4>
          <div className="space-y-3">
            {applications
              .filter(app => app.status === 'Auto-Assessed')
              .map((app) => (
                <div key={app.application_id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-sm">{app.job_title}</h5>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.overall_score && (
                        <Badge variant="secondary">
                          {Math.round(app.overall_score * 20)}% Match
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Selected Jobs */}
      {selectedJobs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Selected Jobs for Assessment</h4>
          <div className="space-y-3">
            {selectedJobs.map((job) => {
              const progress = assessmentProgress[job.id];
              return (
                <div key={job.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-sm">{job.title}</h5>
                      <p className="text-xs text-muted-foreground truncate">
                        {job.description.length > 100 ? job.description.substring(0, 100) + '...' : job.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeJobFromSelection(job.id)}
                      className="ml-2 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  {progress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {progress.status === 'completed' ? 'Assessment Complete' :
                            progress.status === 'error' ? 'Assessment Failed' :
                              progress.status === 'processing' ? 'Assessing...' : 'Pending'}
                        </span>
                        {progress.status === 'completed' && progress.score !== undefined && (
                          <span className="font-medium">
                            Score: {Math.round(progress.score)}%
                          </span>
                        )}
                      </div>

                      {progress.status === 'processing' && (
                        <Progress value={50} className="h-2" />
                      )}

                      {progress.status === 'completed' && progress.score !== undefined && (
                        <Progress value={progress.score} className="h-2" />
                      )}

                      {progress.status === 'error' && progress.error && (
                        <p className="text-xs text-destructive">{progress.error}</p>
                      )}

                      {progress.status === 'completed' && (
                        <div className="flex justify-end mt-2">
                          {progress.autoSaved ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Auto-saved as application
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => submitApplication(job, progress.assessmentResult)}
                              disabled={isAssessing}
                            >
                              Submit Application
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-center mt-4">
            <Button
              onClick={handleAssessment}
              disabled={isAssessing || selectedJobs.length === 0}
              className="w-full max-w-md"
            >
              {isAssessing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Assessing Suitability...
                </>
              ) : (
                'Start Assessment'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Available Jobs */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Available Jobs</h4>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
          <Input
            placeholder="Search jobs by title, description, or requirements..."
            value={jobSearchQuery}
            onChange={(e) => setJobSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {jobsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading jobs...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableJobs
              .filter(job =>
                job.title.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
                job.description?.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
                (typeof job.requirements === 'string' && job.requirements.toLowerCase().includes(jobSearchQuery.toLowerCase()))
              )
              .filter(job => !selectedJobs.some(selected => selected.id === job.id))
              .map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h5 className="font-medium text-sm">{job.title}</h5>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.description.length > 100 ? job.description.substring(0, 100) + '...' : job.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addJobToSelection(job)}
                    className="ml-2"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              ))
            }
            {availableJobs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available jobs found.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
