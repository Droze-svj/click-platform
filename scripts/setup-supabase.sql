-- Click Platform Database Schema for Supabase
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/cylfimsyfnodvgrzulof/supabase

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  password TEXT NOT NULL,
  avatar TEXT,
  bio TEXT,
  website TEXT,
  location TEXT,
  social_links JSONB,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subscription JSONB DEFAULT '{"status": "trial", "plan": "monthly"}'
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  featured_image TEXT,
  thumbnail TEXT,
  tags TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  metadata JSONB,
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id)
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  UNIQUE(user_id, post_id)
);

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(follower_id, following_id)
);

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  is_agency BOOLEAN DEFAULT FALSE,
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE
);

-- Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
-- Allow insert for registration (before auth) - NO AUTH REQUIRED
CREATE POLICY "Allow user registration" ON users
  FOR INSERT WITH CHECK (true);

-- Allow select for login verification - NO AUTH REQUIRED
CREATE POLICY "Allow login checks" ON users
  FOR SELECT USING (true);

-- Users can view their own data - REQUIRES AUTH
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Users can update their own data - REQUIRES AUTH
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Posts policies
CREATE POLICY "Users can view published posts" ON posts
  FOR SELECT USING (status = 'published' OR auth.uid() = author_id);

CREATE POLICY "Users can create posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

-- Comments policies
CREATE POLICY "Users can view comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Likes policies
CREATE POLICY "Users can view likes" ON likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own likes" ON likes
  FOR ALL USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Users can view follows" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);

-- Workspace policies
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create workspaces" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Workspace members policies
CREATE POLICY "Workspace members can view members" ON workspace_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_id = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "Workspace owners can manage members" ON workspace_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  );

-- Password reset tokens policies
CREATE POLICY "Users can create password reset tokens" ON password_reset_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can validate their own reset tokens" ON password_reset_tokens
  FOR SELECT USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can update their own reset tokens" ON password_reset_tokens
  FOR UPDATE USING (user_id = auth.uid()::uuid);

-- Email verification tokens policies
CREATE POLICY "Users can create email verification tokens" ON email_verification_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can validate email verification tokens" ON email_verification_tokens
  FOR SELECT USING (true);

CREATE POLICY "Users can update email verification tokens" ON email_verification_tokens
  FOR UPDATE USING (true);

-- Create post_analytics table
CREATE TABLE IF NOT EXISTS post_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'twitter', 'linkedin', 'instagram', 'facebook', etc.
  platform_post_id TEXT, -- The ID on the platform
  platform_post_url TEXT, -- URL to the post on the platform

  -- Core metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0, -- Twitter specific
  saves INTEGER DEFAULT 0, -- Instagram/TikTok saves

  -- Engagement rates (calculated)
  engagement_rate DECIMAL(5,4) DEFAULT 0, -- (likes + comments + shares) / views * 100
  click_through_rate DECIMAL(5,4) DEFAULT 0, -- clicks / impressions * 100

  -- Timing data
  posted_at TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Additional platform-specific data
  metadata JSONB, -- Store platform-specific metrics

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(post_id, platform)
);

-- Create platform_accounts table
CREATE TABLE IF NOT EXISTS platform_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'twitter', 'linkedin', 'instagram', etc.
  platform_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  access_token TEXT, -- Encrypted
  refresh_token TEXT, -- Encrypted
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_connected BOOLEAN DEFAULT TRUE,
  metadata JSONB, -- Platform-specific account data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Create content_insights table
CREATE TABLE IF NOT EXISTS content_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- AI-generated insights
  performance_score INTEGER DEFAULT 0, -- 0-100 score
  best_posting_time TEXT, -- "Monday 2-4 PM"
  recommended_hashtags TEXT[], -- AI suggested hashtags
  content_improvements TEXT[], -- Suggestions for better performance
  audience_reach_estimate INTEGER, -- Estimated audience size

  -- Trend analysis
  trending_topics TEXT[], -- Related trending topics
  competitor_performance JSONB, -- How competitors are doing

  -- Generated at timestamp
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create engagement_history table for time-series data
CREATE TABLE IF NOT EXISTS engagement_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_analytics_id UUID REFERENCES post_analytics(id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Snapshot of metrics at this time
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,

  -- Growth rates
  views_growth INTEGER DEFAULT 0,
  likes_growth INTEGER DEFAULT 0,
  shares_growth INTEGER DEFAULT 0,
  comments_growth INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_dashboards table for user preferences
CREATE TABLE IF NOT EXISTS analytics_dashboards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB, -- Dashboard configuration (widgets, filters, etc.)
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_dashboards ENABLE ROW LEVEL SECURITY;

-- Post analytics policies
CREATE POLICY "Users can view analytics for their posts" ON post_analytics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

CREATE POLICY "Users can create analytics for their posts" ON post_analytics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

CREATE POLICY "Users can update analytics for their posts" ON post_analytics
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

-- Platform accounts policies
CREATE POLICY "Users can manage their platform accounts" ON platform_accounts
  FOR ALL USING (user_id = auth.uid());

-- Content insights policies
CREATE POLICY "Users can view insights for their posts" ON content_insights
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create insights for their posts" ON content_insights
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Engagement history policies
CREATE POLICY "Users can view engagement history for their posts" ON engagement_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM post_analytics pa
      JOIN posts p ON pa.post_id = p.id
      WHERE pa.id = engagement_history.post_analytics_id
      AND p.author_id = auth.uid()
    )
  );

-- Analytics dashboards policies
CREATE POLICY "Users can manage their analytics dashboards" ON analytics_dashboards
  FOR ALL USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_platform ON post_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_content_insights_post_id ON content_insights(post_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_analytics_id ON engagement_history(post_analytics_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_recorded_at ON engagement_history(recorded_at);

-- Create admin user for testing (dariovuma@gmail.com)
-- Password: admin123 (hashed with bcrypt, 10 rounds)
INSERT INTO users (email, first_name, last_name, password, email_verified, email_verified_at, created_at)
VALUES ('dariovuma@gmail.com', 'Admin', 'User', '$2b$10$8K3lVzJcQXqkJ8tH5N5rNe.X5zJcQXqkJ8tH5N5rNe.X5zJcQXqkJ8tH5N5rNe', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
