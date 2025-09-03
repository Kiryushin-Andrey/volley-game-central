-- Add webhook_received column to payment_requests table
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS webhook_received boolean NOT NULL DEFAULT false;
