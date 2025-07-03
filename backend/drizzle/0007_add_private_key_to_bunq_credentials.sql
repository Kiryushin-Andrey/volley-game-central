-- Add private key fields to bunq_credentials table
ALTER TABLE "bunq_credentials" 
ADD COLUMN "private_key_encrypted" text,
ADD COLUMN "private_key_iv" text,
ADD COLUMN "private_key_auth_tag" text,
ADD COLUMN "private_key_salt" text,
ADD COLUMN "private_key_updated_at" timestamp;
