'use client';

import { useEffect } from 'react';

export function DevTools() {
  useEffect(() => {
    // Only load in development and on client side
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      import('@/lib/auth-test').then(() => {
        console.log('🔧 Development tools loaded. Use testTokenRefresh() in console to test authentication.');
      }).catch((error) => {
        console.error('Failed to load development tools:', error);
      });
    }
  }, []);

  // This component renders nothing
  return null;
}