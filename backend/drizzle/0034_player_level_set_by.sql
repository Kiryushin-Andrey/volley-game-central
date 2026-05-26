ALTER TABLE "users" ADD COLUMN "player_level_set_by_id" integer;
ALTER TABLE "users" ADD COLUMN "player_level_set_at" timestamp;
ALTER TABLE "users" ADD CONSTRAINT "users_player_level_set_by_id_users_id_fk" FOREIGN KEY ("player_level_set_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
