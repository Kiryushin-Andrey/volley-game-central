ALTER TABLE "games" ADD COLUMN "collector_user_id" integer;
ALTER TABLE "games" ADD CONSTRAINT "games_collector_user_id_users_id_fk" FOREIGN KEY ("collector_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
