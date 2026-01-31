// Check what users exist in the database
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  console.log('🔍 Checking users in database...\n');

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, created_at')
      .limit(10);

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    console.log('✅ Found users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.first_name} ${user.last_name}) - Created: ${user.created_at}`);
    });

  } catch (err) {
    console.error('❌ Database connection error:', err.message);
  }
}

checkUsers();





