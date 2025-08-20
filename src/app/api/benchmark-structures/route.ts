import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;
const modelName = 'gemini-2.0-flash';

// Helper function to parse structured text as fallback when JSON parsing fails
function parseStructuredTextFallback(text: string): any {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let inferredIndustry = "";
  const companies: any[] = [];
  let currentCompany: any = null;
  let currentDepartment: any = null;
  
  console.log("Parsing structured text fallback for structures with", lines.length, "lines");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('INDUSTRY:') || line.startsWith('INFERRED INDUSTRY:')) {
      inferredIndustry = line.replace(/^(INDUSTRY:|INFERRED INDUSTRY:)\s*/, '').trim();
    } else if (line.includes('COMPANY') && line.includes(':')) {
      // Save previous company if exists
      if (currentCompany) {
        companies.push(currentCompany);
      }
      
      // Parse company line
      let companyMatch = line.match(/COMPANY[:\s]+(.+)/i) || 
                         line.match(/\*\*COMPANY:\s*(.+?)\*\*/i);
      
      if (companyMatch) {
        const companyName = companyMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
        currentCompany = {
          company: companyName,
          industry: inferredIndustry || "Unknown",
          structure: []
        };
      }
    } else if (line.includes('STRUCTURE:') || line.includes('**Structure:**')) {
      // Start parsing structure
      continue;
    } else if ((line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\./)) && currentCompany) {
      // Parse department entry
      const content = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      
      // Try to extract level and parent from content
      const levelMatch = content.match(/Level (\d+):/i);
      const parentMatch = content.match(/\(Parent:\s*(.+?)\)/i);
      
      let level = 0;
      let parent = "";
      let name = content;
      
      if (levelMatch) {
        level = parseInt(levelMatch[1]);
        name = content.replace(/Level \d+:\s*/i, '').replace(/\s*\(Parent:.*?\)/i, '').trim();
      }
      
      if (parentMatch) {
        parent = parentMatch[1].trim();
      }
      
      currentCompany.structure.push({
        name: name,
        level: level,
        ...(parent && { parent: parent })
      });
    }
  }
  
  // Add the last company
  if (currentCompany) {
    companies.push(currentCompany);
  }
  
  return {
    inferredIndustry: inferredIndustry || "",
    companies: companies
  };
}

// Simplified output schema for organization structures (department names only)
const organizationStructureSchema = {
  type: "object",
  properties: {
    inferredIndustry: {
      type: "string",
      description: "The industry category for the benchmarked companies"
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
          industry: {
            type: "string",
            description: "Specific industry sector"
          },
          structure: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Level name"
                },
                level: {
                  type: "integer",
                  description: "Hierarchical level (0 = top level, 1 = second level, etc.)"
                },
                parent: {
                  type: "string",
                  description: "Parent level name (if applicable)"
                }
              },
              required: ["name", "level"]
            }
          }
        },
        required: ["company", "industry", "structure"]
      }
    }
  },
  required: ["inferredIndustry", "companies"]
};

export async function POST(request: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' }, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log("Benchmark Structures API received payload:", payload);

    const { industry, currentStructure, temperature } = payload;

    if (!industry) {
      return NextResponse.json({ error: 'Industry is required' }, { status: 400 });
    }

    // Build context about current structure if provided
    let currentStructureContext = "";
    if (currentStructure) {
      // Transform structure to be more token-efficient
      const optimizeStructure = (dept: any): any => {
        return {
          name: dept.name,
          description: dept.description,
          jobCount: dept.jobCount,
          jobTitles: dept.jobs ? dept.jobs.map((job: any) => job.title || job.name) : [],
          children: dept.children ? dept.children.map(optimizeStructure) : []
        };
      };
      
      const optimizedStructure = optimizeStructure(currentStructure);
      currentStructureContext = `\n\nFor reference, here is the user's current organization structure:\n${JSON.stringify(optimizedStructure, null, 2)}\n\nPlease provide benchmark structures that are relevant for comparison with this current structure.`;
    }

    const prompt = `
Research the organizational structures of 5 top companies in the ${industry} industry. Find current information about their organizational structures and hierarchies.

Provide a list of companies and their structure names with hierarchical levels, DO NOT include any person's names:
0=Top Level (C-Suite)
1=Second Level (VPs, Directors, etc.)
2=Third Level (Departments, Managers etc.)
3=Fourth Level (Divisions, Leads, etc.)

Use hierarchical bullet points to show clear organizational structure. Use the following format with indented bullets:

INDUSTRY: ${industry}

COMPANY 1: [Company Name]
STRUCTURE:
- [Top Level Position]
-- [Second Level Position]
--- [Third Level Position]
--- [Third Level Position]
---- [Fourth Level Position]
---- [Fourth Level Position]
-- [Second Level Position]
--- [Third Level Position]
--- [Third Level Position]
---- [Fourth Level Position]
---- [Fourth Level Position]

COMPANY 2: [Company Name]
STRUCTURE:
- [Top Level Position]
-- [Second Level Position]
--- [Third Level Position]
---- [Fourth Level Position]

[Repeat for 5 companies]

EXAMPLE for Technology industry:

INDUSTRY: Technology

COMPANY 1: Google (Alphabet Inc.)
STRUCTURE:
- Chief Executive Officer
-- President of Google
-- Senior Vice President of Engineering
--- Vice President of Infrastructure
---- Director of Cloud Infrastructure
---- Director of Data Center Operations
--- Vice President of AI Research
---- Director of Machine Learning
---- Director of AI Ethics
-- Senior Vice President of Product
--- Vice President of Search
---- Director of Search Engineering
---- Director of Search Quality
--- Vice President of YouTube
---- Director of YouTube Product
---- Director of YouTube Engineering
--- Vice President of Android
---- Director of Android Development
---- Director of Android Platform
-- Senior Vice President of Cloud
--- Vice President of Google Cloud Platform
---- Director of Cloud Services
---- Director of Cloud Security

COMPANY 2: Microsoft Corporation
STRUCTURE:
- Chief Executive Officer
-- President
-- Executive Vice President of Cloud and AI
--- Corporate Vice President of Azure
---- General Manager of Azure Compute
---- General Manager of Azure Storage
---- General Manager of Azure Networking
--- Corporate Vice President of Microsoft 365
---- General Manager of Microsoft Teams
---- General Manager of Office Applications
---- General Manager of SharePoint
-- Executive Vice President of Experiences and Devices
--- Corporate Vice President of Windows
---- General Manager of Windows Client
---- General Manager of Windows Server
--- Corporate Vice President of Surface
---- General Manager of Surface Hardware
---- General Manager of Surface Software
`;

    // ===== FIRST API CALL: Google Search Grounding =====
    console.log("=== Starting First API Call: Google Search Grounding (Structures) ===");
    
    // Configure tools and settings for grounding call
    const groundingTools = [
      {
        googleSearch: {}
      }
    ];

    const groundingConfig = {
      tools: groundingTools,
      generationConfig: {
        temperature: temperature || 0.3,
        maxOutputTokens: 4096,
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
    console.log("Grounding candidate structure (structures):", JSON.stringify(groundingCandidate, null, 2));

    if (!groundedText || groundedText.trim() === '') {
      console.error("First API call (grounding) returned empty response for structures.");
      if (groundingCandidate && groundingCandidate.finishReason && groundingCandidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${groundingCandidate.finishReason}.`;
        if (groundingCandidate.finishReason === 'SAFETY' && groundingCandidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(groundingCandidate.safetyRatings);
        }
        console.error(blockReason, groundingCandidate.safetyRatings);
        return NextResponse.json({ error: `Gemini API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'First API call returned no usable content for structures.' }, { status: 500 });
    }

    console.log("Grounded text from first API call (structures - first 1000 chars):", groundedText.substring(0, 1000) + "...");

    // Extract grounding metadata from the first call
    let groundingMetadataToSave = null;
    const candidateWithGrounding = groundingCandidate as any;
    if (candidateWithGrounding && candidateWithGrounding.groundingMetadata) {
      const webSearchQueries = candidateWithGrounding.groundingMetadata.webSearchQueries || [];
      
      const groundingChunks = (candidateWithGrounding.groundingMetadata.groundingChunks || []).map((chunk: any) => {
        console.log("Processing grounding chunk (structures):", JSON.stringify(chunk, null, 2));
        
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
          console.log("Extracting URLs from searchEntryPoint (structures)");
          
          // Extract URLs from the rendered HTML content
          const urlRegex = /href="([^"]+)"/g;
          const urls = [];
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
          
          console.log(`Extracted ${groundingChunks.length} URLs from searchEntryPoint (structures)`);
        }
      }
      
      // Helper function to escape regex special characters
      function escapeRegExp(string: string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      const groundingSupports = candidateWithGrounding.groundingMetadata.groundingSupports || [];
      console.log("Grounding supports received (structures):", JSON.stringify(groundingSupports, null, 2));

      groundingMetadataToSave = {
        webSearchQueries,
        groundingChunks,
        groundingSupports
      };
      
      console.log("Grounding metadata extracted from first call (structures):", 
        JSON.stringify(groundingMetadataToSave, null, 2));
    }

    // ===== SECOND API CALL: Structured Output =====
    console.log("=== Starting Second API Call: Structured Output (Structures) ===");
    
    const structuredPrompt = `
You must convert the following organizational structure benchmark information into valid JSON format. Extract all the companies and its organizational structures from the provided text.

Original benchmark data:
${groundedText}

CRITICAL: You must make sure all hierarchical parts (except the top level) have parent connection. You must respond with ONLY valid JSON. Do not include any markdown formatting, explanations, or additional text. Just pure JSON.

Extract the data into this exact JSON structure:
{
  "inferredIndustry": "industry name",
  "companies": [
    {
      "company": "Company Name",
      "industry": "Specific industry sector",
      "structure": [
        {
          "name": "Level Name",
          "level": 0,
          "parent": "Parent Level Name"
        }
      ]
    }
  ]
}

Extract all level names, and parent relationships exactly as they appear in the original text.`;

    const structuredConfig = {
      generationConfig: {
        temperature: 0.1, // Lower temperature for structured output
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: organizationStructureSchema,
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
      console.error("Second API call (structured) returned empty response for structures.");
      if (structuredCandidate && structuredCandidate.finishReason && structuredCandidate.finishReason !== 'STOP') {
        let blockReason = `Generation stopped due to: ${structuredCandidate.finishReason}.`;
        if (structuredCandidate.finishReason === 'SAFETY' && structuredCandidate.safetyRatings) {
          blockReason += " Details: " + JSON.stringify(structuredCandidate.safetyRatings);
        }
        console.error(blockReason, structuredCandidate.safetyRatings);
        return NextResponse.json({ error: `Structured output API issue: ${blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Second API call returned no usable content for structures.' }, { status: 500 });
    }

    console.log("Structured text from second API call (structures):", structuredText);

    const extractedText = structuredText;

    let benchmarkData: any;
    
    // Since we're using structured output, the response should be valid JSON
    // But handle markdown-wrapped JSON first
    let cleanedText = extractedText;
    
    // Remove markdown code blocks if present
    if (extractedText.includes('```json')) {
      cleanedText = extractedText.replace(/```json\s*([\s\S]*?)\s*```/g, '$1');
    } else if (extractedText.includes('```')) {
      cleanedText = extractedText.replace(/```\s*([\s\S]*?)\s*```/g, '$1');
    }
    
    try {
      benchmarkData = JSON.parse(cleanedText.trim());
      console.log("Parsed structured benchmark data (structures):", JSON.stringify(benchmarkData, null, 2));
    } catch (parseError) {
      console.error("Failed to parse structured JSON response for structures:", parseError);
      console.error("Raw structured response (structures):", extractedText);
      
      // Fallback: try to extract JSON from the response or parse as structured text
      try {
        // Find the first { and last } to extract JSON object
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = cleanedText.substring(firstBrace, lastBrace + 1);
          benchmarkData = JSON.parse(jsonStr);
          console.log("Fallback JSON parsing successful (structures):", JSON.stringify(benchmarkData, null, 2));
        } else {
          // If no JSON found, try to parse as structured text (fallback to original parsing)
          console.log("No JSON found in structured output, attempting text parsing for structures...");
          benchmarkData = parseStructuredTextFallback(extractedText);
          console.log("Structured text fallback parsing successful (structures):", JSON.stringify(benchmarkData, null, 2));
        }
      } catch (fallbackError) {
        console.error("All parsing methods failed for structures:", fallbackError);
        return NextResponse.json({
          error: 'Failed to parse output from Gemini API for structures. Please try again.',
          details: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
        }, { status: 500 });
      }
    }

    // Validate the structure
    if (!benchmarkData || !benchmarkData.companies || !Array.isArray(benchmarkData.companies)) {
      console.error("Invalid benchmark data structure (structures):", benchmarkData);
      return NextResponse.json({
        error: 'Invalid data structure received from AI. Please try again.',
        details: 'Expected companies array not found'
      }, { status: 500 });
    }

    // Validate that we have at least some companies
    if (benchmarkData.companies.length === 0) {
      return NextResponse.json({
        error: 'No benchmark companies found for the specified industry.',
        details: 'Please try a different industry or check your input.'
      }, { status: 400 });
    }

    // Add grounding metadata to the response
    if (groundingMetadataToSave) {
      benchmarkData.groundingMetadata = groundingMetadataToSave;
      console.log("Grounding metadata from first call applied to structured data (structures):", 
        JSON.stringify(groundingMetadataToSave, null, 2));
    } else {
      console.log("No grounding metadata available from the first API call (structures)");
    }

    console.log("Successfully generated benchmark structures for industry:", industry);
    console.log("Number of companies found:", benchmarkData.companies.length);

    return NextResponse.json({
      success: true,
      data: benchmarkData,
      industry
    });

  } catch (error) {
    console.error('Error processing benchmark structures request with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: 'Failed to process benchmark structures request', details: errorMessage }, { status: 500 });
  }
}