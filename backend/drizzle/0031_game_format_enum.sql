ALTER TABLE "games" ADD COLUMN "game_format" varchar(32) NOT NULL DEFAULT 'recreational';

UPDATE "games" SET "game_format" = CASE
  WHEN "with_positions" = true AND "with_priority_players" = false THEN 'positions'
  WHEN "with_positions" = false AND "with_priority_players" = true THEN 'priority_players'
  WHEN "with_positions" = false AND "with_priority_players" = false THEN 'recreational'
  WHEN "with_positions" = true AND "with_priority_players" = true THEN 'recreational'
  ELSE 'recreational'
END;

ALTER TABLE "games" DROP COLUMN "with_positions";
ALTER TABLE "games" DROP COLUMN "with_priority_players";
