ALTER TABLE "users" ADD COLUMN "avatar_url" varchar(500);--> statement-breakpoint
ALTER TABLE "game_registrations" DROP COLUMN IF EXISTS "is_waitlist";