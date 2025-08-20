import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { jobApplications as jobApplicationsTable } from '@/db/schema';
import { ApplicationStatus } from '@/types/database';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id: applicationId } = resolvedParams;

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status value
    const validStatuses: ApplicationStatus[] = [
      'Pending', 'Reviewed', 'Interviewing', 'Shortlisted', 
      'Offered', 'Rejected', 'Hired', 'Withdrawn', 'On Hold', 'Onboard', 'Auto-Assessed'
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const updatedApplication = await db
      .update(jobApplicationsTable)
      .set({ status })
      .where(eq(jobApplicationsTable.id, applicationId))
      .returning({
        id: jobApplicationsTable.id,
        status: jobApplicationsTable.status,
      });

    if (updatedApplication.length === 0) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Application status updated successfully',
      application: updatedApplication[0]
    });
  } catch (error) {
    console.error('Failed to update application status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update status: ${errorMessage}` }, { status: 500 });
  }
} 