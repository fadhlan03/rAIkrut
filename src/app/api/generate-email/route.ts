import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.0-flash';

interface EmailGenerationPayload {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  overallScore: number;
  overallSummary: string;
  decision?: string;
  experienceScore: number;
  experienceReview?: string;
  educationScore: number;
  educationReview?: string;
  skillsScore: number;
  skillsReview?: string;
  roleFitScore: number;
  roleFitReview?: string;
}

const emailResponseSchema = {
  type: "OBJECT",
  properties: {
    subject: { 
      type: "STRING", 
      description: "Email subject line that is professional and informative" 
    },
    body: { 
      type: "STRING", 
      description: "Email body content that is professional, personalized, and constructive" 
    }
  },
  required: ["subject", "body"]
};

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload: EmailGenerationPayload = await request.json();
    const {
      candidateName,
      candidateEmail,
      jobTitle,
      overallScore,
      overallSummary,
      decision,
      experienceScore,
      experienceReview,
      educationScore,
      educationReview,
      skillsScore,
      skillsReview,
      roleFitScore,
      roleFitReview,
    } = payload;

    if (!candidateName || !jobTitle || overallScore === undefined) {
      return NextResponse.json({ error: 'Missing required fields: candidateName, jobTitle, or overallScore' }, { status: 400 });
    }

    // Determine if this is a positive or negative outcome
    const isPositiveOutcome = overallScore >= 3.0;
    const outcomeType = isPositiveOutcome ? "positive" : "constructive";

    // Identify key areas for feedback based on scores
    const feedbackAreas = [];
    if (experienceScore < 3.0 && experienceReview) {
      feedbackAreas.push({ area: "experience", review: experienceReview });
    }
    if (educationScore < 3.0 && educationReview) {
      feedbackAreas.push({ area: "education", review: educationReview });
    }
    if (skillsScore < 3.0 && skillsReview) {
      feedbackAreas.push({ area: "skills", review: skillsReview });
    }
    if (roleFitScore < 3.0 && roleFitReview) {
      feedbackAreas.push({ area: "role fit", review: roleFitReview });
    }

    // Identify strengths for positive outcomes
    const strengths = [];
    if (experienceScore >= 3.5 && experienceReview) {
      strengths.push({ area: "experience", review: experienceReview });
    }
    if (educationScore >= 3.5 && educationReview) {
      strengths.push({ area: "education", review: educationReview });
    }
    if (skillsScore >= 3.5 && skillsReview) {
      strengths.push({ area: "skills", review: skillsReview });
    }
    if (roleFitScore >= 3.5 && roleFitReview) {
      strengths.push({ area: "role fit", review: roleFitReview });
    }

    const prompt = `
You are an HR professional writing a personalized email to a job candidate about their application results.

Generate a professional, empathetic, and ${outcomeType} email based on the following information:

**Candidate Information:**
- Name: ${candidateName}
- Applied for: ${jobTitle}
- Decision: ${decision || "Under review"}

**Assessment Summary:**
${overallSummary}

${isPositiveOutcome && strengths.length > 0 ? `**Key Strengths Identified:**
${strengths.map(s => `- ${s.area}: ${s.review}`).join('\n')}
` : ''}

${!isPositiveOutcome && feedbackAreas.length > 0 ? `**Areas for Development:**
${feedbackAreas.map(f => `- ${f.area}: ${f.review}`).join('\n')}
` : ''}

**Email Guidelines:**
1. **Subject Line**: Should be clear, professional, and indicate this is about their application
2. **Email Body**: 
   - Start with a warm, professional greeting
   - Thank them for their interest and time
   ${isPositiveOutcome ? 
     `- Congratulate them and mention next steps (interview scheduling, etc.)
      - Briefly mention their key strengths without detailed scores
      - Be encouraging and positive about their qualifications` :
     `- Deliver the news respectfully and constructively
      - Provide relevant feedback focusing on main areas for improvement
      - Encourage future applications and professional development
      - Be supportive and maintain their interest in the company`}
   - Use the candidate's name naturally throughout
   - Keep a professional but warm tone
   - End with appropriate next steps or encouragement
   - Include a professional signature line placeholder

**Important Notes:**
- DO NOT include numerical scores or detailed assessment breakdowns
- Focus on relevant qualitative feedback and reasons for the decision
- Make the email personal but concise
- Be honest but constructive in feedback
- Maintain the company's professional image
- Keep the email concise (250-400 words)
- Do not include placeholder text like [Company Name] - write as if from a real company

Generate both a subject line and email body that follows these guidelines.
`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: emailResponseSchema,
      } as GenerationConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    const result = await model.generateContent([prompt]);
    const response = result.response;
    const candidate = response.candidates && response.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      console.error("Gemini API returned an empty or malformed response.");
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${candidate.finishReason}.`;
        if (candidate.finishReason === 'SAFETY' && candidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(candidate.safetyRatings);
        }
        console.error(blockReason, candidate.safetyRatings);
        return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Gemini API returned no usable content.' }, { status: 500 });
    }

    const emailText = candidate.content.parts[0].text;
    let emailResult;
    try {
      emailResult = JSON.parse(emailText);
    } catch (parseError) {
      console.error("Failed to parse Gemini API JSON response:", parseError);
      console.error("Raw response from Gemini:", emailText);
      return NextResponse.json({ error: 'Failed to parse email content from Gemini API.' }, { status: 500 });
    }

    return NextResponse.json(emailResult);

  } catch (error) {
    console.error('Error generating email content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to generate email content', details: errorMessage }, { status: 500 });
  }
}