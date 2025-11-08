CREATE TABLE IF NOT EXISTS "game_administrators" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_of_week" integer NOT NULL,
	"with_positions" boolean DEFAULT false NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "game_administrators" ADD CONSTRAINT "game_administrators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_administrators_day_of_week_with_positions_unique" ON "game_administrators" USING btree ("day_of_week","with_positions");
