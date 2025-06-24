-- Create bunq_credentials table with encryption support
CREATE TABLE "bunq_credentials" (
  "user_id" integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  
  -- API Key (encrypted)
  "api_key_encrypted" text NOT NULL,
  "api_key_iv" text NOT NULL,
  "api_key_auth_tag" text NOT NULL,
  "api_key_salt" text NOT NULL,
  
  -- Installation Token (encrypted, can be null)
  "installation_token_encrypted" text,
  "installation_token_iv" text,
  "installation_token_auth_tag" text,
  "installation_token_salt" text,
  
  -- Session Token (encrypted, can be null)
  "session_token_encrypted" text,
  "session_token_iv" text,
  "session_token_auth_tag" text,
  "session_token_salt" text,
  
  -- Timestamps for each credential type
  "api_key_updated_at" timestamp DEFAULT now(),
  "installation_token_updated_at" timestamp,
  "session_token_updated_at" timestamp
);

-- Add index for faster lookups
CREATE INDEX "bunq_credentials_user_id_idx" ON "bunq_credentials"("user_id");
