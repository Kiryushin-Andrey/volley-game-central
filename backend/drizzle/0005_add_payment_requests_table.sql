-- Add payment_requests table
CREATE TABLE IF NOT EXISTS "payment_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "game_registration_id" serial NOT NULL,
  "payment_request_id" varchar(255) NOT NULL,
  "payment_link" varchar(500) NOT NULL,
  "monetary_account_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_checked_at" timestamp DEFAULT now() NOT NULL,
  "paid" boolean DEFAULT false NOT NULL
);

--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_game_registration_id_game_registrations_id_fk" FOREIGN KEY ("game_registration_id") REFERENCES "game_registrations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
