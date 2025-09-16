-- Add bringing_the_ball column to game_registrations table
ALTER TABLE "game_registrations" ADD COLUMN "bringing_the_ball" boolean DEFAULT false NOT NULL;
