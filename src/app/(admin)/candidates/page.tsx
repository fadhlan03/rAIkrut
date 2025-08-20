'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Candidate } from '@/types/database'; // Assuming this is the correct type for a single candidate
import { DataTableCandidates } from './data-candidates'; // Import the client component
// We will use the API route for now, an action could be created later for consistency

export default function CandidatesPage() {
  const [candidatesData, setCandidatesData] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [errorCandidates, setErrorCandidates] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const candidateId = searchParams.get('candidateId');

  useEffect(() => {
    async function loadCandidates() {
      setLoadingCandidates(true);
      try {
        const response = await fetch('/api/candidates');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch candidates: ${response.statusText}`);
        }
        const data = await response.json();
        setCandidatesData(data);
        setErrorCandidates(null);
      } catch (err) {
        console.error("Failed to load candidates in page:", err);
        setErrorCandidates(err instanceof Error ? err.message : 'An unknown error occurred.');
        setCandidatesData([]); // Clear data on error
      } finally {
        setLoadingCandidates(false);
      }
    }
    loadCandidates();
  }, []);

  const handleCandidateIdChange = (newCandidateId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newCandidateId) {
      params.set('candidateId', newCandidateId);
    } else {
      params.delete('candidateId');
    }
    router.push(`/candidates?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="w-full">
      {/* Candidates Table Section */}
      <div className="bg-card shadow rounded-lg p-6">
        <DataTableCandidates 
          data={candidatesData} 
          loading={loadingCandidates} 
          error={errorCandidates}
          selectedCandidateId={candidateId}
          onCandidateIdChange={handleCandidateIdChange}
        />
      </div>
    </div>
  );
}