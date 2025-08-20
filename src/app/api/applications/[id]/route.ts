import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { jobApplications as jobApplicationsTable, applicationStatusEnum } from '@/db/schema';
import { eq } from 'drizzle-orm';

export function GET() {
  return NextResponse.json({ status: 'placeholder' });
}

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
    const { referralName, referralEmail, referralPosition, referralDept, status } = body;

    // Prepare update object with only provided fields
    const updateData: {
      referralName?: string | null;
      referralEmail?: string | null;
      referralPosition?: string | null;
      referralDept?: string | null;
      status?: typeof applicationStatusEnum.enumValues[number];
    } = {};

    if (referralName !== undefined) {
      updateData.referralName = referralName.trim() || null;
    }
    if (referralEmail !== undefined) {
      updateData.referralEmail = referralEmail.trim() || null;
    }
    if (referralPosition !== undefined) {
      updateData.referralPosition = referralPosition.trim() || null;
    }
    if (referralDept !== undefined) {
      updateData.referralDept = referralDept.trim() || null;
    }
    if (status !== undefined) {
      // Validate status against the enum values
      if (!applicationStatusEnum.enumValues.includes(status)) {
        return NextResponse.json({ error: `Invalid status value: ${status}` }, { status: 400 });
      }
      updateData.status = status as typeof applicationStatusEnum.enumValues[number];
    }

    // Validate that at least one field is provided for update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields provided for update' }, { status: 400 });
    }

    const updatedApplication = await db
      .update(jobApplicationsTable)
      .set(updateData)
      .where(eq(jobApplicationsTable.id, applicationId))
      .returning({
        id: jobApplicationsTable.id,
        referralName: jobApplicationsTable.referralName,
        referralEmail: jobApplicationsTable.referralEmail,
        referralPosition: jobApplicationsTable.referralPosition,
        referralDept: jobApplicationsTable.referralDept,
      });

    if (updatedApplication.length === 0) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Application updated successfully',
      application: updatedApplication[0]
    });
  } catch (error) {
    console.error('Failed to update application:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update application: ${errorMessage}` }, { status: 500 });
  }
}