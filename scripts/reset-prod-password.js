// Reset password for production user
// This script resets the password for dariovuma@gmail.com in production
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Use production environment variables if available, otherwise fall back to .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing production Supabase configuration!');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetProdPassword() {
  try {
    const email = 'dariovuma@gmail.com';
    const newPassword = 'Test123';

    console.log(`🔑 Resetting production password for ${email} to "${newPassword}"...`);
    console.log('Using Supabase URL:', supabaseUrl.substring(0, 30) + '...');

    // Check if user exists first
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', email)
      .single();

    if (checkError || !existingUser) {
      console.error('❌ User not found in production database:', checkError?.message);
      return;
    }

    console.log('✅ User found:', existingUser.email);

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user
    const { data: user, error } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        login_attempts: 0, // Reset failed login attempts
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select('id, email, first_name, last_name')
      .single();

    if (error) {
      console.error('❌ Error updating password:', error);
      return;
    }

    console.log('✅ Production password reset successful!');
    console.log('User:', user.email);
    console.log('New password:', newPassword);

    // Verify the new password works
    const isValid = await bcrypt.compare(newPassword, hashedPassword);
    console.log('Password verification test:', isValid ? '✅ PASS' : '❌ FAIL');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

resetProdPassword();
