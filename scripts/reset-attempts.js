// Reset login attempts for user
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetAttempts() {
  try {
    const email = 'dariovuma@gmail.com';

    console.log(`🔄 Resetting login attempts for ${email}...`);

    // Reset login attempts
    const { data: user, error } = await supabase
      .from('users')
      .update({
        login_attempts: 0,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select('id, email, login_attempts')
      .single();

    if (error) {
      console.error('❌ Error resetting attempts:', error);
      return;
    }

    console.log('✅ Login attempts reset successfully!');
    console.log('User:', user.email);
    console.log('Login attempts:', user.login_attempts);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

resetAttempts();
