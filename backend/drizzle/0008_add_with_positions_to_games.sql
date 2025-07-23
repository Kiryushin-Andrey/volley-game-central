-- Add with_positions column to games table
ALTER TABLE "games" ADD COLUMN "with_positions" boolean DEFAULT false NOT NULL;
