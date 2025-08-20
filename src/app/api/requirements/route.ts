import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.0-flash';

// Helper function to remove citation markers from text
function removeCitations(text: string): string {
  // Remove patterns like [1], [2, 3], [4, 13], etc.
  return text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '').trim();
}

// Helper function to clean citations from requirements data
function cleanRequirementsData(data: any): any {
  if (data && data.companies && Array.isArray(data.companies)) {
    return {
      ...data,
      companies: data.companies.map((company: any) => ({
        ...company,
        requirements: company.requirements?.map((req: string) => removeCitations(req)) || []
      }))
    };
  }
  return data;
}

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log("Requirements API received payload:", payload);
    
    const { roleName, industry } = payload;

    if (!roleName || !industry) {
      console.log("Requirements API validation failed:", { roleName, industry });
      return NextResponse.json({ error: 'roleName and industry are required in the JSON payload' }, { status: 400 });
    }

    // Guardrails: Validate input before proceeding
    const guardrailsPrompt = `
You are a job validation expert. Determine if "${roleName}" is a legitimate job role in the "${industry}" industry.

Guardrails: This prompt will only generate job requirements if the user input for ${roleName} matches a real, recognized job role (in English) within the context of ${industry}. If the input is a nonsensical phrase, a mythical creature, an inappropriate term, or anything not related to an actual job title, the output will be: "invalid role". The model will check for validity of ${roleName} before returning results.

Respond with only "valid" or "invalid role".
`;

    const guardrailsModel = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10,
      } as GenerationConfig,
    });

    const guardrailsResult = await guardrailsModel.generateContent(guardrailsPrompt);
    const guardrailsResponse = guardrailsResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    
    if (guardrailsResponse === "invalid role") {
      return NextResponse.json({ 
        error: 'Please Input Relevant Job Role & Industry',
        details: 'The provided job role or industry appears to be invalid or nonsensical.'
      }, { status: 400 });
    }

    const prompt = `
You are an expert HR and recruitment analyst with deep knowledge of job market trends and hiring requirements.

Your task is to research and provide comprehensive job requirements for the position "${roleName}" in the "${industry}" industry.

Please provide detailed job requirements from 4-5 top companies in the ${industry} industry. For each company, include:
- Company name
- A short logo abbreviation (2-4 characters)
- 6-8 specific, detailed requirements for the ${roleName} position at that company

Focus on REQUIREMENTS such as:
- Educational qualifications and degrees
- Years of experience needed
- Technical skills and certifications
- Soft skills and competencies
- Industry-specific knowledge requirements
- Language proficiency requirements
- Professional certifications needed
- Regulatory or compliance requirements

Make sure the requirements are:
- Current and reflective of 2024-2025 market standards
- Industry-specific and relevant
- Differentiated between companies (showing unique company preferences)
- Practical and realistic for the role level
- Include both mandatory and preferred qualifications

IMPORTANT: Please return your response in valid JSON format only. Do not include any text before or after the JSON. The structure should be:

{
  "companies": [
    {
      "company": "Company Name",
      "logo": "LOGO",
      "requirements": [
        "Requirement 1",
        "Requirement 2",
        ...
      ]
    }
  ]
}
`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      } as GenerationConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      tools: [
        {
          googleSearch: {}
        } as any
      ]
    });

    const result = await model.generateContent(prompt);
    
    const response = result.response;
    const candidate = response.candidates && response.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      console.error("Gemini API returned an empty or malformed response for role requirements.");
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${candidate.finishReason}.`;
        if (candidate.finishReason === 'SAFETY' && candidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(candidate.safetyRatings);
        }
        console.error(blockReason, candidate.safetyRatings);
        return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Gemini API returned no usable content for role requirements.' }, { status: 500 });
    }
    
    const extractedText = candidate.content.parts[0].text;
    
    let requirementsData: any;
    try {
      // Try to parse the response as JSON directly
      requirementsData = JSON.parse(extractedText);
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON from the text
      try {
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          requirementsData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (secondParseError) {
        console.error("Failed to parse Gemini API JSON response for role requirements:", parseError);
        console.error("Raw response from Gemini for role requirements:", extractedText);
        return NextResponse.json({ 
          error: 'Failed to parse requirements data from Gemini API. Please try again.', 
          details: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
        }, { status: 500 });
      }
    }

    // Validate the structure
    if (!requirementsData || !requirementsData.companies || !Array.isArray(requirementsData.companies)) {
      console.error("Invalid requirements data structure:", requirementsData);
      return NextResponse.json({ 
        error: 'Invalid data structure received from AI. Please try again.',
        details: 'Expected companies array not found'
      }, { status: 500 });
    }

    // Clean citation markers from the data
    const cleanedData = cleanRequirementsData(requirementsData);

    console.log("Successfully generated role requirements data for:", roleName, "in", industry);
    
    return NextResponse.json({
      success: true,
      data: cleanedData,
      roleName,
      industry
    });

  } catch (error) {
    console.error('Error processing role requirements request with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process role requirements request', details: errorMessage }, { status: 500 });
  }
} 