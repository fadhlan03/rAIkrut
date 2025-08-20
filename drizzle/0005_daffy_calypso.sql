ALTER TABLE "candidates" ADD COLUMN "birthdate" timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "job_interest" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "education" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "work_experience" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "org_experience" jsonb;