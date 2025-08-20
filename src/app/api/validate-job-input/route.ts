import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.0-flash-lite';

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log("Validation API received payload:", payload);
    
    const { roleName, industry } = payload;

    if (!roleName || !industry) {
      console.log("Validation API: Missing required fields:", { roleName, industry });
      return NextResponse.json({ error: 'roleName and industry are required in the JSON payload' }, { status: 400 });
    }

    const prompt = `
You are a job validation expert. Your task is to determine if the provided job role and industry combination represents a legitimate, real-world job position.

Job Role: "${roleName}"
Industry: "${industry}"

Validation Criteria:
- The job role must be a real, recognized job title that exists in the professional world
- The role must be appropriate for the specified industry
- The role should not be nonsensical, fictional, inappropriate, or offensive
- Both role and industry must be in English and professionally relevant

Examples of INVALID inputs:
- Nonsensical roles: "raccoon picker", "clown jester", "unicorn trainer"
- Fictional roles: "wizard", "superhero", "dragon slayer"
- Inappropriate roles: offensive or unprofessional terms
- Non-existent combinations: "CEO" in "Mythical Creatures" industry

Examples of VALID inputs:
- "Software Engineer" in "Technology"
- "Marketing Manager" in "Retail"
- "Financial Analyst" in "Finance"
- "Nurse" in "Healthcare"

IMPORTANT: Respond with ONLY one word:
- "valid" if the job role and industry combination is legitimate
- "invalid" if the job role and/or industry is nonsensical, fictional, inappropriate, or not professionally relevant

Response:`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1, // Very low temperature for consistent validation
        maxOutputTokens: 10, // Only need one word response
      } as GenerationConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ]
    });

    const result = await model.generateContent(prompt);
    
    const response = result.response;
    const candidate = response.candidates && response.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      console.error("Gemini API returned an empty or malformed response for job validation.");
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${candidate.finishReason}.`;
        if (candidate.finishReason === 'SAFETY' && candidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(candidate.safetyRatings);
        }
        console.error(blockReason, candidate.safetyRatings);
        return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Gemini API returned no usable content for job validation.' }, { status: 500 });
    }
    
    const validationResult = candidate.content.parts[0].text.trim().toLowerCase();
    
    // Check if the result is valid
    const isValid = validationResult === 'valid';
    
    console.log(`Job validation result for "${roleName}" in "${industry}": ${validationResult}`);
    
    return NextResponse.json({
      success: true,
      isValid,
      validationResult,
      roleName,
      industry
    });

  } catch (error) {
    console.error('Error processing job validation request with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process job validation request', details: errorMessage }, { status: 500 });
  }
} 