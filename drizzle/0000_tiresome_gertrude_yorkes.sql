CREATE TYPE "public"."application_status" AS ENUM('Pending', 'Reviewed', 'Interviewing', 'Shortlisted', 'Offered', 'Rejected', 'Hired', 'Withdrawn', 'On Hold');--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"full_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "application_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"requirements" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"file_url" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"parsed_content" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"application_id" uuid NOT NULL,
	"overall_score" numeric(5, 2) NOT NULL,
	"experience_score" numeric(5, 2) NOT NULL,
	"education_score" numeric(5, 2) NOT NULL,
	"skills_score" numeric(5, 2) NOT NULL,
	"role_fit_score" numeric(5, 2) NOT NULL,
	"certifications_score" numeric(5, 2) NOT NULL,
	"project_impact_score" numeric(5, 2) NOT NULL,
	"soft_skills_score" numeric(5, 2) NOT NULL,
	CONSTRAINT "scoring_results_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"full_name" varchar NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_job_vacancies_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_vacancies"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD CONSTRAINT "job_vacancies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "scoring_results" ADD CONSTRAINT "scoring_results_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "candidates_email_idx" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "job_applications_job_id_candidate_id_idx" ON "job_applications" USING btree ("job_id","candidate_id");--> statement-breakpoint
CREATE INDEX "resumes_candidate_id_idx" ON "resumes" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");