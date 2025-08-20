'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { JobVacancy } from '@/types/database';
import { NewJobForm } from '../../new/new-job-form';
import { LoaderCircle } from 'lucide-react';

export default function EditJobPage() {
  const params = useParams();
  const jobId = params?.id as string;
  
  const [job, setJob] = useState<JobVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobDetails() {
      if (!jobId) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch job details: ${response.statusText}`);
        }
        const data: JobVacancy = await response.json();
        setJob(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load job details:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setJob(null);
      } finally {
        setLoading(false);
      }
    }

    fetchJobDetails();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Job</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
        <p className="text-muted-foreground">The requested job could not be found.</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <NewJobForm jobToEdit={job} />
    </div>
  );
}