-- Replace with_positions + with_priority_players with single game_format column
ALTER TABLE "games" ADD COLUMN "game_format" varchar(20) DEFAULT 'recreational' NOT NULL;

UPDATE "games" SET "game_format" = CASE
  WHEN "with_positions" = true AND "with_priority_players" = false THEN 'positions'
  WHEN "with_positions" = false AND "with_priority_players" = true THEN 'priority_players'
  ELSE 'recreational'
END;

ALTER TABLE "games" DROP COLUMN "with_positions";
ALTER TABLE "games" DROP COLUMN "with_priority_players";
