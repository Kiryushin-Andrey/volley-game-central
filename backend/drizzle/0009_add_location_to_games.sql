-- Add explicit location fields to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS location_name varchar(255);
ALTER TABLE games ADD COLUMN IF NOT EXISTS location_link varchar(1000);
