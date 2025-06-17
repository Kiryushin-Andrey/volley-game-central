-- Add unregister_deadline_hours column to games table
ALTER TABLE "games" ADD COLUMN "unregister_deadline_hours" integer NOT NULL DEFAULT 5;
