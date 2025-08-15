-- Add nullable columns to support production database
ALTER TABLE "payment_requests"
  ADD COLUMN IF NOT EXISTS "user_id" integer NULL,
  ADD COLUMN IF NOT EXISTS "amount_cents" integer NULL;

-- Backfill user_id from game_registrations when possible
UPDATE "payment_requests" pr
SET "user_id" = gr."user_id"
FROM "game_registrations" gr
WHERE pr."game_registration_id" = gr."id"
  AND pr."user_id" IS NULL;
