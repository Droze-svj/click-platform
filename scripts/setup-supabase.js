// Supabase Database Setup Script
// This script creates the necessary tables and RLS policies for Click

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Setting up Click database schema in Supabase...');

  try {
    // Create users table
    console.log('📋 Creating users table...');
    await supabase.rpc('exec_sql', {
      sql: `
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    // Create posts table
    console.log('📋 Creating posts table...');
    await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    // Create comments table
    console.log('📋 Creating comments table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS comments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          author_id UUID REFERENCES users(id) ON DELETE CASCADE,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          parent_id UUID REFERENCES comments(id)
        );
      `
    });

    // Create likes table
    console.log('📋 Creating likes table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS likes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          UNIQUE(user_id, post_id)
        );
      `
    });

    // Create follows table
    console.log('📋 Creating follows table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS follows (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
          following_id UUID REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(follower_id, following_id)
        );
      `
    });

    // Create workspaces table
    console.log('📋 Creating workspaces table...');
    await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    // Create workspace_members table
    console.log('📋 Creating workspace_members table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS workspace_members (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          role TEXT DEFAULT 'member',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(workspace_id, user_id)
        );
      `
    });

    // Enable Row Level Security
    console.log('🔒 Enabling Row Level Security...');

    const tables = ['users', 'posts', 'comments', 'likes', 'follows', 'workspaces', 'workspace_members'];

    for (const table of tables) {
      await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
      });
    }

    // Create basic RLS policies
    console.log('📋 Creating basic RLS policies...');

    // Users can read their own data
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can view own data" ON users
        FOR SELECT USING (auth.uid() = id);
      `
    });

    // Users can update their own data
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can update own data" ON users
        FOR UPDATE USING (auth.uid() = id);
      `
    });

    console.log('✅ Database schema created successfully!');
    console.log('✅ Row Level Security enabled!');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Update your server/.env with the connection details');
    console.log('2. Run: npx prisma generate');
    console.log('3. Restart your server');
    console.log('');
    console.log('Your Click app is now ready to use Supabase! 🚀');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();



