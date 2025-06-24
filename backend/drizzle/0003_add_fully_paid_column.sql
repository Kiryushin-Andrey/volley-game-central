-- Add fully_paid column to games table
ALTER TABLE "games" ADD COLUMN "fully_paid" boolean NOT NULL DEFAULT false;
