import { NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { candidates as candidatesTable, resumes as resumesTable, jobApplications as jobApplicationsTable } from '@/db/schema';
import { Candidate, EducationEntry, WorkExperienceEntry } from '@/types/database';
import { sql, eq, countDistinct, and, or, ilike } from 'drizzle-orm';
import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

interface SemanticSearchParams {
  skills?: string[];
  experience_years?: number;
  education_level?: string;
  company_keywords?: string[];
  position_keywords?: string[];
  general_keywords?: string[];
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Use Gemini to translate natural language to structured query
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.2, // Lower temperature for more deterministic results
        maxOutputTokens: 1024, // Limit output size
        responseMimeType: 'application/json',
        responseSchema: {
          type: "object",
          properties: {
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Technical skills, programming languages, frameworks, tools (max 5 items)',
              maxItems: 5
            },
            experience_years: {
              type: 'number',
              description: 'Minimum years of experience required'
            },
            education_level: {
              type: 'string',
              description: 'Education level (e.g., Bachelor, Master, PhD, High School)'
            },
            company_keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Company names or types of companies (max 3 items)',
              maxItems: 3
            },
            position_keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Job titles, roles, positions (max 3 items)',
              maxItems: 3
            },
            general_keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Other relevant keywords for general search (max 3 items)',
              maxItems: 3
            }
          }
        }
      } as GenerationConfig
    });

    const prompt = `
Analyze this job search query and extract structured search parameters:
"${query}"

Extract relevant information for:
- skills: Technical skills, programming languages, frameworks, tools mentioned (limit to 5 most relevant skills maximum)
- experience_years: Minimum years of experience (extract numbers like "3+ years", "5 years", etc.)
- education_level: Education requirements (Bachelor, Master, PhD, etc.)
- company_keywords: Specific companies or company types mentioned (limit to 3 maximum)
- position_keywords: Job titles, roles, or positions mentioned (limit to 3 maximum)
- general_keywords: Other relevant search terms (limit to 3 maximum)

Only include fields that are explicitly mentioned or strongly implied in the query.
For experience_years, extract the minimum number (e.g., "3+ years" = 3, "5-7 years" = 5).
Be very selective and concise with keywords - only include the most relevant terms.
`;

    // Create a promise with timeout for the Gemini API call
    const generateWithTimeout = async (timeoutMs = 10000) => {
      let timeoutId: NodeJS.Timeout;
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Gemini API request timed out. Query may be too complex.'));
        }, timeoutMs);
      });
      
      try {
        const resultPromise = model.generateContent(prompt);
        const result = await Promise.race([resultPromise, timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
      } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
      }
    };
    
    let result;
    try {
      result = await generateWithTimeout();
    } catch (error) {
      console.error('Gemini API error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to process query. Please try a simpler search.' },
        { status: 500 }
      );
    }
    
    // Handle potential JSON parsing errors
    let searchParams: SemanticSearchParams = {};
    try {
      const responseText = result.response.text();
      searchParams = JSON.parse(responseText);
      
      // Enforce limits on array sizes to prevent performance issues
      if (searchParams.skills && searchParams.skills.length > 5) {
        searchParams.skills = searchParams.skills.slice(0, 5);
      }
      if (searchParams.company_keywords && searchParams.company_keywords.length > 3) {
        searchParams.company_keywords = searchParams.company_keywords.slice(0, 3);
      }
      if (searchParams.position_keywords && searchParams.position_keywords.length > 3) {
        searchParams.position_keywords = searchParams.position_keywords.slice(0, 3);
      }
      if (searchParams.general_keywords && searchParams.general_keywords.length > 3) {
        searchParams.general_keywords = searchParams.general_keywords.slice(0, 3);
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      console.error('Response text:', result.response.text().substring(0, 500) + '...');
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try a simpler query.' },
        { status: 500 }
      );
    }

    // Build dynamic SQL query based on extracted parameters
    const conditions = [];

    // Skills search (in work experience, education, or summary)
    if (searchParams.skills && searchParams.skills.length > 0) {
      const skillConditions = searchParams.skills.map(skill => 
        or(
          sql`${candidatesTable.workExperience}::text ILIKE ${`%${skill}%`}`,
          sql`${candidatesTable.education}::text ILIKE ${`%${skill}%`}`,
          ilike(candidatesTable.summary, `%${skill}%`)
        )
      );
      conditions.push(or(...skillConditions));
    }

    // Education level search
    if (searchParams.education_level) {
      conditions.push(sql`${candidatesTable.education}::text ILIKE ${`%${searchParams.education_level}%`}`);
    }

    // Company keywords search
    if (searchParams.company_keywords && searchParams.company_keywords.length > 0) {
      const companyConditions = searchParams.company_keywords.map(company => 
        or(
          sql`${candidatesTable.workExperience}::text ILIKE ${`%${company}%`}`,
          ilike(candidatesTable.summary, `%${company}%`)
        )
      );
      conditions.push(or(...companyConditions));
    }

    // Position keywords search
    if (searchParams.position_keywords && searchParams.position_keywords.length > 0) {
      const positionConditions = searchParams.position_keywords.map(position => 
        or(
          sql`${candidatesTable.workExperience}::text ILIKE ${`%${position}%`}`,
          ilike(candidatesTable.jobInterest, `%${position}%`),
          ilike(candidatesTable.summary, `%${position}%`)
        )
      );
      conditions.push(or(...positionConditions));
    }

    // General keywords search (search across all text fields)
    if (searchParams.general_keywords && searchParams.general_keywords.length > 0) {
      const generalConditions = searchParams.general_keywords.map(keyword => 
        or(
          ilike(candidatesTable.fullName, `%${keyword}%`),
          sql`${candidatesTable.workExperience}::text ILIKE ${`%${keyword}%`}`,
          sql`${candidatesTable.education}::text ILIKE ${`%${keyword}%`}`,
          ilike(candidatesTable.jobInterest, `%${keyword}%`),
          ilike(candidatesTable.summary, `%${keyword}%`)
        )
      );
      conditions.push(or(...generalConditions));
    }

    // If no conditions were generated, return empty results
    if (conditions.length === 0) {
      return NextResponse.json({
        candidates: [],
        searchParams,
        totalCount: 0
      });
    }

    // Execute the search query
    const dbCandidatesData = await db
      .select({
        id: candidatesTable.id,
        createdAt: candidatesTable.createdAt,
        fullName: candidatesTable.fullName,
        email: candidatesTable.email,
        phone: candidatesTable.phone,
        birthdate: candidatesTable.birthdate,
        jobInterest: candidatesTable.jobInterest,
        education: candidatesTable.education,
        workExperience: candidatesTable.workExperience,
        orgExperience: candidatesTable.orgExperience,
        summary: candidatesTable.summary,
        has_resume: sql<boolean>`EXISTS (SELECT 1 FROM ${resumesTable} WHERE ${resumesTable.candidateId} = ${candidatesTable.id})`.as('has_resume'),
        job_applications_count: countDistinct(jobApplicationsTable.id).as('job_applications_count'),
      })
      .from(candidatesTable)
      .leftJoin(resumesTable, eq(candidatesTable.id, resumesTable.candidateId))
      .leftJoin(jobApplicationsTable, eq(candidatesTable.id, jobApplicationsTable.candidateId))
      .where(and(...conditions))
      .groupBy(
        candidatesTable.id,
        candidatesTable.createdAt,
        candidatesTable.fullName,
        candidatesTable.email,
        candidatesTable.phone,
        candidatesTable.birthdate,
        candidatesTable.jobInterest,
        candidatesTable.education,
        candidatesTable.workExperience,
        candidatesTable.orgExperience,
        candidatesTable.summary
      );

    // Transform to expected format
    const candidates: Candidate[] = dbCandidatesData.map(c => ({
      id: c.id,
      created_at: c.createdAt,
      full_name: c.fullName,
      email: c.email,
      phone: c.phone || undefined,
      birthdate: c.birthdate || undefined,
      job_interest: c.jobInterest,
      education: c.education as EducationEntry[] | undefined,
      work_experience: c.workExperience as WorkExperienceEntry[] | undefined,
      org_experience: c.orgExperience,
      summary: c.summary ?? undefined,
      has_resume: c.has_resume,
      job_applications_count: c.job_applications_count,
      // Add processed fields for frontend compatibility
      latest_education_level: extractEducationLevel(JSON.stringify(c.education)),
      latest_education_institution: extractEducationInstitution(JSON.stringify(c.education)),
      latest_company_name: extractLatestCompany(JSON.stringify(c.workExperience)),
      latest_work_position: extractLatestPosition(JSON.stringify(c.workExperience))
    }));

    // Apply experience years filter if specified (post-processing)
    let filteredCandidates = candidates;
    if (searchParams.experience_years) {
      filteredCandidates = candidates.filter(candidate => {
        const experienceYears = extractExperienceYears(JSON.stringify(candidate.work_experience));
        return experienceYears >= searchParams.experience_years!;
      });
    }

    return NextResponse.json({
      candidates: filteredCandidates,
      searchParams,
      totalCount: filteredCandidates.length
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform semantic search' },
      { status: 500 }
    );
  }
}

// Helper functions to extract information from text fields
function extractEducationLevel(education: string | null): string {
  if (!education) return '';
  const levels = ['PhD', 'Master', 'Bachelor', 'Associate', 'High School'];
  for (const level of levels) {
    if (education.toLowerCase().includes(level.toLowerCase())) {
      return level;
    }
  }
  return '';
}

function extractEducationInstitution(education: string | null): string {
  if (!education) return '';
  // Simple extraction - take first line or sentence that might be institution name
  const lines = education.split('\n').filter(line => line.trim());
  return lines[0] || '';
}

function extractLatestCompany(workExperience: string | null): string {
  if (!workExperience) return '';
  // Simple extraction - take first line that might contain company name
  const lines = workExperience.split('\n').filter(line => line.trim());
  return lines[0] || '';
}

function extractLatestPosition(workExperience: string | null): string {
  if (!workExperience) return '';
  // Look for common job title patterns
  const lines = workExperience.split('\n').filter(line => line.trim());
  for (const line of lines) {
    if (line.toLowerCase().includes('developer') || 
        line.toLowerCase().includes('engineer') ||
        line.toLowerCase().includes('manager') ||
        line.toLowerCase().includes('analyst') ||
        line.toLowerCase().includes('designer')) {
      return line.trim();
    }
  }
  return lines[0] || '';
}

function extractExperienceYears(workExperience: string | null): number {
  if (!workExperience) return 0;
  
  // Look for patterns like "3 years", "5+ years", "2-4 years"
  const yearPatterns = [
    /([0-9]+)\+?\s*years?/gi,
    /([0-9]+)\s*-\s*[0-9]+\s*years?/gi,
    /([0-9]+)\s*yr/gi
  ];
  
  for (const pattern of yearPatterns) {
    const matches = workExperience.match(pattern);
    if (matches) {
      const numbers = matches[0].match(/([0-9]+)/);
      if (numbers) {
        return parseInt(numbers[1]);
      }
    }
  }
  
  // Fallback: count number of job entries as rough experience estimate
  const jobEntries = workExperience.split('\n').filter(line => 
    line.trim() && (line.includes('-') || line.includes('at') || line.includes('@'))
  );
  return Math.min(jobEntries.length * 2, 10); // Assume 2 years per job, max 10
}