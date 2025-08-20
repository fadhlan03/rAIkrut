'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { JobVacancy } from '@/types/database'; // Assuming this is the correct type for a single job vacancy
import { DataTableJobs } from './data-apply'; // Import the client component
import { getPublishedJobVacancies, getUserApplicationsByEmail } from '@/app/actions'; // Import the server action for published jobs
import { useAuth } from '@/contexts/AuthContext'; // Import auth context to get user info
import { getCookie } from 'cookies-next'; // Import to get user email from token



export default function DashboardPage() {
  const [jobVacanciesData, setJobVacanciesData] = useState<JobVacancy[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [errorJobs, setErrorJobs] = useState<string | null>(null);
  const [userApplications, setUserApplications] = useState<string[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');

  const { isAuthenticated } = useAuth();

  // Helper function to decode JWT token and extract user email
  const getUserEmailFromToken = (): string | null => {
    try {
      const tokenValue = getCookie('access_token');
      const token = typeof tokenValue === 'string' ? tokenValue : null;
      
      if (!token) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  useEffect(() => {
    async function loadJobs() {
      setLoadingJobs(true);
      try {
        const data = await getPublishedJobVacancies();
        setJobVacanciesData(data);
        setErrorJobs(null);
      } catch (err) {
        console.error("Failed to load published job vacancies in page:", err);
        setErrorJobs('Failed to load published job vacancies.');
        setJobVacanciesData([]); // Clear data on error
      } finally {
        setLoadingJobs(false);
      }
    }
    loadJobs();
  }, []);

  useEffect(() => {
    async function loadUserApplications() {
      if (!isAuthenticated) {
        setUserApplications([]);
        setLoadingApplications(false);
        return;
      }

      setLoadingApplications(true);
      try {
        const userEmail = getUserEmailFromToken();
        if (userEmail) {
          const applications = await getUserApplicationsByEmail(userEmail);
          setUserApplications(applications);
        } else {
          setUserApplications([]);
        }
      } catch (err) {
        console.error("Failed to load user applications:", err);
        setUserApplications([]);
      } finally {
        setLoadingApplications(false);
      }
    }
    loadUserApplications();
  }, [isAuthenticated]);

  const handleJobIdChange = (newJobId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newJobId) {
      params.set('jobId', newJobId);
    } else {
      params.delete('jobId');
    }
    router.push(`/apply?${params.toString()}`, { scroll: false });
  };

  return (
    <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-4 w-full">
      {/* Job Vacancy Section - Now uses DataTableJobs */}
      <div className="bg-card shadow rounded-lg p-6 mb-6">
        <DataTableJobs 
          data={jobVacanciesData} 
          loading={loadingJobs} 
          error={errorJobs}
          userApplications={userApplications}
          selectedJobId={jobId}
          onJobIdChange={handleJobIdChange}
        />
      </div>


    </main>
  );
} 