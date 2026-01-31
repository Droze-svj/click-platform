// Reset password for existing user
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPassword(email, newPassword) {
  console.log(`🔑 Resetting password for: ${email}\n`);

  try {
    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    const { data: user, error } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        login_attempts: 0,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select('id, email, first_name, last_name')
      .single();

    if (error) {
      console.error('❌ Error updating password:', error.message);
      return;
    }

    if (!user) {
      console.log('❌ User not found with email:', email);
      return;
    }

    console.log('✅ Password reset successful!');
    console.log(`👤 User: ${user.first_name} ${user.last_name}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 New Password: ${newPassword}`);

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

// Reset password for the user's account
resetPassword('dariovuma@gmail.com', 'Test123');





