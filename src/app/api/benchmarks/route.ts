import { NextRequest, NextResponse } from 'next/server';
import { saveJobSearchBenchmark } from '@/app/actions';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;
const modelName = 'gemini-2.0-flash';

// Define structured output schema for the second API call
const benchmarkSchema = {
  type: "object",
  properties: {
    inferredRoleName: {
      type: "string",
      description: "The inferred role name based on the job description"
    },
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: {
            type: "string",
            description: "Company name"
          },
          logo: {
            type: "string",
            description: "Short logo abbreviation (2-4 characters)"
          },
          overview: {
            type: "string",
            description: "Concise overview paragraph for the role at this company"
          },
          responsibilities: {
            type: "array",
            items: {
              type: "string"
            },
            description: "List of 6-8 specific responsibilities"
          },
          requirements: {
            type: "array",
            items: {
              type: "string"
            },
            description: "List of 4-6 specific requirements"
          }
        },
        required: ["company", "logo", "overview", "responsibilities", "requirements"]
      }
    }
  },
  required: ["companies"]
};

// Helper function to process benchmark data
// Keep original text with citations for proper grounding support mapping
function processBenchmarkData(data: any): any {
  if (data && data.companies && Array.isArray(data.companies)) {
    return {
      ...data,
      inferredRoleName: data.inferredRoleName || "",
      companies: data.companies.map((company: any) => ({
        ...company,
        roleName: company.roleName || "",
        responsibilities: company.responsibilities || [],
        requirements: company.requirements || [],
        overview: company.overview || ""
      })),
      // Explicitly preserve groundingMetadata if it exists
      groundingMetadata: data.groundingMetadata
    };
  }
  return data;
}

// Helper function to parse structured text as fallback when JSON parsing fails
function parseStructuredTextFallback(text: string): any {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let inferredRoleName = "";
  const companies: any[] = [];
  let currentCompany: any = null;
  let currentSection = "";
  
  console.log("Parsing structured text fallback with", lines.length, "lines");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('ROLE NAME:') || line.startsWith('INFERRED ROLE NAME:')) {
      inferredRoleName = line.replace(/^(ROLE NAME:|INFERRED ROLE NAME:)\s*/, '').trim();
    } else if (line.includes('COMPANY') && (line.includes(':') || line.includes('LOGO'))) {
      // Save previous company if exists
      if (currentCompany) {
        companies.push(currentCompany);
      }
      
      // Parse company line with multiple format attempts
      let companyName = "";
      let logoText = "";
      
      // Try various patterns
      let companyMatch = line.match(/COMPANY[:\s]+(.+?)\s*\(LOGO:\s*(.+?)\)/i) || 
                         line.match(/\*\*COMPANY:\s*(.+?)\*\*/i) ||
                         line.match(/COMPANY[:\s]+(.+)/i);
      
      if (companyMatch) {
        companyName = companyMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
        if (companyMatch[2]) {
          logoText = companyMatch[2].replace(/^\*\*|\*\*$/g, '').trim();
        } else {
          logoText = companyName.substring(0, 4).toUpperCase();
        }
      }
      
      if (companyName) {
        currentCompany = {
          company: companyName,
          logo: logoText,
          responsibilities: [],
          requirements: [],
          overview: ""
        };
      }
      currentSection = "";
    } else if (line.startsWith('OVERVIEW:') || line.includes('**Overview:**')) {
      if (currentCompany) {
        const overview = line.replace(/^(OVERVIEW:|.*\*\*Overview:\*\*)/, '').trim();
        currentCompany.overview = overview;
      }
      currentSection = "overview";
    } else if (line.startsWith('RESPONSIBILITIES:') || line.includes('**Responsibilities:**')) {
      currentSection = "responsibilities";
    } else if (line.startsWith('REQUIREMENTS:') || line.includes('**Requirements:**')) {
      currentSection = "requirements";
    } else if ((line.startsWith('- ') || line.startsWith('* ') || line.startsWith('*   ') || line.match(/^\d+\./)) && currentCompany) {
      const content = line.replace(/^[-*]\s*/, '').replace(/^\*\s+/, '').replace(/^\d+\.\s*/, '').trim();
      if (currentSection === "responsibilities") {
        currentCompany.responsibilities.push(content);
      } else if (currentSection === "requirements") {
        currentCompany.requirements.push(content);
      }
    } else if (currentSection === "overview" && currentCompany && !line.startsWith('COMPANY') && !line.startsWith('**COMPANY') && !line.startsWith('RESPONSIBILITIES') && !line.startsWith('REQUIREMENTS')) {
      // Multi-line overview
      currentCompany.overview += " " + line;
    }
  }
  
  // Add the last company
  if (currentCompany) {
    companies.push(currentCompany);
  }
  
  return {
    inferredRoleName: inferredRoleName || "",
    companies: companies
  };
}

// Helper function to add citations based on grounding supports
function addCitationsFromGroundingSupports(processedData: any, originalText: string, groundingSupports: any[]): any {
  console.log("Adding citations from", groundingSupports.length, "grounding supports");
  
  // Function to add citations to a text string
  function addCitationsToText(text: string): string {
    if (!text || typeof text !== 'string') return text;
    
    // Find grounding supports that match this text content with more flexible matching
    const relevantSupports = groundingSupports.filter(support => {
      if (!support.segment || !support.segment.text) return false;
      
      const segmentText = support.segment.text.toLowerCase();
      const textLower = text.toLowerCase();
      
      // More flexible matching strategies:
      // 1. Exact inclusion (either direction)
      if (textLower.includes(segmentText) || segmentText.includes(textLower)) {
        return true;
      }
      
      // 2. Word overlap - check if they share significant words
      const segmentWords = segmentText.split(/\s+/).filter((word: string) => word.length > 3);
      const textWords = textLower.split(/\s+/).filter((word: string) => word.length > 3);
      
      if (segmentWords.length > 0 && textWords.length > 0) {
        const commonWords = segmentWords.filter((word: string) => textWords.includes(word));
        // If they share more than 40% of words, consider it a match
        const overlapRatio = commonWords.length / Math.min(segmentWords.length, textWords.length);
        if (overlapRatio > 0.4) {
          return true;
        }
      }
      
      // 3. Key phrase matching - check for important phrases
      const keyPhrases = [
        // 'data engineer', 'software engineer', 'machine learning', 'python', 'sql',
        'bachelor', 'master', 'degree', 'experience', 'years', 'develop', 'design',
        'implement', 'manage', 'analyze', 'optimize', 'maintain', 'collaborate'
      ];
      
      for (const phrase of keyPhrases) {
        if (segmentText.includes(phrase) && textLower.includes(phrase)) {
          return true;
        }
      }
      
      return false;
    });
    
    if (relevantSupports.length === 0) return text;
    
    let modifiedText = text;
    
    // Sort by specificity (more specific matches first)
    relevantSupports
      .sort((a, b) => {
        const aSpecificity = a.segment.text.length;
        const bSpecificity = b.segment.text.length;
        return bSpecificity - aSpecificity;
      })
      .forEach(support => {
        const segmentText = support.segment.text;
        const citationNumbers = support.groundingChunkIndices.map((index: number) => index + 1);
        const citation = ` [${citationNumbers.join(', ')}]`;
        
        // Try to find the best place to insert the citation
        let insertionPoint = -1;
        
        // First try exact substring match
        insertionPoint = modifiedText.toLowerCase().indexOf(segmentText.toLowerCase());
        
        if (insertionPoint !== -1) {
          // Found exact match, add citation after it
          const endIndex = insertionPoint + segmentText.length;
          if (!modifiedText.slice(endIndex).startsWith(' [')) { // Avoid duplicate citations
            modifiedText = modifiedText.slice(0, endIndex) + citation + modifiedText.slice(endIndex);
            console.log(`Added citation ${citation} to exact match: "${segmentText.substring(0, 50)}..."`);
          }
        } else {
          // Try to find key words and add citation at the end of the text
          const segmentWords = segmentText.toLowerCase().split(/\s+/).filter((word: string) => word.length > 3);
          const textWords = modifiedText.toLowerCase().split(/\s+/);
          const hasKeyWords = segmentWords.some((word: string) => textWords.includes(word));
          
          if (hasKeyWords && !modifiedText.includes('[')) { // Only add if no citation exists yet
            modifiedText = modifiedText.trim() + citation;
            console.log(`Added citation ${citation} to end based on key words: "${segmentText.substring(0, 50)}..."`);
          }
        }
      });
    
    return modifiedText;
  }
  
  // Apply citations to all text fields in the processed data
  const updatedData = {
    ...processedData,
    inferredRoleName: addCitationsToText(processedData.inferredRoleName),
    companies: processedData.companies.map((company: any) => ({
      ...company,
      overview: addCitationsToText(company.overview),
      responsibilities: company.responsibilities.map((resp: string) => addCitationsToText(resp)),
      requirements: company.requirements.map((req: string) => addCitationsToText(req))
    }))
  };
  
  console.log("Citations added to processed data");
  return updatedData;
}

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log("Benchmarks API received payload:", payload);

    const { roleName, industry, currentOverview, currentJobDesc, currentRequirements, temperature, userId, jobDescription } = payload;

    // Check if we have either roleName+industry OR jobDescription (from existing form data)
    const hasRoleAndIndustry = roleName && industry;
    const hasJobDescription = jobDescription || currentOverview || (currentJobDesc && currentJobDesc.length > 0) || (currentRequirements && currentRequirements.length > 0);

    if (!hasRoleAndIndustry && !hasJobDescription) {
      console.log("Benchmarks API validation failed: need either role+industry or job description");
      return NextResponse.json({ error: 'Either roleName+industry or job description/overview/requirements are required' }, { status: 400 });
    }

    // Log if we have existing form data
    if (currentOverview || (currentJobDesc && currentJobDesc.length > 0) || (currentRequirements && currentRequirements.length > 0)) {
      console.log("Benchmarks API received existing form data:", {
        hasOverview: !!currentOverview,
        jobDescCount: currentJobDesc?.length || 0,
        requirementsCount: currentRequirements?.length || 0
      });
    }

    // Guardrails: Validate input before proceeding (only for role+industry input)
    if (hasRoleAndIndustry) {
      const guardrailsPrompt = `
You are a job validation expert. Determine if "${roleName}" is a legitimate job role in the "${industry}" industry.

Guardrails: This prompt will only generate job requirements if the user input for ${roleName} matches a real, recognized job role (in English) within the context of ${industry}. If the input is a nonsensical phrase, a mythical creature, an inappropriate term, or anything not related to an actual job title, the output will be: "invalid role". The model will check for validity of ${roleName} before returning results.

Respond with only "valid" or "invalid role".
`;

      const guardrailsConfig = {
        temperature: 0.1,
        maxOutputTokens: 10,
      };

      const guardrailsResult = await genAI.models.generateContent({
        model: modelName,
        contents: guardrailsPrompt,
        config: guardrailsConfig,
      });
      const guardrailsResponse = guardrailsResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();

      if (guardrailsResponse === "invalid role") {
        return NextResponse.json({
          error: 'Please Input Relevant Job Role & Industry',
          details: 'The provided job role or industry appears to be invalid or nonsensical.'
        }, { status: 400 });
      }
    }
    // Skip guardrails validation when working with job descriptions only

    // Build the prompt with existing form data if available
    let additionalContext = "";

    if (currentOverview) {
      additionalContext += `\n\nThe user already has the following overview for the role:\n"${currentOverview}"\n\nPlease ensure your generated overviews align with this existing overview while providing unique perspectives from different companies.`;
    }

    if (currentJobDesc && currentJobDesc.length > 0) {
      additionalContext += `\n\nThe user already has the following job responsibilities:\n${currentJobDesc.map((desc: string, i: number) => `${i + 1}. ${desc}`).join('\n')}\n\nPlease ensure your generated responsibilities complement these existing ones and provide additional relevant responsibilities.`;
    }

    if (currentRequirements && currentRequirements.length > 0) {
      additionalContext += `\n\nThe user already has the following job requirements:\n${currentRequirements.map((req: string, i: number) => `${i + 1}. ${req}`).join('\n')}\n\nPlease ensure your generated requirements complement these existing ones and provide additional relevant requirements.`;
    }

    let prompt = "";

    if (hasRoleAndIndustry) {
      // When role and industry are provided
      prompt = `
You are an expert HR and recruitment analyst with deep knowledge of job market trends and company practices.

Your task is to research and provide role descriptions for the position "${roleName}" in the "${industry}" industry. Use web search to find current information.${additionalContext}

Please provide information about this role from 4-5 top companies in the ${industry} industry. For each company, include:
- Company name
- A short abbreviation (2-4 characters)
- 6-8 specific responsibilities for the ${roleName} position at that company
- 4-6 specific requirements for the ${roleName} position at that company
- A concise overview paragraph (2-3 sentences) for the ${roleName} position at that company

Focus on:
- Current, real-world responsibilities and requirements from 2024-2025
- Industry-specific requirements
- Technical skills and qualifications
- Leadership and collaboration aspects
- Innovation and strategic thinking requirements

Make sure the responsibilities and requirements are:
- Specific and actionable
- Reflective of current industry trends
- Differentiated between companies (showing unique company cultures/focuses)
- Professional and comprehensive
- Complementary to any existing content provided by the user
- DO NOT INCLUDE the company name when describing the responsibilities and requirements

CRITICAL: You MUST use the following format:

ROLE NAME: ${roleName}

COMPANY 1: [Company Name] (LOGO: [Logo Abbreviation])
OVERVIEW: [Overview paragraph like "This role focuses on data analysis and machine learning implementation"]
RESPONSIBILITIES:
- [Responsibility 1 like "Develop ML models using Python"]
- [Responsibility 2 like "Analyze large datasets for insights"]
- [Continue for 6-8 responsibilities]
REQUIREMENTS:
- [Requirement 1 like "Bachelor's degree in Computer Science"]
- [Requirement 2 like "3+ years of Python experience"]
- [Continue for 4-6 requirements]

[Repeat for 4-5 companies]
`;
    } else {
      // When only job description/overview/requirements are provided
      let jobContext = "";
      if (currentOverview) {
        jobContext += `Job Overview: ${currentOverview}\n`;
      }
      if (currentJobDesc && currentJobDesc.length > 0) {
        jobContext += `Job Responsibilities: ${currentJobDesc.join(', ')}\n`;
      }
      if (currentRequirements && currentRequirements.length > 0) {
        jobContext += `Job Requirements: ${currentRequirements.join(', ')}\n`;
      }

      prompt = `
You are an expert HR and recruitment analyst with deep knowledge of job market trends and company practices.

Based on the following job information, first infer the most appropriate job role name, then provide comprehensive role descriptions from 4-5 top companies. Use web search to find current information.

${jobContext}

Your task is to:
1. Analyze the provided job information and infer the most appropriate job role name
2. Determine the most suitable industry for this role
3. Provide comprehensive role descriptions from 4-5 top companies in that industry

For each company, include:
- Company name
- A short logo abbreviation (2-4 characters)
- 6-8 specific, detailed responsibilities for the inferred position at that company
- 4-6 specific requirements for the inferred position at that company
- A concise overview paragraph (2-3 sentences) for the inferred position at that company

Focus on:
- Current, real-world responsibilities and requirements from 2024-2025
- Industry-specific requirements
- Technical skills and qualifications
- Leadership and collaboration aspects
- Innovation and strategic thinking requirements

Make sure the responsibilities and requirements are:
- Specific and actionable
- Reflective of current industry trends
- Differentiated between companies (showing unique company cultures/focuses)
- Professional and comprehensive
- Complementary to the existing job information provided

CRITICAL: You MUST use the following format:

INFERRED ROLE NAME: [The most appropriate job role name based on the provided information]

COMPANY 1: [Company Name] (LOGO: [Logo Abbreviation])
OVERVIEW: [Overview paragraph like "This role focuses on data analysis and system optimization"]
RESPONSIBILITIES:
- [Responsibility 1 like "Design database schemas"]
- [Responsibility 2 like "Optimize query performance"]
- [Continue for 6-8 responsibilities]
REQUIREMENTS:
- [Requirement 1 like "Bachelor's degree in Engineering"]
- [Requirement 2 ike "5+ years of experience"]
- [Continue for 4-6 requirements]

[Repeat for 4-5 companies]
`;
    }

    // ===== FIRST API CALL: Google Search Grounding =====
    console.log("=== Starting First API Call: Google Search Grounding ===");
    
    // Configure tools and settings for grounding call
    const groundingTools = [
      {
        googleSearch: {}
      }
    ];

    const groundingConfig = {
      tools: groundingTools,
      generationConfig: {
        temperature: payload.temperature || 0.3,
        maxOutputTokens: 8192,
      },
    };

    // Structure contents array for grounding call
    const groundingContents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];

    // Make the first API call with Google Search grounding
    const groundingResponse = await genAI.models.generateContentStream({
      model: modelName,
      contents: groundingContents,
      config: groundingConfig,
    });

    // Collect the grounded response
    let groundedText = '';
    let groundingResult: any = null;
    for await (const chunk of groundingResponse) {
      if (chunk.text) {
        groundedText += chunk.text;
      }
      // Keep the last chunk which should contain the complete response data
      groundingResult = chunk;
    }

    const groundingCandidate = groundingResult.candidates && groundingResult.candidates[0];
    
    // Log the complete candidate structure to debug grounding metadata
    console.log("Grounding candidate structure:", JSON.stringify(groundingCandidate, null, 2));

    if (!groundedText || groundedText.trim() === '') {
      console.error("First API call (grounding) returned empty response.");
      if (groundingCandidate && groundingCandidate.finishReason && groundingCandidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${groundingCandidate.finishReason}.`;
        if (groundingCandidate.finishReason === 'SAFETY' && groundingCandidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(groundingCandidate.safetyRatings);
        }
        console.error(blockReason, groundingCandidate.safetyRatings);
        return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'First API call returned no usable content.' }, { status: 500 });
    }

    console.log("Grounded text from first API call (first 1000 chars):", groundedText.substring(0, 1000) + "...");

    // Extract grounding metadata from the first call
    let groundingMetadataToSave = null;
    const candidateWithGrounding = groundingCandidate as any;
    if (candidateWithGrounding && candidateWithGrounding.groundingMetadata) {
      const webSearchQueries = candidateWithGrounding.groundingMetadata.webSearchQueries || [];
      
      const groundingChunks = (candidateWithGrounding.groundingMetadata.groundingChunks || []).map((chunk: any) => {
        console.log("Processing grounding chunk:", JSON.stringify(chunk, null, 2));
        
        if (chunk && chunk.web) {
          return chunk;
        }
        
        return {
          web: {
            uri: `https://www.google.com/search?q=${encodeURIComponent('unknown source')}`,
            title: 'Unknown Source'
          }
        };
      });

      // If groundingChunks is empty, try to extract URLs from searchEntryPoint
      if (groundingChunks.length === 0 && candidateWithGrounding.groundingMetadata.searchEntryPoint) {
        const renderedContent = candidateWithGrounding.groundingMetadata.searchEntryPoint.renderedContent;
        if (renderedContent) {
          console.log("Extracting URLs from searchEntryPoint");
          
          // Extract URLs from the rendered HTML content
          const urlRegex = /href="([^"]+)"/g;
          let match;
          
          while ((match = urlRegex.exec(renderedContent)) !== null) {
            const url = match[1];
            if (url.startsWith('https://vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
              // Extract the title from the surrounding HTML if possible
              const titleRegex = new RegExp(`href="${escapeRegExp(url)}"[^>]*>([^<]+)<`, 'i');
              const titleMatch = titleRegex.exec(renderedContent);
              const title = titleMatch ? titleMatch[1].trim() : `Source ${groundingChunks.length + 1}`;
              
              groundingChunks.push({
                web: {
                  uri: url,
                  title: title
                }
              });
            }
          }
          
          console.log(`Extracted ${groundingChunks.length} URLs from searchEntryPoint`);
        }
      }
      
      // Helper function to escape regex special characters
      function escapeRegExp(string: string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      const groundingSupports = candidateWithGrounding.groundingMetadata.groundingSupports || [];
      console.log("Grounding supports received:", JSON.stringify(groundingSupports, null, 2));

      groundingMetadataToSave = {
        webSearchQueries,
        groundingChunks,
        groundingSupports
      };
      
      console.log("Grounding metadata extracted from first call:", 
        JSON.stringify(groundingMetadataToSave, null, 2));
    }

    // ===== SECOND API CALL: Structured Output =====
    console.log("=== Starting Second API Call: Structured Output ===");
    
    const structuredPrompt = `
You must convert the following job benchmark information into valid JSON format. Extract all the companies, roles, responsibilities, and requirements from the provided text, maintaining all the citation numbers [1], [2], etc. that are present in the original text.

Original benchmark data:
${groundedText}

CRITICAL: You must respond with ONLY valid JSON. Do not include any markdown formatting, explanations, or additional text. Just pure JSON.

Extract the data into this exact JSON structure:
{
  "inferredRoleName": "string with any inferred role name or empty string",
  "companies": [
    {
      "company": "Company Name",
      "logo": "2-4 character abbreviation",
      "overview": "Overview paragraph with citations [1] [2] etc",
      "responsibilities": [
        "Responsibility 1 with citations [1]",
        "Responsibility 2 with citations [2]"
      ],
      "requirements": [
        "Requirement 1 with citations [1]",
        "Requirement 2 with citations [2]"
      ]
    }
  ]
}

Preserve all citation numbers [1], [2], etc. exactly as they appear in the original text.`;

    const structuredConfig = {
      generationConfig: {
        temperature: 0.1, // Lower temperature for structured output
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: benchmarkSchema,
      },
    } as any; // Type assertion to bypass TypeScript checking for structured output

    const structuredContents = [
      {
        role: 'user',
        parts: [
          {
            text: structuredPrompt,
          },
        ],
      },
    ];

    // Make the second API call with structured output
    const structuredResponse = await genAI.models.generateContent({
      model: modelName,
      contents: structuredContents,
      config: structuredConfig,
    });

    const structuredCandidate = structuredResponse.candidates && structuredResponse.candidates[0];
    const structuredText = structuredCandidate?.content?.parts?.[0]?.text;

    if (!structuredText || structuredText.trim() === '') {
      console.error("Second API call (structured) returned empty response.");
      if (structuredCandidate && structuredCandidate.finishReason && structuredCandidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${structuredCandidate.finishReason}.`;
        if (structuredCandidate.finishReason === 'SAFETY' && structuredCandidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(structuredCandidate.safetyRatings);
        }
        console.error(blockReason, structuredCandidate.safetyRatings);
        return NextResponse.json({ error: `Structured output API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Second API call returned no usable content.' }, { status: 500 });
    }

    console.log("Structured text from second API call:", structuredText);

    const extractedText = structuredText;

    let benchmarkData: any;
    
    // Since we're using structured output, the response should be valid JSON
    try {
      benchmarkData = JSON.parse(extractedText);
      console.log("Parsed structured benchmark data:", JSON.stringify(benchmarkData, null, 2));
    } catch (parseError) {
      console.error("Failed to parse structured JSON response:", parseError);
      console.error("Raw structured response:", extractedText);
      
      // Fallback: try to extract JSON from the response or parse as structured text
      try {
        // Remove any markdown code blocks if present
        let cleanText = extractedText.replace(/```json\s*([\s\S]*?)\s*```/g, '$1');
        cleanText = cleanText.replace(/```\s*([\s\S]*?)\s*```/g, '$1');
        
        // Find the first { and last } to extract JSON object
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = cleanText.substring(firstBrace, lastBrace + 1);
          benchmarkData = JSON.parse(jsonStr);
          console.log("Fallback JSON parsing successful:", JSON.stringify(benchmarkData, null, 2));
        } else {
          // If no JSON found, try to parse as structured text (fallback to original parsing)
          console.log("No JSON found in structured output, attempting text parsing...");
          benchmarkData = parseStructuredTextFallback(extractedText);
          console.log("Structured text fallback parsing successful:", JSON.stringify(benchmarkData, null, 2));
        }
      } catch (fallbackError) {
        console.error("All parsing methods failed:", fallbackError);
        return NextResponse.json({
          error: 'Failed to parse output from Gemini API. Please try again.',
          details: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
        }, { status: 500 });
      }
    }

    // Validate the structure
    if (!benchmarkData || !benchmarkData.companies || !Array.isArray(benchmarkData.companies)) {
      console.error("Invalid benchmark data structure:", benchmarkData);
      return NextResponse.json({
        error: 'Invalid data structure received from AI. Please try again.',
        details: 'Expected companies array not found'
      }, { status: 500 });
    }

    // Process benchmark data while preserving original text with citations
    let processedData = processBenchmarkData(benchmarkData);

    console.log("Successfully generated role benchmark data for:", roleName, "in", industry);

    // Use the grounding metadata we extracted from the first API call
    if (groundingMetadataToSave) {
      processedData.groundingMetadata = groundingMetadataToSave;
      
      // Add citations based on grounding supports from the first call
      // We use the grounded text (from first call) to map supports to the structured content
      if (groundingMetadataToSave.groundingSupports && groundingMetadataToSave.groundingSupports.length > 0) {
        processedData = addCitationsFromGroundingSupports(processedData, groundedText, groundingMetadataToSave.groundingSupports);
      }
      
      console.log("Grounding metadata from first call applied to structured data:", 
        JSON.stringify(groundingMetadataToSave, null, 2));
    } else {
      console.log("No grounding metadata available from the first API call");
    }

    // Save the benchmark search to the database if userId is provided
    if (userId) {
      try {
        const benchmarkSaveResult = await saveJobSearchBenchmark({
          userId,
          searchRoleName: roleName,
          searchIndustry: industry,
          creativity: temperature || 0.3,
          results: processedData,
          groundingMetadata: groundingMetadataToSave
        });

        console.log("Benchmark search saved to database:", benchmarkSaveResult);
      } catch (saveError) {
        console.error("Error saving benchmark search to database:", saveError);
        // Continue with the response even if saving fails
      }
    }

    // Grounding metadata is already extracted and added to processedData above
    
    return NextResponse.json({
      success: true,
      data: processedData,
      roleName,
      industry
    });

  } catch (error) {
    console.error('Error processing role benchmarking request with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process role benchmarking request', details: errorMessage }, { status: 500 });
  }
}