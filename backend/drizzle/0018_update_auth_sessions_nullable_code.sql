-- Make auth_code nullable and remove unique constraint on phone_number
BEGIN;

-- Drop explicit unique index if it exists
DROP INDEX IF EXISTS "auth_sessions_phone_number_uq";

-- Drop implicit unique constraint created by UNIQUE on column
ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_phone_number_key";

-- Make auth_code nullable
ALTER TABLE "auth_sessions" ALTER COLUMN "auth_code" DROP NOT NULL;

-- Create helpful indexes for lookups and rate limiting
CREATE INDEX IF NOT EXISTS "auth_sessions_phone_number_idx" ON "auth_sessions" ("phone_number");
CREATE INDEX IF NOT EXISTS "auth_sessions_phone_number_created_at_idx" ON "auth_sessions" ("phone_number", "created_at");

COMMIT;
