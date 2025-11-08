-- Add blocked_by_id column to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "blocked_by_id" integer NULL;

-- Add foreign key constraint with ON DELETE SET NULL
ALTER TABLE "users" 
  ADD CONSTRAINT "users_blocked_by_id_users_id_fk" 
  FOREIGN KEY ("blocked_by_id") 
  REFERENCES "users"("id") 
  ON DELETE SET NULL 
  ON UPDATE NO ACTION;

