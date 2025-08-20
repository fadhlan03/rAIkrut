import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import {
  jobApplications as jobApplicationsTable,
  jobVacancies as jobVacanciesTable,
  scoringResults as scoringResultsTable
} from '@/db/schema';
import { CandidateApplication } from '@/types/database';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: candidateId } = resolvedParams;

    if (!candidateId) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    const applications = await db
      .select({
        applicationId: jobApplicationsTable.id,
        jobId: jobApplicationsTable.jobId,
        jobTitle: jobVacanciesTable.title,
        status: jobApplicationsTable.status,
        createdAt: jobApplicationsTable.createdAt,
        overallScore: scoringResultsTable.overallScore,
        referralName: jobApplicationsTable.referralName,
        referralEmail: jobApplicationsTable.referralEmail,
        referralPosition: jobApplicationsTable.referralPosition,
        referralDept: jobApplicationsTable.referralDept,
      })
      .from(jobApplicationsTable)
      .innerJoin(jobVacanciesTable, eq(jobApplicationsTable.jobId, jobVacanciesTable.id))
      .leftJoin(scoringResultsTable, eq(jobApplicationsTable.id, scoringResultsTable.applicationId))
      .where(eq(jobApplicationsTable.candidateId, candidateId))
      .orderBy(jobApplicationsTable.createdAt);

    const formattedApplications: CandidateApplication[] = applications.map(app => ({
      application_id: app.applicationId,
      job_id: app.jobId,
      job_title: app.jobTitle,
      status: app.status,
      created_at: app.createdAt,
      overall_score: app.overallScore ? parseFloat(app.overallScore) : undefined,
      application_date: app.createdAt,
      referral_name: app.referralName || undefined,
      referral_email: app.referralEmail || undefined,
      referral_position: app.referralPosition || undefined,
      referral_dept: app.referralDept || undefined,
    }));

    return NextResponse.json(formattedApplications);
  } catch (error) {
    console.error('Failed to fetch candidate applications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch applications: ${errorMessage}` }, { status: 500 });
  }
}