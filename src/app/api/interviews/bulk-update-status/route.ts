import { NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { calls, jobApplications } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { callIds, status } = await req.json();

    if (!callIds || !Array.isArray(callIds) || callIds.length === 0 || !status) {
      return NextResponse.json({ message: 'Invalid request parameters.' }, { status: 400 });
    }

    const applicationsToUpdate = await db.select({ applicationId: calls.applicationId })
      .from(calls)
      .where(inArray(calls.id, callIds));

    const applicationIds = applicationsToUpdate.map(app => app.applicationId).filter(Boolean) as string[];

    if (applicationIds.length === 0) {
      return NextResponse.json({ message: 'No relevant applications found for the selected interviews.' }, { status: 404 });
    }

    const result = await db.update(jobApplications)
      .set({ status: status })
      .where(inArray(jobApplications.id, applicationIds));

    return NextResponse.json({ message: 'Interview statuses updated successfully.', updatedCount: result.rowCount });
  } catch (error) {
    console.error('Error updating interview statuses:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}