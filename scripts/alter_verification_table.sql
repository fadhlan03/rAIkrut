-- ALTER TABLE to add new columns to existing candidate_verifications table
-- Run this after the initial table creation

ALTER TABLE "public"."candidate_verifications" 
ADD COLUMN IF NOT EXISTS "original_video_url" varchar(512),
ADD COLUMN IF NOT EXISTS "original_photo_url" varchar(512),
ADD COLUMN IF NOT EXISTS "original_audio_url" varchar(512),
ADD COLUMN IF NOT EXISTS "test_video_url" varchar(512),
ADD COLUMN IF NOT EXISTS "test_photo_url" varchar(512),
ADD COLUMN IF NOT EXISTS "test_audio_url" varchar(512),
ADD COLUMN IF NOT EXISTS "original_media_uploaded_at" timestamp,
ADD COLUMN IF NOT EXISTS "test_media_uploaded_at" timestamp;

-- Drop old columns if they exist
ALTER TABLE "public"."candidate_verifications" 
DROP COLUMN IF EXISTS "video_url",
DROP COLUMN IF EXISTS "photo_url",
DROP COLUMN IF EXISTS "audio_url"; 