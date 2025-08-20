import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Use jose
import { performAnalysisAndSaveReport, AnalysisTimeoutError } from '@/lib/analysis'; // Import the new function and custom error

// Define the expected structure of the JWT payload
interface AccessTokenPayload {
  userId: string;
  email?: string; // Optional
  type: 'admin' | 'applicant';
}

// --- Vercel Edge Runtime Configuration ---
export const maxDuration = 60; // Set max duration to 60 seconds
// ---------------------------------------

export async function POST(req: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;

  // Remove API key check if handled within performAnalysisAndSaveReport
  // const apiKey = process.env.GEMINI_API_KEY;
  // if (!apiKey || !jwtSecret) { ... }

  if (!jwtSecret) {
    console.error("Missing JWT_SECRET environment variable.");
    return NextResponse.json({ error: 'JWT secret not configured.' }, { status: 500 });
  }
  const secretKey = new TextEncoder().encode(jwtSecret);

  let callId: string | null = null; // Keep track of callId for logging
  let userId: string; // To store authenticated user ID
  let userType: string;

  try {
    // --- Authentication --- 
    const tokenCookie = req.cookies.get('access_token');
    if (!tokenCookie) {
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
          algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      userId = payload.userId;
      userType = payload.type;
      if (!userId) throw new Error('User ID missing in token payload');
      if (!userType) throw new Error('User type missing in token payload');
    } catch (authError: any) {
      console.warn('Analyze API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }
    // --- End Authentication ---

    const body = await req.json();
    callId = body.callId; // Expect callId in the body

    if (!callId) {
        return NextResponse.json({ error: "Call ID missing in request body." }, { status: 400 });
    }

    // --- Call the Refactored Analysis Logic --- 
    // console.log(`[Analyze API ${callId}] Manual trigger received for user ${userId}. Calling performAnalysisAndSaveReport...`);
    const result = await performAnalysisAndSaveReport(callId, userId, userType);

    // --- Handle the Result --- 
    if (result.success) {
        // Handle case where analysis was already complete
        if (result.message?.includes("already completed")) {
            return NextResponse.json({
                message: result.message,
                callId: callId,
                reportId: result.reportId
            }, { status: 200 }); 
        }
        // Handle successful analysis completion
        return NextResponse.json({
            message: "Analysis completed successfully.",
            report: result.report,
            reportId: result.reportId
        }, { status: 200 }); // Use 200 OK for successful completion
    } else {
        // Handle specific timeout error from the analysis function
        if (result.error?.includes("timed out")) {
             console.warn(`[Analyze API ${callId}] Analysis timed out during manual trigger.`);
             return NextResponse.json({ error: result.error }, { status: 504 }); // 504 Gateway Timeout might be appropriate
        }
        // Handle other analysis errors (Forbidden, Not Found, DB error, Gemini error, etc.)
        const statusCode = result.error?.includes('Forbidden') ? 403
                         : result.error?.includes('not found') ? 404
                         : 500; // Default to 500 for other internal errors
        console.error(`[Analyze API ${callId}] Analysis failed: ${result.error}`);
        return NextResponse.json({ error: result.error ?? "Analysis failed" }, { status: statusCode });
    }

  } catch (error: any) {
      console.error(`[Analyze API ${callId}] Unexpected error in POST handler:`, error);
      const statusCode = error instanceof Error && error.name === 'JWTExpired' ? 401 : 500;
      return NextResponse.json({ error: error.message ?? 'Unexpected server error during analysis trigger.' }, { status: statusCode });
  }
}
