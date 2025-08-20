-- Migration: Add onboarding_completion table and onboarding_status enum
-- Description: Track candidate progress through onboarding process and store form responses

-- Create the onboarding_status enum
CREATE TYPE onboarding_status AS ENUM (
    'not_started',
    'in_progress', 
    'completed',
    'abandoned'
);

-- Create the onboarding_completion table
CREATE TABLE onboarding_completion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE ON UPDATE CASCADE,
    onboarding_content_id UUID NOT NULL REFERENCES onboarding_content(id) ON DELETE CASCADE ON UPDATE CASCADE,
    status onboarding_status NOT NULL DEFAULT 'not_started',
    completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of completed step names
    form_responses JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store all form input data
    current_step VARCHAR DEFAULT 'welcome', -- Current step: welcome, company, organization, form, documents, finish
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for better performance
CREATE UNIQUE INDEX onboarding_completion_candidate_onboarding_idx 
ON onboarding_completion(candidate_id, onboarding_content_id);

CREATE INDEX onboarding_completion_candidate_id_idx 
ON onboarding_completion(candidate_id);

CREATE INDEX onboarding_completion_onboarding_content_id_idx 
ON onboarding_completion(onboarding_content_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_onboarding_completion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER onboarding_completion_updated_at
    BEFORE UPDATE ON onboarding_completion
    FOR EACH ROW
    EXECUTE FUNCTION update_onboarding_completion_updated_at();

-- Add comments for documentation
COMMENT ON TABLE onboarding_completion IS 'Tracks candidate progress through the onboarding process and stores their form responses';
COMMENT ON COLUMN onboarding_completion.completed_steps IS 'JSON array of completed step names: ["welcome", "company", "organization", "form", "documents", "finish"]';
COMMENT ON COLUMN onboarding_completion.form_responses IS 'JSON object storing all form input data from the onboarding process';
COMMENT ON COLUMN onboarding_completion.current_step IS 'Current onboarding step: welcome, company, organization, form, documents, finish';
COMMENT ON COLUMN onboarding_completion.started_at IS 'Timestamp when candidate first started the onboarding process';
COMMENT ON COLUMN onboarding_completion.completed_at IS 'Timestamp when candidate completed the entire onboarding process'; 