import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.0-flash';

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log("Generate job content API received payload:", payload);
    
    const { section, existingData, temperature = 0.3 } = payload;
    const { title, industry, description, job_desc, requirements } = existingData;

    // Validate that at least one section has content
    const hasTitle = title && title.trim();
    const hasDescription = description && description.trim();
    const hasJobDesc = job_desc && job_desc.length > 0 && job_desc.some((item: any) => item.value && item.value.trim());
    const hasRequirements = requirements && requirements.length > 0 && requirements.some((item: any) => item.value && item.value.trim());
    
    if (!hasTitle && !hasDescription && !hasJobDesc && !hasRequirements) {
      return NextResponse.json({ 
        error: 'At least one section must have content to generate other sections',
        success: false 
      }, { status: 400 });
    }

    // Build context from existing data
    let context = "Based on the following job information:\n";
    if (hasTitle) context += `Job Title: ${title}\n`;
    if (industry && industry.trim()) context += `Industry: ${industry}\n`;
    if (hasDescription) context += `Overview: ${description}\n`;
    if (hasJobDesc) {
      const jobDescItems = job_desc.filter((item: any) => item.value && item.value.trim()).map((item: any) => item.value);
      if (jobDescItems.length > 0) {
        context += `Job Descriptions: ${jobDescItems.join(', ')}\n`;
      }
    }
    if (hasRequirements) {
      const reqItems = requirements.filter((item: any) => item.value && item.value.trim()).map((item: any) => item.value);
      if (reqItems.length > 0) {
        context += `Requirements: ${reqItems.join(', ')}\n`;
      }
    }

    let prompt = "";
    let responseFormat = "";

    switch (section) {
      case 'title':
        if (industry && industry.trim()) {
          prompt = `${context}\nGenerate a professional and specific job title that accurately reflects the role described above. The title should be concise, industry-standard, and appealing to potential candidates. Focus on the ${industry} industry. Base your suggestions on practices from 3-5 leading companies in this industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": "Generated job title here",\n  "industry": "${industry}",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        } else {
          prompt = `${context}\nGenerate a professional and specific job title that accurately reflects the role described above. The title should be concise, industry-standard, and appealing to potential candidates.\n\nAlso identify the most relevant industry for this role and base your suggestions on practices from 3-5 leading companies in that industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": "Generated job title here",\n  "industry": "Most relevant industry name",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        }
        break;
        
      case 'description':
        if (industry && industry.trim()) {
          prompt = `${context}\nGenerate a comprehensive job overview/description paragraph (2-4 sentences) that summarizes the role, its importance, and what the candidate can expect. Make it engaging and informative. Focus on the ${industry} industry context. Base your content on practices from 3-5 leading companies in this industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": "Generated overview paragraph here",\n  "industry": "${industry}",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        } else {
          prompt = `${context}\nGenerate a comprehensive job overview/description paragraph (2-4 sentences) that summarizes the role, its importance, and what the candidate can expect. Make it engaging and informative.\n\nAlso identify the most relevant industry for this role and base your content on practices from 3-5 leading companies in that industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": "Generated overview paragraph here",\n  "industry": "Most relevant industry name",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        }
        break;
        
      case 'job_desc':
        if (industry && industry.trim()) {
          prompt = `${context}\nGenerate 6-8 specific, detailed, and actionable job responsibilities/descriptions for this role. Each should be a complete sentence describing what the person will do in this position. Focus on day-to-day tasks, key responsibilities, and important duties within the ${industry} industry. Base your content on practices from 3-5 leading companies in this industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": [\n    "First responsibility here",\n    "Second responsibility here",\n    "Third responsibility here"\n  ],\n  "industry": "${industry}",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        } else {
          prompt = `${context}\nGenerate 6-8 specific, detailed, and actionable job responsibilities/descriptions for this role. Each should be a complete sentence describing what the person will do in this position. Focus on day-to-day tasks, key responsibilities, and important duties.\n\nAlso identify the most relevant industry for this role and base your content on practices from 3-5 leading companies in that industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": [\n    "First responsibility here",\n    "Second responsibility here",\n    "Third responsibility here"\n  ],\n  "industry": "Most relevant industry name",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        }
        break;
        
      case 'requirements':
        if (industry && industry.trim()) {
          prompt = `${context}\nGenerate 5-7 specific requirements for this role including education, experience, technical skills, soft skills, and any certifications. Each requirement should be clear and specific to help candidates understand what qualifications they need. Focus on requirements relevant to the ${industry} industry. Base your content on practices from 3-5 leading companies in this industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": [\n    "First requirement here",\n    "Second requirement here",\n    "Third requirement here"\n  ],\n  "industry": "${industry}",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        } else {
          prompt = `${context}\nGenerate 5-7 specific requirements for this role including education, experience, technical skills, soft skills, and any certifications. Each requirement should be clear and specific to help candidates understand what qualifications they need.\n\nAlso identify the most relevant industry for this role and base your content on practices from 3-5 leading companies in that industry.`;
          responseFormat = `Please return your response in the following JSON format:\n{\n  "content": [\n    "First requirement here",\n    "Second requirement here",\n    "Third requirement here"\n  ],\n  "industry": "Most relevant industry name",\n  "companies": ["Company1", "Company2", "Company3"]\n}`;
        }
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid section specified' }, { status: 400 });
    }

    const fullPrompt = `${prompt}\n\n${responseFormat}\n\nIMPORTANT: Return only valid JSON, no additional text before or after.`;

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 2048,
      } as GenerationConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    const result = await model.generateContent(fullPrompt);
    
    const response = result.response;
    const candidate = response.candidates && response.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      console.error("Gemini API returned an empty or malformed response for job content generation.");
      if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${candidate.finishReason}.`;
        if (candidate.finishReason === 'SAFETY' && candidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(candidate.safetyRatings);
        }
        console.error(blockReason, candidate.safetyRatings);
        return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Gemini API returned no usable content for job content generation.' }, { status: 500 });
    }
    
    const extractedText = candidate.content.parts[0].text;
    
    let generatedData: any;
    try {
      // Try to parse the response as JSON directly
      generatedData = JSON.parse(extractedText);
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON from the text
      try {
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          generatedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (secondParseError) {
        console.error("Failed to parse Gemini API JSON response for job content generation:", parseError);
        console.error("Raw response from Gemini for job content generation:", extractedText);
        return NextResponse.json({ 
          error: 'Failed to parse generated content from Gemini API. Please try again.', 
          details: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
        }, { status: 500 });
      }
    }

    // Validate the structure
    if (!generatedData || !generatedData.content || !generatedData.industry) {
      console.error("Invalid generated data structure:", generatedData);
      return NextResponse.json({ 
        error: 'Invalid data structure received from AI. Please try again.',
        details: 'Expected content and industry fields not found'
      }, { status: 500 });
    }

    console.log(`Successfully generated ${section} content with industry: ${generatedData.industry}`);
    
    return NextResponse.json({
      success: true,
      data: {
        content: generatedData.content,
        industry: generatedData.industry,
        companies: generatedData.companies || [],
        section: section
      }
    });

  } catch (error) {
    console.error('Error processing job content generation request with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process job content generation request', details: errorMessage }, { status: 500 });
  }
}