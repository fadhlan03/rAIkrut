import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { candidates as candidatesTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EducationEntry, WorkExperienceEntry, OrgExperienceEntry } from '@/types/database';

interface ManualCandidatePayload {
  fullName: string;
  email: string;
  phone?: string | null;
  birthdate?: string | null; // Expected format: YYYY-MM-DD
  jobInterest?: string[] | null;
  education?: EducationEntry[] | null;
  workExperience?: WorkExperienceEntry[] | null;
  orgExperience?: OrgExperienceEntry[] | null;
}

export async function POST(request: NextRequest) {
  try {
    const payload: ManualCandidatePayload = await request.json();
    const { 
      fullName, 
      email, 
      phone, 
      birthdate, 
      jobInterest, 
      education, 
      workExperience, 
      orgExperience 
    } = payload;

    if (!fullName || !email) {
      return NextResponse.json({ error: 'Full name and email are required.' }, { status: 400 });
    }

    // Prepare data for insertion/update, ensuring null for undefined optional fields
    const candidateData = {
      fullName,
      email,
      phone: phone || null,
      birthdate: birthdate || null, // Will be stored as string 'YYYY-MM-DD'
      jobInterest: jobInterest || null,
      education: education || null,
      workExperience: workExperience || null,
      orgExperience: orgExperience || null,
    };

    // Check if candidate exists
    const existingCandidates = await db.select()
      .from(candidatesTable)
      .where(eq(candidatesTable.email, email))
      .limit(1);

    let savedCandidate;

    if (existingCandidates.length > 0) {
      // Update existing candidate
      const existingCandidateId = existingCandidates[0].id;
      const updatedResult = await db.update(candidatesTable)
        .set(candidateData)
        .where(eq(candidatesTable.id, existingCandidateId))
        .returning();
      if (updatedResult.length > 0) {
        savedCandidate = updatedResult[0];
        console.log(`Updated candidate with ID: ${savedCandidate.id}`);
      } else {
        throw new Error('Failed to update existing candidate.');
      }
    } else {
      // Create new candidate
      const newCandidateId = uuidv4();
      const insertedResult = await db.insert(candidatesTable)
        .values({ ...candidateData, id: newCandidateId })
        .returning();
      if (insertedResult.length > 0) {
        savedCandidate = insertedResult[0];
        console.log(`Created new candidate with ID: ${savedCandidate.id}`);
      } else {
        throw new Error('Failed to create new candidate.');
      }
    }

    return NextResponse.json(
      { 
        message: 'Candidate data saved successfully.', 
        candidate: savedCandidate 
      }, 
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error saving candidate data:', error);
    return NextResponse.json({ error: 'Failed to save candidate data.', details: error.message }, { status: 500 });
  }
} 