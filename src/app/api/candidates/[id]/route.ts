import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import {
    candidates as candidatesTable,
    resumes as resumesTable,
    jobApplications as jobApplicationsTable
} from '@/db/schema';
import { Candidate } from '@/types/database';
import { sql, eq, countDistinct } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Corrected type to match working example
) {
  try {
    const resolvedParams = await params; // Await the params object
    const { id } = resolvedParams;      // Then destructure id

    if (!id) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    const result = await db
      .select({
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
        has_resume: sql<boolean>`EXISTS (SELECT 1 FROM ${resumesTable} WHERE ${resumesTable.candidateId} = ${candidatesTable.id})`.as('has_resume'),
        job_applications_count: countDistinct(jobApplicationsTable.id).as('job_applications_count'),
      })
      .from(candidatesTable)
      .where(eq(candidatesTable.id, id))
      .leftJoin(resumesTable, eq(candidatesTable.id, resumesTable.candidateId))
      .leftJoin(jobApplicationsTable, eq(candidatesTable.id, jobApplicationsTable.candidateId))
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
        candidatesTable.summary
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const candidateData = result[0];

    const candidate: Candidate = {
      id: candidateData.id,
      created_at: candidateData.createdAt,
      full_name: candidateData.fullName,
      email: candidateData.email,
      phone: candidateData.phone ?? undefined,
      birthdate: candidateData.birthdate ?? undefined,
      job_interest: candidateData.jobInterest as any,
      education: candidateData.education as any,
      work_experience: candidateData.workExperience as any,
      org_experience: candidateData.orgExperience as any,
      summary: candidateData.summary ?? undefined,
      has_resume: Boolean(candidateData.has_resume),
      job_applications_count: Number(candidateData.job_applications_count) || 0,
    };

    return NextResponse.json(candidate);
  } catch (error) {
    console.error('Failed to fetch candidate details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch candidate details: ${errorMessage}` }, { status: 500 });
  }
} 