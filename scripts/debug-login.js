// Debug login issue
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLogin() {
  try {
    const email = 'dariovuma@gmail.com';
    const password = 'Test123';

    console.log('🔍 Debugging login for:', email);

    // Find user in Supabase (same query as login route)
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, password, login_attempts, last_login_at')
      .eq('email', email.toLowerCase())
      .single();

    console.log('Query result:', {
      userFound: !!user,
      error: findError?.message,
      userId: user?.id,
      userEmail: user?.email
    });

    if (findError || !user) {
      console.log('❌ User lookup failed');
      return;
    }

    // Create combined name field
    user.name = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.first_name || user.last_name || 'User';

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      name: user.name,
      hasPassword: !!user.password,
      passwordLength: user.password?.length,
      loginAttempts: user.login_attempts || 0
    });

    // Check if account is locked
    if ((user.login_attempts || 0) >= 5) {
      console.log('❌ Account locked due to too many failed attempts');
      return;
    }

    // Verify password
    console.log('🔐 Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password verification result:', isValidPassword);

    // Check temp allow (should not apply)
    const tempAllow = user.email === 'freshuser@example.com' && password === 'FreshPass123';
    console.log('Temp allow check:', tempAllow);

    if (!isValidPassword && !tempAllow) {
      console.log('❌ Password verification failed - would increment login attempts');
    } else {
      console.log('✅ Login would succeed!');
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugLogin();
