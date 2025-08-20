export interface AssessmentSection {
  summary: string; // Brief justification for the score
  score: 1 | 2 | 3 | 4 | 5; // Numerical score based on the rubric
}

export interface RequirementCheckItem {
  requirement: string;
  status: "Yes" | "No" | "Unclear";
  reasoning?: string; // Optional: LLM can provide a brief reason for its Yes/No/Unclear status
}

export interface ResumeAssessment {
  overallScore?: number; // Weighted average score
  overallSummary?: string; // General summary of the assessment
  experience: AssessmentSection;
  education: AssessmentSection;
  skills: AssessmentSection;
  roleFit: AssessmentSection;
  certifications: AssessmentSection;
  projectImpact: AssessmentSection;
  softSkills: AssessmentSection;
  requirementsCheck?: RequirementCheckItem[]; // New field for specific requirements
  // You can add other specific sections if needed
}

// --- Detailed Rubric for LLM Prompting ---

export const GENERAL_SCORING_RUBRIC = `
General Scoring Rubric (1-5 Scale):
- Score 1 (Little to No Evidence): The resume shows little to no relevant information or evidence for this dimension. Significant gaps or missing information related to the job description's requirements.
- Score 2 (Some Evidence, Significant Gaps): Some relevant information is present, but there are significant gaps, shortcomings, or a lack of depth. The evidence is weak or doesn't align well with the job description.
- Score 3 (Meets Basic Expectations): The resume provides sufficient evidence to meet the basic expectations for this dimension as outlined in the job description. Competency is demonstrated, but without exceptional strengths.
- Score 4 (Exceeds Basic Expectations): The resume demonstrates strong evidence, clearly exceeding basic expectations. The candidate shows notable strengths and achievements relevant to this dimension and the job description.
- Score 5 (Outstanding, Far Exceeds Expectations): The resume provides exceptional and compelling evidence, far exceeding expectations. The candidate showcases outstanding achievements, qualifications, or alignment in this dimension, making them a top-tier fit for the role in this aspect.
`;

export interface ScoringDimensionConfig {
  id: keyof Omit<ResumeAssessment, 'overallScore' | 'overallSummary' | 'requirementsCheck'>;
  displayName: string;
  weight: number;
  descriptionForLLM: string; // General guidance for the LLM on what to look for
  score5Criteria: string; // Specific, detailed criteria for achieving a top score of 5
}

export const SCORING_DIMENSIONS_CONFIG: ScoringDimensionConfig[] = [
  {
    id: "experience",
    displayName: "Relevant Experience",
    weight: 0.2,
    descriptionForLLM: "Assess the candidate\'s professional experience in relation to the requirements outlined in the Job Description (JD). Consider the relevance of roles, duration, responsibilities, and quality of companies/organizations (if discernible). Focus on alignment with required and preferred experience in the JD.",
    score5Criteria: "Candidate demonstrates outstanding experience by: (a) having 5 or more years of highly relevant experience directly applicable to the JD\'s core responsibilities, OR (b) showcasing experience in Tier-1/leading firms known for high standards in the relevant industry/domain. The experience clearly shows a progression and significant contributions in roles similar to the one described in the JD."
  },
  {
    id: "education",
    displayName: "Education & Qualifications",
    weight: 0.1,
    descriptionForLLM: "Evaluate the candidate\'s educational background, including degrees, institutions, and relevant coursework or academic achievements, against the educational requirements in the JD. Consider the level and field of study.",
    score5Criteria: "Candidate possesses outstanding educational qualifications by: (a) holding a Master's or PhD in a field highly relevant to the JD, OR (b) having graduated with a Bachelor\'s degree (or higher) from a globally recognized top-tier university in a relevant discipline. Academic achievements should be notable if mentioned."
  },
  {
    id: "skills",
    displayName: "Technical & Professional Skills",
    weight: 0.15,
    descriptionForLLM: "Identify and evaluate the candidate\'s skills (technical, domain-specific, and other professional skills) against those explicitly and implicitly required in the JD. Look for evidence of proficiency and application of these skills.",
    score5Criteria: "Candidate demonstrates exceptional skill alignment by matching 80% or more of the critical skills explicitly listed in the Job Description. The resume provides clear, context-rich examples or statements suggesting a high level of proficiency in these matched skills."
  },
  {
    id: "roleFit",
    displayName: "Role Fit & Keyword Alignment",
    weight: 0.25,
    descriptionForLLM: "Assess the overall alignment of the candidate\'s profile with the specific role described in the JD, focusing on keyword overlap for core responsibilities, technologies, and required competencies. This measures direct relevance beyond general experience or skills.",
    score5Criteria: "Candidate exhibits an outstanding role fit by achieving 90% or greater keyword and conceptual overlap with the core responsibilities, requirements, and technologies mentioned in the Job Description. The resume reads as if it were tailored specifically for this role, indicating a deep understanding of the requirements."
  },
  {
    id: "certifications",
    displayName: "Certifications & Licenses",
    weight: 0.1,
    descriptionForLLM: "Review any professional certifications or licenses held by the candidate. Assess their relevance to the job role, issuing authority, and recency (if applicable).",
    score5Criteria: "Candidate holds two or more highly relevant, recognized professional certifications pertinent to the JD, which are current (e.g., obtained or renewed within the last 3-5 years, depending on industry standards). The certifications should be from reputable bodies and directly enhance qualifications for the role."
  },
  {
    id: "projectImpact",
    displayName: "Project Impact & Achievements",
    weight: 0.15,
    descriptionForLLM: "Look for evidence of the candidate\'s contributions to projects, particularly those that resulted in measurable outcomes or quantifiable achievements. Assess the scale, complexity, and impact of these projects.",
    score5Criteria: "Candidate clearly describes specific projects with quantified Key Performance Indicator (KPI) improvements or significant, measurable positive outcomes (e.g., \'increased revenue by X%\', \'reduced operational costs by Y%\', \'led a project impacting Z users\'). The impact should be directly attributable to the candidate\'s actions."
  },
  {
    id: "softSkills",
    displayName: "Soft Skills & Communication",
    weight: 0.05,
    descriptionForLLM: "Evaluate indications of soft skills such as leadership, teamwork, communication, problem-solving, etc., as inferred from project descriptions, roles, or specific achievements mentioned in the resume. Align with any soft skills explicitly or implicitly valued in the JD.",
    score5Criteria: "Candidate\'s resume provides clear evidence of exemplary soft skills through explicit mentions of leadership roles (e.g., \'led a team of X members\', \'managed project Y\'), communication achievements (e.g., \'awarded for best presentation\', \'authored N publications\'), or other recognitions directly related to crucial soft skills for the role specified in the JD."
  }
];

// Function to calculate overall weighted score (example)
export function calculateOverallScore(assessment: ResumeAssessment, config: ScoringDimensionConfig[]): number {
  let totalScore = 0;
  let totalWeight = 0;

  config.forEach(dimension => {
    const section = assessment[dimension.id];
    if (section && typeof section === 'object' && 'score' in section && typeof section.score === 'number') {
      totalScore += section.score * dimension.weight;
      totalWeight += dimension.weight;
    }
  });

  return totalWeight > 0 ? parseFloat((totalScore / totalWeight).toFixed(2)) : 0;
} 