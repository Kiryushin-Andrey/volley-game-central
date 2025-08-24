-- Create auth_sessions table for phone-based authentication
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" uuid PRIMARY KEY,
  "phone_number" varchar(50) NOT NULL UNIQUE,
  "auth_code" varchar(10) NOT NULL,
  "creating_new_user" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

-- Index for fast lookup by phone number (unique already ensures index)
CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_phone_number_uq" ON "auth_sessions"("phone_number");
