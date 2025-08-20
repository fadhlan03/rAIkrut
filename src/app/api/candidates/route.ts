import { NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { candidates as candidatesTable, resumes as resumesTable, jobApplications as jobApplicationsTable } from '@/db/schema';
import { Candidate } from '@/types/database';
import { sql, eq, countDistinct } from 'drizzle-orm';

// GET /api/candidates - Fetch all candidates with resume status and application count
export async function GET(request: Request) {
  try {
    const dbCandidatesData = await db
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
        // Check for resume existence
        has_resume: sql<boolean>`EXISTS (SELECT 1 FROM ${resumesTable} WHERE ${resumesTable.candidateId} = ${candidatesTable.id})`.as('has_resume'),
        // Count job applications
        job_applications_count: countDistinct(jobApplicationsTable.id).as('job_applications_count'),
      })
      .from(candidatesTable)
      .leftJoin(resumesTable, eq(candidatesTable.id, resumesTable.candidateId)) // For has_resume, though subquery is more direct
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
        // The SQL for has_resume doesn't need to be in groupBy if it's a subquery correlation
      );

    const allCandidates: Candidate[] = dbCandidatesData.map(c => ({
      id: c.id,
      created_at: c.createdAt,
      full_name: c.fullName,
      email: c.email,
      phone: c.phone ?? undefined,
      birthdate: c.birthdate ?? undefined,
      job_interest: c.jobInterest,
      education: c.education as any, // Cast as Drizzle returns unknown for jsonb
      work_experience: c.workExperience as any, // Cast as Drizzle returns unknown for jsonb
      org_experience: c.orgExperience as any, // Cast as Drizzle returns unknown for jsonb
      summary: c.summary ?? undefined,
      // Map the new fields
      has_resume: Boolean(c.has_resume), // Ensure it's a boolean
      job_applications_count: Number(c.job_applications_count) || 0, // Ensure it's a number, default to 0
    }));

    return NextResponse.json(allCandidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch candidates: ${errorMessage}` }, { status: 500 });
  }
}

// POST /api/candidates - Create a new candidate (might be less common, often candidates are created via applications)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // TODO: Implement logic to create a new candidate
    // const { fullName, email, phone } = body;
    // const newCandidate = await createCandidateInDB(...);
    return NextResponse.json({ message: 'Candidate created successfully (mock)', candidateId: 'mock-candidate-id' }, { status: 201 });
  } catch (error) {
    console.error('Error creating candidate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create candidate: ${errorMessage}` }, { status: 500 });
  }
} 