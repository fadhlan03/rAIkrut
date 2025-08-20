import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  integer,
  jsonb,
  decimal,
  date,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex, // For single column unique constraints often handled by .unique() on column
  boolean, // Added boolean import
} from 'drizzle-orm/pg-core';

// Define ENUM for application status
export const applicationStatusEnum = pgEnum('application_status', [
  'Pending',
  'Reviewed',
  'Interviewing',
  'Shortlisted',
  'Offered',
  'Rejected',
  'Hired',
  'Withdrawn',
  'On Hold',
  'Onboard',
  'Auto-Assessed', // For candidates assessed by the system but not manually applied
]);

// Define ENUM for onboarding completion status
export const onboardingStatusEnum = pgEnum('onboarding_status', [
  'not_started',
  'in_progress',
  'completed',
  'abandoned',
]);

// Define ENUM for user type
export const userTypeEnum = pgEnum('user_type', [
  'admin',
  'applicant',
]);

// Define ENUM for verification status
export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',
  'processing',
  'verified',
  'rejected',
  'failed',
]);

// Users and Authentication
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  email: varchar('email').notNull().unique(),
  passwordHash: varchar('password_hash').notNull(),
  fullName: varchar('full_name').notNull(),
  type: userTypeEnum('type').notNull().default('applicant'),
}, (table) => {
  return {
    emailIdx: index('users_email_idx').on(table.email), // DBML had indexes { email } which is covered by .unique()
                                                     // but explicit index can be added if desired.
                                                     // Drizzle's .unique() often creates an index implicitly.
  };
});

// Departments
export const departments: any = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  name: varchar('name').notNull(),
  description: text('description'),
  email: varchar('email'),
  upperDept: uuid('upper_dept').references(() => departments.id, { onDelete: 'set null', onUpdate: 'cascade' }), // Department this department belongs to/reports to
  lowerDept: jsonb('lower_dept'), // Array of department IDs that this department manages
}, (table) => {
  return {
    nameIdx: index('departments_name_idx').on(table.name),
    upperDeptIdx: index('departments_upper_dept_idx').on(table.upperDept),
  };
});

// Job Vacancies
export const jobVacancies = pgTable('job_vacancies', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  job_desc: jsonb('job_desc'),
  requirements: jsonb('requirements').notNull(),
  benefits: jsonb('benefits'), // List of benefits offered
  info: text('info'), // Additional information (how to apply, what to send, etc.)
  status: varchar('status').notNull().default('draft'),
  attribute: varchar('attribute'), // Additional title or meaningful information regarding the job
  industry: varchar('industry'), // Industry category for the job position
  jobFamily: varchar('job_family'), // Job family categorization (e.g., analytics, engineering, marketing)
  deptId: uuid('dept_id').references(() => departments.id, { onDelete: 'set null', onUpdate: 'cascade' }), // Department this job belongs to
  deptPosition: integer('dept_position'), // Position level in department (1 = highest/manager, 2 = below manager, etc.)
}, (table) => {
  return {
    deptIdIdx: index('job_vacancies_dept_id_idx').on(table.deptId),
  };
});

// Onboarding Content
export const onboardingContent = pgTable('onboarding_content', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  jobId: uuid('job_id').notNull().references(() => jobVacancies.id, { onDelete: 'cascade', onUpdate: 'cascade' }).unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  welcomeContent: jsonb('welcome_content').notNull(), // Welcome screen configuration
  companyContent: jsonb('company_content').notNull(), // Company profile information
  teamMembers: jsonb('team_members').notNull(), // Team structure and members
  formFields: jsonb('form_fields').notNull(), // Dynamic form field configuration
  documents: jsonb('documents').notNull(), // Signing documents configuration
  finishContent: jsonb('finish_content'), // Finish screen content (next steps, resources, etc.)
}, (table) => {
  return {
    jobIdIdx: index('onboarding_content_job_id_idx').on(table.jobId),
  };
});

// Onboarding Completion Tracking
export const onboardingCompletion = pgTable('onboarding_completion', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  onboardingContentId: uuid('onboarding_content_id').notNull().references(() => onboardingContent.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  status: onboardingStatusEnum('status').notNull().default('not_started'),
  completedSteps: jsonb('completed_steps').notNull().default('[]'), // Array of completed step names: ["welcome", "company", "organization", "form", "documents", "finish"]
  formResponses: jsonb('form_responses').notNull().default('{}'), // Store all form input data from onboarding form
  currentStep: varchar('current_step').default('welcome'), // Track current step: welcome, company, organization, form, documents, finish
  startedAt: timestamp('started_at', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
}, (table) => {
  return {
    candidateOnboardingUniqueIdx: uniqueIndex('onboarding_completion_candidate_onboarding_idx').on(table.candidateId, table.onboardingContentId),
    candidateIdIdx: index('onboarding_completion_candidate_id_idx').on(table.candidateId),
    onboardingContentIdIdx: index('onboarding_completion_onboarding_content_id_idx').on(table.onboardingContentId),
  };
});

// Candidates
export const candidates = pgTable('candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  fullName: varchar('full_name').notNull(),
  email: varchar('email').notNull(),
  phone: varchar('phone'),
  birthdate: date('birthdate', { mode: 'string' }),
  jobInterest: jsonb('job_interest'), // Consider defining a Zod schema for this
  education: jsonb('education'), // Consider defining a Zod schema for this
  workExperience: jsonb('work_experience'), // Consider defining a Zod schema for this
  orgExperience: jsonb('org_experience'), // Consider defining a Zod schema for this
  summary: text('summary'), // New column for candidate summary
}, (table) => {
  return {
    emailIdx: index('candidates_email_idx').on(table.email), // DBML: indexes { email }
  };
});

// Resumes
export const resumes = pgTable('resumes', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  fileUrl: varchar('file_url').notNull(),
  fileName: varchar('file_name').notNull(),
  fileType: varchar('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  parsedContent: jsonb('parsed_content').notNull(), // Consider defining a Zod schema for this if structure is known
}, (table) => {
  return {
    candidateIdIdx: index('resumes_candidate_id_idx').on(table.candidateId), // DBML: indexes { candidate_id }
  };
});

// Job Applications
export const jobApplications = pgTable('job_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  jobId: uuid('job_id').notNull().references(() => jobVacancies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  status: applicationStatusEnum('status').notNull(),
  referralName: varchar('referral_name'),
  referralEmail: varchar('referral_email'),
  referralPosition: varchar('referral_position'),
  referralDept: varchar('referral_dept'),
}, (table) => {
  return {
    jobCandidateUniqueIdx: uniqueIndex('job_applications_job_id_candidate_id_idx').on(table.jobId, table.candidateId), // DBML: indexes { (job_id, candidate_id) }
                                                                                                      // Assuming this should be a unique constraint
  };
});

// Scoring Results
export const scoringResults = pgTable('scoring_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  applicationId: uuid('application_id').notNull().references(() => jobApplications.id, { onDelete: 'cascade', onUpdate: 'cascade' }).unique(), // Assuming one scoring result per application
  overallScore: decimal('overall_score', { precision: 5, scale: 2 }).notNull(),
  overallSummary: text('overall_summary').notNull(),
  experienceScore: decimal('experience_score', { precision: 5, scale: 2 }).notNull(),
  experienceReview: text('experience_review'),
  educationScore: decimal('education_score', { precision: 5, scale: 2 }).notNull(),
  educationReview: text('education_review'),
  skillsScore: decimal('skills_score', { precision: 5, scale: 2 }).notNull(),
  skillsReview: text('skills_review'),
  roleFitScore: decimal('role_fit_score', { precision: 5, scale: 2 }).notNull(),
  roleFitReview: text('role_fit_review'),
  certificationsScore: decimal('certifications_score', { precision: 5, scale: 2 }).notNull(),
  certificationsReview: text('certifications_review'),
  projectImpactScore: decimal('project_impact_score', { precision: 5, scale: 2 }).notNull(),
  projectImpactReview: text('project_impact_review'),
  softSkillsScore: decimal('soft_skills_score', { precision: 5, scale: 2 }).notNull(),
  softSkillsReview: text('soft_skills_review'),
  decision: text('decision'),
  skillsCompleteness: jsonb('skills_completeness'), // New column for skills completeness details
}, (table) => {
  return {
    // applicationIdIdx: index('scoring_results_application_id_idx').on(table.applicationId), // .unique() on column already creates an index
  };
});

// Recordings
export const recordings = pgTable('recordings', {
  id: uuid('id').defaultRandom().primaryKey(),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
  transcript: jsonb('transcript'),
  uri: varchar('uri', { length: 255 }),
  speakerMetadata: jsonb('speaker_metadata'),
  duration: integer('duration'),
  uploadStatus: varchar('upload_status', { length: 50 }),
});

// Reports
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
  answers: jsonb('answers'),
  clarity: jsonb('clarity'),
  relevance: jsonb('relevance'),
  depth: jsonb('depth'),
  commStyle: jsonb('comm_style'),
  culturalFit: jsonb('cultural_fit'),
  attentionToDetail: jsonb('attention_to_detail'),
  languageProficiency: jsonb('language_proficiency'),
  starMethod: jsonb('star_method'), // STAR method evaluation (Situation, Task, Action, Result)
});

// Calls
export const calls = pgTable('calls', {
  id: uuid('id').defaultRandom().primaryKey(),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  applicationId: uuid('application_id').references(() => jobApplications.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  systemPrompt: text('system_prompt'),
  notes: text('notes'),
  recordingId: uuid('recording_id').references(() => recordings.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  result: varchar('result', { length: 50 }),
  challenge_verified: boolean('challenge_verified').default(false).notNull(),
  conversationId: text('conversation_id'), // ElevenLabs Conversational AI conversation ID
}, (table) => {
  return {
    applicationIdx: index('calls_application_id_idx').on(table.applicationId),
  };
});

// Candidate Verifications
export const candidateVerifications = pgTable('candidate_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  candidateId: uuid('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  
  // Original reference media (from /verify - user's ID)
  originalVideoUrl: varchar('original_video_url', { length: 512 }),
  originalPhotoUrl: varchar('original_photo_url', { length: 512 }),
  originalAudioUrl: varchar('original_audio_url', { length: 512 }),
  
  // Test media (from /verify/test - for verification against original)
  testVideoUrl: varchar('test_video_url', { length: 512 }),
  testPhotoUrl: varchar('test_photo_url', { length: 512 }),
  testAudioUrl: varchar('test_audio_url', { length: 512 }),
  
  // Verification status and scores
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('pending'),
  deepfakeScore: decimal('deepfake_score', { precision: 5, scale: 2 }),
  faceVerificationScore: decimal('face_verification_score', { precision: 5, scale: 2 }),
  voiceVerificationScore: decimal('voice_verification_score', { precision: 5, scale: 2 }),
  
  // Analysis metadata and results
  verificationMetadata: jsonb('verification_metadata'),
  rejectionReason: text('rejection_reason'),
  verifiedAt: timestamp('verified_at', { mode: 'string' }),
  
  // Timestamps for different stages
  originalMediaUploadedAt: timestamp('original_media_uploaded_at', { mode: 'string' }),
  testMediaUploadedAt: timestamp('test_media_uploaded_at', { mode: 'string' }),
}, (table) => {
  return {
    candidateIdIdx: index('candidate_verifications_candidate_id_idx').on(table.candidateId),
    statusIdx: index('candidate_verifications_status_idx').on(table.verificationStatus),
    createdAtIdx: index('candidate_verifications_created_at_idx').on(table.createdAt),
  };
});

// Job Search Benchmarks
export const jobSearchBenchmarks = pgTable('job_search_benchmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  searchRoleName: varchar('search_role_name').notNull(),
  searchIndustry: varchar('search_industry').notNull(),
  creativity: decimal('creativity', { precision: 3, scale: 1 }).notNull(), // Store temperature value
  results: jsonb('results').notNull(), // Store the complete benchmark results
  groundingMetadata: jsonb('grounding_metadata'), // Store references and search queries
}, (table) => {
  return {
    userIdIdx: index('job_search_benchmarks_user_id_idx').on(table.userId),
    timestampIdx: index('job_search_benchmarks_timestamp_idx').on(table.timestamp),
  };
});

// Example of how you might get types (optional, Drizzle provides these implicitly)
// import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
//
// export type User = InferSelectModel<typeof users>;
// export type NewUser = InferInsertModel<typeof users>;
//
// export type JobVacancy = InferSelectModel<typeof jobVacancies>;
// export type NewJobVacancy = InferInsertModel<typeof jobVacancies>;
// ... and so on for all tables