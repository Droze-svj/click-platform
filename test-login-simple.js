// Simple login test without requiring env file
const fetch = require('node-fetch');

async function testLogin(email, password) {
  console.log(`🔐 Testing login for: ${email}\n`);

  try {
    const response = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    const data = await response.json();

    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📋 Response Data:`);
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`\n✅ LOGIN SUCCESSFUL!`);
      console.log(`👤 User: ${data.data.user.name} (${data.data.user.email})`);
    } else {
      console.log(`\n❌ LOGIN FAILED: ${data.error}`);
    }

  } catch (error) {
    console.error(`❌ NETWORK ERROR:`, error.message);
  }
}

// Test with common credentials
async function runTests() {
  console.log('🧪 SIMPLE LOGIN TESTS');
  console.log('====================\n');

  const testCredentials = [
    { email: 'test@example.com', password: 'Test123' },
    { email: 'admin@whop.ai', password: 'Test123' },
    { email: 'dariovuma@gmail.com', password: 'Test123' }
  ];

  for (const creds of testCredentials) {
    await testLogin(creds.email, creds.password);
    console.log('\n' + '='.repeat(50) + '\n');
  }

  console.log('💡 TIP: If login fails, the account may not exist or password may be different.');
  console.log('💡 You can register a new account at: http://localhost:3000/register');
}

runTests();





