import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { jobVacancies as jobVacanciesTable, departments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await db
      .select({
        id: jobVacanciesTable.id,
        createdAt: jobVacanciesTable.createdAt,
        createdBy: jobVacanciesTable.createdBy,
        title: jobVacanciesTable.title,
        description: jobVacanciesTable.description,
        job_desc: jobVacanciesTable.job_desc,
        requirements: jobVacanciesTable.requirements,
        benefits: jobVacanciesTable.benefits,
        info: jobVacanciesTable.info,
        status: jobVacanciesTable.status,
        industry: jobVacanciesTable.industry,
        attribute: jobVacanciesTable.attribute,
        deptId: jobVacanciesTable.deptId,
        jobFamily: jobVacanciesTable.jobFamily,
        departmentName: departments.name,
      })
      .from(jobVacanciesTable)
      .leftJoin(departments, eq(jobVacanciesTable.deptId, departments.id))
      .where(eq(jobVacanciesTable.id, id))
      .limit(1);

    if (job.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Map to ensure consistent casing with JobVacancy type if needed, though drizzle might return correct casing
    const jobData = {
      id: job[0].id,
      created_at: job[0].createdAt,
      created_by: job[0].createdBy,
      title: job[0].title,
      description: job[0].description,
      job_desc: job[0].job_desc,
      requirements: job[0].requirements,
      benefits: job[0].benefits,
      info: job[0].info,
      status: job[0].status,
      industry: job[0].industry,
      attribute: job[0].attribute,
      deptId: job[0].deptId,
      jobFamily: job[0].jobFamily,
      departmentName: job[0].departmentName,
    };

    return NextResponse.json(jobData);
  } catch (error) {
    console.error('Failed to fetch job details:', error);
    return NextResponse.json({ error: 'Failed to fetch job details' }, { status: 500 });
  }
}