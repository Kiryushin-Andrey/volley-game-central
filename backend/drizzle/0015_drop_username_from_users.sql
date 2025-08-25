-- Drop legacy username column from users table
-- This column was originally created in 0000 and superseded by display_name and telegram_username in 0014

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "username";
