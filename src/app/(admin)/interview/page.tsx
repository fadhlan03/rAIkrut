'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DataTableInterview, InterviewData } from './data-interview';

export default function InterviewPage() {
  const [interviewData, setInterviewData] = useState<InterviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const callId = searchParams.get('callId');
  const [refreshKey, setRefreshKey] = useState(0); // New state for triggering refresh

  const handleRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  }; // Function to trigger data refresh

  useEffect(() => {
    async function loadInterviewData() {
      setLoading(true);
      try {
        const response = await fetch('/api/interview');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch interview data: ${response.statusText}`);
        }
        const data = await response.json();
        setInterviewData(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load interview data:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setInterviewData([]);
      } finally {
        setLoading(false);
      }
    }
    loadInterviewData();
  }, [refreshKey]); // Add refreshKey to dependencies

  const handleCallIdChange = (newCallId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newCallId) {
      params.set('callId', newCallId);
    } else {
      params.delete('callId');
    }
    router.push(`/interview?${params.toString()}`, { scroll: false });
  };

  return (
    <main className="w-full">
      <div className="bg-card shadow rounded-lg p-6">
        <DataTableInterview 
          data={interviewData} 
          loading={loading} 
          error={error}
          selectedCallId={callId}
          onCallIdChange={handleCallIdChange}
          onRefresh={handleRefresh} // Pass the refresh function
        />
      </div>
    </main>
  );
}
