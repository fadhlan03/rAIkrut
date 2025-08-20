import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { resumes as resumesTable } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getPresignedUrl } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const resumeResult = await db
      .select({
        gcsObjectPath: resumesTable.fileUrl,
      })
      .from(resumesTable)
      .where(eq(resumesTable.candidateId, id))
      .orderBy(desc(resumesTable.createdAt)) // Get the most recent resume
      .limit(1);

    if (resumeResult.length === 0 || !resumeResult[0].gcsObjectPath) {
      return NextResponse.json({ error: 'Resume not found or path is missing for this candidate' }, { status: 404 });
    }

    const accessibleFileUrl = await getPresignedUrl(resumeResult[0].gcsObjectPath);

    return NextResponse.json({ fileUrl: accessibleFileUrl });

  } catch (error) {
    console.error('Failed to fetch resume URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch resume URL: ${errorMessage}` }, { status: 500 });
  }
} 