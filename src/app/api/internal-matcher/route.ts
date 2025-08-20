import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { jobVacancies, departments } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const modelName = 'gemini-2.0-flash';

interface SimilarJob {
  id: string;
  title: string;
  description: string;
  job_desc: string[];
  requirements: string[];
  similarity: number;
  dept_id?: string;
  department_name?: string;
  department_email?: string;
}

interface MatchAnalysisResult {
  success: boolean;
  data?: SimilarJob[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<MatchAnalysisResult>> {
  if (!genAI) {
    return NextResponse.json({ 
      success: false, 
      error: 'Gemini API client not initialized. Check GEMINI_API_KEY.' 
    }, { status: 500 });
  }

  try {
    const payload = await request.json();
    console.log("Internal Matcher API received payload:", payload);

    const { currentJobDesc, currentRequirements, currentOverview, excludeJobId } = payload;
    
    if (excludeJobId) {
      console.log(`Excluding job ID from results: ${excludeJobId}`);
    }

    // Validate input
    if ((!currentJobDesc || currentJobDesc.length === 0) && 
        (!currentRequirements || currentRequirements.length === 0) && 
        !currentOverview) {
      return NextResponse.json({
        success: false,
        error: 'At least one of job description, requirements, or overview is required'
      }, { status: 400 });
    }

    // Step 1: Extract keywords for initial database filtering
    const jobDescText = Array.isArray(currentJobDesc) ? currentJobDesc.join(' ') : (typeof currentJobDesc === 'string' ? currentJobDesc : '');
    const requirementsText = Array.isArray(currentRequirements) ? currentRequirements.join(' ') : (typeof currentRequirements === 'string' ? currentRequirements : '');
    const overviewText = currentOverview || '';
    
    // Filter out fallback text that shouldn't be used for keyword extraction
    const filteredJobDesc = jobDescText.includes('No job description selected') ? '' : jobDescText;
    const filteredRequirements = requirementsText.includes('No requirements selected') ? '' : requirementsText;
    const filteredOverview = overviewText.includes('No overview selected') ? '' : overviewText;
    
    const combinedText = `${filteredJobDesc} ${filteredRequirements} ${filteredOverview}`.trim();

    // Extract keywords using simple text processing
    const keywords = extractKeywords(combinedText);
    console.log("Extracted keywords:", keywords);

    // Step 2: Query database for jobs containing these keywords
    const candidateJobs = await findCandidateJobs(keywords, excludeJobId);
    console.log(`Found ${candidateJobs.length} candidate jobs from database`);

    if (candidateJobs.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Step 3: Use Gemini to analyze similarity
    const similarityAnalysis = await analyzeSimilarityWithGemini(
      { jobDesc: currentJobDesc, requirements: currentRequirements, overview: currentOverview },
      candidateJobs
    );

    // Step 4: Sort by similarity and return top 10
    const sortedResults = similarityAnalysis
      .filter(job => job.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    console.log(`Returning ${sortedResults.length} similar jobs`);

    return NextResponse.json({
      success: true,
      data: sortedResults
    });

  } catch (error) {
    console.error('Error in internal matcher API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process internal matching request', 
      details: errorMessage 
    }, { status: 500 });
  }
}

// Extract keywords from text using simple processing
function extractKeywords(text: string): string[] {
  // Return empty array if text is empty or only contains fallback messages
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  // Convert to lowercase and remove special characters
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  
  // Split into words
  const words = cleanText.split(/\s+/).filter(word => word.length > 2);
  
  // Remove common stop words and fallback text words
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'among', 'within', 'without', 'along',
    'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must',
    'have', 'has', 'had', 'having', 'been', 'being', 'are', 'was', 'were',
    'this', 'that', 'these', 'those', 'such', 'some', 'any', 'all', 'each',
    'every', 'other', 'another', 'more', 'most', 'less', 'few', 'many',
    // Add fallback text words to stop words
    'overview', 'selected', 'job', 'description', 'requirements', 'not'
  ]);
  
  const keywords = words.filter(word => !stopWords.has(word));
  
  // Return unique keywords, prioritizing longer ones
  return [...new Set(keywords)].sort((a, b) => b.length - a.length).slice(0, 20);
}

// Find candidate jobs from database using keyword matching
async function findCandidateJobs(keywords: string[], excludeJobId?: string): Promise<any[]> {
  if (keywords.length === 0) {
    console.log('No keywords provided, returning empty results');
    return [];
  }

  try {
    // Use LIKE queries to match ANY keyword in job fields
    // Build OR conditions for each keyword across all searchable fields
    const keywordConditions = keywords.slice(0, 10).map(keyword => {
      const likePattern = `%${keyword}%`;
      return sql`(
        LOWER(${jobVacancies.title}) LIKE LOWER(${likePattern}) OR
        LOWER(${jobVacancies.description}) LIKE LOWER(${likePattern}) OR
        LOWER(${jobVacancies.job_desc}::text) LIKE LOWER(${likePattern}) OR
        LOWER(${jobVacancies.requirements}::text) LIKE LOWER(${likePattern})
      )`;
    });

    // Combine all keyword conditions with OR
    const whereCondition = keywordConditions.reduce((acc, condition, index) => {
      if (index === 0) return condition;
      return sql`${acc} OR ${condition}`;
    });

    console.log(`Searching for jobs with ${keywords.length} keywords: ${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? '...' : ''}`);

    const jobs = await db
      .select({
        id: jobVacancies.id,
        title: jobVacancies.title,
        description: jobVacancies.description,
        job_desc: jobVacancies.job_desc,
        requirements: jobVacancies.requirements,
        dept_id: jobVacancies.deptId,
        department_name: departments.name,
        department_email: departments.email
      })
      .from(jobVacancies)
      .leftJoin(departments, eq(jobVacancies.deptId, departments.id))
      .where(sql`(${whereCondition}) AND ${jobVacancies.status} != 'archived'${excludeJobId ? sql` AND ${jobVacancies.id} != ${excludeJobId}` : sql``}`)
      .limit(20); // Limit to 20 candidates for performance and token limits

    console.log(`Found ${jobs.length} jobs matching keywords`);
    return jobs;
  } catch (error) {
    console.error('Error querying candidate jobs:', error);
    // Final fallback: return a small sample of jobs for analysis
    console.log('Using fallback query to get sample jobs');
    const jobs = await db
      .select({
        id: jobVacancies.id,
        title: jobVacancies.title,
        description: jobVacancies.description,
        job_desc: jobVacancies.job_desc,
        requirements: jobVacancies.requirements,
        dept_id: jobVacancies.deptId,
        department_name: departments.name,
        department_email: departments.email
      })
      .from(jobVacancies)
      .leftJoin(departments, eq(jobVacancies.deptId, departments.id))
      .where(sql`${jobVacancies.status} != 'archived'${excludeJobId ? sql` AND ${jobVacancies.id} != ${excludeJobId}` : sql``}`)
      .limit(20);
    
    return jobs;
  }
}

// Define the response schema for structured output
const similarityResponseSchema = {
  type: "object",
  properties: {
    similarities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The job ID"
          },
          similarity: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Similarity percentage between 0-100"
          }
        },
        required: ["id", "similarity"]
      }
    }
  },
  required: ["similarities"]
};

// Analyze similarity using Gemini
async function analyzeSimilarityWithGemini(
  targetJob: { jobDesc: string[], requirements: string[], overview: string },
  candidateJobs: any[]
): Promise<SimilarJob[]> {
  const prompt = `
You are an expert job matching analyst. Your task is to analyze the similarity between a target job and a list of candidate jobs.

Target Job:
Overview: ${targetJob.overview || 'Not provided'}
Job Descriptions: ${Array.isArray(targetJob.jobDesc) ? targetJob.jobDesc.join(', ') : 'Not provided'}
Requirements: ${Array.isArray(targetJob.requirements) ? targetJob.requirements.join(', ') : 'Not provided'}

Candidate Jobs:
${candidateJobs.map((job, index) => `
Job ${index + 1}:
ID: ${job.id}
Title: ${job.title}
Description: ${job.description}
Job Descriptions: ${Array.isArray(job.job_desc) ? job.job_desc.join(', ') : job.job_desc || 'Not provided'}
Requirements: ${Array.isArray(job.requirements) ? job.requirements.join(', ') : job.requirements || 'Not provided'}
`).join('')}

For each candidate job, analyze the similarity to the target job based on:
1. Job responsibilities and descriptions
2. Required skills and qualifications
3. Overall role scope and level
4. Industry relevance

Provide a similarity percentage (0-100) for each candidate job.
`;

  try {
    const model = genAI!.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: similarityResponseSchema
      } as GenerationConfig,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const candidate = response.candidates && response.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      throw new Error('Gemini API returned empty response');
    }

    const extractedText = candidate.content.parts[0].text;
    let analysisData: any;

    try {
      analysisData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('Failed to parse structured JSON response:', parseError);
      console.error('Raw response:', extractedText);
      throw new Error('Failed to parse structured JSON response from Gemini');
    }

    // Map the similarity results back to the candidate jobs
    const results: SimilarJob[] = candidateJobs.map(job => {
      const similarityData = analysisData.similarities?.find((s: any) => s.id === job.id);
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        job_desc: Array.isArray(job.job_desc) ? job.job_desc : [job.job_desc || ''],
        requirements: Array.isArray(job.requirements) ? job.requirements : [job.requirements || ''],
        similarity: similarityData ? Math.round(similarityData.similarity) : 0,
        dept_id: job.dept_id,
        department_name: job.department_name,
        department_email: job.department_email
      };
    });

    return results;

  } catch (error) {
    console.error('Error in Gemini similarity analysis:', error);
    // Return jobs with 0 similarity if analysis fails
    return candidateJobs.map(job => ({
      id: job.id,
      title: job.title,
      description: job.description,
      job_desc: Array.isArray(job.job_desc) ? job.job_desc : [job.job_desc || ''],
      requirements: Array.isArray(job.requirements) ? job.requirements : [job.requirements || ''],
      similarity: 0,
      dept_id: job.dept_id,
      department_name: job.department_name,
      department_email: job.department_email
    }));
  }
}