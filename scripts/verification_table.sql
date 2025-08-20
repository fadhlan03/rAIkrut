-- Add verification status enum
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'processing', 'verified', 'rejected', 'failed');

-- Create verification table with original and test media pairs
CREATE TABLE "public"."candidate_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	
	-- Original reference media (from /verify - user's ID)
	"original_video_url" varchar(512),
	"original_photo_url" varchar(512),
	"original_audio_url" varchar(512),
	
	-- Test media (from /verify/test - for verification against original)
	"test_video_url" varchar(512),
	"test_photo_url" varchar(512),
	"test_audio_url" varchar(512),
	
	-- Verification status and scores
	"verification_status" "public"."verification_status" DEFAULT 'pending' NOT NULL,
	"deepfake_score" decimal(5,2),
	"face_verification_score" decimal(5,2),
	"voice_verification_score" decimal(5,2),
	
	-- Analysis metadata and results
	"verification_metadata" jsonb,
	"rejection_reason" text,
	"verified_at" timestamp,
	
	-- Timestamps for different stages
	"original_media_uploaded_at" timestamp,
	"test_media_uploaded_at" timestamp,
	
	CONSTRAINT "candidate_verifications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE cascade
);

-- Create indexes for better performance
CREATE INDEX "candidate_verifications_candidate_id_idx" ON "public"."candidate_verifications" ("candidate_id");
CREATE INDEX "candidate_verifications_status_idx" ON "public"."candidate_verifications" ("verification_status");
CREATE INDEX "candidate_verifications_created_at_idx" ON "public"."candidate_verifications" ("created_at"); 