import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Part } from '@google/generative-ai';
import { db } from '@/lib/db-client';
import { jobVacancies } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.5-flash-lite';

// Define the structured output schema for bulk processing
const bulkProcessResponseSchema = {
  type: "OBJECT",
  properties: {
    candidateInfo: {
      type: "OBJECT",
      description: "Extracted candidate information",
      properties: {
        fullName: { type: "STRING", description: "Candidate's full name" },
        email: { type: "STRING", description: "Candidate's email address" },
        phone: { type: "STRING", description: "Candidate's phone number" },
        summary: { type: "STRING", description: "Brief professional summary of the candidate" }
      },
      required: ["fullName", "summary"]
    },
    evaluation: {
      type: "OBJECT",
      description: "Evaluation results against job requirements",
      properties: {
        overallScore: { 
          type: "NUMBER", 
          minimum: 1, 
          maximum: 5, 
          description: "Overall score from 1 to 5" 
        },
        overallSummary: { 
          type: "STRING", 
          description: "Brief summary of the candidate's fit for the role" 
        },
        requirementsCheck: {
          type: "ARRAY",
          description: "Evaluation against specific job requirements",
          items: {
            type: "OBJECT",
            properties: {
              requirement: { type: "STRING", description: "The specific requirement being evaluated" },
              status: { type: "STRING", enum: ["Yes", "No", "Unclear"], description: "Whether candidate meets this requirement" },
              score: { type: "NUMBER", minimum: 1, maximum: 5, description: "Score for this specific requirement" },
              reasoning: { type: "STRING", description: "Brief explanation for the evaluation" }
            },
            required: ["requirement", "status", "score", "reasoning"]
          }
        }
      },
      required: ["overallScore", "overallSummary", "requirementsCheck"]
    }
  },
  required: ["candidateInfo", "evaluation"]
};

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const jobId = formData.get('jobId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Validate file type
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

    // Get job details
    const jobResult = await db.select().from(jobVacancies).where(eq(jobVacancies.id, jobId)).limit(1);
    
    if (jobResult.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = jobResult[0];

    // Convert file to base64 for Gemini
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileBase64 = fileBuffer.toString('base64');
    const filePart: Part = {
      inlineData: {
        data: fileBase64,
        mimeType: file.type,
      },
    };

    // Prepare job requirements for the prompt
    const requirementsList = Array.isArray(job.requirements) 
      ? job.requirements 
      : (typeof job.requirements === 'string' ? [job.requirements] : []);

    const jobDescList = Array.isArray(job.job_desc) 
      ? job.job_desc 
      : (typeof job.job_desc === 'string' ? [job.job_desc] : []);

    // Create the evaluation prompt
    const prompt = `
You are an expert resume screening assistant.
Your task is to extract candidate information from the provided resume and evaluate their suitability for the specified job position.

Job Position: ${job.title}
Job Description: ${job.description}

Job Responsibilities:
${jobDescList.map(desc => `- ${desc}`).join('\n')}

Job Requirements:
${requirementsList.map(req => `- ${req}`).join('\n')}

Please analyze the attached resume and provide:

1. CANDIDATE INFORMATION:
   - Full Name
   - Email Address  
   - Phone Number
   - Professional Summary (2-3 sentences)

2. EVALUATION:
   - Overall Score (1-5 scale where 5 is excellent fit)
   - Overall Summary of candidate's suitability
   - Requirements Check: You MUST evaluate ALL ${requirementsList.length} job requirements listed above. For each specific requirement listed above, evaluate:
     * Whether the candidate meets the requirement (Yes/No/Unclear)
     * Score for that specific requirement (1-5)
     * Brief reasoning for the evaluation
   
   IMPORTANT: Your response must include exactly ${requirementsList.length} requirement evaluations, one for each requirement listed above in the same order.

Evaluation Criteria:
- Score 5: Exceptional - Candidate exceeds requirements significantly
- Score 4: Strong - Candidate clearly meets requirements with good evidence
- Score 3: Adequate - Candidate meets requirements with some evidence
- Score 2: Weak - Candidate partially meets requirements or unclear evidence
- Score 1: Poor - Candidate does not meet requirements

Resume:
[Attached separately]

Provide a structured JSON response adhering strictly to the defined schema.
`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: bulkProcessResponseSchema,
        temperature: 0,
      } as GenerationConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    const result = await model.generateContent([prompt, filePart]);
    
    const response = result.response;
    const candidate = response.candidates && response.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      console.error("Gemini API returned an empty or malformed response for bulk processing.");
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${candidate.finishReason}.`;
        if (candidate.finishReason === 'SAFETY' && candidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(candidate.safetyRatings);
        }
        console.error(blockReason, candidate.safetyRatings);
        return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Gemini API returned no usable content for bulk processing.' }, { status: 500 });
    }
    
    const extractedText = candidate.content.parts[0].text;
    
    let processedResult: any;
    try {
      processedResult = JSON.parse(extractedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini API JSON response for bulk processing:", parseError);
      console.error("Raw response from Gemini for bulk processing:", extractedText);
      return NextResponse.json({ 
        error: 'Failed to parse evaluation from Gemini API. Raw response logged.', 
        details: extractedText 
      }, { status: 500 });
    }

    // For prototype - skip database operations
    const candidateInfo = processedResult.candidateInfo;

    // Validate that we have the correct number of requirement evaluations
    const returnedRequirements = processedResult.evaluation.requirementsCheck || [];
    
    if (returnedRequirements.length !== requirementsList.length) {
      console.warn(`Expected ${requirementsList.length} requirement evaluations, got ${returnedRequirements.length}`);
      
      // Pad missing requirements or trim excess ones
      const normalizedRequirements = [];
      for (let i = 0; i < requirementsList.length; i++) {
        if (i < returnedRequirements.length) {
          // Use the returned requirement but ensure it matches the job requirement
          normalizedRequirements.push({
            requirement: requirementsList[i], // Use job requirement text for consistency
            score: returnedRequirements[i].score || 1,
            status: returnedRequirements[i].status || 'Unclear',
            reasoning: returnedRequirements[i].reasoning || 'Not evaluated'
          });
        } else {
          // Add missing requirement with default values
          normalizedRequirements.push({
            requirement: requirementsList[i],
            score: 1,
            status: 'Unclear',
            reasoning: 'Not evaluated by AI'
          });
        }
      }
      
      // Use normalized requirements
      processedResult.evaluation.requirementsCheck = normalizedRequirements;
    } else {
      // Ensure requirement text matches job requirements for consistency
      processedResult.evaluation.requirementsCheck = processedResult.evaluation.requirementsCheck.map((req: any, index: number) => ({
        requirement: requirementsList[index], // Use consistent requirement text
        score: req.score,
        status: req.status,
        reasoning: req.reasoning
      }));
    }

    // Format response for the frontend
    const formattedResponse = {
      candidateName: candidateInfo.fullName,
      email: candidateInfo.email || 'Unknown',
      scores: {
        overall: processedResult.evaluation.overallScore,
        requirements: processedResult.evaluation.requirementsCheck.map((req: any) => ({
          requirement: req.requirement,
          score: req.score,
          status: req.status,
          reasoning: req.reasoning
        }))
      },
      summary: processedResult.evaluation.overallSummary,
      fileName: file.name
    };

    return NextResponse.json(formattedResponse);

  } catch (error) {
    console.error('Error processing bulk resume request with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      error: 'Failed to process resume bulk request', 
      details: errorMessage 
    }, { status: 500 });
  }
} 