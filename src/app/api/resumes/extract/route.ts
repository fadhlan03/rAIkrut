import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Part } from '@google/generative-ai';
import { getFileStream } from '@/lib/storage'; // Import GCS utility
import { Readable } from 'stream'; // Import Readable for type hinting
import { db } from '@/lib/db-client'; // Import database client
import { candidates } from '@/db/schema'; // Import candidates table schema
import { eq } from 'drizzle-orm'; // For database query conditions

// Helper function to convert Readable stream to Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.0-flash'; // Or your preferred model

// Define the Response Schema for Profile Extraction
const extractedProfileResponseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "A brief summary of the candidate's profile." },
    personalInfo: {
      type: "OBJECT",
      description: "Candidate's personal information.",
      properties: {
        dateOfBirth: { type: "STRING", description: "Date of birth (e.g., YYYY-MM-DD). Extract if available, otherwise omit." },
        phone: { type: "STRING", description: "Contact phone number. Extract if available, otherwise omit." },
        email: { type: "STRING", description: "Contact email address. Extract if available, otherwise omit." }
      }
    },
    jobInterests: {
      type: "ARRAY",
      description: "List of job interests or roles the candidate is looking for. Extract if explicitly stated, otherwise omit or provide an empty array.",
      items: { type: "STRING" }
    },
    education: {
      type: "OBJECT",
      description: "Details of the highest completed or most relevant education.",
      properties: {
        highestDegree: { type: "STRING", description: "Highest degree obtained (e.g., Bachelor's, Master's). Extract if available, otherwise omit." },
        institution: { type: "STRING", description: "Name of the educational institution. Extract if available, otherwise omit." },
        major: { type: "STRING", description: "Major or field of study. Extract if available, otherwise omit." }
      }
    },
    workExperience: {
      type: "ARRAY",
      description: "List of work experiences. Extract key details for each.",
      items: {
        type: "OBJECT",
        properties: {
          company: { type: "STRING", description: "Company name." },
          position: { type: "STRING", description: "Job position or title." },
          period: { type: "STRING", description: "Employment period (e.g., YYYY-MM to YYYY-MM or Present)." }
        },
        required: ["company", "position", "period"]
      }
    },
    organizationExperience: {
      type: "ARRAY",
      description: "List of organizational experiences. Extract key details for each.",
      items: {
        type: "OBJECT",
        properties: {
          organizationName: { type: "STRING", description: "Name of the organization." },
          role: { type: "STRING", description: "Role or position in the organization." },
          period: { type: "STRING", description: "Period of involvement (e.g., YYYY-MM to YYYY-MM)." }
        },
        required: ["organizationName", "role", "period"]
      }
    },
    skills: {
      type: "ARRAY",
      description: "List of key skills possessed by the candidate. Extract if available, otherwise omit or provide an empty array.",
      items: { type: "STRING" }
    }
  },
  // Define which fields are absolutely required at the top level.
  // Other fields are optional and should be omitted by the LLM if not found.
  required: ["summary"] 
};


export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log("Extract API received payload:", payload);
    
    const { gcsPath, fileName, mimeType, candidateId } = payload;

    if (!gcsPath || !mimeType || !fileName) {
      console.log("Extract API validation failed:", { gcsPath, fileName, mimeType });
      return NextResponse.json({ error: 'gcsPath, mimeType, and fileName are required in the JSON payload' }, { status: 400 });
    }

    if (!candidateId) {
      console.log("Extract API validation failed: missing candidateId");
      return NextResponse.json({ error: 'candidateId is required to update the candidate record' }, { status: 400 });
    }

    let resumeFileStream: Readable;
    try {
      resumeFileStream = await getFileStream(gcsPath);
    } catch (gcsError: any) {
      console.error(`Failed to get file stream from GCS for path ${gcsPath}:`, gcsError);
      return NextResponse.json({ error: 'Failed to retrieve resume from storage.', details: gcsError.message }, { status: 500 });
    }

    const resumeBuffer = await streamToBuffer(resumeFileStream);
    const resumeBase64 = resumeBuffer.toString('base64');

    const resumeFilePart: Part = {
      inlineData: {
        data: resumeBase64,
        mimeType: mimeType,
      },
    };

    const prompt = `
You are an expert resume parsing assistant.
Your task is to extract specific information from the provided resume.
Provide a structured JSON output strictly adhering to the defined schema.

Extract the following details:
- Overall Summary: A brief (1-2 sentences) professional summary of the candidate.
- Personal Info:
  - Date of Birth (if explicitly stated, format YYYY-MM-DD)
  - Phone Number
  - Email Address
- Job Interests: A list of roles or job titles the candidate is interested in (if explicitly mentioned).
- Education:
  - Highest Degree Achieved
  - Institution Name
  - Major/Field of Study
- Work Experience: For each relevant position:
  - Company Name
  - Job Position/Title
  - Employment Period (e.g., YYYY-MM to YYYY-MM, or YYYY-MM to Present)
- Organization Experience: For each relevant organization:
  - Organization Name
  - Role/Position
  - Period of Involvement
- Skills: A list of key technical or soft skills.

Resume:
[Attached separately]

Instructions for JSON output:
- Adhere strictly to the provided JSON schema.
- If a piece of information is not found in the resume, omit the field entirely if it's optional (e.g. personalInfo.dateOfBirth), or provide an empty string/array if the field itself is required but its content isn't (e.g. if 'skills' array is asked for but none found, return 'skills: []').
- For dates or periods, try to be consistent with formatting (e.g., YYYY-MM-DD or YYYY-MM to YYYY-MM).
- The 'summary' field at the root is mandatory. Other top-level fields like 'personalInfo', 'education', etc., should be included if any sub-information is found, otherwise they can be omitted if all their sub-fields would be empty.

Return a JSON object that strictly adheres to the defined schema.
`;

    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: extractedProfileResponseSchema,
        } as GenerationConfig,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
    });

    const result = await model.generateContent([prompt, resumeFilePart]);
    
    const response = result.response;
    const candidate = response.candidates && response.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      console.error("Gemini API returned an empty or malformed response for profile extraction.");
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
          let blockReason = `Generation stopped due to: ${candidate.finishReason}.`;
          if (candidate.finishReason === 'SAFETY' && candidate.safetyRatings) {
              blockReason += " Details: " + JSON.stringify(candidate.safetyRatings);
          }
          console.error(blockReason, candidate.safetyRatings);
          return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Gemini API returned no usable content for profile extraction.' }, { status: 500 });
    }
    
    const extractedText = candidate.content.parts[0].text;
    
    let extractedProfile: any; // Define based on your ExtractedProfile interface in the frontend
    try {
        extractedProfile = JSON.parse(extractedText);
    } catch (parseError) {
        console.error("Failed to parse Gemini API JSON response for profile extraction:", parseError);
        console.error("Raw response from Gemini for profile extraction:", extractedText);
        return NextResponse.json({ error: 'Failed to parse extracted profile from Gemini API. Raw response logged.', details: extractedText }, { status: 500 });
    }

    // Save extracted profile data to the candidates table
    try {
      console.log(`Updating candidate with ID ${candidateId} with extracted profile data`);
      
      // Map extracted profile data to database schema
      const updateData: any = {
        summary: extractedProfile.summary,
      };
      
      // Add birthdate if available
      if (extractedProfile.personalInfo?.dateOfBirth) {
        updateData.birthdate = extractedProfile.personalInfo.dateOfBirth;
      }
      
      // Add phone if available
      if (extractedProfile.personalInfo?.phone) {
        updateData.phone = extractedProfile.personalInfo.phone;
      }
      
      // Add job interests if available
      if (extractedProfile.jobInterests && extractedProfile.jobInterests.length > 0) {
        updateData.jobInterest = extractedProfile.jobInterests;
      }
      
      // Add education if available
      if (extractedProfile.education) {
        // Map to EducationEntry[] format
        updateData.education = [{
          level: extractedProfile.education.highestDegree || '',
          institution: extractedProfile.education.institution || '',
          major: extractedProfile.education.major || ''
        }];
      }
      
      // Add work experience if available
      if (extractedProfile.workExperience && extractedProfile.workExperience.length > 0) {
        // Map to WorkExperienceEntry[] format
        updateData.workExperience = extractedProfile.workExperience.map((work: any) => {
          // Parse period to get start_date and end_date (assuming format "YYYY-MM to YYYY-MM" or "YYYY-MM to Present")
          const periodParts = work.period.split(' to ');
          return {
            company: work.company,
            position: work.position,
            start_date: periodParts[0] || '',
            end_date: periodParts.length > 1 ? periodParts[1] : 'Present'
          };
        });
      }
      
      // Add organization experience if available
      if (extractedProfile.organizationExperience && extractedProfile.organizationExperience.length > 0) {
        // Map to OrgExperienceEntry[] format
        updateData.orgExperience = extractedProfile.organizationExperience.map((org: any) => {
          // Parse period to get start_date and end_date
          const periodParts = org.period.split(' to ');
          return {
            organization_name: org.organizationName,
            role: org.role,
            start_date: periodParts[0] || '',
            end_date: periodParts.length > 1 ? periodParts[1] : 'Present'
          };
        });
      }
      
      // Update the candidate record in the database
      await db.update(candidates)
        .set(updateData)
        .where(eq(candidates.id, candidateId));
      
      console.log(`Successfully updated candidate ${candidateId} with extracted profile data`);
      
      // Return the extracted profile along with a success message
      return NextResponse.json({
        message: 'Profile extracted and saved to database successfully',
        profile: extractedProfile,
        candidateId
      });
      
    } catch (dbError: any) {
      console.error('Error saving extracted profile to database:', dbError);
      // Return the extracted profile but with a warning about database saving
      return NextResponse.json({
        warning: 'Profile extracted successfully but could not be saved to database',
        error: dbError.message,
        profile: extractedProfile
      }, { status: 207 }); // 207 Multi-Status: partial success
    }

  } catch (error) {
    console.error('Error processing resume for profile extraction with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process resume for profile extraction', details: errorMessage }, { status: 500 });
  }
} 
