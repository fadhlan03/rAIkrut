import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { 
    jobApplications as jobApplicationsTable, 
    candidates as candidatesTable,
    resumes as resumesTable,
    scoringResults as scoringResultsTable
} from '@/db/schema';
import { Candidate } from '@/types/database';
import { eq, sql, countDistinct, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Job ID - Corrected type
) {
  try {
    const resolvedParams = await params; // Await params
    const { id: jobId } = resolvedParams;   // Destructure from resolvedParams

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Subquery to count job applications for each candidate
    // This is a bit complex to do directly in the main query for each candidate *across all jobs*
    // So, we'll fetch has_resume and for job_applications_count, we'll count applications for *this specific job*
    // or rely on the general job_applications_count if that's what's needed.
    // For this context (applicants for a specific job), their application to *this* job is implied.
    // If we need their total applications count, that's a separate concern.
    // Let's keep it simple and fetch standard candidate details + has_resume.

    const applicants = await db
      .select({
        // Select all fields from candidatesTable
        id: candidatesTable.id,
        createdAt: candidatesTable.createdAt,
        fullName: candidatesTable.fullName,
        email: candidatesTable.email,
        phone: candidatesTable.phone,
        birthdate: candidatesTable.birthdate,
        jobInterest: candidatesTable.jobInterest,
        education: candidatesTable.education,
        workExperience: candidatesTable.workExperience,
        orgExperience: candidatesTable.orgExperience,
        summary: candidatesTable.summary,
        // Fields from other tables or derived
        has_resume: sql<boolean>`EXISTS (SELECT 1 FROM ${resumesTable} WHERE ${resumesTable.candidateId} = ${candidatesTable.id})`.as('has_resume'),
        // job_applications_count for this specific candidate (how many jobs they applied to in total)
        job_applications_count: sql<number>`(
            SELECT COUNT(DISTINCT ja_sub.id) 
            FROM ${jobApplicationsTable} as ja_sub 
            WHERE ja_sub.candidate_id = ${candidatesTable.id}
        )`.as('job_applications_count'),
        applicationStatus: jobApplicationsTable.status, // Status of application for *this* job
        applicationDate: jobApplicationsTable.createdAt, // Date of application for *this* job
        // New fields from scoringResultsTable and jobApplicationsTable
        applicationId: jobApplicationsTable.id, // Key for fetching full scoring details
        decision: scoringResultsTable.decision,
        overallScore: scoringResultsTable.overallScore,
        // Add referral information
        referralName: jobApplicationsTable.referralName,
        referralEmail: jobApplicationsTable.referralEmail,
        referralPosition: jobApplicationsTable.referralPosition,
        referralDept: jobApplicationsTable.referralDept,
      })
      .from(jobApplicationsTable)
      .innerJoin(candidatesTable, eq(jobApplicationsTable.candidateId, candidatesTable.id))
      .leftJoin(scoringResultsTable, eq(jobApplicationsTable.id, scoringResultsTable.applicationId))
      .where(eq(jobApplicationsTable.jobId, jobId))
      .groupBy(
        candidatesTable.id, 
        candidatesTable.createdAt, 
        candidatesTable.fullName,
        candidatesTable.email,
        candidatesTable.phone,
        candidatesTable.birthdate,
        candidatesTable.jobInterest,
        candidatesTable.education,
        candidatesTable.workExperience,
        candidatesTable.orgExperience,
        candidatesTable.summary,
        jobApplicationsTable.status, // Include in GROUP BY
        jobApplicationsTable.createdAt, // Include in GROUP BY
        // Add new grouped fields
        jobApplicationsTable.id, // For applicationId
        scoringResultsTable.decision,
        scoringResultsTable.overallScore,
        jobApplicationsTable.referralName,
        jobApplicationsTable.referralEmail,
        jobApplicationsTable.referralPosition,
        jobApplicationsTable.referralDept,
        // has_resume is an aggregate/subquery, so not needed in group by
        // job_applications_count is also a subquery
      );

    if (applicants.length === 0) {
      return NextResponse.json([]); // Return empty array if no applicants
    }
    
    const formattedApplicants: Candidate[] = applicants.map(app => ({
      id: app.id,
      created_at: app.createdAt,
      full_name: app.fullName,
      email: app.email,
      phone: app.phone ?? undefined,
      birthdate: app.birthdate ?? undefined,
      job_interest: app.jobInterest as any,
      education: app.education as any,
      work_experience: app.workExperience as any,
      org_experience: app.orgExperience as any,
      summary: app.summary ?? undefined,
      has_resume: Boolean(app.has_resume),
      job_applications_count: Number(app.job_applications_count) || 0,
      application_status_for_this_job: app.applicationStatus,
      application_date_for_this_job: app.applicationDate,
      // New fields
      application_id: app.applicationId,
      decision: app.decision ?? undefined,
      overall_score: app.overallScore !== null && app.overallScore !== undefined ? Number(app.overallScore) : undefined,
      // Add referral information
      referral_name: app.referralName ?? undefined,
      referral_email: app.referralEmail ?? undefined,
      referral_position: app.referralPosition ?? undefined,
      referral_dept: app.referralDept ?? undefined,
    }));

    return NextResponse.json(formattedApplicants);

  } catch (error) {
    console.error('Failed to fetch job applicants:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch job applicants: ${errorMessage}` }, { status: 500 });
  }
}