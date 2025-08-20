ALTER TYPE "public"."application_status" ADD VALUE 'Onboard';--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid,
	"application_id" uuid,
	"system_prompt" text,
	"notes" text,
	"recording_id" uuid,
	"report_id" uuid,
	"result" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "onboarding_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"welcome_content" jsonb NOT NULL,
	"company_content" jsonb NOT NULL,
	"team_members" jsonb NOT NULL,
	"form_fields" jsonb NOT NULL,
	"documents" jsonb NOT NULL,
	"finish_content" jsonb,
	CONSTRAINT "onboarding_content_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"transcript" jsonb,
	"uri" varchar(255),
	"speaker_metadata" jsonb,
	"duration" integer,
	"upload_status" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"answers" jsonb,
	"clarity" jsonb,
	"relevance" jsonb,
	"depth" jsonb,
	"comm_style" jsonb,
	"cultural_fit" jsonb,
	"attention_to_detail" jsonb,
	"language_proficiency" jsonb
);
--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD COLUMN "benefits" jsonb;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD COLUMN "info" text;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD COLUMN "status" varchar DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "onboarding_content" ADD CONSTRAINT "onboarding_content_job_id_job_vacancies_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_vacancies"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "onboarding_content" ADD CONSTRAINT "onboarding_content_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "calls_application_id_idx" ON "calls" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "onboarding_content_job_id_idx" ON "onboarding_content" USING btree ("job_id");