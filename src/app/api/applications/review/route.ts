import { NextRequest, NextResponse } from 'next/server';
import { ResumeAssessment, GENERAL_SCORING_RUBRIC, SCORING_DIMENSIONS_CONFIG, AssessmentSection } from '@/types/resume-assessment';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Part } from '@google/generative-ai';
import { getFileStream } from '@/lib/storage'; // Import GCS utility
import { Readable } from 'stream'; // Import Readable for type hinting
import { EducationEntry, WorkExperienceEntry, OrgExperienceEntry } from '@/types/database';

// Helper function to convert Readable stream to Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Helper to format form data into a text block for the prompt (from assess-form route)
function formatCandidateDataForPrompt(data: CandidateFormData): string {
  let promptText = `Candidate Name: ${data.fullName}\n`;
  if (data.birthdate) promptText += `Date of Birth: ${data.birthdate}\n`;
  if (data.phone) promptText += `Phone: ${data.phone}\n`;
  if (data.jobInterest && data.jobInterest.length > 0) {
    promptText += `Job Interests/Keywords: ${data.jobInterest.join(', ')}\n`;
  }
  promptText += "\n--- Education ---\n";
  if (data.education && data.education.length > 0) {
    data.education.forEach(edu => {
      promptText += `- Level: ${edu.level || 'N/A'}, Institution: ${edu.institution || 'N/A'}, Major: ${edu.major || 'N/A'}\n`;
    });
  } else {
    promptText += "No education history provided.\n";
  }
  promptText += "\n--- Work Experience ---\n";
  if (data.workExperience && data.workExperience.length > 0) {
    data.workExperience.forEach(work => {
      promptText += `- Company: ${work.company || 'N/A'}, Position: ${work.position || 'N/A'}, Period: ${work.start_date || 'N/A'} to ${work.end_date || 'Present'}\n`;
    });
  } else {
    promptText += "No work experience provided.\n";
  }
  promptText += "\n--- Organization Experience ---\n";
  if (data.orgExperience && data.orgExperience.length > 0) {
    data.orgExperience.forEach(org => {
      promptText += `- Organization: ${org.organization_name || 'N/A'}, Role: ${org.role || 'N/A'}, Period: ${org.start_date || 'N/A'} to ${org.end_date || 'Present'}\n`;
    });
  } else {
    promptText += "No organization experience provided.\n";
  }
  return promptText;
}

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
  // We won't throw here to allow the app to build/start, but API calls will fail.
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.0-flash'; // Consistent model name

// Define the full Response Schema using string literals for types
const assessmentSectionSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "Concise summary for this section." },
    score: { type: "INTEGER", minimum: 1, maximum: 5, description: "Score from 1 to 5 based on the rubric for this section." }
  },
  required: ["summary", "score"]
};

// NEW: Schema for individual requirement check item
const requirementCheckItemSchema = {
  type: "OBJECT",
  properties: {
    requirement: { type: "STRING", description: "The exact requirement string that was evaluated." },
    status: { type: "STRING", enum: ["Yes", "No", "Unclear"], description: "Status of whether the candidate meets the requirement." },
    reasoning: { type: "STRING", description: "A brief explanation for the status (Yes, No, or Unclear)." }
  },
  required: ["requirement", "status", "reasoning"]
};

const fullResumeAssessmentResponseSchema = {
  type: "OBJECT",
  properties: {
    overallSummary: { type: "STRING", description: "A concise, overall summary of the entire assessment, highlighting key strengths and weaknesses based on all criteria and the provided job title/description." },
    experience: { ...assessmentSectionSchema, description: "Assessment of candidate's experience." },
    education: { ...assessmentSectionSchema, description: "Assessment of candidate's education." },
    skills: { ...assessmentSectionSchema, description: "Assessment of candidate's skills." },
    roleFit: { ...assessmentSectionSchema, description: "Assessment of candidate's fit for the role." },
    certifications: { ...assessmentSectionSchema, description: "Assessment of candidate's certifications." },
    projectImpact: { ...assessmentSectionSchema, description: "Assessment of candidate's project impact." },
    softSkills: { ...assessmentSectionSchema, description: "Assessment of candidate's soft skills." },
    requirementsCheck: { 
      type: "ARRAY", 
      description: "An array detailing the candidate\'s fulfillment of specific job requirements.",
      items: requirementCheckItemSchema 
    }
  },
  required: [
    "overallSummary", "experience", "education", "skills", "roleFit", 
    "certifications", "projectImpact", "softSkills",
    "requirementsCheck" // Make it required
  ]
};

interface CandidateFormData {
  fullName: string;
  email: string;
  birthdate?: string | null;
  phone?: string | null;
  jobInterest?: string[] | null;
  education?: EducationEntry[] | null;
  workExperience?: WorkExperienceEntry[] | null;
  orgExperience?: OrgExperienceEntry[] | null;
}

// Dynamic payload for the POST request
interface ReviewPayload {
  jobTitle: string; // Always required
  jobDescription?: string; // Optional, but recommended for better assessment
  jobId: string; // For context and linking, though not directly in prompt if jobDescription is full
  jobRequirements?: string[]; // NEW: Specific job requirements to check
  // Option 1: For PDF resume assessment
  gcsPath?: string;
  fileName?: string;
  mimeType?: string;
  // Option 2: For form data assessment
  candidateData?: CandidateFormData;
}

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload: ReviewPayload = await request.json();
    const { gcsPath, fileName, mimeType, candidateData, jobTitle, jobDescription, jobId, jobRequirements } = payload;

    if (!jobTitle || !jobId) {
      return NextResponse.json({ error: 'jobId and jobTitle are required.' }, { status: 400 });
    }

    if (!jobDescription) {
      return NextResponse.json({ error: 'jobDescription is required.' }, { status: 400 });
    }

    let inputPromptSection: string;
    let filePart: Part | undefined = undefined;
    const generationParts: (string | Part)[] = [];

    if (gcsPath && mimeType && fileName) {
      // Mode 1: Process GCS Resume File
      let resumeFileStream: Readable;
      try {
        resumeFileStream = await getFileStream(gcsPath);
      } catch (gcsError: any) {
        console.error(`Failed to get file stream from GCS for path ${gcsPath}:`, gcsError);
        return NextResponse.json({ error: 'Failed to retrieve resume from storage.', details: gcsError.message }, { status: 500 });
      }
      const resumeBuffer = await streamToBuffer(resumeFileStream);
      const resumeBase64 = resumeBuffer.toString('base64');
      filePart = {
        inlineData: {
          data: resumeBase64,
          mimeType: mimeType,
        },
      };
      inputPromptSection = "Resume:\n[Attached separately]";
      generationParts.push(filePart); // Add file part for generation if present
    } else if (candidateData) {
      // Mode 2: Process Form Data
      if (!candidateData.fullName) { // Basic validation for candidateData
          return NextResponse.json({ error: 'Candidate full name is required when submitting form data.'}, {status: 400});
      }
      inputPromptSection = `Candidate Information (from application form):\n---\n${formatCandidateDataForPrompt(candidateData)}\n---`;
    } else {
      return NextResponse.json({ error: 'Either GCS file details (gcsPath, fileName, mimeType) or candidateData must be provided.' }, { status: 400 });
    }

    const dimensionInstructions = SCORING_DIMENSIONS_CONFIG.map(dim => {
      return `
Section: ${dim.displayName} (JSON key: ${dim.id})
Description: ${dim.descriptionForLLM}
Criteria for a score of 5: ${dim.score5Criteria}
`;
    }).join('\n\n');
    
    // Use provided jobDescription directly; do not fall back to DUMMY_JOB_DESCRIPTION
    const effectiveJobDescription = jobDescription;

    // NEW: Section for requirements check in the prompt
    let requirementsPromptSection = "";
    if (jobRequirements && jobRequirements.length > 0) {
      const requirementsList = jobRequirements.map(req => `- "${req}"`).join('\n');
      requirementsPromptSection = `

Specific Job Requirements Evaluation:
Based on the candidate information and the job description, evaluate each of the following specific job requirements. For each requirement, provide a "status" of "Yes", "No", or "Unclear", and a brief "reasoning".

Requirements to evaluate:
${requirementsList}

Return this evaluation in the "requirementsCheck" array, where each item is an object: { "requirement": "<The original requirement string>", "status": "<Yes/No/Unclear>", "reasoning": "<Your brief reasoning>" }.
`;
    }

    const prompt = `
You are an expert resume screening assistant OR an expert candidate application form evaluator.
Your task is to assess the provided candidate information (either from a resume or a form) against the following job description/title AND evaluate specific job requirements.
Provide a structured JSON output strictly adhering to the defined schema.

Job Description/Details:
---
${effectiveJobDescription}
---

${inputPromptSection}
${requirementsPromptSection}

First, provide an "overallSummary". This should be a concise paragraph (3-5 sentences) summarizing the candidate\'s suitability for the role based on their provided information, highlighting key strengths and weaknesses against the job description and detailed criteria.

Then, for each of the following sections (Experience, Education, Skills, Role Fit, Certifications, Project Impact, Soft Skills), provide:
1. A concise summary for that specific section.
2. A score from 1 to 5 for that section, based on the general rubric and specific criteria provided below.

General Scoring Rubric (1-5 Scale):
---
${GENERAL_SCORING_RUBRIC}
---

Detailed Assessment Criteria for Each Section:
---
${dimensionInstructions}
---

Please return a JSON object that strictly adheres to the defined assessment structure for ALL sections requested in the schema, including the "requirementsCheck" array if specific requirements were provided.
The JSON response must start with the "overallSummary" field, followed by the individual criteria sections.
The required JSON structure for each assessment section (e.g., "experience", "education", etc.) is:
{ "summary": "string", "score": integer (1-5 based on the rubric and criteria) }
Ensure the top-level "overallSummary" field and all specified section objects are present in your JSON response. If a section cannot be assessed due to lack of data, state that in the summary for that section and assign a score of 1.
`;
    
    generationParts.unshift(prompt); // Add prompt as the first part

    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: fullResumeAssessmentResponseSchema,
        } as GenerationConfig,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
    });

    const result = await model.generateContent(generationParts);
    
    const response = result.response;
    const genCandidate = response.candidates && response.candidates[0]; // Renamed to avoid conflict with our 'candidateData'

    if (!genCandidate || !genCandidate.content || !genCandidate.content.parts || !genCandidate.content.parts[0] || !genCandidate.content.parts[0].text) {
        console.error("Gemini API returned an empty or malformed response.");
        if (genCandidate && genCandidate.finishReason && genCandidate.finishReason !== 'STOP') {
            let blockReason = `Generation stopped due to: ${genCandidate.finishReason}.`;
            if (genCandidate.finishReason === 'SAFETY' && genCandidate.safetyRatings) {
                blockReason += " Details: " + JSON.stringify(genCandidate.safetyRatings);
            }
            console.error(blockReason, genCandidate.safetyRatings);
            return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
        }
        return NextResponse.json({ error: 'Gemini API returned no usable content.' }, { status: 500 });
    }
    
    const assessmentText = genCandidate.content.parts[0].text;
    let assessmentResult: ResumeAssessment;
    try {
        assessmentResult = JSON.parse(assessmentText) as ResumeAssessment;
        
        SCORING_DIMENSIONS_CONFIG.forEach(dimConfig => {
            const key = dimConfig.id; // type of key is Omit<..., 'requirementsCheck'>
            // Ensure the property exists and is an object with score and summary (i.e., an AssessmentSection)
            const section = assessmentResult[key] as AssessmentSection; // Explicit cast for clarity within this block
            if (!section || typeof section.score !== 'number' || typeof section.summary !== 'string') {
                console.warn(`Gemini response missing or has invalid structure for section: ${key}. Applying default.`);
                assessmentResult[key] = {
                    summary: `${dimConfig.displayName}: Not explicitly assessed or missing from provided data.`,
                    score: 1 as AssessmentSection['score']
                };
            }
        });

        // Default handling for requirementsCheck (remains the same, and is correct)
        if (!assessmentResult.requirementsCheck && jobRequirements && jobRequirements.length > 0) {
            console.warn('Gemini response missing requirementsCheck. Initializing with unclear status.');
            assessmentResult.requirementsCheck = jobRequirements.map(req => ({
                requirement: req,
                status: "Unclear",
                reasoning: "Assessment for this specific requirement was not explicitly provided by the AI."
            }));
        } else if (!assessmentResult.requirementsCheck) {
            assessmentResult.requirementsCheck = [];
        }

    } catch (parseError) {
        console.error("Failed to parse Gemini API JSON response:", parseError);
        console.error("Raw response from Gemini:", assessmentText);
        return NextResponse.json({ error: 'Failed to parse assessment from Gemini API. Raw response logged.', details: assessmentText }, { status: 500 });
    }

    return NextResponse.json(assessmentResult);

  } catch (error) {
    console.error('Error processing review request with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process review request with Gemini API', details: errorMessage }, { status: 500 });
  }
} 
