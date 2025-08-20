"use server";

import { db } from "@/lib/db-client";
import { jobVacancies, onboardingContent, candidates, jobApplications, jobSearchBenchmarks, departments } from "@/db/schema";
import { JobVacancy } from "@/types/database";
import { sql, eq, desc } from "drizzle-orm";
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export async function getJobVacancies(): Promise<JobVacancy[]> {
  try {
    const result = await db.execute(sql`
      SELECT
        jv.id,
        jv.created_at,
        jv.created_by,
        jv.title,
        jv.description,
        jv.job_desc,
        jv.requirements,
        jv.benefits,
        jv.info,
        jv.status,
        jv.attribute,
        jv.industry,
        jv.dept_id,
        jv.job_family,
        jv.dept_position,
        COUNT(ja.id) AS applicants_count
      FROM
        job_vacancies jv
      LEFT JOIN
        job_applications ja ON jv.id = ja.job_id
      GROUP BY
        jv.id, jv.dept_id, jv.dept_position
      ORDER BY
        jv.created_at DESC;
    `);

    const jobVacanciesWithCount = result.rows.map((row: any) => ({
        ...row,
        applicants_count: parseInt(row.applicants_count, 10) || 0, 
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
         job_desc: typeof row.job_desc === 'string' ? JSON.parse(row.job_desc) : row.job_desc,
         requirements: typeof row.requirements === 'string' ? JSON.parse(row.requirements) : row.requirements,
         benefits: typeof row.benefits === 'string' ? JSON.parse(row.benefits) : row.benefits,
         deptId: row.dept_id,
         jobFamily: row.job_family,
         deptPosition: row.dept_position,
      })) as JobVacancy[];

    return jobVacanciesWithCount;
  } catch (error) {
    console.error("Error fetching job vacancies with applicant counts:", error);
    // Return empty array or throw error based on how you want to handle this in the UI
    // throw new Error("Failed to load job vacancies."); 
    return []; // Return empty array on error
  }
}

export async function getPublishedJobVacancies(): Promise<JobVacancy[]> {
  try {
    const result = await db.execute(sql`
      SELECT
        jv.id,
        jv.created_at,
        jv.created_by,
        jv.title,
        jv.description,
        jv.job_desc,
        jv.requirements,
        jv.benefits,
        jv.info,
        jv.status,
        jv.attribute,
        jv.industry,
        jv.dept_id,
        jv.job_family,
        jv.dept_position,
        COUNT(ja.id) AS applicants_count
      FROM
        job_vacancies jv
      LEFT JOIN
        job_applications ja ON jv.id = ja.job_id
      WHERE
        jv.status = 'published'
      GROUP BY
        jv.id, jv.dept_id, jv.dept_position
      ORDER BY
        jv.created_at DESC;
    `);

    const jobVacanciesWithCount = result.rows.map((row: any) => ({
        ...row,
        applicants_count: parseInt(row.applicants_count, 10) || 0, 
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
         job_desc: typeof row.job_desc === 'string' ? JSON.parse(row.job_desc) : row.job_desc,
         requirements: typeof row.requirements === 'string' ? JSON.parse(row.requirements) : row.requirements,
         benefits: typeof row.benefits === 'string' ? JSON.parse(row.benefits) : row.benefits,
         deptId: row.dept_id,
         jobFamily: row.job_family,
         deptPosition: row.dept_position,
      })) as JobVacancy[];

    return jobVacanciesWithCount;
  } catch (error) {
    console.error("Error fetching published job vacancies:", error);
    return []; // Return empty array on error
  }
}

// Updated Schema for creating a job vacancy
const CreateJobServerSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  industry: z.string().optional(),
  attribute: z.string().optional(),
  deptId: z.string().optional(),
  jobFamily: z.string().optional(),
  description: z.string().min(10, "Overview must be at least 10 characters"),
  job_desc: z.array(z.string().min(1, "Description item cannot be empty")).min(1, "At least one job description item is required"),
  requirements: z.array(z.string().min(1, "Requirement item cannot be empty")).min(1, "At least one requirement is required"),
  benefits: z.array(z.string().min(1, "Benefit cannot be empty")).optional(),
  info: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
});

// Type for the input payload, inferred from the server schema
export type CreateJobPayload = z.infer<typeof CreateJobServerSchema>;

// Schema for auto-saving a job draft with partial data
const AutoSaveJobDraftSchema = z.object({
  id: z.string().uuid("Invalid job ID").optional(), // Optional for new drafts
  title: z.string().optional(),
  industry: z.string().optional(),
  attribute: z.string().optional(),
  deptId: z.string().optional(),
  jobFamily: z.string().optional(),
  description: z.string().optional(),
  job_desc: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  info: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  isNewJob: z.boolean().optional(), // Flag to indicate if this is a new job creation
  hasBeenManuallySaved: z.boolean().optional(), // Flag to indicate if job has been manually saved
});

export type AutoSaveJobDraftPayload = z.infer<typeof AutoSaveJobDraftSchema>;

// Server action to auto-save a job draft
export async function autoSaveJobDraft(payload: AutoSaveJobDraftPayload) {
  console.log("Auto-saving job draft:", payload);
  const validatedFields = AutoSaveJobDraftSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Auto-save validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { id, isNewJob, hasBeenManuallySaved, status, ...data } = validatedFields.data;
  const createdBy = "93a0cd60-44f7-4968-be63-0d8e76972a53"; // Hardcoded user ID

  try {
    // If id exists, update the existing job
    if (id) {
      // Determine the status to use for auto-save
      let autoSaveStatus: string | undefined;
      
      if (status) {
        // If status is provided, use it (preserves current status)
        autoSaveStatus = status;
      } else {
        // If no status provided, don't update the status field (preserve existing)
        autoSaveStatus = undefined;
      }

      // Convert empty strings to null for UUID fields
      const deptIdValue = data.deptId && data.deptId.trim() !== '' ? data.deptId : null;
      const jobFamilyValue = data.jobFamily && data.jobFamily.trim() !== '' ? data.jobFamily : null;

      const result = await db.execute(sql`
        UPDATE job_vacancies 
        SET 
          title = COALESCE(${data.title}, title),
          industry = COALESCE(${data.industry}, industry),
          attribute = COALESCE(${data.attribute}, attribute),
          dept_id = COALESCE(${deptIdValue}, dept_id),
          job_family = COALESCE(${jobFamilyValue}, job_family),
          description = COALESCE(${data.description}, description),
          job_desc = CASE WHEN ${data.job_desc ? true : false} THEN ${data.job_desc ? JSON.stringify(data.job_desc) : null} ELSE job_desc END,
          requirements = CASE WHEN ${data.requirements ? true : false} THEN ${data.requirements ? JSON.stringify(data.requirements) : null} ELSE requirements END,
          benefits = CASE WHEN ${data.benefits ? true : false} THEN ${data.benefits ? JSON.stringify(data.benefits) : null} ELSE benefits END,
          info = COALESCE(${data.info}, info)
          ${autoSaveStatus ? sql`, status = ${autoSaveStatus}` : sql``}
        WHERE id = ${id}
        RETURNING id
      `);

      if (result.rows.length === 0) {
        return { success: false, message: "Job not found" };
      }

      return { success: true, message: "Job updated", id };
    } 
    // Otherwise create a new draft
    else {
      // Only create if we have at least one field with data
      if (!data.title && !data.description && (!data.job_desc || data.job_desc.length === 0) && 
          (!data.requirements || data.requirements.length === 0)) {
        return { success: false, message: "No data to save" };
      }

      // Determine status for new job auto-save
      let newJobStatus = 'draft'; // Default status
      
      if (isNewJob && !hasBeenManuallySaved) {
        // New job that hasn't been manually saved should be archived
        newJobStatus = 'archived';
      } else if (status) {
        // Use provided status if available
        newJobStatus = status;
      }

      // Convert empty strings to null for UUID fields
      const deptIdValue = data.deptId && data.deptId.trim() !== '' ? data.deptId : null;
      const jobFamilyValue = data.jobFamily && data.jobFamily.trim() !== '' ? data.jobFamily : null;

      const result = await db.insert(jobVacancies).values({
        title: data.title || "Untitled Job",
        industry: data.industry || undefined,
        attribute: data.attribute || undefined,
        deptId: deptIdValue,
        jobFamily: jobFamilyValue,
        description: data.description || "",
        job_desc: data.job_desc || [],
        requirements: data.requirements || [],
        benefits: data.benefits || undefined,
        info: data.info || undefined,
        status: newJobStatus,
        createdBy: createdBy,
      }).returning({ id: jobVacancies.id });

      const newId = result[0]?.id;
      const statusMessage = newJobStatus === 'archived' ? 'Job auto-saved' : 'New draft created';
      return { success: true, message: statusMessage, id: newId, status: newJobStatus };
    }
  } catch (error: any) {
    console.error("Error auto-saving job draft:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to save draft"}` };
  }
}

// Updated server action to accept a JSON payload
export async function createJobVacancy(payload: CreateJobPayload) {
  console.log("Received payload in server action:", payload);
  const validatedFields = CreateJobServerSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Job validation failed on server:", validatedFields.error.flatten().fieldErrors);
    // Return a more structured error or throw an error with specific details
    // This allows the client to potentially display specific field errors
    return { success: false, message: "Validation failed. Please check the form fields.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { title, industry, attribute, deptId, jobFamily, description, job_desc, requirements, benefits, info, status } = validatedFields.data;
  const createdBy = "93a0cd60-44f7-4968-be63-0d8e76972a53"; // Hardcoded user ID

  try {
    await db.insert(jobVacancies).values({
      title,
      industry: industry || undefined,
      attribute: attribute || undefined,
      deptId: deptId || undefined,
      jobFamily: jobFamily || undefined,
      description,
      // Drizzle ORM will handle serializing the array to JSON for jsonb columns
      job_desc: job_desc, 
      requirements: requirements,
      benefits: benefits || undefined,
      info: info || undefined,
      status: status,
      createdBy: createdBy,
    });

    console.log("Job vacancy created successfully:", title);
    revalidatePath('/jobs'); 

    return { success: true, message: "Job created successfully!" };

  } catch (error: any) {
    console.error("Error creating job vacancy in DB:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to create job vacancy."}` };
  }
}

// Schema for updating job status
const UpdateJobStatusSchema = z.object({
  jobId: z.string().uuid("Invalid job ID"),
  status: z.enum(['draft', 'published', 'archived']),
});

export type UpdateJobStatusPayload = z.infer<typeof UpdateJobStatusSchema>;

// Server action to update job status
export async function updateJobStatus(payload: UpdateJobStatusPayload) {
  console.log("Received status update payload:", payload);
  const validatedFields = UpdateJobStatusSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Status update validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Invalid request data.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { jobId, status } = validatedFields.data;

  try {
    const result = await db.execute(sql`
      UPDATE job_vacancies 
      SET status = ${status}
      WHERE id = ${jobId}
      RETURNING id, status
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Job not found." };
    }

    console.log("Job status updated successfully:", { jobId, status });
    revalidatePath('/jobs');
    revalidatePath(`/jobs/${jobId}`);

    return { success: true, message: `Job status updated to ${status}!` };

  } catch (error: any) {
    console.error("Error updating job status:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to update job status."}` };
  }
}

// Schema for updating a job vacancy
const UpdateJobServerSchema = z.object({
  jobId: z.string().uuid("Invalid job ID"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  industry: z.string().optional(),
  attribute: z.string().optional(),
  deptId: z.string().optional(),
  jobFamily: z.string().optional(),
  description: z.string().min(10, "Overview must be at least 10 characters"),
  job_desc: z.array(z.string().min(1, "Description item cannot be empty")).min(1, "At least one job description item is required"),
  requirements: z.array(z.string().min(1, "Requirement item cannot be empty")).min(1, "At least one requirement is required"),
  benefits: z.array(z.string().min(1, "Benefit cannot be empty")).optional(),
  info: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
});

export type UpdateJobPayload = z.infer<typeof UpdateJobServerSchema>;

// Server action to update a job vacancy
export async function updateJobVacancy(payload: UpdateJobPayload) {
  console.log("Received job update payload:", payload);
  const validatedFields = UpdateJobServerSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Job update validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed. Please check the form fields.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { jobId, title, industry, attribute, deptId, jobFamily, description, job_desc, requirements, benefits, info, status } = validatedFields.data;

  try {
    // Convert empty strings to null for UUID fields
    const deptIdValue = deptId && deptId.trim() !== '' ? deptId : null;
    const attributeValue = attribute && attribute.trim() !== '' ? attribute : null;
    const industryValue = industry && industry.trim() !== '' ? industry : null;
    const jobFamilyValue = jobFamily && jobFamily.trim() !== '' ? jobFamily : null;
    
    const result = await db.execute(sql`
      UPDATE job_vacancies 
      SET 
        title = ${title},
        industry = ${industryValue},
        attribute = ${attributeValue},
        dept_id = ${deptIdValue},
        job_family = ${jobFamilyValue},
        description = ${description},
        job_desc = ${JSON.stringify(job_desc)},
        requirements = ${JSON.stringify(requirements)},
        benefits = ${benefits && benefits.length > 0 ? JSON.stringify(benefits) : null},
        info = ${info || null},
        status = ${status}
      WHERE id = ${jobId}
      RETURNING id, title
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Job not found." };
    }

    console.log("Job updated successfully:", { jobId, title });
    revalidatePath('/jobs');
    revalidatePath(`/jobs/${jobId}`);

    return { success: true, message: "Job updated successfully!" };

  } catch (error: any) {
    console.error("Error updating job vacancy:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to update job vacancy."}` };
  }
}

// Schema for creating a job vacancy from benchmark data
const CreateJobFromBenchmarkSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  selectedResponsibilities: z.array(z.string().min(1, "Responsibility cannot be empty")).min(1, "At least one responsibility must be selected"),
  industry: z.string().min(1, "Industry is required"),
});

export type CreateJobFromBenchmarkPayload = z.infer<typeof CreateJobFromBenchmarkSchema>;

// Server action to create a job vacancy from benchmark data
export async function createJobFromBenchmark(payload: CreateJobFromBenchmarkPayload) {
  console.log("Received benchmark job payload:", payload);
  const validatedFields = CreateJobFromBenchmarkSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Benchmark job validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed. Please check the form fields.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { title, selectedResponsibilities, industry } = validatedFields.data;
  const createdBy = "93a0cd60-44f7-4968-be63-0d8e76972a53"; // Hardcoded user ID

  // Create a description based on the industry and role
  const description = `We are looking for a ${title} to join our ${industry} team. This role offers an opportunity to work with industry-leading practices and contribute to our organization's growth.`;

  try {
    await db.insert(jobVacancies).values({
      title,
      description,
      // Use selected responsibilities as job description
      job_desc: selectedResponsibilities, 
      // Create generic requirements array
      requirements: [
        "Bachelor's degree in relevant field or equivalent experience",
        "Strong communication and collaboration skills",
        "Ability to work in a fast-paced environment",
        "Problem-solving and analytical thinking capabilities"
      ], 
      status: 'draft', // Always create as draft
      createdBy: createdBy,
    });

    console.log("Job vacancy from benchmark created successfully:", title);
    revalidatePath('/jobs'); 
    revalidatePath('/benchmarks');

    return { success: true, message: "Job created successfully from benchmark data!" };

  } catch (error: any) {
    console.error("Error creating job vacancy from benchmark:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to create job vacancy."}` };
  }
}

// ============ ONBOARDING CONTENT ACTIONS ============

// Schema for onboarding content data types
const WelcomeContentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().min(1, "Subtitle is required"),
  description: z.string().min(1, "Description is required"),
  roleTitle: z.string().min(1, "Role title is required"),
  department: z.string().min(1, "Department is required"),
  startDate: z.string().min(1, "Start date is required"),
  manager: z.string().min(1, "Manager is required"),
  keyPoints: z.array(z.string().min(1, "Key point cannot be empty")).min(1, "At least one key point is required"),
});

const CompanyContentSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  foundedYear: z.string().min(1, "Founded year is required"),
  description: z.string().min(1, "Description is required"),
  mission: z.string().min(1, "Mission is required"),
  vision: z.string().min(1, "Vision is required"),
  values: z.array(z.string().min(1, "Value cannot be empty")).min(1, "At least one value is required"),
  stats: z.object({
    customers: z.string().min(1, "Customers stat is required"),
    countries: z.string().min(1, "Countries stat is required"),
    employees: z.string().min(1, "Employees stat is required"),
    revenue: z.string().min(1, "Revenue stat is required"),
  }),
  techStack: z.array(z.string().min(1, "Tech stack item cannot be empty")),
});

const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  department: z.string().min(1, "Department is required"),
  email: z.string().email("Valid email is required"),
  bio: z.string().min(1, "Bio is required"),
});

const FormFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label is required"),
  type: z.enum(['text', 'email', 'phone', 'select', 'textarea', 'date']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

const DocumentSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  type: z.enum(['contract', 'policy', 'agreement', 'handbook', 'other']),
  description: z.string().min(1, "Description is required"),
  required: z.boolean(),
  content: z.string().min(1, "Content is required"),
});

const FinishContentSchema = z.object({
  nextSteps: z.array(z.string()),
  resources: z.array(z.object({
    title: z.string(),
    description: z.string(),
    url: z.string().optional(),
  })),
  teamContacts: z.array(z.object({
    name: z.string(),
    role: z.string(),
    email: z.string().email(),
  })),
  message: z.string().optional(),
}).optional();

// Schema for creating/updating onboarding content
const OnboardingContentSchema = z.object({
  jobId: z.string().uuid("Invalid job ID"),
  welcomeContent: WelcomeContentSchema,
  companyContent: CompanyContentSchema,
  teamMembers: z.array(TeamMemberSchema).min(1, "At least one team member is required"),
  formFields: z.array(FormFieldSchema).min(1, "At least one form field is required"),
  documents: z.array(DocumentSchema).min(1, "At least one document is required"),
  finishContent: FinishContentSchema,
});

export type OnboardingContentPayload = z.infer<typeof OnboardingContentSchema>;

// Get onboarding content by job ID
export async function getOnboardingContent(jobId: string) {
  try {
    const result = await db.execute(sql`
      SELECT * FROM onboarding_content 
      WHERE job_id = ${jobId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Onboarding content not found for this job." };
    }

    const content = result.rows[0] as any;
    
    return { 
      success: true, 
      data: {
        id: content.id,
        jobId: content.job_id,
        welcomeContent: typeof content.welcome_content === 'string' 
          ? JSON.parse(content.welcome_content) 
          : content.welcome_content,
        companyContent: typeof content.company_content === 'string' 
          ? JSON.parse(content.company_content) 
          : content.company_content,
        teamMembers: typeof content.team_members === 'string' 
          ? JSON.parse(content.team_members) 
          : content.team_members,
        formFields: typeof content.form_fields === 'string' 
          ? JSON.parse(content.form_fields) 
          : content.form_fields,
        documents: typeof content.documents === 'string' 
          ? JSON.parse(content.documents) 
          : content.documents,
        finishContent: content.finish_content 
          ? (typeof content.finish_content === 'string' 
              ? JSON.parse(content.finish_content) 
              : content.finish_content)
          : null,
        createdAt: content.created_at,
        updatedAt: content.updated_at,
      }
    };
  } catch (error: any) {
    console.error("Error fetching onboarding content:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to fetch onboarding content."}` };
  }
}

// Create onboarding content
export async function createOnboardingContent(payload: OnboardingContentPayload) {
  console.log("Received onboarding content payload:", payload);
  const validatedFields = OnboardingContentSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Onboarding content validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed. Please check all required fields.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { jobId, welcomeContent, companyContent, teamMembers, formFields, documents, finishContent } = validatedFields.data;
  const createdBy = "93a0cd60-44f7-4968-be63-0d8e76972a53"; // Hardcoded user ID

  try {
    await db.insert(onboardingContent).values({
      jobId,
      createdBy,
      welcomeContent: welcomeContent,
      companyContent: companyContent,
      teamMembers: teamMembers,
      formFields: formFields,
      documents: documents,
      finishContent: finishContent || null,
    });

    console.log("Onboarding content created successfully for job:", jobId);
    revalidatePath('/onboarding');

    return { success: true, message: "Onboarding content created successfully!" };

  } catch (error: any) {
    console.error("Error creating onboarding content:", error);
    if (error.message && error.message.includes('unique')) {
      return { success: false, message: "Onboarding content already exists for this job. Please update it instead." };
    }
    return { success: false, message: `Database error: ${error.message || "Failed to create onboarding content."}` };
  }
}

// Update onboarding content
export async function updateOnboardingContent(payload: OnboardingContentPayload) {
  console.log("Received onboarding content update payload:", payload);
  const validatedFields = OnboardingContentSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Onboarding content update validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed. Please check all required fields.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { jobId, welcomeContent, companyContent, teamMembers, formFields, documents, finishContent } = validatedFields.data;

  try {
    const result = await db.execute(sql`
      UPDATE onboarding_content 
      SET 
        welcome_content = ${JSON.stringify(welcomeContent)},
        company_content = ${JSON.stringify(companyContent)},
        team_members = ${JSON.stringify(teamMembers)},
        form_fields = ${JSON.stringify(formFields)},
        documents = ${JSON.stringify(documents)},
        finish_content = ${finishContent ? JSON.stringify(finishContent) : null},
        updated_at = NOW()
      WHERE job_id = ${jobId}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Onboarding content not found for this job." };
    }

    console.log("Onboarding content updated successfully for job:", jobId);
    revalidatePath('/onboarding');

    return { success: true, message: "Onboarding content updated successfully!" };

  } catch (error: any) {
    console.error("Error updating onboarding content:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to update onboarding content."}` };
  }
}

// Get available onboarding content for applicants
export async function getAvailableOnboardingContent() {
  try {
    const result = await db.execute(sql`
      SELECT 
        oc.id,
        oc.job_id,
        oc.created_at,
        oc.updated_at,
        oc.welcome_content,
        jv.title as job_title,
        jv.description as job_description,
        jv.status as job_status
      FROM onboarding_content oc
      INNER JOIN job_vacancies jv ON oc.job_id = jv.id
      WHERE jv.status = 'published'
      ORDER BY oc.created_at DESC
    `);

    const availableContent = result.rows.map((row: any) => ({
      id: row.id,
      jobId: row.job_id,
      jobTitle: row.job_title,
      jobDescription: row.job_description,
      jobStatus: row.job_status,
      welcomeContent: typeof row.welcome_content === 'string' 
        ? JSON.parse(row.welcome_content) 
        : row.welcome_content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, data: availableContent };
  } catch (error: any) {
    console.error("Error fetching available onboarding content:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to fetch available onboarding content."}` };
  }
}

// Onboarding Completion Tracking Actions

// Get or create onboarding completion record
export async function getOrCreateOnboardingCompletion(candidateId: string, onboardingContentId: string) {
  try {
    // First try to get existing record
    const existingResult = await db.execute(sql`
      SELECT 
        id,
        candidate_id,
        onboarding_content_id,
        status,
        completed_steps,
        form_responses,
        current_step,
        started_at,
        completed_at,
        created_at,
        updated_at
      FROM onboarding_completion 
      WHERE candidate_id = ${candidateId} AND onboarding_content_id = ${onboardingContentId}
    `);

    if (existingResult.rows.length > 0) {
      const row = existingResult.rows[0] as any;
      return { 
        success: true, 
        data: {
          id: row.id,
          candidateId: row.candidate_id,
          onboardingContentId: row.onboarding_content_id,
          status: row.status,
          completedSteps: typeof row.completed_steps === 'string' 
            ? JSON.parse(row.completed_steps) 
            : row.completed_steps,
          formResponses: typeof row.form_responses === 'string' 
            ? JSON.parse(row.form_responses) 
            : row.form_responses,
          currentStep: row.current_step,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      };
    }

    // Create new record if none exists
    const newResult = await db.execute(sql`
      INSERT INTO onboarding_completion (
        candidate_id,
        onboarding_content_id,
        status,
        completed_steps,
        form_responses,
        current_step,
        started_at
      ) VALUES (
        ${candidateId},
        ${onboardingContentId},
        'in_progress',
        '[]'::jsonb,
        '{}'::jsonb,
        'welcome',
        NOW()
      )
      RETURNING id, candidate_id, onboarding_content_id, status, completed_steps, form_responses, current_step, started_at, created_at, updated_at
    `);

    const newRow = newResult.rows[0] as any;
    return { 
      success: true, 
      data: {
        id: newRow.id,
        candidateId: newRow.candidate_id,
        onboardingContentId: newRow.onboarding_content_id,
        status: newRow.status,
        completedSteps: typeof newRow.completed_steps === 'string' 
          ? JSON.parse(newRow.completed_steps) 
          : newRow.completed_steps,
        formResponses: typeof newRow.form_responses === 'string' 
          ? JSON.parse(newRow.form_responses) 
          : newRow.form_responses,
        currentStep: newRow.current_step,
        startedAt: newRow.started_at,
        completedAt: null,
        createdAt: newRow.created_at,
        updatedAt: newRow.updated_at,
      }
    };

  } catch (error: any) {
    console.error("Error getting/creating onboarding completion:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to get/create onboarding completion."}` };
  }
}

// Update onboarding progress
interface UpdateOnboardingProgressPayload {
  completionId: string;
  currentStep: string;
  completedSteps: string[];
  formResponses?: any;
  status?: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
}

export async function updateOnboardingProgress(payload: UpdateOnboardingProgressPayload) {
  try {
    const { completionId, currentStep, completedSteps, formResponses, status } = payload;

    let updateQuery = sql`
      UPDATE onboarding_completion 
      SET 
        current_step = ${currentStep},
        completed_steps = ${JSON.stringify(completedSteps)},
        updated_at = NOW()
    `;

    // Add optional fields if provided
    if (formResponses) {
      updateQuery = sql`
        UPDATE onboarding_completion 
        SET 
          current_step = ${currentStep},
          completed_steps = ${JSON.stringify(completedSteps)},
          form_responses = ${JSON.stringify(formResponses)},
          updated_at = NOW()
      `;
    }

    if (status) {
      updateQuery = sql`
        UPDATE onboarding_completion 
        SET 
          current_step = ${currentStep},
          completed_steps = ${JSON.stringify(completedSteps)},
          ${formResponses ? sql`form_responses = ${JSON.stringify(formResponses)},` : sql``}
          status = ${status},
          ${status === 'completed' ? sql`completed_at = NOW(),` : sql``}
          updated_at = NOW()
      `;
    }

    updateQuery = sql`${updateQuery} WHERE id = ${completionId} RETURNING id`;

    const result = await db.execute(updateQuery);

    if (result.rows.length === 0) {
      return { success: false, message: "Onboarding completion record not found." };
    }

    console.log("Onboarding progress updated successfully for completion:", completionId);
    revalidatePath('/onboard');

    return { success: true, message: "Progress saved successfully!" };

  } catch (error: any) {
    console.error("Error updating onboarding progress:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to update progress."}` };
  }
}

// Complete onboarding step
export async function completeOnboardingStep(completionId: string, step: string, formData?: any) {
  try {
    // First get current state
    const currentResult = await db.execute(sql`
      SELECT completed_steps, form_responses, current_step 
      FROM onboarding_completion 
      WHERE id = ${completionId}
    `);

    if (currentResult.rows.length === 0) {
      return { success: false, message: "Onboarding completion record not found." };
    }

    const current = currentResult.rows[0] as any;
    const completedSteps = typeof current.completed_steps === 'string' 
      ? JSON.parse(current.completed_steps) 
      : current.completed_steps;
    const formResponses = typeof current.form_responses === 'string' 
      ? JSON.parse(current.form_responses) 
      : current.form_responses;

    // Add step to completed steps if not already there
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    // Update form responses if provided
    if (formData) {
      Object.assign(formResponses, formData);
    }

    // Determine next step
    const stepOrder = ['welcome', 'company', 'organization', 'form', 'documents', 'finish'];
    const currentIndex = stepOrder.indexOf(step);
    const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : 'finish';
    
    // Check if all steps are completed
    const allStepsCompleted = stepOrder.every(s => completedSteps.includes(s));
    const status = allStepsCompleted ? 'completed' : 'in_progress';

    await updateOnboardingProgress({
      completionId,
      currentStep: nextStep,
      completedSteps,
      formResponses,
      status
    });

    return { success: true, message: "Step completed successfully!" };

  } catch (error: any) {
    console.error("Error completing onboarding step:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to complete step."}` };
  }
}

export async function getUserApplicationsByEmail(email: string): Promise<string[]> {
  try {
    // First, find the candidate with this email
    const candidate = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.email, email))
      .limit(1);

    if (candidate.length === 0) {
      // No candidate found, user hasn't applied to any jobs yet
      return [];
    }

    const candidateId = candidate[0].id;

    // Get all job IDs this candidate has applied to
    const applications = await db
      .select({ jobId: jobApplications.jobId })
      .from(jobApplications)
      .where(eq(jobApplications.candidateId, candidateId));

    return applications.map(app => app.jobId);
  } catch (error) {
    console.error("Error fetching user applications by email:", error);
    return [];
  }
}

// ============ JOB SEARCH BENCHMARK ACTIONS ============

// Schema for saving job search benchmark data
const SaveJobSearchBenchmarkSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  searchRoleName: z.string().min(1, "Role name is required"),
  searchIndustry: z.string().min(1, "Industry is required"),
  creativity: z.number().min(0).max(1).transform(val => String(val)), // Transform to string for DB compatibility
  results: z.any(), // This will store the complete benchmark results
  groundingMetadata: z.any().optional(), // Store references and search queries
});

export type SaveJobSearchBenchmarkPayload = z.infer<typeof SaveJobSearchBenchmarkSchema>;

// Server action to save job search benchmark data
export async function saveJobSearchBenchmark(payload: SaveJobSearchBenchmarkPayload) {
  console.log("Saving job search benchmark:", payload);
  const validatedFields = SaveJobSearchBenchmarkSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Job search benchmark validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { userId, searchRoleName, searchIndustry, creativity, results, groundingMetadata } = validatedFields.data;

  try {
    const result = await db.insert(jobSearchBenchmarks).values({
      userId,
      searchRoleName,
      searchIndustry,
      creativity, // Schema transform handles conversion
      results,
      groundingMetadata,
    }).returning({ id: jobSearchBenchmarks.id });

    const benchmarkId = result[0]?.id;
    console.log("Job search benchmark saved successfully:", { benchmarkId, searchRoleName, searchIndustry });

    return { success: true, message: "Job search benchmark saved successfully", benchmarkId };
  } catch (error: any) {
    console.error("Error saving job search benchmark:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to save job search benchmark."}` };
  }
}

// Server action to get job search benchmarks for a user
export async function getJobSearchBenchmarks(userId: string) {
  try {
    const benchmarks = await db.query.jobSearchBenchmarks.findMany({
      where: eq(jobSearchBenchmarks.userId, userId),
      orderBy: [desc(jobSearchBenchmarks.timestamp)],
    });

    return { success: true, data: benchmarks };
  } catch (error: any) {
    console.error("Error fetching job search benchmarks:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to fetch job search benchmarks."}` };
  }
}

// ============ DASHBOARD STATISTICS ACTIONS ============

// Interface for dashboard statistics
export interface DashboardStats {
  totalApplicants: number;
  candidatesByStatus: {
    Pending: number;
    Reviewed: number;
    Interviewing: number;
    Shortlisted: number;
    Offered: number;
    Rejected: number;
    Hired: number;
    Withdrawn: number;
    'On Hold': number;
    Onboard: number;
    'Auto-Assessed': number;
  };
  jobWithMostApplicants: {
    count: number;
    jobTitle: string;
  };
  averageApplicantsPerJob: number;
}

// Server action to get dashboard statistics
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Get total applicants count
    const totalApplicantsResult = await db.execute(sql`
      SELECT COUNT(*) as total_applicants
      FROM job_applications
    `);
    const totalApplicants = parseInt(totalApplicantsResult.rows[0]?.total_applicants as string, 10) || 0;

    // Get candidates by status (all statuses from enum)
    const candidatesByStatusResult = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM job_applications 
      GROUP BY status
    `);

    const candidatesByStatus = {
      Pending: 0,
      Reviewed: 0,
      Interviewing: 0,
      Shortlisted: 0,
      Offered: 0,
      Rejected: 0,
      Hired: 0,
      Withdrawn: 0,
      'On Hold': 0,
      Onboard: 0,
      'Auto-Assessed': 0,
    };

    candidatesByStatusResult.rows.forEach((row: any) => {
      const status = row.status as keyof typeof candidatesByStatus;
      if (status in candidatesByStatus) {
        candidatesByStatus[status] = parseInt(row.count as string, 10) || 0;
      }
    });

    // Get job with most applicants
    const jobWithMostApplicantsResult = await db.execute(sql`
      SELECT 
        jv.title,
        COUNT(ja.id) as applicant_count
      FROM job_vacancies jv
      LEFT JOIN job_applications ja ON jv.id = ja.job_id
      GROUP BY jv.id, jv.title
      ORDER BY applicant_count DESC
      LIMIT 1
    `);

    const jobWithMostApplicants = {
      count: 0,
      jobTitle: "No jobs found",
    };

    if (jobWithMostApplicantsResult.rows.length > 0) {
      const row = jobWithMostApplicantsResult.rows[0] as any;
      jobWithMostApplicants.count = parseInt(row.applicant_count as string, 10) || 0;
      jobWithMostApplicants.jobTitle = row.title || "Untitled Job";
    }

    // Calculate average applicants per job
    const totalJobsResult = await db.execute(sql`
      SELECT COUNT(*) as total_jobs
      FROM job_vacancies
    `);
    const totalJobs = parseInt(totalJobsResult.rows[0]?.total_jobs as string, 10) || 0;
    const averageApplicantsPerJob = totalJobs > 0 ? Math.round((totalApplicants / totalJobs) * 100) / 100 : 0;

    return {
      totalApplicants,
      candidatesByStatus,
      jobWithMostApplicants,
      averageApplicantsPerJob,
    };
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    // Return default values on error
    return {
      totalApplicants: 0,
      candidatesByStatus: {
        Pending: 0,
        Reviewed: 0,
        Interviewing: 0,
        Shortlisted: 0,
        Offered: 0,
        Rejected: 0,
        Hired: 0,
        Withdrawn: 0,
        'On Hold': 0,
        Onboard: 0,
        'Auto-Assessed': 0,
      },
      jobWithMostApplicants: {
        count: 0,
        jobTitle: "No jobs found",
      },
      averageApplicantsPerJob: 0,
    };
  }
}

// ============ DEPARTMENT ACTIONS ============

// Interface for department data
export interface Department {
  id: string;
  created_at: string;
  created_by: string;
  name: string;
  description: string | null;
  email: string | null;
  upper_dept: string | null;
  lower_dept: string[] | null;
  jobs?: JobVacancy[];
}

// Schema for creating a department
const CreateDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
  email: z.string().email().optional(),
  upper_dept: z.string().uuid().optional(),
});

export type CreateDepartmentPayload = z.infer<typeof CreateDepartmentSchema>;

// Schema for updating a department
const UpdateDepartmentSchema = z.object({
  id: z.string().uuid("Invalid department ID"),
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
  email: z.string().email().optional().nullable(),
  upper_dept: z.string().uuid().optional().nullable(),
});

export type UpdateDepartmentPayload = z.infer<typeof UpdateDepartmentSchema>;

// Server action to get all departments
export async function getDepartments(): Promise<Department[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.created_at,
        d.created_by,
        d.name,
        d.description,
        d.email,
        d.upper_dept,
        d.lower_dept
      FROM departments d
      ORDER BY d.name ASC
    `);

    const departments = result.rows.map((row: any) => ({
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      lower_dept: typeof row.lower_dept === 'string' ? JSON.parse(row.lower_dept) : row.lower_dept,
    })) as Department[];

    return departments;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}

// Server action to get unique job families from the database
export async function getJobFamilies(): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT job_family
      FROM job_vacancies
      WHERE job_family IS NOT NULL AND job_family != ''
      ORDER BY job_family ASC
    `);

    const jobFamilies = result.rows.map((row: any) => row.job_family).filter(Boolean) as string[];
    return jobFamilies;
  } catch (error) {
    console.error("Error fetching job families:", error);
    return [];
  }
}

// Server action to create a department
export async function createDepartment(payload: CreateDepartmentPayload) {
  console.log("Creating department:", payload);
  const validatedFields = CreateDepartmentSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Department validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { name, description, email, upper_dept } = validatedFields.data;
  const createdBy = "93a0cd60-44f7-4968-be63-0d8e76972a53"; // Hardcoded user ID

  try {
    // Check if upper department exists (basic validation for create)
    if (upper_dept) {
      const upperDeptResult = await db.execute(sql`
        SELECT id FROM departments WHERE id = ${upper_dept}
      `);
      
      if (upperDeptResult.rows.length === 0) {
        return { success: false, message: "Selected upper department does not exist." };
      }
    }
    const result = await db.execute(sql`
      INSERT INTO departments (name, description, email, upper_dept, created_by, lower_dept)
      VALUES (${name}, ${description || null}, ${email || null}, ${upper_dept || null}, ${createdBy}, '[]'::jsonb)
      RETURNING id, name
    `);

    const newDepartment = result.rows[0] as any;
    
    // If this department has an upper department, update the upper department's lower_dept array
    if (upper_dept) {
      await db.execute(sql`
        UPDATE departments 
        SET lower_dept = COALESCE(lower_dept, '[]'::jsonb) || ${JSON.stringify([newDepartment.id])}::jsonb
        WHERE id = ${upper_dept}
      `);
    }

    console.log("Department created successfully:", newDepartment.name);
    revalidatePath('/organization');

    return { success: true, message: "Department created successfully!", id: newDepartment.id };
  } catch (error: any) {
    console.error("Error creating department:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to create department."}` };
  }
}

// Helper function to check for circular dependencies
async function wouldCreateCircularDependency(departmentId: string, newUpperDeptId: string): Promise<boolean> {
  if (!newUpperDeptId) return false;
  
  // Can't set self as upper department
  if (departmentId === newUpperDeptId) return true;
  
  // Check if the new upper department has the current department in its ancestry
  let currentId = newUpperDeptId;
  const visited = new Set<string>();
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    
    // If we find the department we're trying to update in the ancestry chain, it's circular
    if (currentId === departmentId) {
      return true;
    }
    
    // Get the upper department of the current department
    const result = await db.execute(sql`
      SELECT upper_dept FROM departments WHERE id = ${currentId}
    `);
    
    if (result.rows.length === 0) break;
    
    currentId = (result.rows[0] as any).upper_dept;
  }
  
  return false;
}

// Server action to update a department
export async function updateDepartment(payload: UpdateDepartmentPayload) {
  console.log("Updating department:", payload);
  const validatedFields = UpdateDepartmentSchema.safeParse(payload);

  if (!validatedFields.success) {
    console.error("Department update validation failed:", validatedFields.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { id, name, description, email, upper_dept } = validatedFields.data;

  try {
    // Check for circular dependency before proceeding
    if (upper_dept) {
      const wouldBeCircular = await wouldCreateCircularDependency(id, upper_dept);
      if (wouldBeCircular) {
        return { 
          success: false, 
          message: "Cannot set this department as upper department: it would create a circular dependency in the organization structure." 
        };
      }
    }

    // Get current department data
    const currentResult = await db.execute(sql`
      SELECT upper_dept FROM departments WHERE id = ${id}
    `);
    
    if (currentResult.rows.length === 0) {
      return { success: false, message: "Department not found" };
    }

    const currentUpperDept = (currentResult.rows[0] as any).upper_dept;

    // Update the department
    const result = await db.execute(sql`
      UPDATE departments 
      SET 
        name = ${name},
        description = ${description || null},
        email = ${email || null},
        upper_dept = ${upper_dept || null}
      WHERE id = ${id}
      RETURNING id, name
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Department not found" };
    }

    // Handle upper department changes
    if (currentUpperDept !== upper_dept) {
      // Remove from old upper department's lower_dept array
      if (currentUpperDept) {
        await db.execute(sql`
          UPDATE departments 
          SET lower_dept = (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements_text(COALESCE(lower_dept, '[]'::jsonb)) elem
            WHERE elem != ${id}
          )
          WHERE id = ${currentUpperDept}
        `);
      }

      // Add to new upper department's lower_dept array
      if (upper_dept) {
        await db.execute(sql`
          UPDATE departments 
          SET lower_dept = COALESCE(lower_dept, '[]'::jsonb) || ${JSON.stringify([id])}::jsonb
          WHERE id = ${upper_dept}
        `);
      }
    }

    console.log("Department updated successfully:", name);
    revalidatePath('/organization');

    return { success: true, message: "Department updated successfully!" };
  } catch (error: any) {
    console.error("Error updating department:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to update department."}` };
  }
}

// Server action to get valid upper departments for a specific department
export async function getValidUpperDepartments(departmentId: string): Promise<Department[]> {
  try {
    // Get all departments
    const allDepartments = await getDepartments();
    
    // Helper function to get all descendants
    const getAllDescendants = (deptId: string, departments: Department[]): string[] => {
      const descendants: string[] = [];
      const children = departments.filter(dept => dept.upper_dept === deptId);
      
      for (const child of children) {
        descendants.push(child.id);
        descendants.push(...getAllDescendants(child.id, departments));
      }
      
      return descendants;
    };
    
    // Get descendants of the department
    const descendants = getAllDescendants(departmentId, allDepartments);
    
    // Filter out self and descendants
    const validDepartments = allDepartments.filter(dept => 
      dept.id !== departmentId && // Can't set self as upper
      !descendants.includes(dept.id) // Can't set any descendant as upper
    );
    
    return validDepartments;
  } catch (error) {
    console.error("Error fetching valid upper departments:", error);
    return [];
  }
}

// Server action to delete a department
export async function deleteDepartment(departmentId: string) {
  console.log("Deleting department:", departmentId);

  try {
    // Get department data before deletion
    const deptResult = await db.execute(sql`
      SELECT upper_dept, lower_dept FROM departments WHERE id = ${departmentId}
    `);
    
    if (deptResult.rows.length === 0) {
      return { success: false, message: "Department not found" };
    }

    const dept = deptResult.rows[0] as any;
    const upperDept = dept.upper_dept;
    const lowerDepts = typeof dept.lower_dept === 'string' ? JSON.parse(dept.lower_dept) : dept.lower_dept;

    // Remove from upper department's lower_dept array
    if (upperDept) {
      await db.execute(sql`
        UPDATE departments 
        SET lower_dept = (
          SELECT jsonb_agg(elem)
          FROM jsonb_array_elements_text(COALESCE(lower_dept, '[]'::jsonb)) elem
          WHERE elem != ${departmentId}
        )
        WHERE id = ${upperDept}
      `);
    }

    // Update lower departments to remove upper_dept reference
    if (lowerDepts && Array.isArray(lowerDepts)) {
      for (const lowerDeptId of lowerDepts) {
        await db.execute(sql`
          UPDATE departments 
          SET upper_dept = NULL
          WHERE id = ${lowerDeptId}
        `);
      }
    }

    // Delete the department
    const result = await db.execute(sql`
      DELETE FROM departments WHERE id = ${departmentId}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Department not found" };
    }

    console.log("Department deleted successfully:", departmentId);
    revalidatePath('/organization');

    return { success: true, message: "Department deleted successfully!" };
  } catch (error: any) {
    console.error("Error deleting department:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to delete department."}` };
  }
}

// Server action to add job to department
export async function addJobToDepartment(departmentId: string, jobId: string, position: string) {
  console.log("Adding job to department:", { departmentId, jobId, position });

  try {
    const result = await db.execute(sql`
      UPDATE job_vacancies 
      SET 
        dept_id = ${departmentId},
        dept_position = ${parseInt(position)}
      WHERE id = ${jobId}
      RETURNING id, title
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Job not found" };
    }

    console.log("Job added to department successfully:", result.rows[0]);
    revalidatePath('/organization');

    return { success: true, message: "Job added to department successfully!" };
  } catch (error: any) {
    console.error("Error adding job to department:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to add job to department."}` };
  }
}

// Server action to remove job from department
export async function removeJobFromDepartment(jobId: string) {
  console.log("Removing job from department:", jobId);

  try {
    const result = await db.execute(sql`
      UPDATE job_vacancies 
      SET 
        dept_id = NULL,
        dept_position = NULL
      WHERE id = ${jobId}
      RETURNING id, title
    `);

    if (result.rows.length === 0) {
      return { success: false, message: "Job not found" };
    }

    console.log("Job removed from department successfully:", result.rows[0]);
    revalidatePath('/organization');

    return { success: true, message: "Job removed from department successfully!" };
  } catch (error: any) {
    console.error("Error removing job from department:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to remove job from department."}` };
  }
}

// Server action to reorder jobs within a department
export async function reorderJobsInDepartment(jobUpdates: { jobId: string; position: number }[]) {
  console.log("Reordering jobs in department:", jobUpdates);

  try {
    // Update all job positions in a transaction
    for (const update of jobUpdates) {
      await db.execute(sql`
        UPDATE job_vacancies 
        SET dept_position = ${update.position}
        WHERE id = ${update.jobId}
      `);
    }

    console.log("Jobs reordered successfully");
    revalidatePath('/organization');

    return { success: true, message: "Jobs reordered successfully!" };
  } catch (error: any) {
    console.error("Error reordering jobs:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to reorder jobs."}` };
  }
}

const BulkUpdateJobsSchema = z.object({
  jobIds: z.array(z.string().uuid("Invalid job ID")).min(1, "At least one job must be selected"),
  deptId: z.string().optional(),
  jobFamily: z.string().optional(),
});

export type BulkUpdateJobsPayload = z.infer<typeof BulkUpdateJobsSchema>;

export async function bulkUpdateJobs(payload: BulkUpdateJobsPayload) {
  try {
    const validatedData = BulkUpdateJobsSchema.parse(payload);
    const { jobIds, deptId, jobFamily } = validatedData;

    // Build update object with only provided fields
    const updateData: any = {};
    if (deptId !== undefined) updateData.deptId = deptId;
    if (jobFamily !== undefined) updateData.jobFamily = jobFamily;

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: "No fields to update" };
    }

    // Update all selected jobs
    for (const jobId of jobIds) {
      await db.update(jobVacancies)
        .set(updateData)
        .where(eq(jobVacancies.id, jobId));
    }

    console.log(`Bulk updated ${jobIds.length} jobs successfully`);
    revalidatePath('/organization');

    return { success: true, message: `Successfully updated ${jobIds.length} job(s)!` };
  } catch (error: any) {
    console.error("Error bulk updating jobs:", error);
    return { success: false, message: `Database error: ${error.message || "Failed to update jobs."}` };
  }
}