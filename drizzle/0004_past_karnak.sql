ALTER TABLE "job_vacancies" ALTER COLUMN "job_desc" SET DATA TYPE jsonb USING '[]'::jsonb;
ALTER TABLE "job_vacancies" ALTER COLUMN "requirements" SET DATA TYPE jsonb USING '[]'::jsonb;