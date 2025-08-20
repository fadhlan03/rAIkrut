import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose'; // Using jose for edge-compatible JWT verification

const JWT_SECRET = process.env.JWT_SECRET;
// Add check for JWT_SECRET existence during initialization
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is not set');
  throw new Error('JWT_SECRET environment variable is not set');
}
const secret = new TextEncoder().encode(JWT_SECRET);

// Cookie name for indicating call setup is done
const SETUP_COOKIE_NAME = 'call_setup_complete';

// Helper function to determine user type and role-based access
const getUserTypeFromToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.type as string;
  } catch (error) {
    return null;
  }
};

// Define path access rules
const adminPaths = [
  '/jobs', '/benchmarks', '/requirements', '/candidates', '/interview', 
  '/onboarding', '/manage-users', '/review'
];

const applicantPaths = [
  '/apply', '/onboard'
];

const isAdminPath = (pathname: string): boolean => {
  return adminPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
};

const isApplicantPath = (pathname: string): boolean => {
  return applicantPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
};

const isPreInterviewPath = (pathname: string): boolean => {
  return pathname === '/pre-interview' || pathname.startsWith('/pre-interview/');
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // console.log(`[Middleware] Path: ${pathname}`); // Uncomment for debugging

  // --- Check for /call setup cookie BEFORE auth check ---
  if (pathname === '/call') {
    const setupCookie = req.cookies.get(SETUP_COOKIE_NAME);
    // console.log(`[Middleware] /call access attempt. Setup cookie present: ${!!setupCookie}`);
    if (!setupCookie || setupCookie.value !== 'true') {
      console.log('[Middleware] /call access denied: Setup not complete (cookie missing or invalid). Redirecting to /');
      // Redirect to home page if setup cookie is not present or valid
      return NextResponse.redirect(new URL('/', req.url));
    }
    // If setup cookie is present and valid, proceed to auth check below
    console.log('[Middleware] /call access: Setup complete (cookie found). Proceeding to auth check.');
  }
  // --- End Check ---

  // Check for ACCESS token
  const accessTokenCookie = req.cookies.get('access_token');
  const accessToken = accessTokenCookie?.value;
  // console.log(`[Middleware] Access Token present: ${!!accessToken}`);

  const publicPaths = [
    '/login', 
    '/register', 
    '/api/auth/login', 
    '/api/auth/register', 
    '/api/auth/refresh',
    '/api/v1/benchmarks',
    '/api/v1/requirements'
  ]; // Add v1 API endpoints

  // 1. Allow requests to public paths
  if (publicPaths.includes(pathname)) {
    // console.log(`[Middleware] Path is public: ${pathname}`);
    // If logged-in user tries to access /login or /register, redirect to home
    if (accessToken && (pathname === '/login' || pathname === '/register')) {
      console.log(`[Middleware] User logged in, attempting ${pathname} access`);
      try {
        await jwtVerify(accessToken, secret); // Verify access token
        // Valid token, user is logged in, redirect from /login or /register
        console.log(`[Middleware] Valid access token found, redirecting from ${pathname} to /`);
        return NextResponse.redirect(new URL('/', req.url));
      } catch (error) {
        // Invalid or missing token, allow access to /login or /register
        console.log(`[Middleware] Invalid/missing access token on ${pathname} access, clearing potential cookies and allowing access.`);
        const response = NextResponse.next();
        // Clear potentially invalid cookies if verification failed
        if (error instanceof Error && error.message.includes('JWT') || error instanceof Error && error.name.includes('JOSE')) {
            console.warn(`[Middleware] Clearing potentially invalid access/refresh tokens on ${pathname} access attempt.`);
            response.cookies.set('access_token', '', { maxAge: 0, path: '/' });
            response.cookies.set('refresh_token', '', { maxAge: 0, path: '/api/auth/refresh' }); // Clear refresh token too
        }
        return response;
      }
    }
    // Allow access to public paths
    return NextResponse.next();
  }

  // 2. Handle logout API: Clear both tokens
  if (pathname === '/api/auth/logout') {
      console.log('[Middleware] Handling /api/auth/logout');
      const response = NextResponse.redirect(new URL('/login', req.url)); // Redirect to login after logout
      response.cookies.set('access_token', '', { maxAge: 0, path: '/' });
      response.cookies.set('refresh_token', '', { maxAge: 0, path: '/api/auth/refresh' }); // Ensure path matches
      console.log('[Middleware] Cleared access_token and refresh_token cookies during logout');
      return response;
  }

  // 3. All other paths are protected, check for access token
  if (!accessToken) {
    // No token, redirect to login
    // console.log(`[Middleware] No access token found for protected path: ${pathname}. Redirecting to /login.`);
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Access token exists, verify it for protected paths
  // console.log(`[Middleware] Access token found for protected path: ${pathname}. Verifying...`);
  try {
    const { payload } = await jwtVerify(accessToken, secret);
    const userType = payload.type as string;
    
    // Token is valid, now check role-based access
    console.log(`[Middleware] Access token verified successfully for: ${pathname}. User type: ${userType}`);
    
    // Role-based access control
    if (userType === 'admin') {
      // Admin access rules
      if (pathname === '/') {
        console.log(`[Middleware] Admin user accessing root path. Redirecting to /jobs`);
        return NextResponse.redirect(new URL('/jobs', req.url));
      }
      if (isApplicantPath(pathname)) {
        console.log(`[Middleware] Admin user trying to access applicant path: ${pathname}. Redirecting to /jobs`);
        return NextResponse.redirect(new URL('/jobs', req.url));
      }
      // Admin can access admin paths, /review, /pre-interview, and /call
    } else if (userType === 'applicant') {
      // Applicant access rules
      if (pathname === '/') {
        console.log(`[Middleware] Applicant user accessing root path. Redirecting to /apply`);
        return NextResponse.redirect(new URL('/apply', req.url));
      }
      if (isAdminPath(pathname) || pathname === '/review' || pathname.startsWith('/review/')) {
        console.log(`[Middleware] Applicant user trying to access admin path: ${pathname}. Redirecting to /apply`);
        return NextResponse.redirect(new URL('/apply', req.url));
      }
      // Applicant can access applicant paths and /pre-interview
    }
    
    // If we reach here, access is allowed
    return NextResponse.next();
  } catch (error) {
    // Verification failed (expired or invalid)
    console.warn(`[Middleware] Access Token Verification Error for path ${pathname}:`, (error as Error).message);
    // Do NOT redirect here directly. Let the client-side fetchWithAuth handle the 401 and attempt refresh.
    // If the client-side refresh fails, it will handle the redirect.
    // However, if the request is a direct navigation (not fetch), a redirect IS needed.
    // Let's check the request type. For now, redirecting as a default behaviour on direct nav failure.

    // Check if it's a fetch request (less reliable in middleware)
    const isFetch = req.headers.get('sec-fetch-site') === 'same-origin' &&
                    req.headers.get('sec-fetch-mode') === 'cors';

    if (isFetch) {
        // For fetch requests, let the client handle 401 and refresh
        // We could potentially return a 401 response here, but Next() allows the request to proceed
        // to the API route which will then return the 401 that fetchWithAuth expects.
        console.log(`[Middleware] Letting fetch request proceed to API for 401 handling: ${pathname}`);
        return NextResponse.next();
    } else {
        // For direct navigation, token is invalid/expired, redirect to login and clear access token
        console.log(`[Middleware] Invalid/Expired access token for navigation to ${pathname}. Redirecting to /login and clearing access token.`);
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('redirectedFrom', pathname); // Optionally preserve redirect target
        const response = NextResponse.redirect(loginUrl);
        // Clear only the invalid access token. Let refresh token persist for potential future login/refresh.
        response.cookies.set('access_token', '', { maxAge: 0, path: '/' });
        return response;
    }
  }
}

// Configure the middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any path that includes a '.' (likely a file extension)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\.).*)', // Adjusted regex to exclude paths with '.'
  ],
}; 