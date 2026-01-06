-- Fix Users Table - Add missing 'name' column
-- Run this in Supabase SQL Editor

-- Add the name column that the backend expects
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Also add login_attempts if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
