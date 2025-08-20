import { toast } from 'sonner';

// Simple type for the function signature
type FetchWithAuth = (url: string | URL | Request, options?: RequestInit) => Promise<Response>;

// Note: Token refresh is now handled by AuthContext automatically
// This fetchWithAuth function will simply retry failed requests once
// The AuthContext will handle the actual token refresh in the background

export const fetchWithAuth: FetchWithAuth = async (url, options) => {
  let response = await fetch(url, options);

  // If we get a 401, wait a moment and retry once
  // The AuthContext should have automatically refreshed the token in the background
  if (response.status === 401) {
    console.log('[fetchWithAuth] Received 401, waiting briefly and retrying once...');
    
    // Wait a short moment to allow any ongoing token refresh to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Retry the request once
    response = await fetch(url, options);
    
    // If still 401 after retry, the session is truly expired
    if (response.status === 401) {
      console.log('[fetchWithAuth] Still 401 after retry, session expired');
      toast.error('Session expired. Please log in again.');
      window.location.href = '/login';
    }
  }

  return response;
};

// Optional: Export a default version if preferred
// export default fetchWithAuth;