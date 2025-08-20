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

// API key validation using environment variable
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    console.error('API_KEY not configured in environment variables');
    return false;
  }
  
  return apiKey === validApiKey;
}

// Rate limiting helper (simplified - in production use Redis/database)
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const clientData = rateLimiter.get(clientId);
  
  if (!clientData || now > clientData.resetTime) {
    rateLimiter.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (clientData.count >= limit) {
    return false;
  }
  
  clientData.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // API Key validation
    if (!validateApiKey(request)) {
      return NextResponse.json({ 
        error: 'Authentication required', 
        message: 'Please provide a valid API key in x-api-key header' 
      }, { status: 401 });
    }

    // Rate limiting
    const clientId = request.headers.get('x-api-key') || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded', 
        message: 'Too many requests. Please try again later.' 
      }, { status: 429 });
    }

    // Gemini API check
    if (!genAI) {
      return NextResponse.json({ 
        error: 'Service unavailable', 
        message: 'AI service is not configured properly' 
      }, { status: 503 });
    }

    const { roleName, industry } = await request.json();

    if (!roleName || !industry) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        message: 'Role name and industry are required' 
      }, { status: 400 });
    }

    console.log(`[API v1] Generating requirements for role: ${roleName} in industry: ${industry}`);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
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

Return your response as a JSON object with this exact structure:
{
  "companies": [
    {
      "company": "Company Name",
      "logo": "LOGO",
      "requirements": [
        "Requirement 1",
        "Requirement 2",
        "Requirement 3",
        "Requirement 4",
        "Requirement 5",
        "Requirement 6"
      ]
    }
  ]
}

Make sure to provide real, current requirements based on actual job postings and industry standards.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    if (!response) {
      console.error("[API v1] No response received from Gemini API for requirements");
      return NextResponse.json({ 
        error: 'AI service error', 
        message: 'No response received from AI service' 
      }, { status: 500 });
    }

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error("[API v1] No content received from Gemini API for requirements");
      return NextResponse.json({ 
        error: 'AI service error', 
        message: 'No content received from AI service' 
      }, { status: 500 });
    }

    const extractedText = candidate.content.parts[0].text;
    
    if (!extractedText) {
      console.error("[API v1] No text content received from Gemini API for requirements");
      return NextResponse.json({ 
        error: 'AI service error', 
        message: 'No text content received from AI service' 
      }, { status: 500 });
    }
    
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
        console.error("[API v1] Failed to parse Gemini API JSON response for requirements:", secondParseError);
        return NextResponse.json({ 
          error: 'AI service error',
          message: 'Failed to parse AI response. Please try again.'
        }, { status: 500 });
      }
    }

    // Clean citations from the data
    const cleanedData = cleanRequirementsData(requirementsData);

    // Validate the structure
    if (!cleanedData || !cleanedData.companies || !Array.isArray(cleanedData.companies)) {
      console.error("[API v1] Invalid requirements data structure:", cleanedData);
      return NextResponse.json({ 
        error: 'AI service error',
        message: 'Invalid data structure received from AI service'
      }, { status: 500 });
    }

    console.log("[API v1] Successfully generated requirements data for:", roleName, "in", industry);
    
    return NextResponse.json({
      success: true,
      data: cleanedData,
      meta: {
        roleName,
        industry,
        timestamp: new Date().toISOString(),
        version: "v1"
      }
    });
    
  } catch (error: any) {
    console.error("[API v1] Error in requirements API:", error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: 'Failed to generate requirements data' 
    }, { status: 500 });
  }
}

// GET endpoint for API documentation
export async function GET() {
  return NextResponse.json({
    name: "Job Requirements Generator API",
    version: "v1",
    description: "Generate job requirements from top companies for specific roles and industries",
    endpoint: "/api/v1/requirements",
    method: "POST",
    authentication: "API Key required (x-api-key header)",
    rateLimit: "10 requests per minute",
    requestBody: {
      roleName: "string (required) - The job role title",
      industry: "string (required) - The industry sector"
    },
    responseFormat: {
      success: "boolean",
      data: {
        companies: [
          {
            company: "string - Company name",
            logo: "string - Company logo abbreviation",
            requirements: ["array of requirement strings"]
          }
        ]
      },
      meta: {
        roleName: "string",
        industry: "string", 
        timestamp: "ISO date string",
        version: "string"
      }
    },
    example: {
      request: {
        roleName: "Senior Software Engineer",
        industry: "Technology"
      }
    }
  });
}