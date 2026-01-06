// Check users in Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...');

    // Check if users table exists and has data
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, created_at')
      .limit(10);

    if (error) {
      console.error('❌ Error querying users:', error);
      return;
    }

    console.log(`📊 Found ${users.length} users in database:`);
    users.forEach(user => {
      const name = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.first_name || user.last_name || 'No name';
      console.log(`  - ${user.email} (${name}) - ID: ${user.id}, Created: ${user.created_at}`);
    });

    // Specifically check for the user trying to login
    const { data: specificUser } = await supabase
      .from('users')
      .select('id, email, password, login_attempts')
      .eq('email', 'dariovuma@gmail.com')
      .single();

    if (specificUser) {
      console.log('\n🎯 User dariovuma@gmail.com found:');
      console.log(`  - ID: ${specificUser.id}`);
      console.log(`  - Has password: ${!!specificUser.password}`);
      console.log(`  - Login attempts: ${specificUser.login_attempts || 0}`);
    } else {
      console.log('\n❌ User dariovuma@gmail.com not found in database');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkUsers();
