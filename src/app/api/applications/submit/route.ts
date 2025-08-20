import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { 
  jobApplications, 
  scoringResults,
  candidates as candidatesTable // Renamed to avoid conflict
} from '@/db/schema';
import { ResumeAssessment, SCORING_DIMENSIONS_CONFIG, AssessmentSection, calculateOverallScore } from '@/types/resume-assessment'; // Added calculateOverallScore
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

interface SubmitApplicationPayload {
  jobId: string;
  candidateId: string;
  // resumeId: string; // resumeId is mainly for linking if needed, but candidateId is key for application
  applicantFullName?: string; // For consistency check or if candidate record needs update
  applicantEmail?: string;    // For consistency check
  applicantPhone?: string | null;
  referralName?: string;
  referralEmail?: string;
  referralPosition?: string;
  referralDept?: string;
  assessmentResult: ResumeAssessment;
  status?: string; // Allow custom status (e.g., 'Auto-Assessed')
}

export async function POST(request: NextRequest) {
  try {
    const payload: SubmitApplicationPayload = await request.json();
    const { 
      jobId, 
      candidateId, 
      applicantFullName, // Used for potential update
      applicantEmail,    // Used for potential update/verification
      applicantPhone,
      referralName,
      referralEmail,
      referralPosition,
      referralDept,
      assessmentResult,
      status = 'Pending' // Default to 'Pending' if not provided
    } = payload;

    if (!jobId || !candidateId || !assessmentResult) {
      return NextResponse.json({ error: 'Missing required fields: jobId, candidateId, or assessmentResult.' }, { status: 400 });
    }

    // Start a transaction to ensure all DB operations succeed or fail together (optional but recommended)
    // Note: Basic transaction example. For complex scenarios, explore Drizzle's transaction API further.
    // For now, we'll proceed with individual operations and rely on try/catch for errors.

    let applicationId: string | null = null;

    // 1. Update candidate's phone number if provided and different
    // (Assuming candidate record was created/fetched by /api/resumes/upload)
    if (applicantPhone) {
        const currentCandidate = await db.select({ phone: candidatesTable.phone })
                                       .from(candidatesTable)
                                       .where(eq(candidatesTable.id, candidateId))
                                       .limit(1);
        
        if (currentCandidate.length > 0 && currentCandidate[0].phone !== applicantPhone) {
            await db.update(candidatesTable)
                    .set({ phone: applicantPhone })
                    .where(eq(candidatesTable.id, candidateId));
            console.log(`Updated phone for candidate ID: ${candidateId}`);
        }
    }
    // We could also update fullName and email here if necessary, based on your application's logic
    // For example, if the user could change their name/email on the application form after initial resume upload.


    // 2. Create a new Job Application entry
    try {
      const newApplicationId = uuidv4();
      const jobApplicationData = {
        id: newApplicationId,
        jobId: jobId,
        candidateId: candidateId,
        status: status as any, // Use provided status (e.g., 'Auto-Assessed' or 'Pending')
        referralName: referralName || null,
        referralEmail: referralEmail || null,
        referralPosition: referralPosition || null,
        referralDept: referralDept || null,
        // createdAt will be handled by DB default
      };
      const insertedApplication = await db.insert(jobApplications)
                                          .values(jobApplicationData)
                                          .returning({ id: jobApplications.id });
      
      if (insertedApplication && insertedApplication.length > 0 && insertedApplication[0].id) {
        applicationId = insertedApplication[0].id;
        console.log(`Created job application with ID: ${applicationId}`);
      } else {
        throw new Error('Failed to create job application or retrieve its ID.');
      }
    } catch (dbError: any) {
      console.error('Error creating job application:', dbError);
      // Check for unique constraint violation (e.g., candidate already applied for this job)
      if (dbError.code === '23505') { // PostgreSQL unique violation error code
        return NextResponse.json({ error: 'This candidate has already applied for this job.', details: dbError.detail }, { status: 409 }); // Conflict
      }
      return NextResponse.json({ error: 'Failed to save job application.', details: dbError.message }, { status: 500 });
    }

    // 3. Create Scoring Result entry
    try {
      let finalOverallScore: number;
      if (typeof assessmentResult.overallScore === 'number') {
        finalOverallScore = assessmentResult.overallScore;
      } else {
        let totalScoreCalc = 0;
        let totalWeightCalc = 0;
        SCORING_DIMENSIONS_CONFIG.forEach(dimension => {
            const section = assessmentResult[dimension.id] as AssessmentSection;
            if (section && typeof section.score === 'number') {
                totalScoreCalc += section.score * dimension.weight;
                totalWeightCalc += dimension.weight;
            }
        });
        finalOverallScore = totalWeightCalc > 0 ? parseFloat((totalScoreCalc / totalWeightCalc).toFixed(2)) : 0;
      }

      const decision = finalOverallScore >= 3.0 ? 'Potentially Qualified' : 'Needs Further Review';
      
      const scoringResultData: typeof scoringResults.$inferInsert = {
        id: uuidv4(),
        applicationId: applicationId,
        overallScore: finalOverallScore.toFixed(2),
        overallSummary: assessmentResult.overallSummary || 'No overall summary provided.',
        experienceScore: (assessmentResult.experience?.score ?? 0).toFixed(2),
        experienceReview: assessmentResult.experience?.summary || null,
        educationScore: (assessmentResult.education?.score ?? 0).toFixed(2),
        educationReview: assessmentResult.education?.summary || null,
        skillsScore: (assessmentResult.skills?.score ?? 0).toFixed(2),
        skillsReview: assessmentResult.skills?.summary || null,
        roleFitScore: (assessmentResult.roleFit?.score ?? 0).toFixed(2),
        roleFitReview: assessmentResult.roleFit?.summary || null,
        certificationsScore: (assessmentResult.certifications?.score ?? 0).toFixed(2),
        certificationsReview: assessmentResult.certifications?.summary || null,
        projectImpactScore: (assessmentResult.projectImpact?.score ?? 0).toFixed(2),
        projectImpactReview: assessmentResult.projectImpact?.summary || null,
        softSkillsScore: (assessmentResult.softSkills?.score ?? 0).toFixed(2),
        softSkillsReview: assessmentResult.softSkills?.summary || null,
        decision: decision,
        skillsCompleteness: assessmentResult.requirementsCheck || [],
      };

      await db.insert(scoringResults).values(scoringResultData);
      console.log(`Created scoring result for application ID: ${applicationId}`);

    } catch (dbError: any) {
      console.error('Error creating scoring result:', dbError);
      // If scoring fails, we might want to roll back the application creation or mark it as incomplete.
      // For now, just returning an error.
      return NextResponse.json({ error: 'Failed to save scoring results.', details: dbError.message, applicationId: applicationId }, { status: 500 });
    }

    return NextResponse.json(
      { 
        message: 'Application submitted and all data saved successfully.', 
        applicationId: applicationId 
      }, 
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error in /api/applications/submit:', error);
    return NextResponse.json({ error: 'Internal server error during application submission.', details: error.message }, { status: 500 });
  }
}