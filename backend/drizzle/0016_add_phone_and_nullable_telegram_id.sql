-- Add phone_number and phone_number_verified; make telegram_id nullable
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone_number" varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean NOT NULL DEFAULT false;

-- Make telegram_id nullable (unique constraint remains; PostgreSQL allows multiple NULLs)
ALTER TABLE "users"
  ALTER COLUMN "telegram_id" DROP NOT NULL;
