-- Fix RLS Policies for User Registration
-- Run this in Supabase SQL Editor

-- First, drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow user registration" ON users;
DROP POLICY IF EXISTS "Allow login checks" ON users;

-- Then create the corrected policies
-- Allow insert for registration (NO AUTH REQUIRED)
CREATE POLICY "Allow user registration" ON users
  FOR INSERT WITH CHECK (true);

-- Allow select for login verification (NO AUTH REQUIRED)
CREATE POLICY "Allow login checks" ON users
  FOR SELECT USING (true);

-- Users can view their own data (REQUIRES AUTH)
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Users can update their own data (REQUIRES AUTH)
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);
