-- Add telegram_username (nullable) and display_name (non-null) to users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "telegram_username" varchar(255),
  ADD COLUMN IF NOT EXISTS "display_name" varchar(255);

-- Backfill display_name from existing username for all rows where it's NULL
UPDATE "users"
SET "display_name" = "username"
WHERE "display_name" IS NULL;

-- Enforce NOT NULL on display_name after backfill
ALTER TABLE "users"
  ALTER COLUMN "display_name" SET NOT NULL;
