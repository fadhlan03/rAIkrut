import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Define the expected structure of the JWT payload
interface AccessTokenPayload {
  userId: string;
  email?: string;
}

// Configure for Vercel Edge Runtime
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!jwtSecret || !geminiApiKey) {
    console.error("Missing required environment variables.");
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const secretKey = new TextEncoder().encode(jwtSecret);

  try {
    // --- Authentication --- 
    const tokenCookie = req.cookies.get('access_token');
    if (!tokenCookie) {
      return NextResponse.json({ error: 'Unauthorized: Access token missing' }, { status: 401 });
    }

    let userId: string;
    try {
      const { payload } = await jwtVerify(tokenCookie.value, secretKey, {
        algorithms: ['HS256']
      }) as unknown as { payload: AccessTokenPayload };
      userId = payload.userId;
      if (!userId) throw new Error('User ID missing in token payload');
    } catch (authError: any) {
      console.warn('Chat API: Access token verification failed:', authError.code || authError.message);
      return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { message, onboardingData, conversationHistory } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build system instruction with onboarding content
    const systemInstruction = buildSystemInstruction(onboardingData);

    // Build conversation context
    const conversationContext = buildConversationContext(conversationHistory, systemInstruction);

    // Generate response
    const result = await model.generateContent(`${conversationContext}\n\nHuman: ${message}\n\nAssistant:`);
    const response = await result.response;
    const aiResponse = response.text();

    return NextResponse.json({
      success: true,
      response: aiResponse.trim(),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    
    // Handle specific Gemini API errors
    if (error.message?.includes('API_KEY_INVALID')) {
      return NextResponse.json({ error: 'Invalid API configuration.' }, { status: 500 });
    }
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      return NextResponse.json({ error: 'Service temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    if (error.message?.includes('SAFETY')) {
      return NextResponse.json({ error: 'Message violates safety guidelines. Please rephrase your question.' }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Failed to generate response. Please try again.' 
    }, { status: 500 });
  }
}

function buildSystemInstruction(onboardingData: any): string {
  if (!onboardingData) {
    return `You are an AI onboarding assistant helping new employees during their onboarding process. 
    Be helpful, friendly, and professional. Answer questions about the company, role, team, and onboarding process.
    If you don't have specific information, acknowledge this and suggest who they might contact for more details.`;
  }

  const {
    welcomeContent,
    companyContent,
    teamMembers,
    formFields,
    documents,
    finishContent
  } = onboardingData;

  let instruction = `You are an AI onboarding assistant helping a new employee during their onboarding process. You have access to comprehensive information about their role and company. Be helpful, friendly, and professional in all responses.

## COMPANY INFORMATION:`;

  // Add company details
  if (companyContent) {
    instruction += `
Company Name: ${companyContent.companyName || 'Not specified'}
Founded: ${companyContent.foundedYear || 'Not specified'}
Description: ${companyContent.description || 'Not specified'}
Mission: ${companyContent.mission || 'Not specified'}
Vision: ${companyContent.vision || 'Not specified'}`;

    if (companyContent.values?.length > 0) {
      instruction += '\nCompany Values:';
      companyContent.values.forEach((value: any) => {
        instruction += `\n- ${value.name}: ${value.description}`;
      });
    }

    if (companyContent.techStack?.length > 0) {
      instruction += `\nTechnology Stack: ${companyContent.techStack.join(', ')}`;
    }

    if (companyContent.stats?.length > 0) {
      instruction += '\nCompany Statistics:';
      companyContent.stats.forEach((stat: any) => {
        instruction += `\n- ${stat.label}: ${stat.value}`;
      });
    }
  }

  // Add role information
  if (welcomeContent) {
    instruction += `

## ROLE INFORMATION:
Role Title: ${welcomeContent.roleTitle || 'Not specified'}
Role Description: ${welcomeContent.roleDescription || 'Not specified'}
Department: ${welcomeContent.department || 'Not specified'}
Manager: ${welcomeContent.manager || 'Not specified'}`;
  }

  // Add team information
  if (teamMembers?.length > 0) {
    instruction += `

## TEAM MEMBERS:`;
    teamMembers.forEach((member: any) => {
      instruction += `
- ${member.name} (${member.role})${member.email ? ` - ${member.email}` : ''}${member.bio ? ` - ${member.bio}` : ''}`;
    });
  }

  // Add onboarding process information
  if (formFields?.length > 0) {
    instruction += `

## ONBOARDING PROCESS:
The onboarding includes these information collection areas:`;
    formFields.forEach((field: any) => {
      instruction += `\n- ${field.label} (${field.type})`;
    });
  }

  // Add document information
  if (documents?.length > 0) {
    instruction += `

## REQUIRED DOCUMENTS:`;
    documents.forEach((doc: any) => {
      instruction += `\n- ${doc.title}${doc.required ? ' (Required)' : ' (Optional)'}`;
    });
  }

  // Add next steps information
  if (finishContent) {
    instruction += `

## NEXT STEPS AND RESOURCES:`;
    if (finishContent.nextSteps?.length > 0) {
      instruction += '\nNext Steps:';
      finishContent.nextSteps.forEach((step: any) => {
        instruction += `\n- ${step.title}: ${step.description}`;
      });
    }

    if (finishContent.teamContacts?.length > 0) {
      instruction += '\nKey Contacts:';
      finishContent.teamContacts.forEach((contact: any) => {
        instruction += `\n- ${contact.name} (${contact.role}) - ${contact.email}`;
      });
    }

    if (finishContent.resources?.length > 0) {
      instruction += '\nImportant Resources:';
      finishContent.resources.forEach((resource: any) => {
        instruction += `\n- ${resource.name}: ${resource.description}`;
      });
    }
  }

  instruction += `

## INSTRUCTIONS:
- Answer questions using the information provided above
- Be specific and reference relevant details from the onboarding content
- If asked about something not covered in the provided information, acknowledge this and suggest appropriate contacts
- Keep responses concise but informative
- Maintain a friendly, professional, and welcoming tone
- Help the new employee feel excited and prepared for their role
- If asked about technical details not in your knowledge, refer them to their manager or team lead`;

  return instruction;
}

function buildConversationContext(conversationHistory: any[], systemInstruction: string): string {
  let context = systemInstruction;
  
  if (conversationHistory?.length > 0) {
    context += '\n\n## CONVERSATION HISTORY:';
    conversationHistory.forEach((msg, index) => {
      if (index < 10) { // Limit history to last 10 messages to avoid token limit
        const role = msg.sender === 'user' ? 'Human' : 'Assistant';
        context += `\n${role}: ${msg.text}`;
      }
    });
  }
  
  return context;
} 