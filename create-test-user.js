// Create a test user account
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestUser() {
  const testEmail = 'test@example.com';
  const testPassword = 'Test123';
  const firstName = 'Test';
  const lastName = 'User';

  console.log(`🔧 Creating test user: ${testEmail}\n`);

  try {
    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(testPassword, saltRounds);

    // Create user in database
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: testEmail,
        password: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        email_verified: true,
        login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        console.log('⚠️  User already exists, updating password...');

        // Update existing user
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            email_verified: true,
            login_attempts: 0,
            updated_at: new Date().toISOString()
          })
          .eq('email', testEmail)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating user:', updateError);
          return;
        }

        console.log('✅ Test user updated successfully!');
        console.log(`📧 Email: ${testEmail}`);
        console.log(`🔑 Password: ${testPassword}`);
        console.log(`👤 Name: ${firstName} ${lastName}`);
        return;
      }

      console.error('❌ Error creating user:', error);
      return;
    }

    console.log('✅ Test user created successfully!');
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Password: ${testPassword}`);
    console.log(`👤 Name: ${user.first_name} ${user.last_name}`);

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

createTestUser();





