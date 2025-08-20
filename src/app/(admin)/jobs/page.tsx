// import { useEffect, useState } from 'react'; // No longer needed
// import { useRouter } from 'next/navigation'; // Will be moved to DataTableJobs if needed
import { JobVacancy } from '@/types/database'; // Assuming this is the correct type for a single job vacancy
import { DataTableJobs } from './data-jobs'; // Import the client component
import { getJobVacancies, getDashboardStats } from '@/app/actions'; // Import the server actions
import { ScoreCards } from '@/components/dashboard/score-cards'; // Import the score cards component

// Candidate interface might not be needed here anymore unless used elsewhere on the page
// interface Candidate { ... }

// Convert to async function to fetch data server-side
export default async function DashboardPage() {
  // const router = useRouter(); // Move router usage to client component if needed
  // const [jobVacanciesData, setJobVacanciesData] = useState<JobVacancy[]>([]); // Fetch directly
  // const [loadingJobs, setLoadingJobs] = useState(true); // No client loading state needed
  // const [errorJobs, setErrorJobs] = useState<string | null>(null); // Handle error during server fetch

  // const [candidates, setCandidates] = useState<Candidate[]>([]); // Remove if not used

  // Fetch data directly on the server
  let jobVacanciesData: JobVacancy[] = [];
  let errorJobs: string | null = null;
  let loadingJobs = false; // No client-side loading state
  let dashboardStats;
  
  try {
    // Fetch both job vacancies and dashboard statistics
    const [jobsData, statsData] = await Promise.all([
      getJobVacancies(),
      getDashboardStats()
    ]);
    jobVacanciesData = jobsData;
    dashboardStats = statsData;
  } catch (err: any) {
      console.error("Failed to load data on server:", err);
      errorJobs = err.message || 'Failed to load data.';
      // jobVacanciesData remains []
      // Use default stats if fetch fails
      dashboardStats = {
        totalApplicants: 0,
        candidatesByStatus: {
          Pending: 0,
          Reviewed: 0,
          Interviewing: 0,
          Shortlisted: 0,
          Offered: 0,
          Rejected: 0,
          Hired: 0,
          Withdrawn: 0,
          'On Hold': 0,
          Onboard: 0,
          'Auto-Assessed': 0,
        },
        jobWithMostApplicants: {
          count: 0,
          jobTitle: "No jobs found",
        },
        averageApplicantsPerJob: 0,
      };
  }

  // This function needs client-side context (useRouter)
  // Move the navigation logic into the DataTableJobs component itself
  // const handleJobRowClick = (job: JobVacancy) => {
  //   router.push(`/jobs/${job.id}`);
  // };

  // useEffect(() => { ... }, []); // Remove useEffect hook

  return (
    <div className="w-full">
      {/* Dashboard Score Cards */}
      <ScoreCards stats={dashboardStats} />
      
      {/* Job Vacancy Section - Pass data directly */}
      <div className="bg-card shadow rounded-lg p-6">
        {/* 
          Pass fetched data directly. 
          DataTableJobs needs to handle its internal state but not initial load/error.
          The row click logic will be moved inside DataTableJobs.
        */}
        <DataTableJobs 
            data={jobVacanciesData} 
            /* loading={loadingJobs} */ /* Removed */
            /* error={errorJobs} */ /* Removed - Handled above or inside table if needed */
            /* onRowClick={handleJobRowClick} */ /* Removed - Logic moved inside */
        />
        {/* Display server-side fetch error if needed */}
        {errorJobs && (
             <div className="text-destructive p-4 mt-4 border border-destructive bg-destructive/10 rounded">
                Error loading job vacancies: {errorJobs}
            </div>
        )}
      </div>

      {/* Candidates Table Section - Remove if unused */}
      {/* 
      {candidates.length > 0 && ( 
        <div className="bg-card shadow rounded-lg p-6"> 
          ... (candidates table code) ...
        </div>
      )} 
      */}
    </div>
  );
}