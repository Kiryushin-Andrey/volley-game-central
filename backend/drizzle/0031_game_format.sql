-- Replace with_positions / with_priority_players with game_format enum column
ALTER TABLE "games" ADD COLUMN "game_format" varchar(20) DEFAULT 'recreational' NOT NULL;

UPDATE "games" SET "game_format" = 'positions'
WHERE "with_positions" = true AND "with_priority_players" = false;

UPDATE "games" SET "game_format" = 'priority_players'
WHERE "with_positions" = false AND "with_priority_players" = true;

UPDATE "games" SET "game_format" = 'recreational'
WHERE ("with_positions" = false AND "with_priority_players" = false)
   OR ("with_positions" = true AND "with_priority_players" = true);

ALTER TABLE "games" DROP COLUMN "with_positions";
ALTER TABLE "games" DROP COLUMN "with_priority_players";
