CREATE TYPE "player_skill_level" AS ENUM ('beginner', 'intermediate', 'advanced');
ALTER TABLE "users" ADD COLUMN "player_level" "player_skill_level";

CREATE TYPE "game_play_mode" AS ENUM ('with_positions', 'with_priority_players', 'regular');

ALTER TABLE "games" ADD COLUMN "play_mode" "game_play_mode" DEFAULT 'regular' NOT NULL;

UPDATE "games" SET "play_mode" = 'with_positions' WHERE "with_positions" = true;

UPDATE "games"
SET "play_mode" = 'with_priority_players'
WHERE "with_positions" = false AND "with_priority_players" = true;

ALTER TABLE "games" DROP COLUMN "with_positions";
ALTER TABLE "games" DROP COLUMN "with_priority_players";
