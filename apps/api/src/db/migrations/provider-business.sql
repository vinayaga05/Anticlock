-- DDL only: new registrations default to Business; old drafts normalize on save/submit.
ALTER TABLE provider_applications ALTER COLUMN provider_kind SET DEFAULT 'business';
ALTER TABLE providers ALTER COLUMN provider_kind SET DEFAULT 'business';
-- Matches the existing migration runner's approval idempotency constraint.
CREATE UNIQUE INDEX IF NOT EXISTS providers_source_application_uid ON providers (source_application_id) WHERE source_application_id IS NOT NULL;
