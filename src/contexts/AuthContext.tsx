'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCookie, getCookie } from 'cookies-next'; // Use cookies-next for client-side cookie access

interface AuthContextType {
  isAuthenticated: boolean;
  userType: 'admin' | 'applicant' | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>; // Function to re-check auth status
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userType, setUserType] = useState<'admin' | 'applicant' | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Add loading state
  const router = useRouter();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef<boolean>(false);

  // Helper function to decode JWT token and extract user type and expiration
  const decodeToken = (token: string): { type: 'admin' | 'applicant'; exp: number } | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { type: payload.type, exp: payload.exp };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Function to refresh the access token
  const refreshToken = async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      return false; // Already refreshing
    }

    isRefreshingRef.current = true;
    try {
      console.log('[AuthContext] Attempting to refresh token...');
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        console.log('[AuthContext] Token refreshed successfully');
        await checkAuth(); // Update auth status with new token
        return true;
      } else {
        console.log('[AuthContext] Token refresh failed, logging out');
        await logout();
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Token refresh error:', error);
      await logout();
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // Function to start automatic token refresh
  const startTokenRefresh = (token: string) => {
    const decoded = decodeToken(token);
    if (!decoded) return;

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    
    // Refresh token 2 minutes before expiry (or immediately if less than 2 minutes left)
    const refreshTime = Math.max(0, (timeUntilExpiry - 120) * 1000);
    
    console.log(`[AuthContext] Token expires in ${timeUntilExpiry} seconds, will refresh in ${refreshTime / 1000} seconds`);
    
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearTimeout(refreshIntervalRef.current);
    }
    
    refreshIntervalRef.current = setTimeout(async () => {
      const success = await refreshToken();
      if (success) {
        // Start the next refresh cycle
        const newToken = getCookie('access_token');
        if (typeof newToken === 'string') {
          startTokenRefresh(newToken);
        }
      }
    }, refreshTime);
  };

  // Function to stop automatic token refresh
  const stopTokenRefresh = () => {
    if (refreshIntervalRef.current) {
      clearTimeout(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  // Function to check auth status and decode user type from token
  const checkAuth = async () => {
    const tokenValue = getCookie('access_token'); // Check for access_token client-side
    const token = typeof tokenValue === 'string' ? tokenValue : null;
    
    if (token) {
      const decoded = decodeToken(token);
      
      if (decoded) {
        const now = Math.floor(Date.now() / 1000);
        
        // Check if token is expired
        if (decoded.exp <= now) {
          console.log('[AuthContext] Token is expired, attempting refresh...');
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            setIsAuthenticated(false);
            setUserType(null);
            stopTokenRefresh();
            return;
          }
          // If refresh was successful, get the new token
          const newTokenValue = getCookie('access_token');
          const newToken = typeof newTokenValue === 'string' ? newTokenValue : null;
          if (newToken) {
            const newDecoded = decodeToken(newToken);
            if (newDecoded) {
              setIsAuthenticated(true);
              setUserType(newDecoded.type);
              startTokenRefresh(newToken);
            }
          }
        } else {
          setIsAuthenticated(true);
          setUserType(decoded.type);
          startTokenRefresh(token);
        }
      } else {
        setIsAuthenticated(false);
        setUserType(null);
        stopTokenRefresh();
      }
    } else {
      setIsAuthenticated(false);
      setUserType(null);
      stopTokenRefresh();
    }
  };

  // Check auth status on initial load
  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsLoading(false); // Set loading to false after check
    };
    initAuth();
  }, []);

  // Cleanup effect to stop refresh interval on unmount
  useEffect(() => {
    return () => {
      stopTokenRefresh();
    };
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: pass }),
      });

      if (response.ok) {
        await checkAuth(); // Update auth status and user type after successful login (this will also start token refresh)
        
        // Small delay to ensure auth state is updated
        setTimeout(() => {
          // Redirect based on user type - decode token directly for immediate routing
          const tokenValue = getCookie('access_token');
          const token = typeof tokenValue === 'string' ? tokenValue : null;
          
          if (token) {
            const decoded = decodeToken(token);
            
            if (decoded?.type === 'admin') {
              console.log('[AuthContext] Redirecting admin to /jobs');
              router.push('/jobs');
            } else if (decoded?.type === 'applicant') {
              console.log('[AuthContext] Redirecting applicant to /apply');
              router.push('/apply');
            } else {
              console.log('[AuthContext] Unknown user type, redirecting to /');
              router.push('/'); // Fallback
            }
          } else {
            console.log('[AuthContext] No token found after login, redirecting to /');
            router.push('/'); // Fallback
          }
        }, 100); // Small delay to ensure cookies are set
        
        return true;
      } else {
        // Handle login error (e.g., show a message)
        console.error('Login failed:', await response.text());
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      console.error('Login request error:', error);
      setIsAuthenticated(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      stopTokenRefresh(); // Stop automatic refresh
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (response.ok) {
        deleteCookie('access_token'); // Delete access_token client-side
        // No need to delete refresh_token client-side as it's HttpOnly and handled server-side
        setIsAuthenticated(false);
        setUserType(null);
        router.push('/login'); // Redirect to login page after logout
      } else {
        console.error('Logout failed:', await response.text());
        // Optionally handle logout error
      }
    } catch (error) {
      console.error('Logout request error:', error);
      // Optionally handle logout error
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userType, login, logout, checkAuth }}>
      {isLoading ? null : children} {/* Don't render children until loading is false */}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};