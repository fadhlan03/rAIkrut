import { NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { jobApplications, jobVacancies, candidates, resumes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getPresignedUrl } from '@/lib/storage';

export async function GET() {
  try {
    // Get a random job application with related data
    const randomApplication = await db
      .select({
        application: jobApplications,
        job: jobVacancies,
        candidate: candidates,
        resume: resumes,
      })
      .from(jobApplications)
      .leftJoin(jobVacancies, eq(jobApplications.jobId, jobVacancies.id))
      .leftJoin(candidates, eq(jobApplications.candidateId, candidates.id))
      .leftJoin(resumes, eq(candidates.id, resumes.candidateId))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (randomApplication.length === 0) {
      return NextResponse.json({ error: 'No applications found' }, { status: 404 });
    }

    const applicationData = randomApplication[0];

    // Generate pre-signed URL for resume if it exists
    let resumeSignedUrl = null;
    if (applicationData.resume?.fileUrl) {
      try {
        resumeSignedUrl = await getPresignedUrl(applicationData.resume.fileUrl, 3600); // 1 hour expiry
      } catch (error) {
        console.error('Error generating pre-signed URL for resume:', error);
        // Continue without the signed URL if there's an error
      }
    }

    return NextResponse.json({
      applicationId: applicationData.application.id,
      job: {
        id: applicationData.job?.id,
        title: applicationData.job?.title,
        description: applicationData.job?.description,
        job_desc: applicationData.job?.job_desc,
        requirements: applicationData.job?.requirements,
      },
      candidate: {
        id: applicationData.candidate?.id,
        fullName: applicationData.candidate?.fullName,
        email: applicationData.candidate?.email,
        phone: applicationData.candidate?.phone,
        birthdate: applicationData.candidate?.birthdate,
        jobInterest: applicationData.candidate?.jobInterest,
        education: applicationData.candidate?.education,
        workExperience: applicationData.candidate?.workExperience,
        orgExperience: applicationData.candidate?.orgExperience,
        summary: applicationData.candidate?.summary,
      },
      resume: {
        id: applicationData.resume?.id,
        fileName: applicationData.resume?.fileName,
        fileUrl: resumeSignedUrl || applicationData.resume?.fileUrl, // Use signed URL if available
        parsedContent: applicationData.resume?.parsedContent,
      },
      status: applicationData.application.status,
      createdAt: applicationData.application.createdAt,
    });
  } catch (error) {
    console.error('Error fetching random application:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 