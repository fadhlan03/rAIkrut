import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { scoringResults as scoringResultsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ScoringResult } from '@/types/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
    }

    const results = await db
      .select()
      .from(scoringResultsTable)
      .where(eq(scoringResultsTable.applicationId, id))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json({ error: 'Scoring details not found for this application' }, { status: 404 });
    }
    
    const scoringDataRaw = results[0];
    const formattedResult: ScoringResult = {
        id: scoringDataRaw.id,
        created_at: scoringDataRaw.createdAt,
        application_id: scoringDataRaw.applicationId,
        overall_score: Number(scoringDataRaw.overallScore),
        overall_summary: scoringDataRaw.overallSummary,
        experience_score: Number(scoringDataRaw.experienceScore),
        experience_review: scoringDataRaw.experienceReview ?? undefined,
        education_score: Number(scoringDataRaw.educationScore),
        education_review: scoringDataRaw.educationReview ?? undefined,
        skills_score: Number(scoringDataRaw.skillsScore),
        skills_review: scoringDataRaw.skillsReview ?? undefined,
        role_fit_score: Number(scoringDataRaw.roleFitScore),
        role_fit_review: scoringDataRaw.roleFitReview ?? undefined,
        certifications_score: Number(scoringDataRaw.certificationsScore),
        certifications_review: scoringDataRaw.certificationsReview ?? undefined,
        project_impact_score: Number(scoringDataRaw.projectImpactScore),
        project_impact_review: scoringDataRaw.projectImpactReview ?? undefined,
        soft_skills_score: Number(scoringDataRaw.softSkillsScore),
        soft_skills_review: scoringDataRaw.softSkillsReview ?? undefined,
        decision: scoringDataRaw.decision ?? undefined,
        skills_completeness: scoringDataRaw.skillsCompleteness,
    };

    return NextResponse.json(formattedResult);

  } catch (error) {
    console.error('Failed to fetch scoring details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch scoring details: ${errorMessage}` }, { status: 500 });
  }
} 