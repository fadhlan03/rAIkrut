// Types generated from docs/database_erd.dbml

/**
 * Represents the status of a job application.
 * Possible values can be extended as needed.
 */
export type ApplicationStatus = 
  | 'Pending' 
  | 'Reviewed' 
  | 'Interviewing' 
  | 'Shortlisted'
  | 'Offered' 
  | 'Rejected' 
  | 'Hired'
  | 'Withdrawn'
  | 'On Hold'
  | 'Onboard'
  | 'Auto-Assessed';

/**
 * Schema for the 'users' table.
 * Stores user authentication and profile information.
 */
export interface User {
  id: string; // uuid, primary key
  created_at: string; // timestamp, not null, default: now()
  email: string; // varchar, unique, not null
  password_hash: string; // varchar, not null
  full_name: string; // varchar, not null
  type: 'admin' | 'applicant'; // user_type enum, not null, default: 'applicant'
}

/**
 * Schema for the 'job_vacancies' table.
 * Stores details about job openings.
 */
export interface JobVacancy {
  id: string; // uuid, primary key
  created_at: string; // timestamp, not null, default: now()
  created_by: string; // uuid, foreign key to users.id
  title: string; // varchar, not null
  industry?: string; // varchar, optional - Industry field
  attribute?: string; // varchar, optional - Job attribute field
  description: string; // text, not null
  job_desc?: any; // jsonb, optional - Job description items
  requirements: any; // jsonb, not null - Job requirements
  benefits?: any; // jsonb, optional - List of benefits offered
  info?: string; // text, optional - Additional information (how to apply, what to send, etc.)
  status: string; // varchar, not null, default: 'draft'
  dept_id?: string; // uuid, foreign key to departments.id
  deptId?: string; // uuid, foreign key to departments.id (alias for compatibility)
  jobFamily?: string; // varchar, optional - Job family field
  departmentName?: string; // department name from join (for display purposes)
  deptPosition?: number; // integer, position level in department (1 = highest/manager, 2 = below manager, etc.)
  applicants_count?: number; // New field for applicants count
}

/**
 * Represents an entry for education history.
 */
export interface EducationEntry {
  level: string;
  institution: string;
  major: string;
}

/**
 * Represents an entry for work experience.
 */
export interface WorkExperienceEntry {
  company: string;
  position: string;
  start_date: string; // MMM YYYY
  end_date: string; // MMM YYYY or 'Present'
}

/**
 * Represents an entry for organizational experience.
 */
export interface OrgExperienceEntry {
  organization_name: string;
  role: string;
  start_date: string; // MMM YYYY
  end_date: string; // MMM YYYY or 'Present'
}

/**
 * Schema for the 'candidates' table.
 * Stores information about job applicants.
 */
export interface Candidate {
  id: string; // uuid, primary key
  created_at: string; // timestamp, not null, default: now()
  full_name: string; // varchar, not null
  email: string; // varchar, not null
  phone?: string; // varchar, optional
  birthdate?: string; // date, optional
  job_interest?: any; // jsonb, optional // Consider defining a Zod schema for this
  education?: EducationEntry[]; // jsonb, optional - Ensuring specific type
  work_experience?: WorkExperienceEntry[]; // jsonb, optional - Ensuring specific type
  org_experience?: any; // jsonb, optional // Consider defining a Zod schema for this
  summary?: string; // text, optional

  // New fields for the table display logic
  // Some of these will be populated by the frontend, others will need API updates
  age?: number;
  latest_education_level?: string;
  latest_education_institution?: string;
  latest_company_name?: string;
  latest_work_position?: string;
  has_resume?: boolean; // Requires API update to populate
  job_applications_count?: number; // Requires API update to populate

  // Fields for specific contexts, like displaying applicants for a certain job
  application_status_for_this_job?: ApplicationStatus;
  application_date_for_this_job?: string;
}

/**
 * Schema for the 'resumes' table.
 * Stores candidate resume files and parsed content.
 */
export interface Resume {
  id: string; // uuid, primary key
  created_at: string; // timestamp, not null, default: now()
  candidate_id: string; // uuid, foreign key to candidates.id
  file_url: string; // varchar, not null
  file_name: string; // varchar, not null
  file_type: string; // varchar, not null
  file_size: number; // integer, not null
  parsed_content: any; // jsonb, not null (can be refined to a more specific type)
}

/**
 * Schema for the 'job_applications' table.
 * Links candidates to job vacancies and tracks application status.
 */
export interface JobApplication {
  id: string; // uuid, primary key
  created_at: string; // timestamp, not null, default: now()
  job_id: string; // uuid, foreign key to job_vacancies.id
  candidate_id: string; // uuid, foreign key to candidates.id
  status: ApplicationStatus; // application_status (custom enum/type), not null
}

/**
 * Interface for candidate applications with job details
 * Used in the candidate detail sheet
 */
export interface CandidateApplication {
  application_id: string;
  job_id: string;
  job_title: string;
  status: ApplicationStatus;
  created_at: string;
  overall_score?: number;
  application_date: string;
  referral_name?: string;
  referral_email?: string;
  referral_position?: string;
  referral_dept?: string;
}

/**
 * Schema for the 'scoring_results' table.
 * Stores the automated scoring details for each job application.
 */
export interface ScoringResult {
  id: string; // uuid, primary key
  created_at: string; // timestamp, not null, default: now()
  application_id: string; // uuid, foreign key to job_applications.id
  overall_score: number; // decimal, not null
  overall_summary: string; // text, not null - New column for scoring summary
  experience_score: number; // decimal, not null
  experience_review?: string; // text, optional
  education_score: number; // decimal, not null
  education_review?: string; // text, optional
  skills_score: number; // decimal, not null
  skills_review?: string; // text, optional
  role_fit_score: number; // decimal, not null
  role_fit_review?: string; // text, optional
  certifications_score: number; // decimal, not null
  certifications_review?: string; // text, optional
  project_impact_score: number; // decimal, not null
  project_impact_review?: string; // text, optional
  soft_skills_score: number; // decimal, not null
  soft_skills_review?: string; // text, optional
  decision?: string; // text, optional
  skills_completeness?: any; // jsonb, optional - New column for skills completeness details
}