// Check what columns exist in users table
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  try {
    console.log('🔍 Checking users table columns...');

    // Try to get a user and see what columns are returned
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'dariovuma@gmail.com')
      .single();

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ User found with columns:');
    console.log(Object.keys(user));
    console.log('📊 Column values:');
    Object.entries(user).forEach(([key, value]) => {
      const displayValue = typeof value === 'string' && value.length > 50
        ? value.substring(0, 50) + '...'
        : value;
      console.log(`  ${key}: ${displayValue}`);
    });

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkColumns();
