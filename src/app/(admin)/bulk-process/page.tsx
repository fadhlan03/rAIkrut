'use client';

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { JobVacancy } from '@/types/database';
import { getJobVacancies } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Upload, FileText, CheckCircle2, X, Eye, Sparkle, Pause, Play, RotateCcw, UserPlus, Save, FileEdit, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';

interface FileUpload {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  candidateName?: string;
  email?: string;
  scores?: {
    overall: number;
    requirements: { requirement: string; score: number; status: 'Yes' | 'No' | 'Unclear' }[];
  };
  error?: string;
  processingStartTime?: number;
  processingDuration?: number;
}

export default function BulkProcessPage() {
  const [jobs, setJobs] = useState<JobVacancy[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobVacancy | null>(null);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Selection state for the results table
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isCreatingApplications, setIsCreatingApplications] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<Map<string, 'saving' | 'extracting' | 'reviewing' | 'completed' | 'error'>>(new Map());

  // Filter states
  const [recommendationFilter, setRecommendationFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');

  // Use refs to access latest state in async loops
  const isPausedRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Helper function for API calls with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 30000): Promise<Response> => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: abortController.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - connection may be unstable');
      }
      throw error;
    }
  };

  // Load job vacancies on component mount
  React.useEffect(() => {
    const loadJobs = async () => {
      try {
        const jobData = await getJobVacancies();
        setJobs(jobData.filter(job => job.status === 'published')); // Only show published jobs
      } catch (error) {
        console.error('Failed to load jobs:', error);
        toast.error('Failed to load job vacancies');
      } finally {
        setLoadingJobs(false);
      }
    };
    loadJobs();
  }, []);

  // Update selected job when selection changes
  React.useEffect(() => {
    if (selectedJobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === selectedJobId);
      setSelectedJob(job || null);
    } else {
      setSelectedJob(null);
    }
  }, [selectedJobId, jobs]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const totalCurrentSize = files.reduce((sum, f) => sum + f.file.size, 0);
    const newFilesSize = acceptedFiles.reduce((sum, f) => sum + f.size, 0);
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (totalCurrentSize + newFilesSize > maxSize) {
      toast.error('Total file size exceeds 50MB limit');
      return;
    }

    const newFiles: FileUpload[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: true,
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const startProcessing = async () => {
    if (!selectedJob || files.length === 0) {
      toast.error('Please select a job and upload files');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    isProcessingRef.current = true;
    isPausedRef.current = false;

    try {
      const pendingFiles = files.filter(f => f.status === 'pending');

      for (let i = 0; i < pendingFiles.length; i++) {
        const fileUpload = pendingFiles[i];

        // Check if processing is paused before starting next file
        while (isPausedRef.current && isProcessingRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // If processing was stopped entirely, break out of loop
        if (!isProcessingRef.current) {
          break;
        }

        // Upload file and process with Gemini
        try {
          await processFile(fileUpload, selectedJob);
        } catch (error) {
          // Log error but continue processing other files
          console.error(`Failed to process ${fileUpload.file.name}:`, error);

          // Show specific toast for timeout errors
          if (error instanceof Error && error.name === 'AbortError') {
            toast.error(`Timeout processing ${fileUpload.file.name}. Check your connection and retry if needed.`);
          }
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Processing failed');
    } finally {
      setIsProcessing(false);
      setIsPaused(false);
      isProcessingRef.current = false;
      isPausedRef.current = false;
    }
  };

  const pauseProcessing = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    toast.info('Processing paused. Current file will complete, then processing will pause.');
  };

  const resumeProcessing = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    toast.info('Processing resumed.');
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    setIsPaused(false);
    isProcessingRef.current = false;
    isPausedRef.current = false;
    toast.info('Processing stopped.');
  };

  const retryFile = async (fileId: string) => {
    if (!selectedJob) {
      toast.error('Please select a job first');
      return;
    }

    const fileToRetry = files.find(f => f.id === fileId);
    if (!fileToRetry) {
      toast.error('File not found');
      return;
    }

    // Reset file status and clear error
    setFiles(prev => prev.map(f =>
      f.id === fileId ? {
        ...f,
        status: 'pending' as const,
        progress: 0,
        error: undefined,
        candidateName: undefined,
        email: undefined,
        scores: undefined,
        processingDuration: undefined
      } : f
    ));

    toast.info(`Retrying ${fileToRetry.file.name}...`);

    // Process the file
    try {
      await processFile(fileToRetry, selectedJob);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const processFile = async (fileUpload: FileUpload, job: JobVacancy) => {
    let progressInterval: NodeJS.Timeout | null = null;
    let abortController: AbortController | null = null;

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', fileUpload.file);
      formData.append('jobId', job.id);

      // Start with uploading status and smooth progress animation
      setFiles(prev => prev.map(f =>
        f.id === fileUpload.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      // Create smooth progress animation from 0% to 85% over ~3 seconds
      let currentProgress = 0;
      progressInterval = setInterval(() => {
        currentProgress += Math.random() * 8 + 2; // Increment by 2-10% each time
        if (currentProgress > 85) {
          currentProgress = 85; // Cap at 85% until API responds
        }

        setFiles(prev => prev.map(f =>
          f.id === fileUpload.id ? { ...f, progress: Math.min(currentProgress, 85) } : f
        ));
      }, 200); // Update every 200ms for smooth animation

      // Create abort controller for timeout handling
      abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController?.abort();
      }, 60000); // 60 second timeout

      // Make the API call with timeout
      const processingStartTime = Date.now();
      const response = await fetch('/api/bulk-process', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      // Clear timeout since request completed
      clearTimeout(timeoutId);

      // Clear the progress animation and update to processing
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      // Update to processing status with higher progress
      setFiles(prev => prev.map(f =>
        f.id === fileUpload.id ? {
          ...f,
          status: 'processing',
          progress: 90,
          processingStartTime
        } : f
      ));

      const result = await response.json();
      const processingEndTime = Date.now();
      const processingDuration = (processingEndTime - processingStartTime) / 1000;

      // Complete with final results
      setFiles(prev => prev.map(f =>
        f.id === fileUpload.id ? {
          ...f,
          status: 'completed',
          progress: 100,
          candidateName: result.candidateName,
          email: result.email,
          scores: result.scores,
          processingDuration,
        } : f
      ));

    } catch (error) {
      // Clean up progress interval and abort controller on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Determine error message based on error type
      let errorMessage = 'Processing failed';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout - connection may be unstable';
        } else {
          errorMessage = error.message;
        }
      }

      setFiles(prev => prev.map(f =>
        f.id === fileUpload.id ? {
          ...f,
          status: 'error',
          error: errorMessage,
          progress: 0,
        } : f
      ));
    }
  };

  // Handle selection changes
  const handleSelectFile = (fileId: string, checked: boolean) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(fileId);
      } else {
        newSet.delete(fileId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.scores);
    if (checked) {
      setSelectedFileIds(new Set(completedFiles.map(f => f.id)));
    } else {
      setSelectedFileIds(new Set());
    }
  };

  // Process selected candidates as applications
  const processSelectedAsApplications = async () => {
    if (!selectedJob || selectedFileIds.size === 0) {
      toast.error('Please select candidates to process');
      return;
    }

    const selectedFiles = files.filter(f => selectedFileIds.has(f.id) && f.status === 'completed' && f.scores);

    if (selectedFiles.length === 0) {
      toast.error('No valid completed candidates selected');
      return;
    }

    setIsCreatingApplications(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const fileUpload of selectedFiles) {
        try {
          // Step 1: Upload resume and create candidate
          setApplicationStatus(prev => new Map(prev.set(fileUpload.id, 'saving')));

          const uploadFormData = new FormData();
          uploadFormData.append('resume', fileUpload.file);
          uploadFormData.append('fullName', fileUpload.candidateName || 'Unknown');
          uploadFormData.append('email', fileUpload.email || 'unknown@example.com');

          const uploadResponse = await fetchWithTimeout('/api/resumes/upload', {
            method: 'POST',
            body: uploadFormData,
          }, 45000); // 45 second timeout for file uploads

          if (!uploadResponse.ok) {
            throw new Error(`Resume upload failed for ${fileUpload.candidateName}`);
          }

          const uploadResult = await uploadResponse.json();
          const { gcsPath, fileName: uploadedFileName, candidateId, resumeId } = uploadResult;

          if (!candidateId || !resumeId) {
            throw new Error(`Failed to get candidate or resume ID for ${fileUpload.candidateName}`);
          }

          // Step 2: Extract resume data
          setApplicationStatus(prev => new Map(prev.set(fileUpload.id, 'extracting')));

          try {
            const extractResponse = await fetchWithTimeout('/api/resumes/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gcsPath,
                fileName: uploadedFileName,
                mimeType: fileUpload.file.type,
                candidateId
              }),
            });

            if (!extractResponse.ok) {
              console.warn(`Resume extraction failed for ${fileUpload.candidateName}, continuing...`);
            }
          } catch (extractError) {
            console.warn(`Error during resume extraction for ${fileUpload.candidateName}:`, extractError);
          }

          // Step 3: Get assessment (we already have it from bulk processing, but need proper format)
          setApplicationStatus(prev => new Map(prev.set(fileUpload.id, 'reviewing')));

          const reviewPayload = {
            gcsPath,
            fileName: uploadedFileName,
            mimeType: fileUpload.file.type,
            jobId: selectedJob.id,
            jobTitle: selectedJob.title,
            jobDescription: selectedJob.description,
            jobRequirements: selectedJob.requirements as string[]
          };

          const assessmentResponse = await fetchWithTimeout('/api/applications/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewPayload),
          }, 60000); // 60 second timeout for AI processing

          if (!assessmentResponse.ok) {
            throw new Error(`Assessment failed for ${fileUpload.candidateName}`);
          }

          const assessmentResult = await assessmentResponse.json();

          // Step 4: Save application
          const applicationPayload = {
            jobId: selectedJob.id,
            candidateId,
            resumeId,
            applicantFullName: fileUpload.candidateName || 'Unknown',
            applicantEmail: fileUpload.email || 'unknown@example.com',
            applicantPhone: '', // We don't have phone from bulk processing
            referralName: '',
            referralEmail: '',
            assessmentResult
          };

          const saveApplicationResponse = await fetchWithTimeout('/api/applications/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(applicationPayload),
          });

          if (!saveApplicationResponse.ok) {
            throw new Error(`Failed to save application for ${fileUpload.candidateName}`);
          }

          setApplicationStatus(prev => new Map(prev.set(fileUpload.id, 'completed')));
          successCount++;

        } catch (error) {
          console.error(`Failed to process ${fileUpload.candidateName}:`, error);
          setApplicationStatus(prev => new Map(prev.set(fileUpload.id, 'error')));
          errorCount++;
        }
      }

      // Show result toast
      if (successCount > 0 && errorCount === 0) {
        toast.success(`Successfully created ${successCount} applications`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.success(`Created ${successCount} applications, ${errorCount} failed`);
      } else {
        toast.error(`Failed to create applications (${errorCount} errors)`);
      }

      // Clear selection after processing
      setSelectedFileIds(new Set());

    } catch (error) {
      console.error('Error in batch application creation:', error);
      toast.error('Failed to process selected candidates');
    } finally {
      setIsCreatingApplications(false);
    }
  };

  // Timer hook for processing files
  const ProcessingTimer = ({ file }: { file: FileUpload }) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
      if (file.status !== 'processing' || !file.processingStartTime) {
        return;
      }

      const interval = setInterval(() => {
        const elapsed = (Date.now() - file.processingStartTime!) / 1000;
        setElapsedTime(elapsed);
      }, 100); // Update every 100ms for smooth timer

      return () => clearInterval(interval);
    }, [file.status, file.processingStartTime]);

    if (file.status !== 'processing') {
      return null;
    }

    return (
      <span className="text-xs text-muted-foreground">
        {elapsedTime.toFixed(1)}s
      </span>
    );
  };

  const getTotalSize = () => {
    return files.reduce((sum, f) => sum + f.file.size, 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: FileUpload['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
      case 'uploading':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Memoize button props to avoid multiple function calls
  const processingButtonProps = useMemo(() => {
    const hasPendingFiles = files.some(f => f.status === 'pending');

    if (isPaused) {
      return {
        text: 'Continue Processing',
        icon: <Play className="h-4 w-4" />,
        action: resumeProcessing,
        disabled: false,
        variant: 'default' as const
      };
    }

    if (isProcessing) {
      return {
        text: 'Pause Processing',
        icon: <Pause className="h-4 w-4" />,
        action: pauseProcessing,
        disabled: false,
        variant: 'secondary' as const
      };
    }

    // Not processing and not paused
    return {
      text: 'Start Processing',
      icon: <Sparkle className="h-4 w-4" />,
      action: startProcessing,
      disabled: !selectedJob || !hasPendingFiles,
      variant: 'default' as const
    };
  }, [isProcessing, isPaused, selectedJob, files, startProcessing, pauseProcessing, resumeProcessing]);

  // Get completed files for selection
  const completedFiles = files.filter(f => f.status === 'completed' && f.scores);
  const selectedFilesCount = selectedFileIds.size;
  const allSelected = completedFiles.length > 0 && selectedFilesCount === completedFiles.length;
  const someSelected = selectedFilesCount > 0 && selectedFilesCount < completedFiles.length;

  // Calculate overall progress for all files
  const overallProgress = useMemo(() => {
    if (files.length === 0) return 0;

    const totalProgress = files.reduce((sum, file) => sum + file.progress, 0);
    return Math.round(totalProgress / files.length);
  }, [files]);

  // Calculate application creation progress
  const applicationCreationProgress = useMemo(() => {
    if (selectedFileIds.size === 0 || !isCreatingApplications) return 0;

    const selectedFiles = Array.from(selectedFileIds);
    const completedCount = selectedFiles.filter(id =>
      applicationStatus.get(id) === 'completed' || applicationStatus.get(id) === 'error'
    ).length;

    return Math.round((completedCount / selectedFileIds.size) * 100);
  }, [selectedFileIds, applicationStatus, isCreatingApplications]);

  // Filter files based on selected filters
  const filteredFiles = useMemo(() => {
    return files
      .filter(f => f.status === 'completed' && f.scores)
      .filter(f => {
        // Filter by recommendation
        if (recommendationFilter !== 'all') {
          const score = f.scores!.overall;
          const recommendation =
            score >= 4 ? 'recommend' :
              score >= 3 ? 'consider' : 'not-suitable';
          if (recommendation !== recommendationFilter) return false;
        }

        // Filter by score
        if (scoreFilter !== 'all') {
          const score = f.scores!.overall;
          const minScore = parseInt(scoreFilter.charAt(0));
          if (score < minScore) return false;
        }

        return true;
      });
  }, [files, recommendationFilter, scoreFilter]);

  if (loadingJobs) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Determine container width based on whether job is selected
  const containerClass = selectedJob
    ? "max-w-7xl mx-auto px-4 py-8 space-y-6"
    : "max-w-4xl mx-auto px-4 py-8 space-y-6";

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Bulk Resume Processing</h1>
        <p className="text-muted-foreground">
          Upload multiple resumes and evaluate them against job requirements
        </p>
      </div>

      {/* Job Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Job Position</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a job position to evaluate against" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedJob && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">{selectedJob.title}</h3>
              <p className="text-sm text-muted-foreground mb-6">{selectedJob.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <h4 className="font-medium mb-2">Job Description</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {Array.isArray(selectedJob.job_desc) ?
                      selectedJob.job_desc.slice(0, 3).map((desc, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2 mt-0.5 flex-shrink-0">•</span>
                          <span>{desc}</span>
                        </li>
                      )) :
                      <li className="flex items-start">
                        <span className="mr-2 mt-0.5 flex-shrink-0">•</span>
                        <span>{selectedJob.job_desc}</span>
                      </li>
                    }
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Requirements</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {Array.isArray(selectedJob.requirements) ?
                      selectedJob.requirements.slice(0, 3).map((req, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2 mt-0.5 flex-shrink-0">•</span>
                          <span>{req}</span>
                        </li>
                      )) :
                      <li className="flex items-start">
                        <span className="mr-2 mt-0.5 flex-shrink-0">•</span>
                        <span>{selectedJob.requirements}</span>
                      </li>
                    }
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overall Progress Bar */}
      {files.length > 0 && (
        <div className="w-full p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Overall Processing Progress</span>
            <span className="text-sm">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Total Files: {files.length}</span>
            <span>Completed: {files.filter(f => f.status === 'completed').length}</span>
            <span>In Progress: {files.filter(f => f.status === 'uploading' || f.status === 'processing').length}</span>
            <span>Pending: {files.filter(f => f.status === 'pending').length}</span>
            <span>Error: {files.filter(f => f.status === 'error').length}</span>
          </div>
        </div>
      )}

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Upload Resumes
            <Badge variant="outline">
              {formatFileSize(getTotalSize())} / 50MB
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">

                <div className="flex items-center gap-4">
                  <h3 className="font-medium">Uploaded Files ({files.length})</h3>
                  {isPaused && (
                    <Badge variant="outline" className="gap-1">
                      <Pause className="h-3 w-3" />
                      Paused
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(isProcessing || isPaused) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={stopProcessing}
                    >
                      <X className="h-4 w-4" />
                      Stop
                    </Button>
                  )}
                  <Button
                    onClick={processingButtonProps.action}
                    disabled={processingButtonProps.disabled}
                    variant={processingButtonProps.variant}
                    className="gap-2"
                  >
                    {processingButtonProps.icon}
                    {processingButtonProps.text}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {files.map(fileUpload => (
                  <div key={fileUpload.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {getStatusIcon(fileUpload.status)}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileUpload.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileUpload.file.size)}
                        {fileUpload.candidateName && ` • ${fileUpload.candidateName}`}
                      </p>
                    </div>

                    {fileUpload.status === 'uploading' && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-24">
                          <Progress value={fileUpload.progress} className="h-2" />
                        </div>
                        <span className="text-xs text-muted-foreground">uploading</span>
                      </div>
                    )}

                    {fileUpload.status === 'processing' && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-24">
                          <Progress value={fileUpload.progress} className="h-2" />
                        </div>
                        <ProcessingTimer file={fileUpload} />
                      </div>
                    )}

                    {fileUpload.status === 'completed' && fileUpload.scores && (
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline">
                          Score: {fileUpload.scores.overall.toFixed(1)} / 5.0
                        </Badge>
                        {fileUpload.processingDuration && (
                          <span className="text-xs text-muted-foreground">
                            {fileUpload.processingDuration.toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )}

                    {fileUpload.status === 'error' && (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="destructive"
                          className="whitespace-nowrap"
                          title={fileUpload.error || 'Processing failed'}
                        >
                          Error
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryFile(fileUpload.id)}
                          title={`Retry processing ${fileUpload.file.name}`}
                          className="h-8 w-8 p-0 hover:bg-muted"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {fileUpload.status === 'pending' && !isProcessing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileUpload.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? 'Drop files here' : 'Upload resume files'}
            </p>
            <p className="text-sm text-muted-foreground">
              Drag & drop PDF, JPG, PNG, or WebP files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Maximum total size: 50MB
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Results Matrix */}
      {files.some(f => f.status === 'completed' && f.scores) && selectedJob && (
        <>
          {/* Application Creation Progress Bar */}
          {isCreatingApplications && selectedFileIds.size > 0 && (
            <div className="w-full p-4 bg-muted rounded-lg mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Creating Applications Progress</span>
                <span className="text-sm">{applicationCreationProgress}%</span>
              </div>
              <Progress value={applicationCreationProgress} className="h-2" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Total Selected: {selectedFileIds.size}</span>
                <span>Completed: {Array.from(selectedFileIds).filter(id => applicationStatus.get(id) === 'completed').length}</span>
                <span>In Progress: {Array.from(selectedFileIds).filter(id =>
                  applicationStatus.get(id) === 'saving' ||
                  applicationStatus.get(id) === 'extracting' ||
                  applicationStatus.get(id) === 'reviewing'
                ).length}</span>
                <span>Error: {Array.from(selectedFileIds).filter(id => applicationStatus.get(id) === 'error').length}</span>
              </div>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Evaluation Results
                  {(recommendationFilter !== 'all' || scoreFilter !== 'all') && (
                    <Badge variant="outline" className="ml-2">
                      Filtered
                    </Badge>
                  )}
                </div>
                {selectedFilesCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedFilesCount} selected
                    </span>
                    <Button
                      onClick={processSelectedAsApplications}
                      disabled={isCreatingApplications || selectedFilesCount === 0}
                      className="gap-2"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      {isCreatingApplications ? 'Saving Applications...' : 'Save Applications'}
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <Select value={recommendationFilter} onValueChange={setRecommendationFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Recommendations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Recommendations</SelectItem>
                      <SelectItem value="recommend">Recommend</SelectItem>
                      <SelectItem value="consider">Consider</SelectItem>
                      <SelectItem value="not-suitable">Not Suitable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={scoreFilter} onValueChange={setScoreFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Scores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scores</SelectItem>
                      <SelectItem value="4+">4+ (Excellent)</SelectItem>
                      <SelectItem value="3+">3+ (Good)</SelectItem>
                      <SelectItem value="2+">2+ (Average)</SelectItem>
                      <SelectItem value="1+">1+ (Poor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all candidates"
                        />
                      </TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Overall Score</TableHead>
                      {Array.isArray(selectedJob.requirements) &&
                        selectedJob.requirements.map((req, i) => (
                          <TableHead key={i} className="min-w-[120px]">
                            {req.length > 20 ? `${req.substring(0, 20)}...` : req}
                          </TableHead>
                        ))
                      }
                      <TableHead>Recommendation</TableHead>
                      <TableHead>Application Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map(fileUpload => (
                      <TableRow key={fileUpload.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedFileIds.has(fileUpload.id)}
                            onCheckedChange={(checked) => handleSelectFile(fileUpload.id, checked as boolean)}
                            aria-label={`Select ${fileUpload.candidateName || 'candidate'}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{fileUpload.candidateName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{fileUpload.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={fileUpload.scores!.overall >= 3.5 ? 'info' : 'destructive'}>
                            {fileUpload.scores!.overall.toFixed(1)}/5.0
                          </Badge>
                        </TableCell>
                        {Array.isArray(selectedJob.requirements) &&
                          selectedJob.requirements.map((jobReq, i) => {
                            // Find the corresponding evaluation for this job requirement
                            const reqEvaluation = fileUpload.scores!.requirements.find(
                              req => req.requirement === jobReq
                            ) || fileUpload.scores!.requirements[i]; // Fallback to index matching

                            const status = reqEvaluation?.status || 'Unclear';

                            return (
                              <TableCell key={i}>
                                <Badge
                                  variant={
                                    status === 'Yes' ? 'info' :
                                      status === 'No' ? 'destructive' : 'secondary'
                                  }
                                >
                                  {status}
                                </Badge>
                              </TableCell>
                            );
                          })
                        }
                        <TableCell>
                          <Badge
                            variant={fileUpload.scores!.overall >= 4 ? 'info' :
                              fileUpload.scores!.overall >= 3 ? 'secondary' : 'destructive'}
                          >
                            {fileUpload.scores!.overall >= 4 ? 'Recommend' :
                              fileUpload.scores!.overall >= 3 ? 'Consider' : 'Not Suitable'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const status = applicationStatus.get(fileUpload.id);
                            if (!status) return '-';

                            const statusConfig = {
                              saving: { text: 'Saving', variant: 'secondary' as const, icon: Save },
                              extracting: { text: 'Extracting', variant: 'secondary' as const, icon: FileEdit },
                              reviewing: { text: 'Reviewing', variant: 'secondary' as const, icon: Search },
                              completed: { text: 'Completed', variant: 'default' as const, icon: CheckCircle2 },
                              error: { text: 'Error', variant: 'destructive' as const, icon: AlertCircle }
                            };

                            const config = statusConfig[status];
                            const IconComponent = config.icon;
                            return (
                              <Badge variant={config.variant} className="gap-1">
                                <IconComponent className="h-3 w-3" />
                                {config.text}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}