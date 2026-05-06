-- ENTUR AI · Sprint 4 (profile estendido + onboarding)

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarded" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "writing_style" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "interests" JSONB;
