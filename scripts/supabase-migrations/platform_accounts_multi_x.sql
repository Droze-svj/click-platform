-- Allow multiple X (Twitter) accounts per user.
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run.
--
-- 1. Drop the existing unique constraint (one account per user per platform)
-- 2. Add a new unique constraint (one row per user per platform per platform_user_id)

ALTER TABLE platform_accounts
  DROP CONSTRAINT IF EXISTS platform_accounts_user_id_platform_key;

ALTER TABLE platform_accounts
  ADD CONSTRAINT platform_accounts_user_platform_account_unique
  UNIQUE (user_id, platform, platform_user_id);

-- Optional: ensure updated_at exists for upsert
-- ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
