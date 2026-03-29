#!/usr/bin/env node
/**
 * Run the platform_accounts multi-X migration against Supabase Postgres.
 *
 * Option A - Use this script (requires direct Postgres URL):
 *   1. In Supabase Dashboard: Project → Connect → "Direct connection" → copy the URI.
 *   2. Put it in .env as SUPABASE_DB_URL (use your DB password in the URI).
 *   3. Run: node scripts/run-supabase-migration.js
 *
 * Option B - Run SQL manually:
 *   Supabase Dashboard → SQL Editor → New query → paste contents of
 *   scripts/supabase-migrations/platform_accounts_multi_x.sql → Run.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString || !connectionString.startsWith('postgres')) {
  console.log(`
Supabase migration: multi-X accounts (platform_accounts)

SUPABASE_DB_URL (or DATABASE_URL) is not set or not a Postgres URL.

Option A - Run this script:
  1. Supabase Dashboard → your project → Connect → "Direct connection"
  2. Copy the connection string (postgresql://postgres:...@db.xxx.supabase.co:5432/postgres)
  3. Replace [YOUR-PASSWORD] with your database password
  4. Add to .env: SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres"
  5. Run: node scripts/run-supabase-migration.js

Option B - Run SQL manually:
  1. Open: scripts/supabase-migrations/platform_accounts_multi_x.sql
  2. Supabase Dashboard → SQL Editor → New query
  3. Paste the SQL and click Run
`);
  process.exit(1);
}

async function run() {
  const { Client } = require('pg');
  const sqlPath = path.join(__dirname, 'supabase-migrations', 'platform_accounts_multi_x.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // Strip single-line comments, then split by semicolon and keep ALTER statements
  const statements = sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^\s*ALTER\s+TABLE/i.test(s));

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres.\n');
    for (const statement of statements) {
      const oneLiner = statement.replace(/\s+/g, ' ').slice(0, 70) + '...';
      console.log('Running:', oneLiner);
      await client.query(statement + ';');
      console.log('  OK');
    }
    console.log('\nMigration completed. You can now add multiple X accounts in Click.');
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    if (err.code === 'ENOTFOUND' || err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
      console.log('\nCould not reach Supabase. Check SUPABASE_DB_URL in .env (get it from Supabase Dashboard → Connect → Direct connection).');
      console.log('Or run the SQL manually: Supabase Dashboard → SQL Editor → paste scripts/supabase-migrations/platform_accounts_multi_x.sql → Run.');
    } else if (err.message.includes('does not exist')) {
      console.log('If the constraint name is different, run the SQL manually in Supabase SQL Editor.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
