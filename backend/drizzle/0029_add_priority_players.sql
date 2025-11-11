CREATE TABLE IF NOT EXISTS "priority_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_administrator_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "priority_players" ADD CONSTRAINT "priority_players_game_administrator_id_game_administrators_id_fk" FOREIGN KEY ("game_administrator_id") REFERENCES "game_administrators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "priority_players" ADD CONSTRAINT "priority_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "priority_players_game_administrator_id_user_id_unique" ON "priority_players" USING btree ("game_administrator_id","user_id");

