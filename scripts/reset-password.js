// Reset password for testing
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPassword() {
  try {
    const email = 'dariovuma@gmail.com';
    const newPassword = 'Test123';

    console.log(`🔑 Resetting password for ${email} to "${newPassword}"...`);

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
      .select('id, email')
      .single();

    if (error) {
      console.error('❌ Error updating password:', error);
      return;
    }

    console.log('✅ Password reset successful!');
    console.log('User:', user.email);
    console.log('New password:', newPassword);

    // Verify the new password works
    const isValid = await bcrypt.compare(newPassword, hashedPassword);
    console.log('Password verification test:', isValid ? '✅ PASS' : '❌ FAIL');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  resetPassword();
}

module.exports = { resetPassword };
