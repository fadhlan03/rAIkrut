'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { User } from '@/types/database';
import { DataTableUsers } from './data-users';

export default function ManageUsersPage() {
  const [usersData, setUsersData] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch users: ${response.statusText}`);
      }
      const data = await response.json();
      setUsersData(data);
      setErrorUsers(null);
    } catch (err) {
      console.error("Failed to load users:", err);
      setErrorUsers(err instanceof Error ? err.message : 'An unknown error occurred.');
      setUsersData([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserIdChange = (newUserId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newUserId) {
      params.set('userId', newUserId);
    } else {
      params.delete('userId');
    }
    router.push(`/manage-users?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="w-full">
      <div className="bg-card shadow rounded-lg p-6">
        <DataTableUsers 
          data={usersData} 
          loading={loadingUsers} 
          error={errorUsers} 
          selectedUserId={userId}
          onUserIdChange={handleUserIdChange}
          onUserUpdated={loadUsers}
        />
      </div>
    </div>
  );
} 