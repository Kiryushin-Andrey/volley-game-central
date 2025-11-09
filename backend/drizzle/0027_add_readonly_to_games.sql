-- Add readonly column to games table
ALTER TABLE "games"
  ADD COLUMN IF NOT EXISTS "readonly" boolean NOT NULL DEFAULT false;

