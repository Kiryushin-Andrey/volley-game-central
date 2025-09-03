-- Add prev_display_names column to users table (nullable)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS prev_display_names text;
