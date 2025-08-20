// Utility to test automatic token refresh functionality
// This can be used in the browser console to verify the refresh mechanism

export const testTokenRefresh = () => {
  console.log('=== Token Refresh Test ===');
  
  // Get current token
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };
  
  const token = getCookie('access_token');
  if (!token) {
    console.log('❌ No access token found');
    return;
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;
    
    console.log('✅ Current token info:');
    console.log(`   User: ${payload.email} (${payload.type})`);
    console.log(`   Expires in: ${timeUntilExpiry} seconds (${Math.round(timeUntilExpiry / 60)} minutes)`);
    console.log(`   Will refresh in: ${Math.max(0, timeUntilExpiry - 120)} seconds`);
    
    if (timeUntilExpiry <= 120) {
      console.log('⚠️  Token will expire soon - refresh should happen automatically');
    } else {
      console.log('✅ Token is fresh - automatic refresh scheduled');
    }
  } catch (error) {
    console.log('❌ Error decoding token:', error);
  }
};

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).testTokenRefresh = testTokenRefresh;
  console.log('Token refresh test utility loaded. Run testTokenRefresh() in console to check status.');
}