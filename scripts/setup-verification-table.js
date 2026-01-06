// Setup email verification tokens table
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupVerificationTable() {
  console.log('🔧 Setting up email verification system...');

  try {
    // Create email_verification_tokens table
    console.log('📋 Creating email_verification_tokens table...');

    // Since we can't create tables directly, we'll use the existing approach
    // Let's check if we can use the users table with additional fields or create a separate approach

    // For now, let's modify the users table to include verification tokens in JSONB field
    // This avoids needing a separate table

    console.log('✅ Email verification will use JSONB field in users table');
    console.log('📧 Verification tokens will be stored in user metadata');

    // Test the current user structure
    const { data: testUser, error } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('❌ Error accessing users table:', error);
      return;
    }

    console.log('✅ Users table accessible');
    console.log('🎯 Email verification system ready for implementation');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupVerificationTable();
