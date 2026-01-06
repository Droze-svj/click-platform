// Test password verification
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPassword() {
  try {
    console.log('🔐 Testing password verification...');

    // Get the user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('email', 'dariovuma@gmail.com')
      .single();

    if (error || !user) {
      console.error('❌ User not found:', error);
      return;
    }

    console.log('User found:', user.email);
    console.log('Stored password hash length:', user.password.length);
    console.log('Password hash starts with:', user.password.substring(0, 10) + '...');

    // Test different passwords
    const testPasswords = ['Test123', 'test123', 'Test123!', 'password123'];

    for (const testPass of testPasswords) {
      const isValid = await bcrypt.compare(testPass, user.password);
      console.log(`Password "${testPass}": ${isValid ? '✅ MATCH' : '❌ NO MATCH'}`);
    }

    // Show bcrypt info
    console.log('\n🔍 Password hash details:');
    console.log('Rounds used:', bcrypt.getRounds(user.password));
    console.log('Is valid bcrypt hash:', user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

testPassword();
