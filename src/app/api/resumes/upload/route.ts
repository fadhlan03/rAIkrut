import { NextRequest, NextResponse } from 'next/server';
import { storeFile } from '@/lib/storage'; // Ensure this path is correct
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db-client'; // Import database client
import { resumes as resumesTable, candidates as candidatesTable } from '@/db/schema'; // Import resumes and candidates table schema
import { eq } from 'drizzle-orm';

// Helper function to get or create a candidate
const getOrCreateCandidate = async (email: string, fullName: string): Promise<{ id: string; email: string; fullName: string; phone?: string | null } | null> => {
  try {
    const existingCandidates = await db.select().from(candidatesTable).where(eq(candidatesTable.email, email)).limit(1);

    if (existingCandidates.length > 0) {
      // Optionally update fullName if it differs, or just return existing
      if (existingCandidates[0].fullName !== fullName && fullName) {
        // Consider if updating fullName here is desired, or if the first name captured is permanent.
        // For now, let's assume we might want to update it if a new name is provided for an existing email.
        const updatedCandidate = await db.update(candidatesTable)
          .set({ fullName })
          .where(eq(candidatesTable.id, existingCandidates[0].id))
          .returning();
        if (updatedCandidate.length > 0) return updatedCandidate[0];
      }
      return existingCandidates[0];
    } else {
      // Create a new candidate
      const newCandidateId = uuidv4();
      const newCandidateData = {
        id: newCandidateId,
        fullName: fullName || "New Applicant", // Fallback if fullName is somehow empty
        email: email,
        // phone will be handled by the main application submission API
      };
      const insertedCandidates = await db.insert(candidatesTable).values(newCandidateData).returning();
      if (insertedCandidates.length > 0) {
        console.log(`Created new candidate with ID: ${insertedCandidates[0].id}`);
        return insertedCandidates[0];
      } else {
        console.error('Failed to create new candidate or retrieve its ID.');
        return null;
      }
    }
  } catch (dbError: any) {
    console.error('Error getting or creating candidate:', dbError);
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;
    const applicantEmail = formData.get('email') as string | null;
    const applicantFullName = formData.get('fullName') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 });
    }
    if (!applicantEmail || !applicantFullName) {
      return NextResponse.json({ error: 'Applicant email and full name are required' }, { status: 400 });
    }

    const candidate = await getOrCreateCandidate(applicantEmail, applicantFullName);
    if (!candidate || !candidate.id) {
      return NextResponse.json({ error: 'Could not process candidate information' }, { status: 500 });
    }
    const candidateId = candidate.id;

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files and images (JPG, PNG, WebP) are accepted.' },
        { status: 415 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const destinationFolder = 'resumes';
    const gcsObjectPath = await storeFile(fileBuffer, file.name, destinationFolder);

    let resumeRecordId: string | null = null;
    try {
      const newResumeId = uuidv4();
      const resumeData = {
        id: newResumeId,
        candidateId: candidateId,
        fileUrl: gcsObjectPath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        parsedContent: {},
      };
      
      const insertedResume = await db.insert(resumesTable).values(resumeData).returning({ id: resumesTable.id });
      
      if (insertedResume && insertedResume.length > 0 && insertedResume[0].id) {
        resumeRecordId = insertedResume[0].id;
        console.log(`Resume metadata saved to DB with ID: ${resumeRecordId} for candidate ID: ${candidateId}`);
      } else {
        console.error('Resume metadata DB insert successful but no ID returned.');
      }
    } catch (dbError: any) {
      console.error('Error saving resume metadata to DB:', dbError);
      return NextResponse.json(
        {
          message: 'Resume uploaded to GCS, but failed to save metadata to database.',
          gcsPath: gcsObjectPath,
          fileName: file.name,
          fileSize: file.size,
          error: 'Database operation failed',
          details: dbError.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Resume uploaded successfully and metadata saved',
        gcsPath: gcsObjectPath,
        fileName: file.name,
        fileSize: file.size,
        resumeId: resumeRecordId,
        candidateId: candidateId, // Crucially, return candidateId
        applicantEmail: candidate.email, // Return a consistent email
        applicantFullName: candidate.fullName // Return a consistent name
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error uploading resume:', error);
    if (error.message.includes('GCS_BUCKET_NAME')) {
        return NextResponse.json({ error: 'Server configuration error regarding file storage.' }, { status: 500 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
} 