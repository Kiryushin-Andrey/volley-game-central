CREATE TABLE IF NOT EXISTS "spot_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"registration_id" integer NOT NULL,
	"offerer_user_id" integer NOT NULL,
	"public_announced_at" timestamp,
	"public_telegram_message_id" bigint,
	"fulfilled_by_user_id" integer,
	"next_action_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spot_offer_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"spot_offer_id" integer NOT NULL,
	"invitee_user_id" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"telegram_chat_id" varchar(255),
	"telegram_message_id" bigint
);
--> statement-breakpoint
ALTER TABLE "spot_offers" ADD CONSTRAINT "spot_offers_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_offers" ADD CONSTRAINT "spot_offers_registration_id_game_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "game_registrations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_offers" ADD CONSTRAINT "spot_offers_offerer_user_id_users_id_fk" FOREIGN KEY ("offerer_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_offers" ADD CONSTRAINT "spot_offers_fulfilled_by_user_id_users_id_fk" FOREIGN KEY ("fulfilled_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_offer_invites" ADD CONSTRAINT "spot_offer_invites_spot_offer_id_spot_offers_id_fk" FOREIGN KEY ("spot_offer_id") REFERENCES "spot_offers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spot_offer_invites" ADD CONSTRAINT "spot_offer_invites_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spot_offer_invites_offer_invitee_uidx" ON "spot_offer_invites" ("spot_offer_id","invitee_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spot_offers_one_open_per_registration_uidx" ON "spot_offers" ("registration_id") WHERE "fulfilled_by_user_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spot_offers_game_id_idx" ON "spot_offers" ("game_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spot_offers_open_by_game_idx" ON "spot_offers" ("game_id") WHERE "fulfilled_by_user_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spot_offers_due_next_action_idx" ON "spot_offers" ("next_action_at") WHERE "fulfilled_by_user_id" IS NULL AND "next_action_at" IS NOT NULL;
