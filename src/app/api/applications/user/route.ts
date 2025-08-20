import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import {
  candidates as candidatesTable,
  jobApplications as jobApplicationsTable,
  jobVacancies as jobVacanciesTable,
  resumes as resumesTable
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPresignedUrl } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    // First, find the candidate with this email
    const candidate = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.email, email))
      .limit(1);

    if (candidate.length === 0) {
      // No candidate found, user hasn't applied to any jobs yet
      return NextResponse.json([]);
    }

    const candidateData = candidate[0];

    // Get all applications for this candidate with job and resume details
    const applications = await db
      .select({
        // Application details
        applicationId: jobApplicationsTable.id,
        applicationStatus: jobApplicationsTable.status,
        applicationCreatedAt: jobApplicationsTable.createdAt,
        
        // Job details
        jobId: jobVacanciesTable.id,
        jobTitle: jobVacanciesTable.title,
        jobDescription: jobVacanciesTable.description,
        jobDesc: jobVacanciesTable.job_desc,
        jobRequirements: jobVacanciesTable.requirements,
      })
      .from(jobApplicationsTable)
      .innerJoin(jobVacanciesTable, eq(jobApplicationsTable.jobId, jobVacanciesTable.id))
      .where(eq(jobApplicationsTable.candidateId, candidateData.id))
      .orderBy(jobApplicationsTable.createdAt);

    // Get resumes for this candidate separately to avoid duplicates
    const candidateResumes = await db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.candidateId, candidateData.id))
      .orderBy(resumesTable.createdAt);

    // Use the most recent resume or null if no resumes
    const latestResume = candidateResumes.length > 0 ? candidateResumes[candidateResumes.length - 1] : null;

    // Format the response to match the structure expected by the pre-interview component
    const formattedApplications = await Promise.all(
      applications.map(async (app) => {
        // Generate signed URL for resume if it exists
        let resumeSignedUrl = null;
        if (latestResume?.fileUrl) {
          try {
            resumeSignedUrl = await getPresignedUrl(latestResume.fileUrl);
          } catch (error) {
            console.warn('Could not generate signed URL for resume:', error);
          }
        }

        return {
          applicationId: app.applicationId,
          job: {
            id: app.jobId,
            title: app.jobTitle,
            description: app.jobDescription,
            job_desc: app.jobDesc,
            requirements: app.jobRequirements,
          },
          candidate: {
            id: candidateData.id,
            fullName: candidateData.fullName,
            email: candidateData.email,
            phone: candidateData.phone,
            birthdate: candidateData.birthdate,
            jobInterest: candidateData.jobInterest,
            education: candidateData.education,
            workExperience: candidateData.workExperience,
            orgExperience: candidateData.orgExperience,
            summary: candidateData.summary,
          },
          resume: latestResume ? {
            id: latestResume.id,
            fileName: latestResume.fileName,
            fileUrl: resumeSignedUrl || latestResume.fileUrl,
            parsedContent: latestResume.parsedContent,
          } : null,
          status: app.applicationStatus,
          createdAt: app.applicationCreatedAt,
        };
      })
    );

    return NextResponse.json(formattedApplications);
  } catch (error) {
    console.error('Error fetching user applications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 